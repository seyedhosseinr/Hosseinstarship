"use client";

import { useSyncExternalStore } from "react";

/**
 * Sync status states:
 * - `local`  — offline, or no sync has ever completed
 * - `synced` — last push was recent (within STALE_THRESHOLD_MS)
 * - `stale`  — last push was too long ago
 */
export type SyncState = "local" | "synced" | "stale";

const LAST_PUSHED_AT_KEY = "uro_sync_last_pushed_at";

/** If the last push is older than this, status is "stale". */
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

function getSnapshot(): SyncState {
  if (typeof window === "undefined") return "local";
  if (!navigator.onLine) return "local";

  const raw = localStorage.getItem(LAST_PUSHED_AT_KEY);
  if (!raw) return "local";

  const lastPushedAt = Number(raw);
  if (Number.isNaN(lastPushedAt)) return "local";

  const age = Date.now() - lastPushedAt;
  return age < STALE_THRESHOLD_MS ? "synced" : "stale";
}

function getServerSnapshot(): SyncState {
  return "local";
}

function subscribe(callback: () => void): () => void {
  // Re-check on storage events (cross-tab), online/offline, and periodic poll
  window.addEventListener("storage", callback);
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  const id = setInterval(callback, 10_000);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
    clearInterval(id);
  };
}

/**
 * Derives the current sync status from localStorage checkpoint data
 * written by `sync-client.ts` and the browser's online state.
 *
 * Uses `useSyncExternalStore` for tear-free reads.
 */
export function useSyncStatus(): SyncState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
