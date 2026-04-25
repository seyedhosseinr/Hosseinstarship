// @ts-nocheck
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "src");
const EXCLUDE_SEGMENTS = ["node_modules", ".next", "scripts"];
const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

function walkFiles(dir: string, out: string[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE_SEGMENTS.includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
      continue;
    }
    if (CODE_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
}

function isDebugLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.startsWith("console.error(")) return false;
  if (trimmed.startsWith("console.warn(")) return false;
  return /^console\.(log|debug|info|table|dir|trace|time|timeEnd)\(.*\);?\s*$/.test(trimmed);
}

function main() {
  if (!fs.existsSync(ROOT)) {
    console.log("src directory not found");
    return;
  }

  const files: string[] = [];
  walkFiles(ROOT, files);

  let removed = 0;
  for (const file of files) {
    const original = fs.readFileSync(file, "utf8");
    const lines = original.split("\n");
    const nextLines = lines.filter((line) => {
      if (isDebugLine(line)) {
        removed += 1;
        return false;
      }
      return true;
    });
    const next = nextLines.join("\n");
    if (next !== original) {
      fs.writeFileSync(`${file}.backup`, original, "utf8");
      fs.writeFileSync(file, next, "utf8");
      console.log(`cleaned ${path.relative(process.cwd(), file)}`);
    }
  }

  console.log(`\nDone. Removed ${removed} debug console lines.`);
}

main();
