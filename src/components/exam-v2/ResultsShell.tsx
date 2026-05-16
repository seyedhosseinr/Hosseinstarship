"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, RotateCcw, Home, ListChecks, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExamShell } from "./ExamShell";
import { BarButton } from "./BarButton";
import { ExamBadge } from "./ExamBadge";
import { ResultsTable } from "./ResultsTable";
import { AnalysisPanel } from "./AnalysisPanel";
import type {
  ExamScore,
  QuestionResult,
  SubjectBreakdown,
  ExamMode,
} from "@/types/exam";

type Tab = "results" | "analysis";

export interface ResultsShellProps {
  score: ExamScore;
  results: QuestionResult[];
  subjectBreakdown: SubjectBreakdown[];
  timeSpent: number;
  questionTimes?: number[];
  testId?: string | null;
  mode?: ExamMode;
  defaultTab?: Tab;
  onReview: () => void;
  onRetry: () => void;
}

export function ResultsShell({
  score,
  results,
  subjectBreakdown,
  timeSpent,
  questionTimes,
  testId,
  mode,
  defaultTab,
  onReview,
  onRetry,
}: ResultsShellProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(defaultTab ?? "results");

  useEffect(() => {
    if (defaultTab) setTab(defaultTab);
  }, [defaultTab]);

  return (
    <ExamShell>
      {/* Dark top bar */}
      <header className="flex h-12 shrink-0 items-center justify-between bg-lib-bar px-4 text-xs text-lib-bar-muted">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-semibold text-lib-bar-text">نتایج آزمون</span>
          {testId && <span className="text-[11px] text-lib-bar-muted">ID: {testId.slice(0, 8)}</span>}
          {mode && (
            <ExamBadge
              label={mode === "tutor" ? "Tutor" : mode === "timed" ? "Timed" : "Untimed"}
              variant="mode"
            />
          )}
        </div>
        <div className="flex items-center gap-1">
          <BarButton onClick={onReview} className="gap-1 text-lib-bar-muted">
            <Eye size={13} /> <span className="text-[11px]">مرور</span>
          </BarButton>
          <BarButton onClick={onRetry} className="gap-1 text-lib-bar-muted">
            <RotateCcw size={13} /> <span className="text-[11px]">جدید</span>
          </BarButton>
          <BarButton onClick={() => router.push("/dashboard")} className="gap-1 text-lib-bar-muted">
            <Home size={13} /> <span className="text-[11px]">خانه</span>
          </BarButton>
        </div>
      </header>

      {/* Tab bar */}
      <div className="flex border-b border-lib-border bg-lib-surface px-4">
        {[
          { id: "results" as Tab, icon: <ListChecks size={14} />, label: "نتایج" },
          { id: "analysis" as Tab, icon: <BarChart3 size={14} />, label: "تحلیل" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "inline-flex items-center gap-1.5 border-b-2 px-5 py-2.5",
              "cursor-pointer text-[13px] font-medium transition-all",
              tab === t.id
                ? "border-lib-accent text-lib-accent font-semibold"
                : "border-transparent text-lib-text-muted",
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "results" ? (
          <ResultsTable
            score={score}
            results={results}
            timeSpent={timeSpent}
            questionTimes={questionTimes}
          />
        ) : (
          <AnalysisPanel
            score={score}
            results={results}
            subjectBreakdown={subjectBreakdown}
            timeSpent={timeSpent}
          />
        )}
      </div>
    </ExamShell>
  );
}
