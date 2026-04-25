import { getDatabaseConfig } from "@/db/config";

export type DeploymentIssue = {
  level: "warning" | "error";
  message: string;
};

const databaseConfig = getDatabaseConfig();

function normalizeUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

export function getAppBaseUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    return new URL(normalizeUrl(explicit));
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return new URL(`https://${vercelUrl}`);
  }

  return new URL("http://localhost:3000");
}

export function isVercelDeployment(): boolean {
  return process.env.VERCEL === "1";
}

export function getDeploymentIssues(): DeploymentIssue[] {
  const issues: DeploymentIssue[] = [];
  const expectsHostedUrl = isVercelDeployment() || databaseConfig.runtime === "postgres";

  if (isVercelDeployment() && databaseConfig.runtime !== "postgres") {
    issues.push({
      level: "error",
      message: "Vercel hosted runtime must use DB_RUNTIME=postgres.",
    });
  }

  if (databaseConfig.runtime === "postgres" && !databaseConfig.postgresUrl) {
    issues.push({
      level: "error",
      message: "DATABASE_URL is missing. Postgres runtime requires a valid Postgres connection string.",
    });
  }

  if (databaseConfig.runtime === "pglite" && !databaseConfig.pgliteLocation) {
    issues.push({
      level: "error",
      message: "PGLITE_DATA_DIR is missing. Local offline runtime requires a persistent PGlite location.",
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
