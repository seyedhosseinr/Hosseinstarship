#!/usr/bin/env tsx
// Diagnostic probe — counts rows in the key QBank tables to decide which
// PGlite snapshot actually holds the corpus.
import * as nextEnv from "@next/env";

async function main() {
  nextEnv.loadEnvConfig(process.cwd());
  const { getDb } = await import("@/db/index");
  const db = await getDb();
  const tables = [
    "questions",
    "question_options",
    "question_attempts",
    "question_bookmarks",
    "chapters",
    "note_documents",
    "note_frames",
    "exam_sessions",
    "exam_session_questions",
  ];
  for (const t of tables) {
    try {
      const rows = await (db as unknown as {
        execute: (sql: string) => Promise<{ rows: { count: string | number }[] }>;
      }).execute(`select count(*)::text as count from ${t}`);
      console.log(`${t.padEnd(28)} ${rows.rows[0]?.count ?? "?"}`);
    } catch (err) {
      console.log(`${t.padEnd(28)} (missing)`);
    }
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
