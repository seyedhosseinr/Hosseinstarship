"use client";

import { useSyncStatus, type SyncState } from "@/hooks/useSyncStatus";

const STATE_CONFIG: Record<SyncState, { label: string; color: string; glow: string }> = {
  local:  { label: "محلی",   color: "rgb(245,158,11)",  glow: "rgba(245,158,11,0.4)"  },
  synced: { label: "همگام",  color: "rgb(34,197,94)",   glow: "rgba(34,197,94,0.4)"   },
  stale:  { label: "قدیمی",  color: "rgb(148,163,184)", glow: "rgba(148,163,184,0.3)" },
};

interface SyncStatusBadgeProps {
  /** When true, shows only the dot (for collapsed sidebar). */
  compact?: boolean;
}

export function SyncStatusBadge({ compact = false }: SyncStatusBadgeProps) {
  const state = useSyncStatus();
  const { label, color, glow } = STATE_CONFIG[state];

  return (
    <div
      className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors"
      title={`وضعیت همگام‌سازی: ${label}`}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        {state === "synced" && (
          <span
            className="absolute inset-0 animate-ping rounded-full opacity-50"
            style={{ backgroundColor: color }}
          />
        )}
        <span
          className="relative inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 6px ${glow}` }}
        />
      </span>
      {!compact && <span>{label}</span>}
    </div>
  );
}
