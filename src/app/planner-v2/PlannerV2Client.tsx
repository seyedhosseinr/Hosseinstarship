"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar as CalendarIcon,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  GraduationCap,
  Layers,
  MinusCircle,
  Search,
  Target,
  TrendingUp,
  XCircle,
} from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  PERSIAN_WEEKDAYS,
  toPersianNum,
  formatPersianMonth,
  formatPersianDate,
} from "@/lib/utils/persian-calendar";
import {
  getMonthPlanAction,
  getPlannerSummaryAction,
} from "@/lib/actions/planner-runtime-actions";
import type {
  MonthPlanDay,
  MonthPlanResult,
  PlannerSummary,
  SupportedPlannerTask,
} from "@/lib/planner/runtime-types";

/* ------------------------------------------------------------------ */
/*  Constants — colors and labels                                      */
/* ------------------------------------------------------------------ */

const COLOR = {
  green: "#10b981",
  orange: "#f97316",
  purple: "#8b5cf6",
  blue: "#3b82f6",
  red: "#ef4444",
  muted: "#64748b",
} as const;

const TASK_TYPE_LABEL_FA: Record<string, string> = {
  chapter_read: "مطالعه فصل",
  chunk_review: "مرور بخش",
  flashcard_review: "مرور فلش‌کارت",
  question_block: "بلوک سؤال",
  notebook_review: "بازخوانی نوت",
  exam_block: "آزمون شبیه‌ساز",
  weak_area_review: "نقاط ضعف",
  custom_task: "تسک سفارشی",
};

const STATUS_CHIP: Record<
  string,
  { label: string; color: string; bg: string; icon: typeof CheckCircle2 }
> = {
  completed: { label: "تکمیل شده", color: COLOR.green, bg: "rgba(16,185,129,0.08)", icon: CheckCircle2 },
  in_progress: { label: "در جریان", color: COLOR.orange, bg: "rgba(249,115,22,0.08)", icon: Clock },
  pending: { label: "در انتظار", color: COLOR.muted, bg: "rgba(100,116,139,0.08)", icon: MinusCircle },
  overdue: { label: "عقب‌افتاده", color: COLOR.red, bg: "rgba(239,68,68,0.08)", icon: XCircle },
  skipped: { label: "رد شده", color: COLOR.muted, bg: "rgba(100,116,139,0.08)", icon: MinusCircle },
  rescheduled: { label: "جابجا شده", color: COLOR.blue, bg: "rgba(59,130,246,0.08)", icon: Clock },
};

/* ------------------------------------------------------------------ */
/*  Utilities                                                          */
/* ------------------------------------------------------------------ */

function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIsoDate(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

function daysBetween(fromIso: string, toIso: string) {
  const a = parseIsoDate(fromIso).getTime();
  const b = parseIsoDate(toIso).getTime();
  return Math.round((b - a) / 86_400_000);
}

function formatMinutes(min: number): string {
  if (min < 60) return `${toPersianNum(min)} دقیقه`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `${toPersianNum(h)} ساعت`;
  return `${toPersianNum(h)} ساعت ${toPersianNum(m)} دقیقه`;
}

/* ------------------------------------------------------------------ */
/*  Calendar bars derivation                                           */
/* ------------------------------------------------------------------ */

interface Bar {
  color: string;
  key: string;
}

function barsForDay(day: MonthPlanDay): { bars: Bar[]; hidden: number } {
  if (day.tasks.length === 0) return { bars: [], hidden: 0 };

  const bars: Bar[] = [];
  const seen = new Set<string>();
  const push = (color: string, key: string) => {
    if (seen.has(color)) return;
    seen.add(color);
    bars.push({ color, key });
  };

  const hasExam = day.tasks.some((t) => t.taskType === "exam_block");
  if (hasExam) push(COLOR.purple, "exam");

  // Audit days: Friday with any task → blue bar (visual cue for weekly audit)
  const isAudit = day.dayOfWeek === "friday" && day.tasks.length > 0;
  if (isAudit) push(COLOR.blue, "audit");

  const hasOverdue = day.tasks.some((t) => t.status === "overdue");
  if (hasOverdue) push(COLOR.red, "overdue");

  const completedCount = day.tasks.filter((t) => t.status === "completed").length;
  if (completedCount > 0) push(COLOR.green, "completed");

  const pendingCount = day.tasks.filter(
    (t) => t.status === "pending" || t.status === "in_progress",
  ).length;
  if (pendingCount > 0) push(COLOR.orange, "pending");

  const capped = bars.slice(0, 3);
  const hidden = Math.max(0, bars.length - 3);
  return { bars: capped, hidden };
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function PlannerCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card",
        "border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.08)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function CalendarCell({
  day,
  todayIso,
}: {
  day: MonthPlanDay;
  todayIso: string;
}) {
  const { bars, hidden } = barsForDay(day);
  const isToday = day.date === todayIso;
  const outOfMonth = !day.inMonth;
  const dayNumber = parseIsoDate(day.date).getDate();

  return (
    <div
      className={cn(
        "relative flex min-h-[120px] flex-col border border-[rgba(0,0,0,0.04)] px-3 pt-2.5 pb-2 dark:border-[rgba(255,255,255,0.06)]",
        outOfMonth && "planner-v2-stripe",
        isToday && "bg-[rgba(124,58,237,0.06)] dark:bg-[rgba(167,139,250,0.10)]",
      )}
    >
      <div
        className={cn(
          "text-[14px] font-medium tabular-nums",
          outOfMonth && "text-muted-foreground/50",
          !outOfMonth && !isToday && "text-foreground",
          isToday && "text-[#7c3aed] dark:text-[#a78bfa]",
        )}
      >
        {toPersianNum(dayNumber)}
      </div>

      {/* Event bars — bottom of cell */}
      <div className="mt-auto flex flex-col gap-1.5">
        {bars.map((bar) => (
          <div
            key={bar.key}
            className="h-1 rounded-[2px]"
            style={{ backgroundColor: bar.color }}
          />
        ))}
        {hidden > 0 ? (
          <div className="text-[10px] font-medium text-muted-foreground">
            +{toPersianNum(hidden)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type MonthState = "loading" | "ready" | "empty" | "error";

function MonthCalendar({
  month,
  anchor,
  onPrev,
  onNext,
  todayIso,
  state,
}: {
  month: MonthPlanResult | null;
  anchor: Date | null;
  onPrev: () => void;
  onNext: () => void;
  todayIso: string;
  state: MonthState;
}) {
  return (
    <PlannerCard>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[rgba(0,0,0,0.04)] px-5 py-4 dark:border-[rgba(255,255,255,0.06)]">
        <div className="text-[18px] font-medium text-foreground">
          {anchor ? formatPersianMonth(anchor) : "—"}
        </div>
        <div className="inline-flex items-center rounded-full bg-muted/50 p-0.5">
          <button
            type="button"
            aria-label="ماه قبل"
            onClick={onPrev}
            className="inline-flex h-7 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          >
            <ChevronRight size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label="ماه بعد"
            onClick={onNext}
            className="inline-flex h-7 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          >
            <ChevronLeft size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-[rgba(0,0,0,0.04)] dark:border-[rgba(255,255,255,0.06)]">
        {PERSIAN_WEEKDAYS.map((w) => (
          <div
            key={w}
            className="py-3 text-center text-[11px] font-semibold tracking-wider text-muted-foreground"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Grid body — loading / error / empty / populated */}
      {state === "ready" && month ? (
        <div className="grid grid-cols-7">
          {month.days.map((d) => (
            <CalendarCell key={d.date} day={d} todayIso={todayIso} />
          ))}
        </div>
      ) : state === "loading" ? (
        <div className="grid grid-cols-7">
          {Array.from({ length: 42 }).map((_, i) => (
            <div
              key={i}
              className="min-h-[120px] animate-pulse border border-[rgba(0,0,0,0.04)] bg-muted/20 dark:border-[rgba(255,255,255,0.06)]"
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
          <AlertCircle size={20} className="text-muted-foreground/70" />
          <div className="text-[14px] font-medium text-foreground">
            {state === "error"
              ? "خطا در دریافت داده‌های ماه"
              : "داده‌ای برای این ماه ثبت نشده است"}
          </div>
          <div className="max-w-[380px] text-[12.5px] text-muted-foreground">
            {state === "error"
              ? "ارتباط با سرور پلن ناموفق بود. چند لحظه بعد دوباره تلاش کنید یا با فلش‌ها به ماه‌های دیگر بروید."
              : "با فلش‌های بالا به ماه‌های دیگر بروید یا پلن فعال ABU را seed کنید (DB_RUNTIME=pglite npx tsx src/db/seed-abu-2026.ts)."}
          </div>
        </div>
      )}
    </PlannerCard>
  );
}

function StudyLogTable({
  tasks,
  query,
  onQueryChange,
  totalInMonth,
}: {
  tasks: SupportedPlannerTask[];
  query: string;
  onQueryChange: (v: string) => void;
  totalInMonth: number;
}) {
  return (
    <PlannerCard>
      <div className="flex items-center justify-between gap-3 border-b border-[rgba(0,0,0,0.04)] px-5 py-4 dark:border-[rgba(255,255,255,0.06)]">
        <div className="flex items-baseline gap-2">
          <div className="text-[16px] font-semibold text-foreground">لاگ مطالعه</div>
          <div className="text-[12px] tabular-nums text-muted-foreground">
            {toPersianNum(totalInMonth)} مورد در این ماه
          </div>
        </div>
        <div className="relative">
          <Search
            size={13}
            className="pointer-events-none absolute inset-y-0 end-2.5 my-auto text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="جستجو در عنوان / نوع / یادداشت"
            className="h-8 w-60 rounded-full border-border/60 bg-muted/30 pe-8 text-[12.5px]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="bg-muted/40 text-[11px] font-medium tracking-wider text-muted-foreground">
              <th className="px-5 py-3 text-start font-medium">وضعیت</th>
              <th className="px-5 py-3 text-start font-medium">نوع</th>
              <th className="px-5 py-3 text-start font-medium">زمان</th>
              <th className="px-5 py-3 text-start font-medium">تاریخ</th>
              <th className="px-5 py-3 text-start font-medium">عنوان</th>
              <th className="px-5 py-3 text-start font-medium">یادداشت</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-10 text-center text-[13px] text-muted-foreground"
                >
                  {totalInMonth === 0
                    ? "هیچ جلسه‌ای در این ماه ثبت نشده است."
                    : "هیچ نتیجه‌ای برای جستجوی شما یافت نشد."}
                </td>
              </tr>
            ) : (
              tasks.map((t) => {
                const chip = STATUS_CHIP[t.status] ?? STATUS_CHIP.pending;
                const ChipIcon = chip.icon;
                const typeLabel = TASK_TYPE_LABEL_FA[t.taskType] ?? t.taskType;
                return (
                  <tr
                    key={t.id}
                    className="border-b border-[rgba(0,0,0,0.04)] transition-colors last:border-b-0 hover:bg-muted/30 dark:border-[rgba(255,255,255,0.06)]"
                    style={{ height: "56px" }}
                  >
                    <td className="px-5 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium"
                        style={{ backgroundColor: chip.bg, color: chip.color }}
                      >
                        <ChipIcon size={12} strokeWidth={2.25} />
                        {chip.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-foreground">{typeLabel}</td>
                    <td className="px-5 py-3 tabular-nums text-muted-foreground">
                      {formatMinutes(t.estimatedMinutes)}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-muted-foreground">
                      {t.scheduledDate
                        ? formatPersianDate(parseIsoDate(t.scheduledDate))
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-foreground">
                      <div className="truncate" title={t.title}>
                        {t.linkedChapter
                          ? `فصل ${toPersianNum(t.linkedChapter.chapterNo)} — ${t.linkedChapter.title}`
                          : t.title}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      <div className="max-w-[240px] truncate">
                        {t.description ?? "—"}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </PlannerCard>
  );
}

/* ------------------------------------------------------------------ */
/*  Right summary rail                                                 */
/* ------------------------------------------------------------------ */

interface StatCardProps {
  icon: typeof CheckCircle2;
  tintBg: string;
  tintFg: string;
  valueNode: React.ReactNode;
  description: string;
  linkLabel?: string;
  linkHref?: string;
}

function StatCard(props: StatCardProps) {
  const { icon: Icon, tintBg, tintFg, valueNode, description, linkLabel, linkHref } = props;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4",
        "border-[rgba(0,0,0,0.06)] bg-card dark:border-[rgba(255,255,255,0.08)]",
      )}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: tintBg }}
      >
        <Icon size={18} strokeWidth={1.75} style={{ color: tintFg }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium text-foreground">{valueNode}</div>
        <div className="mt-0.5 text-[12px] text-muted-foreground">{description}</div>
        {linkLabel ? (
          <a
            href={linkHref ?? "#"}
            className="mt-1.5 inline-block text-[12px] font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {linkLabel}
          </a>
        ) : null}
      </div>
    </div>
  );
}

function RightRail({
  summary,
  month,
  todayIso,
  examDateIso,
}: {
  summary: PlannerSummary | null;
  month: MonthPlanResult | null;
  todayIso: string;
  examDateIso: string | null;
}) {
  // Days to exam
  const daysToExam = examDateIso ? daysBetween(todayIso, examDateIso) : null;

  // Sessions this week: count tasks whose scheduled date is within current ISO week (starting today).
  const sessionsThisWeek = useMemo(() => {
    if (!month) return 0;
    const weekEnd = toIsoDate(new Date(parseIsoDate(todayIso).getTime() + 6 * 86_400_000));
    let count = 0;
    for (const d of month.days) {
      if (d.date >= todayIso && d.date <= weekEnd) count += d.tasks.length;
    }
    return count;
  }, [month, todayIso]);

  const overdueCount = summary?.overdueTasks ?? 0;
  const totalChapters = summary?.plan?.selectedChapterCount ?? 0;
  const reviewsDue = summary?.upcomingTaskCount ?? 0;
  const completedToday = summary?.today?.completedTasks ?? 0;
  const streak = summary?.streak.current ?? 0;
  const planTitle = summary?.plan?.title ?? "پلن فعال";

  return (
    <aside className="flex w-[320px] shrink-0 flex-col gap-3">
      {/* Header card — real plan title, no dead button */}
      <div
        className={cn(
          "flex items-center justify-between rounded-xl border px-4 py-3",
          "border-[rgba(0,0,0,0.06)] bg-card dark:border-[rgba(255,255,255,0.08)]",
        )}
      >
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-foreground">آمار برنامه</div>
          <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground" title={planTitle}>
            {planTitle}
          </div>
        </div>
      </div>

      <StatCard
        icon={Target}
        tintBg="rgb(236 253 245)"
        tintFg="#059669"
        valueNode={
          <>
            {daysToExam === null ? (
              <span className="tabular-nums">—</span>
            ) : daysToExam >= 0 ? (
              <>
                <span className="tabular-nums font-bold">
                  {toPersianNum(daysToExam)}
                </span>{" "}
                روز تا امتحان
              </>
            ) : (
              <>
                <span className="tabular-nums font-bold">
                  {toPersianNum(Math.abs(daysToExam))}
                </span>{" "}
                روز از امتحان گذشته
              </>
            )}
          </>
        }
        description={
          examDateIso
            ? `تاریخ آزمون: ${formatPersianDate(parseIsoDate(examDateIso))}`
            : "تاریخ آزمون تعیین نشده"
        }
      />

      <StatCard
        icon={Clock}
        tintBg="rgb(255 247 237)"
        tintFg="#ea580c"
        valueNode={
          <>
            <span className="tabular-nums font-bold">{toPersianNum(reviewsDue)}</span>{" "}
            مرور معوق
          </>
        }
        description="در انتظار مرور FSRS"
      />

      <StatCard
        icon={CalendarDays}
        tintBg="rgb(239 246 255)"
        tintFg="#2563eb"
        valueNode={
          <>
            <span className="tabular-nums font-bold">{toPersianNum(sessionsThisWeek)}</span>{" "}
            جلسه این هفته
          </>
        }
        description="شامل روزهای تا شش روز آینده"
      />

      <StatCard
        icon={Layers}
        tintBg="rgb(240 253 250)"
        tintFg="#0d9488"
        valueNode={
          <>
            <span className="tabular-nums font-bold">{toPersianNum(totalChapters)}</span>{" "}
            فصل در پلن
          </>
        }
        description="در ۱۳ هفته فشرده Campbell"
      />

      <StatCard
        icon={TrendingUp}
        tintBg="rgb(253 242 248)"
        tintFg="#db2777"
        valueNode={
          <>
            <span className="tabular-nums font-bold">{toPersianNum(overdueCount)}</span>{" "}
            فصل عقب‌افتاده
          </>
        }
        description={
          overdueCount === 0 ? "هیچ تسک عقب‌افتاده‌ای نیست" : "نیازمند جبران در هفته جاری"
        }
      />

      <StatCard
        icon={GraduationCap}
        tintBg="rgb(245 243 255)"
        tintFg="#7c3aed"
        valueNode={
          <>
            <span className="tabular-nums font-bold">{toPersianNum(completedToday)}</span>{" "}
            تسک امروز
          </>
        }
        description={streak > 0 ? `استریک فعلی: ${toPersianNum(streak)} روز` : "هنوز جلسه‌ای ثبت نکرده‌اید"}
        linkLabel="مشاهده پلن کامل"
        linkHref="/planner"
      />
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                           */
/* ------------------------------------------------------------------ */

export default function PlannerV2Client() {
  // Anchor is initialised only after summary arrives — so we can default to a month that
  // actually has plan data (clamp today to the plan's [startDate, endDate] window).
  const [anchor, setAnchor] = useState<Date | null>(null);
  const [month, setMonth] = useState<MonthPlanResult | null>(null);
  const [summary, setSummary] = useState<PlannerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const todayIso = useMemo(() => toIsoDate(new Date()), []);

  const fetchMonth = useCallback(async (date: Date) => {
    setLoading(true);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const res = await getMonthPlanAction(year, month);
    if (res.ok) setMonth(res.data);
    else setMonth(null);
    setLoading(false);
  }, []);

  const fetchSummary = useCallback(async () => {
    const res = await getPlannerSummaryAction();
    if (res.ok) setSummary(res.data);
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Default the anchor once we know plan dates: today if inside [start, end], else clamp to start.
  useEffect(() => {
    if (anchor || !summary?.plan) return;
    const planStart = summary.plan.startDate;
    const planEnd = summary.plan.endDate ?? planStart;
    const now = new Date();
    const pick =
      todayIso >= planStart && todayIso <= planEnd
        ? now
        : parseIsoDate(planStart);
    setAnchor(new Date(pick.getFullYear(), pick.getMonth(), 1));
  }, [summary, anchor, todayIso]);

  // Fallback: if summary is slow or absent, still render today's month after 500ms so the UI is not blocked.
  useEffect(() => {
    if (anchor) return;
    const timer = window.setTimeout(() => {
      if (!anchor) {
        const now = new Date();
        setAnchor(new Date(now.getFullYear(), now.getMonth(), 1));
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [anchor]);

  useEffect(() => {
    if (!anchor) return;
    fetchMonth(anchor);
  }, [anchor, fetchMonth]);

  const handlePrev = useCallback(() => {
    setAnchor((cur) =>
      cur ? new Date(cur.getFullYear(), cur.getMonth() - 1, 1) : cur,
    );
  }, []);

  const handleNext = useCallback(() => {
    setAnchor((cur) =>
      cur ? new Date(cur.getFullYear(), cur.getMonth() + 1, 1) : cur,
    );
  }, []);

  // Flatten in-month tasks, most-recent first, filtered by query.
  const filteredTasks = useMemo(() => {
    if (!month) return [] as SupportedPlannerTask[];
    const all: SupportedPlannerTask[] = [];
    for (const d of month.days) {
      if (!d.inMonth) continue;
      for (const t of d.tasks) all.push(t);
    }
    all.sort((a, b) => {
      const aDate = a.scheduledDate ?? "";
      const bDate = b.scheduledDate ?? "";
      if (aDate !== bDate) return aDate > bDate ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
    if (!query.trim()) return all;
    const q = query.trim().toLowerCase();
    return all.filter((t) => {
      const hay = [
        t.title,
        t.description ?? "",
        t.linkedChapter?.title ?? "",
        TASK_TYPE_LABEL_FA[t.taskType] ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [month, query]);

  // Pull the exam date from the seed plan snapshot so editing PLAN_META.examDate flows through.
  const examDateIso = summary?.plan?.examDate ?? null;

  // Derive the month's visible state so the calendar shows real empty / error copy
  // instead of an infinite pulsing skeleton when the active plan is missing or the server errors.
  let monthState: MonthState;
  if (loading || !anchor) {
    monthState = "loading";
  } else if (month) {
    monthState = "ready";
  } else if (summary && summary.plan === null) {
    monthState = "empty";
  } else {
    monthState = "error";
  }

  const totalInMonth = month
    ? month.days.filter((d) => d.inMonth).reduce((s, d) => s + d.tasks.length, 0)
    : 0;

  return (
    <div data-planner-v2 className="flex flex-col gap-5">
      <PageHeader
        title="برنامه مطالعه"
        description={
          summary?.plan
            ? `${summary.plan.title} — ${toPersianNum(summary.plan.selectedChapterCount)} فصل انتخاب‌شده`
            : "پلن فعال برای این کاربر ثبت نشده است."
        }
        icon={<CalendarIcon size={18} className="text-muted-foreground" />}
        breadcrumb={[{ label: "داشبورد", href: "/" }, { label: "برنامه مطالعه" }]}
      />

      {/* 2-column layout: main workspace + right rail */}
      <div className="flex items-start gap-5">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <MonthCalendar
            month={month}
            anchor={anchor}
            onPrev={handlePrev}
            onNext={handleNext}
            todayIso={todayIso}
            state={monthState}
          />
          <StudyLogTable
            tasks={filteredTasks}
            query={query}
            onQueryChange={setQuery}
            totalInMonth={totalInMonth}
          />
        </div>
        <div className="hidden lg:block">
          <RightRail
            summary={summary}
            month={month}
            todayIso={todayIso}
            examDateIso={examDateIso}
          />
        </div>
      </div>

      {/* Mobile: render the rail below the main column */}
      <div className="lg:hidden">
        <RightRail
          summary={summary}
          month={month}
          todayIso={todayIso}
          examDateIso={examDateIso}
        />
      </div>
    </div>
  );
}

