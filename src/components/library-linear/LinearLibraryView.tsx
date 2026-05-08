"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  Circle,
  Clock,
  Compass,
  Disc,
  FolderTree,
  Library,
  Layers3,
  Search,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";

import type {
  CampbellVolumeGroup,
  CampbellVolumeSummary,
  LibraryDashboardData,
} from "@/lib/library/queries";
import type { ChapterStatus } from "@/lib/library/progress";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const LIB_CSS = `
.ll-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
.ll-scroll::-webkit-scrollbar-track { background: transparent; }
.ll-scroll::-webkit-scrollbar-thumb {
  background: hsl(var(--border) / 0.35);
  border-radius: 999px;
}
.ll-scroll::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--border) / 0.7);
}

.ll-guide {
  background: hsl(var(--border) / 0.42);
}

.ll-balance {
  text-wrap: balance;
}

.ll-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ll-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ll-meta {
  font-variant-numeric: tabular-nums;
}

.ll-hover-soft:hover {
  background: hsl(var(--foreground) / 0.03);
}

.ll-anthropic-active {
  background: hsl(var(--foreground) / 0.04);
  border-color: hsl(var(--border) / 0.85);
  box-shadow: 0 1px 2px hsl(var(--foreground) / 0.03);
}

.ll-surface-card {
  background: linear-gradient(
    180deg,
    hsl(var(--background)) 0%,
    hsl(var(--foreground) / 0.018) 100%
  );
  border: 1px solid hsl(var(--border) / 0.72);
  box-shadow:
    0 1px 2px hsl(var(--foreground) / 0.025),
    0 10px 30px hsl(var(--foreground) / 0.025);
}

.ll-surface-hero {
  background:
    radial-gradient(circle at top right, rgba(217,119,6,0.08), transparent 28%),
    radial-gradient(circle at top left, hsl(var(--primary) / 0.08), transparent 32%),
    linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--foreground) / 0.02) 100%);
  border: 1px solid hsl(var(--border) / 0.78);
  box-shadow:
    0 1px 2px hsl(var(--foreground) / 0.03),
    0 18px 40px hsl(var(--foreground) / 0.035);
}

.ll-chip-orange {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(217, 119, 6, 0.10);
  color: rgb(180, 83, 9);
  border: 1px solid rgba(217, 119, 6, 0.14);
}

.ll-chip-green {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: hsl(var(--primary) / 0.10);
  color: hsl(var(--primary));
  border: 1px solid hsl(var(--primary) / 0.14);
}

.ll-chip-muted {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: hsl(var(--muted) / 0.42);
  color: hsl(var(--muted-foreground) / 0.82);
  border: 1px solid hsl(var(--border) / 0.5);
}

.ll-kpi {
  border-top: 1px solid hsl(var(--border) / 0.5);
}

@keyframes ll-pulse {
  0%, 100% { opacity: 0.72; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.06); }
}

.ll-pulse {
  animation: ll-pulse 2.4s ease-in-out infinite;
}
`;

type ChapterContext = {
  volume: number;
  part: string;
  title: string;
  status: ChapterStatus;
  isLinked: boolean;
};

type NextAction = {
  kind: "resume" | "start" | "complete";
  chapterNo: number;
  title: string;
  meta: string;
};

function formatStatusLabel(status: ChapterStatus): string {
  switch (status) {
    case "reading":
      return "در حال مطالعه";
    case "read":
      return "خوانده‌شده";
    case "reviewed":
      return "مرور شده";
    case "mastered":
      return "تسلط";
    default:
      return "شروع نشده";
  }
}

function StatusDot({ status, size = 10 }: { status: ChapterStatus; size?: number }) {
  if (status === "mastered") {
    return (
      <Star
        className="shrink-0 fill-warning text-warning"
        style={{ width: size + 2, height: size + 2 }}
      />
    );
  }

  if (status === "reviewed") {
    return (
      <CheckCheck
        className="shrink-0 text-success"
        style={{ width: size + 2, height: size + 2 }}
      />
    );
  }

  if (status === "read") {
    return (
      <Check
        className="shrink-0 text-success"
        style={{ width: size + 2, height: size + 2 }}
      />
    );
  }

  if (status === "reading") {
    return (
      <Disc
        className="ll-pulse shrink-0 text-primary"
        style={{ width: size + 2, height: size + 2 }}
      />
    );
  }

  return (
    <Circle
      className="shrink-0 text-muted-foreground/40"
      style={{ width: size, height: size }}
    />
  );
}

function findChapterContext(
  navigation: CampbellVolumeGroup[],
  chapterNo: number | null,
): ChapterContext | null {
  if (chapterNo == null) return null;

  for (const volume of navigation) {
    for (const part of volume.parts) {
      const chapter = part.chapters.find((item) => item.chapterNo === chapterNo);
      if (chapter) {
        return {
          volume: volume.volume,
          part: part.part,
          title: chapter.title,
          status: chapter.status,
          isLinked: chapter.isLinked,
        };
      }
    }
  }

  return null;
}

function buildChapterContextMap(navigation: CampbellVolumeGroup[]) {
  const map = new Map<number, ChapterContext>();

  for (const volume of navigation) {
    for (const part of volume.parts) {
      for (const chapter of part.chapters) {
        map.set(chapter.chapterNo, {
          volume: volume.volume,
          part: part.part,
          title: chapter.title,
          status: chapter.status,
          isLinked: chapter.isLinked,
        });
      }
    }
  }

  return map;
}

function pickNextAction(
  dashboard: LibraryDashboardData,
  navigation: CampbellVolumeGroup[],
  renderedAt: number,
): NextAction | null {
  const recent = dashboard.recentlyRead[0];
  if (recent) {
    return {
      kind: "resume",
      chapterNo: recent.chapterNo,
      title: recent.title,
      meta: `آخرین بازدید ${formatRelativeTime(recent.lastReadAt, renderedAt)}.`,
    };
  }

  for (const volume of navigation) {
    for (const part of volume.parts) {
      const nextLinked = part.chapters.find(
        (chapter) => chapter.status === "not_started" && chapter.isLinked,
      );
      if (nextLinked) {
        return {
          kind: "start",
          chapterNo: nextLinked.chapterNo,
          title: nextLinked.title,
          meta: "فصل بعدی در دسترس.",
        };
      }
    }
  }

  for (const volume of navigation) {
    for (const part of volume.parts) {
      const next = part.chapters.find((chapter) => chapter.status === "not_started");
      if (next) {
        return {
          kind: "start",
          chapterNo: next.chapterNo,
          title: next.title,
          meta: "اولین فصل خوانده‌نشده در کتاب.",
        };
      }
    }
  }

  const first = navigation[0]?.parts[0]?.chapters[0];
  if (first) {
    return {
      kind: "complete",
      chapterNo: first.chapterNo,
      title: "تمام فصل‌های موجود خوانده شده‌اند.",
      meta: "به هر نقطه‌ای از کتاب بازگردید و دور بعدی را شروع کنید.",
    };
  }

  return null;
}

function formatRelativeTime(timestamp: number, renderedAt: number): string {
  if (!timestamp) return "همین الان";

  const diffMs = renderedAt - timestamp;
  const minutes = Math.round(diffMs / 60000);

  if (minutes < 1) return "همین الان";
  if (minutes < 60) return `${minutes} دقیقه پیش`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ساعت پیش`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days} روز پیش`;

  return new Date(timestamp).toLocaleDateString("fa-IR", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function chapterHref(chapterNo: number, fallbackHref: string | null) {
  return fallbackHref ?? `/library/campbell/chapter/${chapterNo}`;
}

function ChapterRow({
  chapterNo,
  title,
  status,
  featured = false,
}: {
  chapterNo: number;
  title: string;
  status: ChapterStatus;
  featured?: boolean;
}) {
  return (
    <Link
      href={`/library/campbell/chapter/${chapterNo}`}
      className={cn(
        "group block rounded-xl border border-transparent px-3 py-3 text-right transition-all",
        "ll-hover-soft hover:border-border/55",
        featured && "ll-anthropic-active",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "h-6 min-w-6 px-1.5 text-[10px] font-semibold ll-meta",
              featured ? "ll-chip-orange" : "ll-chip-muted",
            )}
          >
            {chapterNo}
          </span>

          <span className="shrink-0">
            <StatusDot status={status} size={9} />
          </span>
        </div>

        <div className="text-[10px] font-medium text-muted-foreground/56">
          {featured ? "فصل فعلی" : "فصل"}
        </div>
      </div>

      <div
        dir="ltr"
        className={cn(
          "ll-clamp-2 mt-2 min-w-0 text-left text-[13.5px] leading-[1.7] tracking-[-0.01em] text-foreground/92",
          "group-hover:text-foreground",
          featured && "font-medium text-foreground",
        )}
        style={{ wordBreak: "normal", overflowWrap: "anywhere" }}
      >
        {title}
      </div>
    </Link>
  );
}

function getDefaultExpandedState(
  navigation: CampbellVolumeGroup[],
  featuredChapterNo: number | null,
): Record<string, boolean> {
  const nextState: Record<string, boolean> = {};

  if (featuredChapterNo != null) {
    for (const volume of navigation) {
      for (const part of volume.parts) {
        const match = part.chapters.some((chapter) => chapter.chapterNo === featuredChapterNo);
        if (match) {
          nextState[`vol-${volume.volume}`] = true;
          nextState[`part-${part.key}`] = true;
          return nextState;
        }
      }
    }
  }

  if (navigation[0]) {
    nextState[`vol-${navigation[0].volume}`] = true;
    if (navigation[0].parts[0]) {
      nextState[`part-${navigation[0].parts[0].key}`] = true;
    }
  }

  return nextState;
}

function ChapterTree({
  navigation,
  query,
  featuredChapterNo,
}: {
  navigation: CampbellVolumeGroup[];
  query: string;
  featuredChapterNo: number | null;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const nextState: Record<string, boolean> = {};

    if (featuredChapterNo != null) {
      for (const volume of navigation) {
        for (const part of volume.parts) {
          const match = part.chapters.some((chapter) => chapter.chapterNo === featuredChapterNo);
          if (match) {
            nextState[`vol-${volume.volume}`] = true;
            nextState[`part-${part.key}`] = true;
            return nextState;
          }
        }
      }
    }

    if (navigation[0]) {
      nextState[`vol-${navigation[0].volume}`] = true;
      if (navigation[0].parts[0]) {
        nextState[`part-${navigation[0].parts[0].key}`] = true;
      }
    }

    return nextState;
  });

  const trimmed = query.trim().toLowerCase();
  const filtering = trimmed.length > 0;

  const filteredNavigation = useMemo(() => {
    if (!filtering) return navigation;

    return navigation
      .map((volume) => ({
        ...volume,
        parts: volume.parts
          .map((part) => ({
            ...part,
            chapters: part.chapters.filter((chapter) => {
              const titleMatch = chapter.title.toLowerCase().includes(trimmed);
              const numMatch = String(chapter.chapterNo).includes(trimmed);
              return titleMatch || numMatch;
            }),
          }))
          .filter((part) => part.chapters.length > 0),
      }))
      .filter((volume) => volume.parts.length > 0);
  }, [filtering, navigation, trimmed]);

  const isExpanded = useCallback(
    (key: string) => (filtering ? true : expanded[key] === true),
    [expanded, filtering],
  );

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  if (filteredNavigation.length === 0) {
    return (
      <div className="py-8 text-sm leading-7 text-muted-foreground/70">
        فصلی با این جستجو یافت نشد.
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-10">
      {filteredNavigation.map((volume) => {
        const volumeKey = `vol-${volume.volume}`;
        const volumeExpanded = isExpanded(volumeKey);
        const totalChapters = volume.parts.reduce((sum, part) => sum + part.totalCount, 0);
        const readChapters = volume.parts.reduce((sum, part) => sum + part.readCount, 0);

        return (
          <div key={volume.volume} className="select-none">
            <button
              type="button"
              onClick={() => toggle(volumeKey)}
              className={cn(
                "group grid w-full grid-cols-[28px_minmax(0,1fr)] items-center gap-3 rounded-xl border px-3 py-3 text-right transition-all",
                volumeExpanded
                  ? "ll-anthropic-active"
                  : "border-transparent ll-hover-soft hover:border-border/50",
              )}
            >
              <div className="flex items-center justify-center">
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground/56 transition-transform duration-200",
                    !volumeExpanded && "rotate-90",
                  )}
                />
              </div>

              <div className="min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="ll-chip-green h-7 w-7">
                      <Layers3 className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[11px] font-semibold tracking-[0.08em] text-foreground/88">
                      جلد {volume.volume}
                    </span>
                  </div>

                  <span className="ll-meta text-[10px] text-muted-foreground/54">
                    {readChapters}/{totalChapters}
                  </span>
                </div>
              </div>
            </button>

            {volumeExpanded ? (
              <div className="relative mt-2 space-y-2 pr-4">
                <div className="ll-guide absolute bottom-1 right-[11px] top-2 w-px" />

                {volume.parts.map((part) => {
                  const partKey = `part-${part.key}`;
                  const partExpanded = isExpanded(partKey);

                  return (
                    <div key={part.key}>
                      <button
                        type="button"
                        onClick={() => toggle(partKey)}
                        className={cn(
                          "group grid w-full grid-cols-[24px_minmax(0,1fr)] items-start gap-3 rounded-lg border px-3 py-2.5 text-right transition-all",
                          partExpanded
                            ? "border-border/46 bg-background"
                            : "border-transparent ll-hover-soft hover:border-border/40",
                        )}
                      >
                        <div className="flex items-center justify-center pt-1">
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 text-muted-foreground/54 transition-transform duration-200",
                              !partExpanded && "rotate-90",
                            )}
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-2">
                              <span className="ll-chip-orange mt-0.5 h-6 w-6 shrink-0">
                                <FolderTree className="h-3 w-3" />
                              </span>

                              <div
                                dir="ltr"
                                className="ll-clamp-2 min-w-0 text-left text-[12.25px] leading-[1.6] text-foreground/86"
                              >
                                {part.part}
                              </div>
                            </div>

                            <span className="ll-meta shrink-0 text-[9.5px] text-muted-foreground/46">
                              {part.readCount}/{part.totalCount}
                            </span>
                          </div>
                        </div>
                      </button>

                      {partExpanded ? (
                        <div className="relative mt-2 space-y-1.5 pr-4">
                          <div className="ll-guide absolute bottom-1 right-[9px] top-2 w-px" />
                          {part.chapters.map((chapter) => (
                            <ChapterRow
                              key={chapter.chapterNo}
                              chapterNo={chapter.chapterNo}
                              title={chapter.title}
                              status={chapter.status}
                              featured={chapter.chapterNo === featuredChapterNo}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  count,
  icon,
  tone = "green",
}: {
  eyebrow: string;
  title: string;
  description: string;
  count?: string;
  icon?: React.ReactNode;
  tone?: "green" | "orange" | "muted";
}) {
  const chipClass =
    tone === "orange"
      ? "ll-chip-orange"
      : tone === "muted"
      ? "ll-chip-muted"
      : "ll-chip-green";

  return (
    <div className="flex items-end justify-between gap-4 border-b border-border/42 pb-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon ? <span className={cn(chipClass, "h-7 w-7 shrink-0")}>{icon}</span> : null}
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/58">
            {eyebrow}
          </div>
        </div>

        <h2 className="mt-3 text-[19px] font-semibold tracking-[-0.03em] text-foreground">
          {title}
        </h2>
        <p className="mt-1.5 max-w-xl text-[12.5px] leading-6 text-muted-foreground/72">
          {description}
        </p>
      </div>

      {count ? (
        <div className="shrink-0 rounded-full border border-border/60 px-2.5 py-1 text-[10px] font-mono tabular-nums uppercase tracking-[0.14em] text-muted-foreground/52">
          {count}
        </div>
      ) : null}
    </div>
  );
}

function PageAnchor({
  action,
  featuredContext,
  weakChapterNo,
  completionPct,
  totalIncluded,
  totalRead,
  totalMastered,
  volumeCount,
}: {
  action: NextAction | null;
  featuredContext: ChapterContext | null;
  weakChapterNo: number | null;
  completionPct: number;
  totalIncluded: number;
  totalRead: number;
  totalMastered: number;
  volumeCount: number;
}) {
  const actionLabel =
    action?.kind === "resume"
      ? "ادامه مطالعه"
      : action?.kind === "start"
      ? "شروع مطالعه"
      : "مطالعه تکمیل شد";

  const primaryLabel =
    action?.kind === "resume"
      ? "بازگشت به فصل"
      : action?.kind === "start"
      ? "شروع فصل"
      : "مرور جلدها";

  const progressCopy =
    totalIncluded === 0
      ? "هنوز فصلی در دسترس نیست."
      : completionPct >= 100
      ? "تمام فصل‌های موجود خوانده شده‌اند."
      : `${totalRead.toLocaleString("en-US")} از ${totalIncluded.toLocaleString("en-US")} فصل خوانده شده.`;

  return (
    <section className="ll-surface-hero rounded-[28px] px-6 py-7 md:px-8 md:py-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-10">
        <div>
          <div className="flex items-center gap-2">
  <span className="ll-chip-green h-8 w-8">
    <BookOpen className="h-4 w-4" />
  </span>
  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/56">
    Campbell-Walsh-Wein Urology
  </div>
</div>
          <div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/56">
            {actionLabel}
          </div>

          {action ? (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground/64">
                <span className="font-mono tabular-nums">فصل {action.chapterNo}</span>
                {featuredContext ? (
                  <>
                    <span className="h-1 w-1 rounded-full bg-border/80" />
                    <span>جلد {featuredContext.volume}</span>
                    <span className="h-1 w-1 rounded-full bg-border/80" />
                    <span className="truncate">{featuredContext.part}</span>
                    <span className="h-1 w-1 rounded-full bg-border/80" />
                    <span>{formatStatusLabel(featuredContext.status)}</span>
                  </>
                ) : null}
              </div>

              <h1 className="ll-balance mt-3 max-w-3xl text-[2rem] font-semibold leading-[1.14] tracking-[-0.045em] text-foreground lg:text-[2.65rem]">
                <span>فصل {action.chapterNo}.</span>{" "}
                <span dir="ltr" className="inline">{action.title}</span>
              </h1>

              <p className="mt-3 max-w-2xl text-[13px] leading-6 text-muted-foreground/76">
                {action.meta}
              </p>

              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-muted-foreground/68">
                <span>{volumeCount} جلد</span>
                <span>{totalIncluded.toLocaleString("en-US")} فصل</span>
                <span>{totalRead.toLocaleString("en-US")} خوانده‌شده</span>
                <span>{totalMastered.toLocaleString("en-US")} تسلط</span>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 text-[13px]">
                <Link
                  href={`/library/campbell/chapter/${action.chapterNo}`}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-4 text-[13px] font-medium text-background transition-colors hover:bg-foreground/90"
                >
                  {primaryLabel} {action.chapterNo}
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Link>

                {weakChapterNo != null ? (
                  <Link
                    href={`/library/campbell/chapter/${weakChapterNo}`}
                    className="inline-flex items-center gap-2 border-b border-border/80 pb-1 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    مرور فصل‌های ضعیف
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive/80" />
                  </Link>
                ) : (
                  <Link
                    href="#volumes"
                    className="inline-flex items-center gap-2 border-b border-border/80 pb-1 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    مرور جلدها
                    <Compass className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </>
          ) : (
            <>
              <h1 className="ll-balance mt-3 max-w-3xl text-[2rem] font-semibold leading-[1.06] tracking-[-0.045em] text-foreground lg:text-[2.65rem]">
                از اولین فصل موجود شروع کنید.
              </h1>
              <p className="mt-3 max-w-2xl text-[13px] leading-6 text-muted-foreground/76">
                فصل‌ها به محض در دسترس شدن محتوا اینجا نمایش داده می‌شوند.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 text-[13px]">
                <Link
                  href="#volumes"
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-4 text-[13px] font-medium text-background transition-colors hover:bg-foreground/90"
                >
                  مرور جلدها
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="space-y-5 border-t border-border/48 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-1">
          <div className="border-t border-border/48 pt-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/56">
              کتاب
            </div>
            <div className="mt-3 text-[13px] font-medium text-foreground">
              Campbell-Walsh-Wein Urology
            </div>
            <div className="mt-1 text-[12px] leading-6 text-muted-foreground/72">
              {volumeCount} جلد / {totalIncluded.toLocaleString("en-US")} فصل
            </div>
          </div>

          <div className="border-t border-border/48 pt-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/56">
              جای فعلی
            </div>
            {action ? (
              <>
                <div className="mt-3 text-[13px] font-medium text-foreground">
                  فصل {action.chapterNo}
                </div>
                <div dir="ltr" className="mt-1 text-[13px] leading-6 text-left text-muted-foreground/78">
                  {featuredContext?.title ?? action.title}
                </div>
                {featuredContext ? (
                  <div className="mt-2 text-[12px] leading-6 text-muted-foreground/64">
                    جلد {featuredContext.volume} / {featuredContext.part}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="mt-3 text-[13px] leading-6 text-muted-foreground/78">
                هنوز فصلی ایندکس نشده است.
              </div>
            )}
          </div>

          <div className="border-t border-border/48 pt-5">
            <div className="flex items-baseline justify-between gap-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/56">
                پیشرفت مطالعه
              </div>
              <div className="text-[12px] font-medium tabular-nums text-foreground/76">
                {completionPct}%
              </div>
            </div>
            <div className="mt-4 h-px bg-border/48">
              <div
                className="h-px bg-foreground/36"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <p className="mt-3 text-[12.5px] leading-6 text-muted-foreground/76">
              {progressCopy}
            </p>
          </div>

          <div className="border-t border-border/48 pt-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/56">
              گام بعدی
            </div>
            <div className="mt-3 text-[13px] leading-6 text-muted-foreground/78">
              {weakChapterNo != null
                ? `پس از فصل فعلی، فصل ${weakChapterNo} را مرور کنید.`
                : "ادامه مطالعه یا مرور جلد بعدی."}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ContinueReadingList({
  rows,
  fallbackChapterNo,
  contextByChapterNo,
  renderedAt,
}: {
  rows: LibraryDashboardData["recentlyRead"];
  fallbackChapterNo: number | null;
  contextByChapterNo: Map<number, ChapterContext>;
  renderedAt: number;
}) {
  if (rows.length === 0) {
    return (
      <div className="border-t border-border/36 py-6">
        <p className="text-[14px] font-medium text-foreground">
          هنوز فصلی شروع نشده.
        </p>
        <p className="mt-2 max-w-xl text-[13px] leading-6 text-muted-foreground/76">
          از اولین فصل موجود شروع کنید.
        </p>
        {fallbackChapterNo != null ? (
          <Link
            href={`/library/campbell/chapter/${fallbackChapterNo}`}
            className="mt-4 inline-flex items-center gap-2 border-b border-foreground/14 pb-1 text-[13px] font-medium text-foreground transition-colors hover:border-foreground/40"
          >
            شروع فصل {fallbackChapterNo}
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="border-t border-border/36">
      {rows.map((row) => {
        const context = contextByChapterNo.get(row.chapterNo);

        return (
          <Link
            key={row.chapterNo}
            href={chapterHref(row.chapterNo, row.href)}
            className="group grid gap-3 rounded-2xl border border-transparent px-3 py-3 transition-all ll-hover-soft hover:border-border/55 sm:grid-cols-[64px_minmax(0,1fr)_72px]"
          >
            <div className="pt-0.5">
              <span className="ll-chip-green h-7 min-w-7 px-2 text-[10px] font-semibold ll-meta">
                {row.chapterNo}
              </span>
            </div>
            <div className="min-w-0">
              <div dir="ltr" className="ll-clamp-2 text-left text-[14px] font-medium leading-[1.5] text-foreground/92 group-hover:text-foreground">
                {row.title}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground/56">
                {context ? (
                  <>
                    <span>جلد {context.volume}</span>
                    <span className="h-1 w-1 rounded-full bg-border/70" />
                    <span className="truncate">{context.part}</span>
                    <span className="h-1 w-1 rounded-full bg-border/70" />
                  </>
                ) : null}
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(row.lastReadAt, renderedAt)}
                </span>
              </div>
            </div>
            <div className="pt-0.5 sm:text-left">
              <span className="rounded-full border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground/52 transition-colors group-hover:text-foreground/72">
                بازگشت
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function WeakChaptersList({
  rows,
  hasAnyAttempts,
  contextByChapterNo,
}: {
  rows: LibraryDashboardData["weakChapters"];
  hasAnyAttempts: boolean;
  contextByChapterNo: Map<number, ChapterContext>;
}) {
  if (rows.length === 0) {
    return (
      <div className="border-t border-border/36 py-6">
        <p className="text-[14px] font-medium text-foreground">
          {hasAnyAttempts ? "فصل ضعیفی در حال حاضر وجود ندارد." : "هنوز سابقه‌ای از سوالات وجود ندارد."}
        </p>
        <p className="mt-2 max-w-xl text-[13px] leading-6 text-muted-foreground/76">
          {hasAnyAttempts
            ? "تمام فصل‌های ردیابی‌شده بالای آستانه فصل ضعیف هستند."
            : "فصل‌های ضعیف پس از شروع فعالیت سوالات اینجا نمایش داده می‌شوند."}
        </p>
        <Link
          href="/qbank"
          className="mt-4 inline-flex items-center gap-2 border-b border-foreground/14 pb-1 text-[13px] font-medium text-foreground transition-colors hover:border-foreground/40"
        >
          رفتن به بانک سوالات
          <ArrowLeft className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="border-t border-border/36">
      {rows.map((row) => {
        const context = contextByChapterNo.get(row.chapterNo);
        const accuracyTone =
          row.accuracyPercent < 40
            ? "text-destructive"
            : row.accuracyPercent < 60
            ? "text-warning"
            : "text-muted-foreground/58";

        return (
          <Link
            key={row.chapterNo}
            href={chapterHref(row.chapterNo, row.href)}
            className="group grid gap-3 rounded-2xl border border-transparent px-3 py-3 transition-all ll-hover-soft hover:border-border/55 sm:grid-cols-[64px_minmax(0,1fr)_104px]"
          >
            <div className="pt-0.5">
              <span className="ll-chip-orange h-7 min-w-7 px-2 text-[10px] font-semibold ll-meta">
                {row.chapterNo}
              </span>
            </div>
            <div className="min-w-0">
              <div dir="ltr" className="ll-clamp-2 text-left text-[14px] font-medium leading-[1.5] text-foreground/92 group-hover:text-foreground">
                {row.title}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] tabular-nums text-muted-foreground/56">
                {context ? (
                  <>
                    <span>جلد {context.volume}</span>
                    <span className="h-1 w-1 rounded-full bg-border/70" />
                    <span className="truncate">{context.part}</span>
                    <span className="h-1 w-1 rounded-full bg-border/70" />
                  </>
                ) : null}
                <span>{row.correct}/{row.attempted} صحیح</span>
              </div>
            </div>
            <div className="flex flex-col items-start gap-1 pt-0.5 sm:items-end">
              <div className={cn("rounded-full border px-2.5 py-1 text-[12px] font-medium tabular-nums", accuracyTone)}>
                {row.accuracyPercent}%
              </div>
              <div className="text-[11px] text-muted-foreground/44 transition-colors group-hover:text-foreground/66">
                مرور
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function VolumeIndex({ volumes }: { volumes: CampbellVolumeSummary[] }) {
  return (
    <div className="border-t border-border/36">
      {volumes.map((volume) => {
        const pct =
          volume.chapterCount > 0
            ? Math.round((volume.readCount / volume.chapterCount) * 100)
            : 0;

        return (
          <Link
            key={volume.volumeNo}
            href={volume.href}
            className="group grid gap-4 rounded-[22px] border border-border/60 bg-background px-4 py-4 transition-all hover:-translate-y-[1px] hover:border-border/85 hover:shadow-[0_10px_24px_hsl(var(--foreground)/0.04)] lg:grid-cols-[110px_minmax(0,1fr)_170px]"
          >
            <div className="pt-0.5">
              <div className="ll-chip-green h-9 w-9">
                <Layers3 className="h-4 w-4" />
              </div>
              <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/56">
                جلد {volume.volumeNo}
              </div>
            </div>

            <div className="min-w-0">
              <div dir="ltr" className="text-[16px] font-medium tracking-[-0.025em] text-left text-foreground/94 group-hover:text-foreground">
                {volume.title}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground/68">
                <span>{volume.chapterCount} فصل</span>
                <span>{volume.availableChapterCount} در دسترس</span>
                <span>{volume.segmentCount} بخش</span>
                <span>{volume.masteredCount} تسلط</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 lg:items-end">
              <div className="text-[12px] font-medium text-foreground/72 group-hover:text-foreground">
                <span className="rounded-full border border-border/60 px-2.5 py-1">
                  باز کردن جلد
                </span>
              </div>
              <div className="w-full lg:w-32">
                <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-muted-foreground/46">
                  <span>{pct}%</span>
                  <span>
                    {volume.readCount}/{volume.chapterCount}
                  </span>
                </div>
                <div className="mt-2 h-px bg-border/46">
                  <div
                    className="h-px bg-foreground/34 transition-colors group-hover:bg-primary/70"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function StatusLegend() {
  const items = [
    {
      label: "شروع نشده",
      icon: <Circle className="h-2.5 w-2.5 text-muted-foreground/40" />,
      tone: "muted",
    },
    {
      label: "در حال مطالعه",
      icon: <Disc className="h-2.5 w-2.5 text-primary" />,
      tone: "green",
    },
    {
      label: "خوانده‌شده",
      icon: <Check className="h-2.5 w-2.5 text-success" />,
      tone: "green",
    },
    {
      label: "مرور شده",
      icon: <CheckCheck className="h-2.5 w-2.5 text-success" />,
      tone: "green",
    },
    {
      label: "تسلط",
      icon: <Star className="h-2.5 w-2.5 fill-warning text-warning" />,
      tone: "orange",
    },
  ] as const;

  return (
    <div className="ll-surface-card rounded-[22px] p-5">
      <div className="flex items-center gap-2">
        <span className="ll-chip-muted h-7 w-7">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <div className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground/58">
          وضعیت‌ها
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2.5">
        {items.map((item) => (
          <span
            key={item.label}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px]",
              item.tone === "orange"
                ? "border-amber-200/60 bg-amber-50/60 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
                : item.tone === "green"
                ? "border-primary/18 bg-primary/8 text-foreground"
                : "border-border/60 bg-background text-muted-foreground/72",
            )}
          >
            {item.icon}
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export type LinearLibraryViewProps = {
  navigation: CampbellVolumeGroup[];
  dashboard: LibraryDashboardData;
  volumes: CampbellVolumeSummary[];
  renderedAt: number;
};

export function LinearLibraryView({
  navigation,
  dashboard,
  volumes,
  renderedAt,
}: LinearLibraryViewProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        const input = document.getElementById("ll-search") as HTMLInputElement | null;
        input?.focus();
        input?.select();
      }

      if (event.key === "Escape" && document.activeElement?.id === "ll-search") {
        setQuery("");
        (document.activeElement as HTMLElement).blur();
      }

      if (
        event.key === "Enter" &&
        document.activeElement?.id === "ll-search" &&
        /^\d+$/.test(query.trim())
      ) {
        const chapterNo = Number(query.trim());
        if (chapterNo > 0) {
          router.push(`/library/campbell/chapter/${chapterNo}`);
        }
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [query, router]);

  const completionPct =
    dashboard.totalIncluded > 0
      ? Math.round((dashboard.totalRead / dashboard.totalIncluded) * 100)
      : 0;

  const nextAction = useMemo(
    () => pickNextAction(dashboard, navigation, renderedAt),
    [dashboard, navigation, renderedAt],
  );

  const featuredChapterNo = nextAction?.chapterNo ?? null;
  const featuredContext = useMemo(
    () => findChapterContext(navigation, featuredChapterNo),
    [featuredChapterNo, navigation],
  );
  const contextByChapterNo = useMemo(
    () => buildChapterContextMap(navigation),
    [navigation],
  );

  const fallbackChapterNo = useMemo(() => {
    for (const volume of navigation) {
      for (const part of volume.parts) {
        const chapter = part.chapters.find((item) => item.isLinked);
        if (chapter) return chapter.chapterNo;
      }
    }

    return navigation[0]?.parts[0]?.chapters[0]?.chapterNo ?? null;
  }, [navigation]);

  const weakChapterNo = dashboard.weakChapters[0]?.chapterNo ?? null;
  const hasAnyAttempts = useMemo(
    () => dashboard.parts.some((part) => part.accuracyPercent != null),
    [dashboard.parts],
  );

  return (
    <div className="flex h-[100dvh] flex-col bg-background text-foreground">
      <style dangerouslySetInnerHTML={{ __html: LIB_CSS }} />

      <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border/42 bg-background/92 px-5 backdrop-blur md:px-8">
  <div className="flex items-center gap-3 text-[12px]">
    <span className="ll-chip-green h-8 w-8">
      <Library className="h-4 w-4" />
    </span>

    <div className="flex items-center gap-2">
      <span className="font-semibold tracking-tight text-foreground">
        Campbell-Walsh-Wein
      </span>
      <span className="text-muted-foreground/36">/</span>
      <span className="text-muted-foreground/82">کتابخانه</span>
    </div>
  </div>

  <div className="relative flex-1 max-w-xl">
    <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/48" />
    <Input
      id="ll-search"
      type="text"
      inputSize="sm"
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      onFocus={() => setSearchFocused(true)}
      onBlur={() => setSearchFocused(false)}
      placeholder="جستجوی فصل یا پرش به شماره فصل"
      className="h-10 rounded-full border border-border/60 bg-foreground/[0.02] px-0 pr-10 text-[12.5px] shadow-none placeholder:text-muted-foreground/42 focus-visible:ring-0 focus-visible:ring-offset-0"
    />
    {!searchFocused && !query ? (
      <kbd className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-border/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/42">
        Cmd K
      </kbd>
    ) : null}
  </div>

  <div className="hidden items-center gap-2 lg:flex">
    <span className="ll-chip-orange h-8 px-3 text-[11px] font-semibold ll-meta">
      {completionPct}%
    </span>
    <span className="text-[11px] text-muted-foreground/68">خوانده‌شده</span>
  </div>
</header>

      <div className="flex min-h-0 flex-1">
        <aside className="ll-scroll hidden w-[340px] shrink-0 overflow-y-auto border-r border-border/42 xl:w-[360px] md:block">
          <div className="sticky top-0 px-6 py-8">
<div className="border-b border-border/42 pb-6">
  <div className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/56">
    فهرست مطالب
  </div>

  <div className="mt-4 flex items-center justify-between gap-3">
    <div className="text-[13px] font-medium text-foreground">
      {featuredChapterNo != null ? `فصل ${featuredChapterNo}` : "مرور کتاب"}
    </div>

    <span className="ll-chip-orange h-7 w-7">
      <Sparkles className="h-3.5 w-3.5" />
    </span>
  </div>

  <div className="mt-3 space-y-2">
    {featuredContext ? (
      <>
        <div
          dir="ltr"
          className="ll-clamp-3 text-left text-[12.5px] leading-[1.75] text-foreground/90"
        >
          {featuredContext.title}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] leading-6 text-muted-foreground/66">
          <span>جلد {featuredContext.volume}</span>
          <span className="h-1 w-1 rounded-full bg-border/70" />
          <span>{featuredContext.part}</span>
        </div>
      </>
    ) : (
      <p className="text-[12px] leading-6 text-muted-foreground/72">
        از فهرست مطالب فصل مورد نظر را انتخاب کنید.
      </p>
    )}
  </div>
</div>
            <div className="pt-6">
              <ChapterTree
                navigation={navigation}
                query={query}
                featuredChapterNo={featuredChapterNo}
              />
            </div>
          </div>
        </aside>

        <main className="ll-scroll min-w-0 flex-1 overflow-y-auto">
          <div className="w-full max-w-none px-4 py-6 md:px-5 lg:px-6 lg:py-8">
            <PageAnchor
              action={nextAction}
              featuredContext={featuredContext}
              weakChapterNo={weakChapterNo}
              completionPct={completionPct}
              totalIncluded={dashboard.totalIncluded}
              totalRead={dashboard.totalRead}
              totalMastered={dashboard.totalMastered}
              volumeCount={volumes.length}
            />

            <section className="py-9">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="ll-surface-card rounded-[24px] p-5 md:p-6">
                  <SectionHeading
                    eyebrow="مطالعه"
                    title="ادامه مطالعه"
                    description="فصل‌های اخیر و نقاط بازگشت."
                    count={
                      dashboard.recentlyRead.length > 0
                        ? `${dashboard.recentlyRead.length} اخیر`
                        : undefined
                    }
                    icon={<Clock className="h-3.5 w-3.5" />}
                    tone="green"
                  />
                  <div className="mt-4">
                    <ContinueReadingList
                      rows={dashboard.recentlyRead}
                      fallbackChapterNo={fallbackChapterNo}
                      contextByChapterNo={contextByChapterNo}
                      renderedAt={renderedAt}
                    />
                  </div>
                </div>

                <div className="ll-surface-card rounded-[24px] p-5 md:p-6">
                  <SectionHeading
                    eyebrow="مرور"
                    title="فصل‌های ضعیف"
                    description="فصل‌هایی با دقت زیر ۶۰ درصد."
                    count={
                      dashboard.weakChapters.length > 0
                        ? `${dashboard.weakChapters.length} ضعیف`
                        : undefined
                    }
                    icon={<TrendingUp className="h-3.5 w-3.5" />}
                    tone="orange"
                  />
                  <div className="mt-4">
                    <WeakChaptersList
                      rows={dashboard.weakChapters}
                      hasAnyAttempts={hasAnyAttempts}
                      contextByChapterNo={contextByChapterNo}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section id="volumes" className="py-4">
              <div className="ll-surface-card rounded-[26px] p-5 md:p-6">
              <SectionHeading
                eyebrow="مرور"
                title="جلدها"
                description="مرور کتاب بر اساس جلد."
                count={`${volumes.length} جلد`}
                icon={<Layers3 className="h-3.5 w-3.5" />}
                tone="green"
              />
              <div className="mt-4">
                <VolumeIndex volumes={volumes} />
              </div>
              </div>
            </section>

            <section className="border-t border-border/42 py-8">
              <StatusLegend />
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
