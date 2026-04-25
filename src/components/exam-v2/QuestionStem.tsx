"use client";

import { cn } from "@/lib/utils";

export interface QuestionStemProps {
  html: string;
  fontSize?: number;
  className?: string;
}

export function QuestionStem({ html, fontSize = 15, className }: QuestionStemProps) {
  return (
    <div
      className={cn("leading-[1.75] text-lib-text select-text", className)}
      style={{ fontSize }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
