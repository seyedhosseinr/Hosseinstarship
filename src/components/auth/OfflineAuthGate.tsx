"use client";

import { useEffect, useState } from "react";
import { Lock, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  isLocalUnlocked,
  markLocalUnlocked,
  clearLocalUnlock,
} from "@/lib/auth/local-unlock";

type Status = "checking" | "allow" | "locked-offline";

/**
 * Client-side PWA boot gate.
 *
 * When the service worker serves the shell offline to a browser that was
 * NEVER authenticated (no local unlock marker), we must not render the app.
 * The middleware would have redirected an online request to /login, but on a
 * fresh offline start the SW may serve cached HTML before any network check.
 *
 * For a browser that WAS previously authenticated (marker present), we trust
 * the marker for offline startup â€” the server session cookie remains the real
 * gate the moment the device is online again.
 */
export default function OfflineAuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;

    async function check() {
      // Local unlock is only for true offline boot. When online, confirm the
      // server-signed cookie before rendering. This prevents a stale
      // localStorage marker or an old service-worker shell from bypassing login.
      if (isLocalUnlocked()) {
        try {
          const res = await fetch("/api/auth/session", {
            cache: "no-store",
            credentials: "same-origin",
          });
          if (res.ok) {
            const data = (await res.json()) as { authenticated?: boolean };
            if (data?.authenticated) {
              markLocalUnlocked();
              if (!cancelled) setStatus("allow");
              return;
            }
          }

          // Online + stale local marker + no valid server session â†’ lock again.
          if (!cancelled) {
            clearLocalUnlock();
            window.location.replace(
              `/login?from=${encodeURIComponent(window.location.pathname + window.location.search)}`,
            );
          }
        } catch {
          // Network failed: allow only as the offline/PWA escape hatch for a
          // browser that had previously logged in successfully.
          if (!cancelled) setStatus("allow");
        }
        return;
      }

      // No local marker â€” try the server. If the server confirms a session
      // (e.g. user logged in in another tab), adopt it. Otherwise, if we are
      // offline, show the locked-offline state. If online with no session,
      // the middleware has already redirected, but as a belt-and-braces we
      // also force a navigation to /login below.
      try {
        const res = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (res.ok) {
          const data = (await res.json()) as { authenticated?: boolean };
          if (data?.authenticated) {
            markLocalUnlocked();
            if (!cancelled) setStatus("allow");
            return;
          }
        }
        // Online + no session â†’ middleware should have redirected. Force it.
        if (!cancelled) {
          window.location.replace(
            `/login?from=${encodeURIComponent(window.location.pathname + window.location.search)}`,
          );
        }
      } catch {
        // Offline + no local marker â†’ show lock screen.
        if (!cancelled) setStatus("locked-offline");
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "allow") return <>{children}</>;
  if (status === "checking") return <BootSplash />;
  return <LockedOffline />;
}

function BootSplash() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-10 w-10 rounded-full border-[2.5px] border-primary/20 border-t-primary animate-spin"
          aria-label="loading"
        />
        <div className="text-[11px] tracking-[0.25em] font-semibold text-muted-foreground uppercase">
          Starship
        </div>
      </div>
    </div>
  );
}

function LockedOffline() {
  return (
    <div className="relative min-h-[100dvh] flex items-center justify-center px-6 py-10 overflow-hidden bg-background text-foreground">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(40rem 40rem at 50% 30%, rgba(10,166,184,0.10), transparent 60%), radial-gradient(35rem 35rem at 50% 90%, rgba(124,58,237,0.08), transparent 60%)",
        }}
      />

      <div className="relative w-full max-w-sm text-center space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
        <div className="relative mx-auto h-16 w-16">
          <div
            aria-hidden
            className="absolute inset-0 rounded-2xl blur-xl opacity-60 bg-primary/40"
          />
          <div className="relative h-16 w-16 rounded-2xl flex items-center justify-center border border-border/60 bg-card shadow-xl">
            <Lock className="h-6 w-6 text-primary" strokeWidth={1.75} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] tracking-[0.25em] font-semibold text-primary/80 uppercase">
            Mission Control
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Hossein Starship
          </h1>
        </div>

        <p className="text-sm text-muted-foreground leading-7">
          {"\u0627\u06CC\u0646 \u0645\u0631\u0648\u0631\u06AF\u0631 \u0642\u0628\u0644\u0627\u064B \u0648\u0627\u0631\u062F \u0646\u0634\u062F\u0647 \u0627\u0633\u062A\u060C \u0648 \u062F\u0631 \u062D\u0627\u0644 \u062D\u0627\u0636\u0631 \u0622\u0641\u0644\u0627\u06CC\u0646 \u0647\u0633\u062A\u06CC\u062F. \u0628\u0631\u0627\u06CC \u0648\u0631\u0648\u062F \u0627\u0648\u0644\u06CC\u0647\u060C \u0628\u0647 \u0627\u06CC\u0646\u062A\u0631\u0646\u062A \u0646\u06CC\u0627\u0632 \u062F\u0627\u0631\u06CC\u062F."}
        </p>

        <div className="inline-flex items-center justify-center gap-2 text-xs text-muted-foreground px-3 py-1.5 rounded-full border border-border/60 bg-card/60">
          <WifiOff className="h-3.5 w-3.5" />
          <span>{"\u0627\u062A\u0635\u0627\u0644 \u0642\u0637\u0639 \u0627\u0633\u062A"}</span>
        </div>

        <Button
          onClick={() => window.location.reload()}
          className="w-full h-11"
          size="lg"
        >
          {"\u062A\u0644\u0627\u0634 \u0645\u062C\u062F\u062F"}
        </Button>
      </div>
    </div>
  );
}
