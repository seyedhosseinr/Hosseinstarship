#!/usr/bin/env tsx
// Probe every .pglite backup dir to find the one that still contains the
// QBank corpus. Opens each as a read-only PGlite, queries the critical
// tables, and prints a tight summary. Diagnostic only.
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

async function probeOne(dir: string) {
  // Strip any lingering pid/opts so PGlite doesn't panic.
  for (const f of ["postmaster.pid", "postmaster.opts"]) {
    const p = join(dir, f);
    if (existsSync(p)) rmSync(p, { force: true });
  }
  const client = new PGlite(dir);
  try {
    const tables = ["questions", "question_options", "question_attempts", "chapters"];
    const out: Record<string, string> = {};
    for (const t of tables) {
      try {
        const r = await client.query<{ c: string | number }>(
          `SELECT COUNT(*)::text AS c FROM "${t}"`,
        );
        out[t] = String(r.rows[0]?.c ?? "?");
      } catch {
        out[t] = "-";
      }
    }
    return out;
  } finally {
    await client.close();
  }
}

async function main() {
  const root = join(process.cwd(), ".pglite");
  const entries = readdirSync(root).filter((n) => n.startsWith("uro-omega"));
  entries.sort();
  console.log("dir".padEnd(45), "questions".padEnd(11), "options".padEnd(9), "attempts".padEnd(10), "chapters");
  for (const e of entries) {
    const dir = join(root, e);
    try {
      const o = await probeOne(dir);
      console.log(
        e.padEnd(45),
        o.questions.padEnd(11),
        o.question_options.padEnd(9),
        o.question_attempts.padEnd(10),
        o.chapters,
      );
    } catch (err) {
      console.log(e.padEnd(45), "(error:", String((err as Error).message).slice(0, 80) + ")");
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
