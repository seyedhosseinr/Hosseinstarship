"use client";

import { Lightbulb, ListChecks, MessageSquareText, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { McqAmbossReview } from "@/types/mcq-review";
import { cn } from "@/lib/utils";
import { BidiText } from "./BidiText";
import { OptionReviewCard } from "./OptionReviewCard";
import { StemHighlightText } from "./StemHighlightText";

type AmbossReviewPanelProps = {
  stem: string;
  options: string[];
  optionKeys?: string[];
  correctAnswer: string;
  review: McqAmbossReview;
  className?: string;
};

const DEFAULT_OPTION_KEYS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export function AmbossReviewPanel({
  stem,
  options,
  optionKeys,
  correctAnswer,
  review,
  className,
}: AmbossReviewPanelProps) {
  const normalizedCorrectAnswer = correctAnswer.trim().toUpperCase();
  const reviewsByKey = new Map(
    review.optionReviews.map((optionReview) => [optionReview.optionKey.trim().toUpperCase(), optionReview]),
  );

  return (
    <section className={cn("mt-3 space-y-4", className)} dir="rtl" lang="fa" aria-label="Question review">
      <Card variant="clinical" className="rounded-md border-emerald-200 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/20">
        <CardHeader className="p-4 pb-0">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Lightbulb className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            Key Teaching Point
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-3">
          <p className="text-sm leading-7 text-foreground" dir="rtl" lang="fa">
            <BidiText text={review.keyTeachingPoint} />
          </p>
        </CardContent>
      </Card>

      <Card variant="outline" className="rounded-md">
        <CardHeader className="p-4 pb-0">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-amber-600" aria-hidden="true" />
              Annotated Stem Clues
            </CardTitle>
            <Badge variant="outline" className="rounded-md" dir="ltr">
              {review.stemHighlights.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-3">
          <StemHighlightText stem={stem} highlights={review.stemHighlights} />
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 px-1">
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <MessageSquareText className="h-4 w-4 text-primary" aria-hidden="true" />
            Option-by-option Review
          </h3>
          <Badge variant="outline" className="rounded-md" dir="ltr">
            {options.length} options
          </Badge>
        </div>
        {options.map((optionText, index) => {
          const optionKey = (optionKeys?.[index] ?? DEFAULT_OPTION_KEYS[index] ?? String(index + 1)).toUpperCase();
          const optionReview = reviewsByKey.get(optionKey);
          return (
            <OptionReviewCard
              key={`${optionKey}-${index}`}
              optionKey={optionKey}
              optionText={optionText}
              correctAnswer={normalizedCorrectAnswer}
              review={optionReview}
            />
          );
        })}
      </div>

      {review.takeHomeMessages.length > 0 && (
        <Card variant="outline" className="rounded-md">
          <CardHeader className="p-4 pb-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ListChecks className="h-4 w-4 text-primary" aria-hidden="true" />
              Take-Home Messages
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-3">
            <ul className="space-y-2">
              {review.takeHomeMessages.map((message, index) => (
                <li key={`${message}-${index}`} className="text-sm leading-7 text-muted-foreground" dir="rtl" lang="fa">
                  <BidiText text={message} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
