"use client";

import { CheckCircle2, XCircle, MinusCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatCard } from "./StatCard";
import type { ExamScore, QuestionResult } from "@/types/exam";

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

function scoreColor(pct: number): string {
  if (pct >= 80) return "var(--lib-correct)";
  if (pct >= 50) return "var(--lib-marked)";
  return "var(--lib-incorrect)";
}

export interface ResultsTableProps {
  score: ExamScore;
  results: QuestionResult[];
  timeSpent: number;
  questionTimes?: number[];
  className?: string;
}

export function ResultsTable({ score, results, timeSpent, questionTimes, className }: ResultsTableProps) {
  return (
    <div className={cn("mx-auto max-w-[960px] px-5 py-6", className)}>
      {/* Score summary cards */}
      <div className="mb-6 grid grid-cols-4 gap-3">
        <StatCard icon={<CheckCircle2 size={16} />} value={score.correct} label="صحیح" color="var(--lib-correct)" />
        <StatCard icon={<XCircle size={16} />} value={score.incorrect} label="غلط" color="var(--lib-incorrect)" />
        <StatCard icon={<MinusCircle size={16} />} value={score.unanswered} label="بی‌پاسخ" />
        <StatCard icon={<Clock size={16} />} value={fmtTime(timeSpent)} label="زمان کل" color="var(--lib-accent)" />
      </div>

      {/* Score bar */}
      <div className="mb-6 rounded-lib-sm border border-lib-border bg-lib-surface p-4">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-lib-text">امتیاز کل</span>
          <span className="text-[22px] font-extrabold" style={{ color: scoreColor(score.percentage) }}>
            {score.percentage}%
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-lib-hover">
          <div
            className="h-full rounded-full transition-[width] [transition-duration:600ms] ease-out"
            style={{ width: `${score.percentage}%`, background: scoreColor(score.percentage) }}
          />
        </div>
        <div className="mt-2 flex gap-4 text-[11px] text-lib-text-muted">
          <span>{score.correct} / {score.total} صحیح</span>
          <span>
            میانگین زمان: {fmtTime(score.total > 0 ? Math.round(timeSpent / score.total) : 0)} / سؤال
          </span>
        </div>
      </div>

      {/* Question table */}
      <div className="overflow-hidden rounded-lib-sm border border-lib-border bg-lib-surface">
        {/* Header */}
        <div className="grid grid-cols-[60px_30px_1fr_1fr_1fr_70px_65px] gap-0 border-b border-lib-border bg-lib-hover px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-lib-text-muted">
          <span>ID</span>
          <span />
          <span>SUBJECTS</span>
          <span>SYSTEMS</span>
          <span>TOPICS</span>
          <span className="text-center">STATUS</span>
          <span className="text-center">TIME</span>
        </div>
        {/* Rows */}
        {results.map((r, i) => {
          const isOmitted = r.userAnswer === null;
          const qt = questionTimes?.[i] ?? r.timeSpentSeconds ?? 0;
          return (
            <div
              key={i}
              className={cn(
                "grid grid-cols-[60px_30px_1fr_1fr_1fr_70px_65px] items-center gap-0 px-4 py-2.5 text-xs text-lib-text",
                i < results.length - 1 && "border-b border-lib-border",
                i % 2 !== 0 && "bg-lib-hover",
              )}
            >
              <span className="tabular-nums text-[11px] text-lib-text-muted">{i + 1}</span>
              <span>
                {isOmitted ? (
                  <MinusCircle size={15} className="text-lib-text-muted" />
                ) : r.isCorrect ? (
                  <CheckCircle2 size={15} className="text-lib-correct" />
                ) : (
                  <XCircle size={15} className="text-lib-incorrect" />
                )}
              </span>
              <span className="truncate text-lib-text-secondary">{r.volumeNo ? `Volume ${r.volumeNo}` : r.subject || "\u2014"}</span>
              <span className="truncate text-lib-text-secondary">{r.partLabel || "\u2014"}</span>
              <span className="truncate text-lib-text-secondary">{r.chapterTitle ? `Ch.${r.chapterNo} ${r.chapterTitle}` : "\u2014"}</span>
              <span className={cn("text-center text-[11px] font-semibold", isOmitted ? "text-lib-text-muted" : r.isCorrect ? "text-lib-correct" : "text-lib-incorrect")}>
                {isOmitted ? "Omitted" : r.isCorrect ? "Correct" : "Incorrect"}
              </span>
              <span className="text-center text-[11px] tabular-nums text-lib-text-muted">
                {qt > 0 ? `${qt} sec` : "\u2014"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
