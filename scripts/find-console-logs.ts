// @ts-nocheck
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "src");
const EXCLUDE_SEGMENTS = ["node_modules", ".next", "scripts"];
const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

type Finding = {
  file: string;
  line: number;
  content: string;
};

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

function isIgnoredLine(line: string): boolean {
  const normalized = line.replace(/\s+/g, " ").trim();
  if (normalized.startsWith("console.error(")) return true;
  if (normalized.startsWith("console.warn(")) return true;
  if (normalized.includes("// DEBUG:")) return true;
  return false;
}

function main() {
  if (!fs.existsSync(ROOT)) {
    console.log("src directory not found");
    return;
  }

  const files: string[] = [];
  walkFiles(ROOT, files);

  const patterns = [
    "console.log(",
    "console.debug(",
    "console.info(",
    "console.table(",
    "console.dir(",
    "console.trace(",
    "console.time(",
    "console.timeEnd(",
  ];

  const findings: Finding[] = [];
  for (const file of files) {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!patterns.some((pattern) => line.includes(pattern))) continue;
      if (isIgnoredLine(line)) continue;
      findings.push({
        file: path.relative(process.cwd(), file),
        line: i + 1,
        content: line.trim().slice(0, 120),
      });
    }
  }

  console.log("\n=== Console Debug Scan ===\n");
  if (findings.length === 0) {
    console.log("PASS  No debug console statements found.");
    return;
  }

  const grouped = new Map<string, Finding[]>();
  for (const finding of findings) {
    const list = grouped.get(finding.file) ?? [];
    list.push(finding);
    grouped.set(finding.file, list);
  }

  console.log(`Found ${findings.length} debug statements:\n`);
  for (const [file, list] of grouped.entries()) {
    console.log(file);
    for (const item of list) {
      console.log(`  L${item.line}: ${item.content}`);
    }
    console.log("");
  }
}

main();
