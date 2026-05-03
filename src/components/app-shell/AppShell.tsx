"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { Sidebar } from "./Sidebar";
import { useAppStore } from "@/store/useAppStore";
import { useSyncOnReconnect } from "@/hooks/useSyncOnReconnect";
import { cn } from "@/lib/utils";

const NO_SHELL_ROUTES    = ["/exam", "/flashcards/review", "/ui-preview"];
const FULL_BLEED_ROUTES  = ["/import"];
/** Reader routes: no padding, no max-width — reader owns its own layout. */
const READER_ROUTES      = [
  "/library/campbell/chapter",
  "/notes",
];
/** Dashboard routes: sidebar is kept, but no wrapper padding/max-width —
 *  HosseinStarshipDashboard is a full-bleed component that manages its own layout. */
const DASHBOARD_ROUTES   = ["/"];
const ENABLE_SERVICE_WORKER =
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PUBLIC_ENABLE_SERVICE_WORKER === "1";

const CommandPalette = dynamic(
  () => import("@/components/command/CommandPalette").then((m) => m.CommandPalette),
  { ssr: false, loading: () => null },
);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { hydrateFromDB, statsHydrated, setSidebarOpen, sidebarOpen } = useAppStore();
  useSyncOnReconnect();

  const isExamMode = NO_SHELL_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`),
  );
  const isFullBleed = FULL_BLEED_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`),
  );
  const isReader = READER_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`),
  );
  const isDashboard = DASHBOARD_ROUTES.some(
    (r) => pathname === r,
  );

  useEffect(() => {
    if (!statsHydrated) void hydrateFromDB();
  }, [hydrateFromDB, statsHydrated]);

  useEffect(() => {
    if (!ENABLE_SERVICE_WORKER || typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  if (isExamMode) {
    return <div className="min-h-[100dvh] bg-background text-foreground">{children}</div>;
  }

  if (isReader) {
    // Reader routes own their full-viewport layout. No app-shell sidebar, no wrapper.
    return (
      <div className="relative h-[100dvh] overflow-hidden bg-background text-foreground">
        <CommandPalette />
        {children}
      </div>
    );
  }

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-background text-foreground">
      {/* Ambient gradient mesh */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-40 dark:opacity-25"
        style={{
          background: [
            "radial-gradient(ellipse 70% 50% at 10% 20%, hsl(var(--primary) / 0.06) 0%, transparent 60%)",
            "radial-gradient(ellipse 50% 60% at 90% 75%, hsl(220 80% 60% / 0.04) 0%, transparent 55%)",
            "radial-gradient(ellipse 40% 35% at 50% 5%, hsl(270 60% 60% / 0.03) 0%, transparent 45%)",
          ].join(","),
        }}
      />

      <CommandPalette />

      {/* Sidebar — right side (RTL: first flex child = right) */}
      <Sidebar />

      {/* Main content — no topbar */}
      <main
        className="relative z-[1] flex-1 overflow-y-auto"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {isDashboard ? (
          children
        ) : (
          <div
            className={cn(
              isFullBleed ? "w-full" : "mx-auto w-full max-w-[92rem]",
              "px-4 py-5 md:px-6 md:py-6",
            )}
          >
            {children}
          </div>
        )}
      </main>

      {/* Mobile nav trigger — floating button, hidden on desktop */}
      {!sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className={cn(
            "fixed right-4 top-4 z-30 lg:hidden",
            "flex h-11 w-11 items-center justify-center rounded-2xl",
            "border border-border/30 bg-card/85 backdrop-blur-xl",
            "text-foreground shadow-lg shadow-black/10",
            "transition-all duration-200 active:scale-95",
          )}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
