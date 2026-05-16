"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { renderInlineRich } from "@/components/note-viewer/inlineRich";
import { normalizeFrameForRender } from "@/lib/reader/frame-normalization";
import { FrameFlagBadges } from "./FrameFlagBadges";
import { FrameHeader } from "./FrameHeader";
import { FrameRichContent } from "./FrameRichContent";
import { MarginTail, PearlTail } from "./FrameTails";
import { LinkedQuestionsFooter } from "./LinkedQuestionsFooter";
import { ReferenceRailMarker } from "./ReferenceRailMarker";
import { CALLOUT_FOR_KIND, PLAIN_EYEBROW, proseStyle, resolveKind } from "./frameStyles";
import type { FrameCardV2Props } from "./frameTypes";

function FrameCardV2Impl({
  frame: rawFrame,
  isHighlighted = false,
  annotationCount = 0,
  annotations,
  highlightsVisible,
  showHighYieldMarker = false,
  isKeyExamFrame = false,
  isMissedFrame = false,
}: FrameCardV2Props) {
  const frame = React.useMemo(() => normalizeFrameForRender(rawFrame), [rawFrame]);

  const kind = resolveKind(frame.kind);
  const tone = CALLOUT_FOR_KIND[kind];
  const isCallout = Boolean(tone);
  const eyebrow = isCallout ? undefined : PLAIN_EYEBROW[kind];
  const linkedQuestions = Array.isArray(frame.linkedQuestions) ? frame.linkedQuestions : [];

  const titleNode = React.useMemo(
    () => (frame.title ? renderInlineRich(frame.title) : null),
    [frame.title],
  );

  const summaryNode = React.useMemo(
    () => (frame.summary ? renderInlineRich(frame.summary) : null),
    [frame.summary],
  );

  const markerClass = isMissedFrame
    ? "missed-question-marker"
    : isKeyExamFrame
      ? "key-exam-marker"
      : showHighYieldMarker && frame.highYield
        ? "high-yield-marker"
        : undefined;

  const dataAttrs = {
    id: frame.id,
    "data-reader-frame": "true",
    "data-frame-id": frame.id,
    "data-frame-kind": kind,
    "data-frame-tier": isCallout ? "callout" : "plain",
    "data-content-hash": frame.contentHash ?? undefined,
    "data-reader-reference-id": linkedQuestions.length > 0 ? frame.id : undefined,
  };

  return (
    <section
      {...dataAttrs}
      dir="rtl"
      className={cn(
        "group/frame relative isolate scroll-mt-28 overflow-visible",
        isCallout
          ? cn(
              "rounded-[16px] border border-lib-border/40 border-s-[3.5px] px-5 py-5 md:px-6 md:py-[1.375rem]",
              "shadow-[0_1px_3px_0_rgb(0_0_0/0.05),0_0_0_1px_rgb(0_0_0/0.025)]",
              "dark:shadow-[0_1px_3px_0_rgb(0_0_0/0.18),0_0_0_1px_rgb(255_255_255/0.02)]",
              "transition-shadow duration-150 hover:shadow-[0_2px_8px_0_rgb(0_0_0/0.07),0_0_0_1px_rgb(0_0_0/0.03)]",
              "dark:hover:shadow-[0_2px_8px_0_rgb(0_0_0/0.25),0_0_0_1px_rgb(255_255_255/0.03)]",
              tone?.bg,
              tone?.accent,
            )
          : cn("py-2", markerClass && "rounded-[10px] px-4 py-3"),
        markerClass,
        isHighlighted && "ring-1 ring-lib-accent/35",
      )}
    >
      <ReferenceRailMarker count={linkedQuestions.length} />

      <FrameHeader
        frame={frame}
        kind={kind}
        titleNode={titleNode}
        tone={tone}
        eyebrow={eyebrow}
        isCallout={isCallout}
        annotationCount={annotationCount}
        showHighYieldMarker={showHighYieldMarker}
      />

      <div className="notion-block-body">
        {summaryNode && (
          <p
            className={cn(
              "mb-2 text-[14.5px] leading-[1.75] text-lib-text-muted",
              "[&_strong]:font-[800] [&_strong]:text-lib-text",
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
          isParentCallout={isCallout}
          annotations={annotations}
          highlightsVisible={highlightsVisible}
        />

        <PearlTail
          variant={isCallout ? "inline" : "card"}
          pearl={frame.clinicalPearl}
        />

        <MarginTail
          note={frame.marginNote}
        />

        {!isCallout && <FrameFlagBadges frame={frame} />}

        <LinkedQuestionsFooter
          questions={linkedQuestions}
          compact={isCallout}
          frameId={frame.id}
        />
      </div>
    </section>
  );
}

export const FrameCardV2 = React.memo(FrameCardV2Impl, (prev, next) =>
  prev.frame === next.frame &&
  prev.annotationCount === next.annotationCount &&
  prev.annotations === next.annotations &&
  prev.highlightsVisible === next.highlightsVisible &&
  prev.isHighlighted === next.isHighlighted &&
  prev.showHighYieldMarker === next.showHighYieldMarker &&
  prev.isKeyExamFrame === next.isKeyExamFrame &&
  prev.isMissedFrame === next.isMissedFrame,
);
