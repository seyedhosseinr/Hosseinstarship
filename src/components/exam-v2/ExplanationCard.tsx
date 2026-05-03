"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActiveQuestion, QuestionOption } from "@/types/exam";
import type { McqAmbossReview } from "@/types/mcq-review";
import { AmbossReviewPanel } from "@/components/qbank/AmbossReviewPanel";

export interface ExplanationCardProps {
  question: ActiveQuestion;
  fontSize?: number;
  className?: string;
}

export function ExplanationCard({ question, fontSize = 14, className }: ExplanationCardProps) {
  const [fcState, setFcState] = useState<"idle" | "creating" | "done">("idle");
  const isCorrect = question.outcome === "correct";
  const correctOpt = question.options.find((o) => o.id === question.correctOptionId);

  if (process.env.NODE_ENV === "development") {
    console.debug("[exam:review]", question.questionId, {
      hasReview: !!question.review,
      highlights: question.review?.stemHighlights.length ?? 0,
      optionReviews: question.review?.optionReviews.length ?? 0,
      correctOptKey: correctOpt?.key,
    });
  }

  const stemPlainText = question.stemHtml.replace(/<[^>]*>/g, "");

  const originalToDisplay = new Map(
    question.options.map((o) => [(o.originalKey ?? o.key).toUpperCase(), o.key]),
  );
  const remappedReview: McqAmbossReview | null = question.review
    ? {
        ...question.review,
        optionReviews: question.review.optionReviews.map((or) => ({
          ...or,
          optionKey: originalToDisplay.get(or.optionKey.toUpperCase()) ?? or.optionKey,
        })),
      }
    : null;

  const handleCreateFlashcard = async () => {
    if (fcState !== "idle") return;
    setFcState("creating");
    try {
      const front = question.stemHtml;
      const back = `<p><strong>Answer: ${correctOpt?.key ?? ""}</strong> — ${correctOpt?.contentHtml ?? ""}</p>${question.explanationHtml ? `<hr/>${question.explanationHtml}` : ""}`;
      await fetch("/api/exams/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.questionId, front, back }),
      });
      setFcState("done");
    } catch {
      setFcState("idle");
    }
  };

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-lib-md border border-lib-border bg-lib-surface", className)}>
      {/* Outcome header */}
      <div
        className={cn(
          "flex items-center gap-2 border-b px-5 py-3",
          isCorrect
            ? "border-lib-correct-border bg-lib-correct-bg"
            : "border-lib-incorrect-border bg-lib-incorrect-bg",
        )}
      >
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md text-white",
            isCorrect ? "bg-lib-correct" : "bg-lib-incorrect",
          )}
        >
          {isCorrect ? <Check size={14} strokeWidth={2.5} /> : <X size={14} strokeWidth={2.5} />}
        </span>
        <div>
          <div className={cn("text-[13px] font-bold", isCorrect ? "text-lib-correct" : "text-lib-incorrect")}>
            {isCorrect ? "Correct" : "Incorrect"}
          </div>
          {correctOpt && (
            <div className={cn("mt-px text-[11px]", isCorrect ? "text-lib-correct" : "text-lib-incorrect")}>
              Answer: <strong>{correctOpt.key}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Correct answer callout */}
      {correctOpt && (
        <div className="mx-5 mt-4 rounded-lib-sm border border-lib-correct-border border-s-[3px] border-s-lib-correct bg-lib-correct-bg p-3">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-lib-correct">
            Correct Answer
          </div>
          <div className="text-lib-correct" style={{ fontSize: fontSize - 1, lineHeight: 1.6 }}>
            <strong>{correctOpt.key}.</strong>{" "}
            <span dangerouslySetInnerHTML={{ __html: correctOpt.contentHtml }} />
          </div>
        </div>
      )}

      {/* Explanation body: structured review when present, legacy HTML fallback otherwise. */}
      <div className="px-5 pb-6 pt-4">
        {remappedReview ? (
          <AmbossReviewPanel
            stem={stemPlainText}
            options={question.options.map((o) => o.contentHtml)}
            optionKeys={question.options.map((o) => o.key)}
            correctAnswer={correctOpt?.key ?? ""}
            review={remappedReview}
          />
        ) : question.explanationHtml ? (
          <>
            <div className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-lib-text-muted">
              Explanation
            </div>
            <div
              className="exam-explanation text-lib-text"
              style={{ fontSize: fontSize - 1, lineHeight: 1.8 }}
              dangerouslySetInnerHTML={{ __html: question.explanationHtml }}
            />
          </>
        ) : (
          <p className="py-4 text-[13px] text-lib-text-muted">
            No explanation available for this question.
          </p>
        )}
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap gap-2 border-t border-lib-border bg-lib-hover px-5 py-2.5">
        <button
          onClick={handleCreateFlashcard}
          disabled={fcState !== "idle"}
          className={cn(
            "rounded-md border px-3.5 py-1.5 text-[11px] font-semibold transition-all",
            "cursor-pointer disabled:cursor-default disabled:opacity-60",
            fcState === "done"
              ? "border-lib-correct-border bg-lib-correct-bg text-lib-correct"
              : "border-lib-accent bg-transparent text-lib-accent hover:bg-lib-accent-soft",
          )}
        >
          {fcState === "done" ? "✓ Flashcard Created" : fcState === "creating" ? "Creating…" : "Create Flashcard"}
        </button>
        <button
          onClick={() => window.open("/library", "_blank")}
          className="rounded-md border border-lib-border bg-transparent px-3.5 py-1.5 text-[11px] font-semibold text-lib-text-muted transition-all hover:bg-lib-hover cursor-pointer"
        >
          View in Library
        </button>
      </div>
    </div>
  );
}
