"use client";

import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OutcomeType } from "@/types/exam";

export interface NavDotProps {
  index: number;
  isCurrent: boolean;
  isSubmitted: boolean;
  isMarked: boolean;
  hasSelection: boolean;
  outcome: OutcomeType | null;
  onClick: () => void;
}

export function NavDot({
  index,
  isCurrent,
  isSubmitted,
  isMarked,
  hasSelection,
  outcome,
  onClick,
}: NavDotProps) {
  /* Dot color logic */
  let dotColor = "bg-border dark:bg-border";
  let dotFilled = false;

  if (isSubmitted && outcome === "correct") {
    dotColor = "bg-lib-correct";
    dotFilled = true;
  } else if (isSubmitted && outcome === "incorrect") {
    dotColor = "bg-lib-incorrect";
    dotFilled = true;
  } else if (isSubmitted && outcome === "omitted") {
    dotColor = "bg-muted-foreground";
    dotFilled = true;
  } else if (hasSelection && !isSubmitted) {
    dotColor = "bg-lib-accent";
    dotFilled = true;
  }

  return (
    <button
      data-qi={index}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 border-s-[3px] px-3.5 py-2.5",
        "min-h-touch cursor-pointer border-none bg-transparent text-start",
        "transition-colors duration-100 [-webkit-tap-highlight-color:transparent]",
        "hover:bg-lib-hover",
        isCurrent
          ? "border-s-lib-accent bg-lib-accent/[0.07]"
          : "border-s-transparent",
      )}
    >
      {/* Status dot */}
      <span
        className={cn(
          "flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-full",
          dotFilled ? dotColor : "border-2 border-border",
        )}
      />

      {/* Number */}
      <span
        className={cn(
          "flex-1 text-xs",
          isCurrent ? "font-bold text-lib-text" : "text-lib-text-secondary",
        )}
      >
        {index + 1}
      </span>

      {/* Mark flag */}
      {isMarked && (
        <Flag size={11} className="shrink-0 fill-lib-marked text-lib-marked" />
      )}
    </button>
  );
}
