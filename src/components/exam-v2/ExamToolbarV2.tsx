"use client";

import {
  ChevronLeft,
  ChevronRight,
  Flag,
  Clock,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BarButton } from "./BarButton";
import { ExamBadge } from "./ExamBadge";

export interface ExamToolbarV2Props {
  currentIndex: number;
  total: number;
  answeredCount: number;
  markedCount: number;
  timeSpent: number;
  isPaused: boolean;
  isMarked: boolean;
  showNav: boolean;
  showStudyPanel: boolean;
  fontSize: number;
  isStudyMode: boolean;
  onToggleNav: () => void;
  onToggleStudyPanel: () => void;
  onPrev: () => void;
  onNext: () => void;
  onMark: () => void;
  onTogglePause: () => void;
  onFontInc: () => void;
  onFontDec: () => void;
  onEndExam: () => void;
}

function fmtTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function ExamToolbarV2({
  currentIndex,
  total,
  answeredCount,
  markedCount,
  timeSpent,
  isPaused,
  isMarked,
  showNav,
  showStudyPanel,
  fontSize,
  isStudyMode,
  onToggleNav,
  onToggleStudyPanel,
  onPrev,
  onNext,
  onMark,
  onTogglePause,
  onFontInc,
  onFontDec,
  onEndExam,
}: ExamToolbarV2Props) {
  return (
    <header
      className={cn(
        "flex min-h-[52px] shrink-0 flex-wrap items-center justify-between gap-2",
        "border-b border-lib-bar-border bg-lib-bar px-3 z-[100]",
      )}
    >
      {/* Left group */}
      <div className="flex items-center gap-0.5">
        <BarButton onClick={onToggleNav} title="نمایش/مخفی کردن فهرست" active={showNav}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect y="1" width="14" height="2" rx="1" fill="currentColor" />
            <rect y="6" width="14" height="2" rx="1" fill="currentColor" />
            <rect y="11" width="14" height="2" rx="1" fill="currentColor" />
          </svg>
        </BarButton>

        <span className="mx-1.5 h-5 w-px bg-lib-bar-border" />

        <BarButton onClick={onPrev} disabled={currentIndex === 0} title="سوال قبلی (→)">
          <ChevronRight size={14} />
        </BarButton>

        <span className="rounded-md bg-black/[0.04] px-2.5 py-0.5 text-xs font-semibold tabular-nums text-lib-bar-text dark:bg-white/[0.06]">
          Item {currentIndex + 1} of {total}
        </span>

        <BarButton onClick={onNext} disabled={currentIndex >= total - 1} title="سوال بعدی (←)">
          <ChevronLeft size={14} />
        </BarButton>

        <span className="mx-1.5 h-5 w-px bg-lib-bar-border" />

        <BarButton onClick={onMark} title="علامت‌گذاری (M)" active={isMarked}>
          <Flag size={14} className={isMarked ? "fill-lib-marked text-lib-marked" : ""} />
        </BarButton>
        <span className={cn("text-[11px] font-semibold", isMarked ? "text-lib-marked" : "text-lib-bar-muted")}>
          Mark
        </span>

        {isStudyMode && (
          <>
            <span className="mx-1.5 h-5 w-px bg-lib-bar-border" />
            <ExamBadge label="STUDY" variant="mode" />
          </>
        )}
      </div>

      {/* Center — progress */}
      <div className="flex flex-1 items-center justify-center gap-4">
        <div className="flex items-center gap-1.5">
          <Clock size={12} className="text-lib-bar-muted" />
          <span className={cn(
            "text-xs font-medium tabular-nums",
            isPaused ? "text-lib-marked" : "text-lib-bar-muted",
          )}>
            {fmtTime(timeSpent)}
          </span>
        </div>
        <span className="text-[11px] text-lib-bar-muted">
          {answeredCount}/{total} answered
          {markedCount > 0 && (
            <span className="ms-2 text-lib-marked">• {markedCount} marked</span>
          )}
        </span>
      </div>

      {/* Right group */}
      <div className="flex items-center gap-0.5">
        <BarButton onClick={onToggleStudyPanel} title="پنل مطالعه" active={showStudyPanel}>
          <BookOpen size={14} />
        </BarButton>

        <span className="mx-1 h-5 w-px bg-lib-bar-border" />

        <BarButton onClick={onFontDec} title="کوچکتر کردن متن">
          <span className="text-[10px] font-bold leading-none">A-</span>
        </BarButton>
        <BarButton onClick={onFontInc} title="بزرگتر کردن متن">
          <span className="text-xs font-bold leading-none">A+</span>
        </BarButton>

        <span className="mx-1 h-5 w-px bg-lib-bar-border" />

        <BarButton onClick={onTogglePause} title={isPaused ? "ادامه" : "توقف"} active={isPaused}>
          <span className="text-[13px]">{isPaused ? "▶" : "⏸"}</span>
        </BarButton>

        <span className="mx-1 h-5 w-px bg-lib-bar-border" />

        <button
          onClick={onEndExam}
          className={cn(
            "min-h-touch rounded-lib-sm border border-lib-incorrect-border px-4 py-2",
            "bg-transparent text-xs font-bold tracking-wide text-lib-incorrect",
            "cursor-pointer transition-colors hover:bg-lib-incorrect-bg",
          )}
        >
          End Block
        </button>
      </div>
    </header>
  );
}
