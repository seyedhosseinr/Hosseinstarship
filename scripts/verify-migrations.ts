// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

type CheckResult = {
  name: string;
  pass: boolean;
  details?: string;
};

function resolveDbPath(): string {
  const configured = process.env.DATABASE_URL?.trim() || "local.db";
  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
}

function hasAll(rows: string[], names: string[]): { ok: boolean; missing: string[] } {
  const existing = new Set(rows);
  const missing = names.filter((name) => !existing.has(name));
  return { ok: missing.length === 0, missing };
}

function checkMigrationJournal(): { applied: string[]; sqlFiles: string[]; unapplied: string[] } {
  const drizzleDir = path.resolve(process.cwd(), "drizzle");
  const journalPath = path.resolve(drizzleDir, "meta", "_journal.json");

  const sqlFiles = fs
    .readdirSync(drizzleDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  if (!fs.existsSync(journalPath)) {
    return { applied: [], sqlFiles, unapplied: sqlFiles };
  }

  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
    entries?: Array<{ tag?: string }>;
  };

  const applied = (journal.entries ?? [])
    .map((entry) => (entry.tag ? `${entry.tag}.sql` : ""))
    .filter(Boolean)
    .sort();

  const appliedSet = new Set(applied);
  const unapplied = sqlFiles.filter((file) => !appliedSet.has(file));
  return { applied, sqlFiles, unapplied };
}

function main() {
  const dbPath = resolveDbPath();
  console.log(`Database: ${dbPath}`);
  const sqlite = new Database(dbPath, { readonly: true });

  const checks: CheckResult[] = [];

  const requiredTables = [
    "flashcards",
    "questions",
    "question_options",
    "question_attempts",
    "exam_sessions",
    "note_documents",
    "note_frames",
    "chapters",
    "study_tasks",
    "study_plans",
    "segment_progress",
    "concept_mastery",
  ];

  const tableRows = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all() as Array<{ name: string }>;
  const tableNames = tableRows.map((row) => row.name);
  const tableCheck = hasAll(tableNames, requiredTables);
  checks.push({
    name: "Required tables",
    pass: tableCheck.ok,
    details: tableCheck.ok ? undefined : `Missing: ${tableCheck.missing.join(", ")}`,
  });

  const indexRows = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='index'")
    .all() as Array<{ name: string }>;
  const indexNames = indexRows.map((row) => row.name);

  const requiredIndexes = [
    "flashcards_due_idx",
    "flashcards_due_status_suspended_idx",
    "flashcards_chapter_idx",
    "flashcards_state_idx",
    "question_attempts_question_idx",
    "question_attempts_outcome_idx",
    "question_attempts_outcome_attempted_at_idx",
    "study_tasks_scheduled_for_idx",
    "study_tasks_status_scheduled_for_idx",
    "segment_progress_mastery_idx",
    "segment_progress_segment_idx",
    "note_documents_chapter_no_idx",
  ];
  const idxCheck = hasAll(indexNames, requiredIndexes);
  checks.push({
    name: "Critical indexes",
    pass: idxCheck.ok,
    details: idxCheck.ok ? undefined : `Missing: ${idxCheck.missing.join(", ")}`,
  });

  const flashcardCols = (
    sqlite.prepare("PRAGMA table_info(flashcards)").all() as Array<{ name: string }>
  ).map((row) => row.name);
  const fsrsColumns = [
    "fsrs_state",
    "fsrs_due",
    "fsrs_stability",
    "fsrs_difficulty",
    "fsrs_reps",
    "fsrs_lapses",
  ];
  const fsrsCheck = hasAll(flashcardCols, fsrsColumns);
  checks.push({
    name: "Flashcard FSRS columns",
    pass: fsrsCheck.ok,
    details: fsrsCheck.ok ? undefined : `Missing: ${fsrsCheck.missing.join(", ")}`,
  });

  const segmentCols = (
    sqlite.prepare("PRAGMA table_info(segment_progress)").all() as Array<{ name: string }>
  ).map((row) => row.name);
  const segmentColumns = ["segment_id", "mastery_score", "mcqs_attempted", "mcqs_correct", "cards_due"];
  const segmentCheck = hasAll(segmentCols, segmentColumns);
  checks.push({
    name: "Segment progress columns",
    pass: segmentCheck.ok,
    details: segmentCheck.ok ? undefined : `Missing: ${segmentCheck.missing.join(", ")}`,
  });

  const migrationStatus = checkMigrationJournal();
  checks.push({
    name: "Migration journal sync",
    pass: migrationStatus.unapplied.length === 0,
    details:
      migrationStatus.unapplied.length === 0
        ? undefined
        : `Unapplied SQL files: ${migrationStatus.unapplied.join(", ")}`,
  });

  console.log("\n=== Migration Verification ===\n");
  let passCount = 0;
  let failCount = 0;
  for (const check of checks) {
    if (check.pass) {
      passCount += 1;
      console.log(`PASS  ${check.name}`);
    } else {
      failCount += 1;
      console.log(`FAIL  ${check.name}`);
      if (check.details) console.log(`      ${check.details}`);
    }
  }

  console.log(`\nSummary: ${passCount} passed, ${failCount} failed`);
  if (failCount > 0) {
    process.exitCode = 1;
  }
}

main();
