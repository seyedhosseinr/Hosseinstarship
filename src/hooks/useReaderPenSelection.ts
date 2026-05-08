"use client";

import { useEffect, type RefObject } from "react";

/**
 * useReaderPenSelection
 *
 * Pen-drag-selects-text for Apple Pencil inside the Reader.
 *
 * Target device:
 *   iPad Pro M5 + Apple Pencil Pro
 *
 * What this hook does:
 *   - Intercepts pen-only pointer gestures inside Reader content.
 *   - Drives native DOM Selection via caretPositionFromPoint / caretRangeFromPoint.
 *   - Collects coalesced + predicted pointer events for WebGPU live-ink forwarding.
 *   - Applies word-boundary snap on stroke end.
 *   - Applies a conservative line-aware guard for horizontal single-line strokes.
 *   - Auto-scrolls the stage during drag.
 *   - Ignores hover/tap-like strokes.
 *   - Temporarily suppresses native iPad/Safari Copy/Select/Look Up callout
 *     only during Apple Pencil selection.
 *
 * What this hook does NOT do:
 *   - Paint persisted annotations    → ReaderHighlightLayer.tsx
 *   - Render WebGPU live ink         → PencilGpuInkLayer.tsx
 *
 * Custom events emitted on document:
 *   - reader:pencil-stroke-start
 *   - reader:pencil-stroke-move
 *   - reader:pencil-stroke-end
 *   - reader:pencil-stroke-cancel
 */

export interface PenPoint {
  x: number;
  y: number;
  pressure: number;
  tiltX: number;
  tiltY: number;
  twist: number;
  altitudeAngle: number | null;
  azimuthAngle: number | null;
  time: number;
  predicted: boolean;
}

export interface PenStrokeDetail {
  pointerId: number;
  points: PenPoint[];
  predictedPoints: PenPoint[];
  pressure: number;
  tiltX: number;
  tiltY: number;
  twist: number;
}

interface CaretPoint {
  node: Node;
  offset: number;
}

interface Options {
  scrollRef: RefObject<HTMLElement | null>;
  contentSelector: string;
  active: boolean;
}

type ExtendedPointerEvent = PointerEvent & {
  getCoalescedEvents?: () => PointerEvent[];
  getPredictedEvents?: () => PointerEvent[];
  altitudeAngle?: number;
  azimuthAngle?: number;
  twist?: number;
};

const PRESSURE_DOWN_THRESHOLD = 0.03;
const MIN_DRAG_DISTANCE_PX = 5;
const AUTOSCROLL_EDGE_PX = 80;
const AUTOSCROLL_MAX_SPEED = 32;

const NATIVE_CALLOUT_SUPPRESS_MS = 650;
const PEN_SELECTING_CLASS = "reader-pen-selecting";
const PEN_CALLOUT_STYLE_ID = "reader-pen-callout-suppression-style";

let warnedNoCaretAPI = false;

function ensurePenCalloutSuppressionStyle(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(PEN_CALLOUT_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = PEN_CALLOUT_STYLE_ID;

  style.textContent = `
html.${PEN_SELECTING_CLASS} [data-reader-content="true"],
html.${PEN_SELECTING_CLASS} [data-reader-content="true"] * {
  -webkit-touch-callout: none !important;
}

html.${PEN_SELECTING_CLASS} [data-reader-content="true"] {
  -webkit-tap-highlight-color: transparent;
}
`;

  document.head.appendChild(style);
}

function setPenSelectingClass(enabled: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle(PEN_SELECTING_CLASS, enabled);
}

function getCaretFromPoint(x: number, y: number): CaretPoint | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };

  if (typeof doc.caretPositionFromPoint === "function") {
    const pos = doc.caretPositionFromPoint(x, y);
    return pos ? { node: pos.offsetNode, offset: pos.offset } : null;
  }

  if (typeof doc.caretRangeFromPoint === "function") {
    const range = doc.caretRangeFromPoint(x, y);
    return range
      ? {
          node: range.startContainer,
          offset: range.startOffset,
        }
      : null;
  }

  if (!warnedNoCaretAPI) {
    warnedNoCaretAPI = true;
    console.warn(
      "[useReaderPenSelection] Neither caretPositionFromPoint nor caretRangeFromPoint is available; pen selection disabled.",
    );
  }

  return null;
}

function isNodeInside(root: HTMLElement, node: Node | null): boolean {
  return !!node && (root === node || root.contains(node));
}

function isWritableTarget(target: Element | null): boolean {
  if (!target) return false;

  return !!target.closest(
    'input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"], [contenteditable]:not([contenteditable="false"])',
  );
}

function setPointerCaptureSafely(element: Element | null, pointerId: number): void {
  try {
    if (element instanceof HTMLElement) {
      element.setPointerCapture(pointerId);
    }
  } catch {
    // Pointer capture is helpful but not required.
  }
}

function releasePointerCaptureSafely(
  element: Element | null,
  pointerId: number,
): void {
  try {
    if (element instanceof HTMLElement && element.hasPointerCapture(pointerId)) {
      element.releasePointerCapture(pointerId);
    }
  } catch {
    // Safari/WebKit can throw if capture was never acquired.
  }
}

function toPenPoint(event: PointerEvent, predicted: boolean): PenPoint {
  const e = event as ExtendedPointerEvent;

  return {
    x: event.clientX,
    y: event.clientY,
    pressure:
      typeof event.pressure === "number" && event.pressure > 0
        ? event.pressure
        : event.buttons > 0
          ? 0.5
          : 0,
    tiltX: typeof event.tiltX === "number" ? event.tiltX : 0,
    tiltY: typeof event.tiltY === "number" ? event.tiltY : 0,
    twist: typeof e.twist === "number" ? e.twist : 0,
    altitudeAngle: typeof e.altitudeAngle === "number" ? e.altitudeAngle : null,
    azimuthAngle: typeof e.azimuthAngle === "number" ? e.azimuthAngle : null,
    time: event.timeStamp,
    predicted,
  };
}

function getCoalescedPoints(event: PointerEvent): PenPoint[] {
  const e = event as ExtendedPointerEvent;

  try {
    const events =
      typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];

    const sourceEvents = events.length > 0 ? events : [event];
    return sourceEvents.map((item) => toPenPoint(item, false));
  } catch {
    return [toPenPoint(event, false)];
  }
}

function getPredictedPoints(event: PointerEvent): PenPoint[] {
  const e = event as ExtendedPointerEvent;

  try {
    const events =
      typeof e.getPredictedEvents === "function" ? e.getPredictedEvents() : [];

    return events.map((item) => toPenPoint(item, true));
  } catch {
    return [];
  }
}

function makeStrokeDetail(
  pointerId: number,
  points: PenPoint[],
  predictedPoints: PenPoint[],
): PenStrokeDetail {
  const last = points[points.length - 1] ?? predictedPoints[0];

  return {
    pointerId,
    points,
    predictedPoints,
    pressure: last?.pressure ?? 0,
    tiltX: last?.tiltX ?? 0,
    tiltY: last?.tiltY ?? 0,
    twist: last?.twist ?? 0,
  };
}

function dispatchPencilEvent(type: string, detail: PenStrokeDetail): void {
  document.dispatchEvent(new CustomEvent(type, { detail }));
}

function pointIsBefore(
  aNode: Node,
  aOffset: number,
  bNode: Node,
  bOffset: number,
): boolean {
  if (aNode === bNode) return aOffset < bOffset;

  const position = aNode.compareDocumentPosition(bNode);

  if (position & Node.DOCUMENT_POSITION_DISCONNECTED) {
    return false;
  }

  return (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

function makeRangeBetween(a: CaretPoint, b: CaretPoint): Range | null {
  try {
    const range = document.createRange();

    if (pointIsBefore(b.node, b.offset, a.node, a.offset)) {
      range.setStart(b.node, b.offset);
      range.setEnd(a.node, a.offset);
    } else {
      range.setStart(a.node, a.offset);
      range.setEnd(b.node, b.offset);
    }

    return range;
  } catch {
    return null;
  }
}

function selectRange(range: Range): void {
  const selection = window.getSelection();
  if (!selection) return;

  selection.removeAllRanges();
  selection.addRange(range);
}

function isWordChar(char: string): boolean {
  if (!char) return false;

  if (/[\p{L}\p{N}]/u.test(char)) return true;

  return "\u200c\u200d-‐–—_+/αβγδμµ".includes(char);
}

function snapStartToWord(node: Node, offset: number): CaretPoint {
  if (node.nodeType !== Node.TEXT_NODE) {
    return { node, offset };
  }

  const text = node.textContent ?? "";
  let nextOffset = Math.max(0, Math.min(offset, text.length));

  while (nextOffset > 0 && isWordChar(text[nextOffset - 1])) {
    nextOffset--;
  }

  return {
    node,
    offset: nextOffset,
  };
}

function snapEndToWord(node: Node, offset: number): CaretPoint {
  if (node.nodeType !== Node.TEXT_NODE) {
    return { node, offset };
  }

  const text = node.textContent ?? "";
  let nextOffset = Math.max(0, Math.min(offset, text.length));

  while (nextOffset < text.length && isWordChar(text[nextOffset])) {
    nextOffset++;
  }

  return {
    node,
    offset: nextOffset,
  };
}

function expandRangeToWords(range: Range): Range {
  const expanded = range.cloneRange();

  const start = snapStartToWord(expanded.startContainer, expanded.startOffset);
  const end = snapEndToWord(expanded.endContainer, expanded.endOffset);

  try {
    expanded.setStart(start.node, start.offset);
    expanded.setEnd(end.node, end.offset);
    return expanded;
  } catch {
    return range;
  }
}

/**
 * Lightweight line-aware guard.
 *
 * This does not select an entire visual line. It only detects single-line,
 * mostly-horizontal strokes and keeps snapping conservative.
 *
 * Full RTL/BiDi-safe line snapping should live later in pencilSnap.ts using
 * visual rect clustering, because Persian/English mixed lines make naive
 * left/right clamping unsafe.
 */
function applyLineAwareSnap(range: Range): Range {
  if (range.collapsed) return range;

  let lineHeight = 20;

  try {
    const startElement =
      range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.parentElement
        : range.startContainer instanceof HTMLElement
          ? range.startContainer
          : null;

    if (startElement) {
      const computed = window.getComputedStyle(startElement);
      const parsed = parseFloat(computed.lineHeight);

      if (Number.isFinite(parsed) && parsed > 0) {
        lineHeight = parsed;
      }
    }
  } catch {
    // Ignore style read errors.
  }

  let rect: DOMRect | null = null;

  try {
    rect = range.getBoundingClientRect();
  } catch {
    return range;
  }

  if (!rect || rect.width <= 0 || rect.height <= 0) return range;

  const isSingleLine = rect.height <= lineHeight * 1.5;
  const isMostlyHorizontal = rect.width > rect.height * 2;

  if (!isSingleLine || !isMostlyHorizontal) return range;

  return expandRangeToWords(range);
}

function maybeAutoScroll(stage: HTMLElement, point: PenPoint): void {
  const rect = stage.getBoundingClientRect();

  let delta = 0;

  if (point.y < rect.top + AUTOSCROLL_EDGE_PX) {
    const depth = Math.max(0, point.y - rect.top);
    const intensity = 1 - depth / AUTOSCROLL_EDGE_PX;
    delta = -Math.round(AUTOSCROLL_MAX_SPEED * intensity);
  } else if (point.y > rect.bottom - AUTOSCROLL_EDGE_PX) {
    const depth = Math.max(0, rect.bottom - point.y);
    const intensity = 1 - depth / AUTOSCROLL_EDGE_PX;
    delta = Math.round(AUTOSCROLL_MAX_SPEED * intensity);
  }

  if (delta !== 0 && Math.abs(point.tiltY) > 20) {
    const tiltBias = Math.min(1, Math.abs(point.tiltY) / 90);
    delta = Math.round(delta * (1 + tiltBias * 0.5));
  }

  if (delta !== 0) {
    stage.scrollTop += delta;
  }
}

function distance(a: PenPoint, b: PenPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
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

    const article = document.querySelector<HTMLElement>(contentSelector);
    if (!article) return;

    ensurePenCalloutSuppressionStyle();

    let anchor: CaretPoint | null = null;
    let latestFocus: CaretPoint | null = null;
    let dragging = false;
    let activePenId: number | null = null;
    let activePenElement: Element | null = null;

    let peakPressure = 0;
    let preInteractionText = "";
    let selectionFrame = 0;
    let firstPoint: PenPoint | null = null;
    let lastRealPoint: PenPoint | null = null;

    let pendingMovePoints: PenPoint[] = [];
    let pendingPredictedPoints: PenPoint[] = [];
    let moveDispatchFrame = 0;

    let suppressNativeCalloutUntil = 0;
    let calloutSuppressTimer = 0;

    const shouldSuppressNativeCallout = (): boolean => {
      return dragging || performance.now() < suppressNativeCalloutUntil;
    };

    const suppressNativeCalloutNow = (): void => {
      suppressNativeCalloutUntil =
        performance.now() + NATIVE_CALLOUT_SUPPRESS_MS;

      setPenSelectingClass(true);

      if (calloutSuppressTimer) {
        window.clearTimeout(calloutSuppressTimer);
      }

      calloutSuppressTimer = window.setTimeout(() => {
        if (!dragging && performance.now() >= suppressNativeCalloutUntil) {
          setPenSelectingClass(false);
        }
      }, NATIVE_CALLOUT_SUPPRESS_MS + 50);
    };

    const suppressNativeCalloutEvent = (event: Event): void => {
      if (!shouldSuppressNativeCallout()) return;

      const target = event.target as Element | null;
      if (!target) return;
      if (!article.contains(target)) return;
      if (isWritableTarget(target)) return;

      event.preventDefault();
      event.stopPropagation();
    };

    const cancelMoveDispatch = () => {
      if (moveDispatchFrame) {
        cancelAnimationFrame(moveDispatchFrame);
        moveDispatchFrame = 0;
      }

      pendingMovePoints = [];
      pendingPredictedPoints = [];
    };

    const flushPendingMoveDispatch = () => {
      if (moveDispatchFrame) {
        cancelAnimationFrame(moveDispatchFrame);
        moveDispatchFrame = 0;
      }

      if (!dragging || activePenId === null || !pendingMovePoints.length) {
        pendingMovePoints = [];
        pendingPredictedPoints = [];
        return;
      }

      dispatchPencilEvent(
        "reader:pencil-stroke-move",
        makeStrokeDetail(activePenId, pendingMovePoints, pendingPredictedPoints),
      );

      pendingMovePoints = [];
      pendingPredictedPoints = [];
    };

    const resetDrag = () => {
      dragging = false;
      anchor = null;
      latestFocus = null;
      firstPoint = null;
      lastRealPoint = null;
      peakPressure = 0;

      cancelMoveDispatch();

      if (activePenId !== null) {
        releasePointerCaptureSafely(activePenElement, activePenId);
      }

      activePenId = null;
      activePenElement = null;

      if (selectionFrame) {
        cancelAnimationFrame(selectionFrame);
        selectionFrame = 0;
      }

      if (!shouldSuppressNativeCallout()) {
        setPenSelectingClass(false);
      }
    };

    const isPenInsideContent = (event: PointerEvent): boolean => {
      if (event.pointerType !== "pen") return false;
      if (event.isPrimary === false) return false;

      const target = event.target as Element | null;
      if (!target) return false;
      if (isWritableTarget(target)) return false;

      return article === target || article.contains(target);
    };

    const applyLatestSelection = () => {
      selectionFrame = 0;

      if (!dragging || !anchor || !latestFocus) return;

      if (!document.contains(anchor.node) || !document.contains(latestFocus.node)) {
        resetDrag();
        return;
      }

      if (!isNodeInside(article, anchor.node) || !isNodeInside(article, latestFocus.node)) {
        return;
      }

      const range = makeRangeBetween(anchor, latestFocus);
      if (range) {
        selectRange(range);
      }
    };

    const scheduleSelectionUpdate = () => {
      if (selectionFrame) return;
      selectionFrame = requestAnimationFrame(applyLatestSelection);
    };

    const updateFocusFromPoint = (point: PenPoint): void => {
      const caret = getCaretFromPoint(point.x, point.y);
      if (!caret) return;
      if (!isNodeInside(article, caret.node)) return;

      latestFocus = caret;
      scheduleSelectionUpdate();
    };

    const flushMoveDispatch = () => {
      moveDispatchFrame = 0;

      if (!dragging || activePenId === null) return;
      if (!pendingMovePoints.length) return;

      dispatchPencilEvent(
        "reader:pencil-stroke-move",
        makeStrokeDetail(activePenId, pendingMovePoints, pendingPredictedPoints),
      );

      pendingMovePoints = [];
      pendingPredictedPoints = [];
    };

    const onDown = (event: PointerEvent) => {
      if (!isPenInsideContent(event)) return;
      if (activePenId !== null && event.pointerId !== activePenId) return;

      const points = getCoalescedPoints(event);
      const predictedPoints = getPredictedPoints(event);
      const first = points[0] ?? toPenPoint(event, false);

      if (first.pressure < PRESSURE_DOWN_THRESHOLD && event.buttons === 0) {
        return;
      }

      const caret = getCaretFromPoint(first.x, first.y);
      if (!caret) return;
      if (!isNodeInside(article, caret.node)) return;

      event.preventDefault();
      suppressNativeCalloutNow();

      dragging = true;
      activePenId = event.pointerId;
      activePenElement = event.target as Element | null;
      anchor = caret;
      latestFocus = caret;
      firstPoint = first;
      lastRealPoint = first;
      peakPressure = first.pressure;
      preInteractionText = window.getSelection()?.toString().trim() ?? "";

      setPointerCaptureSafely(activePenElement, event.pointerId);

      try {
        const collapsed = document.createRange();
        collapsed.setStart(caret.node, caret.offset);
        collapsed.setEnd(caret.node, caret.offset);
        selectRange(collapsed);
      } catch {
        // Non-critical.
      }

      dispatchPencilEvent(
        "reader:pencil-stroke-start",
        makeStrokeDetail(event.pointerId, points, predictedPoints),
      );
    };

    const onMove = (event: PointerEvent) => {
      if (!dragging || !anchor) return;
      if (event.pointerType !== "pen") return;
      if (activePenId !== null && event.pointerId !== activePenId) return;

      event.preventDefault();
      suppressNativeCalloutNow();

      const points = getCoalescedPoints(event);
      const predictedPoints = getPredictedPoints(event);
      const last = points[points.length - 1] ?? toPenPoint(event, false);

      lastRealPoint = last;
      peakPressure = Math.max(peakPressure, last.pressure);

      pendingMovePoints.push(...points);
      pendingPredictedPoints = predictedPoints;

      if (!moveDispatchFrame) {
        moveDispatchFrame = requestAnimationFrame(flushMoveDispatch);
      }

      updateFocusFromPoint(last);
      maybeAutoScroll(stage, last);
    };

    const onUp = (event: PointerEvent) => {
      if (!dragging) return;
      if (event.pointerType !== "pen") return;
      if (activePenId !== null && event.pointerId !== activePenId) return;

      event.preventDefault();
      suppressNativeCalloutNow();

      flushPendingMoveDispatch();

      const points = getCoalescedPoints(event);
      const last = points[points.length - 1] ?? lastRealPoint;

      if (last) {
        updateFocusFromPoint(last);
        peakPressure = Math.max(peakPressure, last.pressure);
      }

      if (selectionFrame) {
        cancelAnimationFrame(selectionFrame);
        selectionFrame = 0;
      }

      if (
        anchor &&
        latestFocus &&
        document.contains(anchor.node) &&
        document.contains(latestFocus.node)
      ) {
        const rawRange = makeRangeBetween(anchor, latestFocus);

        if (rawRange && !rawRange.collapsed) {
          const wordSnapped = expandRangeToWords(rawRange);
          const lineGuarded = applyLineAwareSnap(wordSnapped);
          selectRange(lineGuarded);
        }
      }

      dispatchPencilEvent(
        "reader:pencil-stroke-end",
        makeStrokeDetail(event.pointerId, points, []),
      );

      const finalPeakPressure = peakPressure;
      const startPoint = firstPoint;
      const endPoint = last;
      const preText = preInteractionText;

      resetDrag();

      const postInteractionText = window.getSelection()?.toString().trim() ?? "";

      if (finalPeakPressure < PRESSURE_DOWN_THRESHOLD) return;
      if (postInteractionText.length < 3) return;
      if (postInteractionText === preText) return;
      if (startPoint && endPoint && distance(startPoint, endPoint) < MIN_DRAG_DISTANCE_PX) {
        return;
      }

      document.dispatchEvent(
        new MouseEvent("mouseup", {
          bubbles: true,
        }),
      );
    };

    const onCancel = (event: PointerEvent) => {
      if (!dragging) return;
      if (activePenId !== null && event.pointerId !== activePenId) return;

      cancelMoveDispatch();

      const points = getCoalescedPoints(event);

      dispatchPencilEvent(
        "reader:pencil-stroke-cancel",
        makeStrokeDetail(event.pointerId, points, []),
      );

      resetDrag();
    };

    const listenerOptions: AddEventListenerOptions = {
      passive: false,
    };

    const calloutListenerOptions: AddEventListenerOptions = {
      capture: true,
      passive: false,
    };

    document.addEventListener("pointerdown", onDown, listenerOptions);
    document.addEventListener("pointermove", onMove, listenerOptions);
    document.addEventListener("pointerup", onUp, listenerOptions);
    document.addEventListener("pointercancel", onCancel, listenerOptions);

    document.addEventListener(
      "contextmenu",
      suppressNativeCalloutEvent,
      calloutListenerOptions,
    );

    document.addEventListener(
      "selectstart",
      suppressNativeCalloutEvent,
      calloutListenerOptions,
    );

    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);

      document.removeEventListener("contextmenu", suppressNativeCalloutEvent, {
        capture: true,
      });

      document.removeEventListener("selectstart", suppressNativeCalloutEvent, {
        capture: true,
      });

      if (calloutSuppressTimer) {
        window.clearTimeout(calloutSuppressTimer);
      }

      resetDrag();
      setPenSelectingClass(false);
    };
  }, [scrollRef, contentSelector, active]);
}