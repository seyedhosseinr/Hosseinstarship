/**
 * Sync engine — drains the outbox and pulls deltas.
 *
 * Triggers (see architecture §3):
 *   T0  cold start
 *   T1  window 'online' event
 *   T2  document 'visibilitychange' → visible
 *   T3  manual "Sync now" button
 *   T4  30s foreground timer
 *
 * Concurrency:
 *   - One outer tick at a time, coordinated across tabs via the
 *     `starship-sync` Web Lock (non-blocking — skip if held elsewhere).
 *   - Inside a tick, up to 3 `entityType` batches in parallel, gated by a
 *     counting semaphore.
 *   - One in-flight batch per `entityType`, enforced by a per-type
 *     in-memory lock.
 *
 * All network I/O goes through `POST /api/local-first/sync/push` and
 * `GET /api/local-first/sync/pull`. Both are idempotent by design.
 *
 * This module is completely side-effect-free on import; call
 * `startSyncEngine()` from the browser bootstrap to wire up triggers.
 */

import { isLocalFirstEnabled } from "./flag";
import { tryWebLock } from "./locks";
import {
  claimBatch,
  getPendingEntityTypes,
  gcSynced,
  markApplied,
  markConflict,
  markFatal,
  markTransientFailure,
  MAX_BATCH_SIZE,
} from "./outbox";
import type { EntityType, OutboxRow } from "./idb";
import { getMeta, setMeta } from "./idb";

const LOCK_NAME = "starship-sync";
const PARALLEL_ENTITY_TYPES = 3;
const FOREGROUND_INTERVAL_MS = 30_000;
const LAST_SYNC_META_KEY = "lastSyncAt";
const LAST_PULL_CLOCK_KEY = "lastPulledClock";

/* ── Types returned by the server ──────────────────────────── */

type ServerResultStatus = "applied" | "conflict" | "transient" | "fatal";

interface ServerRowResult {
  mutationId: string;
  status: ServerResultStatus;
  serverId?: string | null;
  serverVersion?: number;
  error?: string;
}

interface ServerPushResponse {
  results: ServerRowResult[];
}

interface ServerPullResponse {
  clock: string | null;
  // Opaque entity patches applied server-side. The sync engine forwards
  // these to entity-specific `mergePull` functions during Phase 3/4 wiring.
  entities?: Record<string, unknown>;
}

/* ── Per-entityType lock + listener plumbing ───────────────── */

const entityInFlight = new Set<EntityType>();
type Listener = (state: SyncEngineState) => void;
const listeners = new Set<Listener>();

export interface SyncEngineState {
  running: boolean;
  lastTickAt: string | null;
  lastError: string | null;
  lastSyncAt: string | null;
}

const state: SyncEngineState = {
  running: false,
  lastTickAt: null,
  lastError: null,
  lastSyncAt: null,
};

function emit() {
  for (const l of listeners) {
    try {
      l({ ...state });
    } catch {
      /* swallow listener errors */
    }
  }
}

export function subscribeSyncEngine(l: Listener): () => void {
  listeners.add(l);
  l({ ...state });
  return () => listeners.delete(l);
}

export function getSyncEngineState(): SyncEngineState {
  return { ...state };
}

/* ── HTTP ───────────────────────────────────────────────────── */

async function pushBatch(batch: OutboxRow[]): Promise<ServerPushResponse> {
  const res = await fetch("/api/local-first/sync/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ batch }),
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`push ${res.status}`);
  }
  return (await res.json()) as ServerPushResponse;
}

async function pullDelta(sinceClock: string | null): Promise<ServerPullResponse> {
  const url = new URL("/api/local-first/sync/pull", window.location.origin);
  if (sinceClock) url.searchParams.set("since", sinceClock);
  const res = await fetch(url.toString(), {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`pull ${res.status}`);
  return (await res.json()) as ServerPullResponse;
}

/* ── Per-type batch processing ─────────────────────────────── */

async function processEntityType(entityType: EntityType): Promise<void> {
  if (entityInFlight.has(entityType)) return;
  entityInFlight.add(entityType);
  try {
    const batch = await claimBatch(entityType, MAX_BATCH_SIZE);
    if (batch.length === 0) return;

    let response: ServerPushResponse;
    try {
      response = await pushBatch(batch);
    } catch (err) {
      // Transient network failure — bounce every row back to pending.
      const msg = err instanceof Error ? err.message : String(err);
      for (const row of batch) {
        await markTransientFailure(row.mutationId, msg);
      }
      return;
    }

    const byId = new Map(response.results.map((r) => [r.mutationId, r]));
    for (const row of batch) {
      const r = byId.get(row.mutationId);
      if (!r) {
        // Server didn't mention this row — treat as transient.
        await markTransientFailure(row.mutationId, "missing from server response");
        continue;
      }
      switch (r.status) {
        case "applied":
          await markApplied({
            mutationId: r.mutationId,
            serverId: r.serverId ?? null,
          });
          break;
        case "conflict":
          await markConflict(r.mutationId, r.error ?? "conflict");
          break;
        case "transient":
          await markTransientFailure(r.mutationId, r.error ?? "transient");
          break;
        case "fatal":
          await markFatal(r.mutationId, r.error ?? "fatal");
          break;
      }
    }
  } finally {
    entityInFlight.delete(entityType);
  }
}

/* ── Semaphore ─────────────────────────────────────────────── */

async function runParallel<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let idx = 0;
  const workers: Promise<void>[] = [];
  const width = Math.min(limit, items.length);
  for (let w = 0; w < width; w++) {
    workers.push(
      (async () => {
        while (idx < items.length) {
          const i = idx++;
          await fn(items[i]);
        }
      })(),
    );
  }
  await Promise.all(workers);
}

/* ── Main tick ─────────────────────────────────────────────── */

async function runTickInner(): Promise<void> {
  state.running = true;
  state.lastTickAt = new Date().toISOString();
  state.lastError = null;
  emit();

  try {
    const types = await getPendingEntityTypes();
    if (types.length > 0) {
      await runParallel(types, PARALLEL_ENTITY_TYPES, processEntityType);
    }

    // Pull delta (best-effort — a pull failure should not block the next tick).
    try {
      const since = await getMeta<string>(LAST_PULL_CLOCK_KEY);
      const resp = await pullDelta(since);
      if (resp.clock) await setMeta(LAST_PULL_CLOCK_KEY, resp.clock);
      // NOTE: entity-side merge is wired in Phase 3/4.
    } catch (err) {
      // Non-fatal — just record.
      state.lastError = err instanceof Error ? err.message : String(err);
    }

    // GC synced rows that no one depends on anymore.
    try {
      await gcSynced();
    } catch {
      /* ignore */
    }

    state.lastSyncAt = new Date().toISOString();
    await setMeta(LAST_SYNC_META_KEY, state.lastSyncAt);
  } catch (err) {
    state.lastError = err instanceof Error ? err.message : String(err);
  } finally {
    state.running = false;
    emit();
  }
}

/**
 * Public: try to run one tick. No-ops if:
 *   - local-first is disabled,
 *   - the page is offline (read fails gracefully inside),
 *   - the Web Lock is held by another tab.
 */
export async function triggerSync(reason: string): Promise<void> {
  if (!isLocalFirstEnabled()) return;
  if (typeof window === "undefined") return;
  void reason; // reserved for future telemetry
  await tryWebLock(LOCK_NAME, runTickInner);
}

/* ── Triggers ──────────────────────────────────────────────── */

let started = false;
let timerId: ReturnType<typeof setInterval> | null = null;
let onOnline: (() => void) | null = null;
let onVisible: (() => void) | null = null;

export function startSyncEngine(): void {
  if (started) return;
  if (!isLocalFirstEnabled()) return;
  if (typeof window === "undefined") return;
  started = true;

  // T0: cold start
  void triggerSync("cold-start");

  // T1: online event
  onOnline = () => {
    void triggerSync("online");
  };
  window.addEventListener("online", onOnline);

  // T2: visibilitychange → visible
  onVisible = () => {
    if (document.visibilityState === "visible") {
      void triggerSync("visible");
    }
  };
  document.addEventListener("visibilitychange", onVisible);

  // T4: 30s foreground timer (only while visible).
  timerId = setInterval(() => {
    if (document.visibilityState === "visible") {
      void triggerSync("timer");
    }
  }, FOREGROUND_INTERVAL_MS);
}

export function stopSyncEngine(): void {
  if (!started) return;
  started = false;
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
  if (onOnline) window.removeEventListener("online", onOnline);
  if (onVisible) document.removeEventListener("visibilitychange", onVisible);
  onOnline = null;
  onVisible = null;
}

/* ── T3: manual "Sync now" ─────────────────────────────────── */

export async function triggerSyncNow(): Promise<void> {
  await triggerSync("manual");
}
