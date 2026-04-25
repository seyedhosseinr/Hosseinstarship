// src/components/ui/page-header.tsx
// Phase 1 – Design Foundation
// Canonical page-level header: breadcrumb trail → title + badge → description + actions.
// RTL-compatible via dir="auto" and rtl:-rotate- on the chevron.
// Distinct from PageHero (chip-only strip) — use PageHeader for full page structure.

"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BreadcrumbItem {
  label: string;
  /** When omitted the crumb renders as plain text (current page). */
  href?: string;
}

export interface PageHeaderProps {
  /** Required — rendered as <h1>. */
  title: string;
  /** One-line sentence below the title. */
  description?: string;
  /** Breadcrumb trail rendered above the title. */
  breadcrumb?: BreadcrumbItem[];
  /**
   * Slot for primary action buttons / menus aligned to the opposite end
   * of the title row (start on RTL, end on LTR).
   */
  actions?: React.ReactNode;
  /**
   * Small pill displayed inline after the title — useful for status,
   * version, or category labels (e.g. "Beta", "New", "Pro").
   */
  badge?: string;
  /**
   * Optional icon rendered in a contained square before the title text.
   * Pass any React node (Lucide icon, SVG, image).
   */
  icon?: React.ReactNode;
  /** Extra classes applied to the outermost <header> element. */
  className?: string;
  /**
   * Compact variant reduces spacing — suitable for sub-page or
   * nested section headers (not top-level page headers).
   */
  compact?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  badge,
  icon,
  className,
  compact = false,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col",
        compact ? "gap-0.5 mb-4 pt-4" : "gap-1 mb-8 pt-6",
        className
      )}
    >
      {/* ── Breadcrumb ─────────────────────────────────────────────────────── */}
      {breadcrumb && breadcrumb.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          dir="auto"
          className="flex items-center flex-wrap gap-1 mb-2"
        >
          {breadcrumb.map((crumb, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <ChevronRight
                  className="h-3 w-3 flex-shrink-0 rtl:rotate-180 text-border"
                  aria-hidden="true"
                />
              )}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="text-xs text-muted-foreground transition-colors duration-100 hover:underline underline-offset-2"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className="text-xs text-muted-foreground/80"
                  aria-current="page"
                >
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* ── Title row ──────────────────────────────────────────────────────── */}
      <div
        className="flex items-start justify-between gap-4"
        dir="auto"
      >
        {/* Left: icon + title + badge + description */}
        <div className="flex items-start gap-3 min-w-0">
          {/* Icon container */}
          {icon && (
            <div
              className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl border border-border bg-muted/50"
              aria-hidden="true"
            >
              {icon}
            </div>
          )}

          <div className="min-w-0">
            {/* Title + badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <h1
                className={cn(
                  "text-2xl md:text-3xl font-semibold tracking-tight text-foreground",
                  compact && "text-xl md:text-2xl"
                )}
              >
                {title}
              </h1>

              {badge && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wider uppercase bg-primary/5 text-primary border border-primary/20"
                >
                  {badge}
                </span>
              )}
            </div>

            {/* Description */}
            {description && (
              <p
                className="text-sm md:text-[15px] leading-7 mt-1 max-w-2xl text-muted-foreground"
              >
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Right: actions slot */}
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
