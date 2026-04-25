"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Measure-locked reading column, centered in the viewport.
 *
 * The max-width is read from `--lib-measure-max`, a CSS custom
 * property set on the LibraryShell root. Normal mode resolves to
 * the editorial ~78ch column; focus / fullscreen mode resolves to
 * a wider but still bounded reading measure so the prose actually
 * uses the extra horizontal space instead of just adding empty
 * margins around an unchanged column.
 *
 * Structured frames can opt out via `.reader-wide` escape hatch.
 */
interface MeasureColumnProps {
  children: ReactNode;
  className?: string;
}

export function MeasureColumn({ children, className }: MeasureColumnProps) {
  return (
    <div
      data-measure-column
      // mx-auto centers the column in normal mode. In focus mode the
      // descendant selector below (see globals.css `[data-focus]
      // [data-measure-column]`) zeroes the auto-margins so the column
      // pins/fills instead of re-converting freed space into matching
      // gutters.
      className={cn(
        "mx-auto flex w-full flex-col transition-[max-width,margin] duration-300 ease-out",
        className,
      )}
      style={{ maxWidth: "var(--lib-measure-max, min(78ch, 100%))" }}
    >
      {children}
    </div>
  );
}
