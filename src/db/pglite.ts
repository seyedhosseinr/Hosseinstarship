import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { getPGliteLocation } from "./config";
import * as schema from "./schema";
import { autoSeedIfEmpty } from "./auto-seed";

type PGliteClient = PGlite;
type PGliteDb = ReturnType<typeof drizzle<typeof schema>>;

type PGliteGlobals = {
  pgliteClient?: PGliteClient;
  pgliteDb?: PGliteDb;
  pgliteBootstrapPromise?: Promise<void> | null;
  pgliteLocation?: string;
  /** Compiled WASM module cached across hot reloads to avoid repeated I/O. */
  wasmModule?: WebAssembly.Module;
  /** PGlite filesystem bundle cached across hot reloads. */
  fsBundle?: Blob;
};

type MigrationMeta = {
  sql: string[];
  folderMillis: number;
  hash: string;
};

type MigrationJournal = {
  entries: Array<{
    when: number;
    tag: string;
  }>;
};

const PGLITE_MIGRATIONS_TABLE = "__drizzle_migrations";

const globalForPGlite = globalThis as typeof globalThis & {
  __uroPGlite?: PGliteGlobals;
};

function getPGliteGlobals(): PGliteGlobals {
  if (!globalForPGlite.__uroPGlite) {
    globalForPGlite.__uroPGlite = {};
  }

  return globalForPGlite.__uroPGlite;
}

function ensureFilesystemLocation(location: string) {
  if (location.startsWith("idb://") || location.startsWith("memory://")) return;
  // Use top-level ESM imports (node:fs / node:path) — no eval("require") needed
  mkdirSync(dirname(location), { recursive: true });
  mkdirSync(location, { recursive: true });
}

function clearStalePGlitePidFile(location: string) {
  if (location.startsWith("idb://") || location.startsWith("memory://")) return;
  if (!existsSync(location)) return;

  const pidFile = join(location, "postmaster.pid");
  if (!existsSync(pidFile)) return;

  try {
    unlinkSync(pidFile);
    console.warn(
      `Removed stale PGlite postmaster.pid at ${pidFile}; preserving data dir ${location}.`,
    );
    return;
  } catch {
    // Fall back to the old quarantine path only if the stale pid file cannot be
    // removed. Preserving the data directory is the normal path; wholesale
    // quarantine loses planner progress after seed/dev restarts.
  }

  const backupLocation = `${location}-unclean-${Date.now()}`;

  try {
    renameSync(location, backupLocation);
  } catch {
    rmSync(location, { recursive: true, force: true });
  }

  mkdirSync(location, { recursive: true });
  console.warn(
    `Reset stale PGlite data dir at ${location} after failing to remove postmaster.pid.` +
      ` Previous files were moved to ${backupLocation}.`,
  );
}

/**
 * Explicitly loads pglite.wasm and pglite.data from the package's dist folder
 * and caches the compiled WebAssembly.Module + Blob on `globals`.
 *
 * WHY: Next.js 15 Turbopack rewrites `__filename` inside the @electric-sql/pglite
 * CJS bundle to a `.next/` chunk path even when the package is listed in
 * `serverExternalPackages`. PGlite uses `__filename` to locate its WASM
 * companion files, so it throws ErrnoError { errno: 44 } (ENOENT) at startup.
 *
 * Passing `wasmModule` + `fsBundle` directly to the constructor bypasses that
 * `__filename`-based resolution entirely. We use `process.cwd()` to build the
 * path because it always points to the project root in both dev and production.
 */
async function ensurePGliteWasmCached(globals: PGliteGlobals): Promise<void> {
  if (globals.wasmModule && globals.fsBundle) return;

  const distDir = join(
    process.cwd(),
    "node_modules/@electric-sql/pglite/dist",
  );

  const wasmBytes = readFileSync(join(distDir, "pglite.wasm"));
  const dataBytes = readFileSync(join(distDir, "pglite.data"));

  globals.wasmModule = await WebAssembly.compile(wasmBytes);
  globals.fsBundle = new Blob([dataBytes]);
}

function stripBom(value: string) {
  return value.replace(/^\uFEFF/, "");
}

function readMigrationFiles(migrationsFolder: string): MigrationMeta[] {
  const journalPath = join(migrationsFolder, "meta", "_journal.json");

  if (!existsSync(journalPath)) {
    throw new Error(`Can't find migration journal at ${journalPath}`);
  }

  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as MigrationJournal;

  return journal.entries.map((entry) => {
    const migrationPath = join(migrationsFolder, `${entry.tag}.sql`);

    if (!existsSync(migrationPath)) {
      throw new Error(`Can't find migration file at ${migrationPath}`);
    }

    const rawSql = stripBom(readFileSync(migrationPath, "utf8"));

    return {
      sql: rawSql
        .split("--> statement-breakpoint")
        .map((statement) => stripBom(statement).trim())
        .filter((statement) => statement.length > 0),
      folderMillis: entry.when,
      hash: createHash("sha256").update(rawSql).digest("hex"),
    };
  });
}

async function migratePGlite(client: PGliteClient, migrationsFolder: string) {
  const migrations = readMigrationFiles(migrationsFolder);

  await client.query(`
    CREATE TABLE IF NOT EXISTS "${PGLITE_MIGRATIONS_TABLE}" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  const lastMigrationResult = await client.query<{
    created_at: string | number | null;
  }>(
    `SELECT created_at
     FROM "${PGLITE_MIGRATIONS_TABLE}"
     ORDER BY created_at DESC
     LIMIT 1`,
  );

  const lastAppliedAtRaw = lastMigrationResult.rows[0]?.created_at;
  const lastAppliedAt =
    lastAppliedAtRaw == null ? null : Number(lastAppliedAtRaw);

  await client.transaction(async (tx) => {
    for (const migration of migrations) {
      if (lastAppliedAt != null && lastAppliedAt >= migration.folderMillis) {
        continue;
      }

      for (const statement of migration.sql) {
        await tx.query(statement);
      }

      await tx.query(
        `INSERT INTO "${PGLITE_MIGRATIONS_TABLE}" ("hash", "created_at")
         VALUES ($1, $2)`,
        [migration.hash, migration.folderMillis],
      );
    }
  });
}

export function createPGliteDb() {
  const globals = getPGliteGlobals();
  const location = getPGliteLocation();

  if (!globals.pgliteDb) {
    clearStalePGlitePidFile(location);
    ensureFilesystemLocation(location);

    if (!globals.pgliteClient) {
      // When wasmModule + fsBundle are pre-loaded (see ensurePGliteWasmCached),
      // pass them explicitly so PGlite skips its __filename-based WASM lookup.
      // This is required under Next.js 15 Turbopack where __filename inside the
      // PGlite CJS bundle resolves to a .next/ chunk path instead of the real
      // node_modules location (errno 44 = ENOENT without this workaround).
      globals.pgliteClient =
        globals.wasmModule && globals.fsBundle
          ? new PGlite({
              dataDir: location,
              pgliteWasmModule: globals.wasmModule,
              fsBundle: globals.fsBundle,
            })
          : new PGlite(location);
      globals.pgliteLocation = location;
    }

    globals.pgliteDb = drizzle({
      client: globals.pgliteClient,
      schema,
    });
  }

  return globals.pgliteDb;
}

export async function bootstrapPGliteDb() {
  const globals = getPGliteGlobals();

  if (!globals.pgliteBootstrapPromise) {
    // Pre-load WASM + data files before the synchronous PGlite constructor runs.
    // This must happen first — createPGliteDb() is sync and reads these globals.
    await ensurePGliteWasmCached(globals);
    createPGliteDb();

    if (!globals.pgliteClient) {
      throw new Error("PGlite client was not initialized.");
    }

    globals.pgliteBootstrapPromise = migratePGlite(
      globals.pgliteClient,
      join(process.cwd(), "drizzle"),
    ).then(() => autoSeedIfEmpty(createPGliteDb()))
    .catch((error) => {
      // Allow a clean retry after transient dev-time bootstrap races.
      globals.pgliteBootstrapPromise = null;
      throw error;
    });
  }

  await globals.pgliteBootstrapPromise;
}

export type PGliteDrizzleInstance = ReturnType<typeof createPGliteDb>;

export async function checkPGliteConnection() {
  await bootstrapPGliteDb();
  const db = createPGliteDb();
  const result = await db.execute("select 1 as connected");
  return result;
}
