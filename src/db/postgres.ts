import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

let pgDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Read a positive integer from env with a fallback. Used for pool tuning so
 * scripts (e.g. seed-abu-2026.ts) can widen timeouts without affecting the
 * normal app runtime defaults.
 */
function envInt(name: string, fallback: number): number {
  const v = process.env[name]?.trim();
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Server-side Postgres connection. Uses the standard node-postgres driver.
 * Works with ANY postgres server (self-hosted, managed, docker, etc.) —
 * no vendor-specific code.
 *
 * Returns null if DATABASE_URL is not configured. Callers must handle this
 * and skip sync gracefully.
 *
 * Tunable via env (defaults preserve previous app-runtime behavior):
 *   PG_CONNECTION_TIMEOUT_MS  (default 5000) — tighten for app, widen for seeds
 *   PG_IDLE_TIMEOUT_MS        (default 30000)
 *   PG_POOL_MAX               (default 10)   — set to 1-2 for one-off scripts
 */
export function createPostgresDb() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url || !/^postgres(ql)?:\/\//i.test(url)) {
    return null;
  }
  if (!pgDb) {
    pgDb = drizzle({
      client: new Pool({
        connectionString: url,
        connectionTimeoutMillis: envInt("PG_CONNECTION_TIMEOUT_MS", 5000),
        idleTimeoutMillis: envInt("PG_IDLE_TIMEOUT_MS", 30000),
        max: envInt("PG_POOL_MAX", 10),
        keepAlive: true,
        ssl: process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
      }),
      schema,
    });
  }
  return pgDb;
}

export type PostgresDrizzleInstance = NonNullable<ReturnType<typeof createPostgresDb>>;
