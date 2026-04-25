/**
 * POST /api/sync/push
 * ─────────────────────────────────────────────────────────────────────────────
 * Receives a delta-sync payload from the browser OPFS PGlite database and
 * upserts records into the server database using LWW-CRDT resolution.
 *
 * CONFLICT STRATEGY
 * ──────────────────
 * questions  — two passes:
 *   1. Records with a non-null external_key: conflict on external_key (stable
 *      content ID from the import pipeline). This handles re-imports of the
 *      same source file without creating duplicates.
 *   2. Records with a null external_key: conflict on id (the UUID generated
 *      in the browser). Idempotent re-push of the same session.
 *
 * flashcards — conflict on id (PK). No stable external_key exists.
 *
 * imports    — conflict on id (PK). Simple last-write upsert; no LWW needed
 *              because import records are append-only in practice.
 *
 * LWW WHERE CLAUSE (questions + flashcards)
 * ──────────────────────────────────────────
 *   WHERE
 *     EXCLUDED.logical_clock > <table>.logical_clock
 *     OR (EXCLUDED.logical_clock = <table>.logical_clock
 *         AND EXCLUDED.updated_at > <table>.updated_at)
 *
 * This ensures the row with the highest Lamport timestamp wins. Equal clocks
 * fall back to wall-clock updated_at. If both are equal the existing row wins
 * (no-op update), which is correct — identical state, no change needed.
 *
 * FK SAFETY
 * ──────────
 * Edge-imported questions may reference chapter_id values that do not exist
 * on the server (since chapters are seeded separately). Records that fail a FK
 * constraint are skipped individually and counted in the `skipped` field of
 * the response. This is intentional: the sync layer must not block on missing
 * related entities.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { isPGliteRuntime } from "@/db/config";
import { createPostgresDb } from "@/db/postgres";

// ── Payload schemas ───────────────────────────────────────────────────────────

const QuestionSyncRecordSchema = z.object({
  id:                   z.string(),
  import_id:            z.string().nullable(),
  external_key:         z.string().nullable(),
  chapter_id:           z.string().nullable(),
  stem_html:            z.string(),
  stem_text:            z.string().nullable(),
  lead_in:              z.string().nullable(),
  explanation_html:     z.string().nullable(),
  educational_objective: z.string().nullable(),
  why_correct:          z.string().nullable(),
  question_type:        z.string(),
  difficulty:           z.string().nullable(),
  subject:              z.string().nullable(),
  system:               z.string().nullable(),
  category:             z.string().nullable(),
  topic:                z.string().nullable(),
  tags_json:            z.string().nullable(),
  correct_option_id:    z.string().nullable(),
  source_json:          z.string().nullable(),
  is_active:            z.number().int(),
  is_deleted:           z.number().int(),
  logical_clock:        z.number().int(),
  origin_id:            z.string().nullable(),
  created_at:           z.number().int(),
  updated_at:           z.number().int(),
});

const FlashcardSyncRecordSchema = z.object({
  id:                    z.string(),
  import_id:             z.string().nullable(),
  chapter_id:            z.string().nullable(),
  chapter_no:            z.number().int().nullable(),
  card_type:             z.string(),
  created_from:          z.string(),
  status:                z.string(),
  deck:                  z.string().nullable(),
  front_html:            z.string(),
  back_html:             z.string(),
  extra_html:            z.string().nullable(),
  cloze_text:            z.string().nullable(),
  educational_objective: z.string().nullable(),
  tags_json:             z.string().nullable(),
  source_json:           z.string().nullable(),
  // FSRS state — included so review progress syncs alongside content.
  fsrs_stability:        z.number().nullable(),
  fsrs_difficulty:       z.number().nullable(),
  fsrs_state:            z.string().nullable(),
  fsrs_due:              z.number().int().nullable(),
  fsrs_last_review:      z.number().int().nullable(),
  fsrs_reps:             z.number().int().nullable(),
  fsrs_lapses:           z.number().int().nullable(),
  is_deleted:            z.number().int(),
  logical_clock:         z.number().int(),
  origin_id:             z.string().nullable(),
  created_at:            z.number().int(),
  updated_at:            z.number().int(),
});

const QuestionOptionSyncRecordSchema = z.object({
  id:           z.string(),
  question_id:  z.string(),
  option_key:   z.string(),
  content_html: z.string(),
  content_text: z.string().nullable(),
  is_correct:   z.number().int(),
  sort_order:   z.number().int(),
  created_at:   z.number().int(),
});

const ImportSyncRecordSchema = z.object({
  id:             z.string(),
  source_name:    z.string(),
  source_type:    z.string(),
  schema_version: z.string(),
  status:         z.string(),
  file_name:      z.string().nullable(),
  content_type:   z.string().nullable(),
  item_count:     z.number().int().nullable(),
  created_at:     z.number().int(),
  updated_at:     z.number().int(),
});

const SyncPushPayloadSchema = z.object({
  questions:        z.array(QuestionSyncRecordSchema).max(2000),
  question_options: z.array(QuestionOptionSyncRecordSchema).max(10000),
  flashcards:       z.array(FlashcardSyncRecordSchema).max(2000),
  imports:          z.array(ImportSyncRecordSchema).max(100),
});

// ── Exported types (consumed by sync-client.ts) ───────────────────────────────

export type QuestionSyncRecord       = z.infer<typeof QuestionSyncRecordSchema>;
export type QuestionOptionSyncRecord = z.infer<typeof QuestionOptionSyncRecordSchema>;
export type FlashcardSyncRecord      = z.infer<typeof FlashcardSyncRecordSchema>;
export type ImportSyncRecord         = z.infer<typeof ImportSyncRecordSchema>;
export type SyncPushPayload          = z.infer<typeof SyncPushPayloadSchema>;

export interface SyncPushResult {
  ok: boolean;
  synced: {
    questions:        number;
    question_options: number;
    flashcards:       number;
    imports:          number;
    skipped:          number;
  };
  /** Max logical_clock across all synced questions + flashcards. */
  newMaxClock: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type PostgresDb = NonNullable<ReturnType<typeof createPostgresDb>>;

/**
 * Upsert one question row with LWW resolution.
 * Conflicts on external_key (when present) or id (fallback).
 * Returns true if the row was processed, false if skipped due to a DB error.
 */
async function upsertQuestion(db: PostgresDb, q: QuestionSyncRecord): Promise<boolean> {
  try {
    if (q.external_key !== null) {
      // Conflict on the stable content identifier — handles re-imports correctly.
      await db.execute(sql`
        INSERT INTO questions (
          id, import_id, external_key, chapter_id,
          stem_html, stem_text, lead_in, explanation_html, educational_objective, why_correct,
          question_type, difficulty, subject, system, category, topic,
          tags_json, correct_option_id, source_json,
          is_active, is_deleted, logical_clock, origin_id, created_at, updated_at
        ) VALUES (
          ${q.id}, ${q.import_id}, ${q.external_key}, ${q.chapter_id},
          ${q.stem_html}, ${q.stem_text}, ${q.lead_in}, ${q.explanation_html},
          ${q.educational_objective}, ${q.why_correct},
          ${q.question_type}, ${q.difficulty}, ${q.subject}, ${q.system},
          ${q.category}, ${q.topic},
          ${q.tags_json}, ${q.correct_option_id}, ${q.source_json},
          ${q.is_active}, ${q.is_deleted}, ${q.logical_clock}, ${q.origin_id},
          ${q.created_at}, ${q.updated_at}
        )
        ON CONFLICT (external_key) DO UPDATE SET
          -- id intentionally absent: PK must not change after first insert.
          -- question_options.question_id has a FK to questions.id with no ON UPDATE CASCADE;
          -- changing the PK would cause a constraint violation on re-import.
          import_id             = EXCLUDED.import_id,
          stem_html             = EXCLUDED.stem_html,
          stem_text             = EXCLUDED.stem_text,
          lead_in               = EXCLUDED.lead_in,
          explanation_html      = EXCLUDED.explanation_html,
          educational_objective = EXCLUDED.educational_objective,
          why_correct           = EXCLUDED.why_correct,
          question_type         = EXCLUDED.question_type,
          difficulty            = EXCLUDED.difficulty,
          subject               = EXCLUDED.subject,
          system                = EXCLUDED.system,
          category              = EXCLUDED.category,
          topic                 = EXCLUDED.topic,
          tags_json             = EXCLUDED.tags_json,
          correct_option_id     = EXCLUDED.correct_option_id,
          source_json           = EXCLUDED.source_json,
          is_active             = EXCLUDED.is_active,
          is_deleted            = EXCLUDED.is_deleted,
          logical_clock         = EXCLUDED.logical_clock,
          origin_id             = EXCLUDED.origin_id,
          updated_at            = EXCLUDED.updated_at
        WHERE
          EXCLUDED.logical_clock > questions.logical_clock
          OR (
            EXCLUDED.logical_clock = questions.logical_clock
            AND EXCLUDED.updated_at > questions.updated_at
          )
      `);
    } else {
      // No external_key — conflict on PK (re-push of the same browser-generated UUID).
      await db.execute(sql`
        INSERT INTO questions (
          id, import_id, external_key, chapter_id,
          stem_html, stem_text, lead_in, explanation_html, educational_objective, why_correct,
          question_type, difficulty, subject, system, category, topic,
          tags_json, correct_option_id, source_json,
          is_active, is_deleted, logical_clock, origin_id, created_at, updated_at
        ) VALUES (
          ${q.id}, ${q.import_id}, ${q.external_key}, ${q.chapter_id},
          ${q.stem_html}, ${q.stem_text}, ${q.lead_in}, ${q.explanation_html},
          ${q.educational_objective}, ${q.why_correct},
          ${q.question_type}, ${q.difficulty}, ${q.subject}, ${q.system},
          ${q.category}, ${q.topic},
          ${q.tags_json}, ${q.correct_option_id}, ${q.source_json},
          ${q.is_active}, ${q.is_deleted}, ${q.logical_clock}, ${q.origin_id},
          ${q.created_at}, ${q.updated_at}
        )
        ON CONFLICT (id) DO UPDATE SET
          stem_html             = EXCLUDED.stem_html,
          stem_text             = EXCLUDED.stem_text,
          lead_in               = EXCLUDED.lead_in,
          explanation_html      = EXCLUDED.explanation_html,
          educational_objective = EXCLUDED.educational_objective,
          why_correct           = EXCLUDED.why_correct,
          question_type         = EXCLUDED.question_type,
          difficulty            = EXCLUDED.difficulty,
          subject               = EXCLUDED.subject,
          system                = EXCLUDED.system,
          category              = EXCLUDED.category,
          topic                 = EXCLUDED.topic,
          tags_json             = EXCLUDED.tags_json,
          correct_option_id     = EXCLUDED.correct_option_id,
          source_json           = EXCLUDED.source_json,
          is_active             = EXCLUDED.is_active,
          is_deleted            = EXCLUDED.is_deleted,
          logical_clock         = EXCLUDED.logical_clock,
          origin_id             = EXCLUDED.origin_id,
          updated_at            = EXCLUDED.updated_at
        WHERE
          EXCLUDED.logical_clock > questions.logical_clock
          OR (
            EXCLUDED.logical_clock = questions.logical_clock
            AND EXCLUDED.updated_at > questions.updated_at
          )
      `);
    }
    return true;
  } catch {
    // FK violation (missing chapter_id on the server), unique violation on a field
    // we didn't conflict on, or other DB error. Skip and count.
    return false;
  }
}

/**
 * Upsert one question_option row.
 * Conflicts on id (PK) — handles idempotent re-push of the same session.
 * Content always overwrites: options are owned entirely by their parent question;
 * whatever the latest import sends is canonical.
 */
async function upsertQuestionOption(db: PostgresDb, opt: QuestionOptionSyncRecord): Promise<boolean> {
  try {
    await db.execute(sql`
      INSERT INTO question_options (
        id, question_id, option_key, content_html, content_text,
        is_correct, sort_order, created_at
      ) VALUES (
        ${opt.id}, ${opt.question_id}, ${opt.option_key}, ${opt.content_html},
        ${opt.content_text}, ${opt.is_correct}, ${opt.sort_order}, ${opt.created_at}
      )
      ON CONFLICT (id) DO UPDATE SET
        content_html = EXCLUDED.content_html,
        content_text = EXCLUDED.content_text,
        is_correct   = EXCLUDED.is_correct,
        sort_order   = EXCLUDED.sort_order
    `);
    return true;
  } catch {
    return false;
  }
}

/**
 * Upsert one flashcard row with LWW resolution.
 * Conflicts on id (PK) — flashcards have no stable external_key.
 */
async function upsertFlashcard(db: PostgresDb, f: FlashcardSyncRecord): Promise<boolean> {
  try {
    await db.execute(sql`
      INSERT INTO flashcards (
        id, import_id, chapter_id, chapter_no,
        card_type, created_from, status, deck,
        front_html, back_html, extra_html, cloze_text, educational_objective,
        tags_json, source_json,
        fsrs_stability, fsrs_difficulty, fsrs_state,
        fsrs_due, fsrs_last_review, fsrs_reps, fsrs_lapses,
        is_deleted, logical_clock, origin_id, created_at, updated_at
      ) VALUES (
        ${f.id}, ${f.import_id}, ${f.chapter_id}, ${f.chapter_no},
        ${f.card_type}, ${f.created_from}, ${f.status}, ${f.deck},
        ${f.front_html}, ${f.back_html}, ${f.extra_html}, ${f.cloze_text},
        ${f.educational_objective},
        ${f.tags_json}, ${f.source_json},
        ${f.fsrs_stability ?? 0}, ${f.fsrs_difficulty ?? 0}, ${f.fsrs_state ?? 'new'},
        ${f.fsrs_due}, ${f.fsrs_last_review}, ${f.fsrs_reps ?? 0}, ${f.fsrs_lapses ?? 0},
        ${f.is_deleted}, ${f.logical_clock}, ${f.origin_id},
        ${f.created_at}, ${f.updated_at}
      )
      ON CONFLICT (id) DO UPDATE SET
        import_id             = EXCLUDED.import_id,
        chapter_id            = EXCLUDED.chapter_id,
        chapter_no            = EXCLUDED.chapter_no,
        card_type             = EXCLUDED.card_type,
        status                = EXCLUDED.status,
        deck                  = EXCLUDED.deck,
        front_html            = EXCLUDED.front_html,
        back_html             = EXCLUDED.back_html,
        extra_html            = EXCLUDED.extra_html,
        cloze_text            = EXCLUDED.cloze_text,
        educational_objective = EXCLUDED.educational_objective,
        tags_json             = EXCLUDED.tags_json,
        source_json           = EXCLUDED.source_json,
        fsrs_stability        = EXCLUDED.fsrs_stability,
        fsrs_difficulty       = EXCLUDED.fsrs_difficulty,
        fsrs_state            = EXCLUDED.fsrs_state,
        fsrs_due              = EXCLUDED.fsrs_due,
        fsrs_last_review      = EXCLUDED.fsrs_last_review,
        fsrs_reps             = EXCLUDED.fsrs_reps,
        fsrs_lapses           = EXCLUDED.fsrs_lapses,
        is_deleted            = EXCLUDED.is_deleted,
        logical_clock         = EXCLUDED.logical_clock,
        origin_id             = EXCLUDED.origin_id,
        updated_at            = EXCLUDED.updated_at
      WHERE
        EXCLUDED.logical_clock > flashcards.logical_clock
        OR (
          EXCLUDED.logical_clock = flashcards.logical_clock
          AND EXCLUDED.updated_at > flashcards.updated_at
        )
    `);
    return true;
  } catch {
    return false;
  }
}

/**
 * Upsert one import row.
 * No LWW: imports are append-only; last write wins on status/item_count.
 */
async function upsertImport(db: PostgresDb, imp: ImportSyncRecord): Promise<boolean> {
  try {
    await db.execute(sql`
      INSERT INTO imports (
        id, source_name, source_type, schema_version, status,
        file_name, content_type, item_count, created_at, updated_at
      ) VALUES (
        ${imp.id}, ${imp.source_name}, ${imp.source_type}, ${imp.schema_version},
        ${imp.status}, ${imp.file_name}, ${imp.content_type}, ${imp.item_count},
        ${imp.created_at}, ${imp.updated_at}
      )
      ON CONFLICT (id) DO UPDATE SET
        status       = EXCLUDED.status,
        item_count   = EXCLUDED.item_count,
        updated_at   = EXCLUDED.updated_at
    `);
    return true;
  } catch {
    return false;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse<SyncPushResult | { ok: false; error: string }>> {
  // When running in PGlite mode there is no server-side Postgres to push to.
  if (isPGliteRuntime()) {
    return NextResponse.json({
      ok: true,
      synced: { questions: 0, question_options: 0, flashcards: 0, imports: 0, skipped: 0 },
      newMaxClock: 0,
    });
  }

  // 1. Parse + validate payload.
  let payload: SyncPushPayload;
  try {
    const body: unknown = await request.json();
    payload = SyncPushPayloadSchema.parse(body);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Invalid payload" },
      { status: 400 },
    );
  }

  const db = createPostgresDb();
  if (!db) {
    return NextResponse.json(
      { ok: false, error: "Server sync not configured" },
      { status: 503 },
    );
  }

  let syncedQuestions       = 0;
  let syncedQuestionOptions = 0;
  let syncedFlashcards      = 0;
  let syncedImports         = 0;
  let skipped               = 0;
  let newMaxClock           = 0;

  // 2. Upsert imports first — questions/flashcards may reference an import id.
  for (const imp of payload.imports) {
    if (await upsertImport(db, imp)) syncedImports++;
    else skipped++;
  }

  // 3. Upsert questions with LWW.
  for (const q of payload.questions) {
    if (await upsertQuestion(db, q)) {
      syncedQuestions++;
      if (q.logical_clock > newMaxClock) newMaxClock = q.logical_clock;
    } else {
      skipped++;
    }
  }

  // 3b. Resolve canonical server ids for re-import cases.
  // When a question conflicts on external_key its id on the server stays as the FIRST
  // insert's UUID (we no longer update id on conflict). The options in the payload
  // carry the browser-local question UUID from the current import run, which may
  // differ from the server PK. Query the server here to build the remap table.
  const localToServerId = new Map<string, string>();
  for (const q of payload.questions) localToServerId.set(q.id, q.id); // identity seed

  const extKeyQuestions = payload.questions.filter((q) => q.external_key !== null);
  if (extKeyQuestions.length > 0) {
    const keys = extKeyQuestions.map((q) => q.external_key as string);
    const resolved = await db.execute(sql`
      SELECT id, external_key FROM questions
      WHERE external_key IN (${sql.join(keys.map((k) => sql`${k}`), sql.raw(", "))})
    `);
    for (const row of resolved.rows as { id: string; external_key: string }[]) {
      const localQ = extKeyQuestions.find((q) => q.external_key === row.external_key);
      if (localQ) localToServerId.set(localQ.id, row.id);
    }
  }

  // 4. Upsert question options — remapping question_id to the server canonical value.
  for (const opt of payload.question_options) {
    const canonicalQId = localToServerId.get(opt.question_id) ?? opt.question_id;
    const remapped: QuestionOptionSyncRecord =
      canonicalQId !== opt.question_id ? { ...opt, question_id: canonicalQId } : opt;
    if (await upsertQuestionOption(db, remapped)) syncedQuestionOptions++;
    else skipped++;
  }

  // 5. Upsert flashcards with LWW.
  for (const f of payload.flashcards) {
    if (await upsertFlashcard(db, f)) {
      syncedFlashcards++;
      if (f.logical_clock > newMaxClock) newMaxClock = f.logical_clock;
    } else {
      skipped++;
    }
  }

  return NextResponse.json({
    ok: true,
    synced: {
      questions:        syncedQuestions,
      question_options: syncedQuestionOptions,
      flashcards:       syncedFlashcards,
      imports:          syncedImports,
      skipped,
    },
    newMaxClock,
  });
}
