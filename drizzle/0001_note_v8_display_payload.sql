-- 0001_note_v8_display_payload
--
-- Hossein Starship NOTE v8.1 — persistence upgrade.
-- Adds four additive nullable columns to note_frames so v8 blocks can persist
-- structured display payload, flags, schema version, and content hash without
-- displacing any existing row. Every legacy row keeps NULL for these columns.
--
-- Idempotent: uses ADD COLUMN IF NOT EXISTS so a rerun is a no-op.

ALTER TABLE "note_frames" ADD COLUMN IF NOT EXISTS "schema_version" text;
--> statement-breakpoint
ALTER TABLE "note_frames" ADD COLUMN IF NOT EXISTS "content_hash" text;
--> statement-breakpoint
ALTER TABLE "note_frames" ADD COLUMN IF NOT EXISTS "display_json" text;
--> statement-breakpoint
ALTER TABLE "note_frames" ADD COLUMN IF NOT EXISTS "flags_json" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "note_frames_schema_version_idx" ON "note_frames" USING btree ("schema_version");
