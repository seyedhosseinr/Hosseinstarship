"use client";

import {
  useCallback, useEffect, useMemo, useRef, useState,
  type PointerEvent, type RefObject, type ReactNode,
} from "react";
import {
  CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  Crosshair, Focus, Keyboard, ListChecks, Maximize2,
  PanelLeftClose, PanelRightClose, RotateCcw, Search, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

// ─── Surface type → colour dot ────────────────────────────────────────────────

const SURFACE_DOT: Record<string, string> = {
  dag:       "bg-blue-500",
  chain:     "bg-violet-500",
  tree:      "bg-sky-500",
  matrix:    "bg-amber-500",
  trap:      "bg-rose-500",
  card_grid: "bg-slate-400",
};

const KEY_HINTS = ["] سطح بعد", "[ سطح قبل", "f فوکوس", "t تله", "h آستانه", "c مرور", "/ جستجو", "a حاشیه", "Esc خروج"];

function resultKindLabel(kind: SearchResult["kind"]): string {
  const map: Record<SearchResult["kind"], string> = {
    surface: "سطح", node: "گره", edge: "ارتباط",
    matrix_row: "ردیف ماتریس", threshold: "آستانه",
    trap: "تله", checkpoint: "چک‌پوینت", blockId: "منبع",
  };
  return map[kind];
}

// ─── Shell ────────────────────────────────────────────────────────────────────

interface OutlinerShellProps {
  segmentId: string;
  ir: AlgorithmIR;
  initialSurfaceId?: string | null;
  validationWarnings?: string[];
  onSurfaceSelect?: (surfaceId: string) => void;
  onBlockClick?: (blockId: string) => void;
  onFocusModeChange?: (active: boolean) => void;
}

export function OutlinerShell({
  segmentId, ir, initialSurfaceId, validationWarnings = [],
  onSurfaceSelect, onBlockClick, onFocusModeChange,
}: OutlinerShellProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const searchCacheRef = useRef<Map<string, SearchResult[]>>(new Map());
  const mainRegionRef = useRef<HTMLDivElement>(null);

  const surfaces             = useOutlinerStore((s) => s.surfaces);
  const selectedSurfaceId    = useOutlinerStore((s) => s.selectedSurfaceId);
  const focusedNodeId        = useOutlinerStore((s) => s.focusedNodeId);
  const trapModeActive       = useOutlinerStore((s) => s.trapModeActive);
  const thresholdModeActive  = useOutlinerStore((s) => s.thresholdModeActive);
  const checkpointModeActive = useOutlinerStore((s) => s.checkpointModeActive);
  const focusPathActive      = useOutlinerStore((s) => s.focusPathActive);
  const searchQuery          = useOutlinerStore((s) => s.searchQuery);
  const searchResults        = useOutlinerStore((s) => s.searchResults);
  const activeSearchIndex    = useOutlinerStore((s) => s.activeSearchIndex);
  const completedSurfaceIds  = useOutlinerStore((s) => s.completedSurfaceIds);
  const setSegment           = useOutlinerStore((s) => s.setSegment);
  const selectSurface        = useOutlinerStore((s) => s.selectSurface);
  const setSearch            = useOutlinerStore((s) => s.setSearch);
  const setSearchResults     = useOutlinerStore((s) => s.setSearchResults);
  const moveSearchCursor     = useOutlinerStore((s) => s.moveSearchCursor);
  const setFocusPath         = useOutlinerStore((s) => s.setFocusPath);
  const activateFocusPath    = useOutlinerStore((s) => s.activateFocusPath);
  const exitFocusPath        = useOutlinerStore((s) => s.exitFocusPath);
  const setTrapMode          = useOutlinerStore((s) => s.setTrapMode);
  const setThresholdMode     = useOutlinerStore((s) => s.setThresholdMode);
  const setCheckpointMode    = useOutlinerStore((s) => s.setCheckpointMode);
  const setCheckpointQueue   = useOutlinerStore((s) => s.setCheckpointQueue);
  const resetFocus           = useOutlinerStore((s) => s.resetFocus);
  const annotationMode       = useOutlinerStore((s) => s.annotationMode);
  const setAnnotationMode    = useOutlinerStore((s) => s.setAnnotationMode);
  const loadAnnotationsForSurface = useOutlinerStore((s) => s.loadAnnotationsForSurface);
  const initCRDTForSegment   = useOutlinerStore((s) => s.initCRDTForSegment);
  const zoomLevel            = useOutlinerStore((s) => s.zoomLevel);
  const setZoom              = useOutlinerStore((s) => s.setZoom);

  const [tocQuery, setTocQuery]                 = useState("");
  const [tocCollapsed, setTocCollapsed]         = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [focusMode, setFocusMode]               = useState(false);

  useEffect(() => {
    setSegment(segmentId, ir.surfaces);
    if (initialSurfaceId && ir.surfaces.some((s) => s.id === initialSurfaceId))
      selectSurface(initialSurfaceId);
  }, [initialSurfaceId, ir.surfaces, segmentId, selectSurface, setSegment]);

  useEffect(() => { setCheckpointQueue(collectCheckpoints(ir.surfaces)); }, [ir.surfaces, setCheckpointQueue]);
  useEffect(() => { searchCacheRef.current.clear(); }, [segmentId]);
  useEffect(() => { void initCRDTForSegment(segmentId); }, [segmentId, initCRDTForSegment]);
  useEffect(() => {
    if (!selectedSurfaceId || !segmentId) return;
    void loadAnnotationsForSurface(segmentId, selectedSurfaceId);
  }, [selectedSurfaceId, segmentId, loadAnnotationsForSurface]);

  useEffect(() => {
    const token = searchQuery.trim().toLowerCase();
    if (token.length < 2) { setSearchResults([]); return; }
    const cached = searchCacheRef.current.get(token);
    if (cached) { setSearchResults(cached); return; }
    const results = buildSearchResults(ir.surfaces, searchQuery);
    searchCacheRef.current.set(token, results);
    setSearchResults(results);
  }, [ir.surfaces, searchQuery, setSearchResults]);

  const visibleSurfaces = useMemo(
    () => trapModeActive ? surfaces.filter(isTrapSurface) : surfaces,
    [trapModeActive, surfaces],
  );
  const selectedSurface = useMemo(
    () => surfaces.find((s) => s.id === selectedSurfaceId) ?? visibleSurfaces[0] ?? null,
    [selectedSurfaceId, surfaces, visibleSurfaces],
  );
  const filteredTocSurfaces = useMemo(() => {
    const q = tocQuery.trim().toLowerCase();
    if (!q) return visibleSurfaces;
    return visibleSurfaces.filter((s, i) => surfaceSearchText(s, i).includes(q));
  }, [tocQuery, visibleSurfaces]);
  const currentTocIndex = useMemo(
    () => filteredTocSurfaces.findIndex((s) => s.id === selectedSurface?.id),
    [filteredTocSurfaces, selectedSurface],
  );

  useEffect(() => { if (selectedSurfaceId) onSurfaceSelect?.(selectedSurfaceId); }, [onSurfaceSelect, selectedSurfaceId]);
  useEffect(() => { onFocusModeChange?.(focusMode); }, [focusMode, onFocusModeChange]);
  useEffect(() => {
    if (trapModeActive && selectedSurface && !isTrapSurface(selectedSurface) && visibleSurfaces[0])
      selectSurface(visibleSurfaces[0].id);
  }, [selectSurface, selectedSurface, trapModeActive, visibleSurfaces]);

  function openSearchResult(result: SearchResult): void {
    selectAlgorithm(result.surfaceId);
    setSearch("");
    const surface = surfaces.find((s) => s.id === result.surfaceId);
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
    const idx = currentTocIndex >= 0 ? currentTocIndex : Math.max(0, list.findIndex((s) => s.id === selectedSurface?.id));
    const next = list[(idx + delta + list.length) % list.length];
    if (next) selectAlgorithm(next.id);
  }
  function centerCurrent(): void {
    const sel = focusedNodeId ? `[data-node-id="${CSS.escape(focusedNodeId)}"]` : null;
    const target = sel ? document.querySelector(sel) : mainRegionRef.current;
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
      const ci = Math.max(0, list.findIndex((s) => s.id === selectedSurface?.id));
      if (event.key === "]") { event.preventDefault(); const n = list[(ci + 1) % list.length]; if (n) selectAlgorithm(n.id); }
      else if (event.key === "[") { event.preventDefault(); const p = list[(ci - 1 + list.length) % list.length]; if (p) selectAlgorithm(p.id); }
      else if (!checkpointModeActive && !thresholdModeActive && event.key === "ArrowRight") { event.preventDefault(); selectRelativeAlgorithm(-1); }
      else if (!checkpointModeActive && !thresholdModeActive && event.key === "ArrowLeft") { event.preventDefault(); selectRelativeAlgorithm(1); }
      else if (event.key.toLowerCase() === "t") { event.preventDefault(); setTrapMode(!trapModeActive); }
      else if (event.key.toLowerCase() === "h") { event.preventDefault(); setThresholdMode(!thresholdModeActive); }
      else if (event.key.toLowerCase() === "c") { event.preventDefault(); setCheckpointMode(!checkpointModeActive); }
      else if (event.key === "/") { event.preventDefault(); searchRef.current?.focus(); }
      else if (event.key === "Escape") { event.preventDefault(); resetFocus(); setThresholdMode(false); setCheckpointMode(false); setSearch(""); }
      else if (event.key.toLowerCase() === "f" && selectedSurface && focusedNodeId) {
        event.preventDefault();
        activateFocusPath(focusedNodeId);
        setFocusPath(computeFocusPath(selectedSurface, focusedNodeId));
      }
      else if (event.key.toLowerCase() === "a") { event.preventDefault(); setAnnotationMode(!annotationMode); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activeSearchIndex, activateFocusPath, annotationMode, checkpointModeActive,
    filteredTocSurfaces, focusedNodeId, moveSearchCursor, resetFocus, searchResults,
    selectSurface, selectedSurface, setAnnotationMode, setCheckpointMode,
    setFocusPath, setSearch, setThresholdMode, setTrapMode, surfaces,
    thresholdModeActive, trapModeActive, visibleSurfaces,
  ]);

  const completedCount         = completedSurfaceIds.size;
  const totalCount             = surfaces.length;
  const chapter                = useMemo(() => chapterDisplayFromIR(segmentId, ir), [ir, segmentId]);
  const surfaceTitleById        = useMemo(() => new Map(surfaces.map((s, i) => [s.id, algorithmDisplayTitle(s, i)])), [surfaces]);
  const selectedAlgorithmTitle  = selectedSurface ? surfaceTitleById.get(selectedSurface.id) ?? algorithmDisplayTitle(selectedSurface) : "Clinical pathway";
  const selectedNode            = selectedSurface?.nodes?.find((n) => n.id === focusedNodeId) ?? null;
  const selectedStepTitle       = nodeDisplayTitle(selectedNode ?? undefined) ?? null;

  const gridClassName = focusMode ? "grid-cols-1"
    : !tocCollapsed && !inspectorCollapsed ? "lg:grid-cols-[272px_minmax(0,1fr)_280px]"
    : tocCollapsed && !inspectorCollapsed  ? "lg:grid-cols-[minmax(0,1fr)_280px]"
    : !tocCollapsed && inspectorCollapsed  ? "lg:grid-cols-[272px_minmax(0,1fr)]"
    : "lg:grid-cols-[minmax(0,1fr)]";

  return (
    <div className="outliner-shell min-h-[calc(100vh-32px)] bg-background text-foreground">
      <div className={cn("grid min-h-[calc(100vh-32px)] grid-cols-1", gridClassName)}>

        {/* ── Left rail ── */}
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

        {/* ── Main area ── */}
        <div ref={mainRegionRef} tabIndex={-1} className="min-w-0 border-x border-border/40 outline-none">
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
              onToggleToc={() => setTocCollapsed((v) => !v)}
              onToggleInspector={() => setInspectorCollapsed((v) => !v)}
              onFocusMode={() => setFocusMode(true)}
            />
          )}
          <MainCanvas surface={selectedSurface} surfaces={surfaces} onBlockClick={onBlockClick} segmentId={segmentId} />
        </div>

        {/* ── Right rail ── */}
        {!focusMode && !inspectorCollapsed && (
          <RightRail
            surface={selectedSurface}
            focusedNodeId={focusedNodeId}
            validationWarnings={validationWarnings}
            onCollapse={() => setInspectorCollapsed(true)}
          />
        )}
      </div>

      {/* Focus-mode restore button */}
      {focusMode && (
        <button
          type="button"
          className="fixed left-4 top-4 z-50 flex items-center gap-2 rounded-xl border border-border/60 bg-background/95 px-3 py-2 text-[12px] font-semibold shadow-lg backdrop-blur"
          onClick={() => setFocusMode(false)}
        >
          <PanelLeftClose className="h-4 w-4" />
          بازگشت به پانل‌ها
        </button>
      )}
      <CRDTStatusBar segmentId={segmentId} />
    </div>
  );
}

// ─── Left Rail ────────────────────────────────────────────────────────────────

function LeftRail({
  surfaces, allSurfaceCount, selectedSurfaceId, currentIndex,
  onSelect, onPrevious, onNext, segmentId, chapterLabel,
  tocQuery, setTocQuery, onCollapse,
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
  setTocQuery: (v: string) => void;
  onCollapse: () => void;
}) {
  const completedSurfaceIds    = useOutlinerStore((s) => s.completedSurfaceIds);
  const surfaceTrail           = useOutlinerStore((s) => s.surfaceTrail);
  const allSurfaces            = useOutlinerStore((s) => s.surfaces);
  const markSurfaceComplete    = useOutlinerStore((s) => s.markSurfaceComplete);
  const resetCompletedForSegment = useOutlinerStore((s) => s.resetCompletedForSegment);
  const [openTrail, setOpenTrail] = useState(true);

  const completedCount = completedSurfaceIds.size;
  const totalCount     = allSurfaces.length;
  const progress       = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <aside className="flex h-[calc(100vh-32px)] flex-col overflow-hidden border-r border-border/40 bg-background/98">

      {/* Header */}
      <div className="shrink-0 px-3 pt-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <ListChecks className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="truncate text-[12px] font-semibold">الگوریتم‌ها</span>
          </div>
          <IconBtn onClick={onCollapse} label="بستن فهرست">
            <PanelLeftClose className="h-4 w-4" />
          </IconBtn>
        </div>
        <p className="mt-1 truncate text-[10px] text-muted-foreground" dir="rtl" lang="fa">{chapterLabel}</p>
        {/* Progress */}
        <div className="mt-2.5">
          <div className="mb-1 flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">پیشرفت</span>
            <span className="font-semibold tabular-nums">{completedCount} / {totalCount}</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-muted/60">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="shrink-0 px-2.5 pb-2.5">
        <label className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/40 px-2.5 py-1.5 transition focus-within:border-primary/40 focus-within:bg-background">
          <Search className="h-3 w-3 shrink-0 text-muted-foreground" />
          <input
            value={tocQuery}
            onChange={(e) => setTocQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-muted-foreground/50"
            placeholder="جستجو..."
          />
          {tocQuery && (
            <button type="button" onClick={() => setTocQuery("")} className="text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </label>
        {tocQuery.trim() && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            {surfaces.length} نتیجه از {allSurfaceCount}
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="shrink-0 flex items-center justify-between border-y border-border/40 px-2.5 py-1">
        <button type="button" onClick={onPrevious} disabled={surfaces.length === 0}
          className="flex items-center gap-0.5 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"
          dir="rtl">
          <ChevronRight className="h-3.5 w-3.5" /> قبلی
        </button>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {currentIndex >= 0 ? `${currentIndex + 1} / ${surfaces.length}` : `— / ${surfaces.length}`}
        </span>
        <button type="button" onClick={onNext} disabled={surfaces.length === 0}
          className="flex items-center gap-0.5 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"
          dir="rtl">
          بعدی <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* TOC list */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Algorithm table of contents">
        {surfaces.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/50 px-3 py-5 text-center">
            <p className="text-[11px] text-muted-foreground">نتیجه‌ای یافت نشد.</p>
          </div>
        )}
        {surfaces.map((surface, index) => {
          const selected  = surface.id === selectedSurfaceId;
          const complete  = completedSurfaceIds.has(surface.id);
          const stats     = surfaceStats(surface);
          const shape     = (surface.algorithmShape ?? surface.surfaceType ?? "").toLowerCase();
          const dotColor  = SURFACE_DOT[shape] ?? "bg-slate-400";

          return (
            <button
              key={surface.id}
              type="button"
              onClick={() => onSelect(surface.id)}
              className={cn(
                "group w-full rounded-xl px-2.5 py-2 text-right transition-all duration-100",
                selected
                  ? "bg-primary/10 text-foreground shadow-[inset_2.5px_0_0_hsl(var(--primary))]"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              <div className="flex items-center gap-2">
                <div className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotColor)} />
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium leading-snug" dir="rtl" lang="fa">
                  {algorithmDisplayTitle(surface, index)}
                </span>
                {complete && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
              </div>
              {(stats.checkpoints > 0 || stats.traps > 0 || stats.gates > 0) && (
                <div className="mt-0.5 flex gap-3 pl-3.5 text-[9px] text-muted-foreground">
                  {stats.checkpoints > 0 && <span>{stats.checkpoints} ✓</span>}
                  {stats.traps      > 0 && <span className="text-rose-400">{stats.traps} ⚠</span>}
                  {stats.gates      > 0 && <span>{stats.gates} ◆</span>}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Study trail */}
      <div className="shrink-0 border-t border-border/40">
        <button
          type="button"
          onClick={() => setOpenTrail(!openTrail)}
          className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <span>مسیر مطالعه</span>
          <div className="flex items-center gap-1.5">
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); resetCompletedForSegment(); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); resetCompletedForSegment(); } }}
              className="rounded px-1.5 py-0.5 text-[9px] hover:bg-muted hover:text-foreground"
            >
              شروع مجدد
            </span>
            <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", openTrail && "rotate-180")} />
          </div>
        </button>
        {openTrail && (
          <div className="max-h-36 overflow-y-auto px-2 pb-2 space-y-1">
            {surfaceTrail.length === 0 && (
              <p className="px-1 text-[10px] text-muted-foreground">هنوز الگوریتمی مرور نشده.</p>
            )}
            {surfaceTrail.map((surfaceId) => {
              const surface = allSurfaces.find((s) => s.id === surfaceId);
              if (!surface) return null;
              return (
                <div key={`${segmentId}-${surfaceId}`} className="flex items-center gap-2 rounded-lg border border-border/40 px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={completedSurfaceIds.has(surfaceId)}
                    onChange={() => markSurfaceComplete(surfaceId)}
                    className="h-3.5 w-3.5 shrink-0 accent-primary"
                  />
                  <button type="button" className="min-w-0 flex-1 text-right" onClick={() => onSelect(surfaceId)}>
                    <span className="block truncate text-[11px] font-medium" dir="rtl" lang="fa">
                      {algorithmDisplayTitle(surface)}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────

function TopBar({
  chapterLabel, chapterTitle, algorithmTitle, stepTitle,
  searchRef, searchQuery, setSearch, searchResults, activeSearchIndex, openSearchResult,
  surfaceTitleById, trapModeActive, setTrapMode, thresholdModeActive, setThresholdMode,
  checkpointModeActive, setCheckpointMode, focusPathActive, exitFocusPath,
  completedCount, totalCount, currentIndex, visibleCount, zoomLevel,
  onPrevious, onNext, onCenterCurrent, onFitGraph, onResetZoom,
  tocCollapsed, inspectorCollapsed, onToggleToc, onToggleInspector, onFocusMode,
}: {
  chapterLabel: string; chapterTitle: string; algorithmTitle: string; stepTitle: string | null;
  searchRef: RefObject<HTMLInputElement | null>; searchQuery: string; setSearch: (v: string) => void;
  searchResults: SearchResult[]; activeSearchIndex: number; openSearchResult: (r: SearchResult) => void;
  surfaceTitleById: Map<string, string>; trapModeActive: boolean; setTrapMode: (v: boolean) => void;
  thresholdModeActive: boolean; setThresholdMode: (v: boolean) => void;
  checkpointModeActive: boolean; setCheckpointMode: (v: boolean) => void;
  focusPathActive: boolean; exitFocusPath: () => void;
  completedCount: number; totalCount: number; currentIndex: number; visibleCount: number; zoomLevel: number;
  onPrevious: () => void; onNext: () => void; onCenterCurrent: () => void;
  onFitGraph: () => void; onResetZoom: () => void;
  tocCollapsed: boolean; inspectorCollapsed: boolean;
  onToggleToc: () => void; onToggleInspector: () => void; onFocusMode: () => void;
}) {
  const [showHints, setShowHints] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur-sm">

      {/* ── Row 1: breadcrumb + search + panel toggles ── */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Breadcrumb */}
        <nav className="flex min-w-0 flex-1 items-center gap-1 text-[11px]" aria-label="Breadcrumb">
          <span className="truncate text-muted-foreground">{chapterLabel}</span>
          <ChevronRight className="h-3 w-3 shrink-0 text-border" />
          <span className="truncate font-semibold text-foreground">{algorithmTitle}</span>
          {stepTitle && (
            <>
              <ChevronRight className="h-3 w-3 shrink-0 text-border" />
              <span className="truncate text-foreground/70">{stepTitle}</span>
            </>
          )}
        </nav>

        {/* Search */}
        <div className="relative">
          <label className="flex w-48 items-center gap-2 rounded-xl border border-border/50 bg-muted/40 px-2.5 py-1.5 transition focus-within:border-primary/50 focus-within:bg-background">
            <Search className="h-3 w-3 shrink-0 text-muted-foreground" />
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-[11px] outline-none placeholder:text-muted-foreground/50"
              placeholder="جستجو..."
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </label>
          {searchResults.length > 0 && (
            <SearchResults
              results={searchResults}
              activeIndex={activeSearchIndex}
              openSearchResult={openSearchResult}
              surfaceTitleById={surfaceTitleById}
            />
          )}
        </div>

        {/* Panel + utility controls */}
        <div className="flex items-center gap-0.5">
          <IconBtn onClick={onToggleToc} label={tocCollapsed ? "نمایش فهرست" : "پنهان کردن فهرست"}>
            <PanelLeftClose className={cn("h-4 w-4 transition-opacity", tocCollapsed && "opacity-40")} />
          </IconBtn>
          <IconBtn onClick={onToggleInspector} label={inspectorCollapsed ? "نمایش جزئیات" : "پنهان کردن جزئیات"}>
            <PanelRightClose className={cn("h-4 w-4 transition-opacity", inspectorCollapsed && "opacity-40")} />
          </IconBtn>
          <IconBtn onClick={onFocusMode} label="تمرکز کامل">
            <Maximize2 className="h-4 w-4 text-primary" />
          </IconBtn>
          <IconBtn onClick={() => setShowHints(!showHints)} label="کلیدهای میانبر">
            <Keyboard className={cn("h-4 w-4", showHints && "text-primary")} />
          </IconBtn>
        </div>
      </div>

      {/* ── Row 2: mode chips + navigation + view controls ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/30 px-3 py-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <ModeChip active={trapModeActive} onClick={() => setTrapMode(!trapModeActive)} color="rose">
            ⚠ تله‌ها
          </ModeChip>
          <ModeChip active={thresholdModeActive} onClick={() => setThresholdMode(!thresholdModeActive)} color="amber">
            ◎ آستانه‌ها
          </ModeChip>
          <ModeChip active={checkpointModeActive} onClick={() => setCheckpointMode(!checkpointModeActive)} color="emerald">
            ✓ مرور سریع
          </ModeChip>
          {focusPathActive && (
            <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
              <Focus className="h-3 w-3" />
              <span>فوکوس فعال</span>
              <button type="button" onClick={exitFocusPath} className="hover:opacity-70">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {/* Navigation */}
          <button type="button" onClick={onPrevious} disabled={visibleCount === 0}
            className="flex items-center gap-1 rounded-lg border border-border/50 px-2.5 py-1 text-[11px] transition hover:bg-muted disabled:opacity-30"
            dir="rtl">
            <ChevronRight className="h-3.5 w-3.5" /> قبلی
          </button>
          <span className="min-w-[4.5rem] rounded-lg border border-border/40 bg-muted/30 px-2 py-1 text-center text-[10px] text-muted-foreground tabular-nums">
            {currentIndex >= 0 ? `${currentIndex + 1} / ${visibleCount}` : `— / ${visibleCount}`}
          </span>
          <button type="button" onClick={onNext} disabled={visibleCount === 0}
            className="flex items-center gap-1 rounded-lg border border-border/50 px-2.5 py-1 text-[11px] transition hover:bg-muted disabled:opacity-30"
            dir="rtl">
            بعدی <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          <div className="mx-0.5 h-4 w-px bg-border/50" />

          {/* View controls */}
          <button type="button" onClick={onCenterCurrent}
            className="flex items-center gap-1 rounded-lg border border-border/50 px-2.5 py-1 text-[11px] transition hover:bg-muted">
            <Crosshair className="h-3 w-3" /> مرکز
          </button>
          <button type="button" onClick={onFitGraph}
            className="rounded-lg border border-border/50 px-2.5 py-1 text-[11px] transition hover:bg-muted">
            جا بگیر
          </button>
          <button type="button" onClick={onResetZoom}
            className="flex items-center gap-1 rounded-lg border border-border/50 px-2 py-1 text-[10px] text-muted-foreground transition hover:bg-muted hover:text-foreground">
            <RotateCcw className="h-3 w-3" />
            {Math.round(zoomLevel * 100)}%
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-[2px] bg-muted/40">
        <div
          className="h-full bg-primary/50 transition-all duration-500"
          style={{ width: totalCount ? `${(completedCount / totalCount) * 100}%` : "0%" }}
        />
      </div>

      {/* Key hints (collapsible) */}
      {showHints && (
        <div className="flex flex-wrap gap-1 border-t border-border/30 bg-muted/20 px-3 py-2">
          {KEY_HINTS.map((hint) => (
            <kbd key={hint} className="rounded border border-border/50 bg-background px-1.5 py-0.5 text-[9px] text-muted-foreground">
              {hint}
            </kbd>
          ))}
        </div>
      )}
    </header>
  );
}

// ─── Compact Focus Bar ────────────────────────────────────────────────────────

function CompactFocusBar({
  chapterLabel, algorithmTitle, stepTitle, onRestore,
}: { chapterLabel: string; algorithmTitle: string; stepTitle: string | null; onRestore: () => void }) {
  return (
    <div className="sticky top-0 z-30 flex min-h-11 items-center justify-between gap-3 border-b border-border/40 bg-background/95 px-3 backdrop-blur-sm">
      <nav className="flex min-w-0 items-center gap-1 text-[11px]">
        <span className="truncate text-muted-foreground">{chapterLabel}</span>
        <ChevronRight className="h-3 w-3 shrink-0 text-border" />
        <span className="truncate font-semibold text-foreground">{algorithmTitle}</span>
        {stepTitle && (
          <>
            <ChevronRight className="h-3 w-3 shrink-0 text-border" />
            <span className="truncate text-foreground/70">{stepTitle}</span>
          </>
        )}
      </nav>
      <button type="button" onClick={onRestore}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-[11px] font-semibold transition hover:bg-muted">
        <PanelLeftClose className="h-3.5 w-3.5" /> بازگشت
      </button>
    </div>
  );
}

// ─── Search Results ───────────────────────────────────────────────────────────

function SearchResults({
  results, activeIndex, openSearchResult, surfaceTitleById,
}: {
  results: SearchResult[]; activeIndex: number;
  openSearchResult: (r: SearchResult) => void;
  surfaceTitleById: Map<string, string>;
}) {
  const groups = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    acc[r.kind] = acc[r.kind] ?? [];
    acc[r.kind].push(r);
    return acc;
  }, {});
  let abs = -1;

  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-80 overflow-auto rounded-xl border border-border/60 bg-background shadow-xl ring-1 ring-black/5">
      <div className="p-1.5">
        {Object.entries(groups).map(([kind, items]) => (
          <section key={kind} className="mb-1 last:mb-0">
            <h3 className="mb-0.5 px-2 pt-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70">
              {resultKindLabel(kind as SearchResult["kind"])}
            </h3>
            {items.map((result) => {
              abs += 1;
              const active = abs === activeIndex;
              return (
                <button
                  key={`${result.kind}-${result.surfaceId}-${result.objectId}-${abs}`}
                  type="button"
                  className={cn(
                    "w-full rounded-lg px-2.5 py-1.5 text-right text-[11px] transition",
                    active ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                  onClick={() => openSearchResult(result)}
                >
                  <div className="font-semibold">{surfaceTitleById.get(result.surfaceId) ?? result.surfaceTitle}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {result.kind === "blockId" ? "Source match" : `${result.matchField}: ${result.matchText}`}
                  </div>
                </button>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}

// ─── Main Canvas ──────────────────────────────────────────────────────────────

function MainCanvas({
  surface, surfaces, onBlockClick, segmentId,
}: {
  surface: AlgorithmSurface | null;
  surfaces: AlgorithmSurface[];
  onBlockClick?: (blockId: string) => void;
  segmentId: string | null;
}) {
  const thresholdModeActive  = useOutlinerStore((s) => s.thresholdModeActive);
  const checkpointModeActive = useOutlinerStore((s) => s.checkpointModeActive);
  const annotationMode       = useOutlinerStore((s) => s.annotationMode);
  const activeAnnotationType = useOutlinerStore((s) => s.activeAnnotationType);
  const activeColor          = useOutlinerStore((s) => s.activeColor);
  const activeWidth          = useOutlinerStore((s) => s.activeWidth);
  const loadedAnnotations    = useOutlinerStore((s) => s.loadedAnnotations);
  const applyOp              = useOutlinerStore((s) => s.applyOp);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const engineRef    = useRef<StrokeEngine | null>(null);

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
    return () => { engine.destroy(); engineRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface?.id, segmentId, annotationMode]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.color = activeColor;
    engine.width = activeWidth;
    engine.annotationType = activeAnnotationType === "arrow" ? "arrow" : "stroke";
  }, [activeColor, activeWidth, activeAnnotationType]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !annotationMode) return;
    const observer = new ResizeObserver(() => engineRef.current?.syncSize());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [annotationMode]);

  if (thresholdModeActive)  return <ThresholdModePanel surfaces={surfaces} onBlockClick={onBlockClick} />;
  if (checkpointModeActive) return <CheckpointModePanel />;
  if (!surface) return (
    <div className="flex min-h-[60vh] items-center justify-center p-8 text-sm text-muted-foreground">
      الگوریتمی از فهرست سمت چپ انتخاب کنید.
    </div>
  );

  const special = renderSurface(surface, onBlockClick);
  const surfaceContent = special ? (
    <div className="outliner-surface-transition">{special}</div>
  ) : (() => {
    const family = familyOfSurface(surface);
    return (
      <div className="outliner-surface-transition">
        {family === "chain" ? <ChainRenderer surface={surface} onBlockClick={onBlockClick} />
          : family === "flat" ? <CardGridRenderer surface={surface} onBlockClick={onBlockClick} />
          : <DagRenderer surface={surface} onBlockClick={onBlockClick} />}
      </div>
    );
  })();

  return (
    <div ref={containerRef} className="relative">
      {surfaceContent}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{
          pointerEvents: annotationMode && activeAnnotationType !== "comment" ? "all" : "none",
          touchAction: "none",
          zIndex: 20,
        }}
      />
      <div className="absolute inset-0" style={{ zIndex: 25, pointerEvents: "none" }}>
        <div style={{ pointerEvents: "auto" }}>
          <AnnotationOverlay surface={surface} segmentId={segmentId ?? ""} containerRef={containerRef} />
        </div>
      </div>
      {annotationMode && (
        <div style={{ zIndex: 35 }}>
          <AnnotationToolbar />
        </div>
      )}
    </div>
  );
}

// ─── Threshold Mode Panel ─────────────────────────────────────────────────────

function ThresholdModePanel({
  surfaces, onBlockClick,
}: { surfaces: AlgorithmSurface[]; onBlockClick?: (blockId: string) => void }) {
  const [query, setQuery] = useState("");
  const setThresholdMode = useOutlinerStore((s) => s.setThresholdMode);
  const groups = surfaces
    .map((s) => ({ surface: s, thresholds: s.thresholds ?? [] }))
    .filter((g) => g.thresholds.length > 0);
  const q = query.trim().toLowerCase();

  return (
    <section className="min-h-[calc(100vh-180px)] bg-background p-5">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <h2 className="text-[18px] font-bold" dir="rtl" lang="fa">آستانه‌های کلیدی</h2>
          <div className="flex-1" />
          <label className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 transition focus-within:border-primary/50 focus-within:bg-background">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-40 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground/50"
              placeholder="جستجو..."
            />
          </label>
          <button type="button" onClick={() => setThresholdMode(false)}
            className="flex items-center gap-1.5 rounded-xl border border-border/60 px-4 py-2 text-[12px] transition hover:bg-muted">
            <X className="h-4 w-4" /> خروج
          </button>
        </div>

        {/* Groups */}
        <div className="space-y-8">
          {groups.map(({ surface, thresholds }) => {
            const filtered = thresholds.filter((item) => {
              const hay = `${readString(item, ["variable", "metric", "label", "title"]) ?? ""} ${readString(item, ["value", "threshold"]) ?? ""}`.toLowerCase();
              return !q || hay.includes(q);
            });
            if (filtered.length === 0) return null;
            return (
              <section key={surface.id}>
                <h3 className="mb-3 text-[13px] font-bold text-foreground" dir="rtl" lang="fa">
                  {algorithmDisplayTitle(surface)}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((item) => (
                    <article key={item.id}
                      className="overflow-hidden rounded-2xl border border-amber-400/30 bg-amber-50/50 shadow-sm dark:bg-amber-950/20">
                      <div className="h-[3px] bg-amber-500/70" />
                      <div className="p-4">
                        <p className="text-[13px] font-semibold text-foreground" dir="rtl" lang="fa">
                          {readString(item, ["variable", "metric", "label", "title"]) ?? item.id}
                        </p>
                        <div className="mt-2 inline-flex items-baseline gap-1 rounded-xl bg-amber-500/12 px-3 py-1.5">
                          <span className="text-[24px] font-black leading-none text-amber-600 tabular-nums dark:text-amber-400">
                            {readString(item, ["value", "threshold"]) ?? "—"}
                          </span>
                        </div>
                        {readString(item, ["conditionText", "condition"]) && (
                          <p className="mt-2 text-[11px] leading-5 text-muted-foreground" dir="rtl" lang="fa">
                            {readString(item, ["conditionText", "condition"])}
                          </p>
                        )}
                        {readString(item, ["decisionImpact", "impact", "description"]) && (
                          <div className="mt-2.5 rounded-xl border border-border/40 bg-background/70 p-2.5 text-[11px]" dir="rtl">
                            <span className="font-semibold text-foreground">تأثیر: </span>
                            <span className="text-muted-foreground">{readString(item, ["decisionImpact", "impact", "description"])}</span>
                          </div>
                        )}
                        {readString(item, ["memoryAnchor"]) && (
                          <p className="mt-2 text-[10px] italic text-muted-foreground/70" dir="rtl">
                            💡 {readString(item, ["memoryAnchor"])}
                          </p>
                        )}
                        <BlockChips item={item} onBlockClick={onBlockClick} />
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Checkpoint Mode Panel ────────────────────────────────────────────────────

function CheckpointModePanel() {
  const queue              = useOutlinerStore((s) => s.checkpointQueue);
  const index              = useOutlinerStore((s) => s.checkpointIndex);
  const revealed           = useOutlinerStore((s) => s.revealedCheckpoints);
  const revealCheckpoint   = useOutlinerStore((s) => s.revealCheckpoint);
  const nextCheckpoint     = useOutlinerStore((s) => s.nextCheckpoint);
  const prevCheckpoint     = useOutlinerStore((s) => s.prevCheckpoint);
  const setCheckpointMode  = useOutlinerStore((s) => s.setCheckpointMode);
  const markSurfaceComplete = useOutlinerStore((s) => s.markSurfaceComplete);
  const completedSurfaceIds = useOutlinerStore((s) => s.completedSurfaceIds);
  const [pointerStart, setPointerStart] = useState<{ x: number; y: number } | null>(null);

  const current      = queue[index];
  const total        = queue.length;
  const revealedCount = revealed.size;

  useEffect(() => {
    if (!current) return;
    const surfaceItems = queue.filter((item) => item.surfaceId === current.surfaceId);
    if (surfaceItems.length > 0 && !completedSurfaceIds.has(current.surfaceId) && surfaceItems.every((item) => revealed.has(item.id)))
      markSurfaceComplete(current.surfaceId);
  }, [completedSurfaceIds, current, markSurfaceComplete, queue, revealed]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") { event.preventDefault(); prevCheckpoint(); }
      if (event.key === "ArrowLeft")  { event.preventDefault(); nextCheckpoint(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nextCheckpoint, prevCheckpoint]);

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    if (!pointerStart) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    setPointerStart(null);
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) nextCheckpoint(); else prevCheckpoint();
  }

  if (!current) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-[13px] text-muted-foreground">چک‌پوینتی برای مرور وجود ندارد.</p>
        <button type="button" onClick={() => setCheckpointMode(false)}
          className="rounded-xl border border-border/60 px-5 py-2 text-[12px] hover:bg-muted">
          بازگشت
        </button>
      </div>
    );
  }

  return (
    <section
      className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center bg-background p-5"
      onPointerDown={(e) => setPointerStart({ x: e.clientX, y: e.clientY })}
      onPointerUp={onPointerUp}
    >
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="mb-5">
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="font-semibold text-muted-foreground">مرور سریع</span>
            <span className="text-muted-foreground tabular-nums">{index + 1} از {total}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
            <div className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${total ? (revealedCount / total) * 100 : 0}%` }} />
          </div>
        </div>

        {/* Card header */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="truncate text-[11px] text-muted-foreground" dir="rtl" lang="fa">{current.surfaceTitle}</span>
          <button type="button" onClick={() => setCheckpointMode(false)}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1 text-[11px] hover:bg-muted">
            <X className="h-3.5 w-3.5" /> خروج
          </button>
        </div>

        {/* Flashcard */}
        <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-md">
          {/* Question */}
          <div className="min-h-[140px] p-6">
            <p className="text-[16px] font-bold leading-8 text-foreground" dir="rtl" lang="fa">
              {readString(current, ["prompt", "check", "label"]) ?? titleOf(current, current.id)}
            </p>
          </div>

          {/* Answer */}
          {revealed.has(current.id) ? (
            <div className="border-t border-border/40 bg-amber-50/60 p-5 dark:bg-amber-950/20">
              <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">پاسخ</p>
              <p className="text-[13px] leading-7 text-foreground" dir="rtl" lang="fa">
                {readString(current, ["answer"]) ?? "—"}
              </p>
              {readString(current, ["whyItMatters"]) && (
                <p className="mt-2 text-[11px] italic text-muted-foreground" dir="rtl" lang="fa">
                  {readString(current, ["whyItMatters"])}
                </p>
              )}
            </div>
          ) : (
            <div className="border-t border-border/30 bg-muted/20 px-5 py-4 text-center">
              <button type="button" onClick={() => revealCheckpoint(current.id)}
                className="rounded-xl bg-primary px-8 py-2.5 text-[12px] font-semibold text-primary-foreground transition hover:bg-primary/90">
                نمایش پاسخ
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={prevCheckpoint}
            className="flex items-center gap-1.5 rounded-xl border border-border/60 px-4 py-2.5 text-[12px] transition hover:bg-muted">
            <ChevronRight className="h-4 w-4" /> قبلی
          </button>
          <span className="text-[10px] text-muted-foreground">{revealedCount} / {total} نمایش</span>
          <button type="button" onClick={nextCheckpoint}
            className="flex items-center gap-1.5 rounded-xl border border-border/60 px-4 py-2.5 text-[12px] transition hover:bg-muted">
            بعدی <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Swipe hint */}
        <p className="mt-3 text-center text-[9px] text-muted-foreground/50">← بکشید برای تغییر →</p>
      </div>
    </section>
  );
}

// ─── Right Rail ───────────────────────────────────────────────────────────────

function RightRail({
  surface, focusedNodeId, validationWarnings, onCollapse,
}: {
  surface: AlgorithmSurface | null;
  focusedNodeId: string | null;
  validationWarnings: string[];
  onCollapse: () => void;
}) {
  const loadedAnnotations = useOutlinerStore((s) => s.loadedAnnotations);
  const traps       = surface?.boardTraps ?? [];
  const checkpoints = surface?.checkpoints ?? [];
  const mediaRefs   = surface?.mediaRefs ?? [];
  const focusedNode = surface?.nodes?.find((n) => n.id === focusedNodeId);
  const stats       = surface ? surfaceStats(surface) : null;
  const sourceBase  = focusedNode ? [focusedNode] : surface ? listSurfaceObjects(surface) : [];
  const blockIds    = useMemo(() => {
    const ids = new Set<string>();
    for (const item of sourceBase) for (const id of linkedBlockIds(item)) ids.add(id);
    return [...ids];
  }, [sourceBase]);

  const orphanedAnnotations = useMemo(() => {
    if (!surface) return [];
    const validIds = new Set(listSurfaceObjects(surface).map((o) => o.id));
    validIds.add(surface.id);
    const anns = loadedAnnotations.get(surface.id) ?? [];
    return anns.filter((a) => a.target.kind === "node" && !validIds.has(a.target.objectId));
  }, [surface, loadedAnnotations]);

  return (
    <aside className="flex h-[calc(100vh-32px)] flex-col overflow-hidden border-l border-border/40 bg-background/98">

      {/* Header */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-3 border-b border-border/40">
        <div>
          <h2 className="text-[12px] font-semibold">جزئیات</h2>
          <p className="text-[10px] text-muted-foreground truncate" dir="rtl" lang="fa">
            {surface ? algorithmDisplayTitle(surface) : "الگوریتمی انتخاب نشده"}
          </p>
        </div>
        <IconBtn onClick={onCollapse} label="بستن پانل جزئیات">
          <PanelRightClose className="h-4 w-4" />
        </IconBtn>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">

        {/* Algorithm summary card */}
        {surface && (
          <div className="rounded-xl border border-border/50 bg-card p-3 shadow-sm">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              {algorithmTypeLabel(surface)}
            </p>
            <p className="mt-1 text-[13px] font-semibold leading-snug text-foreground" dir="rtl" lang="fa">
              {algorithmDisplayTitle(surface)}
            </p>
            {stats && (
              <div className="mt-2.5 flex flex-wrap gap-1">
                {stats.checkpoints > 0 && <StatBadge label="Checkpoints" value={stats.checkpoints} />}
                {stats.traps       > 0 && <StatBadge label="Traps"       value={stats.traps}       color="rose"   />}
                {stats.gates       > 0 && <StatBadge label="Gates"       value={stats.gates}       />}
                {stats.matrices    > 0 && <StatBadge label="Matrices"    value={stats.matrices}    />}
                {stats.thresholds  > 0 && <StatBadge label="Thresholds"  value={stats.thresholds}  color="amber"  />}
              </div>
            )}
          </div>
        )}

        {/* Focused node */}
        {focusedNode && (
          <div className="overflow-hidden rounded-xl border border-primary/30 bg-primary/8">
            <div className="h-[2px] bg-primary/50" />
            <div className="p-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-primary">گام انتخابی</p>
              <p className="mt-1 text-[13px] font-semibold leading-snug text-foreground" dir="rtl" lang="fa">
                {nodeDisplayTitle(focusedNode) ?? "Clinical step"}
              </p>
              {readString(focusedNode, ["detail", "description", "testablePoint"]) && (
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground" dir="rtl" lang="fa">
                  {readString(focusedNode, ["detail", "description", "testablePoint"])}
                </p>
              )}
            </div>
          </div>
        )}

        {!surface && (
          <div className="rounded-xl border border-dashed border-border/50 p-5 text-center">
            <p className="text-[12px] text-muted-foreground">الگوریتمی انتخاب نشده است.</p>
          </div>
        )}

        {/* Collapsible sections */}
        {traps.length > 0 && (
          <CollapsibleSection title="تله‌ها" count={traps.length} icon="⚠" iconColor="text-rose-500">
            {traps.map((trap) => <RailItem key={trap.id} item={trap} />)}
          </CollapsibleSection>
        )}
        {checkpoints.length > 0 && (
          <CollapsibleSection title="چک‌پوینت‌ها" count={checkpoints.length} icon="✓" iconColor="text-emerald-500">
            {checkpoints.map((cp) => <RailItem key={cp.id} item={cp} />)}
          </CollapsibleSection>
        )}
        {blockIds.length > 0 && (
          <CollapsibleSection title="منابع" count={blockIds.length} icon="📎">
            <div className="flex flex-wrap gap-1">
              {blockIds.map((id, i) => (
                <span key={id} className="rounded-lg border border-border/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                  منبع {i + 1}
                </span>
              ))}
            </div>
          </CollapsibleSection>
        )}
        {mediaRefs.length > 0 && (
          <CollapsibleSection title="رسانه‌ها" count={mediaRefs.length} icon="🎬">
            {mediaRefs.map((m) => <RailItem key={m.id} item={m} />)}
          </CollapsibleSection>
        )}
        {orphanedAnnotations.length > 0 && (
          <CollapsibleSection title="حاشیه‌های بدون مرجع" count={orphanedAnnotations.length}>
            {orphanedAnnotations.map((ann) => (
              <div key={ann.id} className="rounded-lg border border-amber-400/40 bg-amber-50/50 p-2 text-[11px] dark:bg-amber-950/30">
                <span className="font-semibold text-amber-600 dark:text-amber-400">شیء حذف شده — </span>
                <span className="text-muted-foreground">{ann.type}</span>
              </div>
            ))}
          </CollapsibleSection>
        )}
        {validationWarnings.length > 0 && (
          <CollapsibleSection title="اعتبارسنجی" count={validationWarnings.length}>
            {validationWarnings.slice(0, 8).map((w) => (
              <p key={w} className="text-[10px] leading-5 text-amber-500">{w}</p>
            ))}
          </CollapsibleSection>
        )}
      </div>
    </aside>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function IconBtn({ children, onClick, label }: { children: ReactNode; onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

function ModeChip({
  children, active, onClick, color = "default",
}: { children: ReactNode; active: boolean; onClick: () => void; color?: "rose" | "amber" | "emerald" | "default" }) {
  const activeClasses = {
    rose:    "border-rose-400/60 bg-rose-500/10 text-rose-600 dark:text-rose-400",
    amber:   "border-amber-400/60 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    emerald: "border-emerald-400/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    default: "border-primary/40 bg-primary/10 text-primary",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition",
        active
          ? activeClasses[color]
          : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function CollapsibleSection({
  title, count, icon, iconColor, children,
}: { title: string; count: number; icon?: string; iconColor?: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="overflow-hidden rounded-xl border border-border/50">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-left transition hover:bg-muted/30"
      >
        <div className="flex items-center gap-1.5">
          {icon && <span className={cn("text-[11px]", iconColor)}>{icon}</span>}
          <span className="text-[11px] font-semibold text-muted-foreground">{title}</span>
          <span className="rounded-full bg-muted/70 px-1.5 py-px text-[9px] tabular-nums text-muted-foreground">{count}</span>
        </div>
        <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-1 border-t border-border/30 px-3 pb-3 pt-2">
          {children}
        </div>
      )}
    </div>
  );
}

function StatBadge({
  label, value, color = "default",
}: { label: string; value: number; color?: "rose" | "amber" | "default" }) {
  return (
    <div className={cn(
      "rounded-lg border px-2 py-0.5 text-center",
      color === "rose"  ? "border-rose-400/30 bg-rose-50/60 dark:bg-rose-950/30"  :
      color === "amber" ? "border-amber-400/30 bg-amber-50/60 dark:bg-amber-950/30" :
      "border-border/50 bg-muted/40",
    )}>
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn(
        "text-[13px] font-bold tabular-nums",
        color === "rose" ? "text-rose-600 dark:text-rose-400" :
        color === "amber" ? "text-amber-600 dark:text-amber-400" : "text-foreground",
      )}>{value}</div>
    </div>
  );
}

function RailItem({ item }: { item: AlgorithmRecord }) {
  return (
    <div className="w-full rounded-lg border border-border/40 bg-muted/20 px-2.5 py-2 text-[11px] text-muted-foreground" dir="rtl" lang="fa">
      {nodeDisplayTitle(item) ?? "Clinical item"}
    </div>
  );
}

function BlockChips({ item, onBlockClick }: { item: AlgorithmRecord; onBlockClick?: (blockId: string) => void }) {
  const blocks = linkedBlockIds(item);
  if (blocks.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1">
      {blocks.map((blockId, i) => (
        <button key={blockId} type="button" title="منبع هنوز وارد نشده"
          onClick={() => onBlockClick?.(blockId)}
          className="min-h-7 rounded-lg border border-border/60 px-2 text-[10px] text-muted-foreground transition hover:bg-background hover:text-foreground">
          منبع {i + 1}
        </button>
      ))}
    </div>
  );
}
