// @ts-nocheck
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "src");
const CODE_EXTENSIONS = new Set([".ts", ".tsx"]);

type ExportInfo = {
  file: string;
  name: string;
  type: "const" | "function" | "class" | "interface" | "type" | "default";
};

function walkFiles(dir: string, out: string[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
      continue;
    }
    if (CODE_EXTENSIONS.has(path.extname(entry.name)) && !entry.name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
}

function collectExports(file: string, content: string): ExportInfo[] {
  const entries: ExportInfo[] = [];
  const named = content.matchAll(/export\s+(const|function|class|interface|type)\s+([A-Za-z0-9_]+)/g);
  for (const match of named) {
    entries.push({
      file,
      name: match[2],
      type: match[1] as ExportInfo["type"],
    });
  }
  const defaults = content.matchAll(/export\s+default\s+(function|class)\s+([A-Za-z0-9_]+)/g);
  for (const match of defaults) {
    entries.push({
      file,
      name: match[2],
      type: "default",
    });
  }
  return entries;
}

function shouldSkip(info: ExportInfo): boolean {
  const normalized = info.file.replace(/\\/g, "/");
  if (normalized.includes("/app/api/")) return true;
  if (normalized.endsWith("/layout.tsx")) return true;
  if (normalized.endsWith("/loading.tsx")) return true;
  if (normalized.endsWith("/error.tsx")) return true;
  return false;
}

function main() {
  if (!fs.existsSync(ROOT)) {
    console.log("src directory not found");
    return;
  }

  const files: string[] = [];
  walkFiles(ROOT, files);

  const fileMap = new Map<string, string>();
  const exports: ExportInfo[] = [];
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    fileMap.set(file, content);
    exports.push(...collectExports(path.relative(process.cwd(), file), content));
  }

  const corpus = [...fileMap.values()].join("\n");
  const potentiallyUnused: ExportInfo[] = [];
  for (const entry of exports) {
    if (shouldSkip(entry)) continue;
    const occurrences = corpus.match(new RegExp(`\\b${entry.name}\\b`, "g"))?.length ?? 0;
    if (occurrences <= 1) {
      potentiallyUnused.push(entry);
    }
  }

  console.log("\n=== Dead Code Scan (Heuristic) ===\n");
  console.log(`Exports scanned: ${exports.length}`);
  console.log(`Potentially unused: ${potentiallyUnused.length}\n`);

  if (potentiallyUnused.length === 0) {
    console.log("PASS  No obviously unused exports detected.");
    return;
  }

  const grouped = new Map<string, ExportInfo[]>();
  for (const item of potentiallyUnused) {
    const list = grouped.get(item.file) ?? [];
    list.push(item);
    grouped.set(item.file, list);
  }

  for (const [file, list] of grouped.entries()) {
    console.log(file);
    for (const item of list) {
      console.log(`  - ${item.type} ${item.name}`);
    }
    console.log("");
  }
}

main();
