"use client";

import { forwardRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Reader scroll canvas. Spans the full viewport width; MeasureColumn
 * inside centers the prose relative to the whole screen.
 *
 * Horizontal padding is driven by `--lib-stage-padding-x`, a CSS
 * custom property set on the LibraryShell root. In focus / fullscreen
 * mode the shell tightens the padding so the widened reading column
 * can actually claim the extra horizontal space.
 *
 * The progress indication now lives on the top bar (ring) — this stage
 * is pure reading surface, no chrome.
 */
interface ReaderStageProps {
  children: ReactNode;
  className?: string;
}

export const ReaderStage = forwardRef<HTMLDivElement, ReaderStageProps>(
  function ReaderStage({ children, className }, ref) {
    const style: CSSProperties = {
      WebkitOverflowScrolling: "touch",
      paddingInline: "var(--lib-stage-padding-x, clamp(1rem, 4vw, 3rem))",
    };

    return (
      <div
        ref={ref}
        data-reader-stage
        className={cn(
          "relative h-dvh overflow-y-auto",
          "pb-24 pt-2 transition-[padding] duration-300 ease-out",
          className,
        )}
        style={style}
      >
        {children}
      </div>
    );
  },
);
