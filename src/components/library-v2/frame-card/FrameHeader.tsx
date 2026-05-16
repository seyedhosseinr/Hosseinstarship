import React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FrameViewModel } from "@/lib/contract/note-viewer.types";
import type { FrameKind } from "@/lib/contract/types";
import { KIND_LABELS, titleStyle } from "./frameStyles";
import type { Tone } from "./frameTypes";

export function FrameHeader({
  frame,
  kind,
  titleNode,
  tone,
  eyebrow,
  isCallout,
  annotationCount,
  showHighYieldMarker,
}: {
  frame: FrameViewModel;
  kind: FrameKind;
  titleNode: React.ReactNode;
  tone?: Tone;
  eyebrow?: { label: string; text: string };
  isCallout: boolean;
  annotationCount: number;
  showHighYieldMarker: boolean;
}) {
  if (!titleNode && !tone && !eyebrow && annotationCount <= 0) return null;

  return (
    <div
      className={cn(
        "mb-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1",
        isCallout && "mb-3",
      )}
    >
      {(tone || eyebrow) && (
        <span
          dir="ltr"
          className={cn(
            "inline-flex items-center gap-[5px] rounded-[999px] border px-2 py-[3px]",
            "text-[9.5px] font-[760] leading-[1.45] uppercase tracking-[0.09em]",
            tone ? tone.badgeBg : "border-lib-border/50 bg-lib-surface/70",
            tone?.text,
            eyebrow?.text,
          )}
        >
          {tone && (
            <span
              aria-hidden="true"
              className={cn("h-[5.5px] w-[5.5px] shrink-0 rounded-full", tone.dot)}
            />
          )}
          {tone?.label ?? eyebrow?.label ?? KIND_LABELS[kind]}
        </span>
      )}

      {!isCallout && showHighYieldMarker && frame.highYield && (
        <span
          dir="ltr"
          className="inline-flex items-center gap-1 rounded-[999px] border border-amber-400/50 bg-amber-100/80 px-2 py-[2px] text-[9.5px] font-[700] leading-[1.45] uppercase tracking-[0.08em] text-amber-900 dark:border-amber-400/30 dark:bg-amber-900/40 dark:text-amber-100"
          aria-label="High yield"
        >
          <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
          <span>High yield</span>
        </span>
      )}

      {titleNode && (
        <h3
          className={cn(
            isCallout
              ? "text-[17px] font-[720] leading-[1.58] tracking-[-0.008em]"
              : "text-[19px] font-[720] leading-[1.48] tracking-[-0.01em]",
            "text-lib-text",
            "[&_strong]:font-[820] [&_strong]:text-lib-text",
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
          className="ms-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-lib-border/60 bg-lib-surface/80 px-1.5 text-[10px] font-[650] tabular-nums text-lib-text-muted"
          aria-label={annotationCount + " annotations"}
        >
          {annotationCount}
        </span>
      )}
    </div>
  );
}
