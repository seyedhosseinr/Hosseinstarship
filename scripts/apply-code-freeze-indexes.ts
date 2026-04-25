// @ts-nocheck
import path from "node:path";
import Database from "better-sqlite3";

function resolveDbPath(): string {
  const configured = process.env.DATABASE_URL?.trim() || "local.db";
  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
}

function main() {
  const dbPath = resolveDbPath();
  const sqlite = new Database(dbPath);

  sqlite.pragma("busy_timeout = 5000");

  const statements = [
    "CREATE INDEX IF NOT EXISTS flashcards_due_status_suspended_idx ON flashcards (fsrs_due, status, is_suspended)",
    "CREATE INDEX IF NOT EXISTS flashcards_last_reviewed_idx ON flashcards (fsrs_last_review)",
    "CREATE INDEX IF NOT EXISTS question_attempts_outcome_attempted_at_idx ON question_attempts (outcome, attempted_at)",
    "CREATE INDEX IF NOT EXISTS study_tasks_status_scheduled_for_idx ON study_tasks (status, scheduled_for)",
    "CREATE INDEX IF NOT EXISTS segment_progress_segment_idx ON segment_progress (segment_id)",
    "CREATE INDEX IF NOT EXISTS note_documents_chapter_no_idx ON note_documents (chapter_no)",
    "CREATE INDEX IF NOT EXISTS note_documents_created_at_idx ON note_documents (created_at)",
  ];

  for (const statement of statements) {
    sqlite.prepare(statement).run();
  }

  console.log(`Applied ${statements.length} code-freeze indexes to ${dbPath}`);
}

main();
