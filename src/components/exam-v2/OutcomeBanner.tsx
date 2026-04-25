"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OutcomeType } from "@/types/exam";

export interface OutcomeBannerProps {
  outcome: OutcomeType;
  className?: string;
}

export function OutcomeBanner({ outcome, className }: OutcomeBannerProps) {
  const isCorrect = outcome === "correct";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-semibold",
        isCorrect ? "text-lib-correct" : "text-lib-incorrect",
        className,
      )}
    >
      {isCorrect ? <Check size={14} /> : <X size={14} />}
      {isCorrect ? "Correct" : "Incorrect"}
    </span>
  );
}
