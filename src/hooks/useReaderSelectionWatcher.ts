"use client";

import { useEffect, type RefObject } from "react";

/**
 * Input-agnostic selection trigger for the reader popup.
 *
 * Replaces the old per-gesture (mouseup / touchend / pen-pointerup) opening
 * paths inside SelectionPopup. Listens to document `selectionchange` and
 * fires custom DOM events that any popup or other observer can subscribe
 * to:
 *
 *   "reader:selection-settled"  — the user has a non-collapsed selection
 *                                 inside [data-reader-content] AND any
 *                                 active pointer has lifted AND a 120 ms
 *                                 trailing settle timer has elapsed
 *   "reader:selection-cleared"  — selection collapsed or moved outside
 *                                 reader content
 *
 * The settle timer absorbs raw mid-drag selectionchange noise. During an
 * active pointer that started inside content, settle is suppressed until
 * pointerup; this preserves the existing drag-to-select feel and prevents
 * popup flicker while dragging.
 *
 * Sources covered automatically by `selectionchange`:
 *   - mouse drag, finger long-press-drag, pen-driven Range mutation
 *   - double-click (word) / triple-click (paragraph)
 *   - shift+arrow, shift+click extension, Cmd+A inside content
 *   - programmatic selection (Find-in-page, future "select citation")
 *
 * Bail-outs:
 *   - selection focus inside <input>, <textarea>, or [contenteditable=true]
 *   - active IME composition (compositionstart…compositionend)
 *   - selection scope outside the contentSelector
 *
 * Reposition on scroll: while there's a current settled selection, scroll
 * on the stage re-fires "reader:selection-settled" so the popup can
 * recompute its anchor rect. Throttled with rAF.
 *
 * Listeners are document-level so the watcher works for selections that
 * span frames or sections.
 */

const SETTLE_MS = 120;

interface Options {
  contentSelector: string;
  scrollRef: RefObject<HTMLElement | null>;
  enabled?: boolean;
}

function focusInsideEditable(): boolean {
  const sel = window.getSelection();
  const node = sel?.focusNode ?? sel?.anchorNode ?? null;
  if (!node) return false;
  const el = node instanceof Element ? node : node.parentElement;
  return !!el?.closest("input, textarea, [contenteditable=true]");
}

function focusInsideContent(contentSelector: string): boolean {
  const sel = window.getSelection();
  const node = sel?.focusNode ?? sel?.anchorNode ?? null;
  if (!node) return false;
  const el = node instanceof Element ? node : node.parentElement;
  return !!el?.closest(contentSelector);
}

export function useReaderSelectionWatcher({
  contentSelector,
  scrollRef,
  enabled = true,
}: Options): void {
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    let settleTimer: number | null = null;
    let pointerActive = false;
    let composing = false;
    let lastDispatchedSettled = false;
    let scrollRaf = 0;

    const clearSettle = () => {
      if (settleTimer !== null) {
        window.clearTimeout(settleTimer);
        settleTimer = null;
      }
    };

    const evaluate = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        if (lastDispatchedSettled) {
          lastDispatchedSettled = false;
          document.dispatchEvent(new CustomEvent("reader:selection-cleared"));
        }
        return;
      }
      if (composing) return;
      if (focusInsideEditable()) return;
      if (!focusInsideContent(contentSelector)) {
        if (lastDispatchedSettled) {
          lastDispatchedSettled = false;
          document.dispatchEvent(new CustomEvent("reader:selection-cleared"));
        }
        return;
      }
      lastDispatchedSettled = true;
      document.dispatchEvent(new CustomEvent("reader:selection-settled"));
    };

    const scheduleSettle = () => {
      clearSettle();
      settleTimer = window.setTimeout(() => {
        settleTimer = null;
        if (pointerActive) return; // re-checked when pointer lifts
        evaluate();
      }, SETTLE_MS);
    };

    const onSelectionChange = () => {
      if (pointerActive) return;
      scheduleSettle();
    };

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest(contentSelector)) return;
      pointerActive = true;
      clearSettle();
    };

    const onPointerUpOrCancel = () => {
      if (!pointerActive) return;
      pointerActive = false;
      scheduleSettle();
    };

    const onCompositionStart = () => {
      composing = true;
    };
    const onCompositionEnd = () => {
      composing = false;
      scheduleSettle();
    };

    const onScroll = () => {
      if (!lastDispatchedSettled) return;
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = 0;
        // Re-fire so the popup can reposition. evaluate() also re-checks
        // bail-out conditions in case scroll moved focus out of content.
        evaluate();
      });
    };

    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUpOrCancel, true);
    document.addEventListener("pointercancel", onPointerUpOrCancel, true);
    document.addEventListener("compositionstart", onCompositionStart, true);
    document.addEventListener("compositionend", onCompositionEnd, true);
    const stage = scrollRef.current;
    stage?.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      clearSettle();
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerUpOrCancel, true);
      document.removeEventListener("pointercancel", onPointerUpOrCancel, true);
      document.removeEventListener("compositionstart", onCompositionStart, true);
      document.removeEventListener("compositionend", onCompositionEnd, true);
      stage?.removeEventListener("scroll", onScroll);
    };
  }, [contentSelector, scrollRef, enabled]);
}
