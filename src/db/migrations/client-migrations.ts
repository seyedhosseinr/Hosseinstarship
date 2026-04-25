/**
 * client-migrations.ts — Raw SQL migration strings for browser OPFS databases.
 *
 * These strings are passed to runBrowserMigrations() at app startup.
 * Every statement must be idempotent (ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS)
 * so that repeated calls on already-migrated databases are no-ops.
 *
 * Naming: sql_NNNN mirrors the drizzle migration filename (e.g. 0002_crdt_fields_v3.sql).
 */

/**
 * Adds LWW-CRDT columns (is_deleted, logical_clock, origin_id) and sync indexes
 * to questions, flashcards, and ingest_batches.
 * Source: drizzle/0002_crdt_fields_v3.sql
 */
export const sql_0002 = `
ALTER TABLE "questions"
  ADD COLUMN IF NOT EXISTS "is_deleted"    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "logical_clock" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "origin_id"     text;

CREATE INDEX IF NOT EXISTS "questions_clock_idx"    ON "questions" ("logical_clock");
CREATE INDEX IF NOT EXISTS "questions_deleted_idx"  ON "questions" ("is_deleted");

ALTER TABLE "flashcards"
  ADD COLUMN IF NOT EXISTS "is_deleted"    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "logical_clock" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "origin_id"     text;

CREATE INDEX IF NOT EXISTS "flashcards_clock_idx"    ON "flashcards" ("logical_clock");
CREATE INDEX IF NOT EXISTS "flashcards_deleted_idx"  ON "flashcards" ("is_deleted");

ALTER TABLE "ingest_batches"
  ADD COLUMN IF NOT EXISTS "is_deleted"    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "logical_clock" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "origin_id"     text;

CREATE INDEX IF NOT EXISTS "ingest_batches_clock_idx"    ON "ingest_batches" ("logical_clock");
CREATE INDEX IF NOT EXISTS "ingest_batches_deleted_idx"  ON "ingest_batches" ("is_deleted");
`;

/**
 * Adds LWW-CRDT columns (is_deleted, logical_clock, origin_id) and sync indexes
 * to flashcard_reviews, chapter_progress, exam_sessions, question_attempts, study_tasks.
 * Source: drizzle/0003_crdt_remaining_tables.sql
 */
export const sql_0003 = `
ALTER TABLE "flashcard_reviews"
  ADD COLUMN IF NOT EXISTS "is_deleted"    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "logical_clock" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "origin_id"     text;

ALTER TABLE "chapter_progress"
  ADD COLUMN IF NOT EXISTS "is_deleted"    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "logical_clock" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "origin_id"     text;

ALTER TABLE "exam_sessions"
  ADD COLUMN IF NOT EXISTS "is_deleted"    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "logical_clock" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "origin_id"     text;

ALTER TABLE "question_attempts"
  ADD COLUMN IF NOT EXISTS "is_deleted"    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "logical_clock" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "origin_id"     text;

ALTER TABLE "study_tasks"
  ADD COLUMN IF NOT EXISTS "is_deleted"    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "logical_clock" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "origin_id"     text;

CREATE INDEX IF NOT EXISTS "fr_clock_idx" ON "flashcard_reviews" ("logical_clock");
CREATE INDEX IF NOT EXISTS "cp_clock_idx" ON "chapter_progress"  ("logical_clock");
CREATE INDEX IF NOT EXISTS "es_clock_idx" ON "exam_sessions"      ("logical_clock");
CREATE INDEX IF NOT EXISTS "qa_clock_idx" ON "question_attempts"  ("logical_clock");
CREATE INDEX IF NOT EXISTS "st_clock_idx" ON "study_tasks"        ("logical_clock");
`;
