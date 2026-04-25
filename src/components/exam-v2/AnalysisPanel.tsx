"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { ScoreRing } from "./ScoreRing";
import { BreakdownBar } from "./BreakdownBar";
import { SubjectRowExpand } from "./SubjectRowExpand";
import type { ExamScore, QuestionResult, SubjectBreakdown } from "@/types/exam";

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}د ${sec}ث`;
}

function scoreColor(pct: number): string {
  if (pct >= 80) return "var(--lib-correct)";
  if (pct >= 50) return "var(--lib-marked)";
  return "var(--lib-incorrect)";
}

export interface AnalysisPanelProps {
  score: ExamScore;
  results: QuestionResult[];
  subjectBreakdown: SubjectBreakdown[];
  timeSpent: number;
  className?: string;
}

export function AnalysisPanel({ score, results, subjectBreakdown, timeSpent, className }: AnalysisPanelProps) {
  const diffBreakdown = useMemo(() => {
    const map = new Map<string, { correct: number; total: number }>();
    results.forEach((r) => {
      const d = r.difficulty || "نامشخص";
      const e = map.get(d) || { correct: 0, total: 0 };
      e.total++;
      if (r.isCorrect) e.correct++;
      map.set(d, e);
    });
    return Array.from(map.entries()).map(([diff, data]) => ({
      difficulty: diff,
      label: diff === "easy" ? "آسان" : diff === "medium" ? "متوسط" : diff === "hard" ? "سخت" : diff,
      ...data,
      percentage: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
    }));
  }, [results]);

  return (
    <div className={cn("mx-auto max-w-[960px] px-5 py-6", className)}>
      {/* Top row: Donut + Score + Stats */}
      <div className="mb-6 flex flex-wrap gap-6">
        {/* Score donut */}
        <div className="flex min-w-[180px] flex-col items-center rounded-lib-md border border-lib-border bg-lib-surface px-8 py-7">
          <ScoreRing percentage={score.percentage} />
        </div>

        {/* Your Score table */}
        <div className="min-w-[200px] flex-1 rounded-lib-md border border-lib-border bg-lib-surface p-5">
          <h3 className="mb-3.5 text-sm font-bold text-lib-correct">Your Score</h3>
          <table className="w-full text-[13px]">
            <tbody>
              {[
                { label: "Total Correct", value: score.correct, cls: "text-lib-correct" },
                { label: "Total Incorrect", value: score.incorrect, cls: "text-lib-incorrect" },
                { label: "Total Omitted", value: score.unanswered, cls: "text-lib-text-muted" },
              ].map((row) => (
                <tr key={row.label}>
                  <td className="py-1.5 text-lib-text">{row.label}</td>
                  <td className={cn("py-1.5 text-end font-bold", row.cls)}>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Stats */}
        <div className="min-w-[200px] rounded-lib-md border border-lib-border bg-lib-surface p-5">
          <h3 className="mb-3.5 text-sm font-bold text-lib-text">Test Stats</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: "Total Time", value: fmtTime(timeSpent) },
              { label: "Avg / Question", value: score.total > 0 ? fmtTime(Math.round(timeSpent / score.total)) : "\u2014" },
              { label: "Marked", value: String(results.filter((r) => r.flagged).length) },
              { label: "Total Questions", value: String(score.total) },
            ].map((s) => (
              <div key={s.label} className="rounded-md bg-lib-hover p-2">
                <div className="text-[11px] text-lib-text-muted">{s.label}</div>
                <div className="text-[13px] font-semibold text-lib-text">{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Difficulty breakdown */}
      {diffBreakdown.length > 0 && (
        <div className="mb-6 rounded-lib-md border border-lib-border bg-lib-surface p-5">
          <h3 className="mb-3.5 text-[13px] font-semibold text-lib-text">تحلیل بر اساس سطح دشواری</h3>
          <div className="flex flex-col gap-2.5">
            {diffBreakdown.map((d) => (
              <div key={d.difficulty}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium text-lib-text">{d.label}</span>
                  <span className="text-lib-text-muted">{d.correct}/{d.total} ({d.percentage}%)</span>
                </div>
                <div className="h-[7px] overflow-hidden rounded-full bg-lib-hover">
                  <div
                    className="h-full rounded-full transition-[width] duration-500 ease-out"
                    style={{ width: `${d.percentage}%`, background: scoreColor(d.percentage) }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subject breakdown */}
      <div className="overflow-hidden rounded-lib-md border border-lib-border bg-lib-surface">
        <div className="border-b border-lib-border px-6 py-4">
          <h3 className="text-[13px] font-semibold text-lib-text">تحلیل بر اساس موضوع</h3>
        </div>
        <div className="grid grid-cols-[32px_1fr_80px_100px_100px_100px_100px] gap-0 border-b border-lib-border bg-lib-hover px-6 py-2 text-[10px] font-bold uppercase tracking-wider text-lib-text-muted">
          <span />
          <span>NAME</span>
          <span className="text-center">TOTAL Q</span>
          <span className="text-center">CORRECT Q</span>
          <span className="text-center">INCORRECT Q</span>
          <span className="text-center">OMITTED Q</span>
          <span />
        </div>
        {subjectBreakdown.map((sb) => (
          <SubjectRowExpand key={sb.subject} sb={sb} results={results} />
        ))}
      </div>
    </div>
  );
}
