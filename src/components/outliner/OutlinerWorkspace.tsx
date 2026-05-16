"use client";

import { useEffect, useMemo, useState } from "react";

import { OutlinerSegmentView } from "@/components/outliner/OutlinerSegmentView";
import { aggregateSurfaceStats, buildChapterNavItems, type ChapterNavItem, type SurfaceStats } from "@/components/outliner/navigation-labels";
import {
  listOutlinerSegmentsLocal,
  loadOutlinerAlgorithmIR,
  type LoadedOutlinerAlgorithmSegment,
} from "@/lib/local-first/outliner-local";
import type { OutlinerAlgorithmSegmentRow } from "@/lib/local-first/idb";

interface OutlinerWorkspaceProps {
  initialSegmentId?: string;
}

export function OutlinerWorkspace({ initialSegmentId }: OutlinerWorkspaceProps) {
  const [segments, setSegments] = useState<OutlinerAlgorithmSegmentRow[]>([]);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(initialSegmentId ?? null);
  const [active, setActive] = useState<LoadedOutlinerAlgorithmSegment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chapterPanelCollapsed, setChapterPanelCollapsed] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  const hasActive = useMemo(() => Boolean(active?.ir), [active]);
  const chapters = useMemo(() => buildChapterNavItems(segments), [segments]);
  const activeChapterKey = useMemo(() => {
    return chapters.find((chapter) => chapter.segments.some((segment) => segment.segmentId === activeSegmentId))?.key ?? chapters[0]?.key ?? null;
  }, [activeSegmentId, chapters]);
  const activeChapterStats = useMemo(() => (active?.ir ? aggregateSurfaceStats(active.ir.surfaces) : null), [active?.ir]);

  function openChapter(chapter: ChapterNavItem) {
    const firstSegment = chapter.segments[0];
    if (firstSegment) setActiveSegmentId(firstSegment.segmentId);
  }

  async function refreshSegments() {
    try {
      const rows = await listOutlinerSegmentsLocal();
      setSegments(rows);
      if (!activeSegmentId && rows.length > 0) {
        setActiveSegmentId(rows[0].segmentId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load local Outliner chapters.");
    }
  }

  async function openSegment(segmentId: string) {
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadOutlinerAlgorithmIR(segmentId);
      if (!loaded) {
        setActive(null);
        setError("This chapter is not available in local storage.");
        return;
      }
      setActiveSegmentId(segmentId);
      setActive(loaded);
    } catch (err) {
      setActive(null);
      setError(err instanceof Error ? err.message : "Unable to open this chapter.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshSegments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeSegmentId) return;
    void openSegment(activeSegmentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSegmentId]);

  return (
    <main dir="rtl" className="outliner-workspace mx-auto w-full max-w-none px-3 py-4 lg:px-4">
      <section className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Outliner</h1>
          <p className="text-xs text-muted-foreground">Clinical algorithm browser</p>
        </div>
        <a
          href="/import/outliner"
          className="inline-flex min-h-11 items-center rounded-md border border-border/60 bg-background/70 px-3 text-xs font-medium hover:bg-background"
        >
          Import Algorithm IR
        </a>
      </section>

      {error && (
        <section className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </section>
      )}

      {segments.length === 0 ? (
        <section className="rounded-md border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
          Import an Algorithm IR file to start browsing chapters.
        </section>
      ) : (
        <div className={`grid min-h-[calc(100vh-112px)] grid-cols-1 gap-3 ${focusMode || chapterPanelCollapsed ? "lg:grid-cols-[minmax(0,1fr)]" : "lg:grid-cols-[280px_minmax(0,1fr)]"}`}>
          {!focusMode && !chapterPanelCollapsed && (
            <ChapterPanel
              chapters={chapters}
              activeChapterKey={activeChapterKey}
              onOpenChapter={openChapter}
              loading={loading}
              activeStats={activeChapterStats}
              onCollapse={() => setChapterPanelCollapsed(true)}
            />
          )}

          <section className="min-w-0 overflow-hidden rounded-md border border-border/60 bg-card/30">
            {!focusMode && chapterPanelCollapsed && (
              <div className="border-b border-border/60 bg-card/70 p-2">
                <button
                  type="button"
                  className="min-h-10 rounded-md border border-border/60 bg-background/70 px-3 text-xs font-medium hover:bg-background"
                  onClick={() => setChapterPanelCollapsed(false)}
                >
                  Show chapters
                </button>
              </div>
            )}
            {hasActive && active ? (
              <OutlinerSegmentView
                segmentId={active.segment.segmentId}
                ir={active.ir}
                parseWarnings={active.parseWarnings}
                validationRaw={active.validationRaw}
                mediaRaw={active.mediaRaw}
                onFocusModeChange={setFocusMode}
              />
            ) : (
              <div className="p-4 text-sm text-muted-foreground">Select a chapter to open its clinical algorithms.</div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function ChapterPanel({
  chapters,
  activeChapterKey,
  onOpenChapter,
  loading,
  activeStats,
  onCollapse,
}: {
  chapters: ChapterNavItem[];
  activeChapterKey: string | null;
  onOpenChapter: (chapter: ChapterNavItem) => void;
  loading: boolean;
  activeStats: SurfaceStats | null;
  onCollapse: () => void;
}) {
  return (
    <aside className="outliner-chapter-panel rounded-md border border-border/60 bg-card/70 p-3">
      <div className="mb-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold">Chapters</h2>
          <button type="button" className="min-h-10 rounded-md border border-border/60 px-2 text-[11px]" onClick={onCollapse}>
            Collapse
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">{loading ? "Loading..." : `${chapters.length} available`}</p>
      </div>
      <nav className="space-y-1" aria-label="Outliner chapters">
        {chapters.map((chapter) => {
          const active = chapter.key === activeChapterKey;
          return (
            <button
              key={chapter.key}
              type="button"
              onClick={() => onOpenChapter(chapter)}
              className={`min-h-11 w-full rounded-md border px-3 py-2 text-right transition ${
                active
                  ? "border-primary/70 bg-primary/10 text-foreground shadow-sm"
                  : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-background/70 hover:text-foreground"
              }`}
            >
              <span className="block text-sm font-semibold leading-5">{chapter.label}</span>
              <span className="mt-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {chapter.algorithmCount || chapter.segments.length} algorithms
              </span>
              {active && activeStats && (
                <span className="mt-2 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                  <span>{activeStats.checkpoints} checkpoints</span>
                  <span>{activeStats.traps} traps</span>
                  <span>{activeStats.gates} gates</span>
                  <span>{activeStats.matrices} matrices</span>
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

