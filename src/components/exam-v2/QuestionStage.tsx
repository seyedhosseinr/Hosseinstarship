"use client";

import { cn } from "@/lib/utils";

export interface QuestionStageProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Scrollable question area with max-width centered.
 * Used inside ActiveExamShell and ReviewShell main content regions.
 */
export function QuestionStage({ children, className }: QuestionStageProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-lib-question px-4 py-6 ipad-landscape:px-8",
        className,
      )}
    >
      {children}
    </div>
  );
}
