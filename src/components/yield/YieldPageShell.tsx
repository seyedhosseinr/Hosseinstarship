"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { YieldSectionGroup } from "@/lib/yield/types";
import { YieldTab } from "./YieldTab";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChapterYieldEntry {
  chapterNo: number;
  chapterTitle: string;
  sections: YieldSectionGroup[];
  totalCards: number;
}

interface YieldPageShellProps {
  chapters: ChapterYieldEntry[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function YieldPageShell({ chapters }: YieldPageShellProps) {
  const [activeChapterNo, setActiveChapterNo] = useState<number>(
    chapters[0]?.chapterNo ?? 0,
  );

  if (chapters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <Star className="mb-5 h-12 w-12 text-muted-foreground/30" />
        <h2 className="text-lg font-semibold text-foreground">No Yield annotations yet</h2>
        <p className="mt-2 max-w-[340px] text-sm text-muted-foreground">
          Import and process chapter content to generate high-yield review cards.
          They will appear here once available.
        </p>
      </div>
    );
  }

  const activeEntry = chapters.find((c) => c.chapterNo === activeChapterNo) ?? chapters[0]!;

  return (
    <div className="flex min-h-[600px]">
      {/* ── Left: chapter selector ── */}
      <aside className="sticky top-[86px] hidden h-[calc(100vh-110px)] w-[228px] shrink-0 overflow-y-auto border-r border-border/60 bg-background/50 lg:block">
        <div className="border-b border-border/60 px-4 pb-3 pt-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
            Chapters
          </div>
        </div>
        <nav className="px-2 py-2">
          {chapters.map((ch) => {
            const isActive = ch.chapterNo === activeChapterNo;
            return (
              <button
                key={ch.chapterNo}
                type="button"
                onClick={() => setActiveChapterNo(ch.chapterNo)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-md px-2.5 py-[7px] text-left transition-colors duration-150",
                  isActive
                    ? "font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
                style={
                  isActive
                    ? {
                        boxShadow: "inset 2px 0 0 hsl(var(--primary))",
                        background: "hsl(var(--primary) / 0.07)",
                      }
                    : undefined
                }
              >
                <span className="mt-px shrink-0 font-mono text-[10px] tabular-nums leading-none opacity-50">
                  {String(ch.chapterNo).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11px] leading-snug">
                  {ch.chapterTitle}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-1.5 py-px text-[9px] font-semibold tabular-nums",
                    ch.totalCards >= 10
                      ? "border-warning/30 bg-warning/10 text-warning dark:border-warning/40 dark:bg-warning/10 dark:text-warning"
                      : "border-border/60 bg-muted/50 text-muted-foreground",
                  )}
                >
                  {ch.totalCards}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ── Main: active chapter yield content ── */}
      <div className="min-w-0 flex-1 px-6 py-4">
        <div className="mb-4 pb-3 border-b border-border/50">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
            Ch. {activeEntry.chapterNo}
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
            {activeEntry.chapterTitle}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {activeEntry.totalCards} high-yield{" "}
            {activeEntry.totalCards === 1 ? "card" : "cards"} ·{" "}
            {activeEntry.sections.length}{" "}
            {activeEntry.sections.length === 1 ? "section" : "sections"}
          </p>
        </div>

        {/* Reuse YieldTab — key forces remount when chapter changes */}
        <YieldTab
          key={activeChapterNo}
          yieldData={{
            chapterNo: activeEntry.chapterNo,
            docId: null,
            sections: activeEntry.sections,
            totalCards: activeEntry.totalCards,
          }}
        />
      </div>
    </div>
  );
}
