"use client";

import { cn } from "@/lib/utils";

type BadgeVariant = "mode" | "difficulty" | "status" | "neutral";

const variantStyles: Record<BadgeVariant, string> = {
  mode: "bg-lib-accent/15 text-lib-accent",
  difficulty: "bg-lib-warning-soft text-lib-warning",
  status: "bg-lib-success-soft text-lib-success",
  neutral: "bg-lib-hover text-lib-text-secondary",
};

export interface ExamBadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

export function ExamBadge({ label, variant = "neutral", className }: ExamBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5",
        "text-[10px] font-bold uppercase tracking-widest",
        variantStyles[variant],
        className,
      )}
    >
      {label}
    </span>
  );
}
