"use client";

import { forwardRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Root wrapper for the Library surface.
 *
 * Reading-first shell: the ReaderStage owns the full viewport width,
 * spine and annotation rail are both overlay drawers (not permanent
 * width stealers). Only in true non-focus exam/dashboard surfaces do
 * the panels push the stage — here, the content is always primary.
 *
 * Focus / fullscreen mode is propagated to the inner reading layout
 * via two CSS custom properties that cascade down through the DOM:
 *   --lib-measure-max     → consumed by MeasureColumn for the prose width
 *   --lib-stage-padding-x → consumed by ReaderStage for outer gutter
 * This keeps fullscreen from being a cosmetic shell-only change — the
 * actual reading column widens and the side gutters tighten.
 *
 * The root forwards a ref so callers can hand it to the browser
 * Fullscreen API for true native fullscreen on focus mode.
 */
interface LibraryShellProps {
  children: ReactNode;
  isFocusMode?: boolean;
  className?: string;
}

// Reading-measure tokens.
//
// Normal mode keeps the editorial ~78ch column.
//
// Focus mode widens the column to a comfortable reading measure
// (1100px max) with generous inline padding. This is wider than
// normal but not "fill-all-the-space" — a 1100px column reads
// comfortably at any typical screen size without line lengths
// becoming fatiguing. On iPad (1024px) it fills the screen; on
// 1440p it leaves visible margins that frame the content.
const MEASURE_NORMAL = "min(78ch, 100%)";
const MEASURE_FOCUS = "min(1100px, 100%)";

const STAGE_PAD_NORMAL = "clamp(1rem, 4vw, 3rem)";
const STAGE_PAD_FOCUS = "clamp(2rem, 5vw, 5rem)";

export const LibraryShell = forwardRef<HTMLDivElement, LibraryShellProps>(
  function LibraryShell({ children, isFocusMode = false, className }, ref) {
    const style: CSSProperties = {
      fontFamily: "var(--lib-font-sans)",
      ["--lib-measure-max" as string]: isFocusMode ? MEASURE_FOCUS : MEASURE_NORMAL,
      ["--lib-stage-padding-x" as string]: isFocusMode ? STAGE_PAD_FOCUS : STAGE_PAD_NORMAL,
    };

    return (
      <div
        ref={ref}
        data-library
        {...(isFocusMode ? { "data-focus": "" } : {})}
        className={cn(
          "relative bg-lib-bg text-lib-text",
          isFocusMode
            ? "fixed inset-0 z-[120] h-dvh overflow-hidden"
            : "min-h-dvh",
          className,
        )}
        style={style}
      >
        {children}
      </div>
    );
  },
);
