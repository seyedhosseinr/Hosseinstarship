"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Bottom dock with reading rhythm info: progress, breadcrumb, time, annotations.
 * Glass-blurred, fixed to the bottom of the ReaderStage viewport.
 *
 * Hides on scroll-down, reveals on scroll-up (controlled by parent via `visible` prop).
 */
interface RhythmDockProps {
  children: ReactNode;
  visible?: boolean;
  className?: string;
}

export function RhythmDock({
  children,
  visible = true,
  className,
}: RhythmDockProps) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4",
        "transition-transform duration-lib-spring ease-lib-spring",
        !visible && "translate-y-full",
      )}
    >
      <div
        className={cn(
          "pointer-events-auto flex h-lib-dock w-full max-w-lib-measure items-center gap-4 rounded-lib-lg px-5",
          "border border-lib-border-subtle bg-lib-glass shadow-lg backdrop-blur-xl",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
