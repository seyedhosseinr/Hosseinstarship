"use client";

/**
 * Non-blocking banner shown when the browser has NOT marked our origin as
 * persistent. On iOS Safari this is common, and evicted OPFS data would
 * cost the user local state — so we nudge them to add the app to the home
 * screen (the only way iOS grants persistence reliably).
 *
 * Dismissible for the current session only; not cached in localStorage.
 */

import { useEffect, useState } from "react";
import {
  getStorageStatus,
  requestPersistence,
  type StorageStatus,
} from "@/lib/local-first/storage-debug";

export function StorageWarningBanner() {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let mounted = true;
    getStorageStatus().then((s) => {
      if (mounted) setStatus(s);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!status || !status.supported || status.persisted || dismissed) return null;

  const handleRequest = async () => {
    const granted = await requestPersistence();
    if (granted) {
      setStatus({ ...status, persisted: true });
    } else {
      // iOS won't grant through JS — hide until next session to avoid nagging.
      setDismissed(true);
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-2 z-[55] mx-auto flex w-[min(94vw,520px)] items-center gap-3 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-2 text-[12px] text-yellow-900 backdrop-blur dark:text-yellow-200"
      dir="rtl"
    >
      <span className="flex-1 leading-tight">
        حافظه پایدار فعال نیست. برای جلوگیری از پاک شدن داده‌های آفلاین، این برنامه را به صفحه اصلی اضافه کنید.
      </span>
      <button
        type="button"
        onClick={() => void handleRequest()}
        className="shrink-0 rounded-md bg-yellow-500/30 px-2 py-1 text-[11px] font-medium"
      >
        فعال کردن
      </button>
      <button
        type="button"
        aria-label="بستن"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-md px-1 text-[14px] leading-none opacity-70 hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}
