"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Focus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useOutlinerStore,
  type OutlinerMode,
  type SearchResult,
} from "@/components/outliner/outliner-store";
import { algorithmDisplayTitle } from "@/components/outliner/navigation-labels";
import { MODE_LABELS, MODE_BANNERS, toFa } from "@/components/outliner/study-player/tokens";

const MODES: OutlinerMode[] = ["free", "stepwise", "traps", "recall", "exam"];

interface StudyTopBarProps {
  openSearchResult?: (r: SearchResult) => void;
}

export function StudyTopBar({ openSearchResult }: StudyTopBarProps) {
  const surfaces            = useOutlinerStore((s) => s.surfaces);
  const currentSurfaceIndex = useOutlinerStore((s) => s.currentSurfaceIndex);
  const gotoNextSurface     = useOutlinerStore((s) => s.gotoNextSurface);
  const gotoPrevSurface     = useOutlinerStore((s) => s.gotoPrevSurface);
  const setNavigatorOpen    = useOutlinerStore((s) => s.setNavigatorOpen);
  const mode                = useOutlinerStore((s) => s.mode);
  const setMode             = useOutlinerStore((s) => s.setMode);
  const isFocusMode         = useOutlinerStore((s) => s.isFocusMode);
  const setFocusMode        = useOutlinerStore((s) => s.setFocusMode);
  const isImmersive         = useOutlinerStore((s) => s.isImmersive);
  const toggleImmersive     = useOutlinerStore((s) => s.toggleImmersive);
  const searchQuery         = useOutlinerStore((s) => s.searchQuery);
  const searchResults       = useOutlinerStore((s) => s.searchResults);
  const activeSearchIndex   = useOutlinerStore((s) => s.activeSearchIndex);
  const setSearch           = useOutlinerStore((s) => s.setSearch);
  const moveSearchCursor    = useOutlinerStore((s) => s.moveSearchCursor);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const total   = surfaces.length;
  const current = currentSurfaceIndex;
  const atFirst = current <= 0;
  const atLast  = total === 0 || current >= total - 1;

  const currentSurface = surfaces[current] ?? null;
  const surfaceLabel   = currentSurface
    ? algorithmDisplayTitle(currentSurface, current)
    : "—";

  const surfaceTitleById = useMemo(
    () => new Map(surfaces.map((s, i) => [s.id, algorithmDisplayTitle(s, i)])),
    [surfaces],
  );

  const modeBanner = MODE_BANNERS[mode] ?? null;

  function handleSearchKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); moveSearchCursor(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveSearchCursor(-1); }
    else if (e.key === "Enter" && searchResults[activeSearchIndex]) {
      openSearchResult?.(searchResults[activeSearchIndex]);
      setSearch("");
      setSearchOpen(false);
    } else if (e.key === "Escape") {
      setSearch("");
      setSearchOpen(false);
      searchInputRef.current?.blur();
    }
  }

  function clearSearch() {
    setSearch("");
    setSearchOpen(false);
  }

  return (
    <div data-outliner-topbar>
      {/* ── Row 1: Navigation ───────────────────────────────────────────────── */}
      <div
        className="flex min-h-[52px] items-center gap-2 px-3"
        style={{ borderBottom: "1px solid var(--sp-border)", background: "var(--sp-surface)" }}
        dir="rtl"
      >
        {/* Navigator toggle */}
        <button
          type="button"
          onClick={() => setNavigatorOpen(true)}
          className="flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-semibold transition hover:bg-gray-50"
          style={{ color: "var(--sp-text)" }}
          dir="rtl"
          lang="fa"
        >
          فهرست
          <ChevronLeft className="h-3.5 w-3.5" style={{ color: "var(--sp-text-muted)" }} />
        </button>

        {/* Divider */}
        <div className="h-5 w-px shrink-0" style={{ background: "var(--sp-border)" }} />

        {/* Prev */}
        <button
          type="button"
          onClick={gotoPrevSurface}
          disabled={atFirst}
          className="flex min-h-[44px] items-center gap-0.5 rounded-xl px-2.5 py-1.5 text-[12px] transition hover:bg-gray-50 disabled:opacity-30"
          style={{ color: "var(--sp-text-muted)" }}
          dir="rtl"
          lang="fa"
          aria-label="الگوریتم قبلی"
        >
          <ChevronRight className="h-4 w-4" />
          قبلی
        </button>

        {/* Counter + current surface title */}
        <div className="flex min-w-0 flex-1 flex-col items-center gap-0">
          <span
            className="max-w-[280px] truncate text-[13px] font-semibold"
            style={{ color: "var(--sp-text)" }}
            dir="rtl"
            lang="fa"
            title={surfaceLabel}
          >
            {surfaceLabel}
          </span>
          <span className="text-[11px] tabular-nums" style={{ color: "var(--sp-text-muted)" }}>
            {total > 0 ? `${toFa(current + 1)} / ${toFa(total)}` : "—"}
          </span>
        </div>

        {/* Next */}
        <button
          type="button"
          onClick={gotoNextSurface}
          disabled={atLast}
          className="flex min-h-[44px] items-center gap-0.5 rounded-xl px-2.5 py-1.5 text-[12px] transition hover:bg-gray-50 disabled:opacity-30"
          style={{ color: "var(--sp-text-muted)" }}
          dir="rtl"
          lang="fa"
          aria-label="الگوریتم بعدی"
        >
          بعدی
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* ── Row 2: Mode + tools ─────────────────────────────────────────────── */}
      <div
        className="flex min-h-[44px] flex-wrap items-center gap-2 px-3 py-1.5"
        style={{ borderBottom: "1px solid var(--sp-border)", background: "var(--sp-shell-bg)" }}
        dir="rtl"
      >
        {/* Study mode segmented control */}
        <div
          className="flex overflow-hidden rounded-xl border"
          style={{ borderColor: "var(--sp-border)" }}
          role="group"
          aria-label="حالت یادگیری"
        >
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "min-h-[36px] px-2.5 py-1 text-[11px] font-medium transition",
                "border-r last:border-r-0",
              )}
              style={
                mode === m
                  ? {
                      background: "#0F172A",
                      color: "#FFFFFF",
                      borderColor: "var(--sp-border)",
                    }
                  : {
                      background: "var(--sp-surface)",
                      color: "var(--sp-text-muted)",
                      borderColor: "var(--sp-border)",
                    }
              }
              dir="rtl"
              lang="fa"
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Focus mode toggle */}
        <button
          type="button"
          onClick={() => setFocusMode(!isFocusMode)}
          className="flex min-h-[36px] items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] font-medium transition"
          style={
            isFocusMode
              ? { background: "#0F172A", color: "#FFFFFF" }
              : { background: "var(--sp-surface)", color: "var(--sp-text-muted)", border: "1px solid var(--sp-border)" }
          }
          aria-label="حالت تمرکز"
          aria-pressed={isFocusMode}
          lang="fa"
        >
          <Focus className="h-3.5 w-3.5" />
          تمرکز
        </button>

        {/* Search */}
        <div className="relative" dir="ltr">
          <label
            className="flex items-center gap-1.5 rounded-xl border px-2.5 py-1 transition focus-within:ring-1 focus-within:ring-blue-400"
            style={{ background: "var(--sp-surface)", borderColor: "var(--sp-border)" }}
          >
            <Search className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--sp-text-muted)" }} />
            <input
              ref={searchInputRef}
              data-search-input
              value={searchQuery}
              onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
              onKeyDown={handleSearchKey}
              onFocus={() => setSearchOpen(true)}
              className="w-36 bg-transparent text-[12px] outline-none"
              placeholder="جستجو..."
              dir="rtl"
              lang="fa"
              style={{ color: "var(--sp-text)" }}
            />
            {searchQuery && (
              <button type="button" onClick={clearSearch} className="shrink-0">
                <X className="h-3 w-3" style={{ color: "var(--sp-text-muted)" }} />
              </button>
            )}
          </label>

          {/* Search results dropdown */}
          {searchOpen && searchResults.length > 0 && openSearchResult && (
            <SearchDropdown
              results={searchResults}
              activeIndex={activeSearchIndex}
              surfaceTitleById={surfaceTitleById}
              onSelect={(r) => { openSearchResult(r); clearSearch(); }}
            />
          )}
        </div>

        {/* Immersive mode toggle */}
        <button
          type="button"
          onClick={toggleImmersive}
          className="flex min-h-[36px] items-center rounded-xl border px-2.5 py-1 text-[11px] font-medium transition"
          style={
            isImmersive
              ? { background: "#0F172A", color: "#FFFFFF", borderColor: "#0F172A" }
              : { borderColor: "var(--sp-border)", color: "var(--sp-text-muted)", background: "var(--sp-surface)" }
          }
          aria-label="حالت غوطه‌ور"
          aria-pressed={isImmersive}
          title="Immersive mode (Ctrl+Enter)"
        >
          ⛶
        </button>
      </div>

      {/* ── Mode banner ─────────────────────────────────────────────────────── */}
      {modeBanner && (
        <div
          className="flex items-center gap-2 px-4 py-1.5 text-[12px]"
          style={{
            background: "#FEF3C7",
            borderBottom: "1px solid #F59E0B",
            color: "#78350F",
          }}
          dir="rtl"
          lang="fa"
        >
          <span className="shrink-0 text-[14px]" aria-hidden>⚑</span>
          {modeBanner}
        </div>
      )}
    </div>
  );
}

// ── Search results dropdown ───────────────────────────────────────────────────

function SearchDropdown({
  results,
  activeIndex,
  surfaceTitleById,
  onSelect,
}: {
  results: SearchResult[];
  activeIndex: number;
  surfaceTitleById: Map<string, string>;
  onSelect: (r: SearchResult) => void;
}) {
  const kindLabel: Record<SearchResult["kind"], string> = {
    surface: "سطح", node: "گره", edge: "ارتباط",
    matrix_row: "ردیف ماتریس", threshold: "آستانه",
    trap: "تله", checkpoint: "چک‌پوینت", blockId: "منبع",
  };

  return (
    <div
      className="absolute right-0 top-full z-50 mt-1.5 w-72 max-h-72 overflow-auto rounded-xl border shadow-xl"
      style={{ background: "var(--sp-surface)", borderColor: "var(--sp-border)" }}
    >
      <div className="p-1.5 space-y-0.5">
        {results.map((result, abs) => {
          const active = abs === activeIndex;
          return (
            <button
              key={`${result.kind}-${result.surfaceId}-${result.objectId ?? ""}-${abs}`}
              type="button"
              className={cn(
                "w-full rounded-lg px-2.5 py-1.5 text-right text-[12px] transition",
                active ? "bg-blue-50" : "hover:bg-gray-50",
              )}
              style={{ color: active ? "#1D4ED8" : "var(--sp-text-muted)" }}
              onClick={() => onSelect(result)}
            >
              <div className="font-semibold" style={{ color: "var(--sp-text)" }}>
                {surfaceTitleById.get(result.surfaceId) ?? result.surfaceTitle}
              </div>
              <div className="text-[11px]" dir="rtl" lang="fa">
                {kindLabel[result.kind]}: {result.matchText}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
