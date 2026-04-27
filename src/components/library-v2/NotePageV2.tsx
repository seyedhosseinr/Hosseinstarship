"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Eye,
  EyeOff,
  GraduationCap,
  ChevronUp,
  Layers,
  Maximize2,
  Minimize2,
  Minus,
  MoreHorizontal,
  PanelLeft,
  Plus,
  StickyNote,
  Target,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sectionSlug } from "@/lib/utils/section-slug";
import type { NoteViewerModel } from "@/lib/contract/note-viewer.types";
import type { CampbellVolumeGroup, ChapterReaderContext } from "@/lib/library/queries";
import type { ChapterStatus } from "@/lib/library/progress";
import type { YieldViewModel } from "@/lib/yield/types";
import type { ReaderAnnotation, ReaderSelectionPayload } from "@/hooks/useReaderAnnotations";
import { useReaderAnnotations } from "@/hooks/useReaderAnnotations";
import { useReaderPenSelection } from "@/hooks/useReaderPenSelection";
import { usePalmBeforePenGuard } from "@/hooks/usePalmBeforePenGuard";
import { useReaderSelectionWatcher } from "@/hooks/useReaderSelectionWatcher";
import { useReaderSettings } from "@/hooks/useReaderSettings";
import { useMissedQuestionIds } from "@/hooks/useMissedQuestionIds";
import { useStatusMachine } from "@/hooks/useStatusMachine";
import { useFocusMode } from "@/hooks/useFocusMode";
import { usePanelState } from "@/hooks/usePanelState";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import { useScrollSpy } from "@/hooks/useScrollSpy";
import { useCardCreationShortcuts } from "@/components/flashcard/CardCreationShortcuts";
import { FigureViewer, useFigureViewer } from "@/components/ui/FigureViewer";
import { SUPPORTED_RUNTIME_CAPABILITIES } from "@/lib/runtime/capabilities";
import { YieldTab } from "@/components/yield/YieldTab";
import { YieldToc } from "@/components/yield/YieldToc";

import { LibraryShell } from "./LibraryShell";
import { LibrarySpine, type MicroNavContext } from "./LibrarySpine";
import { ReaderStage } from "./ReaderStage";
import { MeasureColumn } from "./MeasureColumn";
import { ReaderHighlightLayer } from "./ReaderHighlightLayer";
import { NoteMarkerLayer } from "./NoteMarkerLayer";
import { SegmentRenderer } from "./SegmentRenderer";
import { StatusBadge } from "./StatusBadge";
import {
  ReaderAnchorProvider,
  useReaderAnchor,
  useReaderDeepLink,
} from "./ReaderAnchorProvider";
import { InlineSourceBubble } from "./InlineSourceBubble";

const QuickCardEditor = dynamic(
  () => import("@/components/flashcard/QuickCardEditor").then((m) => m.QuickCardEditor),
  { ssr: false, loading: () => null },
);
const SelectionPopup = dynamic(
  () => import("@/components/flashcard/SelectionPopup").then((m) => m.SelectionPopup),
  { ssr: false, loading: () => null },
);
const ReaderAnnotationsPanel = dynamic(
  () => import("@/components/note-viewer/ReaderAnnotationsPanel").then((m) => m.ReaderAnnotationsPanel),
  { ssr: false, loading: () => null },
);

/* ── Types ── */

// Only two REAL tabs — both swap inline content.
// MCQ and Flashcard are navigation actions, not tabs.
type StudyTab = "note" | "yield";

const STUDY_TABS: { id: StudyTab; label: string }[] = [
  { id: "note", label: "یادداشت" },
  { id: "yield", label: "Yield" },
];

interface NotePageV2Props {
  note: NoteViewerModel;
  initialFrameId?: string;
  /**
   * Source kind for the initial deep-link, derived from `?ref=`. Defaults
   * to "note-link" when caller is anonymous (raw `#hash` deep link).
   */
  initialFrameRef?: "mcq" | "flashcard" | "yield" | "annotation" | "note-link";
  navigation: CampbellVolumeGroup[];
  initialStatus: ChapterStatus;
  relatedFlashcards: Array<{ id: string; frontHtml: string; dueAt: number | null }>;
  chapterContext: ChapterReaderContext | null;
  yieldData: YieldViewModel | null;
}

/* ════════════════════════════════════════════════════════
   NotePageV2
   Single-segment study page.

   Top bar: [TOC] [Annotations] [Filters▾] — [Focus]
   Filters tray (collapsed by default): HY | Exam | Missed | Eye | Font±
   Tabs: Note | Yield  (MCQ/Flashcard are action links, not tabs)
════════════════════════════════════════════════════════ */

/**
 * Wrapper that mounts the ReaderAnchorProvider so source-link bubbles
 * (MCQ → note, flashcard → note, yield → note, deep-link) coordinate
 * scroll + highlight + bubble inside this Reader surface only.
 */
export function NotePageV2(props: NotePageV2Props) {
  return (
    <ReaderAnchorProvider>
      <NotePageV2Inner {...props} />
    </ReaderAnchorProvider>
  );
}

function NotePageV2Inner({
  note,
  initialFrameId,
  initialFrameRef,
  navigation,
  initialStatus,
  relatedFlashcards,
  chapterContext,
  yieldData,
}: NotePageV2Props) {
  const shellRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { jumpToAnchor } = useReaderAnchor();

  // Hash deep-link consumer. The `?frame=`/`?ref=` query is consumed below
  // via the dedicated effect so we can pass a typed source kind.
  useReaderDeepLink(null);

  // NotePageV2 has no pen/draw mode — always-on pen-selection is safe.
  useReaderPenSelection({
    scrollRef,
    contentSelector: "[data-reader-content]",
    active: true,
  });
  usePalmBeforePenGuard(scrollRef);

  // Input-agnostic SelectionPopup trigger: replaces the popup's internal
  // mouseup/touchend listeners.
  useReaderSelectionWatcher({
    contentSelector: "[data-reader-content]",
    scrollRef,
  });

  const { status, markRead, setManual } = useStatusMachine(note.meta.chapterNo, initialStatus);
  const { isFocusMode, toggle: toggleFocus } = useFocusMode(shellRef, {
    useNativeFullscreen: true,
  });
  const panels = usePanelState(isFocusMode);
  const { settings: readerLayers, update: updateLayer } = useReaderSettings();
  const missedQuestionIds = useMissedQuestionIds(note.meta.chapterNo);

  const [activeTab, setActiveTab] = useState<StudyTab>("note");
  const [highlightsVisible, setHighlightsVisible] = useState(true);
  const [readerFontSize, setReaderFontSize] = useState(17);
  const [filterTrayOpen, setFilterTrayOpen] = useState(false);
  const [topBarCollapsed, setTopBarCollapsed] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorInitial, setEditorInitial] = useState({ front: "", back: "" });
  const [activeYieldSection, setActiveYieldSection] = useState<string | null>(
    yieldData?.sections[0]?.sectionTitle ?? null,
  );

  // Persist top-bar collapse preference across sessions.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("reader:topbar:collapsed");
      if (saved === "1") setTopBarCollapsed(true);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem("reader:topbar:collapsed", topBarCollapsed ? "1" : "0"); }
    catch { /* ignore */ }
  }, [topBarCollapsed]);

  // Scroll-aware auto-hide: when scrolling down past 120px the toolbar
  // fades out; scrolling up reveals it. Combined with the manual
  // collapse toggle for full control.
  const [topBarVisibleByScroll, setTopBarVisibleByScroll] = useState(true);
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
        if (y < 120) setTopBarVisibleByScroll(true);
        else if (dy > 6) setTopBarVisibleByScroll(false);
        else if (dy < -6) setTopBarVisibleByScroll(true);
        lastY = y;
      });
    };
    stage.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      stage.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const { annotations, addAnnotation, removeAnnotation, annotationCountByFrameId } =
    useReaderAnnotations(note.meta.docId, note.meta.chapterNo);

  const annotationsByFrameId = useMemo(() => {
    const map = new Map<string, ReaderAnnotation[]>();
    for (const ann of annotations) {
      if (!ann.frameId) continue;
      if (!map.has(ann.frameId)) map.set(ann.frameId, []);
      map.get(ann.frameId)!.push(ann);
    }
    return map;
  }, [annotations]);

  const keyExamFrameIds = useMemo(() => {
    const ids = new Set<string>();
    if (!yieldData) return ids;
    const keySections = new Set<string>();
    for (const sec of yieldData.sections) {
      for (const card of sec.cards) {
        if (card.isKeyExam && card.anchorHints) {
          card.anchorHints.forEach((h) => keySections.add(h));
        }
      }
    }
    for (const sec of note.sections) {
      if (keySections.has(sec.id)) sec.frames.forEach((f) => ids.add(f.id));
    }
    return ids;
  }, [yieldData, note.sections]);

  const missedFrameIds = useMemo(() => {
    const ids = new Set<string>();
    if (missedQuestionIds.size === 0) return ids;
    for (const sec of note.sections) {
      for (const frame of sec.frames) {
        if (frame.linkedQuestions.some((lq) => missedQuestionIds.has(lq.questionId))) {
          ids.add(frame.id);
        }
      }
    }
    return ids;
  }, [note.sections, missedQuestionIds]);

  const sectionIds = useMemo(() => note.sections.map((s) => s.id), [note.sections]);

  const { progress, resetThreshold } = useReadingProgress(scrollRef, sectionIds, {
    onThresholdCrossed: markRead,
    threshold: 80,
  });

  const activeNoteSection = useScrollSpy(scrollRef, sectionIds);

  const { isOpen: isFigureOpen, openFigure, viewerProps } = useFigureViewer();

  const handleReaderClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "IMG") {
        e.preventDefault();
        const img = target as HTMLImageElement;
        openFigure({ src: img.src, alt: img.alt || undefined, caption: img.title || img.alt || undefined });
      }
    },
    [openFigure],
  );

  // Tab persistence
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`study:tab:ch${note.meta.chapterNo}`);
      if (saved === "note" || saved === "yield") setActiveTab(saved);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchTab = useCallback(
    (tab: StudyTab) => {
      setActiveTab(tab);
      resetThreshold();
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
      try { localStorage.setItem(`study:tab:ch${note.meta.chapterNo}`, tab); } catch { /* ignore */ }
    },
    [note.meta.chapterNo, resetThreshold],
  );

  // Initial source-link jump from `?frame=<id>&ref=<kind>`. The route
  // params are server-resolved and forwarded into the props; we route them
  // through `jumpToAnchor` so the inline bubble fires with the correct
  // source kind (e.g. "flashcard" for the FlashcardReviewScreen "باز کردن
  // منبع" link).
  useEffect(() => {
    if (!initialFrameId) return;
    const handle = requestAnimationFrame(() => {
      void jumpToAnchor(initialFrameId, { kind: initialFrameRef ?? "note-link" });
    });
    return () => cancelAnimationFrame(handle);
  }, [initialFrameId, initialFrameRef, jumpToAnchor]);

  const microNav = useMemo((): MicroNavContext | null => {
    if (activeTab === "note" && note.sections.length > 0) {
      return {
        mode: "note",
        items: note.sections.map((s) => ({ id: s.id, label: s.title })),
        activeItemId: activeNoteSection,
        onItemClick: (id) => {
          scrollRef.current?.querySelector<HTMLElement>(`#${CSS.escape(id)}`)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        },
      };
    }
    if (activeTab === "yield" && yieldData && yieldData.sections.length > 0) {
      return {
        mode: "yield",
        items: yieldData.sections.map((s) => ({
          id: sectionSlug(s.sectionTitle),
          label: s.sectionTitle,
          count: s.cards.length,
        })),
        activeItemId: activeYieldSection ? sectionSlug(activeYieldSection) : null,
        onItemClick: (id) => {
          const el = document.getElementById(id);
          if (el && scrollRef.current) {
            scrollRef.current.scrollTo({ top: el.offsetTop - 80, behavior: "smooth" });
          }
        },
      };
    }
    return null;
  }, [activeTab, note.sections, activeNoteSection, yieldData, activeYieldSection]);

  const flashcardEnabled = SUPPORTED_RUNTIME_CAPABILITIES.flashcards;
  const reviewEnabled = SUPPORTED_RUNTIME_CAPABILITIES.review;

  useCardCreationShortcuts({
    enabled: flashcardEnabled,
    onCreateBasic: () => { setEditorInitial({ front: "", back: "" }); setIsEditorOpen(true); },
    onCreateCloze: () => {
      const sel = window.getSelection()?.toString().trim();
      setEditorInitial({ front: sel ? `{{c1::${sel}}}` : "", back: sel ?? "" });
      setIsEditorOpen(true);
    },
    onCreateFromSelection: (text) => { setEditorInitial({ front: "", back: text }); setIsEditorOpen(true); },
    onQuickConvert: () => {
      const sel = window.getSelection()?.toString().trim();
      if (!sel) return;
      setEditorInitial({ front: sel, back: "" });
      setIsEditorOpen(true);
    },
  });

  const handleComment = useCallback(
    (selection: ReaderSelectionPayload, commentText: string) => {
      addAnnotation({ selection, type: "comment", comment: commentText });
      panels.open("annotations");
    },
    [addAnnotation, panels],
  );

  const currentIdx = activeNoteSection ? sectionIds.indexOf(activeNoteSection) + 1 : 0;
  const progressLabel = `${currentIdx}/${sectionIds.length}`;

  // Active filters count for badge
  const activeFilterCount = [
    readerLayers.showHighYield,
    readerLayers.showKeyExam,
    readerLayers.showMissedQuestions,
    !highlightsVisible,
  ].filter(Boolean).length;

  return (
    <LibraryShell ref={shellRef} isFocusMode={isFocusMode}>
      <LibrarySpine
        tree={navigation}
        microNav={microNav}
        isOpen={panels.spine}
        onClose={() => panels.close("spine")}
        tocContent={
          activeTab === "note" ? (
            <>
              <div className="px-4 pb-2 pt-4">
                <div className="text-[13px] font-bold text-lib-text">On This Page</div>
              </div>
              <nav className="px-2 pb-3 pt-1">
                {note.sections.map((sec) => {
                  const isActive = activeNoteSection === sec.id;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() =>
                        scrollRef.current?.querySelector<HTMLElement>(`#${CSS.escape(sec.id)}`)
                          ?.scrollIntoView({ behavior: "smooth", block: "start" })
                      }
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lib-sm px-3 py-2.5 text-left text-[13px] leading-snug transition-colors duration-lib-fade",
                        isActive
                          ? "bg-lib-active font-medium text-lib-accent shadow-[inset_3px_0_0_var(--lib-accent)]"
                          : "text-lib-text-secondary hover:bg-lib-hover hover:text-lib-text",
                      )}
                    >
                      <span className="min-w-0 flex-1">{sec.title}</span>
                    </button>
                  );
                })}
              </nav>
            </>
          ) : activeTab === "yield" && yieldData ? (
            <YieldToc
              sections={yieldData.sections}
              activeSectionTitle={activeYieldSection}
              onSelectSection={(title) => {
                setActiveYieldSection(title);
                const el = document.getElementById(`yield-section-${title.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "-")}`);
                if (el) scrollRef.current?.scrollTo({ top: el.offsetTop - 80, behavior: "smooth" });
              }}
            />
          ) : undefined
        }
      />

      {/* ══ Floating top bar (fixed, viewport-centered) ══
          Two layers of hide:
            • Manual collapse → small pill, persists in localStorage.
            • Scroll auto-hide → bar fades on scroll-down, returns on scroll-up. */}
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3",
          "transition-[top,opacity,transform] duration-300 ease-out",
          !topBarCollapsed && !topBarVisibleByScroll
            ? "top-1 -translate-y-2 opacity-0"
            : "top-3 translate-y-0 opacity-100",
        )}
      >
        {topBarCollapsed ? (
          <button
            type="button"
            onClick={() => setTopBarCollapsed(false)}
            title="Show toolbar"
            aria-label="Show toolbar"
            className={cn(
              "pointer-events-auto inline-flex h-7 w-12 items-center justify-center rounded-full",
              "border border-lib-border/45 bg-lib-glass/80 text-lib-text-muted",
              "shadow-md backdrop-blur-xl transition-all duration-lib-fade",
              "hover:h-8 hover:w-14 hover:bg-lib-glass hover:text-lib-text",
            )}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        ) : (
          <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-lib-border/55 bg-lib-glass px-1.5 py-1 shadow-[0_4px_24px_-8px_color-mix(in_oklab,hsl(var(--foreground))_18%,transparent)] backdrop-blur-xl">
            <button
              type="button"
              onClick={() => panels.toggle("spine")}
              title="Outline"
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                panels.spine ? "bg-lib-accent-soft text-lib-accent" : "text-lib-text-secondary hover:bg-lib-hover",
              )}
            >
              <PanelLeft className="h-4 w-4" />
            </button>

            {activeTab === "note" && (
              <button
                type="button"
                onClick={() => panels.toggle("annotations")}
                title="Annotations"
                className={cn(
                  "relative inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                  panels.annotations ? "bg-lib-accent-soft text-lib-accent" : "text-lib-text-secondary hover:bg-lib-hover",
                )}
              >
                <StickyNote className="h-4 w-4" />
                {annotations.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-lib-accent px-1 text-[9px] font-bold tabular-nums text-lib-accent-fg">
                    {annotations.length}
                  </span>
                )}
              </button>
            )}

            {activeTab === "note" && (
              <button
                type="button"
                onClick={() => setFilterTrayOpen((v) => !v)}
                title="Reading filters"
                className={cn(
                  "relative inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                  filterTrayOpen || activeFilterCount > 0
                    ? "bg-lib-accent-soft text-lib-accent"
                    : "text-lib-text-secondary hover:bg-lib-hover",
                )}
              >
                <ChevronDown className={cn("h-4 w-4 transition-transform", filterTrayOpen && "rotate-180")} />
                {activeFilterCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-lib-accent px-1 text-[9px] font-bold tabular-nums text-lib-accent-fg">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            )}

            <div className="mx-1 h-5 w-px bg-lib-border/55" />

            <button
              type="button"
              onClick={toggleFocus}
              title={isFocusMode ? "Exit focus" : "Focus"}
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                isFocusMode ? "bg-lib-text text-lib-bg" : "text-lib-text-secondary hover:bg-lib-hover",
              )}
            >
              {isFocusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>

            <div className="mx-1 h-5 w-px bg-lib-border/55" />

            <button
              type="button"
              onClick={() => setTopBarCollapsed(true)}
              title="Collapse toolbar"
              aria-label="Collapse toolbar"
              className="inline-flex h-9 w-7 items-center justify-center rounded-full text-lib-text-muted/70 transition-colors hover:bg-lib-hover hover:text-lib-text"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Filter tray — floating dropdown under top bar (overlay) */}
      {filterTrayOpen && activeTab === "note" && (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-40 flex justify-center px-3">
          <div
            className="pointer-events-auto flex w-full flex-wrap items-center gap-1.5 rounded-lib-lg border border-lib-border/60 bg-lib-surface/98 px-3 py-2.5 shadow-lg backdrop-blur-xl transition-[max-width] duration-300 ease-out"
            style={{ maxWidth: "var(--lib-measure-max, min(78ch, 100%))" }}
          >
            <button
              type="button"
              onClick={() => setHighlightsVisible((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lib-sm border px-2.5 py-1.5 text-xs transition",
                !highlightsVisible
                  ? "border-lib-accent/30 bg-lib-accent-soft text-lib-accent"
                  : "border-lib-border bg-lib-surface text-lib-text-secondary hover:bg-lib-hover",
              )}
            >
              {highlightsVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              <span>Highlights</span>
            </button>

            <button
              type="button"
              onClick={() => updateLayer({ showHighYield: !readerLayers.showHighYield })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lib-sm border px-2.5 py-1.5 text-xs transition",
                readerLayers.showHighYield
                  ? "border-warning/30 bg-warning/10 text-warning"
                  : "border-lib-border bg-lib-surface text-lib-text-secondary hover:bg-lib-hover",
              )}
            >
              <Zap className="h-3.5 w-3.5" />
              <span>High-Yield</span>
            </button>

            <button
              type="button"
              onClick={() => updateLayer({ showKeyExam: !readerLayers.showKeyExam })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lib-sm border px-2.5 py-1.5 text-xs transition",
                readerLayers.showKeyExam
                  ? "border-info/30 bg-info/10 text-info"
                  : "border-lib-border bg-lib-surface text-lib-text-secondary hover:bg-lib-hover",
              )}
            >
              <Target className="h-3.5 w-3.5" />
              <span>Key Exam</span>
            </button>

            {missedFrameIds.size > 0 && (
              <button
                type="button"
                onClick={() => updateLayer({ showMissedQuestions: !readerLayers.showMissedQuestions })}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lib-sm border px-2.5 py-1.5 text-xs transition",
                  readerLayers.showMissedQuestions
                    ? "border-danger/30 bg-danger/10 text-danger"
                    : "border-lib-border bg-lib-surface text-lib-text-secondary hover:bg-lib-hover",
                )}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Missed ({missedFrameIds.size})</span>
              </button>
            )}

            <div className="ml-auto flex items-center gap-1 rounded-lib-sm border border-lib-border bg-lib-surface px-1">
              <button
                type="button"
                onClick={() => setReaderFontSize((s) => Math.max(13, s - 1))}
                className="flex h-8 w-8 items-center justify-center rounded text-lib-text-secondary hover:bg-lib-hover"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="min-w-[24px] text-center text-xs tabular-nums text-lib-text-muted">
                {readerFontSize}
              </span>
              <button
                type="button"
                onClick={() => setReaderFontSize((s) => Math.min(24, s + 1))}
                className="flex h-8 w-8 items-center justify-center rounded text-lib-text-secondary hover:bg-lib-hover"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      <ReaderStage ref={scrollRef}>
        <MeasureColumn>
          <div className="mt-16 flex border-b border-lib-border">
            {STUDY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => switchTab(tab.id)}
                className={cn(
                  "-mb-px min-h-[var(--lib-touch-min)] border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "border-lib-accent text-lib-accent"
                    : "border-transparent text-lib-text-muted hover:text-lib-text",
                )}
                style={{ fontFamily: "var(--lib-font-persian)" }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="h-5" />

          {activeTab === "note" && (
            <>
              <header className="mb-8">
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-lib-text-muted/80">
                  <Link
                    href={chapterContext?.chapterHref ?? "/library"}
                    className="inline-flex items-center gap-1 text-lib-text-muted hover:text-lib-text"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    {chapterContext ? "Chapter" : "Library"}
                  </Link>
                  <span className="text-lib-text-muted/40">·</span>
                  <span>Ch. {note.meta.chapterNo}</span>
                  {note.meta.pageRange && (
                    <>
                      <span className="text-lib-text-muted/40">·</span>
                      <span>{note.meta.pageRange}</span>
                    </>
                  )}
                  <StatusBadge status={status} className="ml-auto" />
                </div>

                <h1 className="mt-2 text-[26px] font-semibold leading-[1.15] tracking-tight text-lib-text ipad-portrait:text-[32px]">
                  {note.meta.chapterTitle}
                </h1>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
                  <Link
                    href={`/qbank?chapter=ch-${note.meta.chapterNo}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-lib-accent/20 bg-lib-accent-soft px-3 py-1 font-medium text-lib-accent transition hover:bg-lib-accent-hover"
                  >
                    <GraduationCap className="h-3.5 w-3.5" />
                    Questions
                  </Link>
                  {flashcardEnabled && (
                    <Link
                      href={`/flashcards?chapter=${note.meta.chapterNo}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-lib-border bg-lib-surface px-3 py-1 text-lib-text-secondary transition hover:bg-lib-hover"
                    >
                      <Layers className="h-3.5 w-3.5" />
                      Flashcards
                    </Link>
                  )}
                  {chapterContext?.previousSegmentHref && (
                    <Link
                      href={chapterContext.previousSegmentHref}
                      className="inline-flex items-center gap-1 rounded-full border border-lib-border bg-lib-surface px-3 py-1 text-lib-text-muted hover:text-lib-text"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      Prev
                    </Link>
                  )}
                  {chapterContext?.nextSegmentHref && (
                    <Link
                      href={chapterContext.nextSegmentHref}
                      className="inline-flex items-center gap-1 rounded-full border border-lib-border bg-lib-surface px-3 py-1 text-lib-text-muted hover:text-lib-text"
                    >
                      Next
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </header>

              <article
                data-reader-content="true"
                className="reader-content space-y-8"
                style={{ "--reader-font-size": `${readerFontSize}px` } as React.CSSProperties}
                onClick={handleReaderClick}
              >
                <SegmentRenderer
                  sections={note.sections}
                  initialFrameId={initialFrameId}
                  annotationsByFrameId={annotationsByFrameId}
                  annotationCountByFrameId={annotationCountByFrameId}
                  highlightsVisible={highlightsVisible}
                  showHighYieldMarker={readerLayers.showHighYield}
                  showKeyExam={readerLayers.showKeyExam}
                  showMissedQuestions={readerLayers.showMissedQuestions}
                  keyExamFrameIds={keyExamFrameIds}
                  missedFrameIds={missedFrameIds}
                />
              </article>

              {relatedFlashcards.length > 0 && (
                <section className="mt-10 rounded-lib-xl border border-lib-border bg-lib-surface px-5 py-5">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-base font-semibold text-lib-text">Related Flashcards</h2>
                    {reviewEnabled ? (
                      <Link href="/flashcards/review" className="text-sm font-medium text-lib-accent hover:underline">
                        Review All
                      </Link>
                    ) : null}
                  </div>
                  <ul className="mt-4 space-y-2">
                    {relatedFlashcards.map((card) => (
                      <li key={card.id} className="rounded-lib-md border border-lib-border bg-lib-hover px-4 py-3">
                        <div className="text-sm font-medium text-lib-text">
                          {card.frontHtml.replace(/<[^>]*>/g, " ")}
                        </div>
                        <div className="mt-0.5 text-xs text-lib-text-muted">
                          {card.dueAt ? `Due ${new Date(card.dueAt).toLocaleDateString()}` : "New card"}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          {activeTab === "yield" && (
            <YieldTab
              yieldData={yieldData ?? { chapterNo: note.meta.chapterNo, docId: note.meta.docId, sections: [], totalCards: 0 }}
              scrollContainerRef={scrollRef}
              onActiveSectionChange={setActiveYieldSection}
              onJumpToNote={(anchor) => {
                if (!anchor) return;
                switchTab("note");
                // Wait one frame for the article to mount before jumping.
                requestAnimationFrame(() => {
                  void jumpToAnchor(anchor, { kind: "yield" });
                });
              }}
              onOpenMCQ={(ch) => { window.location.href = `/qbank?chapter=ch-${ch}`; }}
              onOpenFlashcards={(ch) => { window.location.href = `/flashcards?chapter=${ch}`; }}
            />
          )}

          <div className="h-24" />
        </MeasureColumn>
      </ReaderStage>

      {activeTab === "note" && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-30">
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-lib-border/45 bg-lib-glass/90 px-3 py-1.5 text-[10.5px] text-lib-text-muted shadow-[0_4px_20px_-8px_color-mix(in_oklab,hsl(var(--foreground))_15%,transparent)] backdrop-blur-xl">
            <div className="h-1 w-24 overflow-hidden rounded-full bg-lib-border/55">
              <div
                className="h-full rounded-full bg-gradient-to-r from-lib-accent/90 to-lib-accent transition-[width] duration-lib-spring ease-lib-spring"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="font-mono tabular-nums font-medium tracking-tight">{progressLabel}</span>
          </div>
        </div>
      )}

      <SelectionPopup
        allowCardCreation={flashcardEnabled}
        annotations={annotations}
        onCreateCard={(sel) => { setEditorInitial({ front: "", back: sel.text }); setIsEditorOpen(true); }}
        onCreateCloze={(sel) => { setEditorInitial({ front: `{{c1::${sel.text}}}`, back: sel.text }); setIsEditorOpen(true); }}
        onHighlight={(sel, color) => addAnnotation({ selection: sel, type: "highlight", color })}
        onRemoveHighlight={(ids) => ids.forEach(removeAnnotation)}
        onUnderline={(sel) => { addAnnotation({ selection: sel, type: "underline" }); panels.open("annotations"); }}
        onComment={handleComment}
      />

      <ReaderAnnotationsPanel
        annotations={annotations}
        isOpen={panels.annotations}
        onClose={() => panels.close("annotations")}
        onJumpToFrame={(id) => {
          if (id) void jumpToAnchor(id, { kind: "annotation" });
        }}
        onDelete={removeAnnotation}
      />

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

      {flashcardEnabled && (
        <QuickCardEditor
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          initialFront={editorInitial.front}
          initialBack={editorInitial.back}
          sourceType="selection"
          onSave={async (card) => {
            await fetch("/api/flashcards", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...card,
                sourceType: "note",
                sourceDocId: note.meta.docId,
                chapterNo: note.meta.chapterNo,
              }),
            });
          }}
        />
      )}

      {isFigureOpen && <FigureViewer {...viewerProps} />}

      {/* Inline source bubble — portaled into the active target frame. */}
      <InlineSourceBubble />
    </LibraryShell>
  );
}