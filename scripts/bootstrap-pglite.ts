#!/usr/bin/env tsx

import * as nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

async function main() {
  loadEnvConfig(process.cwd());

  const { getDb, getDbRuntime } = await import("@/db/index");

  if (getDbRuntime() !== "pglite") {
    throw new Error("DB_RUNTIME must be 'pglite' to bootstrap the local offline database.");
  }

  await getDb();
  console.log("PGlite bootstrap complete.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
