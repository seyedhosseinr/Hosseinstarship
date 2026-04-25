"use client";

/**
 * Manual "Sync now" trigger. Used in the debug panel and (optionally) the
 * app shell. Shows a spinning state while a tick is running.
 */

import { useEffect, useState } from "react";
import {
  getSyncEngineState,
  subscribeSyncEngine,
  triggerSyncNow,
  type SyncEngineState,
} from "@/lib/local-first/sync-engine";

interface Props {
  className?: string;
  label?: string;
}

export function SyncNowButton({
  className,
  label = "همگام‌سازی",
}: Props) {
  const [state, setState] = useState<SyncEngineState>(() => getSyncEngineState());

  useEffect(() => {
    return subscribeSyncEngine(setState);
  }, []);

  return (
    <button
      type="button"
      disabled={state.running}
      onClick={() => {
        void triggerSyncNow();
      }}
      className={
        className ??
        "inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground disabled:opacity-60"
      }
      dir="rtl"
    >
      <span
        aria-hidden="true"
        className={
          state.running
            ? "inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
            : "inline-block h-2 w-2 rounded-full bg-current opacity-60"
        }
      />
      {state.running ? "در حال همگام‌سازی…" : label}
    </button>
  );
}
