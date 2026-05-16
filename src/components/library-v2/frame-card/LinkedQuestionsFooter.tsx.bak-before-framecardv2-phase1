import React from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LinkedQuestion } from "./frameTypes";

export function LinkedQuestionsFooter({
  questions,
  compact = false,
  frameId,
}: {
  questions: LinkedQuestion[];
  compact?: boolean;
  frameId: string;
}) {
  if (!questions.length) return null;

  return (
    <details
      className="group/related mt-3"
      data-reader-reference-rail="true"
      data-reader-reference-frame-id={frameId}
      data-reader-reference-count={questions.length}
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-2 py-1 text-lib-text-muted transition-colors hover:text-lib-text",
          "[&::-webkit-details-marker]:hidden",
          compact ? "text-[11.5px]" : "text-[12px]",
        )}
      >
        <span
          dir="ltr"
          className="inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full border border-lib-border/60 bg-lib-surface/60 px-1 text-[10px] font-[650] tabular-nums text-lib-text-secondary"
        >
          {questions.length}
        </span>
        <span className="font-[650]">
          related question{questions.length !== 1 ? "s" : ""}
        </span>
        <ArrowRight
          aria-hidden="true"
          className="ms-auto h-3 w-3 opacity-55 transition-transform group-open/related:rotate-90 rtl:rotate-180 rtl:group-open/related:-rotate-90"
        />
      </summary>

      <ul className="mt-1.5 space-y-1.5">
        {questions.slice(0, 3).map((question) => (
          <li
            key={question.questionId}
            className="border-s-[2px] border-lib-border/55 ps-3 text-[13px] leading-[1.75] text-lib-text-secondary"
          >
            {question.stem}
          </li>
        ))}
        {questions.length > 3 && (
          <li dir="ltr" className="ps-3 text-[12px] text-lib-text-muted/70">
            +{questions.length - 3} more
          </li>
        )}
      </ul>
    </details>
  );
}
