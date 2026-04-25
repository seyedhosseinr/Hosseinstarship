"use client";

import { cn } from "@/lib/utils";

export interface ExamShellProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Root wrapper for all exam surfaces.
 * Sets `data-library data-exam` for unified token scoping,
 * dir="rtl", and full-viewport flex column.
 */
export function ExamShell({ children, className }: ExamShellProps) {
  return (
    <div
      data-library
      data-exam
      dir="rtl"
      className={cn(
        "flex h-dvh flex-col overflow-hidden bg-lib-bg font-sans",
        className,
      )}
    >
      {children}
    </div>
  );
}
