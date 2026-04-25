"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, ChevronDown, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CampbellVolumeGroup } from "@/lib/library/queries";
import type { ChapterStatus } from "@/lib/library/progress";

/* ── Persian numeral helper ── */

const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
function toPersianNum(n: number | string): string {
  return String(n).replace(/\d/g, (d) => persianDigits[+d]);
}

/* ── Micro-nav types (section-level scrollspy) ── */

export type MicroNavItem = {
  id: string;
  label: string;
  count?: number;
};

export type MicroNavContext = {
  mode: "note" | "yield";
  items: MicroNavItem[];
  activeItemId: string | null;
  onItemClick: (id: string) => void;
};

interface LibrarySpineProps {
  tree: CampbellVolumeGroup[];
  microNav?: MicroNavContext | null;
  isOpen: boolean;
  tocContent?: ReactNode;
  onClose?: () => void;
}

/* ── Status indicator ── */

function StatusDot({ status }: { status: string }) {
  if (status === "reading") {
    return (
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lib-accent opacity-40" />
        <span className="inline-flex h-2 w-2 rounded-full bg-lib-accent" />
      </span>
    );
  }
  if (status === "read") {
    return <Check className="h-3 w-3 shrink-0 text-lib-text-muted" />;
  }
  if (status === "reviewed") {
    return <Check className="h-3 w-3 shrink-0 text-lib-accent" />;
  }
  if (status === "mastered") {
    return <Star className="h-3 w-3 shrink-0 fill-warning text-warning" />;
  }
  return <span className="h-2 w-2 shrink-0 rounded-full border border-lib-border-subtle" />;
}

/* ── Micro-nav list (scrollspy sections under active chapter) ── */

function MicroNavList({ microNav }: { microNav: MicroNavContext }) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!microNav.activeItemId || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-micro-id="${CSS.escape(microNav.activeItemId)}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [microNav.activeItemId]);

  return (
    <div ref={listRef} className="mb-0.5 ms-7 mt-0.5 space-y-px border-s-2 border-lib-accent-soft ps-2">
      {microNav.items.map((item) => {
        const isActive = microNav.activeItemId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            data-micro-id={item.id}
            onClick={() => microNav.onItemClick(item.id)}
            className={cn(
              "flex w-full items-baseline gap-1.5 rounded-lib-sm px-2 py-[4px] text-start",
              "transition-all duration-lib-fade",
              isActive
                ? "bg-lib-active font-medium text-lib-accent"
                : "text-lib-text-muted hover:bg-lib-hover hover:text-lib-text",
            )}
          >
            <span className="min-w-0 flex-1 truncate text-[11px] leading-snug">
              {item.label}
            </span>
            {item.count !== undefined && (
              <span className="shrink-0 text-[10px] tabular-nums text-lib-text-muted">
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   LibrarySpine — 2026 redesign
   Volume pill selector → Part accordion → Chapter list.
   Single unified sidebar with TOC slot.
═══════════════════════════════════════════════════════════ */

export function LibrarySpine({ tree, microNav, isOpen, tocContent, onClose }: LibrarySpineProps) {
  /* ── Derived active state ── */
  const activeVolume = tree.find((v) =>
    v.parts.some((p) => p.chapters.some((ch) => ch.isActive)),
  )?.volume;

  const [selectedVolume, setSelectedVolume] = useState<number>(
    activeVolume ?? tree[0]?.volume ?? 1,
  );

  const activePartKeys = useMemo(
    () =>
      new Set(
        tree.flatMap((v) =>
          v.parts.filter((p) => p.chapters.some((ch) => ch.isActive)).map((p) => p.key),
        ),
      ),
    [tree],
  );

  const [openParts, setOpenParts] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      tree.flatMap((v) => v.parts.map((p) => [p.key, activePartKeys.has(p.key)] as const)),
    ),
  );

  /* ── Totals ── */
  const totalChapters = useMemo(
    () => tree.reduce((sum, v) => sum + v.parts.reduce((acc, p) => acc + p.totalCount, 0), 0),
    [tree],
  );
  const totalRead = useMemo(
    () => tree.reduce((sum, v) => sum + v.parts.reduce((acc, p) => acc + p.readCount, 0), 0),
    [tree],
  );
  const globalPct = totalChapters > 0 ? (totalRead / totalChapters) * 100 : 0;

  const currentVolume = tree.find((v) => v.volume === selectedVolume);

  // Auto-switch to active volume when it changes
  useEffect(() => {
    if (activeVolume !== undefined) setSelectedVolume(activeVolume);
  }, [activeVolume]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[134] bg-black/30 backdrop-blur-[2px] animate-in fade-in duration-200"
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-[135] h-dvh w-[300px] overflow-y-auto",
          "border-e border-lib-border bg-lib-surface shadow-2xl",
          "animate-in slide-in-from-right duration-300",
        )}
      >
      {/* ════ Header ════ */}
      <div className="px-4 pb-4 pt-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lib-md bg-lib-accent-soft">
            <BookOpen className="h-[18px] w-[18px] text-lib-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold tracking-tight text-lib-text">Campbell-Walsh</div>
            <div className="mt-0.5 text-[10px] tabular-nums text-lib-text-muted">
              {toPersianNum(totalRead)} / {toPersianNum(totalChapters)} فصل
            </div>
          </div>
        </div>

        {/* Global progress */}
        <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-lib-hover">
          <div
            className="h-full rounded-full bg-lib-accent transition-[width] duration-lib-spring ease-lib-spring"
            style={{ width: `${globalPct}%` }}
          />
        </div>
      </div>

      {/* ════ Volume selector (pill row) ════ */}
      <div className="px-3 pb-3">
        <div className="flex gap-1 rounded-lib-md bg-lib-hover p-1">
          {tree.map((v) => {
            const isSelected = selectedVolume === v.volume;
            const volRead = v.parts.reduce((acc, p) => acc + p.readCount, 0);
            const volTotal = v.parts.reduce((acc, p) => acc + p.totalCount, 0);
            return (
              <button
                key={v.volume}
                type="button"
                onClick={() => setSelectedVolume(v.volume)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 rounded-lib-sm px-1 py-2 transition-all duration-lib-spring",
                  isSelected
                    ? "bg-lib-accent text-lib-accent-fg shadow-sm"
                    : "text-lib-text-muted hover:text-lib-text",
                )}
              >
                <span className="text-[11px] font-bold leading-none">
                  جلد {toPersianNum(v.volume)}
                </span>
                <span className={cn(
                  "text-[9px] tabular-nums leading-none",
                  isSelected ? "text-lib-accent-fg/70" : "text-lib-text-muted/50",
                )}>
                  {toPersianNum(volRead)}/{toPersianNum(volTotal)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ════ TOC slot (On This Page / Yield) ════ */}
      {tocContent && (
        <div className="border-y border-lib-border-subtle">{tocContent}</div>
      )}

      {/* ════ Parts & Chapters ════ */}
      {currentVolume && (
        <div className="px-2 py-2">
          {currentVolume.parts.map((part) => {
            const isPartOpen = openParts[part.key] ?? false;
            const pct = part.totalCount > 0 ? (part.readCount / part.totalCount) * 100 : 0;

            return (
              <div key={part.key} className="mb-1">
                {/* Part header */}
                <button
                  type="button"
                  onClick={() => setOpenParts((c) => ({ ...c, [part.key]: !isPartOpen }))}
                  className="group flex w-full items-center gap-2.5 rounded-lib-md px-2.5 py-3 text-start transition-colors duration-lib-fade hover:bg-lib-hover"
                >
                  {/* Chevron — rotation-based expand/collapse */}
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform duration-lib-spring",
                      isPartOpen
                        ? "text-lib-accent"
                        : "rotate-90 text-lib-text-muted",
                    )}
                  />

                  <div className="min-w-0 flex-1">
                    <div dir="ltr" className="text-left text-[13px] font-semibold leading-snug text-lib-text">
                      {part.part}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-lib-hover">
                        <div
                          className="h-full rounded-full bg-lib-accent transition-[width] duration-lib-spring ease-lib-spring"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-[10px] tabular-nums text-lib-text-muted">
                        {toPersianNum(part.readCount)}/{toPersianNum(part.totalCount)}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Chapter list */}
                {isPartOpen && (
                  <div className="ms-[11px] space-y-px border-s-2 border-lib-accent/15 pb-1 ps-2.5 pt-0.5">
                    {part.chapters.map((chapter) => {
                      const inner = (
                        <>
                          <span
                            className={cn(
                              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold tabular-nums leading-none",
                              chapter.isActive
                                ? "bg-lib-accent text-lib-accent-fg"
                                : "bg-lib-accent-soft text-lib-accent",
                            )}
                          >
                            {toPersianNum(chapter.chapterNo)}
                          </span>
                          <span
                            dir="ltr"
                            className={cn(
                              "min-w-0 flex-1 text-left text-[13px] leading-relaxed line-clamp-2",
                              chapter.isActive
                                ? "font-semibold text-lib-accent"
                                : chapter.isLinked
                                  ? "text-lib-text"
                                  : "text-lib-text-muted",
                            )}
                          >
                            {chapter.title}
                          </span>
                          <StatusDot status={chapter.status} />
                        </>
                      );

                      return (
                        <Fragment key={chapter.chapterNo}>
                          {!chapter.isLinked || !chapter.href ? (
                            <div className="flex items-center gap-2.5 rounded-lib-sm px-2.5 py-2 opacity-40">
                              {inner}
                            </div>
                          ) : (
                            <Link
                              href={chapter.href}
                              className={cn(
                                "flex min-h-[var(--lib-touch-min)] items-center gap-2.5 rounded-lib-sm px-2.5 py-2",
                                "transition-all duration-lib-fade",
                                chapter.isActive
                                  ? "bg-lib-active shadow-[inset_-3px_0_0_var(--lib-accent)]"
                                  : "hover:bg-lib-hover",
                              )}
                            >
                              {inner}
                            </Link>
                          )}
                          {chapter.isActive && microNav && microNav.items.length > 0 && (
                            <MicroNavList microNav={microNav} />
                          )}
                        </Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </aside>
    </>
  );
}
