/**
 * Dashboard snapshot persistence.
 *
 * Dashboard data is rendered via `useDashboardData()` which calls
 * `/api/dashboard/stats`. In local-first mode we:
 *   - On every successful response, capture the payload into Dexie.
 *   - On cold boot (or while offline), hand the most recent captured
 *     snapshot to the hook so the page renders immediately.
 *
 * Snapshots are opaque: we store whatever the server returned without
 * re-computing it client-side.
 */

import { getLocalDb } from "./idb";

const SNAPSHOT_NAME = "latest";

export interface DashboardSnapshot<T = unknown> {
  capturedAt: string;
  stats: T;
}

export async function captureDashboardSnapshot<T>(stats: T): Promise<void> {
  await getLocalDb().dashboardSnapshot.put({
    name: SNAPSHOT_NAME,
    capturedAt: new Date().toISOString(),
    stats,
  });
}

export async function loadDashboardSnapshot<T = unknown>(): Promise<DashboardSnapshot<T> | null> {
  const row = await getLocalDb().dashboardSnapshot.get(SNAPSHOT_NAME);
  if (!row) return null;
  return { capturedAt: row.capturedAt, stats: row.stats as T };
}
