-- 0002_note_v8_query_pushdown
--
-- Hossein Starship NOTE v8.2 — pushdown booleans.
-- Adds four nullable integer columns to note_frames populated by the importer
-- so that common block-level filters (high-yield / mermaid / decision-changing
-- / exam-relevant) become indexed SQL predicates instead of in-memory scans.
-- Legacy rows keep NULL; the importer writes 0/1 on new or re-imported rows.
--
-- Idempotent: uses ADD COLUMN IF NOT EXISTS and CREATE INDEX IF NOT EXISTS.
-- Partial indexes (WHERE = 1) keep on-disk cost negligible.

ALTER TABLE "note_frames" ADD COLUMN IF NOT EXISTS "has_mermaid" integer;
--> statement-breakpoint
ALTER TABLE "note_frames" ADD COLUMN IF NOT EXISTS "high_yield" integer;
--> statement-breakpoint
ALTER TABLE "note_frames" ADD COLUMN IF NOT EXISTS "decision_changing" integer;
--> statement-breakpoint
ALTER TABLE "note_frames" ADD COLUMN IF NOT EXISTS "exam_relevant" integer;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "note_frames_has_mermaid_idx"        ON "note_frames" USING btree ("has_mermaid")        WHERE "has_mermaid" = 1;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "note_frames_high_yield_idx"         ON "note_frames" USING btree ("high_yield")         WHERE "high_yield" = 1;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "note_frames_decision_changing_idx"  ON "note_frames" USING btree ("decision_changing")  WHERE "decision_changing" = 1;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "note_frames_exam_relevant_idx"      ON "note_frames" USING btree ("exam_relevant")      WHERE "exam_relevant" = 1;
