"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type RefObject } from "react";
import { CheckCircle2, Crosshair, Focus, ListChecks, Maximize2, PanelLeftClose, PanelRightClose, RotateCcw, Search } from "lucide-react";

import { useOutlinerStore, type Checkpoint, type SearchResult } from "@/components/outliner/outliner-store";
import { CRDTStatusBar } from "@/components/outliner/CRDTStatusBar";
import {
  familyOfSurface,
  isTrapSurface,
  linkedBlockIds,
  listSurfaceObjects,
  readString,
  titleOf,
} from "@/components/outliner/surface-families";
import {
  algorithmDisplayTitle,
  algorithmTypeLabel,
  chapterDisplayFromIR,
  nodeDisplayTitle,
  surfaceSearchText,
  surfaceStats,
} from "@/components/outliner/navigation-labels";
import {
  CardGridRenderer,
  ChainRenderer,
  DagRenderer,
  renderSurface,
} from "@/components/outliner/renderers";
import {
  buildSearchResults,
  collectCheckpoints,
  computeFocusPath,
} from "@/components/outliner/study-interactions";
import { AnnotationOverlay } from "@/components/outliner/AnnotationOverlay";
import { AnnotationToolbar } from "@/components/outliner/AnnotationToolbar";
import { StrokeEngine } from "@/components/outliner/StrokeEngine";
import { readStrokeBlob } from "@/lib/outliner/annotation-repository";
import type { AlgorithmIR, AlgorithmRecord, AlgorithmSurface } from "@/types/algorithm-ir";
import type { StrokeAnnotationMetadata } from "@/types/annotation";

interface OutlinerShellProps {
  segmentId: string;
  ir: AlgorithmIR;
  initialSurfaceId?: string | null;
  validationWarnings?: string[];
  onSurfaceSelect?: (surfaceId: string) => void;
  onBlockClick?: (blockId: string) => void;
  onFocusModeChange?: (active: boolean) => void;
}

const KEY_HINTS = ["] سطح بعد", "[ سطح قبل", "f فوکوس", "t تله", "h آستانه", "c مرور", "/ جستجو", "a حاشیه", "Esc خروج"];

function resultKindLabel(kind: SearchResult["kind"]): string {
  const labels: Record<SearchResult["kind"], string> = {
    surface: "سطح",
    node: "گره",
    edge: "ارتباط",
    matrix_row: "ردیف ماتریس",
    threshold: "آستانه",
    trap: "تله",
    checkpoint: "چک‌پوینت",
    blockId: "منبع",
  };
  return labels[kind];
}

export function OutlinerShell({ segmentId, ir, initialSurfaceId, validationWarnings = [], onSurfaceSelect, onBlockClick, onFocusModeChange }: OutlinerShellProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const searchCacheRef = useRef<Map<string, SearchResult[]>>(new Map());
  const mainRegionRef = useRef<HTMLDivElement>(null);
  const surfaces = useOutlinerStore((state) => state.surfaces);
  const selectedSurfaceId = useOutlinerStore((state) => state.selectedSurfaceId);
  const focusedNodeId = useOutlinerStore((state) => state.focusedNodeId);
  const trapModeActive = useOutlinerStore((state) => state.trapModeActive);
  const thresholdModeActive = useOutlinerStore((state) => state.thresholdModeActive);
  const checkpointModeActive = useOutlinerStore((state) => state.checkpointModeActive);
  const focusPathActive = useOutlinerStore((state) => state.focusPathActive);
  const searchQuery = useOutlinerStore((state) => state.searchQuery);
  const searchResults = useOutlinerStore((state) => state.searchResults);
  const activeSearchIndex = useOutlinerStore((state) => state.activeSearchIndex);
  const completedSurfaceIds = useOutlinerStore((state) => state.completedSurfaceIds);
  const setSegment = useOutlinerStore((state) => state.setSegment);
  const selectSurface = useOutlinerStore((state) => state.selectSurface);
  const setSearch = useOutlinerStore((state) => state.setSearch);
  const setSearchResults = useOutlinerStore((state) => state.setSearchResults);
  const moveSearchCursor = useOutlinerStore((state) => state.moveSearchCursor);
  const setFocusPath = useOutlinerStore((state) => state.setFocusPath);
  const activateFocusPath = useOutlinerStore((state) => state.activateFocusPath);
  const exitFocusPath = useOutlinerStore((state) => state.exitFocusPath);
  const setTrapMode = useOutlinerStore((state) => state.setTrapMode);
  const setThresholdMode = useOutlinerStore((state) => state.setThresholdMode);
  const setCheckpointMode = useOutlinerStore((state) => state.setCheckpointMode);
  const setCheckpointQueue = useOutlinerStore((state) => state.setCheckpointQueue);
  const resetFocus = useOutlinerStore((state) => state.resetFocus);
  const annotationMode = useOutlinerStore((state) => state.annotationMode);
  const setAnnotationMode = useOutlinerStore((state) => state.setAnnotationMode);
  const loadAnnotationsForSurface = useOutlinerStore((state) => state.loadAnnotationsForSurface);
  const initCRDTForSegment = useOutlinerStore((state) => state.initCRDTForSegment);
  const zoomLevel = useOutlinerStore((state) => state.zoomLevel);
  const setZoom = useOutlinerStore((state) => state.setZoom);
  const [tocQuery, setTocQuery] = useState("");
  const [tocCollapsed, setTocCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  useEffect(() => {
    setSegment(segmentId, ir.surfaces);
    if (initialSurfaceId && ir.surfaces.some((surface) => surface.id === initialSurfaceId)) {
      selectSurface(initialSurfaceId);
    }
  }, [initialSurfaceId, ir.surfaces, segmentId, selectSurface, setSegment]);

  useEffect(() => {
    setCheckpointQueue(collectCheckpoints(ir.surfaces));
  }, [ir.surfaces, setCheckpointQueue]);

  useEffect(() => {
    searchCacheRef.current.clear();
  }, [segmentId]);

  // Initialize CRDT for this segment (once per segmentId change),
  // then hydrate PGLite from the CRDT doc before the first surface annotation load.
  useEffect(() => {
    void initCRDTForSegment(segmentId);
  }, [segmentId, initCRDTForSegment]);

  // Load annotations whenever the selected surface changes
  useEffect(() => {
    if (!selectedSurfaceId || !segmentId) return;
    void loadAnnotationsForSurface(segmentId, selectedSurfaceId);
  }, [selectedSurfaceId, segmentId, loadAnnotationsForSurface]);

  useEffect(() => {
    const token = searchQuery.trim().toLowerCase();
    if (token.length < 2) {
      setSearchResults([]);
      return;
    }
    const cached = searchCacheRef.current.get(token);
    if (cached) {
      setSearchResults(cached);
      return;
    }
    const results = buildSearchResults(ir.surfaces, searchQuery);
    searchCacheRef.current.set(token, results);
    setSearchResults(results);
  }, [ir.surfaces, searchQuery, setSearchResults]);

  const visibleSurfaces = useMemo(() => {
    return trapModeActive ? surfaces.filter(isTrapSurface) : surfaces;
  }, [trapModeActive, surfaces]);

  const selectedSurface = useMemo(() => {
    return surfaces.find((surface) => surface.id === selectedSurfaceId) ?? visibleSurfaces[0] ?? null;
  }, [selectedSurfaceId, surfaces, visibleSurfaces]);

  const filteredTocSurfaces = useMemo(() => {
    const query = tocQuery.trim().toLowerCase();
    if (!query) return visibleSurfaces;
    return visibleSurfaces.filter((surface, index) => surfaceSearchText(surface, index).includes(query));
  }, [tocQuery, visibleSurfaces]);

  const currentTocIndex = useMemo(() => {
    return filteredTocSurfaces.findIndex((surface) => surface.id === selectedSurface?.id);
  }, [filteredTocSurfaces, selectedSurface]);

  useEffect(() => {
    if (selectedSurfaceId) onSurfaceSelect?.(selectedSurfaceId);
  }, [onSurfaceSelect, selectedSurfaceId]);

  useEffect(() => {
    onFocusModeChange?.(focusMode);
  }, [focusMode, onFocusModeChange]);

  useEffect(() => {
    if (trapModeActive && selectedSurface && !isTrapSurface(selectedSurface) && visibleSurfaces[0]) {
      selectSurface(visibleSurfaces[0].id);
    }
  }, [selectSurface, selectedSurface, trapModeActive, visibleSurfaces]);

  function openSearchResult(result: SearchResult): void {
    selectAlgorithm(result.surfaceId);
    setSearch("");
    const surface = surfaces.find((item) => item.id === result.surfaceId);
    if (!surface) return;
    if (result.kind === "node") {
      activateFocusPath(result.objectId);
      setFocusPath(computeFocusPath(surface, result.objectId));
    }
  }

  function selectAlgorithm(surfaceId: string): void {
    selectSurface(surfaceId);
    window.requestAnimationFrame(() => {
      mainRegionRef.current?.focus({ preventScroll: true });
      mainRegionRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }

  function selectRelativeAlgorithm(delta: number): void {
    const list = filteredTocSurfaces.length > 0 ? filteredTocSurfaces : visibleSurfaces;
    if (list.length === 0) return;
    const index = currentTocIndex >= 0 ? currentTocIndex : Math.max(0, list.findIndex((surface) => surface.id === selectedSurface?.id));
    const next = list[(index + delta + list.length) % list.length];
    if (next) selectAlgorithm(next.id);
  }

  function centerCurrent(): void {
    const selector = focusedNodeId ? `[data-node-id="${CSS.escape(focusedNodeId)}"]` : null;
    const target = selector ? document.querySelector(selector) : mainRegionRef.current;
    target?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (typing && event.key !== "Escape" && event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Enter") return;

      if (searchResults.length > 0 && (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter")) {
        event.preventDefault();
        if (event.key === "ArrowDown") moveSearchCursor(1);
        if (event.key === "ArrowUp") moveSearchCursor(-1);
        if (event.key === "Enter" && searchResults[activeSearchIndex]) openSearchResult(searchResults[activeSearchIndex]);
        return;
      }

      const list = filteredTocSurfaces.length > 0 ? filteredTocSurfaces : visibleSurfaces.length > 0 ? visibleSurfaces : surfaces;
      const currentIndex = Math.max(0, list.findIndex((surface) => surface.id === selectedSurface?.id));
      if (event.key === "]") {
        event.preventDefault();
        const next = list[(currentIndex + 1) % list.length];
        if (next) selectAlgorithm(next.id);
      } else if (event.key === "[") {
        event.preventDefault();
        const prev = list[(currentIndex - 1 + list.length) % list.length];
        if (prev) selectAlgorithm(prev.id);
      // RTL study navigation: ArrowRight moves to the previous visible TOC item;
      // ArrowLeft moves to the next visible TOC item. Existing [ and ] shortcuts remain intact.
      } else if (!checkpointModeActive && !thresholdModeActive && event.key === "ArrowRight") {
        event.preventDefault();
        selectRelativeAlgorithm(-1);
      } else if (!checkpointModeActive && !thresholdModeActive && event.key === "ArrowLeft") {
        event.preventDefault();
        selectRelativeAlgorithm(1);
      } else if (event.key.toLowerCase() === "t") {
        event.preventDefault();
        setTrapMode(!trapModeActive);
      } else if (event.key.toLowerCase() === "h") {
        event.preventDefault();
        setThresholdMode(!thresholdModeActive);
      } else if (event.key.toLowerCase() === "c") {
        event.preventDefault();
        setCheckpointMode(!checkpointModeActive);
      } else if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === "Escape") {
        event.preventDefault();
        resetFocus();
        setThresholdMode(false);
        setCheckpointMode(false);
        setSearch("");
      } else if (event.key.toLowerCase() === "f" && selectedSurface && focusedNodeId) {
        event.preventDefault();
        activateFocusPath(focusedNodeId);
        setFocusPath(computeFocusPath(selectedSurface, focusedNodeId));
      } else if (event.key.toLowerCase() === "a") {
        event.preventDefault();
        setAnnotationMode(!annotationMode);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activeSearchIndex,
    activateFocusPath,
    annotationMode,
    checkpointModeActive,
    filteredTocSurfaces,
    focusedNodeId,
    moveSearchCursor,
    resetFocus,
    searchResults,
    selectSurface,
    selectedSurface,
    setAnnotationMode,
    setCheckpointMode,
    setFocusPath,
    setSearch,
    setThresholdMode,
    setTrapMode,
    surfaces,
    thresholdModeActive,
    trapModeActive,
    visibleSurfaces,
  ]);

  const completedCount = completedSurfaceIds.size;
  const totalCount = surfaces.length;
  const chapter = useMemo(() => chapterDisplayFromIR(segmentId, ir), [ir, segmentId]);
  const surfaceTitleById = useMemo(() => {
    return new Map(surfaces.map((surface, index) => [surface.id, algorithmDisplayTitle(surface, index)]));
  }, [surfaces]);
  const selectedAlgorithmTitle = selectedSurface ? surfaceTitleById.get(selectedSurface.id) ?? algorithmDisplayTitle(selectedSurface) : "Clinical pathway";
  const selectedNode = selectedSurface?.nodes?.find((node) => node.id === focusedNodeId) ?? null;
  const selectedStepTitle = nodeDisplayTitle(selectedNode ?? undefined) ?? null;
  const gridClassName = focusMode
    ? "grid-cols-1"
    : !tocCollapsed && !inspectorCollapsed
      ? "lg:grid-cols-[276px_minmax(0,1fr)_288px]"
      : tocCollapsed && !inspectorCollapsed
        ? "lg:grid-cols-[minmax(0,1fr)_288px]"
        : !tocCollapsed && inspectorCollapsed
          ? "lg:grid-cols-[276px_minmax(0,1fr)]"
          : "lg:grid-cols-[minmax(0,1fr)]";

  return (
    <div className="outliner-shell min-h-[calc(100vh-32px)] bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <div className={`grid min-h-[calc(100vh-32px)] grid-cols-1 ${gridClassName}`}>
        {!focusMode && !tocCollapsed && (
          <LeftRail
            surfaces={filteredTocSurfaces}
            allSurfaceCount={visibleSurfaces.length}
            selectedSurfaceId={selectedSurface?.id ?? null}
            currentIndex={currentTocIndex}
            onSelect={selectAlgorithm}
            onPrevious={() => selectRelativeAlgorithm(-1)}
            onNext={() => selectRelativeAlgorithm(1)}
            segmentId={segmentId}
            chapterLabel={chapter.label}
            tocQuery={tocQuery}
            setTocQuery={setTocQuery}
            onCollapse={() => setTocCollapsed(true)}
          />
        )}
        <div ref={mainRegionRef} tabIndex={-1} className="min-w-0 border-x border-border/50 outline-none">
          {focusMode ? (
            <CompactFocusBar
              chapterLabel={chapter.label}
              algorithmTitle={selectedAlgorithmTitle}
              stepTitle={selectedStepTitle}
              onRestore={() => setFocusMode(false)}
            />
          ) : (
            <TopBar
              chapterLabel={chapter.label}
              chapterTitle={chapter.title}
              algorithmTitle={selectedAlgorithmTitle}
              stepTitle={selectedStepTitle}
              searchRef={searchRef}
              searchQuery={searchQuery}
              setSearch={setSearch}
              searchResults={searchResults}
              activeSearchIndex={activeSearchIndex}
              openSearchResult={openSearchResult}
              surfaceTitleById={surfaceTitleById}
              trapModeActive={trapModeActive}
              setTrapMode={setTrapMode}
              thresholdModeActive={thresholdModeActive}
              setThresholdMode={setThresholdMode}
              checkpointModeActive={checkpointModeActive}
              setCheckpointMode={setCheckpointMode}
              focusPathActive={focusPathActive}
              exitFocusPath={exitFocusPath}
              completedCount={completedCount}
              totalCount={totalCount}
              currentIndex={currentTocIndex}
              visibleCount={filteredTocSurfaces.length}
              zoomLevel={zoomLevel}
              onPrevious={() => selectRelativeAlgorithm(-1)}
              onNext={() => selectRelativeAlgorithm(1)}
              onCenterCurrent={centerCurrent}
              onFitGraph={() => setZoom(0.85)}
              onResetZoom={() => setZoom(1)}
              tocCollapsed={tocCollapsed}
              inspectorCollapsed={inspectorCollapsed}
              onToggleToc={() => setTocCollapsed((value) => !value)}
              onToggleInspector={() => setInspectorCollapsed((value) => !value)}
              onFocusMode={() => setFocusMode(true)}
            />
          )}
          <MainCanvas surface={selectedSurface} surfaces={surfaces} onBlockClick={onBlockClick} segmentId={segmentId} />
        </div>
        {!focusMode && !inspectorCollapsed && (
          <RightRail surface={selectedSurface} focusedNodeId={focusedNodeId} validationWarnings={validationWarnings} onCollapse={() => setInspectorCollapsed(true)} />
        )}
      </div>
      {focusMode && (
        <button
          type="button"
          className="fixed left-4 top-4 z-50 min-h-10 rounded-md border border-border/70 bg-background/95 px-3 text-xs font-semibold shadow-lg backdrop-blur"
          onClick={() => setFocusMode(false)}
        >
          Restore panels
        </button>
      )}
      {/* Dev-only CRDT status bar — hidden in production builds */}
      <CRDTStatusBar segmentId={segmentId} />
    </div>
  );
}

function LeftRail({
  surfaces,
  allSurfaceCount,
  selectedSurfaceId,
  currentIndex,
  onSelect,
  onPrevious,
  onNext,
  segmentId,
  chapterLabel,
  tocQuery,
  setTocQuery,
  onCollapse,
}: {
  surfaces: AlgorithmSurface[];
  allSurfaceCount: number;
  selectedSurfaceId: string | null;
  currentIndex: number;
  onSelect: (id: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  segmentId: string;
  chapterLabel: string;
  tocQuery: string;
  setTocQuery: (value: string) => void;
  onCollapse: () => void;
}) {
  const completedSurfaceIds = useOutlinerStore((state) => state.completedSurfaceIds);
  const surfaceTrail = useOutlinerStore((state) => state.surfaceTrail);
  const allSurfaces = useOutlinerStore((state) => state.surfaces);
  const markSurfaceComplete = useOutlinerStore((state) => state.markSurfaceComplete);
  const resetCompletedForSegment = useOutlinerStore((state) => state.resetCompletedForSegment);
  const [openTrail, setOpenTrail] = useState(true);

  return (
    <aside className="outliner-algorithm-panel border-b border-border/50 bg-[var(--color-surface)] p-3 lg:border-b-0">
      <div className="mb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold">
            <ListChecks className="h-4 w-4 text-primary" />
            Algorithm TOC
          </div>
          <button type="button" className="min-h-10 rounded-md border border-border/60 px-2 text-[11px]" onClick={onCollapse}>
            Collapse
          </button>
        </div>
        <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[var(--color-text-secondary)]">{chapterLabel}</p>
      </div>
      <label className="mb-3 flex min-h-10 items-center gap-2 rounded-md border border-border/70 bg-background/70 px-2">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={tocQuery}
          onChange={(event) => setTocQuery(event.target.value)}
          className="w-full bg-transparent text-xs outline-none"
          placeholder="Search algorithms..."
        />
      </label>
      <div className="mb-3 rounded-md border border-border/60 bg-background/45 p-2">
        <div className="mb-2 text-[11px] font-semibold text-muted-foreground">
          {currentIndex >= 0 ? `${currentIndex + 1} / ${surfaces.length} algorithms` : `0 / ${surfaces.length} algorithms`}
          {tocQuery.trim() && surfaces.length !== allSurfaceCount ? ` · filtered from ${allSurfaceCount}` : ""}
        </div>
        <div dir="rtl" className="flex items-center justify-between gap-2">
          <button type="button" className="inline-flex min-h-10 items-center gap-1 rounded-md border border-border/70 px-2 text-xs hover:bg-background" onClick={onPrevious} disabled={surfaces.length === 0}>
            → قبلی
          </button>
          <button type="button" className="inline-flex min-h-10 items-center gap-1 rounded-md border border-border/70 px-2 text-xs hover:bg-background" onClick={onNext} disabled={surfaces.length === 0}>
            بعدی ←
          </button>
        </div>
      </div>
      <nav className="space-y-1" aria-label="Algorithm table of contents">
        {surfaces.length === 0 && (
          <div className="rounded-md border border-dashed border-border/70 p-3 text-xs text-muted-foreground">
            No algorithms match this filter.
          </div>
        )}
        {surfaces.map((surface, index) => {
          const selected = surface.id === selectedSurfaceId;
          const complete = completedSurfaceIds.has(surface.id);
          const stats = surfaceStats(surface);
          return (
            <button
              key={surface.id}
              type="button"
              onClick={() => onSelect(surface.id)}
              className={`outliner-toc-item min-h-11 w-full rounded-md border px-3 py-2 text-right text-xs transition ${
                selected
                  ? "is-active border-primary/70 bg-primary/10 text-foreground shadow-sm"
                  : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-background/70 hover:text-foreground"
              }`}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-5">{algorithmDisplayTitle(surface, index)}</span>
                  <span className="mt-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">{algorithmTypeLabel(surface)}</span>
                  <span className="mt-2 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                    {stats.checkpoints > 0 && <span>{stats.checkpoints} checkpoints</span>}
                    {stats.traps > 0 && <span>{stats.traps} traps</span>}
                    {stats.gates > 0 && <span>{stats.gates} gates</span>}
                    {stats.matrices > 0 && <span>{stats.matrices} matrices</span>}
                  </span>
                </span>
                {complete && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />}
              </span>
            </button>
          );
        })}
      </nav>

      <section className="mt-6 rounded-md border border-border/60 bg-background/35 p-2">
        <div className="mb-2 flex items-center justify-between gap-2">
          <button type="button" className="min-h-11 text-xs font-bold" onClick={() => setOpenTrail(!openTrail)}>
            مسیر مطالعه
          </button>
          <button type="button" className="min-h-11 rounded border border-border/60 px-2 text-[11px]" onClick={resetCompletedForSegment}>
            شروع مجدد
          </button>
        </div>
        {openTrail && (
          <div className="space-y-1">
            {surfaceTrail.map((surfaceId) => {
              const surface = allSurfaces.find((item) => item.id === surfaceId);
              if (!surface) return null;
              return (
                <label key={`${segmentId}-${surfaceId}`} className="flex min-h-11 items-center gap-2 rounded border border-border/40 p-2 text-xs">
                  <input type="checkbox" checked={completedSurfaceIds.has(surfaceId)} onChange={() => markSurfaceComplete(surfaceId)} />
                  <button type="button" className="min-w-0 flex-1 text-right" onClick={() => onSelect(surfaceId)}>
                    <span className="block truncate font-medium">{algorithmDisplayTitle(surface)}</span>
                    <span className="block text-[10px] text-muted-foreground">{algorithmTypeLabel(surface)}</span>
                  </button>
                </label>
              );
            })}
          </div>
        )}
      </section>
    </aside>
  );
}

function TopBar({
  chapterLabel,
  chapterTitle,
  algorithmTitle,
  stepTitle,
  searchRef,
  searchQuery,
  setSearch,
  searchResults,
  activeSearchIndex,
  openSearchResult,
  surfaceTitleById,
  trapModeActive,
  setTrapMode,
  thresholdModeActive,
  setThresholdMode,
  checkpointModeActive,
  setCheckpointMode,
  focusPathActive,
  exitFocusPath,
  completedCount,
  totalCount,
  currentIndex,
  visibleCount,
  zoomLevel,
  onPrevious,
  onNext,
  onCenterCurrent,
  onFitGraph,
  onResetZoom,
  tocCollapsed,
  inspectorCollapsed,
  onToggleToc,
  onToggleInspector,
  onFocusMode,
}: {
  chapterLabel: string;
  chapterTitle: string;
  algorithmTitle: string;
  stepTitle: string | null;
  searchRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  setSearch: (value: string) => void;
  searchResults: SearchResult[];
  activeSearchIndex: number;
  openSearchResult: (result: SearchResult) => void;
  surfaceTitleById: Map<string, string>;
  trapModeActive: boolean;
  setTrapMode: (value: boolean) => void;
  thresholdModeActive: boolean;
  setThresholdMode: (value: boolean) => void;
  checkpointModeActive: boolean;
  setCheckpointMode: (value: boolean) => void;
  focusPathActive: boolean;
  exitFocusPath: () => void;
  completedCount: number;
  totalCount: number;
  currentIndex: number;
  visibleCount: number;
  zoomLevel: number;
  onPrevious: () => void;
  onNext: () => void;
  onCenterCurrent: () => void;
  onFitGraph: () => void;
  onResetZoom: () => void;
  tocCollapsed: boolean;
  inspectorCollapsed: boolean;
  onToggleToc: () => void;
  onToggleInspector: () => void;
  onFocusMode: () => void;
}) {
  return (
    <header className="relative border-b border-border/50 bg-[var(--color-surface)] p-3">
      <nav className="mb-2 flex min-w-0 items-center gap-2 text-[11px] font-medium text-muted-foreground" aria-label="Outliner breadcrumb">
        <span className="truncate">{chapterLabel}</span>
        <span aria-hidden="true" className="text-border">→</span>
        <span className="truncate text-foreground">{algorithmTitle}</span>
        {stepTitle && (
          <>
            <span aria-hidden="true" className="text-border">→</span>
            <span className="truncate text-foreground/80">{stepTitle}</span>
          </>
        )}
      </nav>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold">{algorithmTitle}</h1>
          <p className="truncate text-[11px] text-[var(--color-text-secondary)]">{chapterTitle}</p>
        </div>
        <div className="text-xs text-muted-foreground">پیشرفت: {completedCount} از {totalCount} سطح تکمیل شد</div>
        {focusPathActive && (
          <div className="flex min-h-11 items-center gap-2 rounded border border-[var(--color-focus-ring)] bg-[var(--color-entry)]/10 px-2 text-xs">
            <Focus className="h-4 w-4" />
            حالت فوکوس فعال
            <button type="button" className="rounded border border-border/60 px-2 py-1" onClick={exitFocusPath}>خروج از فوکوس</button>
          </div>
        )}
        <label className="flex min-h-11 min-w-[240px] items-center gap-2 rounded-md border border-border/70 bg-background/70 px-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input ref={searchRef} value={searchQuery} onChange={(event) => setSearch(event.target.value)} className="w-full bg-transparent text-xs outline-none" placeholder="جستجو در این بخش..." />
        </label>
        <button type="button" className={`min-h-11 rounded-md border px-3 text-xs ${trapModeActive ? "border-rose-400 bg-rose-500/10" : "border-border/70"}`} onClick={() => setTrapMode(!trapModeActive)}>
          فقط تله‌ها
        </button>
        <button type="button" className={`min-h-11 rounded-md border px-3 text-xs ${thresholdModeActive ? "border-amber-400 bg-amber-500/10" : "border-border/70"}`} onClick={() => setThresholdMode(!thresholdModeActive)}>
          آستانه‌ها
        </button>
        <button type="button" className={`min-h-11 rounded-md border px-3 text-xs ${checkpointModeActive ? "border-emerald-400 bg-emerald-500/10" : "border-border/70"}`} onClick={() => setCheckpointMode(!checkpointModeActive)}>
          مرور سریع
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div dir="rtl" className="flex items-center gap-2">
          <button type="button" className="inline-flex min-h-10 items-center gap-1 rounded-md border border-border/70 px-3 text-xs hover:bg-background" onClick={onPrevious} disabled={visibleCount === 0}>
            → قبلی
          </button>
          <span className="rounded-md border border-border/60 bg-background/60 px-2 py-2 text-[11px] text-muted-foreground">
            {currentIndex >= 0 ? `${currentIndex + 1} / ${visibleCount} algorithms` : `0 / ${visibleCount} algorithms`}
          </span>
          <button type="button" className="inline-flex min-h-10 items-center gap-1 rounded-md border border-border/70 px-3 text-xs hover:bg-background" onClick={onNext} disabled={visibleCount === 0}>
            بعدی ←
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" className="inline-flex min-h-10 items-center gap-1 rounded-md border border-border/70 px-2 text-xs hover:bg-background" onClick={onCenterCurrent}>
            <Crosshair className="h-3.5 w-3.5" />
            Center current
          </button>
          <button type="button" className="min-h-10 rounded-md border border-border/70 px-2 text-xs hover:bg-background" onClick={onFitGraph}>
            Fit graph
          </button>
          <button type="button" className="inline-flex min-h-10 items-center gap-1 rounded-md border border-border/70 px-2 text-xs hover:bg-background" onClick={onResetZoom}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset zoom ({Math.round(zoomLevel * 100)}%)
          </button>
          <button type="button" className="inline-flex min-h-10 items-center gap-1 rounded-md border border-border/70 px-2 text-xs hover:bg-background" onClick={onToggleToc}>
            <PanelLeftClose className="h-3.5 w-3.5" />
            {tocCollapsed ? "Show TOC" : "Hide TOC"}
          </button>
          <button type="button" className="inline-flex min-h-10 items-center gap-1 rounded-md border border-border/70 px-2 text-xs hover:bg-background" onClick={onToggleInspector}>
            <PanelRightClose className="h-3.5 w-3.5" />
            {inspectorCollapsed ? "Show details" : "Hide details"}
          </button>
          <button type="button" className="inline-flex min-h-10 items-center gap-1 rounded-md border border-primary/70 bg-primary/10 px-2 text-xs font-semibold hover:bg-primary/15" onClick={onFocusMode}>
            <Maximize2 className="h-3.5 w-3.5" />
            تمرکز روی الگوریتم
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {KEY_HINTS.map((hint) => (
          <kbd key={hint} className="rounded border border-border/60 bg-background/60 px-1.5 py-0.5 text-[10px] text-[var(--color-text-secondary)]">{hint}</kbd>
        ))}
      </div>
      {searchResults.length > 0 && (
        <SearchResults results={searchResults} activeIndex={activeSearchIndex} openSearchResult={openSearchResult} surfaceTitleById={surfaceTitleById} />
      )}
    </header>
  );
}

function CompactFocusBar({
  chapterLabel,
  algorithmTitle,
  stepTitle,
  onRestore,
}: {
  chapterLabel: string;
  algorithmTitle: string;
  stepTitle: string | null;
  onRestore: () => void;
}) {
  return (
    <div className="sticky top-0 z-30 flex min-h-12 items-center justify-between gap-3 border-b border-border/50 bg-background/90 px-3 backdrop-blur">
      <div className="min-w-0 text-xs">
        <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
          <span className="truncate">{chapterLabel}</span>
          <span>→</span>
          <span className="truncate font-semibold text-foreground">{algorithmTitle}</span>
          {stepTitle && (
            <>
              <span>→</span>
              <span className="truncate text-foreground/80">{stepTitle}</span>
            </>
          )}
        </div>
      </div>
      <button type="button" className="min-h-10 shrink-0 rounded-md border border-border/70 px-3 text-xs font-semibold" onClick={onRestore}>
        Restore panels
      </button>
    </div>
  );
}

function SearchResults({
  results,
  activeIndex,
  openSearchResult,
  surfaceTitleById,
}: {
  results: SearchResult[];
  activeIndex: number;
  openSearchResult: (result: SearchResult) => void;
  surfaceTitleById: Map<string, string>;
}) {
  const groups = results.reduce<Record<string, SearchResult[]>>((acc, result) => {
    acc[result.kind] = acc[result.kind] ?? [];
    acc[result.kind].push(result);
    return acc;
  }, {});
  let absoluteIndex = -1;
  return (
    <div className="absolute left-3 right-3 top-full z-40 mt-1 max-h-80 overflow-auto rounded-md border border-border/70 bg-[var(--color-surface)] p-2 shadow-xl">
      {Object.entries(groups).map(([kind, items]) => (
        <section key={kind} className="mb-2">
          <h3 className="mb-1 text-[11px] font-bold text-muted-foreground">{resultKindLabel(kind as SearchResult["kind"])}</h3>
          {items.map((result) => {
            absoluteIndex += 1;
            const active = absoluteIndex === activeIndex;
            return (
              <button
                key={`${result.kind}-${result.surfaceId}-${result.objectId}-${absoluteIndex}`}
                type="button"
                className={`min-h-11 w-full rounded px-2 py-1 text-right text-xs ${active ? "bg-primary/10" : "hover:bg-background/60"}`}
                onClick={() => openSearchResult(result)}
              >
                <div className="font-medium">{surfaceTitleById.get(result.surfaceId) ?? result.surfaceTitle}</div>
                <div className="text-muted-foreground">
                  {result.kind === "blockId" ? "Source match" : `${result.matchField}: ${result.matchText}`}
                </div>
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function MainCanvas({
  surface,
  surfaces,
  onBlockClick,
  segmentId,
}: {
  surface: AlgorithmSurface | null;
  surfaces: AlgorithmSurface[];
  onBlockClick?: (blockId: string) => void;
  segmentId: string | null;
}) {
  const thresholdModeActive = useOutlinerStore((state) => state.thresholdModeActive);
  const checkpointModeActive = useOutlinerStore((state) => state.checkpointModeActive);
  const annotationMode = useOutlinerStore((state) => state.annotationMode);
  const activeAnnotationType = useOutlinerStore((state) => state.activeAnnotationType);
  const activeColor = useOutlinerStore((state) => state.activeColor);
  const activeWidth = useOutlinerStore((state) => state.activeWidth);
  const loadedAnnotations = useOutlinerStore((state) => state.loadedAnnotations);
  const applyOp = useOutlinerStore((state) => state.applyOp);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<StrokeEngine | null>(null);

  // Stable callback ref for stroke commit — avoids engine recreation on color/width change
  const onStrokeCommitRef = useRef<
    (metadata: StrokeAnnotationMetadata, points: import("@/types/annotation").StrokePoint[]) => void
  >(null as unknown as (metadata: StrokeAnnotationMetadata, points: import("@/types/annotation").StrokePoint[]) => void);

  const handleStrokeCommit = useCallback(
    (metadata: StrokeAnnotationMetadata, points: import("@/types/annotation").StrokePoint[]) => {
      void applyOp({ op: "addStroke", payload: metadata, points });
    },
    [applyOp],
  );
  onStrokeCommitRef.current = handleStrokeCommit;

  const handleStrokeDelete = useCallback(
    (annotationId: string) => {
      if (!segmentId) return;
      void applyOp({ op: "deleteStroke", id: annotationId, segmentId });
    },
    [applyOp, segmentId],
  );

  // Setup/teardown StrokeEngine when surface or annotationMode changes
  useEffect(() => {
    if (!canvasRef.current || !surface || !segmentId || !annotationMode) {
      engineRef.current?.destroy();
      engineRef.current = null;
      return;
    }

    const canvas = canvasRef.current;
    const engine = new StrokeEngine(canvas, {
      segmentId,
      surfaceId: surface.id,
      color: activeColor,
      width: activeWidth,
      annotationType: activeAnnotationType === "arrow" ? "arrow" : "stroke",
      onStrokeCommit: (metadata, points) => onStrokeCommitRef.current(metadata, points),
      onStrokeDelete: handleStrokeDelete,
      getNodeBounds: () => {
        const container = containerRef.current;
        if (!container) return [];
        const containerRect = container.getBoundingClientRect();
        const nodes = container.querySelectorAll("[data-node-id]");
        return Array.from(nodes).map((el) => {
          const rect = el.getBoundingClientRect();
          return {
            nodeId: el.getAttribute("data-node-id") ?? "",
            x: rect.left - containerRect.left,
            y: rect.top - containerRect.top,
            width: rect.width,
            height: rect.height,
          };
        });
      },
      getLoadedStrokes: () => {
        const anns = loadedAnnotations.get(surface.id) ?? [];
        return anns.filter((a): a is StrokeAnnotationMetadata => a.type === "stroke" || a.type === "arrow");
      },
      isDeleteMode: () => {
        const { activeAnnotationType: t } = useOutlinerStore.getState();
        return t === "delete";
      },
    });
    engineRef.current = engine;

    // Load stored strokes from OPFS and draw them
    const strokes = (loadedAnnotations.get(surface.id) ?? []).filter(
      (a): a is StrokeAnnotationMetadata => a.type === "stroke" || a.type === "arrow",
    );
    if (strokes.length > 0) {
      Promise.all(
        strokes.map(async (s) => {
          const points = await readStrokeBlob(s.target.segmentId, s.id);
          return points ? { metadata: s, points } : null;
        }),
      ).then((entries) => {
        const valid = entries.filter((e): e is { metadata: StrokeAnnotationMetadata; points: import("@/types/annotation").StrokePoint[] } => e !== null);
        engineRef.current?.loadStoredStrokes(valid);
      }).catch(() => { /* non-fatal */ });
    }

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface?.id, segmentId, annotationMode]);

  // Keep engine options in sync without recreating the engine
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.color = activeColor;
    engine.width = activeWidth;
    engine.annotationType = activeAnnotationType === "arrow" ? "arrow" : "stroke";
  }, [activeColor, activeWidth, activeAnnotationType]);

  // Sync canvas size on resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !annotationMode) return;
    const observer = new ResizeObserver(() => engineRef.current?.syncSize());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [annotationMode]);

  if (thresholdModeActive) return <ThresholdModePanel surfaces={surfaces} onBlockClick={onBlockClick} />;
  if (checkpointModeActive) return <CheckpointModePanel />;
  if (!surface) return <div className="p-6 text-sm text-[var(--color-text-secondary)]">سطحی انتخاب نشده است.</div>;

  const special = renderSurface(surface, onBlockClick);
  const surfaceContent = special ? (
    <div className="outliner-surface-transition">{special}</div>
  ) : (() => {
    const family = familyOfSurface(surface);
    return (
      <div className="outliner-surface-transition">
        {family === "chain" ? (
          <ChainRenderer surface={surface} onBlockClick={onBlockClick} />
        ) : family === "flat" ? (
          <CardGridRenderer surface={surface} onBlockClick={onBlockClick} />
        ) : (
          <DagRenderer surface={surface} onBlockClick={onBlockClick} />
        )}
      </div>
    );
  })();

  return (
    <div ref={containerRef} className="relative">
      {/* Layer 1: Surface content */}
      {surfaceContent}

      {/* Layer 2: Canvas drawing layer — pointer-events controlled by annotationMode */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{
          pointerEvents: annotationMode && activeAnnotationType !== "comment" ? "all" : "none",
          touchAction: "none",
          zIndex: 20,
        }}
      />

      {/* Layer 3: HTML annotation overlay (comment pins, bookmarks, markers) */}
      <div className="absolute inset-0" style={{ zIndex: 25, pointerEvents: "none" }}>
        <div style={{ pointerEvents: "auto" }}>
          <AnnotationOverlay
            surface={surface}
            segmentId={segmentId ?? ""}
            containerRef={containerRef}
          />
        </div>
      </div>

      {/* Annotation toolbar — floating on the left */}
      {annotationMode && (
        <div style={{ zIndex: 35 }}>
          <AnnotationToolbar />
        </div>
      )}
    </div>
  );
}

function ThresholdModePanel({ surfaces, onBlockClick }: { surfaces: AlgorithmSurface[]; onBlockClick?: (blockId: string) => void }) {
  const [query, setQuery] = useState("");
  const setThresholdMode = useOutlinerStore((state) => state.setThresholdMode);
  const groups = surfaces.map((surface) => ({
    surface,
    thresholds: surface.thresholds ?? [],
  })).filter((group) => group.thresholds.length > 0);
  const q = query.trim().toLowerCase();
  return (
    <section className="min-h-[calc(100vh-180px)] bg-[var(--color-bg)] p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold">آستانه‌ها</h2>
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-11 rounded border border-border/70 bg-[var(--color-surface)] px-3 text-sm" placeholder="جستجو در آستانه‌ها..." />
        <button type="button" className="min-h-11 rounded border border-border/70 px-3 text-sm" onClick={() => setThresholdMode(false)}>خروج</button>
      </div>
      <div className="space-y-5">
        {groups.map(({ surface, thresholds }) => {
          const filtered = thresholds.filter((item) => {
            const hay = `${readString(item, ["variable", "metric", "label", "title"]) ?? ""} ${readString(item, ["value", "threshold"]) ?? ""}`.toLowerCase();
            return !q || hay.includes(q);
          });
          if (filtered.length === 0) return null;
          return (
            <section key={surface.id}>
              <h3 className="mb-2 text-sm font-bold">{algorithmDisplayTitle(surface)}</h3>
              <div className="space-y-3">
                {filtered.map((item) => (
                  <article key={item.id} className="rounded-md border border-border/60 bg-[var(--color-node-bg)] p-4">
                    <div className="text-lg font-bold">{readString(item, ["variable", "metric", "label", "title"]) ?? item.id}</div>
                    <div className="mt-2 inline-flex rounded bg-[var(--color-golden)] px-2 py-1 text-sm font-bold text-black">
                      {readString(item, ["value", "threshold"]) ?? "-"}
                    </div>
                    <p className="mt-3 text-sm leading-6">{readString(item, ["conditionText", "condition"]) ?? ""}</p>
                    <div className="mt-3 rounded border border-border/70 p-2 text-sm">
                      <strong>تأثیر تصمیم</strong>
                      <br />
                      {readString(item, ["decisionImpact", "impact", "description"]) ?? "-"}
                    </div>
                    <div className="mt-3 text-xs italic text-muted-foreground">
                      <strong>لنگر حافظه: </strong>{readString(item, ["memoryAnchor"]) ?? "-"}
                    </div>
                    <BlockChips item={item} onBlockClick={onBlockClick} />
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function CheckpointModePanel() {
  const queue = useOutlinerStore((state) => state.checkpointQueue);
  const index = useOutlinerStore((state) => state.checkpointIndex);
  const revealed = useOutlinerStore((state) => state.revealedCheckpoints);
  const revealCheckpoint = useOutlinerStore((state) => state.revealCheckpoint);
  const nextCheckpoint = useOutlinerStore((state) => state.nextCheckpoint);
  const prevCheckpoint = useOutlinerStore((state) => state.prevCheckpoint);
  const setCheckpointMode = useOutlinerStore((state) => state.setCheckpointMode);
  const markSurfaceComplete = useOutlinerStore((state) => state.markSurfaceComplete);
  const completedSurfaceIds = useOutlinerStore((state) => state.completedSurfaceIds);
  const [pointerStart, setPointerStart] = useState<{ x: number; y: number } | null>(null);
  const current = queue[index];
  const total = queue.length;
  const revealedCount = revealed.size;

  useEffect(() => {
    if (!current) return;
    const surfaceItems = queue.filter((item) => item.surfaceId === current.surfaceId);
    if (surfaceItems.length > 0 && !completedSurfaceIds.has(current.surfaceId) && surfaceItems.every((item) => revealed.has(item.id))) {
      markSurfaceComplete(current.surfaceId);
    }
  }, [completedSurfaceIds, current, markSurfaceComplete, queue, revealed]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        prevCheckpoint();
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        nextCheckpoint();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nextCheckpoint, prevCheckpoint]);

  if (!current) {
    return (
      <section className="p-6">
        <button type="button" className="min-h-11 rounded border border-border/70 px-3" onClick={() => setCheckpointMode(false)}>بازگشت</button>
        <p className="mt-4 text-sm text-muted-foreground">چک‌پوینتی برای مرور وجود ندارد.</p>
      </section>
    );
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    if (!pointerStart) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    setPointerStart(null);
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) nextCheckpoint();
    else prevCheckpoint();
  }

  return (
    <section
      className="min-h-[calc(100vh-180px)] p-4"
      onPointerDown={(event) => setPointerStart({ x: event.clientX, y: event.clientY })}
      onPointerUp={onPointerUp}
    >
      <div className="mb-4 h-2 overflow-hidden rounded bg-border/50">
        <div className="h-full bg-[var(--color-endpoint)]" style={{ width: `${total ? (revealedCount / total) * 100 : 0}%` }} />
      </div>
      <article className="mx-auto max-w-2xl rounded-md border border-border/60 bg-[var(--color-node-bg)] p-5">
        <header className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold">{current.surfaceTitle}</h2>
            <p className="text-xs text-muted-foreground">{index + 1} از {total}</p>
          </div>
          <button type="button" className="min-h-11 rounded border border-border/70 px-3 text-sm" onClick={() => setCheckpointMode(false)}>بازگشت</button>
        </header>
        <div className="min-h-32 rounded border border-border/60 bg-background/40 p-4 text-lg font-bold leading-8">
          {readString(current, ["prompt", "check", "label"]) ?? titleOf(current, current.id)}
        </div>
        {revealed.has(current.id) ? (
          <div className="mt-4 rounded border border-amber-400/40 bg-amber-400/10 p-4 text-sm leading-7">
            <div>{readString(current, ["answer"]) ?? "-"}</div>
            <div className="mt-3 text-xs text-muted-foreground">{readString(current, ["whyItMatters"]) ?? ""}</div>
          </div>
        ) : (
          <button type="button" className="mt-4 min-h-11 rounded border border-border/70 px-3 text-sm" onClick={() => revealCheckpoint(current.id)}>
            نمایش پاسخ
          </button>
        )}
        <div className="mt-5 flex justify-between gap-2">
          <button type="button" className="min-h-11 rounded border border-border/70 px-4" onClick={prevCheckpoint}>قبلی</button>
          <button type="button" className="min-h-11 rounded border border-border/70 px-4" onClick={nextCheckpoint}>بعدی</button>
        </div>
      </article>
    </section>
  );
}

function RightRail({
  surface,
  focusedNodeId,
  validationWarnings,
  onCollapse,
}: {
  surface: AlgorithmSurface | null;
  focusedNodeId: string | null;
  validationWarnings: string[];
  onCollapse: () => void;
}) {
  const traps = surface?.boardTraps ?? [];
  const checkpoints = surface?.checkpoints ?? [];
  const mediaRefs = surface?.mediaRefs ?? [];
  const focusedNode = surface?.nodes?.find((node) => node.id === focusedNodeId);
  const stats = surface ? surfaceStats(surface) : null;
  const sourceBase = focusedNode ? [focusedNode] : surface ? listSurfaceObjects(surface) : [];
  const blockIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of sourceBase) {
      for (const id of linkedBlockIds(item)) ids.add(id);
    }
    return [...ids];
  }, [sourceBase]);

  // IR re-import safety: detect annotations whose objectId no longer exists in the current surface.
  // Annotations are kept in CRDT + PGLite — only the warning label changes.
  const loadedAnnotations = useOutlinerStore((state) => state.loadedAnnotations);
  const orphanedAnnotations = useMemo(() => {
    if (!surface) return [];
    const validIds = new Set(listSurfaceObjects(surface).map((obj) => obj.id));
    validIds.add(surface.id); // surface-level annotations target the surfaceId itself
    const surfaceAnns = loadedAnnotations.get(surface.id) ?? [];
    return surfaceAnns.filter((a) => a.target.kind === "node" && !validIds.has(a.target.objectId));
  }, [surface, loadedAnnotations]);

  return (
    <aside className="outliner-inspector bg-[var(--color-surface)] p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold">Details</h2>
          <p className="text-[11px] text-muted-foreground">Selected algorithm</p>
        </div>
        <button type="button" className="min-h-10 rounded-md border border-border/60 px-2 text-[11px]" onClick={onCollapse}>
          Collapse
        </button>
      </div>
      <RailSection title="Summary">
        {!surface ? (
          <Empty />
        ) : (
          <div className="w-full space-y-2 text-xs">
            <div className="rounded-md border border-border/60 bg-background/50 p-2">
              <div className="font-semibold">{algorithmDisplayTitle(surface)}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">{algorithmTypeLabel(surface)}</div>
            </div>
            {focusedNode && (
              <div className="rounded-md border border-primary/30 bg-primary/10 p-2">
                <div className="text-[11px] font-semibold text-muted-foreground">Current step</div>
                <div className="mt-1 font-semibold">{nodeDisplayTitle(focusedNode) ?? "Selected clinical step"}</div>
                {readString(focusedNode, ["detail", "description", "testablePoint"]) && (
                  <p className="mt-1 leading-5 text-muted-foreground">{readString(focusedNode, ["detail", "description", "testablePoint"])}</p>
                )}
              </div>
            )}
            {stats && (
              <div className="grid grid-cols-2 gap-1">
                <MetricChip label="Checkpoints" value={stats.checkpoints} />
                <MetricChip label="Traps" value={stats.traps} />
                <MetricChip label="Gates" value={stats.gates} />
                <MetricChip label="Matrices" value={stats.matrices} />
                <MetricChip label="Thresholds" value={stats.thresholds} />
              </div>
            )}
          </div>
        )}
      </RailSection>
      <h2 className="mb-2 text-sm font-bold">منابع</h2>
      <RailSection title="منابع">
        {blockIds.length === 0 ? <Empty /> : blockIds.map((id, index) => <Chip key={id} title="منبع هنوز وارد نشده">Source {index + 1}</Chip>)}
        <div className="mt-2 w-full rounded border border-dashed border-border/70 p-2 text-xs text-muted-foreground">
          MCQ/فلش‌کارت مرتبط — به زودی
        </div>
      </RailSection>
      <RailSection title="تله‌های مرتبط">
        {traps.length === 0 ? <Empty /> : traps.map((trap) => <RailItem key={trap.id} item={trap} />)}
      </RailSection>
      <RailSection title="چک‌پوینت‌ها">
        {checkpoints.length === 0 ? <Empty /> : checkpoints.map((checkpoint) => <RailItem key={checkpoint.id} item={checkpoint} />)}
      </RailSection>
      <RailSection title="رسانه‌ها">
        {mediaRefs.length === 0 ? <Empty /> : mediaRefs.map((media) => <RailItem key={media.id} item={media} />)}
      </RailSection>
      {/* Orphaned annotations: IR was re-imported and objectId no longer exists.
          Annotations are preserved — only a warning is shown. Never auto-deleted. */}
      {orphanedAnnotations.length > 0 && (
        <RailSection title="حاشیه‌های بدون مرجع">
          {orphanedAnnotations.map((ann) => (
            <div
              key={ann.id}
              className="mb-1 w-full rounded border border-amber-400/50 bg-amber-400/10 p-2 text-xs"
            >
              <div className="font-semibold text-amber-400">شیء مرتبط حذف شده</div>
              <div className="mt-0.5 text-muted-foreground">
                {ann.type} annotation needs review after re-import.
              </div>
            </div>
          ))}
        </RailSection>
      )}
      <RailSection title="اعتبارسنجی">
        {validationWarnings.length === 0 ? <Empty /> : validationWarnings.slice(0, 8).map((warning) => <p key={warning} className="mb-1 text-xs text-amber-400">{warning}</p>)}
      </RailSection>
    </aside>
  );
}

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-md border border-border/60 p-2">
      <h3 className="mb-2 text-xs font-semibold text-[var(--color-text-secondary)]">{title}</h3>
      <div className="flex flex-wrap gap-1">{children}</div>
    </section>
  );
}

function RailItem({ item }: { item: AlgorithmRecord }) {
  return <div className="w-full rounded border border-border/50 p-2 text-xs">{nodeDisplayTitle(item) ?? "Clinical item"}</div>;
}

function MetricChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/50 px-2 py-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-bold tabular-nums">{value}</div>
    </div>
  );
}

function Chip({ children, title }: { children: React.ReactNode; title?: string }) {
  return <span title={title} className="rounded border border-border/70 px-1.5 py-0.5 text-[10px] text-[var(--color-text-secondary)]">{children}</span>;
}

function Empty() {
  return <span className="text-xs text-[var(--color-text-secondary)]">موردی نیست</span>;
}

function BlockChips({ item, onBlockClick }: { item: AlgorithmRecord; onBlockClick?: (blockId: string) => void }) {
  const blocks = linkedBlockIds(item);
  if (blocks.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1">
      {blocks.map((blockId, index) => (
        <button key={blockId} type="button" title="منبع هنوز وارد نشده" onClick={() => onBlockClick?.(blockId)} className="min-h-11 rounded border border-border/70 px-2 text-[10px] text-muted-foreground">
          Source {index + 1}
        </button>
      ))}
    </div>
  );
}

