// src/components/ui/shared-states.tsx
// Shared loading, empty, and error states for consistent cross-module UX.
"use client";

import * as React from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { Surface } from "./surface";

/* ================================================================== */
/*  LoadingState                                                       */
/* ================================================================== */

interface LoadingStateProps {
  /** Message shown below the spinner (default: "در حال بارگذاری…") */
  message?: string;
  /** Compact variant for card-level loading vs full-page */
  compact?: boolean;
}

export function LoadingState({
  message = "در حال بارگذاری…",
  compact = false,
}: LoadingStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 ${
        compact ? "py-10" : "py-24"
      }`}
    >
      <div className="h-8 w-8 rounded-full border-[2.5px] border-primary/20 border-t-primary animate-spin" />
      <p className="text-sm font-medium text-muted-foreground">
        {message}
      </p>
    </div>
  );
}

/* ================================================================== */
/*  EmptyState                                                         */
/* ================================================================== */

interface EmptyStateProps {
  /** Icon rendered above the message (pass a Lucide icon element). */
  icon?: React.ReactNode;
  /** Heading (default: "موردی یافت نشد") */
  title?: string;
  /** Sub-message with more detail. */
  description?: string;
  /** Primary action button (e.g. "ساخت آزمون جدید"). */
  action?: React.ReactNode;
}

export function EmptyState({
  icon,
  title = "موردی یافت نشد",
  description,
  action,
}: EmptyStateProps) {
  return (
    <Surface variant="subtle" padding="lg" radius="xl" className="text-center">
      {icon && (
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/5">
          <div className="text-muted-foreground">{icon}</div>
        </div>
      )}
      <p className="text-base font-semibold mb-1 text-foreground">
        {title}
      </p>
      {description && (
        <p className="text-sm mb-4 text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </Surface>
  );
}

/* ================================================================== */
/*  ErrorState                                                         */
/* ================================================================== */

interface ErrorStateProps {
  /** Error message */
  message?: string;
  /** Retry callback — when provided, shows a "تلاش مجدد" button. */
  onRetry?: () => void;
}

export function ErrorState({
  message = "خطایی رخ داد. لطفاً دوباره تلاش کنید.",
  onRetry,
}: ErrorStateProps) {
  return (
    <Surface variant="subtle" padding="lg" radius="xl" className="text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <p className="text-sm font-medium mb-3 text-foreground">
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          تلاش مجدد
        </button>
      )}
    </Surface>
  );
}

/* ================================================================== */
/*  ActionButton — shared primary/ghost button presets                  */
/* ================================================================== */

interface ActionButtonProps {
  variant?: "primary" | "ghost" | "outline";
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}

const VARIANT_CLASSES: Record<string, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  ghost: "bg-transparent text-muted-foreground hover:bg-muted/50",
  outline: "bg-transparent text-primary border border-primary/20 hover:bg-primary/5",
};

export function ActionButton({
  variant = "primary",
  children,
  onClick,
  disabled,
  className = "",
  type = "button",
}: ActionButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 px-4 py-2.5 ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
