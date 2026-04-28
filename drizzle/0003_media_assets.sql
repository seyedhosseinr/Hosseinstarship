-- 0003_media_assets
--
-- Hossein Starship Phase 2 — media-reference reader registry.
-- Adds a read-only lookup table that the Reader's resolver uses to match
-- detected figure / image / table references in NOTE prose against
-- imported assets. The table is intentionally decoupled from the
-- per-chunk `chunk_assets` row set so refs can be looked up by
-- chapter+ref alone, without joining through the chunk that authored them.
--
-- Compatibility: plain text + integer (bigint-as-number) columns; no
-- dialect-specific types. Runs on Postgres and PGlite identically.
-- Boolean stored as integer 0/1 (project-wide convention).
--
-- Idempotent: uses CREATE TABLE / CREATE INDEX IF NOT EXISTS so reruns
-- are no-ops. Empty after migration — populated by a future importer.

CREATE TABLE IF NOT EXISTS "media_assets" (
  "id"             text PRIMARY KEY NOT NULL,
  "media_id"       text NOT NULL,
  "chapter_number" bigint NOT NULL,
  "segment_id"     text,
  "ref_id"         text,
  "figure_label"   text,
  "kind"           text NOT NULL,
  "filename"       text,
  "storage_path"   text,
  "source_page"    bigint,
  "caption"        text,
  "tags_json"      text,
  "high_yield"     bigint NOT NULL DEFAULT 0,
  "created_at"     bigint NOT NULL DEFAULT ((extract(epoch from now()) * 1000)::bigint),
  "updated_at"     bigint NOT NULL DEFAULT ((extract(epoch from now()) * 1000)::bigint)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "media_assets_media_id_unique"
  ON "media_assets" USING btree ("media_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_chapter_idx"
  ON "media_assets" USING btree ("chapter_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_ref_id_idx"
  ON "media_assets" USING btree ("ref_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_kind_idx"
  ON "media_assets" USING btree ("kind");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_chapter_kind_idx"
  ON "media_assets" USING btree ("chapter_number", "kind");
