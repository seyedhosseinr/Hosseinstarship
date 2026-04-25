import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const SRC_DIR = join(projectRoot, "node_modules/@electric-sql/pglite/dist");
const DEST_DIR = join(projectRoot, "public/pglite");
const FILES = ["pglite.wasm", "pglite.data", "initdb.wasm"];

if (!existsSync(SRC_DIR)) {
  console.warn(`[copy-pglite-assets] ${SRC_DIR} not found; skipping.`);
  process.exit(0);
}

mkdirSync(DEST_DIR, { recursive: true });
for (const file of FILES) {
  const src = join(SRC_DIR, file);
  const dest = join(DEST_DIR, file);
  if (!existsSync(src)) {
    console.error(`[copy-pglite-assets] Missing source: ${src}`);
    process.exit(1);
  }
  cpSync(src, dest);
  console.log(`[copy-pglite-assets] ${file} → public/pglite/`);
}
