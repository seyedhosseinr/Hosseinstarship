import { getDatabaseConfig, getDatabaseRuntime, type DatabaseRuntime } from "./config";
import { createPostgresDb, type PostgresDrizzleInstance } from "./postgres";
import { bootstrapPGliteDb, createPGliteDb, type PGliteDrizzleInstance } from "./pglite";

export const databaseConfig = getDatabaseConfig();

export type AppDrizzleInstance = PostgresDrizzleInstance | PGliteDrizzleInstance;
let dbReadyPromise: Promise<AppDrizzleInstance> | null = null;

export function getDbRuntime(): DatabaseRuntime {
  return getDatabaseRuntime();
}

export async function getDb(): Promise<AppDrizzleInstance> {
  if (!dbReadyPromise) {
    dbReadyPromise = (async () => {
      if (databaseConfig.runtime === "postgres") {
        const pgDb = createPostgresDb();
        if (pgDb) return pgDb;

        // DB_RUNTIME=postgres was explicit — missing/invalid DATABASE_URL is always
        // an error, not a reason to silently fall back to PGlite.
        const hint = databaseConfig.isVercel
          ? "Vercel deployments require DATABASE_URL to be set in the project environment variables."
          : "Set DATABASE_URL=postgres://... in .env.production.local (or pass it inline).";
        throw new Error(`DB_RUNTIME=postgres but DATABASE_URL is missing or not a valid postgres:// URL. ${hint}`);
      }

      if (databaseConfig.isVercel) {
        throw new Error(
          "PGlite cannot run on Vercel. Set DB_RUNTIME=postgres and provide DATABASE_URL.",
        );
      }

      await bootstrapPGliteDb();
      return createPGliteDb();
    })().catch((err) => {
      // Reset so the next request can retry rather than serving a cached failure.
      dbReadyPromise = null;
      throw err;
    });
  }

  return dbReadyPromise;
}

export async function resetDbForTests() {
  dbReadyPromise = null;
}
