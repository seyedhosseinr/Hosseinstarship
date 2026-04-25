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

        if (databaseConfig.isVercel) {
          throw new Error(
            "DATABASE_URL is missing or invalid. " +
              "Vercel deployments require a working Postgres connection.",
          );
        }
        // Local dev: DATABASE_URL not configured — fall through to PGlite
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
