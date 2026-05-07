"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ChevronUp,
  Eraser,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Minus,
  MoreHorizontal,
  NotebookPen,
  PanelLeft,
  Pen,
  Plus,
  StickyNote,
  Trash2,
  Undo2,
} from "lucide-react";
import type { NoteViewerModel } from "@/lib/contract/note-viewer.types";
import type { CampbellChapterDetail, CampbellVolumeGroup } from "@/lib/library/queries";
import type { ChapterStatus } from "@/lib/library/progress";
import type { ReaderAnnotation, ReaderSelectionPayload } from "@/hooks/useReaderAnnotations";
import { useReaderAnnotations } from "@/hooks/useReaderAnnotations";
import { useAutoHighlight } from "@/hooks/useAutoHighlight";
import { useReaderSettings } from "@/hooks/useReaderSettings";
import { useReaderPenSelection } from "@/hooks/useReaderPenSelection";
import { usePalmBeforePenGuard } from "@/hooks/usePalmBeforePenGuard";
import { useReaderSelectionWatcher } from "@/hooks/useReaderSelectionWatcher";
import { useStatusMachine } from "@/hooks/useStatusMachine";
import { useFocusMode } from "@/hooks/useFocusMode";
import { usePanelState } from "@/hooks/usePanelState";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import { useScrollSpy } from "@/hooks/useScrollSpy";
import { cn } from "@/lib/utils";

import { DrawingLayer, type DrawingLayerHandle, type DrawTool } from "./DrawingLayer";
import { LibraryShell } from "./LibraryShell";
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

/* ── Drawing palette constants ── */
const DRAW_COLORS = [
  { value: "#6366f1", label: "Indigo" },
  { value: "#ef4444", label: "Red" },
  { value: "#22c55e", label: "Green" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ec4899", label: "Pink" },
  { value: "#f1f5f9", label: "White" },
] as const;

const DRAW_WIDTHS = [
  { value: 2, dot: 5, label: "Fine" },
  { value: 4, dot: 9, label: "Medium" },
  { value: 9, dot: 15, label: "Thick" },
] as const;

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

  // ── Pen / drawing mode ──
  const [penMode, setPenMode] = useState(false);

  // ── User notes panel (study notes, local-first) ──
  const [userNotesOpen, setUserNotesOpen] = useState(false);

  // Pencil drag-selects text in Select mode (penMode=false).
  // iPadOS Safari otherwise treats Pencil drag as a scroll gesture.
  useReaderPenSelection({
    scrollRef,
    contentSelector: "[data-reader-content]",
    active: !penMode,
  });

  // Undo any accidental scroll from a palm that landed just before the pen.
  usePalmBeforePenGuard(scrollRef);

  // Input-agnostic SelectionPopup trigger: replaces the popup's internal
  // mouseup/touchend listeners. Fires on any selectionchange (mouse, pen,
  // finger, keyboard, double/triple-click, programmatic) once settled.
  useReaderSelectionWatcher({
    contentSelector: "[data-reader-content]",
    scrollRef,
  });

  const [penColor, setPenColor] = useState<string>(DRAW_COLORS[0].value);
  const [penWidth, setPenWidth] = useState<number>(DRAW_WIDTHS[1].value);
  const [penTool, setPenTool] = useState<DrawTool>("pen");
  const drawingLayerRef = useRef<DrawingLayerHandle>(null);


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

  const { autoHighlight, toggleAutoHighlight } = useAutoHighlight({
    annotations,
    onHighlight: (sel, color) => addAnnotation({ selection: sel, type: "highlight", color }),
  });

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
    <LibraryShell ref={shellRef} isFocusMode={isFocusMode}>
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
                <ArrowLeft className="h-4 w-4" />
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
                onClick={() => setUserNotesOpen((v) => !v)}
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
                onClick={() => setPenMode((v) => !v)}
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

            {/* ── Font-size popover pill — visible when AA button is active ── */}
            {fontSizeOpen && (
              <div className="pointer-events-auto flex items-center rounded-full border border-lib-border/55 bg-lib-glass px-0.5 py-1 shadow-[0_4px_24px_-8px_color-mix(in_oklab,hsl(var(--foreground))_18%,transparent)] backdrop-blur-xl">
                {/* Decrease */}
                <button
                  type="button"
                  onClick={() => updateReaderSettings({ fontSize: Math.max(13, readerSettings.fontSize - 1) })}
                  disabled={readerSettings.fontSize <= 13}
                  aria-label="Smaller text"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-lib-text-secondary transition-colors hover:bg-lib-hover disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>

                {/* AA label */}
                <div className="flex min-w-[56px] select-none flex-col items-center gap-[3px] px-1.5">
                  <div className="flex items-end gap-0.5 leading-none">
                    <span className="text-[9px] font-bold text-lib-text-secondary">A</span>
                    <span className="text-[13px] font-bold text-lib-text">A</span>
                  </div>
                  <div className="font-mono text-[10px] tabular-nums text-lib-text-muted">
                    {readerSettings.fontSize}px
                  </div>
                </div>

                {/* Increase */}
                <button
                  type="button"
                  onClick={() => updateReaderSettings({ fontSize: Math.min(24, readerSettings.fontSize + 1) })}
                  disabled={readerSettings.fontSize >= 24}
                  aria-label="Larger text"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-lib-text-secondary transition-colors hover:bg-lib-hover disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>

                <div className="mx-1 h-4 w-px bg-lib-border/55" />

                <button
                  type="button"
                  onClick={() => updateReaderSettings({ lineHeight: Math.max(1.4, Number((readerSettings.lineHeight - 0.1).toFixed(1))) })}
                  aria-label="Tighter line spacing"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-lib-text-secondary transition-colors hover:bg-lib-hover disabled:cursor-not-allowed disabled:opacity-30"
                  disabled={readerSettings.lineHeight <= 1.4}
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-[48px] text-center text-[10px] font-medium text-lib-text-muted">
                  Line {readerSettings.lineHeight.toFixed(1)}
                </span>
                <button
                  type="button"
                  onClick={() => updateReaderSettings({ lineHeight: Math.min(2.2, Number((readerSettings.lineHeight + 0.1).toFixed(1))) })}
                  aria-label="Looser line spacing"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-lib-text-secondary transition-colors hover:bg-lib-hover disabled:cursor-not-allowed disabled:opacity-30"
                  disabled={readerSettings.lineHeight >= 2.2}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>

                <div className="mx-1 h-4 w-px bg-lib-border/55" />

                <button
                  type="button"
                  onClick={() => updateReaderSettings({ maxWidth: Math.max(540, readerSettings.maxWidth - 60) })}
                  aria-label="Narrower line width"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-lib-text-secondary transition-colors hover:bg-lib-hover disabled:cursor-not-allowed disabled:opacity-30"
                  disabled={readerSettings.maxWidth <= 540}
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-[52px] text-center text-[10px] font-medium text-lib-text-muted">
                  Width {readerSettings.maxWidth}
                </span>
                <button
                  type="button"
                  onClick={() => updateReaderSettings({ maxWidth: Math.min(900, readerSettings.maxWidth + 60) })}
                  aria-label="Wider line width"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-lib-text-secondary transition-colors hover:bg-lib-hover disabled:cursor-not-allowed disabled:opacity-30"
                  disabled={readerSettings.maxWidth >= 900}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* ── Drawing palette pill — visible only when pen mode is active ── */}
            {penMode && (
              <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-lib-border/55 bg-lib-glass px-2 py-1.5 shadow-[0_4px_24px_-8px_color-mix(in_oklab,hsl(var(--foreground))_18%,transparent)] backdrop-blur-xl">
                {/* Color swatches */}
                {DRAW_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => { setPenColor(c.value); setPenTool("pen"); }}
                    title={c.label}
                    className={cn(
                      "h-5 w-5 rounded-full ring-offset-1 transition-all duration-150",
                      penColor === c.value && penTool === "pen"
                        ? "scale-110 ring-2 ring-lib-text/70"
                        : "scale-90 ring-0 hover:scale-100",
                    )}
                    style={{ backgroundColor: c.value }}
                  />
                ))}

                <div className="mx-1.5 h-4 w-px bg-lib-border/55" />

                {/* Line widths */}
                {DRAW_WIDTHS.map((w) => (
                  <button
                    key={w.value}
                    type="button"
                    onClick={() => setPenWidth(w.value)}
                    title={w.label}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                      penWidth === w.value
                        ? "bg-lib-accent-soft text-lib-accent"
                        : "text-lib-text-secondary hover:bg-lib-hover",
                    )}
                  >
                    <div
                      className="rounded-full bg-current"
                      style={{ width: w.dot, height: w.dot }}
                    />
                  </button>
                ))}

                <div className="mx-1.5 h-4 w-px bg-lib-border/55" />

                {/* Eraser */}
                <button
                  type="button"
                  onClick={() => setPenTool((t) => (t === "eraser" ? "pen" : "eraser"))}
                  title={penTool === "eraser" ? "Switch to pen" : "Eraser"}
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                    penTool === "eraser"
                      ? "bg-lib-accent-soft text-lib-accent"
                      : "text-lib-text-secondary hover:bg-lib-hover",
                  )}
                >
                  <Eraser className="h-3.5 w-3.5" />
                </button>

                {/* Undo */}
                <button
                  type="button"
                  onClick={() => drawingLayerRef.current?.undo()}
                  title="Undo last stroke"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-lib-text-secondary transition-colors hover:bg-lib-hover"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </button>

                {/* Clear all */}
                <button
                  type="button"
                  onClick={() => drawingLayerRef.current?.clear()}
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

      {userNotesOpen && (
        <ReaderUserNotesPanel
          docId={`ch-${chapter.chapterNo}`}
          segmentId=""
          chapterNo={chapter.chapterNo}
          onClose={() => setUserNotesOpen(false)}
        />
      )}

      <ReaderStage ref={scrollRef}>
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
              className="reader-content space-y-8"
              style={{
                "--reader-font-size": `${readerSettings.fontSize}px`,
                "--reader-font-scale": String(readerSettings.fontSize / 17),
                "--reader-line-height": String(readerSettings.lineHeight),
                "--reader-prose-w": `${readerSettings.maxWidth}px`,
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
                <ArrowLeft className="h-4 w-4" />
                Ch. {chapter.previousChapterNo}
              </Link>
            ) : <span />}
            {chapter.nextChapterNo ? (
              <Link
                href={`/library/campbell/chapter/${chapter.nextChapterNo}`}
                className="inline-flex min-h-[var(--lib-touch-min)] items-center gap-2 rounded-lib-sm border border-lib-border bg-lib-surface px-4 py-2 text-sm text-lib-text-secondary transition-colors hover:bg-lib-hover"
              >
                Ch. {chapter.nextChapterNo}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : <span />}
          </div>

          <div className="h-24" />
        </MeasureColumn>
      </ReaderStage>

      {/* ══ Floating progress pill (bottom-right, non-intrusive) ══ */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-30">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-lib-border/60 bg-lib-glass px-3 py-1.5 text-[11px] text-lib-text-muted shadow-md backdrop-blur-xl">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-lib-border/60">
            <div
              className="h-full bg-lib-accent transition-[width] duration-lib-spring ease-lib-spring"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="tabular-nums font-medium">{progressLabel}</span>
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
          panels.open("annotations");
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
      />

      <PencilDebugOverlay mode={penMode ? "draw" : "select"} />

      {/* On-text highlight + underline rendering via CSS Custom Highlight,
          with overlay fallback. Reads stored offsets, falls back to
          quote-search for legacy rows. */}
      <ReaderHighlightLayer
        annotations={annotations}
        contentSelector="[data-reader-content]"
        scrollRef={scrollRef}
        visible={highlightsVisible}
      />
      <NoteMarkerLayer
        annotations={annotations}
        contentSelector="[data-reader-content]"
        scrollRef={scrollRef}
        visible={highlightsVisible}
      />
        {/* Reference navigation rail - slim right-gutter minimap */}
        <ReaderReferenceRail
          notes={notes}
          scrollRef={scrollRef}
          annotationsPanelOpen={panels.annotations}
        />

    </LibraryShell>
  );
}
