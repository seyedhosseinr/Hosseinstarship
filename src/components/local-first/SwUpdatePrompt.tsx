"use client";

/**
 * In-app "new version available" prompt.
 *
 * The service worker is configured with `skipWaiting: false` — a newer
 * worker will wait in the `installed` state until we explicitly post
 * `{ type: 'SKIP_WAITING' }` to it. This component watches for that state
 * and surfaces a non-blocking prompt; the user opts in by clicking the
 * button, which posts the message and then reloads the page.
 *
 * Persian-first UI strings. No external i18n dependency.
 */

import { useEffect, useState } from "react";

const ENABLE_SERVICE_WORKER =
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PUBLIC_ENABLE_SERVICE_WORKER === "1";

const DEV_SW_CACHE_PREFIXES = [
  "serwist-",
  "api-cache-",
  "lib-cache-",
  "pages-",
  "pglite-wasm-",
  "rsc-cache-",
];

export function SwUpdatePrompt() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    if (!ENABLE_SERVICE_WORKER) {
      if (process.env.NODE_ENV === "development") {
        void navigator.serviceWorker
          .getRegistrations()
          .then((registrations) =>
            Promise.all(
              registrations
                .filter((registration) => registration.scope.startsWith(window.location.origin))
                .map((registration) => registration.unregister()),
            ),
          )
          .catch(() => {});

        if ("caches" in window) {
          void caches
            .keys()
            .then((names) =>
              Promise.all(
                names
                  .filter((name) =>
                    DEV_SW_CACHE_PREFIXES.some((prefix) => name.startsWith(prefix)),
                  )
                  .map((name) => caches.delete(name)),
              ),
            )
            .catch(() => {});
        }
      }
      return;
    }

    let mounted = true;

    const attach = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting) {
        if (mounted) setWaiting(reg.waiting);
      }
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            if (mounted) setWaiting(installing);
          }
        });
      });
    };

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) attach(reg);
    });

    // When the new worker takes control, reload once.
    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      mounted = false;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  if (!ENABLE_SERVICE_WORKER || !waiting) return null;

  const handleReload = () => {
    waiting.postMessage({ type: "SKIP_WAITING" });
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-4 z-[60] mx-auto flex w-[min(92vw,420px)] items-center gap-3 rounded-xl border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur"
      dir="rtl"
    >
      <div className="flex-1 text-[13px] leading-tight text-foreground">
        نسخه جدید در دسترس است. برای بروزرسانی، بارگذاری مجدد کنید.
      </div>
      <button
        type="button"
        onClick={handleReload}
        className="inline-flex shrink-0 items-center rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:opacity-90"
      >
        بارگذاری مجدد
      </button>
    </div>
  );
}
