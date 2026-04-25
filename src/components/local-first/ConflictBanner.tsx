"use client";

/**
 * ConflictBanner — shows a Persian banner when outbox has conflict rows.
 * Clicking "مشاهده" opens a drawer listing each conflict.
 */

import { useEffect, useState } from "react";
import { AlertTriangle, ChevronLeft, X } from "lucide-react";
import { toast } from "sonner";
import { isLocalFirstEnabled } from "@/lib/local-first/flag";
import type { OutboxRow } from "@/lib/local-first/idb";
import { getLocalDb } from "@/lib/local-first/idb";
import { retryMutation, discardMutation } from "@/lib/local-first/outbox";

function entityLabel(type: string): string {
  switch (type) {
    case "annotation": return "یادداشت";
    case "planner_item": return "تسک";
    case "flashcard_review": return "مرور فلش‌کارت";
    case "import_manifest": return "فایل وارد شده";
    default: return type;
  }
}

export function ConflictBanner() {
  const [conflicts, setConflicts] = useState<OutboxRow[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!isLocalFirstEnabled()) return;
    let cancelled = false;
    const db = getLocalDb();

    async function check() {
      try {
        const rows = await db.outbox.where("syncStatus").equals("conflict").toArray();
        if (!cancelled) setConflicts(rows);
      } catch { /* ignore */ }
    }

    check();
    const id = setInterval(check, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  async function handleKeepLocal(row: OutboxRow) {
    // Re-enqueue as pending — will push local version again
    await retryMutation(row.mutationId);
    setConflicts((prev) => prev.filter((r) => r.mutationId !== row.mutationId));
    toast.success("نسخه‌ی محلی ارسال خواهد شد");
  }

  async function handleAcceptServer(row: OutboxRow) {
    // Discard local mutation — server version wins
    await discardMutation(row.mutationId);
    setConflicts((prev) => prev.filter((r) => r.mutationId !== row.mutationId));
    toast.success("نسخه‌ی سرور پذیرفته شد");
  }

  if (conflicts.length === 0) return null;

  return (
    <>
      {/* Banner */}
      <div
        dir="rtl"
        className="mx-auto max-w-4xl mb-4 rounded-xl border border-amber-300/40 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/40 px-4 py-2.5 flex items-center gap-3"
      >
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="text-sm font-medium text-amber-800 dark:text-amber-300 flex-1">
          {conflicts.length} مورد نیاز به بررسی دارد
        </span>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="rounded-lg border border-amber-300/60 dark:border-amber-700 bg-white dark:bg-amber-900/30 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300 transition hover:bg-amber-100 dark:hover:bg-amber-900/50"
        >
          مشاهده
          <ChevronLeft className="inline h-3 w-3 mr-1" />
        </button>
      </div>

      {/* Drawer */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-[200] bg-black/30 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            dir="rtl"
            className="fixed z-[210] inset-y-0 left-0 w-full max-w-md bg-card border-r border-border shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  تعارض‌ها
                </div>
                <div className="mt-0.5 text-sm font-semibold text-foreground">
                  {conflicts.length} مورد
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-md hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {conflicts.map((row) => (
                <div
                  key={row.mutationId}
                  className="rounded-xl border border-border bg-muted/30 p-4 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 rounded-full px-2 py-0.5">
                      {entityLabel(row.entityType)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {row.operation}
                    </span>
                  </div>

                  {/* Local version */}
                  <div className="rounded-lg border border-border bg-card p-3">
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
                      نسخه‌ی محلی
                    </div>
                    <pre className="text-xs text-foreground whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                      {JSON.stringify(row.payload, null, 2)?.slice(0, 300)}
                    </pre>
                  </div>

                  {/* Server version (we don't have it — show error) */}
                  <div className="rounded-lg border border-border bg-card p-3">
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
                      نسخه‌ی سرور
                    </div>
                    <p className="text-xs text-muted-foreground italic">
                      {row.lastError ?? "اطلاعات سرور در دسترس نیست"}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleKeepLocal(row)}
                      className="flex-1 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/20"
                    >
                      حفظ نسخه‌ی من
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAcceptServer(row)}
                      className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted/80"
                    >
                      پذیرفتن نسخه‌ی سرور
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
