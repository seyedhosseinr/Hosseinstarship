import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

let pgDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Server-side Postgres connection. Uses the standard node-postgres driver.
 * Works with ANY postgres server (self-hosted, managed, docker, etc.) —
 * no vendor-specific code.
 *
 * Returns null if DATABASE_URL is not configured. Callers must handle this
 * and skip sync gracefully.
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
        connectionTimeoutMillis: 5000,
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
