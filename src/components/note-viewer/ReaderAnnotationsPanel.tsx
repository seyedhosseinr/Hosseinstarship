"use client";

import { useMemo, useState } from "react";
import { Highlighter, MessageSquareText, Search, Underline as UnderlineIcon, X } from "lucide-react";
import type { ReaderAnnotation } from "@/hooks/useReaderAnnotations";
import { cn } from "@/lib/utils";
import { useEntitySyncStatusBulk } from "@/hooks/useEntitySyncStatus";
import { SyncDot } from "@/components/local-first/SyncDot";

type ReaderAnnotationsPanelProps = {
  annotations: ReaderAnnotation[];
  isOpen: boolean;
  onClose: () => void;
  onJumpToFrame: (frameId: string | null) => void;
  onDelete: (annotationId: string) => void;
};

function annotationIcon(type: ReaderAnnotation["type"]) {
  switch (type) {
    case "highlight": return <Highlighter className="h-3.5 w-3.5" />;
    case "underline": return <UnderlineIcon className="h-3.5 w-3.5" />;
    case "comment":   return <MessageSquareText className="h-3.5 w-3.5" />;
  }
}

function annotationLabel(type: ReaderAnnotation["type"]) {
  switch (type) {
    case "highlight": return "Highlight";
    case "underline": return "Underline";
    case "comment":   return "Comment";
  }
}

function annotationTone(type: ReaderAnnotation["type"]) {
  switch (type) {
    case "highlight": return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400";
    case "underline": return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-400";
    case "comment":   return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400";
  }
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString(
      typeof navigator !== "undefined" ? navigator.language : "en-US",
      { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
    );
  } catch {
    return value;
  }
}

/* ════════════════════════════════════════════════════════
   ReaderAnnotationsPanel
   ─ Desktop (≥1024px): fixed left rail, full height
   ─ Mobile/tablet (<1024px): bottom sheet drawer
════════════════════════════════════════════════════════ */

export function ReaderAnnotationsPanel({
  annotations,
  isOpen,
  onClose,
  onJumpToFrame,
  onDelete,
}: ReaderAnnotationsPanelProps) {
  const [query, setQuery] = useState("");

  const syncStatusMap = useEntitySyncStatusBulk(
    "annotation",
    annotations.map((a) => a.id),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return annotations;
    return annotations.filter(
      (a) =>
        a.quote.toLowerCase().includes(q) ||
        a.comment?.toLowerCase().includes(q),
    );
  }, [annotations, query]);

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile/tablet backdrop — no blur to avoid GPU jank */}
      <div
        className="fixed inset-0 z-[130] bg-black/25 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className={cn(
          "fixed z-[140] flex flex-col",
          "bg-lib-surface/98 backdrop-blur-xl",
          // Desktop: left rail
          "lg:inset-y-0 lg:left-0 lg:w-80 lg:border-r lg:border-lib-border lg:shadow-none",
          // Mobile/tablet: bottom sheet
          "max-lg:inset-x-0 max-lg:bottom-0 max-lg:max-h-[72vh]",
          "max-lg:rounded-t-2xl max-lg:border-t max-lg:border-lib-border max-lg:shadow-2xl",
        )}
        aria-label="Annotations panel"
      >
        {/* Mobile pull handle */}
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-lib-border lg:hidden" />

        {/* Header */}
        <div className="shrink-0 border-b border-lib-border px-5 pb-3 pt-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-lib-text-muted">
                Annotations
              </div>
              <div className="mt-0.5 text-[15px] font-semibold text-lib-text">
                {query
                  ? `${filtered.length} of ${annotations.length}`
                  : `${annotations.length} saved`}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close annotations"
              className="rounded-lib-sm p-1.5 text-lib-text-muted transition hover:bg-lib-hover hover:text-lib-text"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Search input — only when there are annotations */}
          {annotations.length > 0 && (
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-lib-text-muted/60" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search annotations…"
                className={cn(
                  "w-full rounded-lib-sm border border-lib-border bg-lib-hover/50",
                  "py-2 pe-3 ps-8 text-[13px] text-lib-text placeholder:text-lib-text-muted/60",
                  "transition focus:border-lib-accent focus:outline-none focus:ring-1 focus:ring-lib-accent/30",
                )}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-lib-text-muted/60 hover:text-lib-text"
                  aria-label="Clear search"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* List — iOS momentum scroll */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
        >
          {annotations.length === 0 ? (
            <div className="rounded-lib-md border border-dashed border-lib-border px-5 py-10 text-center">
              <p className="text-sm font-medium text-lib-text-secondary">No annotations yet</p>
              <p className="mt-1.5 text-xs leading-relaxed text-lib-text-muted">
                Select text while reading to highlight, underline, or add a note.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lib-md border border-dashed border-lib-border px-5 py-8 text-center">
              <p className="text-sm font-medium text-lib-text-secondary">No matches</p>
              <p className="mt-1 text-xs text-lib-text-muted">Try a different search term.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {filtered.map((ann) => (
                <li key={ann.id} className="rounded-lib-md border border-lib-border-subtle bg-lib-hover/40 p-4">
                  {/* Type badge + color dot + delete */}
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em]",
                        annotationTone(ann.type),
                      )}>
                        {annotationIcon(ann.type)}
                        {annotationLabel(ann.type)}
                      </span>
                      {/* Actual highlight color swatch */}
                      {ann.type === "highlight" && ann.color && (
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-black/10 shadow-sm"
                          style={{ backgroundColor: ann.color }}
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <SyncDot status={syncStatusMap.get(ann.id) ?? null} />
                      <button
                        type="button"
                        onClick={() => onDelete(ann.id)}
                        className="text-xs text-lib-text-muted/60 transition hover:text-lib-danger"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {/* Quoted text — RTL-aware border (inline-start) */}
                  <blockquote className="border-s-2 border-lib-border ps-3 text-sm leading-7 text-lib-text/80">
                    {ann.quote}
                  </blockquote>

                  {/* Comment note */}
                  {ann.comment && (
                    <div className="mt-2.5 rounded-lib-sm border border-lib-border bg-lib-surface px-3 py-2.5 text-sm leading-7 text-lib-text-secondary">
                      {ann.comment}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <time className="text-[11px] text-lib-text-muted/60">{formatDate(ann.createdAt)}</time>
                    {ann.frameId && (
                      <button
                        type="button"
                        onClick={() => onJumpToFrame(ann.frameId)}
                        className="text-xs font-medium text-lib-accent transition hover:underline"
                      >
                        Jump to source
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
