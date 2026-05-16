"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCw, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

async function clearPwaShellCache(): Promise<void> {
  // 1. Unregister service workers (shell / precache only)
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
  } catch {
    // not supported or denied — continue
  }

  // 2. Delete Cache Storage entries (precache, runtime-cache, etc.)
  //    This does NOT touch IndexedDB — user data is safe.
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // Cache API unavailable — continue
  }

  // 3. Remove only known safe shell/navigation keys from localStorage.
  //    We do NOT clear the whole localStorage to preserve user preferences.
  //    We do NOT touch IndexedDB (flashcards, annotations, MCQ history, etc.)
  const safeKeyPatterns = [
    "next-router",
    "app-shell",
    "dashboard-snapshot",
    "nw-cache",
  ];
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (safeKeyPatterns.some((p) => key.toLowerCase().includes(p))) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // localStorage unavailable — continue
  }
}

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    console.error("[Dashboard] error boundary caught:", error?.message, error?.digest);
  }, [error]);

  async function handlePwaRecovery() {
    setClearing(true);
    try {
      await clearPwaShellCache();
    } finally {
      window.location.reload();
    }
  }

  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground"
    >
      <Alert variant="warning" className="max-w-xl">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/10 text-warning">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <AlertTitle className="text-lg">داشبورد موقتاً بارگذاری نشد</AlertTitle>
        <AlertDescription className="mt-2 leading-7">
          این بازیابی به اینترنت وابسته نیست. اگر داده محلی یا OPFS لحظه‌ای آماده نشده، دوباره
          تلاش کنید. اگر مشکل در PWA نصب‌شده است، گزینه پاکسازی کش را امتحان کنید.
        </AlertDescription>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={reset} variant="clinical">
            <RefreshCw className="h-4 w-4" />
            تلاش دوباره
          </Button>

          <Button
            variant="outline"
            onClick={handlePwaRecovery}
            disabled={clearing}
            title="Service worker و Cache Storage را پاک می‌کند. IndexedDB (فلش‌کارت‌ها، یادداشت‌ها، MCQ) دست نخورده باقی می‌ماند."
          >
            <Trash2 className="h-4 w-4" />
            {clearing ? "در حال پاکسازی…" : "پاکسازی کش PWA"}
          </Button>

          <Button variant="outline" asChild>
            <Link href="/dashboard">
              <Home className="h-4 w-4" />
              خانه
            </Link>
          </Button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          پاکسازی کش PWA: فقط cache storage و service worker پاک می‌شوند. اطلاعات کاربر (فلش‌کارت، یادداشت، MCQ) محفوظ است.
        </p>
      </Alert>
    </main>
  );
}
