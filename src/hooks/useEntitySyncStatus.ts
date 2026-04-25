"use client";

/**
 * useEntitySyncStatus — reactive hook that returns the sync status
 * of a specific entity by reading its latest outbox row from Dexie.
 *
 * Uses Dexie's liveQuery for automatic reactivity when outbox changes.
 */

import { useEffect, useState } from "react";
import { isLocalFirstEnabled } from "@/lib/local-first/flag";
import type { EntityType, OutboxStatus } from "@/lib/local-first/idb";
import { getLocalDb } from "@/lib/local-first/idb";

export type SyncStatus = OutboxStatus | "local-only" | null;

/**
 * Returns the latest sync status for a given entity.
 * - "pending" | "in_flight" | "synced" | "failed" | "conflict" from outbox
 * - "local-only" if no outbox row exists (entity was created before local-first)
 * - null if local-first is disabled or entity not found
 */
export function useEntitySyncStatus(
  entityType: EntityType | null,
  entityLocalId: string | null,
): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(null);

  useEffect(() => {
    if (!entityType || !entityLocalId || !isLocalFirstEnabled()) return;

    let cancelled = false;
    const db = getLocalDb();

    async function query() {
      try {
        const rows = await db.outbox
          .where("[entityType+entityLocalId]")
          .equals([entityType!, entityLocalId!])
          .reverse()
          .sortBy("localCreatedAt");

        if (cancelled) return;

        if (rows.length === 0) {
          setStatus("local-only");
        } else {
          // Use the most recent non-synced status, or synced if all are synced
          const nonSynced = rows.find((r) => r.syncStatus !== "synced");
          setStatus(nonSynced ? nonSynced.syncStatus : "synced");
        }
      } catch {
        if (!cancelled) setStatus(null);
      }
    }

    query();

    // Poll on a 2s interval since Dexie liveQuery requires dexie-react-hooks
    // which is not in our deps. This is cheap for outbox reads.
    const interval = setInterval(query, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [entityType, entityLocalId]);

  return status;
}

/**
 * Bulk version — returns a map of entityLocalId → SyncStatus for
 * all entities of a given type. More efficient than N individual hooks.
 */
export function useEntitySyncStatusBulk(
  entityType: EntityType | null,
  entityLocalIds: string[],
): Map<string, SyncStatus> {
  const [statusMap, setStatusMap] = useState<Map<string, SyncStatus>>(new Map());

  useEffect(() => {
    if (!entityType || entityLocalIds.length === 0 || !isLocalFirstEnabled()) {
      setStatusMap(new Map());
      return;
    }

    let cancelled = false;
    const db = getLocalDb();

    async function query() {
      try {
        const rows = await db.outbox
          .where("entityType")
          .equals(entityType!)
          .toArray();

        if (cancelled) return;

        const map = new Map<string, SyncStatus>();
        const byEntity = new Map<string, typeof rows>();

        for (const r of rows) {
          if (!byEntity.has(r.entityLocalId)) byEntity.set(r.entityLocalId, []);
          byEntity.get(r.entityLocalId)!.push(r);
        }

        for (const id of entityLocalIds) {
          const entityRows = byEntity.get(id);
          if (!entityRows || entityRows.length === 0) {
            map.set(id, "local-only");
          } else {
            const nonSynced = entityRows.find((r) => r.syncStatus !== "synced");
            map.set(id, nonSynced ? nonSynced.syncStatus : "synced");
          }
        }

        setStatusMap(map);
      } catch {
        if (!cancelled) setStatusMap(new Map());
      }
    }

    query();
    const interval = setInterval(query, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [entityType, entityLocalIds.join(",")]);

  return statusMap;
}
