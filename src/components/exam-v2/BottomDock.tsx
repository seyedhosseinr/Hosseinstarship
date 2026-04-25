"use client";

import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmButton } from "./ConfirmButton";

export interface BottomDockProps {
  timeSpent: number;
  currentIndex: number;
  total: number;
  isSubmitted: boolean;
  onPrev: () => void;
  onNext: () => void;
  onEndExam: () => void;
}

function fmtTime(s: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function BottomDock({
  timeSpent,
  currentIndex,
  total,
  isSubmitted,
  onPrev,
  onNext,
  onEndExam,
}: BottomDockProps) {
  const isFirst = currentIndex === 0;
  const isLast = currentIndex >= total - 1;

  return (
    <div
      className={cn(
        "flex min-h-[56px] shrink-0 items-center justify-between gap-2",
        "border-t border-lib-border bg-lib-surface px-4 py-1",
      )}
    >
      {/* Left: exit + timer */}
      <div className="flex items-center gap-3">
        <button
          onClick={onEndExam}
          className="min-h-touch cursor-pointer border-none bg-transparent px-1 py-2 text-xs font-bold uppercase tracking-wide text-lib-incorrect"
        >
          Exit Session
        </button>
        <span className="h-4 w-px bg-lib-border" />
        <div className="flex items-center gap-1">
          <Clock size={11} className="text-lib-text-muted" />
          <span className="text-[11px] tabular-nums text-lib-text-muted">{fmtTime(timeSpent)}</span>
        </div>
      </div>

      {/* Center: counter */}
      <span className="text-[11px] tabular-nums text-lib-text-muted">
        {currentIndex + 1} / {total}
      </span>

      {/* Right: prev / next */}
      <div className="flex items-center gap-1.5">
        <ConfirmButton variant="ghost" onClick={onPrev} disabled={isFirst} className="gap-1.5 border border-lib-border text-[13px]">
          <ChevronLeft size={16} /> Previous
        </ConfirmButton>
        <ConfirmButton
          variant={isSubmitted ? "primary" : "ghost"}
          onClick={onNext}
          disabled={isLast}
          className={cn("gap-1.5 text-[13px]", !isSubmitted && "border border-lib-border")}
        >
          {isSubmitted ? "Next" : "Skip"} <ChevronRight size={16} />
        </ConfirmButton>
      </div>
    </div>
  );
}
