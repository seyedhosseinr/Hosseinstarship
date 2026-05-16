-- 0004_media_asset_payloads
--
-- Hossein Starship Phase 3.7 — Vercel-safe media payload storage.
-- Adds a DB-backed payload table so imported chapter images can be served
-- after deployment without writing into /public on a read-only filesystem.
--
-- Compatibility:
--   - plain text + integer columns only
--   - base64_data stores the binary payload in a portable form for both
--     Postgres and PGlite
--
-- Idempotent: uses CREATE TABLE / CREATE INDEX IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "media_asset_payloads" (
  "storage_key"  text PRIMARY KEY NOT NULL,
  "content_type" text NOT NULL,
  "base64_data"  text NOT NULL,
  "byte_length"  bigint NOT NULL,
  "created_at"   bigint NOT NULL DEFAULT ((extract(epoch from now()) * 1000)::bigint),
  "updated_at"   bigint NOT NULL DEFAULT ((extract(epoch from now()) * 1000)::bigint)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_asset_payloads_updated_at_idx"
  ON "media_asset_payloads" USING btree ("updated_at");
