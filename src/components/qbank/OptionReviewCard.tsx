"use client";

import { CheckCircle2, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { McqOptionReview } from "@/types/mcq-review";
import { cn } from "@/lib/utils";
import { BidiText } from "./BidiText";

type OptionReviewCardProps = {
  optionKey: string;
  optionText: string;
  correctAnswer: string;
  review?: McqOptionReview;
};

export function OptionReviewCard({
  optionKey,
  optionText,
  correctAnswer,
  review,
}: OptionReviewCardProps) {
  const isCorrect = optionKey.trim().toUpperCase() === correctAnswer.trim().toUpperCase();

  return (
    <Card
      variant="outline"
      className={cn(
        "rounded-md shadow-none",
        isCorrect
          ? "border-emerald-300 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20"
          : "border-rose-200/70 bg-card dark:border-rose-950/60",
      )}
      dir="rtl"
      lang="fa"
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex items-center gap-2 sm:min-w-40">
            <span
              className={cn(
                "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-bold",
                isCorrect ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground",
              )}
              dir="ltr"
            >
              {optionKey}
            </span>
            {isCorrect ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            ) : (
              <XCircle className="h-4 w-4 text-rose-600" aria-hidden="true" />
            )}
            <span className={cn("text-xs font-semibold", isCorrect ? "text-emerald-700" : "text-rose-700")}>
              {isCorrect ? "Correct" : "Incorrect"}
            </span>
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="text-sm font-semibold leading-6 text-foreground" dir="rtl" lang="fa">
              <BidiText text={optionText} />
            </div>

            {review ? (
              <div className="space-y-2">
                <p className="text-sm leading-7 text-muted-foreground" dir="rtl" lang="fa">
                  <BidiText text={review.why} />
                </p>
                <div className="flex flex-wrap gap-2">
                  {review.discriminator ? (
                    <Badge variant="review" className="rounded-md" dir="rtl" lang="fa">
                      <BidiText text={review.discriminator} />
                    </Badge>
                  ) : null}
                  {review.trapType ? (
                    <Badge variant="outline" className="rounded-md text-muted-foreground" dir="ltr">
                      {review.trapType}
                    </Badge>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="text-sm leading-7 text-muted-foreground" dir="rtl" lang="fa">
                No option-specific explanation was provided for this choice.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
