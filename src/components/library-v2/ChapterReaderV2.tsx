"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ChevronUp,
  Circle,
  Eraser,
  Eye,
  EyeOff,
  Highlighter,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  MousePointer2,
  NotebookPen,
  PanelLeft,
  Pen,
  StickyNote,
  Trash2,
  Underline,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import type { NoteViewerModel } from "@/lib/contract/note-viewer.types";
import type { CampbellChapterDetail, CampbellVolumeGroup } from "@/lib/library/queries";
import type { ChapterStatus } from "@/lib/library/progress";
import type { ReaderAnnotation, ReaderSelectionPayload } from "@/hooks/useReaderAnnotations";
import { useReaderAnnotations } from "@/hooks/useReaderAnnotations";
import { useAutoHighlight } from "@/hooks/useAutoHighlight";
import { useReaderSettings, READER_FONT_STACKS } from "@/hooks/useReaderSettings";
import { resolveSelectionAgainstCanonicalSurface } from "@/components/flashcard/SelectionPopup";
import { useReaderPenSelection } from "@/hooks/useReaderPenSelection";
import { usePalmBeforePenGuard } from "@/hooks/usePalmBeforePenGuard";
import { useReaderSelectionWatcher } from "@/hooks/useReaderSelectionWatcher";
import { useStatusMachine } from "@/hooks/useStatusMachine";
import { useFocusMode } from "@/hooks/useFocusMode";
import { usePanelState } from "@/hooks/usePanelState";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import { useScrollSpy } from "@/hooks/useScrollSpy";
import { cn } from "@/lib/utils";
import { resolveAnchorRange } from "@/lib/local-first/anchorResolver";

import { DrawingLayer, type DrawingLayerHandle, type DrawTool } from "./DrawingLayer";
import { PencilSqueezePalette } from "./PencilSqueezePalette";
import { ReaderDisplaySettings } from "./ReaderDisplaySettings";
import { LibraryShell } from "./LibraryShell";
import { PencilGpuInkLayer } from "./PencilGpuInkLayer";
import { PencilDebugOverlay } from "./PencilDebugOverlay";
import { ReaderHighlightLayer } from "./ReaderHighlightLayer";
import { NoteMarkerLayer } from "./NoteMarkerLayer";
import { LibrarySpine, type MicroNavContext } from "./LibrarySpine";
import { ReaderStage } from "./ReaderStage";
import { MeasureColumn } from "./MeasureColumn";
import { SegmentRenderer } from "./SegmentRenderer";
import { StatusBadge } from "./StatusBadge";
import { ReaderReferenceRail } from "./ReaderReferenceRail";
import { MediaRefProvider } from "@/components/starship-media/MediaRefProvider";

const SelectionPopup = dynamic(
  () => import("@/components/flashcard/SelectionPopup").then((m) => m.SelectionPopup),
  { ssr: false, loading: () => null },
);
const ReaderAnnotationsPanel = dynamic(
  () => import("@/components/note-viewer/ReaderAnnotationsPanel").then((m) => m.ReaderAnnotationsPanel),
  { ssr: false, loading: () => null },
);
const ReaderUserNotesPanel = dynamic(
  () => import("@/components/note-viewer/ReaderUserNotesPanel").then((m) => m.ReaderUserNotesPanel),
  { ssr: false, loading: () => null },
);

/* ── Props ── */

interface ChapterReaderV2Props {
  chapter: CampbellChapterDetail;
  notes: NoteViewerModel[];
  initialStatus: ChapterStatus;
  navigation: CampbellVolumeGroup[];
}

/* ── Per-tool stroke width config ── */
type ToolWithWidth = "highlight" | "underline" | "circle" | "pen" | "highlighter";

const TOOL_WIDTH_CFG: Record<ToolWithWidth, { min: number; max: number; step: number; default: number }> = {
  highlight:   { min: 1,   max: 8,  step: 0.5, default: 2.5 },
  underline:   { min: 0.5, max: 8,  step: 0.5, default: 2.5 },
  circle:      { min: 0.5, max: 8,  step: 0.5, default: 2.5 },
  pen:         { min: 0.5, max: 6,  step: 0.5, default: 2.05 },
  highlighter: { min: 4,   max: 32, step: 2,   default: 18  },
};

/* ── Drawing palette constants ── */
const DRAW_COLORS = [
  { value: "#D4B106", label: "زرد / مهم" },
  { value: "#4B9BFF", label: "آبی / بورد فکت" },
  { value: "#57B26A", label: "سبز / فهمیدم" },
  { value: "#D96AA0", label: "صورتی / اشتباه" },
  { value: "#8A63D2", label: "بنفش / فلش‌کارت" },
  { value: "#D9893D", label: "نارنجی / هشدار" },
] as const;

const DRAW_WIDTHS = [
  { value: 1.2, dot: 5, label: "Fine" },
  { value: 2.05, dot: 8, label: "Book" },
  { value: 2.7, dot: 11, label: "Margin" },
] as const;

// ── Pointer diagnostics ─────────────────────────────────────────────────────
// Set NEXT_PUBLIC_READER_POINTER_DEBUG=1 to log all pen/touch pointer events.
// Use this when validating Apple Pencil Pro button / gesture values on real
// iPad Pro M5 hardware — do not infer field semantics from simulator output.
const POINTER_DEBUG =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_READER_POINTER_DEBUG === "1";

// ── Software double-tap fallback gate ────────────────────────────────────────
// Real Apple Pencil double-tap arrives via the native UIPencilInteraction
// bridge ("starship:pencil-double-tap" CustomEvent). The software heuristic
// below is DISABLED by default — it fires from ordinary PointerEvents and is
// NOT a verified hardware gesture.
// Enable only for debugging: NEXT_PUBLIC_READER_SOFTWARE_DOUBLE_TAP=1
const SOFTWARE_DOUBLE_TAP_ENABLED =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_READER_SOFTWARE_DOUBLE_TAP === "1";

// altitudeAngle / azimuthAngle: in W3C spec; TS lib.dom may already declare
// them as non-optional `number`. Use a loose intersection to avoid conflicts.
type ExtPointerFields = { altitudeAngle?: number; azimuthAngle?: number };

function logPointerEvent(label: string, e: PointerEvent): void {
  if (!POINTER_DEBUG) return;
  const ext = e as PointerEvent & ExtPointerFields;
  console.log(`[ReaderPencil] ${label}`, {
    pointerType: e.pointerType,
    button: e.button,
    buttons: e.buttons,
    pressure: e.pressure,
    tiltX: e.tiltX,
    tiltY: e.tiltY,
    ...(ext.altitudeAngle !== undefined && { altitudeAngle: ext.altitudeAngle }),
    ...(ext.azimuthAngle !== undefined && { azimuthAngle: ext.azimuthAngle }),
  });
}

// ── Annotation-range helpers ─────────────────────────────────────────────────

function normalizeAnnotationText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Returns true when DOM range `a` overlaps range `b` (strictly — not just touching).
 * Swallows DOMException for cross-document comparisons.
 */
function rangesIntersect(a: Range, b: Range): boolean {
  try {
    // a.end > b.start  AND  a.start < b.end
    return (
      a.compareBoundaryPoints(Range.END_TO_START, b) > 0 &&
      a.compareBoundaryPoints(Range.START_TO_END, b) < 0
    );
  } catch {
    return false;
  }
}

/**
 * Stable selector for the reader content area.
 * Used by highlight, underline, annotation, and pen-selection hooks.
 * Centralised here so a rename never silently breaks multiple call-sites.
 */
const READER_CONTENT_SELECTOR = "[data-reader-content]";

/* ── Annotation tool (GoodNotes-style rail) ── */
export type AnnotationTool =
  | "cursor"
  | "highlight"
  | "underline"
  | "pen"
  | "highlighter"
  | "circle"
  | "eraser";

/* ════════════════════════════════════════════════════════
   ChapterReaderV2 — multi-segment chapter reader.
   Slim top bar: Back | TOC | Annotations | Focus | Pen
════════════════════════════════════════════════════════ */

export function ChapterReaderV2({
  chapter,
  notes,
  initialStatus,
  navigation,
}: ChapterReaderV2Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  const { status, markRead } = useStatusMachine(chapter.chapterNo, initialStatus);
  const { isFocusMode, toggle: toggleFocus } = useFocusMode(shellRef, {
    useNativeFullscreen: true,
  });
  const panels = usePanelState(isFocusMode);
  const [highlightsVisible, setHighlightsVisible] = useState(true);

  // ── Annotation tool (GoodNotes rail) ──
  const [annotationTool, setAnnotationTool] = useState<AnnotationTool>("cursor");

  const penMode = annotationTool === "pen" || annotationTool === "highlighter" || annotationTool === "circle" || annotationTool === "eraser";

  // Map annotation tool → DrawTool for the drawing layer
  const activePenTool = useMemo((): DrawTool => {
    if (annotationTool === "eraser") return "eraser";
    if (annotationTool === "highlighter") return "highlighter";
    if (annotationTool === "circle") return "circle";
    return "pen";
  }, [annotationTool]);

  const selectAnnotationTool = useCallback((tool: AnnotationTool) => {
    setAnnotationTool((prev) => (prev === tool ? "cursor" : tool));
  }, []);

  const togglePenMode = useCallback(() => {
    setAnnotationTool((prev) =>
      (prev === "pen" || prev === "highlighter" || prev === "circle" || prev === "eraser")
        ? "cursor"
        : "pen",
    );
  }, []);

  // When entering pen/draw mode, clear text selection
  useEffect(() => {
    if (!penMode) return;
    window.getSelection()?.removeAllRanges();
  }, [penMode]);

  // ── User notes panel (study notes, local-first) ──
  const [userNotesOpen, setUserNotesOpen] = useState(false);
  const toggleUserNotes = useCallback(() => setUserNotesOpen((v) => !v), []);

  // Pencil drag-selects text in Select mode (penMode=false).
  // iPadOS Safari otherwise treats Pencil drag as a scroll gesture.
  useReaderPenSelection({
    scrollRef,
    contentSelector: READER_CONTENT_SELECTOR,
    active: !penMode,
  });

  // Undo any accidental scroll from a palm that landed just before the pen.
  usePalmBeforePenGuard(scrollRef);

  // Input-agnostic SelectionPopup trigger: replaces the popup's internal
  // mouseup/touchend listeners. Fires on any selectionchange (mouse, pen,
  // finger, keyboard, double/triple-click, programmatic) once settled.
  useReaderSelectionWatcher({
    contentSelector: READER_CONTENT_SELECTOR,
    scrollRef,
  });

  const [penColor, setPenColor] = useState<string>(DRAW_COLORS[0].value);

  const [toolWidths, setToolWidths] = useState<Partial<Record<ToolWithWidth, number>>>({});
  const getToolWidth = useCallback((t: ToolWithWidth) => toolWidths[t] ?? TOOL_WIDTH_CFG[t].default, [toolWidths]);
  const adjustToolWidth = useCallback((t: ToolWithWidth, delta: number) => {
    const cfg = TOOL_WIDTH_CFG[t];
    setToolWidths(prev => {
      const cur = prev[t] ?? cfg.default;
      const raw = Math.max(cfg.min, Math.min(cfg.max, cur + delta));
      const snapped = Math.round(raw / cfg.step) * cfg.step;
      return { ...prev, [t]: parseFloat(snapped.toFixed(2)) };
    });
  }, []);
  const penWidth = getToolWidth("pen");
  // penTool is derived from annotationTool; kept as alias for DrawingLayer
  const penTool = activePenTool;
  const drawingLayerRef = useRef<DrawingLayerHandle>(null);

  // ── Apple Pencil Pro squeeze palette ──────────────────────────────────────
  //
  // Opened ONLY via openPaletteFromVerifiedPencilSqueeze(), which is called
  // exclusively by the "starship:pencil-squeeze" CustomEvent bridge.
  // No PointerEvent (button===0/1/2, pointerType, etc.) opens this palette.
  // PointerEvent.button values are NOT Apple Pencil Pro squeeze signals.
  const [squeezePos, setSqueezePos] = useState<{ x: number; y: number } | null>(null);

  // Software double-tap fallback tracking (pen↔eraser toggle only — NOT palette)
  const lastPenTapRef = useRef(0);
  const penDownRef = useRef<{ x: number; y: number } | null>(null);
  const penMovedRef = useRef(false);

  const toggleEraser = useCallback(
    () => selectAnnotationTool("eraser"),
    [selectAnnotationTool],
  );
  const undoStroke = useCallback(() => drawingLayerRef.current?.undo(), []);
  const clearDrawing = useCallback(() => drawingLayerRef.current?.clear(), []);

  // ── Reader AA controls ──
  const { settings: readerSettings, update: updateReaderSettings } = useReaderSettings();
  const [fontSizeOpen, setFontSizeOpen] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // ── Toolbar visibility: manual collapse + scroll-aware auto-hide ──
  // Hides on scroll-down past 120px, reveals on scroll-up. Manual toggle
  // pins the bar in collapsed state and persists across sessions.
  const [toolbarPinnedCollapsed, setToolbarPinnedCollapsed] = useState(false);
  const [toolbarVisibleByScroll, setToolbarVisibleByScroll] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("reader:topbar:collapsed");
      if (saved === "1") setToolbarPinnedCollapsed(true);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("reader:topbar:collapsed", toolbarPinnedCollapsed ? "1" : "0");
    } catch { /* ignore */ }
  }, [toolbarPinnedCollapsed]);

  useEffect(() => {
    const stage = scrollRef.current;
    if (!stage) return;
    let lastY = stage.scrollTop;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = stage.scrollTop;
        const dy = y - lastY;
        if (y < 120) {
          setToolbarVisibleByScroll(true);
        } else if (dy > 6) {
          setToolbarVisibleByScroll(false);
        } else if (dy < -6) {
          setToolbarVisibleByScroll(true);
        }
        lastY = y;
      });
    };
    stage.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      stage.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const toolbarCollapsed = toolbarPinnedCollapsed || !toolbarVisibleByScroll;

  // Close font-size popover on Escape (capture phase) or pointerdown outside toolbar
  useEffect(() => {
    if (!fontSizeOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); setFontSizeOpen(false); }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setFontSizeOpen(false);
      }
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [fontSizeOpen]);

  const { annotations, addAnnotation, removeAnnotation, annotationCountByFrameId } =
    useReaderAnnotations(`ch-${chapter.chapterNo}`, chapter.chapterNo);

  // Auto-highlight is ON when annotation tool is "highlight"
  const { autoHighlight, toggleAutoHighlight } = useAutoHighlight({
    annotations,
    onHighlight: (sel, color) => addAnnotation({ selection: sel, type: "highlight", color }),
  });

  // Sync annotationTool ↔ autoHighlight
  useEffect(() => {
    const shouldBeOn = annotationTool === "highlight";
    if (shouldBeOn !== autoHighlight) toggleAutoHighlight();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotationTool]);

  // Auto-underline: when tool="underline", apply underline on selection-settled
  const addAnnotationRef = useRef(addAnnotation);
  useEffect(() => { addAnnotationRef.current = addAnnotation; }, [addAnnotation]);
  const annotationToolRef = useRef(annotationTool);
  useEffect(() => { annotationToolRef.current = annotationTool; }, [annotationTool]);

  useEffect(() => {
    const handler = () => {
      if (annotationToolRef.current !== "underline") return;
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";
      if (!text || text.length < 3 || text.length > 2000) return;
      const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
      if (!range) return;
      const anchorEl =
        range.commonAncestorContainer instanceof Element
          ? range.commonAncestorContainer
          : (range.commonAncestorContainer as Node).parentElement;
      if (!anchorEl?.closest(READER_CONTENT_SELECTOR)) return;
      const frameEl = anchorEl.closest<HTMLElement>("[data-frame-id]");
      const sectionEl = anchorEl.closest<HTMLElement>("[data-section-id]");
      const resolved = resolveSelectionAgainstCanonicalSurface(frameEl ?? null, range, text);
      const payload: ReaderSelectionPayload = {
        text,
        frameId: frameEl?.dataset.frameId ?? null,
        sectionId: sectionEl?.dataset.sectionId ?? null,
        blockText: resolved.blockText,
        start: resolved.start,
        end: resolved.end,
        contentHash: resolved.contentHash,
      };
      addAnnotationRef.current({ selection: payload, type: "underline" });
    };
    document.addEventListener("reader:selection-settled", handler);
    return () => document.removeEventListener("reader:selection-settled", handler);
  }, []);

  // H key: remove highlight(s) overlapping the current selection.
  // B key: scroll to top of reader.
  // Both are suppressed inside any editable surface or form control.
  useEffect(() => {
    const EDITABLE_SELECTOR =
      "input,textarea,select,[contenteditable]:not([contenteditable='false'])";

    const handler = (e: KeyboardEvent) => {
      if ((e.target as Element | null)?.closest(EDITABLE_SELECTOR)) return;

      if (e.key === "h" || e.key === "H") {
        const sel = window.getSelection();
        const selText = sel?.toString().trim();
        if (!selText || !sel || sel.rangeCount === 0) return;
        const selRange = sel.getRangeAt(0);

        const toRemove = annotations.filter((a) => {
          if (a.type !== "highlight") return false;

          // Primary: DOM-range intersection using stored character offsets.
          // Requires the frame element to be in the current DOM.
          if (
            a.frameId &&
            typeof a.blockOffsetStart === "number" &&
            typeof a.blockOffsetEnd === "number" &&
            a.blockOffsetEnd > a.blockOffsetStart
          ) {
            const frameEl = document.querySelector<HTMLElement>(
              `[data-frame-id="${CSS.escape(a.frameId)}"]`,
            );
            if (frameEl) {
              const annRange = resolveAnchorRange(frameEl, a.blockOffsetStart, a.blockOffsetEnd);
              if (annRange) return rangesIntersect(annRange, selRange);
            }
          }

          // Fallback: exact normalized text match only.
          // No loose "includes" — that risks deleting unrelated highlights.
          return normalizeAnnotationText(a.quote) === normalizeAnnotationText(selText);
        });

        if (toRemove.length > 0) {
          toRemove.forEach((a) => removeAnnotation(a.id));
          toast.success(
            toRemove.length === 1 ? "هایلایت حذف شد" : `${toRemove.length} هایلایت حذف شد`,
            { duration: 2000 },
          );
        }
      }

      if (e.key === "b" || e.key === "B") {
        scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [annotations, removeAnnotation]);

  // ── Apple Pencil Pro squeeze → GoodNotes crescent palette ──────────────────
  //
  // Floating palette opens ONLY from a verified Apple Pencil Pro squeeze.
  // No web PointerEvent fallback is allowed.
  // PointerEvent.button values (0, 1, 2) are NOT Apple Pencil Pro squeeze.
  // In pure PWA/Safari mode, this remains unavailable until a native
  // iOS/WKWebView bridge dispatches the "starship:pencil-squeeze" CustomEvent.
  //
  // Bridge event shape:
  //   new CustomEvent("starship:pencil-squeeze", {
  //     detail: { x?: number; y?: number; phase?: "began" | "changed" | "ended" }
  //   })
  //
  // The palette opens on phase === "ended" (or when phase is absent).
  // x/y are the pencil tip viewport coordinates from the native side.

  /** The ONLY function allowed to open the squeeze palette. */
  const openPaletteFromVerifiedPencilSqueeze = useCallback(
    (anchor: { x: number; y: number }) => {
      setSqueezePos(anchor);
    },
    [],
  );

  useEffect(() => {
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<{ x?: number; y?: number; phase?: "began" | "changed" | "ended" }>;
      const phase = e.detail?.phase;
      // Open on phase "ended" or when phase is absent.
      if (phase === "began" || phase === "changed") return;

      // Fall back to viewport centre when native side omits coordinates.
      const vw = typeof window !== "undefined" ? window.innerWidth  : 768;
      const vh = typeof window !== "undefined" ? window.innerHeight : 1024;
      const x = typeof e.detail?.x === "number" ? e.detail.x : vw / 2;
      const y = typeof e.detail?.y === "number" ? e.detail.y : vh / 2;

      openPaletteFromVerifiedPencilSqueeze({ x, y });
    };

    window.addEventListener("starship:pencil-squeeze", handler);
    return () => window.removeEventListener("starship:pencil-squeeze", handler);
  }, [openPaletteFromVerifiedPencilSqueeze]);

  // Close palette when the user taps outside of it
  useEffect(() => {
    if (!squeezePos) return;
    const onClose = (e: PointerEvent) => {
      const el = document.querySelector("[data-pencil-squeeze-palette]");
      if (!el || !el.contains(e.target as Node)) setSqueezePos(null);
    };
    document.addEventListener("pointerdown", onClose);
    return () => document.removeEventListener("pointerdown", onClose);
  }, [squeezePos]);

  // ── Apple Pencil Pro hardware double-tap → pen ↔ eraser toggle ──────────────
  //
  // Hardware Apple Pencil double-tap is received only through the native
  // UIPencilInteraction bridge. It is NOT the software heuristic below.
  // No web PointerEvent fallback is treated as real Apple Pencil double-tap.
  // Double-tap toggles pen ↔ eraser and never opens the squeeze palette.
  //
  // Bridge event shape:
  //   new CustomEvent("starship:pencil-double-tap", {
  //     detail: {
  //       x?: number;             // pencil tip viewport X at double-tap
  //       y?: number;             // pencil tip viewport Y at double-tap
  //       preferredAction?: string;  // maps from UIPencilInteraction.preferredTapAction
  //       source: "uipencilinteraction"  // required — verifies native origin
  //     }
  //   })

  /** The ONLY function allowed to respond to a hardware Apple Pencil double-tap. */
  const handleVerifiedPencilDoubleTap = useCallback(
    (_detail: { x?: number; y?: number; preferredAction?: string; source: string }) => {
      // Toggle pen ↔ eraser. Never opens the palette.
      setAnnotationTool((prev) =>
        prev === "eraser"
          ? "pen"
          : prev === "pen" || prev === "highlighter" || prev === "circle"
          ? "eraser"
          : prev,
      );
    },
    [],
  );

  useEffect(() => {
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<{
        x?: number;
        y?: number;
        preferredAction?: string;
        source?: string;
      }>;
      // Guard: only accept events from the verified native UIPencilInteraction bridge.
      // A missing or wrong source field is silently ignored.
      if (e.detail?.source !== "uipencilinteraction") return;
      handleVerifiedPencilDoubleTap({
        x: e.detail.x,
        y: e.detail.y,
        preferredAction: e.detail.preferredAction,
        source: e.detail.source,
      });
    };
    window.addEventListener("starship:pencil-double-tap", handler);
    return () => window.removeEventListener("starship:pencil-double-tap", handler);
  }, [handleVerifiedPencilDoubleTap]);

  // ── Software double-tap fallback (DISABLED by default) ───────────────────────
  //
  // This is a PointerEvent heuristic — two rapid no-stroke pen taps → toggle
  // pen ↔ eraser. It is NOT the Apple Pencil Pro hardware double-tap.
  // Real hardware double-tap goes through "starship:pencil-double-tap" above.
  //
  // Disabled by default. Enable only for debugging:
  //   NEXT_PUBLIC_READER_SOFTWARE_DOUBLE_TAP=1
  //
  // Set NEXT_PUBLIC_READER_POINTER_DEBUG=1 to log all pointer fields when
  // testing on real iPad Pro M5 + Apple Pencil Pro hardware.
  useEffect(() => {
    // Software double-tap fallback — disabled unless explicitly opted in.
    if (!SOFTWARE_DOUBLE_TAP_ENABLED) return;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "pen" && e.pointerType !== "touch") return;
      logPointerEvent("pointerdown", e);
      if (e.button !== 0) return;
      penDownRef.current = { x: e.clientX, y: e.clientY };
      penMovedRef.current = false;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "pen" && e.pointerType !== "touch") return;
      if (!penDownRef.current) return;
      const dx = e.clientX - penDownRef.current.x;
      const dy = e.clientY - penDownRef.current.y;
      if (dx * dx + dy * dy > 64) penMovedRef.current = true;
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== "pen" && e.pointerType !== "touch") return;
      logPointerEvent("pointerup", e);
      if (e.button !== 0) return;
      const moved = penMovedRef.current;
      penDownRef.current = null;
      if (moved) return;

      // Software double-tap fallback: two rapid pen taps without a stroke.
      // This toggles pen ↔ eraser only — it does NOT open any palette.
      // This is NOT the Apple Pencil Pro hardware double-tap gesture.
      const now = performance.now();
      if (now - lastPenTapRef.current < 400) {
        setAnnotationTool((prev) =>
          prev === "eraser"
            ? "pen"
            : prev === "pen" || prev === "highlighter" || prev === "circle"
            ? "eraser"
            : prev,
        );
        lastPenTapRef.current = 0;
      } else {
        lastPenTapRef.current = now;
      }
    };

    const onCancel = (e: PointerEvent) => {
      if (e.pointerType !== "pen" && e.pointerType !== "touch") return;
      penDownRef.current = null;
    };

    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointermove", onMove, { capture: true, passive: true });
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onCancel, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onCancel, true);
    };
  }, []);

  const annotationsByFrameId = useMemo(() => {
    const map = new Map<string, ReaderAnnotation[]>();
    for (const ann of annotations) {
      if (!ann.frameId) continue;
      if (!map.has(ann.frameId)) map.set(ann.frameId, []);
      map.get(ann.frameId)!.push(ann);
    }
    return map;
  }, [annotations]);

  const allSectionIds = useMemo(
    () => notes.flatMap((n) => n.sections.map((s) => s.id)),
    [notes],
  );

  const { progress } = useReadingProgress(scrollRef, allSectionIds, {
    onThresholdCrossed: markRead,
    threshold: 80,
  });

  const activeId = useScrollSpy(scrollRef, allSectionIds);

  const scrollToSection = useCallback((id: string) => {
    scrollRef.current?.querySelector<HTMLElement>(`#${CSS.escape(id)}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const microNav = useMemo<MicroNavContext>(
    () => ({
      mode: "note",
      items: notes.flatMap((n) =>
        n.sections.map((s) => ({ id: s.id, label: s.title || "Section" })),
      ),
      activeItemId: activeId,
      onItemClick: scrollToSection,
    }),
    [notes, activeId, scrollToSection],
  );

  const handleComment = useCallback(
    (selection: ReaderSelectionPayload, commentText: string) => {
      addAnnotation({ selection, type: "comment", comment: commentText });
      panels.open("annotations");
    },
    [addAnnotation, panels],
  );

  const currentIdx = activeId ? allSectionIds.indexOf(activeId) + 1 : 0;
  const progressLabel = `${currentIdx}/${allSectionIds.length}`;

  return (
    <LibraryShell
      ref={shellRef}
      isFocusMode={isFocusMode}
      measureMax={
        readerSettings.maxWidth >= 1800
          ? "100%"
          : `min(${readerSettings.maxWidth}px, 100%)`
      }
    >
      <LibrarySpine
        tree={navigation}
        microNav={microNav}
        isOpen={panels.spine}
        onClose={() => panels.close("spine")}
        tocContent={
          <>
            <div className="px-4 pb-2 pt-4">
              <div className="text-[13px] font-bold text-lib-text">On This Page</div>
            </div>
            <nav className="px-2 pb-3 pt-1">
              {allSectionIds.map((id) => {
                const section = notes.flatMap((n) => n.sections).find((s) => s.id === id);
                if (!section) return null;
                const isActive = activeId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => scrollToSection(id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lib-sm px-3 py-2.5 text-left text-[13px] leading-snug",
                      "transition-colors duration-lib-fade",
                      isActive
                        ? "bg-lib-active font-medium text-lib-accent shadow-[inset_3px_0_0_var(--lib-accent)]"
                        : "text-lib-text-secondary hover:bg-lib-hover hover:text-lib-text",
                    )}
                  >
                    <span className="min-w-0 flex-1">{section.title}</span>
                  </button>
                );
              })}
            </nav>
          </>
        }
      />

      {/* ══ Floating top bar — collapsible + scroll-aware auto-hide ══
          Two layers of hide:
            • Pinned collapse (manual button → persists in localStorage)
            • Scroll auto-hide (down → fade out, up → fade back in)
          The collapsed state is a tiny floating dot; clicking re-expands.
          When pen mode is active a drawing palette pill appears below. */}
      <div
        ref={toolbarRef}
        className={cn(
          "pointer-events-none fixed inset-x-0 z-40 flex flex-col items-center gap-1.5 px-3",
          "transition-[top,opacity,transform] duration-300 ease-out",
          toolbarCollapsed
            ? toolbarPinnedCollapsed
              ? "top-3 opacity-100 translate-y-0"
              : "top-1 -translate-y-2 opacity-0"
            : "top-3 translate-y-0 opacity-100",
        )}
      >
        {toolbarPinnedCollapsed ? (
          <button
            type="button"
            onClick={() => setToolbarPinnedCollapsed(false)}
            title="Show toolbar"
            aria-label="Show toolbar"
            className={cn(
              "pointer-events-auto inline-flex h-7 w-14 items-center justify-center rounded-full",
              "border border-lib-border/45 bg-lib-glass/80 text-lib-text-muted",
              "shadow-md backdrop-blur-xl transition-all duration-lib-fade",
              "hover:h-8 hover:w-16 hover:bg-lib-glass hover:text-lib-text",
            )}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        ) : (
          <>
            {/* ── Main toolbar pill ── */}
            <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-lib-border/55 bg-lib-glass px-1.5 py-1 shadow-[0_4px_24px_-8px_color-mix(in_oklab,hsl(var(--foreground))_18%,transparent)] backdrop-blur-xl">
              <Link
                href="/library"
                title="Back to library"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-lib-text-secondary transition-colors hover:bg-lib-hover hover:text-lib-text"
              >
                <ArrowRight className="h-4 w-4" />
              </Link>

              <button
                type="button"
                onClick={() => panels.toggle("spine")}
                title="Outline"
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                  panels.spine
                    ? "bg-lib-accent-soft text-lib-accent"
                    : "text-lib-text-secondary hover:bg-lib-hover",
                )}
              >
                <PanelLeft className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => panels.toggle("annotations")}
                title="Annotations"
                className={cn(
                  "relative inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                  panels.annotations
                    ? "bg-lib-accent-soft text-lib-accent"
                    : "text-lib-text-secondary hover:bg-lib-hover",
                )}
              >
                <StickyNote className="h-4 w-4" />
                {annotations.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-lib-accent px-1 text-[9px] font-bold tabular-nums text-lib-accent-fg">
                    {annotations.length}
                  </span>
                )}
              </button>

              {/* User study notes */}
              <button
                type="button"
                onClick={toggleUserNotes}
                title="یادداشت‌های من"
                aria-label={userNotesOpen ? "بستن یادداشت‌ها" : "باز کردن یادداشت‌ها"}
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                  userNotesOpen
                    ? "bg-lib-accent-soft text-lib-accent"
                    : "text-lib-text-secondary hover:bg-lib-hover",
                )}
              >
                <NotebookPen className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setHighlightsVisible((v) => !v)}
                title={highlightsVisible ? "Hide highlights" : "Show highlights"}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-lib-text-secondary transition-colors hover:bg-lib-hover"
              >
                {highlightsVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>

              <div className="mx-1 h-5 w-px bg-lib-border/55" />

              <button
                type="button"
                onClick={toggleFocus}
                title={isFocusMode ? "Exit focus" : "Focus"}
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                  isFocusMode
                    ? "bg-lib-text text-lib-bg"
                    : "text-lib-text-secondary hover:bg-lib-hover",
                )}
              >
                {isFocusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>

              <div className="mx-1 h-5 w-px bg-lib-border/55" />

              {/* Pen mode toggle */}
              <button
                type="button"
                onClick={togglePenMode}
                title={penMode ? "Exit pen mode" : "Draw on page"}
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                  penMode
                    ? "bg-lib-accent text-lib-accent-fg"
                    : "text-lib-text-secondary hover:bg-lib-hover",
                )}
              >
                <Pen className="h-4 w-4" />
              </button>

              {/* AA — text size control */}
              <button
                type="button"
                onClick={() => setFontSizeOpen((v) => !v)}
                title="Text size"
                aria-label="Text size"
                aria-pressed={fontSizeOpen}
                className={cn(
                  "inline-flex h-9 items-center justify-center rounded-full px-2.5 transition-colors",
                  fontSizeOpen
                    ? "bg-lib-accent-soft text-lib-accent"
                    : "text-lib-text-secondary hover:bg-lib-hover",
                )}
              >
                <span className="select-none text-[11px] font-bold leading-none tracking-tight">AA</span>
              </button>

              <div className="mx-1 h-5 w-px bg-lib-border/55" />

              <button
                type="button"
                onClick={() => setToolbarPinnedCollapsed(true)}
                title="Collapse toolbar"
                aria-label="Collapse toolbar"
                className="inline-flex h-9 w-7 items-center justify-center rounded-full text-lib-text-muted/70 transition-colors hover:bg-lib-hover hover:text-lib-text"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* ── Reader display settings panel — visible when AA button is active ── */}
            {fontSizeOpen && (
              <ReaderDisplaySettings
                settings={readerSettings}
                onUpdate={updateReaderSettings}
                className="pointer-events-auto"
              />
            )}

            {/* ── Drawing/color palette pill — visible when a draw tool is active ── */}
            {penMode && (
              <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-lib-border/55 bg-lib-glass px-2 py-1.5 shadow-[0_4px_24px_-8px_color-mix(in_oklab,hsl(var(--foreground))_18%,transparent)] backdrop-blur-xl">
                {/* Color swatches */}
                {DRAW_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setPenColor(c.value)}
                    title={c.label}
                    className={cn(
                      "h-5 w-5 rounded-full ring-offset-1 transition-all duration-150",
                      penColor === c.value
                        ? "scale-110 ring-2 ring-lib-text/70"
                        : "scale-90 ring-0 hover:scale-100",
                    )}
                    style={{ backgroundColor: c.value }}
                  />
                ))}

                <div className="mx-1.5 h-4 w-px bg-lib-border/55" />

                {/* Line widths — hidden for highlighter (fixed width) */}
                {annotationTool !== "highlighter" && annotationTool !== "eraser" && DRAW_WIDTHS.map((w) => (
                  <button
                    key={w.value}
                    type="button"
                    onClick={() => setToolWidths(prev => ({ ...prev, pen: w.value }))}
                    title={w.label}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                      getToolWidth("pen") === w.value
                        ? "bg-lib-accent-soft text-lib-accent"
                        : "text-lib-text-secondary hover:bg-lib-hover",
                    )}
                  >
                    <div className="rounded-full bg-current" style={{ width: w.dot, height: w.dot }} />
                  </button>
                ))}

                <div className="mx-1.5 h-4 w-px bg-lib-border/55" />

                {/* Undo */}
                <button
                  type="button"
                  onClick={undoStroke}
                  title="Undo last stroke"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-lib-text-secondary transition-colors hover:bg-lib-hover"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </button>

                {/* Clear all */}
                <button
                  type="button"
                  onClick={clearDrawing}
                  title="Clear all drawings"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-lib-text-secondary transition-colors hover:bg-lib-hover hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ══ GoodNotes-style side tool rail ══
          Visible when toolbarStyle is "rail" or "both".
          Fixed vertical pill on the left side, vertically centered.
          Tap a tool to activate; tap again to return to cursor.
          Color sub-picker slides in when a draw tool is active. */}
      {(readerSettings.toolbarStyle === "rail" || readerSettings.toolbarStyle === "both") && (
        <div
          className={cn(
            "pointer-events-none fixed left-3 top-1/2 z-40 -translate-y-1/2",
            "transition-[opacity,transform] duration-300 ease-out",
            toolbarCollapsed ? "opacity-0 -translate-x-4 pointer-events-none" : "opacity-100",
          )}
        >
          <div className="pointer-events-auto flex flex-col items-center gap-0.5 rounded-2xl border border-lib-border/60 bg-lib-glass/90 p-1.5 shadow-[0_8px_32px_-8px_color-mix(in_oklab,hsl(var(--foreground))_24%,transparent)] backdrop-blur-xl">
            {/* Active color dot indicator */}
            {(annotationTool === "pen" || annotationTool === "highlighter" || annotationTool === "circle") && (
              <div
                className="mb-1 h-3 w-3 rounded-full ring-1 ring-lib-border/60 shadow-sm"
                style={{ backgroundColor: penColor }}
              />
            )}

            {/* ── Text tools ── */}
            {[
              { tool: "cursor" as AnnotationTool, Icon: MousePointer2, label: "انتخاب متن" },
              { tool: "highlight" as AnnotationTool, Icon: Highlighter, label: "هایلایت" },
              { tool: "underline" as AnnotationTool, Icon: Underline, label: "زیرخط" },
              { tool: "circle" as AnnotationTool, Icon: Circle, label: "دایره / اُوال" },
            ].map(({ tool, Icon, label }) => (
              <button
                key={tool}
                type="button"
                title={label}
                onClick={() => selectAnnotationTool(tool)}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150",
                  annotationTool === tool
                    ? "bg-lib-accent text-lib-accent-fg shadow-sm scale-105"
                    : "text-lib-text-secondary hover:bg-lib-hover hover:text-lib-text",
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}

            {/* ── Per-tool stroke width stepper ── */}
            {(annotationTool === "highlight" || annotationTool === "underline" || annotationTool === "circle" || annotationTool === "pen" || annotationTool === "highlighter") && (() => {
              const t = annotationTool as ToolWithWidth;
              const cfg = TOOL_WIDTH_CFG[t];
              const val = getToolWidth(t);
              const display = Number.isInteger(val / cfg.step) && cfg.step >= 1 ? String(Math.round(val)) : val.toFixed(1);
              return (
                <>
                  <div className="my-0.5 h-px w-6 bg-lib-border/60" />
                  <button
                    type="button"
                    title="افزایش ضخامت"
                    onClick={() => adjustToolWidth(t, cfg.step)}
                    className="flex h-7 w-8 items-center justify-center rounded-lg text-lib-text-secondary hover:bg-lib-hover hover:text-lib-text transition-colors"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                  </button>
                  <span className="select-none text-center font-mono text-[11px] tabular-nums text-lib-text">
                    {display}
                  </span>
                  <button
                    type="button"
                    title="کاهش ضخامت"
                    onClick={() => adjustToolWidth(t, -cfg.step)}
                    className="flex h-7 w-8 items-center justify-center rounded-lg text-lib-text-secondary hover:bg-lib-hover hover:text-lib-text transition-colors"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 5h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                  </button>
                </>
              );
            })()}

            <div className="my-0.5 h-px w-6 bg-lib-border/60" />

            {/* ── Drawing tools ── */}
            {[
              { tool: "pen" as AnnotationTool, Icon: Pen, label: "قلم" },
              { tool: "highlighter" as AnnotationTool, Icon: Highlighter, label: "هایلایتر قلمی" },
              { tool: "eraser" as AnnotationTool, Icon: Eraser, label: "پاک‌کن" },
            ].map(({ tool, Icon, label }) => (
              <button
                key={tool}
                type="button"
                title={label}
                onClick={() => selectAnnotationTool(tool)}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150",
                  annotationTool === tool
                    ? "bg-lib-accent text-lib-accent-fg shadow-sm scale-105"
                    : "text-lib-text-secondary hover:bg-lib-hover hover:text-lib-text",
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}

            {/* Color strip — visible for drawing tools */}
            {(annotationTool === "pen" || annotationTool === "highlighter" || annotationTool === "circle") && (
              <>
                <div className="my-0.5 h-px w-6 bg-lib-border/60" />
                {DRAW_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => setPenColor(c.value)}
                    className={cn(
                      "h-6 w-6 rounded-full ring-offset-[2px] transition-all duration-150",
                      penColor === c.value
                        ? "scale-110 ring-2 ring-lib-text/70"
                        : "scale-90 hover:scale-100",
                    )}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
                <div className="my-0.5 h-px w-6 bg-lib-border/60" />
                <button
                  type="button"
                  title="Undo"
                  onClick={undoStroke}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-lib-text-secondary transition-colors hover:bg-lib-hover"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Clear all"
                  onClick={clearDrawing}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-lib-text-secondary transition-colors hover:bg-lib-hover hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ Apple Pencil Pro squeeze palette ══
          Rendered ONLY when the "starship:pencil-squeeze" CustomEvent bridge fires.
          No PointerEvent, toolbar button, long-press, touch-hold, or double-tap opens this. */}
      {squeezePos && (
        <PencilSqueezePalette
          tipX={squeezePos.x}
          tipY={squeezePos.y}
          activeTool={annotationTool}
          activeColor={penColor}
          onSelectTool={(t) => { selectAnnotationTool(t); setSqueezePos(null); }}
          onSelectColor={(c) => { setPenColor(c); }}
          onUndo={() => { undoStroke(); setSqueezePos(null); }}
          onClose={() => setSqueezePos(null)}
        />
      )}

      {userNotesOpen && (
        <ReaderUserNotesPanel
          docId={`ch-${chapter.chapterNo}`}
          segmentId=""
          chapterNo={chapter.chapterNo}
          onClose={() => setUserNotesOpen(false)}
        />
      )}

      <ReaderStage ref={scrollRef} bgTheme={readerSettings.bgTheme} spineOpen={panels.spine}>
        <MeasureColumn>

          {/* ══ Hero chapter header — premium reading entry ══
              Massive title, gradient backdrop ribbon, stat tiles row.
              Replaces the previous compressed metadata strip. */}
          <header className="relative mb-12 mt-20 ipad-portrait:mb-16 ipad-portrait:mt-24" data-chapter-hero>
            {/* Soft gradient halo behind the title — only visible in light/dark mix */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-x-8 -top-10 -z-10 h-56 opacity-60"
              style={{
                background: [
                  "radial-gradient(ellipse 60% 80% at 25% 30%, color-mix(in oklab, hsl(var(--primary)) 8%, transparent) 0%, transparent 60%)",
                  "radial-gradient(ellipse 50% 70% at 80% 60%, color-mix(in oklab, hsl(var(--primary)) 5%, transparent) 0%, transparent 55%)",
                ].join(","),
              }}
            />

            {/* Eyebrow ribbon — colored chips for vol/part/ch */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center rounded-full bg-lib-accent-soft px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-lib-accent ring-1 ring-inset ring-lib-accent/15">
                Vol&nbsp;{chapter.volumeNo}
              </span>
              <span className="inline-flex items-center rounded-full bg-lib-hover px-2.5 py-0.5 text-[10.5px] font-medium tracking-wide text-lib-text-secondary ring-1 ring-inset ring-lib-border/40">
                {chapter.part}
              </span>
              <span className="inline-flex items-center rounded-full bg-lib-hover px-2.5 py-0.5 text-[10.5px] font-mono tabular-nums font-semibold uppercase tracking-[0.18em] text-lib-text-muted/85 ring-1 ring-inset ring-lib-border/40">
                Ch&nbsp;{String(chapter.chapterNo).padStart(2, "0")}
              </span>
              <StatusBadge status={status} className="ms-auto" />
            </div>

            {/* Massive title — display weight, optical tracking, balanced wrap */}
            <h1
              className="mt-5 text-[36px] font-semibold leading-[1.08] tracking-[-0.018em] text-lib-text text-wrap-balance ipad-portrait:text-[48px] ipad-landscape:text-[44px]"
              style={{ fontFeatureSettings: '"calt" 1, "ss01" 1, "kern" 1' }}
            >
              {chapter.title}
            </h1>

            {/* Stat tiles — page range, question count, flashcard count */}
            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              {chapter.pageRange && (
                <div className="rounded-lib-md border border-lib-border/45 bg-lib-surface/65 px-3.5 py-2.5 backdrop-blur-sm">
                  <div className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-lib-text-muted/70">Pages</div>
                  <div className="mt-1 font-mono text-[15px] tabular-nums font-semibold text-lib-text">
                    {chapter.pageRange}
                  </div>
                </div>
              )}
              {chapter.questionCount > 0 && (
                <Link
                  href={`/qbank?chapter=${chapter.chapterNo}`}
                  className="group rounded-lib-md border border-lib-border/45 bg-lib-surface/65 px-3.5 py-2.5 backdrop-blur-sm transition-all hover:border-lib-success/40 hover:bg-lib-success-soft/40"
                >
                  <div className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-lib-text-muted/70 group-hover:text-lib-success/80">
                    Questions
                  </div>
                  <div className="mt-1 font-mono text-[15px] tabular-nums font-semibold text-lib-success">
                    {chapter.questionCount}
                  </div>
                </Link>
              )}
              {chapter.flashcardCount > 0 && (
                <div className="rounded-lib-md border border-lib-border/45 bg-lib-surface/65 px-3.5 py-2.5 backdrop-blur-sm">
                  <div className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-lib-text-muted/70">Flashcards</div>
                  <div className="mt-1 font-mono text-[15px] tabular-nums font-semibold text-lib-warning">
                    {chapter.flashcardCount}
                  </div>
                </div>
              )}
              {notes.length > 0 && (
                <div className="rounded-lib-md border border-lib-border/45 bg-lib-surface/65 px-3.5 py-2.5 backdrop-blur-sm">
                  <div className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-lib-text-muted/70">Sections</div>
                  <div className="mt-1 font-mono text-[15px] tabular-nums font-semibold text-lib-text">
                    {allSectionIds.length}
                  </div>
                </div>
              )}
            </div>
          </header>

          {/* ══ Content ══ */}
          {notes.length === 0 ? (
            <div className="rounded-lib-lg border border-dashed border-lib-border px-6 py-14 text-center">
              <p className="text-sm font-semibold text-lib-text-secondary">No content imported yet</p>
              <p className="mt-2 text-sm text-lib-text-muted">
                Import content for this chapter to begin reading.
              </p>
            </div>
          ) : (
            <article
              data-reader-content="true"
              dir="rtl"
              lang="fa"
              className="reader-content space-y-8"
              style={{
                "--reader-font-size": `${readerSettings.fontSize}px`,
                "--reader-font-scale": String(readerSettings.fontSize / 17),
                "--reader-line-height": String(readerSettings.lineHeight),
                /* Inner prose width follows the user's chosen column max.
                   Sentinel: maxWidth ≥ 1800 → "Full". Cascade 100% so
                   FrameBody paragraphs (max-w-[var(--reader-prose-w,70ch)])
                   stretch to the full reading column instead of being
                   centered inside it — which in RTL otherwise reads as
                   "stuck to the right" with dead space on the left. */
                "--reader-prose-w":
                  readerSettings.maxWidth >= 1800
                    ? "100%"
                    : `${readerSettings.maxWidth}px`,
                fontFamily: READER_FONT_STACKS[readerSettings.fontFamily],
              } as React.CSSProperties}
            >
              <MediaRefProvider chapterNo={chapter.chapterNo}>
                {notes.map((note) => (
                  <SegmentRenderer
                    key={note.meta.logicalChunkId}
                    sections={note.sections}
                    annotationsByFrameId={annotationsByFrameId}
                    annotationCountByFrameId={annotationCountByFrameId}
                    highlightsVisible={highlightsVisible}
                    noteContext={{
                      docId: `ch-${chapter.chapterNo}`,
                      chapterNo: chapter.chapterNo,
                    }}
                    chapterNo={chapter.chapterNo}
                    segmentId={note.meta.logicalChunkId}
                  />
                ))}
              </MediaRefProvider>
            </article>
          )}

          {/* ══ Chapter nav ══ */}
          <div className="mt-12 flex items-center justify-between border-t border-lib-border pt-5">
            {chapter.previousChapterNo ? (
              <Link
                href={`/library/campbell/chapter/${chapter.previousChapterNo}`}
                className="inline-flex min-h-[var(--lib-touch-min)] items-center gap-2 rounded-lib-sm border border-lib-border bg-lib-surface px-4 py-2 text-sm text-lib-text-secondary transition-colors hover:bg-lib-hover"
              >
                <ArrowRight className="h-4 w-4" />
                Ch. {chapter.previousChapterNo}
              </Link>
            ) : <span />}
            {chapter.nextChapterNo ? (
              <Link
                href={`/library/campbell/chapter/${chapter.nextChapterNo}`}
                className="inline-flex min-h-[var(--lib-touch-min)] items-center gap-2 rounded-lib-sm border border-lib-border bg-lib-surface px-4 py-2 text-sm text-lib-text-secondary transition-colors hover:bg-lib-hover"
              >
                Ch. {chapter.nextChapterNo}
                <ArrowLeft className="h-4 w-4" />
              </Link>
            ) : <span />}
          </div>

          <div className="h-24" />
        </MeasureColumn>
      </ReaderStage>

      {/* ══ Thin reading-progress bar at the very top of the viewport (AMBOSS/Readwise style) ══ */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px] bg-lib-border/30"
      >
        <div
          className="h-full bg-lib-accent/80 transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* ══ Progress pill — bottom-right, compact ══ */}
      <div className="pointer-events-none fixed bottom-5 right-4 z-30">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-lib-border/50 bg-lib-glass/80 px-2.5 py-1 text-[10px] text-lib-text-muted shadow-md backdrop-blur-xl">
          <span className="tabular-nums font-semibold">{progressLabel}</span>
          <span className="text-lib-text-muted/50">·</span>
          <span className="tabular-nums">{progress}%</span>
        </div>
      </div>

      {/* ══ Selection popup ══ */}
      <SelectionPopup
        allowCardCreation={false}
        annotations={annotations}
        onCreateCard={() => {}}
        onCreateCloze={() => {}}
        onHighlight={(sel, color) => addAnnotation({ selection: sel, type: "highlight", color })}
        onRemoveHighlight={(ids) => ids.forEach(removeAnnotation)}
        onUnderline={(sel) => {
          addAnnotation({ selection: sel, type: "underline" });
        }}
        onComment={handleComment}
        autoHighlight={autoHighlight}
        onToggleAutoHighlight={toggleAutoHighlight}
      />

      {/* ══ Annotations rail ══ */}
      <ReaderAnnotationsPanel
        annotations={annotations}
        isOpen={panels.annotations}
        onClose={() => panels.close("annotations")}
        onJumpToFrame={(id) => {
          if (id) document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }}
        onDelete={removeAnnotation}
      />

      {/* ══ Drawing canvas overlay ══
          Transparent fixed canvas — pointer-events only active when penMode is on.
          Strokes are persisted per-chapter in localStorage. */}
      <DrawingLayer
        ref={drawingLayerRef}
        isActive={penMode}
        color={penColor}
        lineWidth={penWidth}
        tool={penTool}
        storageKey={`ch-${chapter.chapterNo}`}
        scrollRef={scrollRef}
        contentSelector={READER_CONTENT_SELECTOR}
        annotationStrokeWidth={getToolWidth("circle")}
        highlighterWidth={getToolWidth("highlighter")}
      />

      <PencilGpuInkLayer
        isActive={!penMode}
        scrollRef={scrollRef}
        contentSelector={READER_CONTENT_SELECTOR}
        color={penColor}
        options={{ lineWidth: penWidth }}
      />

      <PencilDebugOverlay mode={penMode ? "draw" : "select"} />

      {/* On-text highlight + underline rendering via CSS Custom Highlight,
          with overlay fallback. Reads stored offsets, falls back to
          quote-search for legacy rows. */}
      <ReaderHighlightLayer
        annotations={annotations}
        contentSelector={READER_CONTENT_SELECTOR}
        scrollRef={scrollRef}
        visible={highlightsVisible}
        underlineThickness={getToolWidth("underline")}
        highlightThickness={getToolWidth("highlight")}
      />
      <NoteMarkerLayer
        annotations={annotations}
        contentSelector={READER_CONTENT_SELECTOR}
        scrollRef={scrollRef}
        visible={highlightsVisible}
      />

      {/* Reference navigation rail - slim right-gutter minimap */}
      <ReaderReferenceRail
        notes={notes}
        scrollRef={scrollRef}
        annotationsPanelOpen={panels.annotations}
        spineOpen={panels.spine}
      />
    </LibraryShell>
  );
}

