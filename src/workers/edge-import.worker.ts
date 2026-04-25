/**
 * edge-import.worker.ts — V3 "Absolute Edge" Import Pipeline
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * THREADING MODEL
 * ────────────────
 *
 *   Main Thread          edge-import.worker         pglite-opfs.worker
 *   ───────────          ────────────────────        ──────────────────
 *   File.stream()
 *       │
 *       │ postMessage + [stream] (Transferable)
 *       ▼
 *   ┌──────────────────────────────────────────┐
 *   │  reader = stream.getReader()              │
 *   │  while read() → WASM parse_chunk()        │
 *   │       │                                    │
 *   │       ├─ accumulate records                │
 *   │       │                                    │
 *   │       ├─ every FLUSH_SIZE → writeBatch()   │──── PGliteWorker proxy ───▶ OPFS
 *   │       │                                    │
 *   │       └─ throttled postMessage(PROGRESS)   │
 *   │                                            │
 *   │  flush_parser() → final writeBatch()       │
 *   │  destroy_parser()                          │
 *   │  postMessage(COMPLETE)                     │
 *   └──────────────────────────────────────────┘
 *       │
 *       ▼
 *   Main Thread receives PROGRESS / COMPLETE
 *
 * ZERO DATA BACKFLOW: parsed records never leave this worker. Only tiny
 * progress payloads (~100 bytes each) cross the postMessage bridge.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Transaction } from "@electric-sql/pglite";
import { createParser } from "./parser-contract";
import type { StreamParser, ParserBackend, ParsedRecord } from "./parser-contract";
import type { BrowserPgClient } from "../db/pglite-browser";

// ── Type exports ─────────────────────────────────────────────────────────────
// Consumed by the React component that spawns this worker.

export interface InitStreamPayload {
  importId: string;
  fileName: string;
  fileSizeBytes: number;
  /** Records per PGlite micro-transaction. Default 500. */
  flushSize?: number;
  /** Origin ID for CRDT writes. Generated on main thread (has localStorage). */
  originId: string;
}

export type MainToWorker =
  | { type: "INIT_STREAM"; payload: InitStreamPayload; stream: ReadableStream<Uint8Array> }
  | { type: "ABORT"; reason: string };

export interface ProgressPayload {
  bytesProcessed: number;
  fileSizeBytes: number;
  recordsParsed: number;
  recordsWritten: number;
  batchesCommitted: number;
  /** 0-100 */
  percent: number;
}

export interface CompleteSummary {
  importId: string;
  questionsInserted: number;
  flashcardsInserted: number;
  totalRecordsWritten: number;
  parseErrors: number;
  durationMs: number;
  /** Which parser backend ran — "wasm" or "js-fallback". */
  parserBackend: ParserBackend;
}

export type ErrorCode =
  | "WASM_LOAD_FAILED"
  | "DB_INIT_FAILED"
  | "PARSE_FATAL"
  | "DB_WRITE_FAILED"
  | "STREAM_READ_FAILED"
  | "PROTOCOL_VIOLATION"
  | "UNKNOWN";

/**
 * Structured clone-safe error payload. Using structured fields instead of an
 * Error object because Error instances are not safely cloneable across the
 * Worker message channel in all runtimes.
 */
export interface SerializedWorkerError {
  name: string;
  message: string;
  stack?: string;
  /** Stringified cause, if the original Error had one. */
  cause?: string;
}

export type WorkerToMain =
  | { type: "WORKER_READY" }
  | { type: "PROGRESS"; payload: ProgressPayload }
  | { type: "COMPLETE"; payload: CompleteSummary }
  | { type: "ERROR"; code: ErrorCode; error: SerializedWorkerError }
  | { type: "ABORTED" };

// ── Internal state ───────────────────────────────────────────────────────────

let aborted = false;

function send(msg: WorkerToMain): void {
  self.postMessage(msg);
}

/** Converts any thrown value into a structured clone-safe error payload. */
function serializeError(err: unknown): SerializedWorkerError {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      cause: err.cause !== undefined ? String(err.cause) : undefined,
    };
  }
  return { name: "Error", message: String(err) };
}

// ── Progress throttle ────────────────────────────────────────────────────────
// Limit postMessage to once per THROTTLE_MS to avoid saturating the
// message channel and starving the main-thread rAF loop.

const THROTTLE_MS = 120;
let lastProgressAt = 0;
let pendingProgress: ProgressPayload | null = null;

function maybeSendProgress(p: ProgressPayload, force = false): void {
  const now = performance.now();
  if (force || now - lastProgressAt >= THROTTLE_MS) {
    send({ type: "PROGRESS", payload: p });
    lastProgressAt = now;
    pendingProgress = null;
  } else {
    pendingProgress = p;
  }
}

function flushPendingProgress(): void {
  if (pendingProgress) {
    send({ type: "PROGRESS", payload: pendingProgress });
    pendingProgress = null;
  }
}

// ── Batch writer ─────────────────────────────────────────────────────────────

/**
 * Writes records to PGlite/OPFS in a single transaction.
 * Drives the raw PGliteWorker API (pg.query / pg.transaction) directly so that
 * positional parameters ($1, $2, …) are correctly bound by PGlite.
 *
 * NOTE: localStorage is NOT available in Web Workers, so CRDT helpers
 * (originId, logicalClock) are managed locally here.
 */

/**
 * Narrow interface for the worker-side raw PGlite connection.
 * Maps exactly to the subset of PGliteInterface used in this worker.
 * Using `pg.query()` (parameterized) instead of `db.execute()` (Drizzle ORM),
 * because Drizzle's execute() does not forward a separate params array to PGlite.
 */
interface WorkerRawDb {
  execute(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  transaction<T>(fn: (tx: WorkerRawDb) => Promise<T>): Promise<T>;
}

/**
 * Wraps a PGlite Transaction (received inside pg.transaction()) as WorkerRawDb.
 * Nested transactions are never used in this worker; the method throws to
 * surface any accidental call at the earliest possible point.
 */
function makeTxAdapter(tx: Transaction): WorkerRawDb {
  return {
    execute: (sql, params) => tx.query(sql, params as unknown[]),
    transaction: () => {
      throw new Error("Nested transactions are not supported in the edge import worker.");
    },
  };
}

/**
 * Wraps the raw PGliteWorker as WorkerRawDb.
 * All SQL goes through pg.query() so positional params are correctly bound.
 */
function makeDbAdapter(pg: BrowserPgClient): WorkerRawDb {
  return {
    execute: (sql, params) => pg.query(sql, params as unknown[]),
    transaction: <T>(fn: (tx: WorkerRawDb) => Promise<T>) =>
      pg.transaction((pgTx) => fn(makeTxAdapter(pgTx))),
  };
}

let _dbPromise: Promise<{ db: WorkerRawDb; maxClock: number }> | null = null;
let _logicalClock = 0;

async function getWorkerDb(): Promise<{ db: WorkerRawDb; maxClock: number }> {
  if (!_dbPromise) {
    _dbPromise = (async () => {
      const { getBrowserDb } = await import("../db/pglite-browser");
      const { pg } = await getBrowserDb();
      const db = makeDbAdapter(pg);

      // Bootstrap clock from existing data: ensures monotonicity across sessions.
      let maxClock = 0;
      try {
        const r1 = await db.execute(
          "SELECT COALESCE(MAX(logical_clock), 0) AS mc FROM questions"
        );
        const r2 = await db.execute(
          "SELECT COALESCE(MAX(logical_clock), 0) AS mc FROM flashcards"
        );
        const c1 = Number(r1.rows[0]?.mc ?? 0);
        const c2 = Number(r2.rows[0]?.mc ?? 0);
        maxClock = Math.max(c1, c2);
      } catch {
        // Tables might not exist yet — start at 0.
      }

      return { db, maxClock };
    })();
  }
  return _dbPromise;
}

function nextClock(): number {
  return ++_logicalClock;
}

interface WriteStats {
  questionsInserted: number;
  flashcardsInserted: number;
}

async function writeBatch(
  records: ParsedRecord[],
  importId: string,
  originId: string,
): Promise<WriteStats> {
  if (records.length === 0) return { questionsInserted: 0, flashcardsInserted: 0 };

  const { db } = await getWorkerDb();
  const now = Date.now();
  const stats: WriteStats = { questionsInserted: 0, flashcardsInserted: 0 };

  await db.transaction(async (tx) => {
    for (const record of records) {
      const clock = nextClock();

      if (record.record_type === "question") {
        const r = record as unknown as Record<string, unknown>;
        await tx.execute(
          `INSERT INTO questions (
            id, import_id, external_key, chapter_id,
            stem_html, stem_text, lead_in,
            explanation_html, educational_objective, why_correct,
            question_type, difficulty, subject, system, category, topic,
            tags_json, correct_option_id, source_json,
            is_active, created_at, updated_at,
            is_deleted, logical_clock, origin_id
          ) VALUES (
            gen_random_uuid()::text,
            $1, $2, $3,
            $4, $5, $6,
            $7, $8, $9,
            $10, $11, $12, $13, $14, $15,
            $16, $17, $18,
            1, $19, $19,
            0, $20, $21
          )
          ON CONFLICT (external_key) DO UPDATE SET
            stem_html = EXCLUDED.stem_html,
            stem_text = EXCLUDED.stem_text,
            explanation_html = EXCLUDED.explanation_html,
            difficulty = EXCLUDED.difficulty,
            tags_json = EXCLUDED.tags_json,
            source_json = EXCLUDED.source_json,
            updated_at = EXCLUDED.updated_at,
            logical_clock = EXCLUDED.logical_clock,
            origin_id = EXCLUDED.origin_id
          WHERE
            EXCLUDED.logical_clock > questions.logical_clock
            OR (EXCLUDED.logical_clock = questions.logical_clock
                AND EXCLUDED.updated_at > questions.updated_at)`,
          [
            importId,                                                     // $1
            r.externalKey ?? null,                                        // $2
            r.chapterId ?? null,                                          // $3
            r.stemHtml ?? "",                                             // $4
            r.stemText ?? null,                                           // $5
            r.leadIn ?? null,                                             // $6
            r.explanationHtml ?? null,                                    // $7
            r.educationalObjective ?? null,                               // $8
            r.whyCorrect ?? null,                                         // $9
            r.questionType ?? "single_best_answer",                       // $10
            r.difficulty ?? null,                                         // $11
            r.subject ?? null,                                            // $12
            r.system ?? null,                                             // $13
            r.category ?? null,                                           // $14
            r.topic ?? null,                                              // $15
            r.tags ? JSON.stringify(r.tags) : null,                       // $16
            r.correctAnswer ?? null,                                      // $17
            r.sourceJson ? JSON.stringify(r.sourceJson) : null,           // $18
            now,                                                          // $19
            clock,                                                        // $20
            originId,                                                     // $21
          ],
        );

        // Insert options if present.
        const options = r.options as Array<Record<string, unknown>> | undefined;
        if (options && Array.isArray(options) && options.length > 0) {
          for (const opt of options) {
            await tx.execute(
              `INSERT INTO question_options (
                id, question_id, option_key, content_html, content_text,
                is_correct, sort_order, created_at
              ) VALUES (
                gen_random_uuid()::text,
                (SELECT id FROM questions WHERE external_key = $1 LIMIT 1),
                $2, $3, $4, $5, $6, $7
              ) ON CONFLICT (question_id, option_key) DO UPDATE SET
                content_html = EXCLUDED.content_html,
                content_text = EXCLUDED.content_text,
                is_correct = EXCLUDED.is_correct`,
              [
                r.externalKey,
                opt.optionKey ?? opt.option_key ?? "",
                opt.contentHtml ?? opt.content_html ?? "",
                opt.contentText ?? opt.content_text ?? null,
                opt.isCorrect || opt.is_correct ? 1 : 0,
                opt.sortOrder ?? opt.sort_order ?? 0,
                now,
              ],
            );
          }
        }

        stats.questionsInserted++;
      } else if (record.record_type === "flashcard") {
        const r = record as unknown as Record<string, unknown>;
        await tx.execute(
          `INSERT INTO flashcards (
            id, import_id, chapter_id, chapter_no,
            card_type, created_from, status,
            front_html, back_html, extra_html, cloze_text,
            educational_objective,
            tags_json, deck, source_doc_id, source_frame_id,
            anchor_id, highlight_text, source_json,
            created_at, updated_at,
            is_deleted, logical_clock, origin_id
          ) VALUES (
            gen_random_uuid()::text,
            $1, $2, $3,
            $4, 'import', 'active',
            $5, $6, $7, $8,
            $9,
            $10, $11, $12, $13,
            $14, $15, $16,
            $17, $17,
            0, $18, $19
          )
          -- id is gen_random_uuid() per insert → conflict never fires;
          -- clause is defensive against hypothetical UUID collision only.
          ON CONFLICT DO NOTHING`,
          [
            importId,                                                     // $1
            r.chapterId ?? null,                                          // $2
            r.chapterNo ?? null,                                          // $3
            r.cardType ?? r.card_type ?? "basic",                         // $4
            r.frontHtml ?? r.front_html ?? "",                            // $5
            r.backHtml ?? r.back_html ?? "",                              // $6
            r.extraHtml ?? r.extra_html ?? null,                          // $7
            r.clozeText ?? r.cloze_text ?? null,                          // $8
            r.educationalObjective ?? null,                               // $9
            r.tags ? JSON.stringify(r.tags) : null,                       // $10
            r.deck ?? null,                                               // $11
            r.sourceDocId ?? r.source_doc_id ?? null,                     // $12
            r.sourceFrameId ?? r.source_frame_id ?? null,                 // $13
            r.anchorId ?? r.anchor_id ?? null,                            // $14
            r.highlightText ?? r.highlight_text ?? null,                  // $15
            r.sourceJson ? JSON.stringify(r.sourceJson) : null,           // $16
            now,                                                          // $17
            clock,                                                        // $18
            originId,                                                     // $19
          ],
        );
        stats.flashcardsInserted++;
      }
    }
  });

  return stats;
}

// ── Main pipeline ────────────────────────────────────────────────────────────

async function runPipeline(
  stream: ReadableStream<Uint8Array>,
  payload: InitStreamPayload,
): Promise<void> {
  const startedAt = performance.now();
  const { importId, fileName, fileSizeBytes, originId, flushSize = 500 } = payload;

  // 1. Create parser — WASM if available, pure-JS fallback otherwise.
  //    createParser() never rejects: WASM failures are caught internally and
  //    the fallback is returned silently. The rest of this function is backend-
  //    agnostic and drives only the StreamParser interface.
  let parser: StreamParser;
  let parserBackend: ParserBackend;
  {
    const result = await createParser();
    parser = result.parser;
    parserBackend = result.backend;
  }

  // 2. Initialize PGlite and bootstrap logical clock.
  try {
    const { maxClock } = await getWorkerDb();
    _logicalClock = maxClock;
  } catch (err) {
    send({ type: "ERROR", code: "DB_INIT_FAILED", error: serializeError(err) });
    parser.destroy();
    return;
  }

  // 3. Create import row in the imports table.
  try {
    const { db } = await getWorkerDb();
    const now = Date.now();
    await db.execute(
      `INSERT INTO imports (
        id, source_name, source_type, schema_version, status,
        file_name, content_type, created_at, updated_at
      ) VALUES ($1, $2, 'stream', 'edge-v3', 'running', $3, 'mixed', $4, $4)
      -- importId is a fresh UUID per run → conflict never fires; defensive only.
      ON CONFLICT DO NOTHING`,
      [importId, fileName, fileName, now],
    );
  } catch {
    // Non-fatal — the import still proceeds, it just won't have a history entry.
  }

  send({ type: "WORKER_READY" });

  // 4. Stream → parser → accumulate → batch write.
  //    parser.parseChunk() never throws — errors go to parser.parseErrors.
  const reader = stream.getReader();
  const recordBuffer: ParsedRecord[] = [];
  let bytesProcessed = 0;
  let totalParsed = 0;
  let totalWritten = 0;
  let batchesCommitted = 0;
  let questionsInserted = 0;
  let flashcardsInserted = 0;

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (aborted) break;

      let readResult: ReadableStreamReadResult<Uint8Array>;
      try {
        readResult = await reader.read();
      } catch (err) {
        send({ type: "ERROR", code: "STREAM_READ_FAILED", error: serializeError(err) });
        break;
      }

      const { done, value } = readResult;

      if (value && value.byteLength > 0) {
        // Feed chunk — returns complete records, holds partial bytes internally.
        const parsed = parser.parseChunk(value);
        bytesProcessed += value.byteLength;
        totalParsed += parsed.length;
        // Explicit loop — avoids Function.apply stack-overflow when a single
        // chunk yields a very large number of tiny records (spread operator
        // uses apply internally and can exceed the JS call-stack limit).
        for (let _i = 0; _i < parsed.length; _i++) recordBuffer.push(parsed[_i]);

        // Flush buffer when it reaches flushSize.
        while (recordBuffer.length >= flushSize) {
          const batch = recordBuffer.splice(0, flushSize);
          try {
            const stats = await writeBatch(batch, importId, originId);
            totalWritten += batch.length;
            batchesCommitted++;
            questionsInserted += stats.questionsInserted;
            flashcardsInserted += stats.flashcardsInserted;
          } catch (err) {
            send({ type: "ERROR", code: "DB_WRITE_FAILED", error: serializeError(err) });
            parser.destroy();
            reader.releaseLock();
            return;
          }
        }

        // Throttled progress.
        const percent = fileSizeBytes > 0
          ? Math.min(99, Math.round((bytesProcessed / fileSizeBytes) * 100))
          : 0;
        maybeSendProgress({
          bytesProcessed,
          fileSizeBytes,
          recordsParsed: totalParsed,
          recordsWritten: totalWritten,
          batchesCommitted,
          percent,
        });
      }

      if (done) break;
    }

    if (aborted) {
      parser.destroy();
      reader.releaseLock();
      send({ type: "ABORTED" });
      return;
    }

    // 5. Flush line buffer — handles files without a trailing newline.
    const finalRecords = parser.flush();
    recordBuffer.push(...finalRecords);
    totalParsed += finalRecords.length;

    // 6. Write remaining buffered records.
    if (recordBuffer.length > 0) {
      try {
        const stats = await writeBatch(recordBuffer, importId, originId);
        totalWritten += recordBuffer.length;
        batchesCommitted++;
        questionsInserted += stats.questionsInserted;
        flashcardsInserted += stats.flashcardsInserted;
        recordBuffer.length = 0;
      } catch (err) {
        send({ type: "ERROR", code: "DB_WRITE_FAILED", error: serializeError(err) });
        parser.destroy();
        return;
      }
    }

    // 7. Collect parse errors accumulated during the run.
    const parseErrors = parser.parseErrors;

    // 8. Update import row to completed.
    try {
      const { db } = await getWorkerDb();
      const now = Date.now();
      await db.execute(
        `UPDATE imports SET status = 'completed', item_count = $1,
         completed_at = $2, updated_at = $2
         WHERE id = $3`,
        [totalWritten, now, importId],
      );
    } catch {
      // Non-fatal.
    }

    // 9. Cleanup parser state.
    parser.destroy();

    // 10. Final progress + complete.
    const durationMs = Math.round(performance.now() - startedAt);

    flushPendingProgress();
    maybeSendProgress({
      bytesProcessed,
      fileSizeBytes,
      recordsParsed: totalParsed,
      recordsWritten: totalWritten,
      batchesCommitted,
      percent: 100,
    }, true);

    send({
      type: "COMPLETE",
      payload: {
        importId,
        questionsInserted,
        flashcardsInserted,
        totalRecordsWritten: totalWritten,
        parseErrors: parseErrors.length,
        durationMs,
        parserBackend,
      },
    });
  } catch (err) {
    send({ type: "ERROR", code: "UNKNOWN", error: serializeError(err) });
    try { parser.destroy(); } catch { /* noop */ }
  } finally {
    try { reader.releaseLock(); } catch { /* noop */ }
  }
}

// ── Message handler ──────────────────────────────────────────────────────────

self.addEventListener("message", (event: MessageEvent) => {
  const msg = event.data as MainToWorker;

  if (msg.type === "INIT_STREAM") {
    aborted = false;
    // msg.stream is the transferred ReadableStream — accessible via the typed
    // MainToWorker discriminant without any cast.
    const stream = msg.stream;
    if (!stream) {
      send({ type: "ERROR", code: "PROTOCOL_VIOLATION", error: { name: "ProtocolError", message: "Missing stream in INIT_STREAM" } });
      return;
    }
    runPipeline(stream, msg.payload).catch((err) => {
      send({ type: "ERROR", code: "UNKNOWN", error: serializeError(err) });
    });
    return;
  }

  if (msg.type === "ABORT") {
    aborted = true;
    return;
  }

  // All MainToWorker variants are handled above. This branch is unreachable for
  // well-typed callers. Cast through unknown to extract the type string for the
  // runtime error message without widening back to any.
  const unhandled = msg as unknown as { type: string };
  send({ type: "ERROR", code: "PROTOCOL_VIOLATION", error: { name: "ProtocolError", message: `Unhandled message type: ${unhandled.type}` } });
});
