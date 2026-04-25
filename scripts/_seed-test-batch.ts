#!/usr/bin/env tsx
// Seed the local PGlite with the small test-batch corpus so the audit has
// something real to measure. Diagnostic only.
import * as nextEnv from "@next/env";

async function main() {
  nextEnv.loadEnvConfig(process.cwd());
  const { getDb } = await import("@/db/index");
  await getDb();
  const { runBatchImport } = await import("@/lib/import-light/batch-import");
  const summary = await runBatchImport("./data/test-batch");
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
