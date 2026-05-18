"use client";

import {
  useCallback, useEffect, useMemo, useRef, useState,
  type PointerEvent,
} from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

import {
  useOutlinerStore,
  type Checkpoint,
  type SearchResult,
} from "@/components/outliner/outliner-store";
import { CRDTStatusBar } from "@/components/outliner/CRDTStatusBar";
import {
  linkedBlockIds,
  readString,
  titleOf,
} from "@/components/outliner/surface-families";
import {
  algorithmDisplayTitle,
  nodeDisplayTitle,
} from "@/components/outliner/navigation-labels";
import {
  renderAlgorithmSurface,
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
import { StudyPlayerShell } from "@/components/outliner/study-player/StudyPlayerShell";
import type { AlgorithmIR, AlgorithmRecord, AlgorithmSurface } from "@/types/algorithm-ir";
import type { StrokeAnnotationMetadata } from "@/types/annotation";

// ─── Props ────────────────────────────────────────────────────────────────────

interface OutlinerShellProps {
  segmentId: string;
  ir: AlgorithmIR;
  initialSurfaceId?: string | null;
  validationWarnings?: string[];
  onSurfaceSelect?: (surfaceId: string) => void;
  onBlockClick?: (blockId: string) => void;
  onFocusModeChange?: (active: boolean) => void;
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export function OutlinerShell({
  segmentId, ir, initialSurfaceId, validationWarnings = [],
  onSurfaceSelect, onBlockClick, onFocusModeChange,
}: OutlinerShellProps) {
  const searchCacheRef = useRef<Map<string, SearchResult[]>>(new Map());

  // ── Store reads ──────────────────────────────────────────────────────────
  const surfaces              = useOutlinerStore((s) => s.surfaces);
  const selectedSurfaceId     = useOutlinerStore((s) => s.selectedSurfaceId);
  const focusedNodeId         = useOutlinerStore((s) => s.focusedNodeId);
  const thresholdModeActive   = useOutlinerStore((s) => s.thresholdModeActive);
  const checkpointModeActive  = useOutlinerStore((s) => s.checkpointModeActive);
  const searchQuery            = useOutlinerStore((s) => s.searchQuery);
  const searchResults          = useOutlinerStore((s) => s.searchResults);
  const activeSearchIndex      = useOutlinerStore((s) => s.activeSearchIndex);
  const annotationMode         = useOutlinerStore((s) => s.annotationMode);
  const isFocusMode            = useOutlinerStore((s) => s.isFocusMode);
  const mode                   = useOutlinerStore((s) => s.mode);

  const setSegment             = useOutlinerStore((s) => s.setSegment);
  const selectSurface          = useOutlinerStore((s) => s.selectSurface);
  const setSearch              = useOutlinerStore((s) => s.setSearch);
  const setSearchResults       = useOutlinerStore((s) => s.setSearchResults);
  const setFocusPath           = useOutlinerStore((s) => s.setFocusPath);
  const activateFocusPath      = useOutlinerStore((s) => s.activateFocusPath);
  const setThresholdMode       = useOutlinerStore((s) => s.setThresholdMode);
  const setCheckpointMode      = useOutlinerStore((s) => s.setCheckpointMode);
  const setCheckpointQueue     = useOutlinerStore((s) => s.setCheckpointQueue);
  const resetFocus             = useOutlinerStore((s) => s.resetFocus);
  const setAnnotationMode      = useOutlinerStore((s) => s.setAnnotationMode);
  const loadAnnotationsForSurface = useOutlinerStore((s) => s.loadAnnotationsForSurface);
  const initCRDTForSegment     = useOutlinerStore((s) => s.initCRDTForSegment);
  const gotoNextSurface        = useOutlinerStore((s) => s.gotoNextSurface);
  const gotoPrevSurface        = useOutlinerStore((s) => s.gotoPrevSurface);
  const setFocusMode           = useOutlinerStore((s) => s.setFocusMode);
  const setMode                = useOutlinerStore((s) => s.setMode);
  const setImmersive           = useOutlinerStore((s) => s.setImmersive);
  const toggleImmersive        = useOutlinerStore((s) => s.toggleImmersive);
  const isImmersive            = useOutlinerStore((s) => s.isImmersive);

  // ── Init effects ─────────────────────────────────────────────────────────
  useEffect(() => {
    setSegment(segmentId, ir.surfaces, ir);
    if (initialSurfaceId && ir.surfaces.some((s) => s.id === initialSurfaceId))
      selectSurface(initialSurfaceId);
  }, [initialSurfaceId, ir, segmentId, selectSurface, setSegment]);

  useEffect(() => {
    setCheckpointQueue(collectCheckpoints(ir.surfaces));
  }, [ir.surfaces, setCheckpointQueue]);

  useEffect(() => { searchCacheRef.current.clear(); }, [segmentId]);
  useEffect(() => { void initCRDTForSegment(segmentId); }, [segmentId, initCRDTForSegment]);

  useEffect(() => {
    if (!selectedSurfaceId || !segmentId) return;
    void loadAnnotationsForSurface(segmentId, selectedSurfaceId);
  }, [selectedSurfaceId, segmentId, loadAnnotationsForSurface]);

  // Propagate surface select / focus mode to parent callbacks
  useEffect(() => {
    if (selectedSurfaceId) onSurfaceSelect?.(selectedSurfaceId);
  }, [onSurfaceSelect, selectedSurfaceId]);

  useEffect(() => {
    onFocusModeChange?.(isFocusMode);
  }, [onFocusModeChange, isFocusMode]);

  // ── Search ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = searchQuery.trim().toLowerCase();
    if (token.length < 2) { setSearchResults([]); return; }
    const cached = searchCacheRef.current.get(token);
    if (cached) { setSearchResults(cached); return; }
    const results = buildSearchResults(ir.surfaces, searchQuery);
    searchCacheRef.current.set(token, results);
    setSearchResults(results);
  }, [ir.surfaces, searchQuery, setSearchResults]);

  // ── Computed ─────────────────────────────────────────────────────────────
  const selectedSurface = useMemo(
    () => surfaces.find((s) => s.id === selectedSurfaceId) ?? surfaces[0] ?? null,
    [surfaces, selectedSurfaceId],
  );

  function openSearchResult(result: SearchResult): void {
    selectSurface(result.surfaceId);
    setSearch("");
    const surface = surfaces.find((s) => s.id === result.surfaceId);
    if (!surface) return;
    if (result.kind === "node" && result.objectId) {
      activateFocusPath(result.objectId);
      setFocusPath(computeFocusPath(surface, result.objectId));
    }
  }

  // ── Keyboard handler ─────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (typing && e.key !== "Escape") return;

      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault(); toggleImmersive(); return;
      }
      if (e.key === "]") { e.preventDefault(); gotoNextSurface(); }
      else if (e.key === "[") { e.preventDefault(); gotoPrevSurface(); }
      else if (!checkpointModeActive && !thresholdModeActive && e.key === "ArrowRight") {
        e.preventDefault(); gotoNextSurface();
      }
      else if (!checkpointModeActive && !thresholdModeActive && e.key === "ArrowLeft") {
        e.preventDefault(); gotoPrevSurface();
      }
      else if (e.key.toLowerCase() === "t") {
        e.preventDefault(); setMode(mode === "traps" ? "free" : "traps");
      }
      else if (e.key.toLowerCase() === "h") { e.preventDefault(); setThresholdMode(!thresholdModeActive); }
      else if (e.key.toLowerCase() === "c") { e.preventDefault(); setCheckpointMode(!checkpointModeActive); }
      else if (e.key === "/") {
        e.preventDefault();
        document.querySelector<HTMLInputElement>("[data-search-input]")?.focus();
      }
      else if (e.key === "Escape") {
        e.preventDefault();
        if (isImmersive) { setImmersive(false); return; }
        resetFocus();
        setThresholdMode(false);
        setCheckpointMode(false);
        setSearch("");
        if (isFocusMode) setFocusMode(false);
      }
      else if (e.key.toLowerCase() === "f" && selectedSurface && focusedNodeId) {
        e.preventDefault();
        activateFocusPath(focusedNodeId);
        setFocusPath(computeFocusPath(selectedSurface, focusedNodeId));
      }
      else if (e.key.toLowerCase() === "a") {
        e.preventDefault(); setAnnotationMode(!annotationMode);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    annotationMode, checkpointModeActive, focusedNodeId, gotoNextSurface,
    gotoPrevSurface, isFocusMode, isImmersive, mode, resetFocus, selectedSurface,
    setAnnotationMode, setCheckpointMode, setFocusMode, setFocusPath, setImmersive,
    setMode, setSearch, setThresholdMode, thresholdModeActive,
    activateFocusPath, toggleImmersive,
  ]);

  // ── Graph content slot ───────────────────────────────────────────────────
  const graphSlot = thresholdModeActive ? (
    <ThresholdModePanel surfaces={surfaces} onBlockClick={onBlockClick} />
  ) : checkpointModeActive ? (
    <CheckpointModePanel />
  ) : (
    <MainCanvas
      surface={selectedSurface}
      surfaces={surfaces}
      onBlockClick={onBlockClick}
      segmentId={segmentId}
    />
  );

  return (
    <>
      <StudyPlayerShell
        ir={ir}
        graphSlot={graphSlot}
        openSearchResult={openSearchResult}
        onBlockClick={onBlockClick}
      />
      <CRDTStatusBar segmentId={segmentId} />
    </>
  );
}

// ─── Main Canvas (annotation + graph mount) ───────────────────────────────────

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
        const valid = entries.filter(
          (e): e is { metadata: StrokeAnnotationMetadata; points: import("@/types/annotation").StrokePoint[] } => e !== null,
        );
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

  if (!surface) return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 p-8 text-center">
      <p className="text-sm text-muted-foreground">الگوریتمی را از فهرست انتخاب کنید.</p>
      <p className="text-xs text-muted-foreground/60">از دکمه فهرست در نوار بالا استفاده کنید.</p>
    </div>
  );

  const surfaceContent = (
    <div className="outliner-surface-transition">
      {renderAlgorithmSurface(surface, onBlockClick)}
    </div>
  );

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
    <section className="min-h-[calc(100vh-180px)] p-5" style={{ background: "var(--sp-canvas-bg)" }}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <h2 className="text-[18px] font-bold" dir="rtl" lang="fa">آستانه‌های کلیدی</h2>
          <div className="flex-1" />
          <label className="flex items-center gap-2 rounded-xl border border-border/60 bg-white px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-40 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
              placeholder="جستجو..."
            />
          </label>
          <button type="button" onClick={() => setThresholdMode(false)}
            className="flex items-center gap-1.5 rounded-xl border border-border/60 px-4 py-2 text-[12px] transition hover:bg-gray-50">
            <X className="h-4 w-4" /> خروج
          </button>
        </div>
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
                      className="overflow-hidden rounded-2xl border border-amber-400/30 bg-amber-50/50 shadow-sm">
                      <div className="h-[3px] bg-amber-500/70" />
                      <div className="p-4">
                        <p className="text-[13px] font-semibold text-foreground" dir="rtl" lang="fa">
                          {readString(item, ["variable", "metric", "label", "title"]) ?? item.id}
                        </p>
                        <div className="mt-2 inline-flex items-baseline gap-1 rounded-xl bg-amber-500/12 px-3 py-1.5">
                          <span className="text-[24px] font-black leading-none text-amber-600 tabular-nums">
                            {readString(item, ["value", "threshold"]) ?? "—"}
                          </span>
                        </div>
                        {readString(item, ["conditionText", "condition"]) && (
                          <p className="mt-2 text-[11px] leading-5 text-muted-foreground" dir="rtl" lang="fa">
                            {readString(item, ["conditionText", "condition"])}
                          </p>
                        )}
                        {readString(item, ["decisionImpact", "impact", "description"]) && (
                          <div className="mt-2.5 rounded-xl border border-border/40 bg-white/70 p-2.5 text-[11px]" dir="rtl">
                            <span className="font-semibold text-foreground">تأثیر: </span>
                            <span className="text-muted-foreground">{readString(item, ["decisionImpact", "impact", "description"])}</span>
                          </div>
                        )}
                        {readString(item, ["memoryAnchor"]) && (
                          <p className="mt-2 text-[10px] italic text-foreground/70" dir="rtl">
                            {readString(item, ["memoryAnchor"])}
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

  const current       = queue[index];
  const total         = queue.length;
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
          className="rounded-xl border border-border/60 px-5 py-2 text-[12px] hover:bg-gray-50">
          بازگشت
        </button>
      </div>
    );
  }

  return (
    <section
      className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center p-5"
      style={{ background: "var(--sp-canvas-bg)" }}
      onPointerDown={(e) => setPointerStart({ x: e.clientX, y: e.clientY })}
      onPointerUp={onPointerUp}
    >
      <div className="w-full max-w-lg">
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

        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="truncate text-[11px] text-muted-foreground" dir="rtl" lang="fa">{current.surfaceTitle}</span>
          <button type="button" onClick={() => setCheckpointMode(false)}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1 text-[11px] hover:bg-gray-50">
            <X className="h-3.5 w-3.5" /> خروج
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/50 bg-white shadow-md">
          <div className="min-h-[140px] p-6">
            <p className="text-[16px] font-bold leading-8 text-foreground" dir="rtl" lang="fa">
              {readString(current, ["prompt", "check", "label"]) ?? titleOf(current, current.id)}
            </p>
          </div>
          {revealed.has(current.id) ? (
            <div className="border-t border-border/40 bg-amber-50/60 p-5">
              <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-amber-600">پاسخ</p>
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
            <div className="border-t border-border/40 bg-white px-5 py-4 text-center">
              <button type="button" onClick={() => revealCheckpoint(current.id)}
                className="rounded-xl bg-primary px-8 py-2.5 text-[12px] font-semibold text-primary-foreground transition hover:bg-primary/90">
                نمایش پاسخ
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={prevCheckpoint}
            className="flex items-center gap-1.5 rounded-xl border border-border/60 px-4 py-2.5 text-[12px] transition hover:bg-gray-50">
            <ChevronRight className="h-4 w-4" /> قبلی
          </button>
          <span className="text-[10px] text-muted-foreground">{revealedCount} / {total} نمایش</span>
          <button type="button" onClick={nextCheckpoint}
            className="flex items-center gap-1.5 rounded-xl border border-border/60 px-4 py-2.5 text-[12px] transition hover:bg-gray-50">
            بعدی <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-center text-[9px] text-foreground/60">← بکشید برای تغییر →</p>
      </div>
    </section>
  );
}

// ─── BlockChips helper ────────────────────────────────────────────────────────

function BlockChips({ item, onBlockClick }: { item: AlgorithmRecord; onBlockClick?: (blockId: string) => void }) {
  const blocks = linkedBlockIds(item);
  if (blocks.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1">
      {blocks.map((blockId, i) => (
        <button key={blockId} type="button" title="منبع هنوز وارد نشده"
          onClick={() => onBlockClick?.(blockId)}
          className="min-h-7 rounded-lg border border-border/60 px-2 text-[10px] text-muted-foreground transition hover:bg-white hover:text-foreground">
          منبع {i + 1}
        </button>
      ))}
    </div>
  );
}
