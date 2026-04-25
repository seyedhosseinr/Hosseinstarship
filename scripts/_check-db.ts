import Database from "better-sqlite3";

const mode = process.argv[2]; // "check" | "reset"

const s = new Database("./local.db");
s.pragma("journal_mode = WAL");
s.pragma("foreign_keys = OFF");

if (mode === "reset") {
  console.log("=== DROPPING ALL OLD TABLES ===");
  const tables = s.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  for (const t of tables) {
    const name = (t as any).name;
    console.log(`  DROP TABLE ${name}`);
    s.exec(`DROP TABLE IF EXISTS "${name}"`);
  }
  // Drop indexes too
  const idxs = s.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'").all();
  for (const idx of idxs) {
    try { s.exec(`DROP INDEX IF EXISTS "${(idx as any).name}"`); } catch {}
  }
  s.exec("VACUUM");
  console.log("Done. DB is now empty.");
} else {
  const tables = s.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  console.log("=== TABLES ===");
  for (const t of tables) {
    const name = (t as any).name;
    try {
      const row = s.prepare(`SELECT COUNT(*) as c FROM "${name}"`).get() as any;
      console.log(`  ${name}: ${row.c} rows`);
    } catch { console.log(`  ${name}: (error)`); }
  }
}
s.close();
