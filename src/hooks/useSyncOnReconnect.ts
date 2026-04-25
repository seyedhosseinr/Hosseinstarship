"use client";

import { useEffect, useRef } from "react";
import { pushLocalToServer, pullFromServer } from "@/lib/sync/sync-client";

const DEBOUNCE_MS = 2000;

// Module-level: once we detect sync isn't configured on the server,
// don't keep retrying for this session. Resets on full page reload.
let syncDisabledForSession = false;

function isUnconfiguredError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err as Error)?.message ?? String(err);
  return (
    msg.includes("503")
    || msg.includes("ECONNREFUSED")
    || msg.includes("not configured")
    || msg.includes("Failed to fetch")
    || msg.includes("NetworkError")
  );
}

/**
 * Runs a bidirectional sync when the browser is online.
 *
 * Silent by design: no toasts, no banners. If the server is unreachable
 * or unconfigured, logs once to the console and disables sync for the
 * rest of the session. The app keeps working purely on OPFS.
 *
 * Call once from the app shell.
 */
export function useSyncOnReconnect(): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    const runSync = async () => {
      if (syncDisabledForSession || syncingRef.current) return;
      syncingRef.current = true;

      try {
        const pushResult = await pushLocalToServer();
        if (!pushResult.ok) {
          if (isUnconfiguredError(pushResult.error)) {
            syncDisabledForSession = true;
            console.info("[sync] server unreachable; continuing offline-only");
          }
          return;
        }

        const pullResult = await pullFromServer();
        if (!pullResult.ok && isUnconfiguredError(pullResult.error)) {
          syncDisabledForSession = true;
          console.info("[sync] server unreachable; continuing offline-only");
        }
      } catch (err) {
        if (isUnconfiguredError(err)) {
          syncDisabledForSession = true;
          console.info("[sync] server unreachable; continuing offline-only");
        } else {
          console.warn("[sync] unexpected error:", err);
        }
      } finally {
        syncingRef.current = false;
      }
    };

    const debouncedSync = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => { void runSync(); }, DEBOUNCE_MS);
    };

    const onlineHandler = () => {
      if (navigator.onLine) debouncedSync();
    };

    window.addEventListener("online", onlineHandler);
    if (navigator.onLine) debouncedSync();

    return () => {
      window.removeEventListener("online", onlineHandler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
}
