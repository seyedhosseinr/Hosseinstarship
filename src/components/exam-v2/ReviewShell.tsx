"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  ZoomIn,
  ZoomOut,
  FileText,
  BarChart3,
  LogOut,
  StickyNote,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ExamShell } from "./ExamShell";
import { QuestionStage } from "./QuestionStage";
import { BarButton } from "./BarButton";
import { ExamBadge } from "./ExamBadge";
import { FilterChip } from "./FilterChip";
import { OptionRow } from "./OptionRow";
import { QuestionStem } from "./QuestionStem";
import { OutcomeBanner } from "./OutcomeBanner";
import { ExplanationCard } from "./ExplanationCard";
import { useFontScale } from "@/hooks/useFontScale";
import type { ExamScore, QuestionResult, ExamMode } from "@/types/exam";

type ReviewFilter = "all" | "incorrect" | "correct" | "marked" | "omitted";

export interface ReviewShellProps {
  results: QuestionResult[];
  questionTimes?: number[];
  score: ExamScore;
  mode?: ExamMode;
  testId?: string | null;
  currentIndex: number;
  onGoToQuestion: (idx: number) => void;
  onExit: () => void;
  onShowResults: () => void;
  onShowAnalysis: () => void;
  onOpenNotes?: (questionId: string, questionLabel: string) => void;
  notedQuestionIds?: Set<string>;
}

const FILTERS: { key: ReviewFilter; label: string }[] = [
  { key: "all", label: "همه" },
  { key: "incorrect", label: "نادرست" },
  { key: "correct", label: "صحیح" },
  { key: "marked", label: "نشان‌دار" },
  { key: "omitted", label: "بی‌پاسخ" },
];

export function ReviewShell({
  results,
  questionTimes,
  score,
  mode,
  testId,
  currentIndex,
  onGoToQuestion,
  onExit,
  onShowResults,
  onShowAnalysis,
  onOpenNotes,
  notedQuestionIds,
}: ReviewShellProps) {
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [showNav, setShowNav] = useState(true);
  const { fontSize, inc: fontInc, dec: fontDec } = useFontScale(15);

  const filteredIndices = useMemo(
    () =>
      results
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => {
          switch (filter) {
            case "incorrect": return !r.isCorrect && r.userAnswer !== null;
            case "correct": return r.isCorrect;
            case "marked": return r.flagged;
            case "omitted": return r.userAnswer === null;
            default: return true;
          }
        })
        .map(({ i }) => i),
    [results, filter],
  );

  const counts = useMemo(
    () => ({
      all: results.length,
      incorrect: results.filter((r) => !r.isCorrect && r.userAnswer !== null).length,
      correct: results.filter((r) => r.isCorrect).length,
      marked: results.filter((r) => r.flagged).length,
      omitted: results.filter((r) => r.userAnswer === null).length,
    }),
    [results],
  );

  const filterPos = filteredIndices.indexOf(currentIndex);

  const goNext = useCallback(() => {
    if (filterPos >= 0 && filterPos < filteredIndices.length - 1) {
      onGoToQuestion(filteredIndices[filterPos + 1]);
    }
  }, [filteredIndices, filterPos, onGoToQuestion]);

  const goPrev = useCallback(() => {
    if (filterPos > 0) {
      onGoToQuestion(filteredIndices[filterPos - 1]);
    }
  }, [filteredIndices, filterPos, onGoToQuestion]);

  // Keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goNext();
      if (e.key === "ArrowRight") goPrev();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [goNext, goPrev]);

  // Jump to first filtered when filter excludes current
  useEffect(() => {
    if (filteredIndices.length > 0 && !filteredIndices.includes(currentIndex)) {
      onGoToQuestion(filteredIndices[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const r = results[currentIndex];
  if (!r) return null;

  return (
    <ExamShell>
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center gap-2 bg-lib-bar px-4 text-lib-bar-text" dir="rtl">
        <BarButton onClick={() => setShowNav((v) => !v)} className="text-lib-bar-muted">
          <Menu size={18} />
        </BarButton>
        <span className="text-sm font-bold">مرور آزمون</span>
        {testId && <span className="rounded bg-white/10 px-2 py-0.5 text-[10px]">{testId.slice(0, 8)}</span>}
        {mode && <ExamBadge label={mode === "tutor" ? "آموزشی" : mode === "timed" ? "زمان‌دار" : "آزاد"} variant="mode" />}

        <div className="flex-1" />

        {/* Counter + arrows */}
        <div className="flex items-center gap-1.5">
          <BarButton onClick={goPrev} disabled={filterPos <= 0} className="text-lib-bar-muted">
            <ChevronRight size={16} />
          </BarButton>
          <span className="text-[13px] font-medium">سوال {currentIndex + 1} از {results.length}</span>
          <BarButton onClick={goNext} disabled={filterPos < 0 || filterPos >= filteredIndices.length - 1} className="text-lib-bar-muted">
            <ChevronLeft size={16} />
          </BarButton>
        </div>

        <div className="flex-1" />

        <div className="flex gap-0.5">
          <BarButton onClick={fontDec} className="text-lib-bar-muted"><ZoomOut size={14} /></BarButton>
          <BarButton onClick={fontInc} className="text-lib-bar-muted"><ZoomIn size={14} /></BarButton>
        </div>

        <div className="flex gap-1">
          {onOpenNotes && (
            <BarButton onClick={() => onOpenNotes(r.questionId, `سوال ${currentIndex + 1}`)} className="text-lib-bar-muted">
              <span className="relative inline-flex">
                <StickyNote size={13} />
                {notedQuestionIds?.has(r.questionId) && (
                  <span className="absolute -end-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-lib-marked" />
                )}
              </span>
            </BarButton>
          )}
          <BarButton onClick={onShowResults} className="text-lib-bar-muted"><FileText size={13} /></BarButton>
          <BarButton onClick={onShowAnalysis} className="text-lib-bar-muted"><BarChart3 size={13} /></BarButton>
        </div>

        <span className="mx-1 h-5 w-px bg-white/15" />
        <BarButton onClick={onExit} className="text-lib-bar-muted"><LogOut size={13} /></BarButton>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <AnimatePresence>
          {showNav && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="flex shrink-0 flex-col overflow-hidden border-e border-lib-border bg-lib-surface"
              dir="rtl"
            >
              {/* Filter pills */}
              <div className="border-b border-lib-border p-2.5">
                <div className="flex flex-wrap gap-1">
                  {FILTERS.map((f) => (
                    <FilterChip
                      key={f.key}
                      label={f.label}
                      count={counts[f.key]}
                      active={filter === f.key}
                      onClick={() => setFilter(f.key)}
                    />
                  ))}
                </div>
              </div>

              {/* Summary strip */}
              <div className="flex gap-3 border-b border-lib-border px-3 py-1.5 text-[11px] text-lib-text-muted">
                <span className="text-lib-correct">{score.correct} ✓</span>
                <span className="text-lib-incorrect">{score.incorrect} ✗</span>
                <span>{score.unanswered} ⊘</span>
                <span className="me-auto font-semibold text-lib-accent">{score.percentage}%</span>
              </div>

              {/* Question grid */}
              <div className="flex-1 overflow-y-auto p-2">
                <div className="grid grid-cols-4 gap-1">
                  {filteredIndices.map((idx) => {
                    const qr = results[idx];
                    const cur = idx === currentIndex;
                    return (
                      <button
                        key={idx}
                        onClick={() => onGoToQuestion(idx)}
                        className={cn(
                          "flex aspect-square cursor-pointer items-center justify-center rounded-[5px] border-[1.5px] text-xs font-medium transition-all",
                          cur
                            ? "border-lib-accent bg-lib-accent text-white font-bold"
                            : qr.isCorrect
                              ? "border-lib-correct/25 bg-lib-correct/5 text-lib-text"
                              : qr.userAnswer === null
                                ? "border-lib-border bg-lib-hover text-lib-text-muted"
                                : "border-lib-incorrect/25 bg-lib-incorrect/5 text-lib-text",
                        )}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main content */}
        <main className="flex flex-1 flex-col overflow-y-auto" dir="rtl">
          <QuestionStage>
            {/* Header */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-lib-accent px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white">
                Q {currentIndex + 1}
              </span>
              <span className="text-xs text-lib-text-muted">of {results.length}</span>
              {r.outcome && <OutcomeBanner outcome={r.outcome} className="ms-auto" />}
            </div>

            <QuestionStem html={r.stemHtml} fontSize={fontSize} className="mb-7" />

            {/* Options */}
            <div className="mb-6 flex flex-col gap-1.5">
              {r.options.map((opt, idx) => (
                <OptionRow
                  key={opt.id}
                  optionId={opt.id}
                  index={idx}
                  contentHtml={opt.contentHtml}
                  fontSize={fontSize}
                  isSelected={r.selectedOptionId === opt.id}
                  isSubmitted={true}
                  isCorrectOption={opt.id === r.correctOptionId}
                  isStruck={false}
                  onSelect={() => {}}
                  onStrike={() => {}}
                />
              ))}
            </div>

            {/* Explanation */}
            <ExplanationCard
              question={{
                ...r,
                isSubmitted: true,
                questionId: r.questionId,
                sessionQuestionId: r.sessionQuestionId,
                orderIndex: r.orderIndex,
                timeSpentSeconds: r.timeSpentSeconds,
                explanationHtml: r.explanationHtml ?? undefined,
                correctOptionId: r.correctOptionId ?? undefined,
              }}
              fontSize={fontSize}
            />
          </QuestionStage>
        </main>
      </div>
    </ExamShell>
  );
}
