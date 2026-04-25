"use client";

/**
 * SyncDot — tiny sync status indicator.
 *
 * Shows a 6x6 colored dot with a Persian tooltip on hover:
 * - green: synced ("همگام‌سازی شد")
 * - amber: pending/in_flight ("در صف همگام‌سازی")
 * - red: failed ("خطا در همگام‌سازی")
 * - gray: conflict ("تعارض — نیاز به بررسی")
 */

import type { SyncStatus } from "@/hooks/useEntitySyncStatus";

const STATUS_CONFIG: Record<string, { color: string; tooltip: string }> = {
  synced:      { color: "#22c55e", tooltip: "همگام‌سازی شد" },
  pending:     { color: "#f59e0b", tooltip: "در صف همگام‌سازی" },
  in_flight:   { color: "#f59e0b", tooltip: "در صف همگام‌سازی" },
  failed:      { color: "#ef4444", tooltip: "خطا در همگام‌سازی" },
  conflict:    { color: "#9ca3af", tooltip: "تعارض — نیاز به بررسی" },
  "local-only": { color: "#22c55e", tooltip: "همگام‌سازی شد" },
};

export function SyncDot({ status }: { status: SyncStatus }) {
  if (!status) return null;
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;

  return (
    <span
      title={config.tooltip}
      className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
      style={{ backgroundColor: config.color }}
      aria-label={config.tooltip}
    />
  );
}
