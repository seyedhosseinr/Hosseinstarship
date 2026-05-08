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
 * This keeps fullscreen from being a cosmetic shell-only change: the
 * actual reading column can claim the available width and the side
 * gutters stay intentionally small.
 *
 * The root forwards a ref so callers can hand it to the browser
 * Fullscreen API for true native fullscreen on focus mode.
 */
interface LibraryShellProps {
  children: ReactNode;
  isFocusMode?: boolean;
  className?: string;
  /**
   * Optional override for the normal-mode reading column max-width.
   * Driven by user reader settings. Focus mode stays unrestricted.
   * Pass any CSS length (e.g. "min(1200px, 100%)" or "100%").
   */
  measureMax?: string;
}

const MEASURE_NORMAL = "100%";
const MEASURE_FOCUS = "100%";

const STAGE_PAD_NORMAL = "clamp(0.75rem, 2vw, 1.5rem)";
const STAGE_PAD_FOCUS = "clamp(0.75rem, 2vw, 1.25rem)";

export const LibraryShell = forwardRef<HTMLDivElement, LibraryShellProps>(
  function LibraryShell({ children, isFocusMode = false, className, measureMax }, ref) {
    const style: CSSProperties = {
      fontFamily: "var(--lib-font-sans)",
      ["--lib-measure-max" as string]: isFocusMode
        ? MEASURE_FOCUS
        : (measureMax ?? MEASURE_NORMAL),
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
