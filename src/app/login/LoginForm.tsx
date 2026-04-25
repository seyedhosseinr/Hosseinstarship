"use client";

import { useState } from "react";
import { Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { markLocalUnlocked } from "@/lib/auth/local-unlock";

export default function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
        cache: "no-store",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          data?.error === "invalid-credentials"
            ? "\u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0627\u0634\u062A\u0628\u0627\u0647 \u0627\u0633\u062A"
            : "\u0648\u0631\u0648\u062F \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F",
        );
        setSubmitting(false);
        return;
      }
      markLocalUnlocked();
      window.location.replace(redirectTo || "/");
    } catch {
      setError(
        "\u0627\u062A\u0635\u0627\u0644 \u0628\u0631\u0642\u0631\u0627\u0631 \u0646\u0634\u062F",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="relative z-10 min-h-[100dvh] flex items-center justify-center px-4 py-10 text-white">
      {/* Extra ambient glow behind the card, on top of StarshipAmbient */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[480px] w-[480px] rounded-full blur-3xl opacity-60"
        style={{
          background:
            "radial-gradient(circle, rgba(10,166,184,0.35), rgba(124,58,237,0.22) 45%, transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-[380px] animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Brand header */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="relative">
            <div
              aria-hidden
              className="absolute inset-0 rounded-2xl blur-xl opacity-70"
              style={{
                background:
                  "linear-gradient(135deg, rgba(10,166,184,0.8), rgba(124,58,237,0.6))",
              }}
            />
            <div className="relative h-16 w-16 rounded-2xl flex items-center justify-center border border-white/20 shadow-2xl"
              style={{
                background:
                  "linear-gradient(135deg, rgba(10,166,184,0.35), rgba(124,58,237,0.3))",
                backdropFilter: "blur(12px)",
              }}
            >
              <ShieldCheck className="h-7 w-7 text-white drop-shadow" strokeWidth={1.75} />
            </div>
          </div>
          <div className="text-center space-y-1.5">
            <div className="text-[11px] tracking-[0.25em] font-semibold text-cyan-300/80 uppercase">
              Mission Control
            </div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-l from-white to-cyan-100 bg-clip-text text-transparent">
              Hossein Starship
            </h1>
            <p className="text-sm text-white/60">
              {"\u0628\u0631\u0627\u06CC \u0648\u0631\u0648\u062F\u060C \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0631\u0627 \u0648\u0627\u0631\u062F \u06A9\u0646\u06CC\u062F"}
            </p>
          </div>
        </div>

        {/* Glass card */}
        <form
          onSubmit={onSubmit}
          className="relative overflow-hidden rounded-2xl border border-white/10 p-6 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)]"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
          }}
        >
          {/* Top highlight edge */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
            }}
          />

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-xs font-semibold tracking-wider text-white/70 uppercase"
            >
              {"\u0631\u0645\u0632 \u0639\u0628\u0648\u0631"}
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                dir="ltr"
                placeholder="••••••••"
                className="w-full h-12 rounded-xl border border-white/15 bg-white/5 pl-4 pr-11 text-base text-white placeholder-white/30 outline-none transition focus:border-cyan-300/60 focus:bg-white/10 focus:ring-2 focus:ring-cyan-300/20 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition"
                tabIndex={-1}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Error */}
          <div
            className={`overflow-hidden transition-all ${error ? "mt-3 max-h-10 opacity-100" : "mt-0 max-h-0 opacity-0"}`}
            aria-live="polite"
          >
            <div className="flex items-center gap-2 text-sm text-rose-300">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
              {error}
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            className="relative mt-5 w-full h-12 overflow-hidden border-0 text-white font-semibold shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-500/40 hover:brightness-110 disabled:opacity-60"
            style={{
              background:
                "linear-gradient(135deg, #0AA6B8 0%, #7C3AED 100%)",
            }}
            disabled={submitting || !password}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {"\u062F\u0631 \u062D\u0627\u0644 \u0648\u0631\u0648\u062F\u2026"}
              </>
            ) : (
              <>{"\u0648\u0631\u0648\u062F"}</>
            )}
          </Button>
        </form>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-white/40">
          <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
          <span>
            {"\u062A\u06A9\u200C\u06A9\u0627\u0631\u0628\u0631\u0647 \u2022 \u067E\u0633 \u0627\u0632 \u0648\u0631\u0648\u062F \u0627\u0648\u0644\u06CC\u0647\u060C \u0627\u06CC\u0646 \u062F\u0633\u062A\u06AF\u0627\u0647 \u0628\u0647 \u062E\u0627\u0637\u0631 \u0633\u067E\u0631\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F"}
          </span>
        </div>
      </div>
    </div>
  );
}
