import { join, isAbsolute } from "node:path";

export type DatabaseRuntime = "postgres" | "pglite";

export type DatabaseConfig = {
  runtime: DatabaseRuntime;
  postgresUrl: string | null;
  pgliteLocation: string | null;
  isVercel: boolean;
};

function looksLikePostgresUrl(value: string): boolean {
  return /^postgres(ql)?:\/\//i.test(value);
}

export function getDatabaseRuntime(): DatabaseRuntime {
  const runtime = process.env.DB_RUNTIME?.trim().toLowerCase();

  if (runtime === "postgres" || runtime === "pglite") {
    return runtime;
  }

  // No explicit DB_RUNTIME â€” default based on environment
  return process.env.VERCEL === "1" ? "postgres" : "pglite";
}

export function getPostgresUrl(): string | null {
  const postgresUrl = process.env.DATABASE_URL?.trim() || "";
  if (!looksLikePostgresUrl(postgresUrl)) {
    return null;
  }
  return postgresUrl;
}

export function getPGliteLocation(): string {
  const configured = process.env.PGLITE_DATA_DIR?.trim() || process.env.PGLITE_DB_PATH?.trim() || ".pglite/starship";
  // Ensure absolute path â€” Turbopack resolves relative strings as URL objects
  if (configured.startsWith("idb://") || configured.startsWith("memory://") || isAbsolute(configured)) {
    return configured;
  }
  return join(process.cwd(), configured);
}

export function getDatabaseConfig(): DatabaseConfig {
  const runtime = getDatabaseRuntime();

  return {
    runtime,
    postgresUrl: runtime === "postgres" ? getPostgresUrl() : null,
    pgliteLocation: runtime === "pglite" ? getPGliteLocation() : null,
    isVercel: process.env.VERCEL === "1",
  };
}

export function isPostgresRuntime(): boolean {
  return getDatabaseRuntime() === "postgres";
}

export function isPGliteRuntime(): boolean {
  return getDatabaseRuntime() === "pglite";
}
