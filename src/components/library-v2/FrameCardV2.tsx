"use client";

import React from "react";
import { ArrowRight, MessageSquare, Sparkles } from "lucide-react";
import type { FrameViewModel } from "@/lib/contract/note-viewer.types";
import type { CalloutV8 } from "@/lib/contract/note-v8.types";
import type { FrameKind } from "@/lib/contract/types";
import type { ReaderAnnotation } from "@/hooks/useReaderAnnotations";
import { cn } from "@/lib/utils";
import { FrameBody } from "@/components/note-viewer/FrameBody";
import { FrameMermaid } from "@/components/note-viewer/FrameMermaid";
import { FrameAlgorithmGraph } from "@/components/note-viewer/FrameAlgorithmGraph";
import { renderInlineRich } from "@/components/note-viewer/inlineRich";
import { FrameContextChip } from "./FrameContextChip";

type ReaderCSS = React.CSSProperties & {
  textWrap?: "balance" | "pretty" | "wrap" | "nowrap";
  unicodeBidi?:
    | "normal"
    | "embed"
    | "isolate"
    | "bidi-override"
    | "isolate-override"
    | "plaintext";
};

/* ═══════════════════════════════════════════════════════════════════
   FrameCardV2 — v4 (Persian-dominant, dedup-enforced)
   ─────────────────────────────────────────────────────────────────
   Two surfaces per frame:
     1. CALLOUT — heavy-emphasis kinds. Subtle tinted bg + 3px
        inline-start accent bar + emoji gutter + micro eyebrow.
     2. PLAIN   — concept / differential / algorithm / interactive_
        algorithm. No card chrome.

   v4 changes (from user feedback on v3 screenshots):
   ──────────────────────────────────────────────
   • REMOVED `dir="auto"` from every text-bearing element (h3,
     summary <p>, pearl, margin, related-question stems). The Persian
     reader should be ambient-RTL; auto-detection on a paragraph that
     opens with "Greater vs Lesser sciatic foramen" was flipping the
     whole heading to English-dominant.

   • Explicit `dir="ltr"` KEPT on: eyebrow chips, high-yield chip,
     annotation count badge, flag badges, related-question counter.
     These are always English tokens, and fixing their direction
     prevents punctuation/numeric quirks in RTL contexts.

   • Heavy strong weights (720 in body-level callout titles, 780 in
     plain h3). Paired with inlineRich v2 stripping the hardcoded
     600-weight class, this finally reads as visibly bold in
     Vazirmatn-style Persian fonts.

   • Content dedup retained: summary, v8 callouts, pearl, margin —
     all filtered against body content so the user never sees the
     same prose three times (bug from v2 screenshots).

   • Line-height lifted slightly in title + summary for Persian
     breathing room.
═══════════════════════════════════════════════════════════════════ */

const KIND_LABELS: Record<FrameKind, string> = {
  core: "Core",
  pearl: "Pearl",
  warning: "Warning",
  pitfall: "Pitfall",
  keypoint: "Key Point",
  concept: "Concept",
  trap: "Exam Trap",
  threshold: "Threshold",
  indication: "Indication",
  differential: "Differential",
  algorithm: "Algorithm",
  clinical_decision: "Clinical Decision",
  complication: "Complication",
  follow_up: "Follow-up",
  high_yield: "High Yield",
  interactive_algorithm: "Interactive Algorithm",
};

interface CalloutStyle {
  bg: string;
  accent: string;
  label: string;
  emoji: string;
  labelText: string;
}

const CALLOUT_FOR_KIND: Partial<Record<FrameKind, CalloutStyle>> = {
  high_yield: {
    bg: "bg-[rgba(252,231,168,0.30)] dark:bg-[rgba(120,95,18,0.18)]",
    accent: "border-s-[rgb(196,142,0)] dark:border-s-amber-400/80",
    label: "text-[rgb(130,92,6)] dark:text-amber-300",
    emoji: "⭐",
    labelText: KIND_LABELS.high_yield,
  },
  pearl: {
    bg: "bg-[rgba(252,231,168,0.22)] dark:bg-[rgba(120,95,18,0.14)]",
    accent: "border-s-[rgb(196,142,0)]/80 dark:border-s-amber-400/70",
    label: "text-[rgb(130,92,6)] dark:text-amber-300",
    emoji: "💡",
    labelText: KIND_LABELS.pearl,
  },
  keypoint: {
    bg: "bg-[rgba(209,232,210,0.32)] dark:bg-[rgba(45,78,48,0.22)]",
    accent: "border-s-[rgb(52,125,62)] dark:border-s-emerald-400/80",
    label: "text-[rgb(44,105,52)] dark:text-emerald-300",
    emoji: "✨",
    labelText: KIND_LABELS.keypoint,
  },
  warning: {
    bg: "bg-[rgba(252,215,215,0.32)] dark:bg-[rgba(118,36,36,0.22)]",
    accent: "border-s-[rgb(190,48,48)] dark:border-s-rose-400/80",
    label: "text-[rgb(165,42,42)] dark:text-rose-300",
    emoji: "⚠️",
    labelText: KIND_LABELS.warning,
  },
  pitfall: {
    bg: "bg-[rgba(252,215,215,0.32)] dark:bg-[rgba(118,36,36,0.22)]",
    accent: "border-s-[rgb(190,48,48)] dark:border-s-rose-400/80",
    label: "text-[rgb(165,42,42)] dark:text-rose-300",
    emoji: "🚧",
    labelText: KIND_LABELS.pitfall,
  },
  trap: {
    bg: "bg-[rgba(252,215,215,0.32)] dark:bg-[rgba(118,36,36,0.22)]",
    accent: "border-s-[rgb(190,48,48)] dark:border-s-rose-400/80",
    label: "text-[rgb(165,42,42)] dark:text-rose-300",
    emoji: "🚨",
    labelText: KIND_LABELS.trap,
  },
  complication: {
    bg: "bg-[rgba(252,220,190,0.32)] dark:bg-[rgba(130,72,26,0.22)]",
    accent: "border-s-[rgb(180,90,18)] dark:border-s-orange-400/80",
    label: "text-[rgb(160,80,18)] dark:text-orange-300",
    emoji: "💥",
    labelText: KIND_LABELS.complication,
  },
  threshold: {
    bg: "bg-[rgba(232,226,244,0.32)] dark:bg-[rgba(82,62,104,0.22)]",
    accent: "border-s-[rgb(128,90,170)] dark:border-s-violet-400/80",
    label: "text-[rgb(120,82,160)] dark:text-violet-300",
    emoji: "📐",
    labelText: KIND_LABELS.threshold,
  },
  indication: {
    bg: "bg-[rgba(209,232,210,0.32)] dark:bg-[rgba(45,90,54,0.22)]",
    accent: "border-s-[rgb(52,135,70)] dark:border-s-emerald-400/80",
    label: "text-[rgb(46,125,62)] dark:text-emerald-300",
    emoji: "✅",
    labelText: KIND_LABELS.indication,
  },
  clinical_decision: {
    bg: "bg-[rgba(210,232,244,0.32)] dark:bg-[rgba(32,78,108,0.22)]",
    accent: "border-s-[rgb(32,125,172)] dark:border-s-sky-400/80",
    label: "text-[rgb(32,118,162)] dark:text-sky-300",
    emoji: "🩺",
    labelText: KIND_LABELS.clinical_decision,
  },
  follow_up: {
    bg: "bg-[rgba(210,232,244,0.24)] dark:bg-[rgba(32,78,108,0.16)]",
    accent: "border-s-[rgb(32,125,172)]/75 dark:border-s-sky-400/70",
    label: "text-[rgb(32,118,162)] dark:text-sky-300",
    emoji: "📅",
    labelText: KIND_LABELS.follow_up,
  },
};

const PLAIN_EYEBROW: Partial<
  Record<FrameKind, { emoji: string; label: string; accent: string }>
> = {
  differential: {
    emoji: "🔀",
    label: KIND_LABELS.differential,
    accent: "text-indigo-700/80 dark:text-indigo-300/85",
  },
  algorithm: {
    emoji: "🌳",
    label: KIND_LABELS.algorithm,
    accent: "text-violet-700/80 dark:text-violet-300/85",
  },
  interactive_algorithm: {
    emoji: "🧭",
    label: KIND_LABELS.interactive_algorithm,
    accent: "text-teal-700/80 dark:text-teal-300/85",
  },
};

const proseStyle: ReaderCSS = {
  textAlign: "start",
  textWrap: "pretty",
  overflowWrap: "break-word",
  wordBreak: "normal",
  lineBreak: "auto",
};

const titleStyle: ReaderCSS = {
  textWrap: "balance",
  textAlign: "start",
  overflowWrap: "break-word",
};

/* ═══════════════════════════════════════════════════════════════════
   Content dedup helpers
═══════════════════════════════════════════════════════════════════ */

function normaliseForCompare(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/\*\*|`|~~|_/g, "")
    .replace(/^\s*[—–-]+\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isDuplicateOfBody(
  secondary: string | null | undefined,
  body: string | null | undefined,
): boolean {
  const s = normaliseForCompare(secondary);
  const b = normaliseForCompare(body);
  if (!s || !b) return false;
  if (s === b) return true;
  if (s.length >= 18 && b.includes(s)) return true;
  if (b.length >= 18 && s.includes(b)) return true;
  return false;
}

/* ═══════════════════════════════════════════════════════════════════
   Main component
═══════════════════════════════════════════════════════════════════ */

interface FrameCardV2Props {
  frame: FrameViewModel;
  isHighlighted?: boolean;
  annotationCount?: number;
  annotations?: ReaderAnnotation[];
  highlightsVisible?: boolean;
  showHighYieldMarker?: boolean;
  isKeyExamFrame?: boolean;
  isMissedFrame?: boolean;
}

function FrameCardV2Impl({
  frame,
  isHighlighted = false,
  annotationCount = 0,
  annotations,
  highlightsVisible,
  showHighYieldMarker = false,
  isKeyExamFrame = false,
  isMissedFrame = false,
}: FrameCardV2Props) {
  const resolvedKind: FrameKind =
    KIND_LABELS[frame.kind as FrameKind] ? (frame.kind as FrameKind) : "core";
  const callout = CALLOUT_FOR_KIND[resolvedKind];
  const eyebrow = !callout ? PLAIN_EYEBROW[resolvedKind] : undefined;

  const markerClass = isMissedFrame
    ? "missed-question-marker"
    : isKeyExamFrame
      ? "key-exam-marker"
      : showHighYieldMarker && frame.highYield
        ? "high-yield-marker"
        : undefined;

  const dataAttrs = {
    id: frame.id,
    "data-frame-id": frame.id,
    "data-frame-kind": resolvedKind,
    "data-frame-tier": callout ? "callout" : "plain",
    "data-content-hash": frame.contentHash ?? undefined,
  };

  const bodyText = frame.content || frame.body;
  const summaryIsDup = isDuplicateOfBody(frame.summary, bodyText);
  const titleNode = frame.title ? renderInlineRich(frame.title) : null;
  const summaryNode =
    frame.summary && !summaryIsDup ? renderInlineRich(frame.summary) : null;

  const innerBody = (
    <div className="notion-block-body">
      {summaryNode && (
        <p
          className={cn(
            "mb-2 text-[14.5px] leading-[1.65] text-lib-text-muted",
            "[&_strong]:font-[800] [&_strong]:text-lib-text/95",
            "[&_em]:[font-style:oblique_12deg]",
            "[&_code]:rounded-[4px] [&_code]:border [&_code]:border-lib-border/40",
            "[&_code]:bg-lib-hover/60 [&_code]:px-1 [&_code]:py-[1px]",
            "[&_code]:font-mono [&_code]:text-[0.9em]",
          )}
          style={proseStyle}
        >
          {summaryNode}
        </p>
      )}
      <FrameRichContent
        frame={frame}
        annotations={annotations}
        highlightsVisible={highlightsVisible}
      />
      <PearlTail
        pearl={frame.clinicalPearl}
        body={bodyText}
        annotations={annotations}
        highlightsVisible={highlightsVisible}
      />
      <MarginTail
        note={frame.marginNote}
        body={bodyText}
        annotations={annotations}
        highlightsVisible={highlightsVisible}
      />
      <FrameFlagBadges frame={frame} />
      <LinkedQuestionsFooter frame={frame} compact={!!callout} />
      <FrameContextChip frame={frame} />
    </div>
  );

  /* ═══════════════════════════════════════════════════════════
     CALLOUT surface
  ═══════════════════════════════════════════════════════════ */
  if (callout) {
    return (
      <section
        {...dataAttrs}
        /* Explicit RTL: ensures flex-child order (emoji gutter +
           content column) stays correct even when an ancestor
           inherits LTR.  English chips inside carry dir="ltr"
           explicitly so they override.  This is the fix for the
           "KEY TAKEAWAY appears on the left" bug. */
        dir="rtl"
        className={cn(
          "group/frame relative scroll-mt-24",
          "rounded-[8px] border-s-[3px]",
          "border-y border-e border-black/[0.04] dark:border-white/[0.04]",
          "px-4 py-3.5",
          callout.bg,
          callout.accent,
          markerClass,
          isHighlighted && "ring-1 ring-lib-accent/40",
        )}
      >
        <div className="flex gap-3">
          <div
            aria-hidden="true"
            className="flex h-6 w-6 shrink-0 items-center justify-center pt-[1px] text-[15px] leading-none"
          >
            <span>{callout.emoji}</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span
                dir="ltr"
                className={cn(
                  "inline-flex items-center rounded-[4px] px-[6px] py-[1px]",
                  "border border-lib-border/50 bg-lib-surface/75 dark:bg-lib-surface/30",
                  "text-[9.5px] font-[700] leading-[1.6] tracking-[0.08em] uppercase",
                  callout.label,
                )}
              >
                {callout.labelText}
              </span>
              {titleNode && (
                <h3
                  className={cn(
                    "text-[16.5px] font-[700] leading-[1.5] tracking-[-0.006em] text-lib-text",
                    "[&_strong]:font-[780] [&_strong]:text-lib-text",
                    "[&_em]:[font-style:oblique_12deg]",
                  )}
                  style={titleStyle}
                >
                  {titleNode}
                </h3>
              )}
              {annotationCount > 0 && (
                <span
                  dir="ltr"
                  className={cn(
                    "ms-auto inline-flex h-[18px] min-w-[18px] items-center justify-center",
                    "rounded-full border border-lib-border/60 bg-lib-surface/80",
                    "px-1.5 text-[10px] font-[600] tabular-nums text-lib-text-muted/90",
                  )}
                >
                  {annotationCount}
                </span>
              )}
            </div>
            {innerBody}
          </div>
        </div>
      </section>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     PLAIN surface
  ═══════════════════════════════════════════════════════════ */
  return (
    <section
      {...dataAttrs}
      /* Same explicit RTL as the callout branch — keeps eyebrow
         chip + title row ordered correctly in RTL reading flow. */
      dir="rtl"
      className={cn(
        "relative scroll-mt-24",
        markerClass && "rounded-[6px] px-3 py-2",
        markerClass,
        isHighlighted && "rounded-[6px] bg-sky-50/40 px-3 py-2 dark:bg-sky-950/15",
      )}
    >
      {annotationCount > 0 && (
        <span
          className={cn(
            "absolute -start-1 top-2 flex h-3.5 w-3.5 items-center justify-center",
            "rounded-full bg-lib-accent/12",
          )}
          aria-label={`${annotationCount} annotation${annotationCount !== 1 ? "s" : ""}`}
        >
          <MessageSquare className="h-2 w-2 text-lib-accent/70" />
        </span>
      )}

      {(eyebrow || titleNode) && (
        <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          {eyebrow && (
            <span
              dir="ltr"
              className={cn(
                "inline-flex items-center gap-1 rounded-[4px] px-[6px] py-[1px]",
                "border border-lib-border/50 bg-lib-surface/75 dark:bg-lib-surface/30",
                "text-[9.5px] font-[700] leading-[1.6] tracking-[0.08em] uppercase",
                eyebrow.accent,
              )}
            >
              <span aria-hidden="true" className="text-[10px]">
                {eyebrow.emoji}
              </span>
              <span>{eyebrow.label}</span>
            </span>
          )}
          {showHighYieldMarker && frame.highYield && (
            <span
              dir="ltr"
              className={cn(
                "inline-flex items-center gap-1 rounded-[4px] px-[6px] py-[1px]",
                "border border-amber-500/20 bg-amber-500/[0.06]",
                "text-[9.5px] font-[700] leading-[1.6] tracking-[0.08em] uppercase",
                "text-amber-700 dark:text-amber-300",
              )}
              aria-label="High yield"
            >
              <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
              <span>High yield</span>
            </span>
          )}
          {titleNode && (
            <h3
              className={cn(
                "text-[19.5px] font-[700] leading-[1.42] tracking-[-0.01em] text-lib-text",
                "[&_strong]:font-[780] [&_strong]:text-lib-text",
                "[&_em]:[font-style:oblique_12deg]",
              )}
              style={titleStyle}
            >
              {titleNode}
            </h3>
          )}
        </div>
      )}
      {innerBody}
    </section>
  );
}

export const FrameCardV2 = React.memo(FrameCardV2Impl, (prev, next) =>
  prev.frame.id === next.frame.id &&
  prev.annotationCount === next.annotationCount &&
  prev.annotations === next.annotations &&
  prev.highlightsVisible === next.highlightsVisible &&
  prev.isHighlighted === next.isHighlighted &&
  prev.showHighYieldMarker === next.showHighYieldMarker &&
  prev.isKeyExamFrame === next.isKeyExamFrame &&
  prev.isMissedFrame === next.isMissedFrame,
);

/* ═══════════════════════════════════════════════════════════════════
   PearlTail
═══════════════════════════════════════════════════════════════════ */

function PearlTail({
  pearl,
  body,
  annotations,
  highlightsVisible,
}: {
  pearl: string | null | undefined;
  body: string | null | undefined;
  annotations?: ReaderAnnotation[];
  highlightsVisible?: boolean;
}) {
  if (!pearl?.trim()) return null;
  if (isDuplicateOfBody(pearl, body)) return null;
  return (
    <div
      data-frame-pearl
      /* Explicit RTL — same belt-and-suspenders rationale as
         FrameCallouts: guarantees layout regardless of ancestor. */
      dir="rtl"
      className={cn(
        "mt-3 flex gap-2.5 rounded-[6px]",
        "border-s-[2px] border-amber-500/50 dark:border-amber-400/50",
        "bg-amber-500/[0.05] dark:bg-amber-400/[0.06]",
        "px-3 py-2",
      )}
    >
      <div
        aria-hidden="true"
        className="flex h-5 w-5 shrink-0 items-center justify-center text-[13px] leading-none"
      >
        💡
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5">
          <span
            dir="ltr"
            className={cn(
              "text-[9.5px] font-[700] tracking-[0.08em] uppercase leading-none",
              "text-amber-700 dark:text-amber-300",
            )}
          >
            Clinical Pearl
          </span>
        </div>
        <div className="text-[13.5px] leading-[1.62] text-lib-text/92">
          <FrameBody body={pearl} compact />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MarginTail
═══════════════════════════════════════════════════════════════════ */

function MarginTail({
  note,
  body,
  annotations,
  highlightsVisible,
}: {
  note: string | null | undefined;
  body: string | null | undefined;
  annotations?: ReaderAnnotation[];
  highlightsVisible?: boolean;
}) {
  if (!note?.trim()) return null;
  if (isDuplicateOfBody(note, body)) return null;
  return (
    <div
      data-frame-margin-note
      /* Explicit RTL to match PearlTail / FrameCallouts. */
      dir="rtl"
      className={cn(
        "mt-2.5 border-s-[2px] border-lib-border/60 ps-3 pe-1 py-0.5",
        "text-[13.5px] leading-[1.6] text-lib-text/85",
        "[&_strong]:font-[800] [&_em]:[font-style:oblique_12deg]",
      )}
    >
      <FrameBody body={note} compact />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Rich content surface
═══════════════════════════════════════════════════════════════════ */

function FrameRichContent({
  frame,
  annotations,
  highlightsVisible,
}: Pick<FrameCardV2Props, "annotations" | "highlightsVisible"> & {
  frame: FrameViewModel;
}) {
  const hasInteractive = !!frame.interactiveData;
  return (
    <>
      {frame.mermaid && !hasInteractive && <FrameMermaid code={frame.mermaid} />}
      {hasInteractive && <FrameAlgorithmGraph data={frame.interactiveData!} />}
      {hasInteractive && frame.mermaid && (
        <details
          data-mermaid-fallback="true"
          className={cn(
            "mt-2.5 rounded-[6px] border border-lib-border/50",
            "bg-lib-surface/50 dark:bg-lib-surface/20",
          )}
        >
          <summary
            className={cn(
              "flex cursor-pointer list-none items-center gap-2 px-3 py-1.5",
              "text-[11.5px] font-[600] text-lib-text-muted",
              "transition hover:text-lib-text",
              "[&::-webkit-details-marker]:hidden",
            )}
          >
            <span aria-hidden="true">🌳</span>
            <span>Diagram overview</span>
            <ArrowRight
              aria-hidden="true"
              className="ms-auto h-3 w-3 opacity-60 rtl:rotate-180"
            />
          </summary>
          <div className="border-t border-lib-border/40 p-2">
            <FrameMermaid code={frame.mermaid} />
          </div>
        </details>
      )}
      <PlainTable
        frame={frame}
        annotations={annotations}
        highlightsVisible={highlightsVisible}
      />
      <PlainListItems
        frame={frame}
        annotations={annotations}
        highlightsVisible={highlightsVisible}
      />
      <CanonicalContentSurface
        frame={frame}
        annotations={annotations}
        highlightsVisible={highlightsVisible}
      />
      <FrameCallouts
        callouts={frame.v8Display?.callouts}
        body={frame.content || frame.body}
        annotations={annotations}
        annotationsVisible={highlightsVisible}
      />
    </>
  );
}

function CanonicalContentSurface({
  frame,
  annotations,
  highlightsVisible,
}: Pick<FrameCardV2Props, "annotations" | "highlightsVisible"> & {
  frame: FrameViewModel;
}) {
  const body = frame.content || frame.body;
  if (!body?.trim()) return null;

  return (
    <div
      data-anchor-surface="canonical"
      data-content-hash={frame.contentHash ?? undefined}
    >
      <FrameBody
        body={body}
        anchorPrimary={!frame.hasStructuralReformat}
      />
    </div>
  );
}

function FrameFlagBadges({ frame }: { frame: FrameViewModel }) {
  const badges: string[] = [];
  if (frame.v8Flags?.highYield ?? frame.highYield) badges.push("High-yield");
  if (frame.v8Flags?.decisionChanging) badges.push("Decision changing");
  if (frame.v8Flags?.examRelevant) badges.push("Exam relevant");
  if (!badges.length) return null;

  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {badges.map((badge) => (
        <span
          key={badge}
          dir="ltr"
          className={cn(
            "inline-flex items-center rounded-[4px]",
            "border border-lib-border/50 bg-lib-surface/60",
            "px-[6px] py-[1px] text-[10px] font-[600] text-lib-text-muted",
            "tracking-[0.015em]",
          )}
        >
          {badge}
        </span>
      ))}
    </div>
  );
}

function PlainListItems({
  frame,
  annotations,
  highlightsVisible,
}: Pick<FrameCardV2Props, "annotations" | "highlightsVisible"> & {
  frame: FrameViewModel;
}) {
  if (!frame.listItems?.length) return null;
  return (
    <ul
      className={cn(
        /* CSS variable for fullscreen-aware width control.
           Default: 70ch. App can set `--reader-prose-w` on an
           ancestor (e.g. document root in fullscreen) to widen. */
        "mx-auto mt-2 max-w-[var(--reader-prose-w,70ch)] list-disc space-y-[6px] ps-6",
        "text-[15.5px] leading-[1.65] text-lib-text/92",
        "marker:text-lib-text-muted/50",
        "[&_strong]:font-[800] [&_strong]:text-lib-text",
        "[&_em]:[font-style:oblique_12deg]",
      )}
      style={proseStyle}
    >
      {frame.listItems.map((item, i) => (
        <li key={i}>
          <FrameBody body={item} compact />
        </li>
      ))}
    </ul>
  );
}

function PlainTable({
  frame,
  annotations,
  highlightsVisible,
}: Pick<FrameCardV2Props, "annotations" | "highlightsVisible"> & {
  frame: FrameViewModel;
}) {
  if (!frame.tableData) return null;
  return (
    <FrameTable
      headers={frame.tableData.headers}
      rows={frame.tableData.rows}
    />
  );
}

function LinkedQuestionsFooter({
  frame,
  compact = false,
}: {
  frame: FrameViewModel;
  compact?: boolean;
}) {
  if (!frame.linkedQuestions.length) return null;
  return (
    <details className="group/related mt-2.5">
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-2 py-1",
          "text-lib-text-muted/90 transition-colors hover:text-lib-text",
          "[&::-webkit-details-marker]:hidden",
          compact ? "text-[11.5px]" : "text-[12px]",
        )}
      >
        <span
          dir="ltr"
          className={cn(
            "inline-flex h-[16px] min-w-[16px] items-center justify-center",
            "rounded-full border border-lib-border/60 bg-lib-surface/60",
            "px-1 text-[10px] font-[600] tabular-nums",
            "text-lib-text-secondary",
          )}
        >
          {frame.linkedQuestions.length}
        </span>
        <span className="font-[600]">
          related question{frame.linkedQuestions.length !== 1 ? "s" : ""}
        </span>
        <ArrowRight
          aria-hidden="true"
          className={cn(
            "ms-auto h-3 w-3 opacity-55 transition-transform",
            "group-open/related:rotate-90 rtl:rotate-180 rtl:group-open/related:-rotate-90",
          )}
        />
      </summary>
      <ul className="mt-1.5 space-y-[5px]">
        {frame.linkedQuestions.slice(0, 3).map((q) => (
          <li
            key={q.questionId}
            className={cn(
              "border-s-[2px] border-lib-border/55 ps-3",
              "text-[13px] leading-[1.76] text-lib-text-secondary/90",
            )}
          >
            {q.stem}
          </li>
        ))}
        {frame.linkedQuestions.length > 3 && (
          <li
            dir="ltr"
            className="ps-3 text-[12px] text-lib-text-muted/70"
          >
            +{frame.linkedQuestions.length - 3} more
          </li>
        )}
      </ul>
    </details>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FrameCallouts (v8.1) — secondary emphasis, dedup'd against body
═══════════════════════════════════════════════════════════════════ */

const CALLOUT_TONE: Record<
  CalloutV8["kind"],
  { bg: string; accent: string; label: string; emoji: string; labelText: string }
> = {
  clinical_pearl: {
    bg: "bg-amber-500/[0.06] dark:bg-amber-400/[0.07]",
    accent: "border-s-amber-500/50 dark:border-s-amber-400/50",
    label: "text-amber-700 dark:text-amber-300",
    emoji: "💡",
    labelText: "Key Takeaway",
  },
  warning: {
    bg: "bg-rose-500/[0.06] dark:bg-rose-400/[0.08]",
    accent: "border-s-rose-500/50 dark:border-s-rose-400/50",
    label: "text-rose-700 dark:text-rose-300",
    emoji: "⚠️",
    labelText: "Warning",
  },
  tip: {
    bg: "bg-sky-500/[0.06] dark:bg-sky-400/[0.07]",
    accent: "border-s-sky-500/50 dark:border-s-sky-400/50",
    label: "text-sky-700 dark:text-sky-300",
    emoji: "ℹ️",
    labelText: "Tip",
  },
};

function FrameCallouts({
  callouts,
  body,
  annotations,
  annotationsVisible,
}: {
  callouts: CalloutV8[] | null | undefined;
  body: string | null | undefined;
  annotations?: ReaderAnnotation[];
  annotationsVisible?: boolean;
}) {
  if (!callouts || callouts.length === 0) return null;

  const visible = callouts
    .filter((c) => !isDuplicateOfBody(c.text, body))
    .sort((a, b) => a.order - b.order);

  if (visible.length === 0) return null;

  return (
    <div className="mt-2.5 space-y-1.5">
      {visible.map((c, i) => {
        const tone = CALLOUT_TONE[c.kind];
        return (
          <div
            key={`${c.kind}-${c.order}-${i}`}
            data-callout-kind={c.kind}
            /* Explicit dir="rtl" on each callout: the section-level
               dir="rtl" alone wasn't propagating through deeper
               ancestor chains in some projects. Setting it here
               guarantees flex-order (emoji gutter right, content
               column left) regardless of ancestor chain. */
            dir="rtl"
            className={cn(
              "flex gap-2.5 rounded-[6px] border-s-[2px] px-3 py-2",
              tone.bg,
              tone.accent,
            )}
          >
            <div
              aria-hidden="true"
              className="flex h-5 w-5 shrink-0 items-center justify-center text-[13px] leading-none"
            >
              {tone.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-0.5">
                <span
                  dir="ltr"
                  className={cn(
                    "inline-block text-[9.5px] font-[700] leading-none uppercase tracking-[0.08em]",
                    tone.label,
                  )}
                >
                  {tone.labelText}
                </span>
              </div>
              <div className="text-[13.25px] leading-[1.62] text-lib-text/90">
                <FrameBody body={c.text} compact />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FrameTable — minimalist hairline design
   ───────────────────────────────────────────────────────────────────
   Philosophy: reads like a medical reference book page, not a
   spreadsheet. No outer border, no heavy background, no zebra
   striping. Just a 1.5px header underline and hairline row
   dividers. Subtle hover for scannability. text-align: start
   everywhere so Persian/English mixed cells inherit ambient RTL
   and the Unicode Bidi Algorithm handles embedded Latin tokens
   via inlineRich's `unicode-bidi: isolate` on <strong>/<em>/<code>.
═══════════════════════════════════════════════════════════════════ */

function FrameTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: { text: string; bold?: boolean }[][];
}) {
  return (
    <div className="my-3 -mx-1 overflow-x-auto">
      <table className="w-full border-collapse text-[14.25px]">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className={cn(
                  "border-b-[1.5px] border-lib-border/85 px-3.5 py-2",
                  "align-bottom font-[700] leading-[1.6] text-lib-text",
                  "[&_strong]:font-[780] [&_em]:[font-style:oblique_12deg]",
                  "[&_code]:rounded-[3px] [&_code]:bg-lib-hover/50 [&_code]:px-1",
                  "[&_code]:font-mono [&_code]:text-[0.9em]",
                )}
                style={{ textAlign: "start" }}
              >
                <FrameBody body={h} compact />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className={cn(
                "border-b border-lib-border/25 last:border-b-0",
                "transition-colors hover:bg-lib-hover/18",
              )}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={cn(
                    "px-3.5 py-2.5 align-top",
                    "leading-[1.58] text-lib-text/90",
                    cell.bold && "font-[700] text-lib-text",
                    "[&_strong]:font-[800] [&_strong]:text-lib-text",
                    "[&_em]:[font-style:oblique_12deg]",
                    "[&_code]:rounded-[4px] [&_code]:border [&_code]:border-lib-border/35",
                    "[&_code]:bg-lib-hover/45 [&_code]:px-1 [&_code]:py-[1px]",
                    "[&_code]:font-mono [&_code]:text-[0.9em] [&_code]:text-lib-text",
                  )}
                  style={{ textAlign: "start" }}
                >
                  <FrameBody body={cell.text} compact />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}