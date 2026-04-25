"use client";

/**
 * Local-first debug panel. Exposed at `/debug/local-first` (or embedded in
 * an existing admin shell). Shows:
 *   - Feature flag state + per-device override buttons.
 *   - Storage quota / persistence status + "request persistence" button.
 *   - Outbox state machine counts (pending / in_flight / conflict / failed).
 *   - Most recent sync tick metadata.
 *   - Manual "Sync now" button.
 *   - "Reset local-first state" button (wipes Dexie + OPFS root).
 *   - Needs-review annotations list.
 *
 * All strings are in English — this is a debug surface for power users.
 */

import { useEffect, useState } from "react";
import { isLocalFirstEnabled, setLocalFirstOverride } from "@/lib/local-first/flag";
import {
  formatBytes,
  getStorageStatus,
  requestPersistence,
  type StorageStatus,
} from "@/lib/local-first/storage-debug";
import { countByStatus, listUnsynced, retryMutation, discardMutation } from "@/lib/local-first/outbox";
import type { OutboxRow, OutboxStatus } from "@/lib/local-first/idb";
import { resetLocalDb } from "@/lib/local-first/idb";
import { wipeStarshipRoot } from "@/lib/local-first/opfs";
import {
  getSyncEngineState,
  subscribeSyncEngine,
  triggerSyncNow,
  type SyncEngineState,
} from "@/lib/local-first/sync-engine";
import { SyncNowButton } from "./SyncNowButton";
import { NeedsReviewList } from "./NeedsReviewList";
import { getLocalDb } from "@/lib/local-first/idb";

const STATUSES: OutboxStatus[] = [
  "pending",
  "in_flight",
  "synced",
  "conflict",
  "failed",
];

export function DebugPanel() {
  const [enabled, setEnabled] = useState(false);
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [counts, setCounts] = useState<Record<OutboxStatus, number>>({
    pending: 0,
    in_flight: 0,
    synced: 0,
    conflict: 0,
    failed: 0,
  });
  const [unsynced, setUnsynced] = useState<OutboxRow[]>([]);
  const [engine, setEngine] = useState<SyncEngineState>(() => getSyncEngineState());
  const [storeCounts, setStoreCounts] = useState<Record<string, number>>({});
  const [perfEntries, setPerfEntries] = useState<{ name: string; duration: number }[]>([]);

  const reload = async () => {
    setEnabled(isLocalFirstEnabled());
    try {
      const s = await getStorageStatus();
      setStorage(s);
    } catch {
      /* ignore */
    }
    try {
      const entries: Array<[OutboxStatus, number]> = [];
      for (const s of STATUSES) entries.push([s, await countByStatus(s)]);
      setCounts(Object.fromEntries(entries) as Record<OutboxStatus, number>);
      setUnsynced(await listUnsynced());

      // Store row counts
      const db = getLocalDb();
      const storeNames = ["outbox", "annotations", "plannerTasks", "plannerPlans", "plannerDays", "flashcardReviews", "importManifests", "undoStack", "attachmentMap", "meta"] as const;
      const sc: Record<string, number> = {};
      for (const name of storeNames) {
        try { sc[name] = await (db[name] as never as { count: () => Promise<number> }).count(); } catch { sc[name] = 0; }
      }
      setStoreCounts(sc);
    } catch {
      /* Dexie not available — leave previous state */
    }

    // Performance entries
    try {
      const measures = performance.getEntriesByType("measure")
        .filter((e) => e.name.startsWith("lf-"))
        .slice(-50)
        .map((e) => ({ name: e.name, duration: Math.round(e.duration * 100) / 100 }));
      setPerfEntries(measures);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    void reload();
    const unsub = subscribeSyncEngine(setEngine);
    return () => {
      unsub();
    };
  }, []);

  const onForceOn = () => {
    setLocalFirstOverride("1");
    window.location.reload();
  };
  const onForceOff = () => {
    setLocalFirstOverride("0");
    window.location.reload();
  };
  const onClearOverride = () => {
    setLocalFirstOverride(null);
    window.location.reload();
  };
  const onReset = async () => {
    const confirmed = window.confirm(
      "Reset local-first state? This wipes Dexie and OPFS.",
    );
    if (!confirmed) return;
    await resetLocalDb();
    await wipeStarshipRoot();
    window.location.reload();
  };
  const onRequestPersist = async () => {
    await requestPersistence();
    await reload();
  };

  return (
    <div className="mx-auto max-w-[920px] space-y-6 px-4 py-6" dir="ltr">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Local-first debug</h1>
        <SyncNowButton label="Sync now" />
      </header>

      {/* ── Flag ── */}
      <section className="rounded-lg border border-border p-4">
        <h2 className="mb-2 text-sm font-semibold">Feature flag</h2>
        <div className="text-[13px]">
          Current state:{" "}
          <code className={enabled ? "text-green-600" : "text-muted-foreground"}>
            {enabled ? "ENABLED" : "disabled"}
          </code>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={onForceOn} className="rounded-md border border-border px-3 py-1.5 text-[12px]">
            Force ON
          </button>
          <button type="button" onClick={onForceOff} className="rounded-md border border-border px-3 py-1.5 text-[12px]">
            Force OFF
          </button>
          <button type="button" onClick={onClearOverride} className="rounded-md border border-border px-3 py-1.5 text-[12px]">
            Clear override
          </button>
        </div>
      </section>

      {/* ── Storage ── */}
      <section className="rounded-lg border border-border p-4">
        <h2 className="mb-2 text-sm font-semibold">Storage</h2>
        {storage ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
            <dt className="text-muted-foreground">Supported</dt>
            <dd>{String(storage.supported)}</dd>
            <dt className="text-muted-foreground">Persisted</dt>
            <dd>{String(storage.persisted)}</dd>
            <dt className="text-muted-foreground">Usage</dt>
            <dd>{storage.usage != null ? formatBytes(storage.usage) : "n/a"}</dd>
            <dt className="text-muted-foreground">Quota</dt>
            <dd>{storage.quota != null ? formatBytes(storage.quota) : "n/a"}</dd>
            <dt className="text-muted-foreground">Usage ratio</dt>
            <dd>{storage.usageRatio != null ? `${(storage.usageRatio * 100).toFixed(1)}%` : "n/a"}</dd>
          </dl>
        ) : (
          <div className="text-[12px] text-muted-foreground">Loading…</div>
        )}
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => void onRequestPersist()} className="rounded-md border border-border px-3 py-1.5 text-[12px]">
            Request persistence
          </button>
          <button type="button" onClick={() => void onReset()} className="rounded-md border border-destructive/40 px-3 py-1.5 text-[12px] text-destructive">
            Reset local-first state
          </button>
        </div>
      </section>

      {/* ── Sync engine ── */}
      <section className="rounded-lg border border-border p-4">
        <h2 className="mb-2 text-sm font-semibold">Sync engine</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
          <dt className="text-muted-foreground">Running</dt>
          <dd>{String(engine.running)}</dd>
          <dt className="text-muted-foreground">Last tick</dt>
          <dd>{engine.lastTickAt ?? "—"}</dd>
          <dt className="text-muted-foreground">Last sync</dt>
          <dd>{engine.lastSyncAt ?? "—"}</dd>
          <dt className="text-muted-foreground">Last error</dt>
          <dd className="text-destructive">{engine.lastError ?? "—"}</dd>
        </dl>
        <button
          type="button"
          onClick={() => void triggerSyncNow().then(reload)}
          className="mt-3 rounded-md border border-border px-3 py-1.5 text-[12px]"
        >
          Tick now
        </button>
      </section>

      {/* ── Outbox counts ── */}
      <section className="rounded-lg border border-border p-4">
        <h2 className="mb-2 text-sm font-semibold">Outbox</h2>
        <div className="grid grid-cols-5 gap-2 text-center text-[12px]">
          {STATUSES.map((s) => (
            <div key={s} className="rounded-md bg-muted px-2 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{s}</div>
              <div className="text-lg font-semibold tabular-nums">{counts[s]}</div>
            </div>
          ))}
        </div>

        {unsynced.length > 0 && (
          <ul className="mt-4 divide-y divide-border">
            {unsynced.slice(0, 50).map((row) => (
              <li key={row.mutationId} className="flex items-start gap-2 py-2 text-[11px]">
                <div className="flex-1 min-w-0">
                  <div className="truncate">
                    <code>{row.entityType}</code>/<code>{row.operation}</code> · {row.mutationId.slice(0, 8)}
                  </div>
                  <div className="text-muted-foreground">
                    status={row.syncStatus} · attempts={row.attemptCount}
                    {row.lastError ? ` · error=${row.lastError}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void retryMutation(row.mutationId).then(reload)}
                  className="rounded border border-border px-2 py-0.5"
                >
                  retry
                </button>
                <button
                  type="button"
                  onClick={() => void discardMutation(row.mutationId).then(reload)}
                  className="rounded border border-destructive/40 px-2 py-0.5 text-destructive"
                >
                  discard
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Dexie store counts ── */}
      <section className="rounded-lg border border-border p-4">
        <h2 className="mb-2 text-sm font-semibold">Dexie store row counts</h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center text-[12px]">
          {Object.entries(storeCounts).map(([name, count]) => (
            <div key={name} className="rounded-md bg-muted px-2 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{name}</div>
              <div className="text-lg font-semibold tabular-nums">{count}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Performance budgets ── */}
      <section className="rounded-lg border border-border p-4">
        <h2 className="mb-2 text-sm font-semibold">Performance budget</h2>
        <div className="text-[11px] text-muted-foreground mb-3">
          Targets: entity write p99 &lt;50ms · cold launch &lt;1500ms · Dexie query p99 &lt;20ms
        </div>
        {perfEntries.length === 0 ? (
          <div className="text-[12px] text-muted-foreground">
            No performance marks recorded yet. Marks prefixed with <code>lf-</code> will appear here.
          </div>
        ) : (
          <ul className="divide-y divide-border text-[11px]">
            {perfEntries.map((e, i) => {
              const isOver = e.name.includes("write") ? e.duration > 50 : e.duration > 20;
              return (
                <li key={`${e.name}-${i}`} className="flex items-center justify-between py-1.5">
                  <code className="truncate">{e.name}</code>
                  <span className={isOver ? "font-bold text-destructive" : "tabular-nums text-foreground"}>
                    {e.duration}ms
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <button
          type="button"
          onClick={() => void reload()}
          className="mt-3 rounded-md border border-border px-3 py-1.5 text-[12px]"
        >
          Refresh metrics
        </button>
      </section>

      {/* ── Needs review ── */}
      <section className="rounded-lg border border-border">
        <h2 className="border-b border-border px-4 py-2 text-sm font-semibold">Needs review (orphaned annotations)</h2>
        <NeedsReviewList />
      </section>
    </div>
  );
}
