"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { create } from "zustand";
import {
  BookOpen,
  Brain,
  CalendarRange,
  CreditCard,
  FileDown,
  History,
  LayoutDashboard,
  RotateCcw,
  Search,
  Settings2,
  Star,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isLocalFirstEnabled } from "@/lib/local-first/flag";
import { searchLocal, type SearchResultItem } from "@/lib/local-first/search-index";

export type CommandItem = {
  id: string;
  title: string;
  subtitle?: string;
  keywords?: string[];
  href?: string;
  onSelect?: () => void;
  icon?: LucideIcon;
  section?: string;
};

type CommandStore = {
  open: boolean;
  setOpen: (v: boolean) => void;
  openPalette: () => void;
  closePalette: () => void;
};

export const useCommandPaletteStore = create<CommandStore>((set) => ({
  open: false,
  setOpen: (v) => set({ open: v }),
  openPalette: () => set({ open: true }),
  closePalette: () => set({ open: false }),
}));

function score(item: CommandItem, q: string) {
  if (!q) return 1;
  const s = `${item.title} ${item.subtitle ?? ""} ${(item.keywords ?? []).join(" ")}`.toLowerCase();
  if (s.includes(q)) return 3;
  const tokens = q.split(" ").filter(Boolean);
  return tokens.every((t) => s.includes(t)) ? 2 : 0;
}

export function CommandPalette(props: { extraItems?: CommandItem[] }) {
  const router = useRouter();
  const open = useCommandPaletteStore((s) => s.open);
  const setOpen = useCommandPaletteStore((s) => s.setOpen);
  const close = useCommandPaletteStore((s) => s.closePalette);

  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Recent searches (persisted in localStorage)
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem("starship:recent-searches");
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const addRecentSearch = (term: string) => {
    if (!term.trim()) return;
    setRecentSearches((prev) => {
      const next = [term, ...prev.filter((s) => s !== term)].slice(0, 8);
      try { localStorage.setItem("starship:recent-searches", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const baseItems: CommandItem[] = useMemo(
    () => [
      { id: "nav-dashboard", title: "Dashboard", subtitle: "Home and daily status", keywords: ["home", "dashboard", "خانه"], href: "/", icon: LayoutDashboard, section: "Navigation" },
      { id: "nav-library", title: "Library", subtitle: "Library and note reader", keywords: ["library", "notes", "reader", "کتابخانه"], href: "/library", icon: BookOpen, section: "Navigation" },
      { id: "nav-qbank", title: "QBank", subtitle: "Question bank and practice", keywords: ["qbank", "questions", "practice", "سوالات"], href: "/qbank", icon: Brain, section: "Navigation" },
      { id: "nav-yield", title: "Yield", subtitle: "High-yield review", keywords: ["yield", "review"], href: "/yield", icon: Star, section: "Navigation" },
      { id: "nav-review", title: "Review", subtitle: "Due flashcard review (SRS)", keywords: ["review", "srs", "cards", "مرور"], href: "/flashcards/review", icon: RotateCcw, section: "Practice" },
      { id: "nav-flashcards", title: "Flashcards", subtitle: "Browse managed cards", keywords: ["flashcards", "cards", "anki", "فلش‌کارت"], href: "/flashcards", icon: CreditCard, section: "Practice" },
      { id: "nav-planner", title: "Planner", subtitle: "Today and week execution", keywords: ["planner", "today", "week", "برنامه"], href: "/planner", icon: CalendarRange, section: "Practice" },
      { id: "nav-history", title: "History", subtitle: "Exam session history", keywords: ["history", "exam", "sessions", "تاریخچه"], href: "/history", icon: History, section: "Practice" },
      { id: "nav-import", title: "Import", subtitle: "Content import workspace", keywords: ["import", "admin", "backfill", "batch"], href: "/import", icon: FileDown, section: "Manage" },
      { id: "nav-settings", title: "Runtime Data", subtitle: "Runtime and data status", keywords: ["runtime", "data", "storage", "settings", "تنظیمات"], href: "/settings/data", icon: Settings2, section: "Manage" },
    ],
    [],
  );

  const allItems = useMemo(() => [...baseItems, ...(props.extraItems ?? [])], [baseItems, props.extraItems]);

  // Offline search results from FlexSearch
  const localResults = useMemo(() => {
    if (!q.trim() || !isLocalFirstEnabled()) return [];
    const sectionLabel: Record<string, string> = {
      annotation: "یادداشت‌ها",
      task: "تسک‌ها",
      import: "فایل‌ها",
    };
    return searchLocal(q.trim()).map((r): CommandItem => ({
      id: `lf-${r.id}`,
      title: r.title.slice(0, 80),
      subtitle: r.subtitle.slice(0, 60),
      href: r.href,
      icon: Search,
      section: sectionLabel[r.type] ?? "Offline",
    }));
  }, [q]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const ranked = allItems
      .map((it) => ({ it, sc: score(it, query) }))
      .filter((x) => x.sc > 0)
      .sort((a, b) => b.sc - a.sc);
    return [...ranked.map((x) => x.it), ...localResults];
  }, [allItems, q, localResults]);

  // Group filtered items by section
  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of filtered) {
      const section = item.section ?? "Other";
      if (!map.has(section)) map.set(section, []);
      map.get(section)!.push(item);
    }
    return map;
  }, [filtered]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isCmdK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k";
      if (isCmdK) {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (!open) return;

      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, Math.max(0, filtered.length - 1)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = filtered[active];
        if (!item) return;
        addRecentSearch(q);
        if (item.onSelect) item.onSelect();
        if (item.href) router.push(item.href);
        close();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen, close, router, filtered, active, q]);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setActive(0);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-cmd-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  let flatIndex = -1;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[10vh] ipad-portrait:pt-[15vh]"
      onClick={() => close()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />

      {/* Dialog */}
      <div
        className="relative w-full max-w-[640px] overflow-hidden rounded-2xl border border-border/50 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            dir="auto"
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            placeholder="Search pages, notes, tools..."
            className="min-h-[44px] flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/60"
          />
          <kbd className="hidden rounded-lg border border-border bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground md:inline-flex">
            ESC
          </kbd>
        </div>

        {/* Results / recents */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2" style={{ WebkitOverflowScrolling: "touch" }}>
          {/* Recent searches (shown when empty) */}
          {!q.trim() && recentSearches.length > 0 && (
            <div className="mb-2 px-3">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/50">
                Recent
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recentSearches.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => setQ(term)}
                    className="rounded-lg border border-border/60 bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground transition hover:bg-muted"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No results found for &ldquo;{q}&rdquo;
            </div>
          ) : (
            Array.from(grouped.entries()).map(([section, items]) => (
              <div key={section} className="mb-1">
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/50">
                  {section}
                </div>
                {items.map((it) => {
                  flatIndex++;
                  const idx = flatIndex;
                  const Icon = it.icon;
                  return (
                    <button
                      key={it.id}
                      data-cmd-idx={idx}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => {
                        addRecentSearch(q);
                        if (it.onSelect) it.onSelect();
                        if (it.href) router.push(it.href);
                        close();
                      }}
                      className={cn(
                        "flex w-full min-h-[48px] items-center gap-3 rounded-xl px-3 py-2.5 text-right transition-colors",
                        idx === active ? "bg-primary/8 text-foreground" : "text-foreground/80 hover:bg-muted",
                      )}
                    >
                      {Icon && (
                        <div className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                          idx === active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                        )}>
                          <Icon className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{it.title}</div>
                        {it.subtitle && (
                          <div className="truncate text-xs text-muted-foreground">{it.subtitle}</div>
                        )}
                      </div>
                      {it.href && (
                        <span className="text-xs text-muted-foreground/40">↵</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/50 px-4 py-2 text-[11px] text-muted-foreground/50">
          <span>↑↓ navigate · ↵ select · esc close</span>
          <span>Hossein Starship</span>
        </div>
      </div>
    </div>
  );
}
