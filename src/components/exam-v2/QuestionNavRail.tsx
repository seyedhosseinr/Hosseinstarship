"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { NavDot } from "./NavDot";
import type { ActiveQuestion } from "@/types/exam";

export interface QuestionNavRailProps {
  questions: ActiveQuestion[];
  currentIndex: number;
  onSelect: (index: number) => void;
  className?: string;
}

const LEGEND = [
  { color: "bg-border dark:bg-border", label: "Unanswered" },
  { color: "bg-lib-accent", label: "Selected" },
  { color: "bg-lib-correct", label: "Correct" },
  { color: "bg-lib-incorrect", label: "Incorrect" },
] as const;

export const QuestionNavRail = forwardRef<HTMLDivElement, QuestionNavRailProps>(
  ({ questions, currentIndex, onSelect, className }, ref) => (
    <div ref={ref} className={cn("flex min-w-[176px] flex-col", className)}>
      {/* Header */}
      <div className="px-3.5 pb-2 pt-2.5 text-[9px] font-bold uppercase tracking-widest text-lib-text-muted">
        Questions
      </div>

      {/* Items */}
      {questions.map((q, idx) => (
        <NavDot
          key={idx}
          index={idx}
          isCurrent={idx === currentIndex}
          isSubmitted={q.isSubmitted}
          isMarked={q.isMarked}
          hasSelection={!!q.selectedOptionId}
          outcome={q.outcome}
          onClick={() => onSelect(idx)}
        />
      ))}

      {/* Legend */}
      <div className="mx-3.5 mt-2 border-t border-lib-border pt-2.5">
        {LEGEND.map((item) => (
          <div key={item.label} className="mb-1.5 flex items-center gap-2">
            <span className={cn("inline-block h-[9px] w-[9px] shrink-0 rounded-full", item.color)} />
            <span className="text-[10px] text-lib-text-muted">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  ),
);
QuestionNavRail.displayName = "QuestionNavRail";
