/**
 * Outbox — the durable queue of pending mutations.
 *
 * Every write in the local-first layer MUST:
 *   1) commit to the local store (Dexie / PGlite mirror) synchronously,
 *   2) enqueue an OutboxRow via `enqueueMutation()`.
 *
 * The sync engine then drains the outbox in the background via
 * `claimBatch()` / `markApplied()` / `markTransientFailure()` / etc.
 *
 * State machine (see architecture §2):
 *
 *   [*] → pending → in_flight → synced → [*]
 *                  ↘ conflict ↘ pending
 *                  ↘ failed    ↘ pending (manual)
 *                  ↘ pending   (transient, backoff)
 *
 * Invariants:
 *  - Nothing is ever removed before `synced`, except via `discardMutation()`.
 *  - A mutation cannot leave `pending` until every entry in `dependsOn`
 *    resolves (is `synced`, or explicitly discarded).
 *  - `attemptCount` only increments on `in_flight → pending`.
 *  - Backoff: 1, 2, 4, 8, 16, 30s (capped).
 */

import type {
  EntityType,
  OutboxOperation,
  OutboxRow,
  OutboxStatus,
} from "./idb";
import { getLocalDb } from "./idb";
import { uuidV4 } from "./uuid";

const BACKOFF_SECONDS = [1, 2, 4, 8, 16, 30] as const;
export const MAX_ATTEMPTS = 7;
export const MAX_BATCH_SIZE = 50;

function nowIso(): string {
  return new Date().toISOString();
}

function backoffMs(attemptCount: number): number {
  const idx = Math.min(attemptCount, BACKOFF_SECONDS.length - 1);
  return BACKOFF_SECONDS[idx] * 1000;
}

/* ── Enqueue ───────────────────────────────────────────────── */

export interface EnqueueInput {
  entityType: EntityType;
  entityLocalId: string;
  entityServerId?: string | null;
  operation: OutboxOperation;
  payload: unknown;
  baseVersion?: number | null;
  dependsOn?: string[];
}

export async function enqueueMutation(input: EnqueueInput): Promise<string> {
  const mutationId = uuidV4();
  const now = nowIso();
  const row: OutboxRow = {
    mutationId,
    entityType: input.entityType,
    entityLocalId: input.entityLocalId,
    entityServerId: input.entityServerId ?? null,
    operation: input.operation,
    payload: input.payload,
    baseVersion: input.baseVersion ?? null,
    localCreatedAt: now,
    localUpdatedAt: now,
    syncStatus: "pending",
    attemptCount: 0,
    lastAttemptAt: null,
    nextAttemptAt: now,
    lastError: null,
    dependsOn: input.dependsOn ?? [],
  };
  await getLocalDb().outbox.put(row);
  return mutationId;
}

/* ── Query ─────────────────────────────────────────────────── */

export async function getMutation(mutationId: string): Promise<OutboxRow | null> {
  return (await getLocalDb().outbox.get(mutationId)) ?? null;
}

export async function countByStatus(status: OutboxStatus): Promise<number> {
  return getLocalDb().outbox.where("syncStatus").equals(status).count();
}

/** Every mutation not yet synced (for debug panel). */
export async function listUnsynced(): Promise<OutboxRow[]> {
  const db = getLocalDb();
  return db.outbox
    .where("syncStatus")
    .anyOf("pending", "in_flight", "conflict", "failed")
    .toArray();
}

/* ── Claim a batch (sync engine hot path) ──────────────────── */

/**
 * Atomically select up to `limit` pending rows for one `entityType` that are
 * due (`nextAttemptAt <= now`) and whose dependencies are all resolved, and
 * transition them to `in_flight`.
 *
 * Runs inside a Dexie readwrite transaction. Returns the selected rows in
 * their post-transition state.
 */
export async function claimBatch(
  entityType: EntityType,
  limit = MAX_BATCH_SIZE,
): Promise<OutboxRow[]> {
  const db = getLocalDb();
  const now = nowIso();
  return db.transaction("rw", db.outbox, db.idMap, async () => {
    const candidates = await db.outbox
      .where("entityType")
      .equals(entityType)
      .and((r) => r.syncStatus === "pending")
      .and((r) => r.nextAttemptAt === null || r.nextAttemptAt <= now)
      .sortBy("localCreatedAt");

    const chosen: OutboxRow[] = [];
    for (const row of candidates) {
      if (chosen.length >= limit) break;
      if (row.dependsOn.length > 0) {
        // Look up each dependency; all must be synced or absent (already GC'd).
        let ready = true;
        for (const depId of row.dependsOn) {
          const dep = await db.outbox.get(depId);
          if (dep && dep.syncStatus !== "synced") {
            ready = false;
            break;
          }
        }
        if (!ready) continue;
      }
      // Resolve serverId via the idMap table — critical for updates/deletes
      // that were enqueued BEFORE the matching create reached "synced" state.
      // Without this, an update row would carry a stale null entityServerId
      // and the server would reject it as "not found".
      let resolvedServerId = row.entityServerId;
      if (!resolvedServerId) {
        const mapped = await db.idMap.get([row.entityType, row.entityLocalId]);
        if (mapped?.serverId) resolvedServerId = mapped.serverId;
      }
      chosen.push({
        ...row,
        entityServerId: resolvedServerId,
        syncStatus: "in_flight",
        lastAttemptAt: now,
      });
    }
    if (chosen.length > 0) {
      await db.outbox.bulkPut(chosen);
    }
    return chosen;
  });
}

/* ── Result transitions ────────────────────────────────────── */

export interface AppliedResult {
  mutationId: string;
  serverId?: string | null;
}

/**
 * Resolve the server primary key for a (entityType, localId) pair. Returns
 * null when no mapping has been recorded yet (row has never synced or its
 * create hasn't been acked). Callers building delete/update payloads should
 * use this to avoid sending a stale null serverId.
 */
export async function resolveServerId(
  entityType: EntityType,
  localId: string,
): Promise<string | null> {
  const db = getLocalDb();
  const row = await db.idMap.get([entityType, localId]);
  return row?.serverId ?? null;
}

/** in_flight → synced. Also writes an idMap row if a server id was returned. */
export async function markApplied(result: AppliedResult): Promise<void> {
  const db = getLocalDb();
  const now = nowIso();
  await db.transaction("rw", db.outbox, db.idMap, async () => {
    const row = await db.outbox.get(result.mutationId);
    if (!row) return;
    const serverId = result.serverId ?? row.entityServerId ?? null;
    await db.outbox.put({
      ...row,
      syncStatus: "synced",
      entityServerId: serverId,
      localUpdatedAt: now,
      lastError: null,
    });
    if (serverId) {
      await db.idMap.put({
        entityType: row.entityType,
        localId: row.entityLocalId,
        serverId,
        mappedAt: now,
      });
    }
  });
}

/** in_flight → pending, incrementing attemptCount, with backoff. */
export async function markTransientFailure(
  mutationId: string,
  error: string,
): Promise<void> {
  const db = getLocalDb();
  const now = new Date();
  await db.transaction("rw", db.outbox, async () => {
    const row = await db.outbox.get(mutationId);
    if (!row) return;
    const attemptCount = row.attemptCount + 1;
    if (attemptCount >= MAX_ATTEMPTS) {
      await db.outbox.put({
        ...row,
        syncStatus: "failed",
        attemptCount,
        lastAttemptAt: now.toISOString(),
        nextAttemptAt: null,
        lastError: error,
        localUpdatedAt: now.toISOString(),
      });
      return;
    }
    const next = new Date(now.getTime() + backoffMs(attemptCount));
    await db.outbox.put({
      ...row,
      syncStatus: "pending",
      attemptCount,
      lastAttemptAt: now.toISOString(),
      nextAttemptAt: next.toISOString(),
      lastError: error,
      localUpdatedAt: now.toISOString(),
    });
  });
}

/** in_flight → conflict. Caller decides resolution strategy separately. */
export async function markConflict(
  mutationId: string,
  error: string,
): Promise<void> {
  const db = getLocalDb();
  const now = nowIso();
  const row = await db.outbox.get(mutationId);
  if (!row) return;
  await db.outbox.put({
    ...row,
    syncStatus: "conflict",
    lastAttemptAt: now,
    lastError: error,
    localUpdatedAt: now,
  });
}

/** in_flight → failed (fatal; no retry). */
export async function markFatal(
  mutationId: string,
  error: string,
): Promise<void> {
  const db = getLocalDb();
  const now = nowIso();
  const row = await db.outbox.get(mutationId);
  if (!row) return;
  await db.outbox.put({
    ...row,
    syncStatus: "failed",
    lastAttemptAt: now,
    nextAttemptAt: null,
    lastError: error,
    localUpdatedAt: now,
  });
}

/** Any state → pending (manual retry from debug panel). */
export async function retryMutation(mutationId: string): Promise<void> {
  const db = getLocalDb();
  const now = nowIso();
  const row = await db.outbox.get(mutationId);
  if (!row) return;
  await db.outbox.put({
    ...row,
    syncStatus: "pending",
    attemptCount: 0,
    lastError: null,
    lastAttemptAt: null,
    nextAttemptAt: now,
    localUpdatedAt: now,
  });
}

/** Hard-discard a mutation from the outbox (user explicitly abandoned it). */
export async function discardMutation(mutationId: string): Promise<void> {
  await getLocalDb().outbox.delete(mutationId);
}

/* ── Dependency helpers ────────────────────────────────────── */

/** Returns distinct entityTypes that currently have pending, due mutations. */
export async function getPendingEntityTypes(): Promise<EntityType[]> {
  const db = getLocalDb();
  const now = nowIso();
  const seen = new Set<EntityType>();
  await db.outbox
    .where("syncStatus")
    .equals("pending")
    .and((r) => r.nextAttemptAt === null || r.nextAttemptAt <= now)
    .each((r) => {
      seen.add(r.entityType);
    });
  return Array.from(seen);
}

/** GC sweep — remove synced rows that no pending row still depends on. */
export async function gcSynced(): Promise<number> {
  const db = getLocalDb();
  return db.transaction("rw", db.outbox, async () => {
    const synced = await db.outbox.where("syncStatus").equals("synced").toArray();
    if (synced.length === 0) return 0;

    // Collect dependency references from all not-yet-synced rows.
    const stillReferenced = new Set<string>();
    await db.outbox
      .where("syncStatus")
      .anyOf("pending", "in_flight", "conflict", "failed")
      .each((r) => {
        for (const id of r.dependsOn) stillReferenced.add(id);
      });

    const toDelete = synced
      .filter((r) => !stillReferenced.has(r.mutationId))
      .map((r) => r.mutationId);
    if (toDelete.length > 0) {
      await db.outbox.bulkDelete(toDelete);
    }
    return toDelete.length;
  });
}
