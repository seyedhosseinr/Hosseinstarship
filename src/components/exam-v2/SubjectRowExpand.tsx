"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, MinusCircle, Flag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { SubjectBreakdown, QuestionResult } from "@/types/exam";

function scoreColor(pct: number): string {
  if (pct >= 80) return "var(--lib-correct)";
  if (pct >= 50) return "var(--lib-marked)";
  return "var(--lib-incorrect)";
}

export interface SubjectRowExpandProps {
  sb: SubjectBreakdown;
  results: QuestionResult[];
}

export function SubjectRowExpand({ sb, results }: SubjectRowExpandProps) {
  const [expanded, setExpanded] = useState(false);
  const questions = useMemo(
    () => results.filter((r) => (r.subject || "بدون موضوع") === sb.subject),
    [results, sb.subject],
  );
  const incorrect = sb.incorrect ?? (sb.total - sb.correct - (sb.omitted ?? 0));
  const omitted = sb.omitted ?? (sb.total - sb.correct - incorrect);

  return (
    <>
      <div
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "grid cursor-pointer grid-cols-[32px_1fr_80px_100px_100px_100px_100px] items-center gap-0",
          "border-b border-lib-border px-6 py-3 text-[13px] text-lib-text transition-colors",
          expanded && "bg-lib-hover",
        )}
      >
        <span className="text-lib-text-muted">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
        <span className="font-medium">{sb.label || sb.subject}</span>
        <span className="text-center font-semibold text-lib-text-secondary">{sb.total}</span>
        <span className="text-center font-semibold text-lib-correct">
          {sb.correct} ({sb.total > 0 ? Math.round((sb.correct / sb.total) * 100) : 0}%)
        </span>
        <span className="text-center font-semibold text-lib-incorrect">
          {incorrect} ({sb.total > 0 ? Math.round((incorrect / sb.total) * 100) : 0}%)
        </span>
        <span className="text-center font-semibold text-lib-text-muted">
          {omitted} ({sb.total > 0 ? Math.round((omitted / sb.total) * 100) : 0}%)
        </span>
        <div className="h-1.5 overflow-hidden rounded-full bg-lib-hover">
          <div
            className="h-full rounded-full transition-[width] duration-[400ms]"
            style={{ width: `${sb.percentage}%`, background: scoreColor(sb.percentage) }}
          />
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-3 ps-14">
              {questions.map((q, qi) => {
                const isOmit = q.userAnswer === null;
                return (
                  <div
                    key={qi}
                    className={cn(
                      "flex items-center gap-2 py-1.5 text-xs",
                      qi < questions.length - 1 && "border-b border-lib-border",
                    )}
                  >
                    {isOmit ? (
                      <MinusCircle size={13} className="shrink-0 text-lib-text-muted" />
                    ) : q.isCorrect ? (
                      <CheckCircle2 size={13} className="shrink-0 text-lib-correct" />
                    ) : (
                      <XCircle size={13} className="shrink-0 text-lib-incorrect" />
                    )}
                    <span className="flex-1 truncate text-lib-text-secondary">
                      {q.questionText.slice(0, 80)}{q.questionText.length > 80 ? "..." : ""}
                    </span>
                    <span className={cn("min-w-[50px] text-[11px] font-semibold", isOmit ? "text-lib-text-muted" : q.isCorrect ? "text-lib-correct" : "text-lib-incorrect")}>
                      {isOmit ? "\u2014" : q.isCorrect ? "صحیح" : "غلط"}
                    </span>
                    {q.flagged && <Flag size={12} className="shrink-0 text-lib-marked" />}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
