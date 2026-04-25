import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

function normalizeUrl(value) {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function getIssues() {
  const issues = [];
  const dbRuntime = (process.env.DB_RUNTIME || "").trim().toLowerCase();
  const databaseUrl = (process.env.DATABASE_URL || "").trim();
  const pgliteDataDir = (process.env.PGLITE_DATA_DIR || process.env.PGLITE_DB_PATH || "").trim();
  const isVercel = process.env.VERCEL === "1";
  const expectsHostedUrl = isVercel || dbRuntime === "postgres";

  if (dbRuntime !== "postgres" && dbRuntime !== "pglite") {
    issues.push({
      level: "error",
      message: "DB_RUNTIME must be explicitly set to 'postgres' or 'pglite'.",
    });
  }

  if (isVercel && dbRuntime !== "postgres") {
    issues.push({
      level: "error",
      message: "Vercel deployment must use DB_RUNTIME=postgres.",
    });
  }

  if (dbRuntime === "postgres" && !/^postgres(ql)?:\/\//i.test(databaseUrl)) {
    issues.push({
      level: "error",
      message: "DB_RUNTIME=postgres requires DATABASE_URL to be a valid postgres URL.",
    });
  }

  if (dbRuntime === "pglite" && !pgliteDataDir) {
    issues.push({
      level: "warning",
      message: "DB_RUNTIME=pglite is set without PGLITE_DATA_DIR. The app will use its default local data directory.",
    });
  }

  if (!process.env.NEXT_PUBLIC_APP_URL && !process.env.VERCEL_URL && expectsHostedUrl) {
    issues.push({
      level: "warning",
      message: "NEXT_PUBLIC_APP_URL is not set. metadataBase and absolute URLs will fall back to localhost outside Vercel.",
    });
  }

  return issues;
}

function main() {
  const issues = getIssues();
  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");

  console.log("===========================================================");
  console.log("                 VERCEL READINESS CHECK                    ");
  console.log("===========================================================");
  console.log("");

  const publicUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (publicUrl) {
    console.log(`Public URL: ${normalizeUrl(publicUrl)}`);
    console.log("");
  }

  if (issues.length === 0) {
    console.log("No deployment configuration issues detected.");
    return;
  }

  for (const issue of issues) {
    const prefix = issue.level === "error" ? "ERROR" : "WARN";
    console.log(`[${prefix}] ${issue.message}`);
  }

  console.log("");
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Errors: ${errors.length}`);

  if (errors.length > 0) {
    process.exit(1);
  }
}

main();
