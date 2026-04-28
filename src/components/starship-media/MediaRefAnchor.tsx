"use client";

import React from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaRefMatch } from "@/lib/starship-media/detectMediaRefs";
import { useMediaRefDispatch } from "./MediaRefContext";

interface MediaRefAnchorProps {
  ref: MediaRefMatch;
  chapterNo: number | null;
  segmentId: string | null;
}

/**
 * Compact inline anchor rendered in place of a detected media reference.
 *
 * Visual goals:
 *   • Reads as part of the prose run — no chip background, no border —
 *     just an underlined, faintly tinted span with a tiny icon prefix.
 *   • RTL-safe: no directional padding, no `me-` / `ms-` margins. The
 *     icon sits at the visual start in both LTR and RTL via flex.
 *   • iPad-safe: 28px minimum tap target via padding (visible touch
 *     surface stays small, but the click hitbox is generous).
 *   • Selection-safe: pointerdown/mousedown stop propagation so the
 *     reader's selection-watcher and highlight layer don't grab the
 *     gesture and turn it into an annotation.
 */
function MediaRefAnchorImpl({
  ref,
  chapterNo,
  segmentId,
}: MediaRefAnchorProps) {
  const dispatch = useMediaRefDispatch();

  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      dispatch?.open({ ref, chapterNo, segmentId });
    },
    [dispatch, ref, chapterNo, segmentId],
  );

  // Stop pointer/mouse-down so the highlight layer doesn't start a
  // selection on the anchor. Keep onClick for the actual action.
  const stopBubble = React.useCallback(
    (e: React.SyntheticEvent) => {
      e.stopPropagation();
    },
    [],
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={stopBubble}
      onMouseDown={stopBubble}
      onTouchStart={stopBubble}
      data-media-ref-anchor="true"
      data-media-ref-id={ref.refId}
      data-media-ref-kind={ref.kind}
      aria-label={`Open ${ref.label}`}
      title={ref.label}
      style={{ unicodeBidi: "isolate" }}
      className={cn(
        // Inline-block so it flows mid-paragraph; baseline keeps it on
        // the prose line. Min height gives iPads a real tap target
        // without inflating the inline metrics.
        "inline-flex items-baseline gap-[3px] align-baseline",
        "rounded-[3px] px-[3px] py-[1px] -my-[1px]",
        // Subtle, decision-focused tint. Underline only on hover so
        // the prose stays calm; persistent dotted underline below
        // signals "interactive" without shouting.
        "border-b border-dotted border-sky-600/60 dark:border-sky-300/55",
        "text-sky-700 dark:text-sky-300",
        "font-[600] tabular-nums",
        "transition-colors",
        "hover:bg-sky-500/[0.10] hover:border-sky-600 hover:text-sky-800",
        "dark:hover:bg-sky-400/[0.12] dark:hover:text-sky-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50",
        "focus-visible:rounded-[4px]",
        "cursor-pointer select-none touch-manipulation",
      )}
    >
      <ImageIcon
        aria-hidden="true"
        className="h-[0.85em] w-[0.85em] shrink-0 opacity-80"
      />
      <span style={{ unicodeBidi: "isolate" }}>{ref.label}</span>
    </button>
  );
}

export const MediaRefAnchor = React.memo(MediaRefAnchorImpl);
