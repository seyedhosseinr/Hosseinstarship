import fs from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const runtime = (process.env.DB_RUNTIME || "").trim().toLowerCase();
const pgliteLocation = (process.env.PGLITE_DATA_DIR || process.env.PGLITE_DB_PATH || ".pglite/uro-omega").trim();

if (runtime !== "pglite") {
  console.error("DB_RUNTIME must be 'pglite' to reset the local offline database.");
  process.exit(1);
}

if (pgliteLocation.startsWith("idb://")) {
  console.error("This reset helper only supports filesystem-backed PGlite locations.");
  process.exit(1);
}

const resolvedPath = path.resolve(process.cwd(), pgliteLocation);

if (!fs.existsSync(resolvedPath)) {
  console.log(`No PGlite directory found at ${resolvedPath}`);
  process.exit(0);
}

fs.rmSync(resolvedPath, { recursive: true, force: true });
console.log(`Removed local PGlite data at ${resolvedPath}`);
