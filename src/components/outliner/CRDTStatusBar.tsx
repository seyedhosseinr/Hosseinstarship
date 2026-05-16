"use client";

/**
 * CRDTStatusBar — dev-only CRDT diagnostics panel.
 * Rendered at the bottom of OutlinerShell.
 * Completely removed from production builds via NODE_ENV guard.
 */

import { useEffect, useState } from "react";
import { crdtManager } from "@/lib/crdt-manager";
import { useOutlinerStore } from "@/components/outliner/outliner-store";

interface Props {
  segmentId: string;
}

// Only render in development — the conditional at call site is belt-and-braces;
// this check is the primary guard so the component tree is empty in production.
const isDev = process.env.NODE_ENV === "development";

export function CRDTStatusBar({ segmentId }: Props) {
  if (!isDev) return null;
  return <CRDTStatusBarInner segmentId={segmentId} />;
}

function CRDTStatusBarInner({ segmentId }: Props) {
  const crdtReady = useOutlinerStore((state) => state.crdtReady);
  const [docSize, setDocSize] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<string>("—");
  const [mergeResult, setMergeResult] = useState<string | null>(null);

  // Refresh doc size every 3s when visible
  useEffect(() => {
    function refresh() {
      if (crdtManager.isReady()) {
        setDocSize(crdtManager.getDocSizeBytes());
        setLastRefresh(new Date().toLocaleTimeString("fa-IR"));
      }
    }
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [crdtReady]);

  function handleExportSnapshot() {
    const bytes = crdtManager.exportSnapshot();
    const b64 = btoa(String.fromCharCode(...bytes));
    void navigator.clipboard.writeText(b64).then(() => {
      alert("اسنپ‌شات CRDT در کلیپ‌بورد کپی شد (base64)");
    });
  }

  function handleApplyFromClipboard() {
    void navigator.clipboard.readText().then((text) => {
      try {
        const binary = atob(text.trim());
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        crdtManager.applyRemoteUpdate(bytes);
        setMergeResult("✓ آپدیت ریموت اعمال شد");
        setDocSize(crdtManager.getDocSizeBytes());
      } catch {
        setMergeResult("✗ خطا در تجزیه base64");
      }
      setTimeout(() => setMergeResult(null), 3000);
    });
  }

  async function handleSimulateMerge() {
    try {
      const { simulateTwoClientMerge } = await import("@/lib/crdt-test-utils");
      await simulateTwoClientMerge();
      setMergeResult("✓ شبیه‌سازی ادغام موفق — ببینید کنسول را");
    } catch (err) {
      setMergeResult(`✗ ${err instanceof Error ? err.message : String(err)}`);
    }
    setTimeout(() => setMergeResult(null), 4000);
  }

  return (
    <div
      dir="rtl"
      className="flex flex-wrap items-center gap-3 border-t border-border/60 bg-[var(--color-surface)]/80 px-4 py-2 text-[11px] text-muted-foreground"
      style={{ fontFamily: "monospace" }}
    >
      <span className="font-semibold text-primary/80">CRDT</span>
      <span>
        segment: <code className="text-foreground">{segmentId}</code>
      </span>
      <span>
        وضعیت:{" "}
        <span className={crdtReady ? "text-emerald-400" : "text-amber-400"}>
          {crdtReady ? "آماده" : "در حال بارگذاری..."}
        </span>
      </span>
      <span>
        حجم doc: <code className="text-foreground">{docSize.toLocaleString()} B</code>
      </span>
      <span>
        همگام‌سازی ریموت:{" "}
        <span className="text-muted-foreground/60">
          خیر (SYNC_PROVIDER stub — بدون WebSocket server)
        </span>
      </span>
      <span>آخرین بارگذاری: {lastRefresh}</span>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleExportSnapshot}
          disabled={!crdtReady}
          className="min-h-7 rounded border border-border/70 px-2 py-0.5 text-[11px] hover:bg-background/60 disabled:opacity-40"
        >
          خروجی اسنپ‌شات
        </button>
        <button
          type="button"
          onClick={handleApplyFromClipboard}
          disabled={!crdtReady}
          className="min-h-7 rounded border border-border/70 px-2 py-0.5 text-[11px] hover:bg-background/60 disabled:opacity-40"
        >
          اعمال آپدیت از کلیپ‌بورد
        </button>
        <button
          type="button"
          onClick={() => void handleSimulateMerge()}
          disabled={!crdtReady}
          className="min-h-7 rounded border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-400 hover:bg-emerald-400/20 disabled:opacity-40"
        >
          شبیه‌سازی ادغام دو کلاینت
        </button>
      </div>

      {mergeResult && (
        <span className={mergeResult.startsWith("✓") ? "text-emerald-400" : "text-rose-400"}>
          {mergeResult}
        </span>
      )}
    </div>
  );
}
