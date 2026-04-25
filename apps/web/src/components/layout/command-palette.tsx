"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setOpen((prev) => !prev);
    }
    if (e.key === "Escape") setOpen(false);
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!open) return null;

  const routes = [
    { label: "\u062F\u0634\u0628\u0648\u0631\u062F", href: "/" },
    { label: "\u0633\u0627\u062E\u062A \u0622\u0632\u0645\u0648\u0646", href: "/create" },
    { label: "\u062A\u0627\u0631\u06CC\u062E\u0686\u0647", href: "/history" },
    { label: "\u0622\u0646\u0627\u0644\u06CC\u062A\u06CC\u06A9\u0633", href: "/analytics" },
    { label: "\u0641\u0644\u0634\u200C\u06A9\u0627\u0631\u062A\u200C\u0647\u0627", href: "/flashcards" },
    { label: "\u062A\u0646\u0638\u06CC\u0645\u0627\u062A", href: "/settings" },
    { label: "\u0627\u06CC\u0645\u067E\u0648\u0631\u062A", href: "/import" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-lg rounded-xl border border-white/10 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <Search className="h-4 w-4 text-zinc-500" />
          <input
            autoFocus
            placeholder={"\u062C\u0633\u062A\u062C\u0648..."}
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
          />
          <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-500">ESC</kbd>
        </div>
        <ul className="mt-2 space-y-1">
          {routes.map((r) => (
            <li key={r.href}>
              <button
                onClick={() => { router.push(r.href); setOpen(false); }}
                className="w-full rounded-lg px-3 py-2 text-right text-sm text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default CommandPalette;