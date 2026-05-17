"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronRight, X } from "lucide-react";

import { OutlinerSegmentView } from "@/components/outliner/OutlinerSegmentView";
import { useOutlinerStore } from "@/components/outliner/outliner-store";
import {
  aggregateSurfaceStats,
  buildChapterNavItems,
  type ChapterNavItem,
  type SurfaceStats,
} from "@/components/outliner/navigation-labels";
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
  const [chapterPanelCollapsed, setChapterPanelCollapsed] = useState(true);
  const isFocusMode = useOutlinerStore((s) => s.isFocusMode);

  const hasActive = useMemo(() => Boolean(active?.ir), [active]);
  const chapters = useMemo(() => buildChapterNavItems(segments), [segments]);
  const activeChapter = useMemo(
    () =>
      chapters.find((c) => c.segments.some((s) => s.segmentId === activeSegmentId)) ??
      chapters[0] ??
      null,
    [activeSegmentId, chapters],
  );
  const activeChapterIndex = useMemo(
    () => (activeChapter ? chapters.findIndex((c) => c.key === activeChapter.key) : -1),
    [activeChapter, chapters],
  );
  const activeChapterStats = useMemo(
    () => (active?.ir ? aggregateSurfaceStats(active.ir.surfaces) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active?.ir],
  );

  function openChapter(chapter: ChapterNavItem) {
    const firstSegment = chapter.segments[0];
    if (firstSegment) setActiveSegmentId(firstSegment.segmentId);
    setChapterPanelCollapsed(true);
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
        setError(
          `داده این فصل در حافظه محلی کامل نیست (segmentId: ${segmentId}). ` +
            "لطفاً از صفحه ایمپورت، فایل‌ها را حذف و دوباره وارد کنید.",
        );
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

  const showChapterStrip =
    !isFocusMode && chapterPanelCollapsed && chapters.length > 0;

  return (
    <main className="outliner-workspace flex h-full min-h-0 flex-col bg-[#F4F7F8]">
      {error && (
        <div className="shrink-0 border-b border-red-100 bg-red-50/80 px-4 py-2.5 text-xs text-red-700">
          {error}
        </div>
      )}

      {segments.length === 0 ? (
        <section className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <BookOpen className="h-10 w-10 text-gray-200" />
          <p className="text-sm font-medium text-gray-500">هنوز الگوریتمی وارد نشده است.</p>
          <p className="text-xs text-gray-400">
            برای شروع، یک فایل Algorithm IR را از صفحه ایمپورت وارد کنید.
          </p>
        </section>
      ) : (
        <div
          className={`grid flex-1 grid-cols-1 overflow-hidden ${
            !isFocusMode && !chapterPanelCollapsed
              ? "lg:grid-cols-[300px_minmax(0,1fr)]"
              : ""
          }`}
        >
          {!isFocusMode && !chapterPanelCollapsed && (
            <ChapterPanel
              chapters={chapters}
              activeChapterKey={activeChapter?.key ?? null}
              onOpenChapter={openChapter}
              loading={loading}
              activeStats={activeChapterStats}
              onCollapse={() => setChapterPanelCollapsed(true)}
            />
          )}

          <section className="flex min-w-0 min-h-0 flex-col overflow-hidden">
            {showChapterStrip && chapters.length > 1 && (
              <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur">
                <button
                  type="button"
                  onClick={() => setChapterPanelCollapsed(false)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  فصل‌ها
                  <span className="rounded-full bg-gray-100 px-1.5 py-px text-[10px] tabular-nums">
                    {chapters.length}
                  </span>
                </button>
                {activeChapter && (
                  <>
                    <ChevronRight className="h-3 w-3 text-gray-300" />
                    <span className="text-xs font-medium text-gray-700" dir="rtl" lang="fa">
                      {activeChapter.label}
                    </span>
                    <span className="ml-auto text-[10px] text-gray-400 tabular-nums">
                      {activeChapterIndex + 1} / {chapters.length}
                    </span>
                  </>
                )}
              </div>
            )}

            {hasActive && active ? (
              <OutlinerSegmentView
                segmentId={active.segment.segmentId}
                ir={active.ir}
                parseWarnings={active.parseWarnings}
                validationRaw={active.validationRaw}
                mediaRaw={active.mediaRaw}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-sm text-gray-400">
                {loading ? "در حال بارگذاری..." : "یک فصل را از فهرست انتخاب کنید."}
              </div>
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
    <aside className="outliner-chapter-panel flex h-full flex-col overflow-hidden border-r border-slate-200 bg-white">
      <div className="shrink-0 flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-800">فصل‌ها</h2>
        <div className="flex items-center gap-2">
          {loading && <span className="text-[10px] text-gray-400">بارگذاری...</span>}
          <button
            type="button"
            onClick={onCollapse}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Outliner chapters">
        {chapters.map((chapter) => {
          const active = chapter.key === activeChapterKey;
          return (
            <button
              key={chapter.key}
              type="button"
              onClick={() => onOpenChapter(chapter)}
              className={`min-h-11 w-full rounded-xl px-3 py-2.5 text-right transition ${
                active
                  ? "bg-blue-50 text-blue-900"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span className="block text-sm font-semibold leading-5" dir="rtl" lang="fa">
                {chapter.label}
              </span>
              <span className="mt-0.5 block text-[10px] text-gray-400">
                {chapter.algorithmCount ?? chapter.segments.length} الگوریتم
              </span>
              {active && activeStats && (
                <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] text-gray-400">
                  {activeStats.checkpoints > 0 && (
                    <span>{activeStats.checkpoints} چک‌پوینت</span>
                  )}
                  {activeStats.traps > 0 && (
                    <span className="text-rose-400">{activeStats.traps} دام</span>
                  )}
                  {activeStats.gates > 0 && <span>{activeStats.gates} گیت</span>}
                </div>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
