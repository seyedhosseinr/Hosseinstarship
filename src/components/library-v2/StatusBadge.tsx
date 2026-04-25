"use client";

import { Check, CheckCheck, Circle, Disc, Star } from "lucide-react";
import type { ChapterStatus } from "@/lib/library/progress";
import { cn } from "@/lib/utils";

/**
 * Visual status badge for chapter progress.
 * Five distinct states with icons.
 */

const statusConfig: Record<
  ChapterStatus,
  { icon: React.ReactNode; label: string; className: string }
> = {
  not_started: {
    icon: <Circle className="h-3.5 w-3.5" />,
    label: "Not started",
    className: "text-lib-text-muted",
  },
  reading: {
    icon: <Disc className="h-3.5 w-3.5" />,
    label: "Reading",
    className: "text-lib-accent",
  },
  read: {
    icon: <Check className="h-3.5 w-3.5" />,
    label: "Read",
    className: "text-lib-success",
  },
  reviewed: {
    icon: <CheckCheck className="h-3.5 w-3.5" />,
    label: "Reviewed",
    className: "text-lib-accent",
  },
  mastered: {
    icon: <Star className="h-3.5 w-3.5 fill-current" />,
    label: "Mastered",
    className: "text-warning",
  },
};

interface StatusBadgeProps {
  status: ChapterStatus;
  showLabel?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  showLabel = false,
  className,
}: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        config.className,
        className,
      )}
      title={config.label}
    >
      {config.icon}
      {showLabel && (
        <span className="text-xs font-medium">{config.label}</span>
      )}
    </span>
  );
}
