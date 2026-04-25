// @ts-nocheck
import fs from "node:fs";
import path from "node:path";

const SRC_ROOT = path.resolve(process.cwd(), "src");
const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"]);

function walkFiles(dir: string, out: string[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
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

function readPackageNames(): string[] {
  const packageJsonPath = path.resolve(process.cwd(), "package.json");
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  return [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})].sort();
}

function main() {
  const packages = readPackageNames();
  const files: string[] = [];

  if (fs.existsSync(SRC_ROOT)) {
    walkFiles(SRC_ROOT, files);
  }

  for (const configFile of [
    "next.config.ts",
    "next.config.js",
    "next.config.mjs",
    "tailwind.config.ts",
    "tailwind.config.js",
    "postcss.config.mjs",
    "drizzle.config.ts",
    "package.json",
  ]) {
    const full = path.resolve(process.cwd(), configFile);
    if (fs.existsSync(full)) files.push(full);
  }

  const corpus = files
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");

  const used: string[] = [];
  const unused: string[] = [];

  for (const pkgName of packages) {
    const direct = [
      `from "${pkgName}"`,
      `from '${pkgName}'`,
      `require("${pkgName}")`,
      `require('${pkgName}')`,
      `"${pkgName}"`,
      `'${pkgName}'`,
    ].some((needle) => corpus.includes(needle));

    const scopedPrefix = pkgName.startsWith("@") ? pkgName.split("/")[0] : "";
    const indirectScoped = scopedPrefix.length > 0 && corpus.includes(`${scopedPrefix}/`);

    if (direct || indirectScoped) used.push(pkgName);
    else unused.push(pkgName);
  }

  console.log("\n=== Package Usage Analysis ===\n");
  console.log(`Total packages: ${packages.length}`);
  console.log(`Used (detected): ${used.length}`);
  console.log(`Potentially unused: ${unused.length}\n`);

  if (unused.length === 0) {
    console.log("PASS  No potentially unused packages detected.");
    return;
  }

  console.log("Potentially unused packages (verify before uninstall):");
  for (const pkgName of unused) {
    console.log(`  - ${pkgName}`);
  }
}

main();
