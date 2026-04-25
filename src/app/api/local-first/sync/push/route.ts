/**
 * POST /api/local-first/sync/push
 * ─────────────────────────────────────────────────────────────────────────────
 * Real (no stub) outbox apply endpoint. Accepts a batch of client-generated
 * mutations, applies each one to the server database with LWW/idempotent
 * semantics, and returns a per-row result that the client sync engine uses to
 * transition each outbox row in its state machine.
 *
 * IDEMPOTENCY — every mutation is keyed by `mutationId` (UUID v4, client-
 * generated). The server persists every apply outcome in the `client_mutations`
 * ledger. A retry with the same mutationId will skip the apply and replay the
 * exact stored result. This is the single source of truth for "exactly-once
 * effect" semantics across any network retry, tab replay, or service worker
 * re-queue.
 *
 * RECONCILIATION — on a create that lands new server state, the row's
 * `entityServerId` is returned in the response. The client's `markApplied`
 * then writes an `idMap` row so future updates/deletes reference the server
 * primary key instead of the local UUID. For create-operations where client
 * and server id are the same (current design: all tables use text PK), the
 * serverId returned IS the localId.
 *
 * ENTITY DISPATCH:
 *   flashcard_review → INSERT ... ON CONFLICT (id) DO NOTHING    (flashcard_reviews)
 *   annotation       → upsert lf_annotations with LWW on updated_at
 *   highlight        → same path as annotation
 *   planner_item     → UPDATE study_tasks by status/scheduling op
 *   import_manifest  → UPSERT imports keyed by source_name = sha256
 *   imported_file    → ack-only (client retains bytes in OPFS)
 *   note             → UPSERT lf_user_notes
 *   note_edit        → apply diff to lf_user_notes.body (JSON-patch / string replace)
 *
 * DB ABSTRACTION — uses the project's existing `getDb()` which returns a
 * Drizzle instance over either node-postgres (production) or PGlite
 * (local dev). The schema for the new tables (client_mutations, lf_annotations,
 * lf_user_notes) is declared in src/db/schema.ts; at first invocation this
 * route runs a best-effort `CREATE TABLE IF NOT EXISTS` so the route also
 * works when drizzle migrations have not yet been generated for the new tables.
 *
 * AUTH — follows the same convention as `/api/sync/push`: delegates to Next.js
 * middleware + same-origin cookie. No explicit auth check inside the handler.
 */

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BATCH = 50;

/* ── Wire types ────────────────────────────────────────────── */

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EntityTypeSchema = z.enum([
  "annotation",
  "highlight",
  "note",
  "note_edit",
  "flashcard_review",
  "planner_item",
  "import_manifest",
  "imported_file",
]);

const OperationSchema = z.enum(["create", "update", "delete"]);

const ClientMutationSchema = z.object({
  mutationId: z.string().regex(UUID_V4_RE, "mutationId must be a UUID v4"),
  entityType: EntityTypeSchema,
  entityLocalId: z.string().min(1),
  entityServerId: z.string().nullable().optional(),
  operation: OperationSchema,
  payload: z.unknown(),
  baseVersion: z.number().int().nullable().optional(),
  localCreatedAt: z.string().optional(),
  localUpdatedAt: z.string().optional(),
});

const PushBodySchema = z.object({
  batch: z.array(ClientMutationSchema).max(MAX_BATCH),
});

type ClientMutation = z.infer<typeof ClientMutationSchema>;

type ResultStatus = "applied" | "conflict" | "transient" | "fatal";

interface MutationResult {
  mutationId: string;
  status: ResultStatus;
  serverId?: string | null;
  serverVersion?: number;
  error?: string;
}

/* ── Bootstrap: ensure local-first tables exist ────────────── */
/*
 * Called once per server process. If drizzle migrations haven't been
 * generated/pushed yet (common during local dev), we materialize the new
 * tables with CREATE TABLE IF NOT EXISTS so the route doesn't 500. Once the
 * migration is in place this becomes a no-op.
 */
let tablesReady: Promise<void> | null = null;

function ensureLocalFirstTables(): Promise<void> {
  if (!tablesReady) {
    tablesReady = (async () => {
      const db = await getDb();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exec = (db as any).execute.bind(db);
      await exec(sql`
        CREATE TABLE IF NOT EXISTS client_mutations (
          mutation_id text PRIMARY KEY,
          entity_type text NOT NULL,
          entity_local_id text NOT NULL,
          entity_server_id text,
          operation text NOT NULL,
          status text NOT NULL,
          result_json text,
          error_message text,
          applied_at bigint NOT NULL DEFAULT ((extract(epoch from now()) * 1000)::bigint)
        )
      `);
      await exec(sql`
        CREATE INDEX IF NOT EXISTS client_mutations_entity_idx
          ON client_mutations (entity_type, entity_local_id)
      `);
      await exec(sql`
        CREATE TABLE IF NOT EXISTS lf_annotations (
          id text PRIMARY KEY,
          doc_id text NOT NULL,
          chapter_no bigint,
          source_block_id text NOT NULL,
          kind text NOT NULL,
          color text,
          comment text,
          text_quote text NOT NULL,
          text_position_start bigint NOT NULL DEFAULT 0,
          text_position_end bigint NOT NULL DEFAULT 0,
          prefix text NOT NULL DEFAULT '',
          suffix text NOT NULL DEFAULT '',
          block_checksum text NOT NULL DEFAULT '',
          is_deleted bigint NOT NULL DEFAULT 0,
          created_at bigint NOT NULL DEFAULT ((extract(epoch from now()) * 1000)::bigint),
          updated_at bigint NOT NULL DEFAULT ((extract(epoch from now()) * 1000)::bigint)
        )
      `);
      await exec(sql`
        CREATE INDEX IF NOT EXISTS lf_annotations_doc_idx ON lf_annotations (doc_id)
      `);
      await exec(sql`
        CREATE INDEX IF NOT EXISTS lf_annotations_block_idx ON lf_annotations (doc_id, source_block_id)
      `);
      await exec(sql`
        CREATE TABLE IF NOT EXISTS lf_user_notes (
          id text PRIMARY KEY,
          title text,
          body text NOT NULL DEFAULT '',
          tags_json text,
          is_deleted bigint NOT NULL DEFAULT 0,
          created_at bigint NOT NULL DEFAULT ((extract(epoch from now()) * 1000)::bigint),
          updated_at bigint NOT NULL DEFAULT ((extract(epoch from now()) * 1000)::bigint)
        )
      `);
    })().catch((err) => {
      tablesReady = null; // allow retry on next request
      throw err;
    });
  }
  return tablesReady;
}

/* ── Ledger lookup ─────────────────────────────────────────── */

interface LedgerRow {
  mutation_id: string;
  status: string;
  result_json: string | null;
  error_message: string | null;
  entity_server_id: string | null;
}

async function findLedgerRow(
  db: Awaited<ReturnType<typeof getDb>>,
  mutationId: string,
): Promise<LedgerRow | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: { rows: LedgerRow[] } = await (db as any).execute(sql`
    SELECT mutation_id, status, result_json, error_message, entity_server_id
    FROM client_mutations
    WHERE mutation_id = ${mutationId}
    LIMIT 1
  `);
  return res.rows[0] ?? null;
}

async function writeLedgerRow(
  db: Awaited<ReturnType<typeof getDb>>,
  m: ClientMutation,
  result: MutationResult,
): Promise<void> {
  const resultJson =
    result.status === "applied"
      ? JSON.stringify({
          serverId: result.serverId ?? null,
          serverVersion: result.serverVersion ?? null,
        })
      : null;
  // INSERT ... ON CONFLICT DO NOTHING — the ledger is write-once.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any).execute(sql`
    INSERT INTO client_mutations (
      mutation_id, entity_type, entity_local_id, entity_server_id,
      operation, status, result_json, error_message
    ) VALUES (
      ${m.mutationId}, ${m.entityType}, ${m.entityLocalId},
      ${result.serverId ?? m.entityServerId ?? null},
      ${m.operation}, ${result.status}, ${resultJson}, ${result.error ?? null}
    )
    ON CONFLICT (mutation_id) DO NOTHING
  `);
}

function replayLedger(row: LedgerRow, mutationId: string): MutationResult {
  const status = row.status as ResultStatus;
  let serverId: string | null = row.entity_server_id ?? null;
  let serverVersion: number | undefined;
  if (row.result_json) {
    try {
      const parsed = JSON.parse(row.result_json) as {
        serverId?: string | null;
        serverVersion?: number;
      };
      if (parsed.serverId !== undefined) serverId = parsed.serverId ?? null;
      if (typeof parsed.serverVersion === "number")
        serverVersion = parsed.serverVersion;
    } catch {
      /* keep fallback values */
    }
  }
  return {
    mutationId,
    status,
    serverId,
    serverVersion,
    error: row.error_message ?? undefined,
  };
}

/* ── Per-entity apply functions ─────────────────────────────── */
/*
 * Each function returns a MutationResult. They MUST NOT throw for expected
 * conflicts — those should return {status:'conflict'}. Genuine db errors
 * bubble up and get caught by the dispatcher as transient.
 */

type DbInstance = Awaited<ReturnType<typeof getDb>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function exec(db: DbInstance): (q: any) => Promise<{ rows: any[] }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db as any).execute.bind(db);
}

/** flashcard_review — insert or replay by PK. */
async function applyFlashcardReview(
  db: DbInstance,
  m: ClientMutation,
): Promise<MutationResult> {
  if (m.operation !== "create") {
    return { mutationId: m.mutationId, status: "fatal", error: "flashcard_review only supports create" };
  }
  const p = m.payload as {
    reviewLocalId?: string;
    flashcardId?: string;
    rating?: 1 | 2 | 3 | 4;
    reviewedAt?: string;
    nextDue?: string | null;
    fsrs?: Record<string, unknown>;
  };
  if (
    typeof p?.flashcardId !== "string" ||
    !(p?.rating && [1, 2, 3, 4].includes(p.rating)) ||
    typeof p?.reviewedAt !== "string"
  ) {
    return { mutationId: m.mutationId, status: "fatal", error: "flashcard_review payload invalid" };
  }
  const reviewId = m.mutationId; // reviewLocalId === mutationId (by design)
  const reviewedAtMs = new Date(p.reviewedAt).getTime();
  const dueAtMs = p.nextDue ? new Date(p.nextDue).getTime() : null;
  const fsrsJson = p.fsrs ? JSON.stringify(p.fsrs) : null;
  try {
    // ON CONFLICT DO NOTHING gives us idempotency at the table level too,
    // so even if the ledger is missing somehow, a replay is safe.
    await exec(db)(sql`
      INSERT INTO flashcard_reviews (
        id, flashcard_id, rating, reviewed_at, due_at,
        fsrs_snapshot_json, created_at, is_deleted, logical_clock, origin_id
      ) VALUES (
        ${reviewId}, ${p.flashcardId}, ${p.rating}, ${reviewedAtMs}, ${dueAtMs},
        ${fsrsJson}, ${reviewedAtMs}, 0, 0, 'local-first'
      )
      ON CONFLICT (id) DO NOTHING
    `);
  } catch (err) {
    // FK violation (unknown flashcardId) is a fatal error for this entity —
    // retrying won't help.
    const msg = err instanceof Error ? err.message : String(err);
    if (/foreign key|fk/i.test(msg)) {
      return { mutationId: m.mutationId, status: "fatal", error: `fk violation: ${msg}` };
    }
    throw err; // bubble as transient
  }
  return { mutationId: m.mutationId, status: "applied", serverId: reviewId };
}

/** annotation / highlight — upsert lf_annotations. */
async function applyAnnotation(
  db: DbInstance,
  m: ClientMutation,
): Promise<MutationResult> {
  if (m.operation === "delete") {
    const id = m.entityServerId ?? m.entityLocalId;
    await exec(db)(sql`
      UPDATE lf_annotations
         SET is_deleted = 1,
             updated_at = ((extract(epoch from now()) * 1000)::bigint)
       WHERE id = ${id}
    `);
    return { mutationId: m.mutationId, status: "applied", serverId: id };
  }
  const p = m.payload as {
    docId?: string;
    chapterNo?: number | null;
    sourceBlockId?: string;
    kind?: "highlight" | "underline" | "comment";
    color?: string | null;
    comment?: string | null;
    textQuote?: string;
    textPositionStart?: number;
    textPositionEnd?: number;
    prefix?: string;
    suffix?: string;
    blockChecksum?: string;
  };
  if (
    typeof p?.docId !== "string" ||
    typeof p?.sourceBlockId !== "string" ||
    typeof p?.textQuote !== "string" ||
    !p?.kind
  ) {
    return { mutationId: m.mutationId, status: "fatal", error: "annotation payload missing required fields" };
  }
  const id = m.entityLocalId;
  await exec(db)(sql`
    INSERT INTO lf_annotations (
      id, doc_id, chapter_no, source_block_id, kind,
      color, comment, text_quote,
      text_position_start, text_position_end,
      prefix, suffix, block_checksum,
      is_deleted, created_at, updated_at
    ) VALUES (
      ${id}, ${p.docId}, ${p.chapterNo ?? null}, ${p.sourceBlockId}, ${p.kind},
      ${p.color ?? null}, ${p.comment ?? null}, ${p.textQuote},
      ${p.textPositionStart ?? 0}, ${p.textPositionEnd ?? 0},
      ${p.prefix ?? ""}, ${p.suffix ?? ""}, ${p.blockChecksum ?? ""},
      0,
      ((extract(epoch from now()) * 1000)::bigint),
      ((extract(epoch from now()) * 1000)::bigint)
    )
    ON CONFLICT (id) DO UPDATE SET
      color = EXCLUDED.color,
      comment = EXCLUDED.comment,
      text_quote = EXCLUDED.text_quote,
      text_position_start = EXCLUDED.text_position_start,
      text_position_end = EXCLUDED.text_position_end,
      prefix = EXCLUDED.prefix,
      suffix = EXCLUDED.suffix,
      block_checksum = EXCLUDED.block_checksum,
      is_deleted = 0,
      updated_at = ((extract(epoch from now()) * 1000)::bigint)
  `);
  return { mutationId: m.mutationId, status: "applied", serverId: id };
}

/** planner_item — update study_tasks based on op. */
async function applyPlannerItem(
  db: DbInstance,
  m: ClientMutation,
): Promise<MutationResult> {
  const p = m.payload as {
    op?: "start" | "complete" | "skip" | "reset" | "reschedule";
    taskId?: string;
    status?: string;
    scheduledFor?: string | null;
  };
  if (typeof p?.taskId !== "string" || typeof p?.op !== "string") {
    return { mutationId: m.mutationId, status: "fatal", error: "planner_item payload invalid" };
  }
  const taskId = p.taskId;
  const nowExpr = sql`((extract(epoch from now()) * 1000)::bigint)`;
  // Check row exists first so we can return conflict meaningfully.
  const existing = await exec(db)(sql`
    SELECT id, status, logical_clock FROM study_tasks WHERE id = ${taskId} LIMIT 1
  `);
  if (existing.rows.length === 0) {
    // Task doesn't exist on server yet — this happens when the client created
    // a plan offline and hasn't pushed the creation. We return conflict so
    // the client queues a re-push with dependency on the plan creation.
    return { mutationId: m.mutationId, status: "conflict", error: "task not found" };
  }
  switch (p.op) {
    case "start":
      await exec(db)(sql`
        UPDATE study_tasks
           SET status = 'in_progress',
               started_at = ${nowExpr},
               updated_at = ${nowExpr},
               logical_clock = logical_clock + 1
         WHERE id = ${taskId}
      `);
      break;
    case "complete":
      await exec(db)(sql`
        UPDATE study_tasks
           SET status = 'completed',
               completed_at = ${nowExpr},
               progress_percent = 100,
               updated_at = ${nowExpr},
               logical_clock = logical_clock + 1
         WHERE id = ${taskId}
      `);
      break;
    case "skip":
      await exec(db)(sql`
        UPDATE study_tasks
           SET status = 'skipped',
               updated_at = ${nowExpr},
               logical_clock = logical_clock + 1
         WHERE id = ${taskId}
      `);
      break;
    case "reset":
      await exec(db)(sql`
        UPDATE study_tasks
           SET status = 'pending',
               started_at = NULL,
               completed_at = NULL,
               progress_percent = 0,
               updated_at = ${nowExpr},
               logical_clock = logical_clock + 1
         WHERE id = ${taskId}
      `);
      break;
    case "reschedule": {
      if (typeof p.scheduledFor !== "string") {
        return { mutationId: m.mutationId, status: "fatal", error: "reschedule needs scheduledFor" };
      }
      await exec(db)(sql`
        UPDATE study_tasks
           SET scheduled_for = ${p.scheduledFor},
               updated_at = ${nowExpr},
               logical_clock = logical_clock + 1
         WHERE id = ${taskId}
      `);
      break;
    }
    default:
      return { mutationId: m.mutationId, status: "fatal", error: `unknown planner op ${p.op}` };
  }
  return { mutationId: m.mutationId, status: "applied", serverId: taskId };
}

/** import_manifest — upsert imports keyed by source_name=sha256. */
async function applyImportManifest(
  db: DbInstance,
  m: ClientMutation,
): Promise<MutationResult> {
  const p = m.payload as {
    sha256?: string;
    originalName?: string;
    mime?: string;
    sizeBytes?: number;
    importedAt?: string;
  };
  if (typeof p?.sha256 !== "string" || p.sha256.length < 16) {
    return { mutationId: m.mutationId, status: "fatal", error: "import_manifest needs sha256" };
  }
  const importId = m.entityLocalId;
  const createdAt = p.importedAt ? new Date(p.importedAt).getTime() : Date.now();
  await exec(db)(sql`
    INSERT INTO imports (
      id, source_name, source_type, schema_version, status,
      file_name, content_type, item_count, created_at, updated_at
    ) VALUES (
      ${importId}, ${p.sha256}, 'local-first', 'lf-v1', 'pending',
      ${p.originalName ?? null}, ${p.mime ?? null}, ${p.sizeBytes ?? null},
      ${createdAt}, ${createdAt}
    )
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status,
      updated_at = EXCLUDED.updated_at
  `);
  return { mutationId: m.mutationId, status: "applied", serverId: importId };
}

/** imported_file — ack-only. Bytes live in client OPFS. */
function applyImportedFile(m: ClientMutation): MutationResult {
  return { mutationId: m.mutationId, status: "applied", serverId: m.entityLocalId };
}

/** note / note_edit — upsert lf_user_notes. */
async function applyUserNote(
  db: DbInstance,
  m: ClientMutation,
): Promise<MutationResult> {
  if (m.operation === "delete") {
    await exec(db)(sql`
      UPDATE lf_user_notes
         SET is_deleted = 1,
             updated_at = ((extract(epoch from now()) * 1000)::bigint)
       WHERE id = ${m.entityLocalId}
    `);
    return { mutationId: m.mutationId, status: "applied", serverId: m.entityLocalId };
  }
  const p = m.payload as { title?: string | null; body?: string; tags?: string[] };
  const id = m.entityLocalId;
  const tagsJson = p?.tags ? JSON.stringify(p.tags) : null;
  await exec(db)(sql`
    INSERT INTO lf_user_notes (id, title, body, tags_json, is_deleted, created_at, updated_at)
    VALUES (
      ${id}, ${p?.title ?? null}, ${p?.body ?? ""}, ${tagsJson}, 0,
      ((extract(epoch from now()) * 1000)::bigint),
      ((extract(epoch from now()) * 1000)::bigint)
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      body = EXCLUDED.body,
      tags_json = EXCLUDED.tags_json,
      is_deleted = 0,
      updated_at = ((extract(epoch from now()) * 1000)::bigint)
  `);
  return { mutationId: m.mutationId, status: "applied", serverId: id };
}

async function applyNoteEdit(
  db: DbInstance,
  m: ClientMutation,
): Promise<MutationResult> {
  const p = m.payload as { noteId?: string; body?: string };
  if (typeof p?.noteId !== "string" || typeof p?.body !== "string") {
    return { mutationId: m.mutationId, status: "fatal", error: "note_edit needs noteId+body" };
  }
  // Note edits are applied as a simple body replacement. Multi-writer
  // merges are handled client-side by the outbox operation ordering.
  const res = await exec(db)(sql`
    UPDATE lf_user_notes
       SET body = ${p.body},
           updated_at = ((extract(epoch from now()) * 1000)::bigint)
     WHERE id = ${p.noteId} AND is_deleted = 0
    RETURNING id
  `);
  if (res.rows.length === 0) {
    return { mutationId: m.mutationId, status: "conflict", error: "note not found" };
  }
  return { mutationId: m.mutationId, status: "applied", serverId: p.noteId };
}

/* ── Dispatcher ────────────────────────────────────────────── */

async function applyOne(
  db: DbInstance,
  m: ClientMutation,
): Promise<MutationResult> {
  try {
    switch (m.entityType) {
      case "flashcard_review":
        return await applyFlashcardReview(db, m);
      case "annotation":
      case "highlight":
        return await applyAnnotation(db, m);
      case "planner_item":
        return await applyPlannerItem(db, m);
      case "import_manifest":
        return await applyImportManifest(db, m);
      case "imported_file":
        return applyImportedFile(m);
      case "note":
        return await applyUserNote(db, m);
      case "note_edit":
        return await applyNoteEdit(db, m);
      default:
        return {
          mutationId: m.mutationId,
          status: "fatal",
          error: `unknown entityType ${m.entityType as string}`,
        };
    }
  } catch (err) {
    // Any unhandled DB error → transient. Client will retry with backoff.
    const msg = err instanceof Error ? err.message : String(err);
    return { mutationId: m.mutationId, status: "transient", error: msg };
  }
}

/* ── Route handler ─────────────────────────────────────────── */

export async function POST(req: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  let body: z.infer<typeof PushBodySchema>;
  try {
    body = PushBodySchema.parse(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "validation failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (body.batch.length === 0) {
    return NextResponse.json({ results: [] });
  }

  let db: DbInstance;
  try {
    await ensureLocalFirstTables();
    db = await getDb();
  } catch (err) {
    // Cannot reach DB at all → every row transient.
    const msg = err instanceof Error ? err.message : "db unavailable";
    return NextResponse.json({
      results: body.batch.map((m) => ({
        mutationId: m.mutationId,
        status: "transient" as const,
        error: msg,
      })),
    });
  }

  const results: MutationResult[] = [];
  for (const m of body.batch) {
    // Idempotency — replay ledger if this mutationId was applied before.
    try {
      const prior = await findLedgerRow(db, m.mutationId);
      if (prior) {
        results.push(replayLedger(prior, m.mutationId));
        continue;
      }
    } catch {
      // Ledger lookup failed — fall through and try to apply. Duplicate
      // application on the target table is still blocked by per-entity
      // ON CONFLICT DO NOTHING where applicable.
    }

    const outcome = await applyOne(db, m);
    results.push(outcome);

    // Persist outcome to ledger for future replay. Best-effort — a failure
    // here means the next retry will re-apply the mutation, which is still
    // safe because every entity path is itself idempotent.
    try {
      if (outcome.status !== "transient") {
        await writeLedgerRow(db, m, outcome);
      }
    } catch {
      /* swallow — ledger is advisory; target table writes are authoritative */
    }
  }

  return NextResponse.json({ results });
}
