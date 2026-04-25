// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

type RouteResult = {
  path: string;
  name: string;
  status: "pass" | "fail" | "warn";
  details?: string;
};

const DB_BASENAME = process.env.DATABASE_URL?.trim() || "local.db";
const DB_PATH = path.isAbsolute(DB_BASENAME) ? DB_BASENAME : path.resolve(process.cwd(), DB_BASENAME);
const DB_SHM_PATH = `${DB_PATH}-shm`;
const DB_WAL_PATH = `${DB_PATH}-wal`;
const BACKUP_SUFFIX = `.empty-test-backup-${Date.now()}`;

const ROUTES = [
  { path: "/", name: "Home" },
  { path: "/dashboard", name: "Dashboard" },
  { path: "/notebooks", name: "Notebooks" },
  { path: "/qbank", name: "Question Bank" },
  { path: "/flashcards", name: "Flashcards" },
  { path: "/flashcards/review", name: "Flashcard Review" },
  { path: "/planner", name: "Planner" },
  { path: "/analytics", name: "Analytics" },
  { path: "/import", name: "Import" },
  { path: "/exam/builder", name: "Exam Builder" },
];

function backupFileIfExists(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  const backupPath = `${filePath}${BACKUP_SUFFIX}`;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function restoreBackup(originalPath: string, backupPath: string | null) {
  if (!backupPath || !fs.existsSync(backupPath)) return;
  try {
    if (fs.existsSync(originalPath)) {
      fs.rmSync(originalPath, { force: true, maxRetries: 5, retryDelay: 100 });
    }
    fs.renameSync(backupPath, originalPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`WARN  restore skipped for ${path.basename(originalPath)}: ${message}`);
  }
}

function removeIfExists(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  try {
    fs.rmSync(filePath, { force: true, maxRetries: 5, retryDelay: 100 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`WARN  cleanup skipped for ${path.basename(filePath)}: ${message}`);
  }
}

async function ensureServerReachable(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/`, { method: "GET" });
    return response.status > 0;
  } catch {
    return false;
  }
}

async function main() {
  const baseUrl = process.env.APP_BASE_URL?.trim() || "http://localhost:3000";
  const reachable = await ensureServerReachable(baseUrl);
  if (!reachable) {
    console.error(`Dev server is not reachable at ${baseUrl}. Start it first (npm run dev).`);
    process.exit(1);
  }

  console.log("\n=== Empty State Test ===\n");
  console.log(`Database: ${DB_PATH}`);

  const dbBackup = backupFileIfExists(DB_PATH);
  const shmBackup = backupFileIfExists(DB_SHM_PATH);
  const walBackup = backupFileIfExists(DB_WAL_PATH);

  try {
    removeIfExists(DB_SHM_PATH);
    removeIfExists(DB_WAL_PATH);
    removeIfExists(DB_PATH);

    execSync("npx drizzle-kit push", {
      cwd: process.cwd(),
      stdio: "inherit",
      env: process.env,
    });

    const results: RouteResult[] = [];
    for (const route of ROUTES) {
      try {
        const response = await fetch(`${baseUrl}${route.path}`, { method: "GET" });
        if (response.status >= 500) {
          results.push({
            path: route.path,
            name: route.name,
            status: "fail",
            details: `HTTP ${response.status}`,
          });
        } else if (response.status >= 400) {
          results.push({
            path: route.path,
            name: route.name,
            status: "warn",
            details: `HTTP ${response.status}`,
          });
        } else {
          results.push({ path: route.path, name: route.name, status: "pass" });
        }
      } catch (error) {
        results.push({
          path: route.path,
          name: route.name,
          status: "fail",
          details: error instanceof Error ? error.message : "Unknown fetch error",
        });
      }
    }

    const passCount = results.filter((item) => item.status === "pass").length;
    const warnCount = results.filter((item) => item.status === "warn").length;
    const failCount = results.filter((item) => item.status === "fail").length;

    console.log("\nRoute Results:");
    for (const result of results) {
      const marker = result.status === "pass" ? "PASS" : result.status === "warn" ? "WARN" : "FAIL";
      console.log(`${marker}  ${result.name} (${result.path})${result.details ? ` - ${result.details}` : ""}`);
    }

    console.log(`\nSummary: ${passCount} passed, ${warnCount} warnings, ${failCount} failed`);
    if (failCount > 0) process.exitCode = 1;
  } finally {
    removeIfExists(DB_SHM_PATH);
    removeIfExists(DB_WAL_PATH);
    restoreBackup(DB_PATH, dbBackup);
    restoreBackup(DB_SHM_PATH, shmBackup);
    restoreBackup(DB_WAL_PATH, walBackup);
    console.log("\nOriginal database restored.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
