"use client";

import type { McqReviewHighlight } from "@/types/mcq-review";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { BidiText } from "./BidiText";

type StemHighlightTextProps = {
  stem: string;
  highlights: McqReviewHighlight[];
  className?: string;
};

type Match = {
  start: number;
  end: number;
  highlight: McqReviewHighlight;
};

function findMatches(stem: string, highlights: McqReviewHighlight[]) {
  const matches: Match[] = [];
  const missing: McqReviewHighlight[] = [];
  const candidates = highlights
    .map((highlight, index) => {
      const quote = highlight.quote.trim();
      return {
        highlight,
        index,
        quote,
        start: quote ? stem.indexOf(quote) : -1,
      };
    })
    .sort((a, b) => {
      const lengthDiff = b.quote.length - a.quote.length;
      return lengthDiff !== 0 ? lengthDiff : a.index - b.index;
    });

  for (const candidate of candidates) {
    const { highlight, quote, start } = candidate;
    if (!quote) continue;
    if (start < 0) {
      missing.push(highlight);
      continue;
    }
    const end = start + quote.length;
    if (matches.some((match) => start < match.end && end > match.start)) {
      continue;
    }
    matches.push({ start, end, highlight });
  }

  matches.sort((a, b) => a.start - b.start);
  return { matches, missing };
}

export function StemHighlightText({ stem, highlights, className }: StemHighlightTextProps) {
  const { matches, missing } = findMatches(stem, highlights);
  const parts: Array<string | Match> = [];
  let cursor = 0;

  for (const match of matches) {
    if (match.start > cursor) parts.push(stem.slice(cursor, match.start));
    parts.push(match);
    cursor = match.end;
  }
  if (cursor < stem.length) parts.push(stem.slice(cursor));

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-sm leading-7 text-foreground" dir="rtl" lang="fa">
        <TooltipProvider>
          {parts.map((part, index) => {
            if (typeof part === "string") {
              return <BidiText key={index} text={part} />;
            }

            const text = stem.slice(part.start, part.end);
            const isUnderline = part.highlight.kind === "underline";
            const mark = (
              <mark
                className={cn(
                  "rounded px-0.5 text-foreground",
                  isUnderline
                    ? "bg-transparent underline decoration-teal-500 decoration-2 underline-offset-4"
                    : "bg-amber-100 text-amber-950 dark:bg-amber-400/20 dark:text-amber-100",
                )}
              >
                <BidiText text={text} />
              </mark>
            );

            if (!part.highlight.note) {
              return <span key={`${part.start}-${part.end}-${index}`}>{mark}</span>;
            }

            return (
              <Tooltip key={`${part.start}-${part.end}-${index}`}>
                <TooltipTrigger asChild>{mark}</TooltipTrigger>
                <TooltipContent className="max-w-80 whitespace-normal text-right leading-6" dir="rtl" lang="fa">
                  <BidiText text={part.highlight.note} />
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </p>

      {missing.length > 0 && (
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <div className="mb-2 font-semibold text-foreground">Clues not found in stem</div>
          <ul className="space-y-1" dir="rtl" lang="fa">
            {missing.map((highlight, index) => (
              <li key={`${highlight.quote}-${index}`}>
                <BidiText text={highlight.quote} />
                {highlight.note ? (
                  <span className="text-muted-foreground">
                    {" - "}
                    <BidiText text={highlight.note} />
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
