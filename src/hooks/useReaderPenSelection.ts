"use client";

import { useEffect, type RefObject } from "react";

/**
 * Pen-drag-selects-text for Apple Pencil inside the reader.
 *
 * Why this exists: on iPadOS Safari, Apple Pencil drag on web content
 * defaults to a scroll gesture, not a text-selection gesture. This hook
 * intercepts pen pointer events on the reader content and drives the
 * native Selection via caretPositionFromPoint / caretRangeFromPoint.
 *
 * Finger and mouse are untouched — native behavior continues to work.
 */

interface CaretPoint {
  node: Node;
  offset: number;
}

type CaretPositionFromPoint = (
  this: Document,
  x: number,
  y: number,
) => { offsetNode: Node; offset: number } | null;

let warnedNoCaretAPI = false;

function getCaretFromPoint(x: number, y: number): CaretPoint | null {
  const doc = document as Document & {
    caretPositionFromPoint?: CaretPositionFromPoint;
  };
  if (typeof doc.caretPositionFromPoint === "function") {
    const p = doc.caretPositionFromPoint(x, y);
    return p ? { node: p.offsetNode, offset: p.offset } : null;
  }
  if (typeof doc.caretRangeFromPoint === "function") {
    const r = doc.caretRangeFromPoint(x, y);
    return r ? { node: r.startContainer, offset: r.startOffset } : null;
  }
  if (!warnedNoCaretAPI) {
    warnedNoCaretAPI = true;
    console.warn(
      "[useReaderPenSelection] Neither caretPositionFromPoint nor caretRangeFromPoint is available; pen selection disabled.",
    );
  }
  return null;
}

function pointIsBefore(
  aNode: Node,
  aOff: number,
  bNode: Node,
  bOff: number,
): boolean {
  if (aNode === bNode) return aOff < bOff;
  const pos = aNode.compareDocumentPosition(bNode);
  return (pos & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

interface Options {
  scrollRef: RefObject<HTMLElement | null>;
  contentSelector: string;
  active: boolean;
}

export function useReaderPenSelection({
  scrollRef,
  contentSelector,
  active,
}: Options): void {
  useEffect(() => {
    if (!active) return;
    const stage = scrollRef.current;
    if (!stage) return;

    let anchorNode: Node | null = null;
    let anchorOffset = 0;
    let dragging = false;
    let activePenId: number | null = null;
    // Selection text at the start of the pen interaction. Used to gate the
    // synthetic mouseup dispatch so we don't wake SelectionPopup for no-op
    // taps or when the final selection is identical to what existed before.
    let preInteractionText = "";

    const penInsideContent = (e: PointerEvent): HTMLElement | null => {
      if (e.pointerType !== "pen") return null;
      const target = e.target as HTMLElement | null;
      // Scribble pass-through: never preventDefault or capture a pen
      // pointerdown that lands on a writable field. iPadOS automatically
      // converts pen scribble into text on focused <input>, <textarea>,
      // and [contenteditable=true]; intercepting the event would steal
      // focus and disable that flow.
      if (target?.closest("input, textarea, [contenteditable=true]")) return null;
      return target?.closest(contentSelector) as HTMLElement | null;
    };

    const resetDrag = () => {
      dragging = false;
      anchorNode = null;
      activePenId = null;
    };

    const onDown = (e: PointerEvent) => {
      if (!penInsideContent(e)) return;
      const caret = getCaretFromPoint(e.clientX, e.clientY);
      if (!caret) return;
      e.preventDefault();
      dragging = true;
      activePenId = e.pointerId;
      anchorNode = caret.node;
      anchorOffset = caret.offset;
      preInteractionText = window.getSelection()?.toString().trim() ?? "";
      const range = document.createRange();
      range.setStart(caret.node, caret.offset);
      range.setEnd(caret.node, caret.offset);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    };

    const onMove = (e: PointerEvent) => {
      if (!dragging || e.pointerType !== "pen" || !anchorNode) return;
      if (activePenId !== null && e.pointerId !== activePenId) return;
      // Anchor may have been detached if reader content re-rendered
      // mid-drag; bail safely instead of letting setStart throw.
      if (!document.contains(anchorNode)) {
        resetDrag();
        return;
      }
      e.preventDefault();

      const events =
        typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
      const last = events[events.length - 1] ?? e;
      const caret = getCaretFromPoint(last.clientX, last.clientY);
      if (!caret) return;

      const range = document.createRange();
      try {
        if (pointIsBefore(caret.node, caret.offset, anchorNode, anchorOffset)) {
          range.setStart(caret.node, caret.offset);
          range.setEnd(anchorNode, anchorOffset);
        } else {
          range.setStart(anchorNode, anchorOffset);
          range.setEnd(caret.node, caret.offset);
        }
      } catch {
        return;
      }
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);

      // Edge auto-scroll — small nudge per move; OK for pen cadence
      const stageRect = stage.getBoundingClientRect();
      const edge = 60;
      if (last.clientY < stageRect.top + edge) stage.scrollTop -= 10;
      else if (last.clientY > stageRect.bottom - edge) stage.scrollTop += 10;
    };

    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      if (activePenId !== null && e.pointerId !== activePenId) return;
      const wasPen = e.pointerType === "pen";
      resetDrag();
      if (!wasPen) return;
      e.preventDefault();
      // ─────────────────────────────────────────────────────────────────
      // SYNTHETIC_MOUSEUP_RETAINED — paranoid fallback, TTL 2026-06-22.
      //
      // Reason: useReaderSelectionWatcher (commit 2 of the post-Plan-A
      // pass) catches selectionchange on every input source including
      // programmatic Selection mutations from this hook. On every modern
      // browser tested in jsdom that is sufficient and this dispatch is
      // dead code. iPad Safari (real device) is the unknown — historical
      // WebKit bugs sometimes suppress selectionchange immediately after
      // a pen-driven Selection mutation. Until a real-device test in
      // Phase 4 confirms the watcher fires, we keep this dispatch as a
      // belt-and-suspenders wake-up.
      //
      // Revisit on 2026-06-22 (60 days from landing). Retest on the
      // current iPadOS at that date; if watcher reliably fires after
      // pen-driven selectionchange, delete this entire block.
      // grep for SYNTHETIC_MOUSEUP_RETAINED to find this on revisit.
      // ─────────────────────────────────────────────────────────────────
      const post = window.getSelection()?.toString().trim() ?? "";
      if (post.length < 3) return;
      if (post === preInteractionText) return;
      document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    };

    document.addEventListener("pointerdown", onDown);
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      // If active prop flipped mid-drag (e.g. user toggled Draw mode), clear
      // local closure state so next mount starts clean.
      resetDrag();
    };
  }, [scrollRef, contentSelector, active]);
}
