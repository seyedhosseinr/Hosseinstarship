/**
 * Migration Doctor — diagnose & baseline Drizzle migration state
 *
 * Usage:
 *   npx tsx scripts/_migration-doctor.ts          # diagnose only
 *   npx tsx scripts/_migration-doctor.ts baseline  # insert missing migration records
 *
 * Background:
 *   This project was built using `drizzle-kit push` which syncs schema
 *   directly to SQLite without recording migration history. When switching
 *   to `drizzle-kit migrate`, the empty __drizzle_migrations table causes
 *   it to replay all migrations from scratch → "table already exists" errors.
 *
 *   The baseline command records all existing generated migrations as
 *   "already applied" so future migrations work correctly.
 */
import Database from "better-sqlite3";
import { readFileSync, existsSync } from "fs";
import { resolve, join } from "path";
import { createHash } from "crypto";

const DB_PATH = resolve("./local.db");
const DRIZZLE_DIR = resolve("./drizzle");
const JOURNAL_PATH = join(DRIZZLE_DIR, "meta", "_journal.json");

const mode = process.argv[2]; // "baseline" or undefined (diagnose)

const db = new Database(DB_PATH);

// ---- Diagnose ----
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all() as { name: string }[];
console.log("=== Tables in local.db ===");
for (const t of tables) console.log(`  ${t.name}`);
console.log(`\nTotal: ${tables.length} tables`);

const migTableExists = tables.some((t) => t.name === "__drizzle_migrations");
console.log(`\n__drizzle_migrations exists: ${migTableExists}`);

if (migTableExists) {
  const rows = db
    .prepare("SELECT * FROM __drizzle_migrations ORDER BY created_at")
    .all() as { id: number; hash: string; created_at: number }[];
  console.log(`Migration records: ${rows.length}`);
  for (const r of rows) {
    console.log(`  id=${r.id}  hash=${r.hash}  at=${new Date(r.created_at).toISOString()}`);
  }
}

// ---- Read journal ----
if (!existsSync(JOURNAL_PATH)) {
  console.log("\nNo drizzle journal found at", JOURNAL_PATH);
  db.close();
  process.exit(0);
}

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}
const journal = JSON.parse(readFileSync(JOURNAL_PATH, "utf-8")) as {
  entries: JournalEntry[];
};
console.log(`\nJournal entries: ${journal.entries.length}`);
for (const e of journal.entries) {
  console.log(`  [${e.idx}] ${e.tag}  (${new Date(e.when).toISOString()})`);
}

// ---- Baseline ----
if (mode === "baseline") {
  if (!migTableExists) {
    console.log("\nCreating __drizzle_migrations table...");
    db.exec(`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id    INTEGER PRIMARY KEY AUTOINCREMENT,
        hash  TEXT    NOT NULL,
        created_at NUMERIC
      );
    `);
  }

  const existingHashes = new Set(
    (
      db.prepare("SELECT hash FROM __drizzle_migrations").all() as {
        hash: string;
      }[]
    ).map((r) => r.hash)
  );

  const insert = db.prepare(
    "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)"
  );

  let inserted = 0;
  for (const entry of journal.entries) {
    const sqlPath = join(DRIZZLE_DIR, `${entry.tag}.sql`);
    if (!existsSync(sqlPath)) {
      console.log(`  SKIP ${entry.tag} — .sql file not found`);
      continue;
    }
    const content = readFileSync(sqlPath, "utf-8");
    const hash = createHash("sha256").update(content).digest("hex");

    if (existingHashes.has(hash)) {
      console.log(`  SKIP ${entry.tag} — already recorded (hash ${hash.slice(0, 12)}…)`);
      continue;
    }

    insert.run(hash, entry.when);
    inserted++;
    console.log(`  INSERTED ${entry.tag} → hash ${hash.slice(0, 12)}…`);
  }

  console.log(`\nBaseline complete: ${inserted} migration(s) recorded.`);

  // Verify
  const final = db
    .prepare("SELECT * FROM __drizzle_migrations ORDER BY created_at")
    .all() as { id: number; hash: string; created_at: number }[];
  console.log(`Final migration records: ${final.length}`);
  for (const r of final) {
    console.log(`  id=${r.id}  hash=${r.hash.slice(0, 12)}…  at=${new Date(r.created_at).toISOString()}`);
  }
} else {
  console.log('\nRun with "baseline" argument to record existing migrations.');
}

db.close();
