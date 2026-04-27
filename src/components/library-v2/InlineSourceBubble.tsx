"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { REFERENCE_TAG } from "@/lib/reader/anchor-bubble";
import { useReaderAnchor } from "./ReaderAnchorProvider";

const AUTO_DISMISS_MS = 4500;

/**
 * Compact contextual chip that explains why the user just landed on a
 * particular NOTE block. Rendered as an absolutely-positioned overlay
 * **portaled into the target block itself**, so it scrolls naturally with
 * the content (no fixed-position drift on iPad zoom, dynamic toolbar
 * collapse, or nested scroll containers).
 *
 * Z-index sits below SelectionPopup (z-50), the LibrarySpine (z-135), and
 * the ReaderAnnotationsPanel (z-140) so Apple Pencil highlight UIs and the
 * outline drawer always win. Pointer-events are scoped to the chip itself
 * so the surrounding overhang doesn't intercept text selection.
 */
export function InlineSourceBubble() {
  const { bubble, dismissBubble } = useReaderAnchor();
  const timerRef = useRef<number | null>(null);

  // Restart the auto-dismiss timer whenever a new bubble appears OR the
  // same bubble is re-triggered (nonce changes).
  useEffect(() => {
    if (!bubble) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      dismissBubble();
    }, AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [bubble, bubble?.nonce, dismissBubble]);

  if (!bubble) return null;
  if (typeof document === "undefined") return null;

  const tag = REFERENCE_TAG[bubble.kind];

  return createPortal(
    <div
      // Wrapper is the positioning anchor: pinned to the top of the target
      // block, overhanging upward. `pointer-events: none` so the visible
      // overhang doesn't swallow text selection / highlight gestures; the
      // chip itself re-enables pointer events.
      className={cn(
        "reader-source-bubble pointer-events-none absolute z-30",
        "inset-inline-start-2 -top-1",
      )}
      style={{ insetInlineStart: "0.5rem", bottom: "calc(100% + 6px)" }}
      data-reader-source-bubble
      data-reference-kind={bubble.kind}
    >
      <div
        role="status"
        aria-live="polite"
        dir="rtl"
        className={cn(
          "pointer-events-auto inline-flex max-w-[min(20rem,calc(100vw-2rem))] items-center gap-2",
          "rounded-full border border-lib-border/60 bg-lib-glass px-3 py-1.5",
          "shadow-[0_4px_18px_-6px_color-mix(in_oklab,hsl(var(--foreground))_22%,transparent)]",
          "backdrop-blur-xl",
        )}
      >
        <span
          dir="ltr"
          className={cn(
            "inline-flex shrink-0 items-center rounded-[4px]",
            "bg-lib-accent-soft px-1.5 py-[1px]",
            "text-[9.5px] font-bold uppercase leading-[1.6] tracking-[0.08em] text-lib-accent",
          )}
        >
          {tag}
        </span>
        <span
          className="min-w-0 truncate text-[12.5px] font-medium leading-snug text-lib-text"
          title={bubble.label}
        >
          {bubble.label}
        </span>
        {bubble.snippet && (
          <span
            className="hidden min-w-0 truncate text-[11.5px] text-lib-text-muted sm:inline"
            title={bubble.snippet}
          >
            {bubble.snippet}
          </span>
        )}
        <button
          type="button"
          onClick={dismissBubble}
          aria-label="بستن"
          className={cn(
            "ms-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
            "text-lib-text-muted transition-colors hover:bg-lib-hover hover:text-lib-text",
          )}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>,
    bubble.el,
  );
}
