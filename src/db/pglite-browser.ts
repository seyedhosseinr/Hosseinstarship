/**
 * pglite-browser.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * BROWSER-ONLY. Never import this file in:
 *   • Next.js Server Components   → use src/db/index.ts (Postgres or Node PGlite)
 *   • API Routes                  → use src/db/index.ts
 *   • Scripts / seed files        → use src/db/index.ts
 *
 * This module is the single browser-side entry point for the Drizzle ORM
 * instance backed by the OPFS-persisted PGlite worker.
 *
 * WASM LOADING STRATEGY
 * ─────────────────────
 * Turbopack/webpack load the OPFS Worker from a blob: URL. Inside that worker,
 * PGlite's internal `new URL('./pglite.wasm', import.meta.url)` resolves to a
 * relative path that cannot be fetched from a blob-origin context.
 *
 * Fix: we pre-fetch and compile pglite.wasm / initdb.wasm / pglite.data on
 * the MAIN thread (which has a real origin), then pass the compiled
 * WebAssembly.Module objects and the data Blob to the worker via PGliteWorker's
 * `meta` option. These are structured-cloneable and transfer zero-copy.
 * PGlite then skips its internal fetch() entirely.
 *
 * MULTI-TAB SAFETY CONTRACT
 * ──────────────────────────
 * Each browser tab creates exactly one PGliteWorker. Internally PGliteWorker
 * uses a BroadcastChannel ("pglite-leader-<dbName>") for leader election:
 *   • The first tab's worker wins the election and opens the OPFS file.
 *   • Subsequent tabs' workers detect a leader and route all SQL through the
 *     BroadcastChannel to the leader, acting as transparent proxies.
 *   • If the leader tab is closed, a new election runs within ~100 ms and
 *     the next tab's worker acquires the OPFS lock.
 *
 * @electric-sql/pglite version: ^0.4.2
 * drizzle-orm version: ^0.45.1
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { LeaderChangedError, PGliteWorker } from "@electric-sql/pglite/worker";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema";

// ── Types ─────────────────────────────────────────────────────────────────────

/** The fully-typed Drizzle instance for browser-side queries. */
export type BrowserDb = ReturnType<typeof drizzle<typeof schema>>;
export type BrowserPgClient = PGliteWorker;
type BrowserDbBundle = { db: BrowserDb; pg: BrowserPgClient };

type PGliteAssets = {
  wasmModule: WebAssembly.Module;
  initdbWasmModule: WebAssembly.Module;
  fsBundle: Blob;
};

type BrowserPGliteGlobals = {
  instance?: BrowserDbBundle | null;
  initPromise?: Promise<BrowserDbBundle> | null;
  migrationPromise?: Promise<void> | null;
  assetsPromise?: Promise<PGliteAssets> | null;
};

const globalForBrowserPGlite = globalThis as typeof globalThis & {
  __uroBrowserPGlite?: BrowserPGliteGlobals;
};

function getBrowserPGliteGlobals(): BrowserPGliteGlobals {
  if (!globalForBrowserPGlite.__uroBrowserPGlite) {
    globalForBrowserPGlite.__uroBrowserPGlite = {};
  }
  return globalForBrowserPGlite.__uroBrowserPGlite;
}

function resetBrowserDbState() {
  const globals = getBrowserPGliteGlobals();
  globals.instance = null;
  globals.initPromise = null;
  // Keep assetsPromise cached — WASM modules are idempotent & expensive to recompile.
}

function isLeaderChangeError(err: unknown): boolean {
  return err instanceof LeaderChangedError
    || (err instanceof Error
      && err.message === "Leader changed, pending operation in indeterminate state");
}

async function withLeaderChangeRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 1,
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (err) {
      if (!isLeaderChangeError(err) || attempt >= maxRetries) {
        throw err;
      }
      attempt += 1;
      resetBrowserDbState();
      await new Promise((resolve) => setTimeout(resolve, attempt * 50));
    }
  }
}

// ── WASM Asset Loader ────────────────────────────────────────────────────────

function loadPGliteAssets(): Promise<PGliteAssets> {
  const globals = getBrowserPGliteGlobals();
  if (globals.assetsPromise) return globals.assetsPromise;

  globals.assetsPromise = Promise.all([
    WebAssembly.compileStreaming(fetch("/pglite/pglite.wasm")),
    WebAssembly.compileStreaming(fetch("/pglite/initdb.wasm")),
    fetch("/pglite/pglite.data").then((r) => {
      if (!r.ok) {
        throw new Error(
          `[pglite-browser] Failed to load /pglite/pglite.data (status ${r.status}). `
          + "Run: node scripts/copy-pglite-assets.mjs"
        );
      }
      return r.blob();
    }),
  ]).then(([wasmModule, initdbWasmModule, fsBundle]) => ({
    wasmModule, initdbWasmModule, fsBundle,
  })).catch((err) => {
    globals.assetsPromise = null;
    throw err;
  });

  return globals.assetsPromise;
}

// ── Singleton ─────────────────────────────────────────────────────────────────

async function createBrowserInstance(): Promise<BrowserDbBundle> {
  const assets = await loadPGliteAssets();

  const pg = new PGliteWorker(
    new Worker(
      new URL("./pglite-opfs.worker.ts", import.meta.url),
      { type: "module", name: "uro-pglite-opfs-v3" },
    ),
    {
      meta: {
        wasmModule: assets.wasmModule,
        initdbWasmModule: assets.initdbWasmModule,
        fsBundle: assets.fsBundle,
      },
    } as unknown as ConstructorParameters<typeof PGliteWorker>[1],
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = drizzle(pg as any, { schema });
  await pg.waitReady;
  return { db, pg };
}

/**
 * Returns the module-singleton Drizzle + PGliteWorker pair.
 *
 * Usage:
 *   const { db } = await getBrowserDb();
 *   const cards = await db.select().from(schema.flashcards).limit(50);
 */
export async function getBrowserDb(): Promise<{ db: BrowserDb; pg: BrowserPgClient }> {
  const globals = getBrowserPGliteGlobals();

  if (globals.instance && !globals.instance.pg.closed) {
    return globals.instance;
  }

  if (!globals.initPromise) {
    globals.initPromise = createBrowserInstance()
      .then((bundle) => {
        globals.instance = bundle;
        return bundle;
      })
      .catch((err) => {
        resetBrowserDbState();
        throw err;
      });
  }

  const bundle = await globals.initPromise;
  if (bundle.pg.closed) {
    resetBrowserDbState();
    return getBrowserDb();
  }

  return bundle;
}

// ── Migration helper ──────────────────────────────────────────────────────────

const MIGRATIONS_TABLE = "__drizzle_migrations";

export type BundledMigration = {
  idx: number;
  tag: string;
  when: number;
  hash: string;
  statements: string[];
};

/**
 * runBrowserMigrations()
 * ──────────────────────
 * Applies pending Drizzle migrations against the OPFS database in the browser.
 * Uses the same `__drizzle_migrations` tracking table as the server-side
 * migrator so that migration state is stored in the database itself (not
 * localStorage, which can be cleared independently).
 *
 * Call this once during app startup before any data access.
 */
export async function runBrowserMigrations(
  migrations: BundledMigration[],
): Promise<void> {
  const globals = getBrowserPGliteGlobals();
  if (!globals.migrationPromise) {
    globals.migrationPromise = withLeaderChangeRetry(async () => {
      const { pg } = await getBrowserDb();

      // Ensure the tracking table exists
      await pg.exec(`
        CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (
          id SERIAL PRIMARY KEY,
          hash text NOT NULL,
          created_at bigint
        )
      `);

      // Find the last applied migration timestamp
      const result = await pg.query<{ created_at: string | number | null }>(
        `SELECT created_at FROM "${MIGRATIONS_TABLE}" ORDER BY created_at DESC LIMIT 1`,
      );
      const lastAppliedAt =
        result.rows[0]?.created_at == null
          ? null
          : Number(result.rows[0].created_at);

      // Apply pending migrations inside a single transaction
      await pg.transaction(async (tx) => {
        for (const migration of migrations) {
          if (lastAppliedAt != null && lastAppliedAt >= migration.when) {
            continue;
          }

          for (const statement of migration.statements) {
            await tx.exec(statement);
          }

          await tx.query(
            `INSERT INTO "${MIGRATIONS_TABLE}" ("hash", "created_at") VALUES ($1, $2)`,
            [migration.hash, migration.when],
          );
        }
      });
    }).finally(() => {
      getBrowserPGliteGlobals().migrationPromise = null;
    });
  }

  return globals.migrationPromise;
}

// ── CRDT helpers ──────────────────────────────────────────────────────────────

/**
 * getOrCreateOriginId()
 * ──────────────────────
 * Returns the stable client identifier stored in localStorage.
 * This is the `originId` field written into every CRDT row created locally.
 *
 * WHY localStorage and not a UUID generated at runtime?
 * The originId must survive page refreshes (it's a persistent node identity).
 * It must NOT survive a localStorage.clear() because that effectively resets
 * the client to an "unknown node" — which is correct behaviour (the server
 * will treat subsequent writes as a new origin and LWW will resolve normally).
 */
export function getOrCreateOriginId(): string {
  const key = "uro_crdt_origin_id";
  let id = localStorage.getItem(key);
  if (!id) {
    // crypto.randomUUID() is available in all modern browsers (Chrome 92+,
    // Firefox 95+, Safari 15.4+) and is cryptographically random.
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

/**
 * nextLogicalClock()
 * ───────────────────
 * Returns a monotonically increasing Lamport timestamp for the current write.
 * Persisted in localStorage so it survives page refreshes within a session.
 *
 * Formula: max(localClock, remoteClock) + 1
 * Pass `remoteClock` when merging a row received from the server sync endpoint.
 */
export function nextLogicalClock(remoteClock = 0): number {
  const key = "uro_crdt_logical_clock";
  const local = Number(localStorage.getItem(key) ?? "0");
  const next = Math.max(local, remoteClock) + 1;
  localStorage.setItem(key, String(next));
  return next;
}
