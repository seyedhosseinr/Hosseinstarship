"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Breadcrumb: Volume → Part → Chapter.
 * Each level is a 44px-min tap target.
 * `compact` mode shows only "Ch. N" (for RhythmDock).
 */
interface CrumbSegment {
  label: string;
  href?: string;
}

interface ChapterCrumbProps {
  segments: CrumbSegment[];
  compact?: boolean;
  className?: string;
}

export function ChapterCrumb({
  segments,
  compact = false,
  className,
}: ChapterCrumbProps) {
  if (compact && segments.length > 0) {
    const last = segments[segments.length - 1];
    return (
      <span className={cn("truncate text-xs font-medium text-lib-text-secondary", className)}>
        {last.label}
      </span>
    );
  }

  return (
    <nav
      className={cn("flex items-center gap-1 text-xs text-lib-text-secondary", className)}
    >
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        const content = (
          <span
            className={cn(
              "max-w-[180px] truncate",
              isLast ? "font-semibold text-lib-text" : "font-medium",
              seg.href && !isLast && "text-lib-accent",
            )}
          >
            {seg.label}
          </span>
        );

        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight className="h-3 w-3 shrink-0 text-lib-text-muted" />
            )}
            {seg.href && !isLast ? (
              <Link
                href={seg.href}
                className="inline-flex min-h-[var(--lib-touch-min)] items-center rounded-lib-sm px-1 transition-colors hover:bg-lib-hover"
              >
                {content}
              </Link>
            ) : (
              <span className="inline-flex min-h-[var(--lib-touch-min)] items-center px-1">
                {content}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
