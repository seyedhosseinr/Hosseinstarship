"use client";

import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { BookOpen, HelpCircle, Layers, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { sectionSlug } from "@/lib/utils/section-slug";
import type { YieldCardViewModel, YieldSectionGroup, YieldViewModel } from "@/lib/yield/types";
import { YieldToc } from "./YieldToc";

// ---------------------------------------------------------------------------
// YieldCard
// ---------------------------------------------------------------------------

interface YieldCardProps {
  card: YieldCardViewModel;
  onJumpToNote?: (anchorHint: string, sourceDocId: string) => void;
  onOpenMCQ?: (chapterNo: number) => void;
  onOpenFlashcards?: (chapterNo: number) => void;
}

function YieldCard({ card, onJumpToNote, onOpenMCQ, onOpenFlashcards }: YieldCardProps) {
  const isHighYieldCard = card.tier >= 3 || card.isKeyExam || card.isHighYield;

  return (
    <article
      id={`yield-card-${card.id}`}
      className={cn(
        "rounded-lg border bg-card p-4",
        isHighYieldCard
          ? "border-warning/30 ring-1 ring-warning/20 dark:border-warning/40 dark:ring-warning/20"
          : "border-border/40",
      )}
    >
      {/* High-yield prominence badges */}
      {isHighYieldCard && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning dark:border-warning/40 dark:bg-warning/10 dark:text-warning">
            <Star className="h-3 w-3 fill-warning text-warning" />
            High Yield
          </span>
          {card.isKeyExam && (
            <span className="rounded-full border border-danger/30 bg-danger/10 px-2.5 py-0.5 text-xs font-medium text-danger dark:border-danger/40 dark:bg-danger/10 dark:text-danger">
              Key Exam
            </span>
          )}
        </div>
      )}

      {/* Primary heading — strongest text in card */}
      <h3 className="text-[15px] font-semibold leading-snug text-foreground">
        {card.title}
      </h3>

      {/* Section subtitle — lower emphasis */}
      {card.allSectionTitles.length > 0 && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {card.allSectionTitles.join(" · ")}
        </p>
      )}

      {/* Tier indicator — subtle three-dot bar */}
      <div className="mt-3 flex items-center gap-1">
        {[1, 2, 3].map((t) => (
          <span
            key={t}
            className={cn(
              "h-1.5 w-5 rounded-full",
              t <= card.tier ? "bg-info" : "bg-muted",
            )}
          />
        ))}
        <span className="mr-2 text-xs text-muted-foreground/60">Tier {card.tier}</span>
      </div>

      {/* Tag areas */}
      {(card.conceptLabels.length > 0 || card.reasons.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {card.conceptLabels.map((label) => (
            <span
              key={label}
              className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {label}
            </span>
          ))}
          {card.reasons.map((reason) => (
            <span
              key={reason}
              className="rounded-md border border-info/30 bg-info/10 px-2 py-0.5 text-xs text-info"
            >
              {reason}
            </span>
          ))}
        </div>
      )}

      {/* Action links — jump to source note / MCQ / flashcard */}
      <div className="mt-3 flex items-center gap-4 border-t border-border/40 pt-3">
        {card.sourceNoteId && onJumpToNote && (
          <button
            type="button"
            onClick={() =>
              onJumpToNote(card.anchorHints[0] ?? "", card.sourceNoteId!)
            }
            className="inline-flex items-center gap-1 text-xs text-info transition-colors hover:text-info/80"
          >
            <BookOpen className="h-3 w-3" />
            یادداشت
          </button>
        )}
        {onOpenMCQ && (
          <button
            type="button"
            onClick={() => onOpenMCQ(card.chapterNo)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <HelpCircle className="h-3 w-3" />
            MCQ
          </button>
        )}
        {onOpenFlashcards && (
          <button
            type="button"
            onClick={() => onOpenFlashcards(card.chapterNo)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Layers className="h-3 w-3" />
            فلش‌کارت
          </button>
        )}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// YieldSectionBlock
// ---------------------------------------------------------------------------

function YieldSectionBlock({
  section,
  onJumpToNote,
  onOpenMCQ,
  onOpenFlashcards,
}: {
  section: YieldSectionGroup;
  onJumpToNote?: YieldCardProps["onJumpToNote"];
  onOpenMCQ?: YieldCardProps["onOpenMCQ"];
  onOpenFlashcards?: YieldCardProps["onOpenFlashcards"];
}) {
  return (
    <section
      id={sectionSlug(section.sectionTitle)}
      data-section-title={section.sectionTitle}
      className="scroll-mt-6"
    >
      <header className="mb-5 pb-3 border-b border-border/40">
        <h2 className="text-[15px] font-semibold leading-snug text-foreground">
          {section.sectionTitle}
        </h2>
        <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">
          {section.cards.length} {section.cards.length === 1 ? "card" : "cards"}
        </p>
      </header>

      <div className="space-y-3">
        {section.cards.map((card) => (
          <YieldCard
            key={card.id}
            card={card}
            onJumpToNote={onJumpToNote}
            onOpenMCQ={onOpenMCQ}
            onOpenFlashcards={onOpenFlashcards}
          />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// YieldTab — main exported component
// ---------------------------------------------------------------------------

interface YieldTabProps {
  yieldData: YieldViewModel;
  /** The parent scroll container — used for IntersectionObserver scrollspy */
  scrollContainerRef?: RefObject<HTMLElement | null>;
  /** Called when scrollspy detects a new active section */
  onActiveSectionChange?: (sectionTitle: string) => void;
  /**
   * Called when user clicks "یادداشت" on a card.
   * @param anchorHint  - source note anchor hint (may be empty string)
   * @param sourceDocId - docId of the linked note document
   */
  onJumpToNote?: (anchorHint: string, sourceDocId: string) => void;
  onOpenMCQ?: (chapterNo: number) => void;
  onOpenFlashcards?: (chapterNo: number) => void;
}

export function YieldTab({
  yieldData,
  scrollContainerRef,
  onActiveSectionChange,
  onJumpToNote,
  onOpenMCQ,
  onOpenFlashcards,
}: YieldTabProps) {
  const [activeSectionTitle, setActiveSectionTitle] = useState<string | null>(
    yieldData.sections[0]?.sectionTitle ?? null,
  );

  const contentRef = useRef<HTMLDivElement>(null);

  /* ── Scrollspy: update active section as user scrolls ── */
  useEffect(() => {
    if (yieldData.sections.length === 0) return;
    const root = scrollContainerRef?.current ?? null;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const first = visible[0]?.target;
        if (first instanceof HTMLElement && first.dataset.sectionTitle) {
          const title = first.dataset.sectionTitle;
          setActiveSectionTitle(title);
          onActiveSectionChange?.(title);
        }
      },
      { root, rootMargin: "-20% 0px -60% 0px", threshold: 0 },
    );

    yieldData.sections.forEach((section) => {
      const el = document.getElementById(sectionSlug(section.sectionTitle));
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [yieldData.sections, scrollContainerRef, onActiveSectionChange]);

  const handleSelectSection = (sectionTitle: string) => {
    setActiveSectionTitle(sectionTitle);
    onActiveSectionChange?.(sectionTitle);
    const el = document.getElementById(sectionSlug(sectionTitle));
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Empty state
  if (yieldData.totalCards === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Star className="mb-4 h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground">
          No Yield annotations for this chapter yet
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          High-yield review cards will appear here once generated.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-w-0">
      {/* Right-side section navigation (shown via flex — renders to the right in RTL) */}
      <YieldToc
        sections={yieldData.sections}
        activeSectionTitle={activeSectionTitle}
        onSelectSection={handleSelectSection}
      />

      {/* Main card list */}
      <div ref={contentRef} className="min-w-0 flex-1">
        <div className="mx-auto max-w-[680px] space-y-10">
          {yieldData.sections.map((section) => (
            <YieldSectionBlock
              key={section.sectionTitle}
              section={section}
              onJumpToNote={onJumpToNote}
              onOpenMCQ={onOpenMCQ}
              onOpenFlashcards={onOpenFlashcards}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
