import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

function getIssues() {
  const issues = [];
  const runtime = (process.env.DB_RUNTIME || "").trim().toLowerCase();
  const pgliteLocation = (process.env.PGLITE_DATA_DIR || process.env.PGLITE_DB_PATH || "").trim();
  const isVercel = process.env.VERCEL === "1";

  if (isVercel) {
    issues.push({
      level: "error",
      message: "Local offline check must not run in a Vercel deployment environment.",
    });
  }

  if (runtime !== "pglite") {
    issues.push({
      level: "error",
      message: "Local offline runtime must use DB_RUNTIME=pglite.",
    });
  }

  if (!pgliteLocation) {
    issues.push({
      level: "warning",
      message: "PGLITE_DATA_DIR is not set. The app will fall back to its default local storage path.",
    });
  }

  return issues;
}

function main() {
  const issues = getIssues();
  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");

  console.log("===========================================================");
  console.log("                 LOCAL RUNTIME CHECK                       ");
  console.log("===========================================================");
  console.log("");

  const pgliteLocation = process.env.PGLITE_DATA_DIR?.trim() || process.env.PGLITE_DB_PATH?.trim();
  if (pgliteLocation) {
    console.log(`PGlite location: ${pgliteLocation}`);
    console.log("");
  }

  if (issues.length === 0) {
    console.log("No local runtime configuration issues detected.");
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
