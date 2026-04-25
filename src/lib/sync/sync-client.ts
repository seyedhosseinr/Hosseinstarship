/**
 * sync-client.ts — Push OPFS delta to the server.
 *
 * USAGE
 * ──────
 *   const result = await pushLocalToServer();
 *   if (!result.ok) console.error(result.error);
 *   else if (!result.nothingToSync) console.log("Synced", result.synced);
 *
 * CHECKPOINT DESIGN
 * ──────────────────
 * `uro_sync_last_pushed_clock` in localStorage tracks the highest logical_clock
 * value that has been successfully pushed to the server. On each call:
 *
 *   1. Query OPFS for questions + flashcards WHERE logical_clock > checkpoint.
 *   2. Collect the imports referenced by those delta rows.
 *   3. POST the delta to /api/sync/push.
 *   4. Advance the checkpoint to the newMaxClock returned by the server.
 *
 * Batching: queries are capped at BATCH_SIZE (2 000) rows per call, matching
 * the server-side payload limit. If the delta exceeds this, subsequent calls
 * will push the remainder because the checkpoint advances after each success.
 *
 * NEVER call this from a server component or API route — it uses getBrowserDb()
 * (PGliteWorker + OPFS) which only exists in the browser runtime.
 */

import { getBrowserDb } from "@/db/pglite-browser";
import type {
  SyncPushPayload,
  SyncPushResult,
  QuestionSyncRecord,
  QuestionOptionSyncRecord,
  FlashcardSyncRecord,
  ImportSyncRecord,
} from "@/app/api/sync/push/route";
import type { SyncPullResult } from "@/app/api/sync/pull/route";

// ── Constants ─────────────────────────────────────────────────────��────────────

const LAST_PUSHED_CLOCK_KEY  = "uro_sync_last_pushed_clock";
const LAST_PUSHED_AT_KEY     = "uro_sync_last_pushed_at";
const LAST_PULLED_CLOCK_KEY  = "uro_sync_last_pulled_clock";
/** Must match the .max() constraints on the server Zod schema. */
const BATCH_SIZE = 2000;

// ── Public API ─────────────────────────────────────────────────────────────────

export interface PushResult {
  ok:            boolean;
  /** true when logical_clock hasn't advanced since the last push. No fetch was made. */
  nothingToSync: boolean;
  synced?:       SyncPushResult["synced"];
  newMaxClock?:  number;
  error?:        string;
}

/**
 * Push all locally-modified records (logical_clock > last checkpoint) to the server.
 *
 * Safe to call at any time — idempotent if nothing has changed.
 * Returns immediately with `nothingToSync: true` when the delta is empty.
 */
export async function pushLocalToServer(): Promise<PushResult> {
  const lastClock = Number(localStorage.getItem(LAST_PUSHED_CLOCK_KEY) ?? "0");

  const { pg } = await getBrowserDb();

  // ── 1. Query question delta ────────────────────────────────────────────────
  const qResult = await pg.query<QuestionSyncRecord>(
    `SELECT
       id, import_id, external_key, chapter_id,
       stem_html, stem_text, lead_in, explanation_html,
       educational_objective, why_correct,
       question_type, difficulty, subject, system, category, topic,
       tags_json, correct_option_id, source_json,
       is_active, is_deleted, logical_clock, origin_id,
       created_at, updated_at
     FROM questions
     WHERE logical_clock > $1
     ORDER BY logical_clock ASC
     LIMIT $2`,
    [lastClock, BATCH_SIZE],
  );

  // ── 2. Query flashcard delta ───────────────────────────────────────────────
  const fResult = await pg.query<FlashcardSyncRecord>(
    `SELECT
       id, import_id, chapter_id, chapter_no,
       card_type, created_from, status, deck,
       front_html, back_html, extra_html, cloze_text, educational_objective,
       tags_json, source_json,
       fsrs_stability, fsrs_difficulty, fsrs_state,
       fsrs_due, fsrs_last_review, fsrs_reps, fsrs_lapses,
       is_deleted, logical_clock, origin_id,
       created_at, updated_at
     FROM flashcards
     WHERE logical_clock > $1
     ORDER BY logical_clock ASC
     LIMIT $2`,
    [lastClock, BATCH_SIZE],
  );

  // ── 3. Nothing to push? ────────────────────────────────────────────────────
  if (qResult.rows.length === 0 && fResult.rows.length === 0) {
    return { ok: true, nothingToSync: true };
  }

  // ── 3b. Query options for pulled questions ─────────────────────────────────
  // Options are children of questions; include them so the server has full MCQ data.
  let optionRows: QuestionOptionSyncRecord[] = [];
  if (qResult.rows.length > 0) {
    const qIds = qResult.rows.map((q) => q.id);
    const optPlaceholders = qIds.map((_, i) => `$${i + 1}`).join(", ");
    const oResult = await pg.query<QuestionOptionSyncRecord>(
      `SELECT id, question_id, option_key, content_html, content_text,
              is_correct, sort_order, created_at
       FROM question_options
       WHERE question_id IN (${optPlaceholders})`,
      qIds,
    );
    optionRows = oResult.rows;
  }

  // ── 4. Collect imports referenced by this delta batch ─────────────────────
  // imports table has no logical_clock, so we derive the set from what the
  // delta rows actually reference rather than doing a full-table delta scan.
  const importIdSet = new Set<string>();
  for (const q of qResult.rows) { if (q.import_id) importIdSet.add(q.import_id); }
  for (const f of fResult.rows) { if (f.import_id) importIdSet.add(f.import_id); }

  let importRows: ImportSyncRecord[] = [];
  if (importIdSet.size > 0) {
    const ids = Array.from(importIdSet);
    // Build $1, $2, ... placeholders dynamically.
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
    const iResult = await pg.query<ImportSyncRecord>(
      `SELECT
         id, source_name, source_type, schema_version, status,
         file_name, content_type, item_count,
         created_at, updated_at
       FROM imports
       WHERE id IN (${placeholders})`,
      ids,
    );
    importRows = iResult.rows;
  }

  // ── 5. POST delta to server ─────────────────────────────────────────────────
  const payload: SyncPushPayload = {
    questions:        qResult.rows,
    question_options: optionRows,
    flashcards:       fResult.rows,
    imports:          importRows,
  };

  let result: SyncPushResult;
  try {
    const resp = await fetch("/api/sync/push", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      return {
        ok:            false,
        nothingToSync: false,
        error:         `HTTP ${resp.status}: ${errBody}`,
      };
    }

    result = (await resp.json()) as SyncPushResult;
  } catch (err) {
    return {
      ok:            false,
      nothingToSync: false,
      error:         err instanceof Error ? err.message : String(err),
    };
  }

  // ── 6. Advance checkpoint ─────────────────────────────────────────────────
  // Only update if the server returned a higher clock — avoids regressing the
  // checkpoint if the server had no new max (e.g., all records were skipped).
  if (result.newMaxClock > lastClock) {
    localStorage.setItem(LAST_PUSHED_CLOCK_KEY, String(result.newMaxClock));
  }
  localStorage.setItem(LAST_PUSHED_AT_KEY, String(Date.now()));

  return {
    ok:           true,
    nothingToSync: false,
    synced:        result.synced,
    newMaxClock:   result.newMaxClock,
  };
}

// ── Pull: Server → OPFS ──────────────────────────────────────────────────────

export interface PullResult {
  ok:           boolean;
  nothingNew:   boolean;
  pulled?:      Record<string, number>; // table → row count
  newMaxClock?: number;
  error?:       string;
}

/**
 * Syncable tables that support LWW-CRDT columns.
 * Must match the server's ALL_SYNCABLE_TABLES.
 */
const LWW_TABLES = [
  "questions",
  "flashcards",
  "flashcard_reviews",
  "chapter_progress",
  "exam_sessions",
  "question_attempts",
  "study_tasks",
] as const;

/**
 * Pull all remotely-modified records (logical_clock > last pulled checkpoint) from the server,
 * then upsert them into the local OPFS database using LWW resolution.
 *
 * Safe to call at any time — idempotent if nothing has changed on the server.
 */
export async function pullFromServer(): Promise<PullResult> {
  const since = Number(localStorage.getItem(LAST_PULLED_CLOCK_KEY) ?? "0");

  let data: SyncPullResult;
  try {
    const resp = await fetch(`/api/sync/pull?since=${since}`);
    if (!resp.ok) {
      const errBody = await resp.text();
      return { ok: false, nothingNew: false, error: `HTTP ${resp.status}: ${errBody}` };
    }
    data = (await resp.json()) as SyncPullResult;
  } catch (err) {
    return {
      ok:         false,
      nothingNew: false,
      error:      err instanceof Error ? err.message : String(err),
    };
  }

  // Nothing new from the server?
  if (data.maxClock <= since) {
    return { ok: true, nothingNew: true };
  }

  const { pg } = await getBrowserDb();

  const pulled: Record<string, number> = {};

  for (const table of LWW_TABLES) {
    const rows = data.tables[table];
    if (!rows || rows.length === 0) continue;

    for (const row of rows) {
      const cols = Object.keys(row);
      const vals = Object.values(row);
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
      const colList = cols.map((c) => `"${c}"`).join(", ");

      // LWW: only overwrite if incoming logical_clock > existing
      const setClause = cols
        .filter((c) => c !== primaryKeyFor(table))
        .map((c) => `"${c}" = EXCLUDED."${c}"`)
        .join(", ");

      const pk = `"${primaryKeyFor(table)}"`;

      await pg.query(
        `INSERT INTO "${table}" (${colList}) VALUES (${placeholders})
         ON CONFLICT (${pk}) DO UPDATE SET ${setClause}
         WHERE EXCLUDED."logical_clock" > "${table}"."logical_clock"
            OR (EXCLUDED."logical_clock" = "${table}"."logical_clock"
                AND EXCLUDED."updated_at" > "${table}"."updated_at")`,
        vals,
      );
    }

    pulled[table] = rows.length;
  }

  // Advance the pull checkpoint
  localStorage.setItem(LAST_PULLED_CLOCK_KEY, String(data.maxClock));

  return {
    ok:          true,
    nothingNew:  false,
    pulled,
    newMaxClock: data.maxClock,
  };
}

/** Returns the primary key column name for a syncable table. */
function primaryKeyFor(table: string): string {
  if (table === "chapter_progress") return "chapter_no";
  return "id";
}

// ── Checkpoint accessors ───────────────────────────────────────────────────────

/** Last logical_clock successfully pushed. 0 if never synced. */
export function getLastPushedClock(): number {
  return Number(localStorage.getItem(LAST_PUSHED_CLOCK_KEY) ?? "0");
}

/** Wall-clock ms of the last successful push. null if never synced. */
export function getLastPushedAt(): number | null {
  const raw = localStorage.getItem(LAST_PUSHED_AT_KEY);
  return raw !== null ? Number(raw) : null;
}

/** Last logical_clock successfully pulled from server. 0 if never pulled. */
export function getLastPulledClock(): number {
  return Number(localStorage.getItem(LAST_PULLED_CLOCK_KEY) ?? "0");
}

/**
 * Reset all sync checkpoints to zero.
 * Next calls to pushLocalToServer() / pullFromServer() will do a full sync.
 * Intended for testing / forced full-resync scenarios only.
 */
export function resetSyncCheckpoint(): void {
  localStorage.removeItem(LAST_PUSHED_CLOCK_KEY);
  localStorage.removeItem(LAST_PUSHED_AT_KEY);
  localStorage.removeItem(LAST_PULLED_CLOCK_KEY);
}
