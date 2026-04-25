#!/usr/bin/env tsx
import * as nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

async function main() {
  console.log("Loading DB module...");
  const { getDb } = await import("@/db/index");
  console.log("Calling getDb()...");
  const db = await getDb();
  console.log("DB ready. Querying yield_annotations...");
  const result = await db.execute("SELECT count(*) as c FROM yield_annotations");
  console.log("yield_annotations count:", result.rows);
  process.exit(0);
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
