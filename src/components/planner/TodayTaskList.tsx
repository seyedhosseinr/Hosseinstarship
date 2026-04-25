"use client";

/**
 * TodayTaskList — UWorld-style sectioned task view for the Today tab.
 *
 * Sections:
 * 1. Progress Summary header (overall stats)
 * 2. Overdue tasks (red alert, with move-to-today / snooze actions)
 * 3. Today's tasks (active work area)
 * 4. Upcoming (this week) — preview of what's next
 * 5. Completed (collapsible) — done / skipped tasks
 *
 * Fetches all data via getTodayPlanAction and getUpcomingTasksAction.
 */

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarCheck,
  AlertTriangle,
  PartyPopper,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Target,
  BookOpen,
  CreditCard,
  GraduationCap,
} from "lucide-react";
import { TaskCard } from "./TaskCard";
import {
  n,
  formatMinutes,
  formatPersianDate,
  useVisibilityRefresh,
  SECTION_LABEL,
} from "./task-helpers";
import { getTodayPlanAction, getUpcomingTasksAction } from "@/lib/actions/planner-runtime-actions";
import type { TodayPlanResult } from "@/lib/planner/runtime-types";
import { isLocalFirstEnabled } from "@/lib/local-first/flag";
import { getTodayPlanLocal, seedFromTodayPlan } from "@/lib/local-first/planner-local";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface UpcomingTask {
  id: string;
  taskType: string;
  status: string;
  title: string;
  description?: string | null;
  estimatedMinutes: number;
  actualMinutes: number;
  progressPercent: number;
  targetCount?: number | null;
  completedCount: number;
  priority: number;
  scheduledDate?: string | null;
  linkedChapter?: { id: string; title: string; chapterNo: number } | null;
  linkedChunk?: { id: string; title: string | null; chunkIndex: number } | null;
  linkedExamSession?: { id: string; title: string | null; status: string } | null;
  linkedDocument?: { docId: string; chapterNo: number; chapterTitle: string; chunkIndex: number } | null;
  linkedFrame?: { frameId: string; title: string; sectionId: string } | null;
}

/* ------------------------------------------------------------------ */
/*  Section Header                                                     */
/* ------------------------------------------------------------------ */

function SectionHeader({
  label,
  count,
  tone = "default",
  collapsible,
  collapsed,
  onToggle,
}: {
  label: string;
  count: number;
  /** Kept for back-compat — only "danger" changes the label color; all others are neutral. */
  color?: string;
  tone?: "default" | "danger" | "success";
  icon?: React.ElementType;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const labelClass =
    tone === "danger"
      ? "text-destructive/85"
      : tone === "success"
        ? "text-success"
        : "text-muted-foreground/60";

  const content = (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-baseline gap-2">
        <span
          className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${labelClass}`}
        >
          {label}
        </span>
        <span className="text-[11px] tabular-nums text-muted-foreground/55">
          {n(count)}
        </span>
      </div>
      {collapsible && (
        collapsed
          ? <ChevronDown size={13} className="text-muted-foreground/60" />
          : <ChevronUp size={13} className="text-muted-foreground/60" />
      )}
    </div>
  );

  if (collapsible && onToggle) {
    return (
      <button
        onClick={onToggle}
        className="w-full rounded-md px-1 text-right transition-colors hover:bg-foreground/[0.03]"
      >
        {content}
      </button>
    );
  }

  return <div className="px-1">{content}</div>;
}

/* ------------------------------------------------------------------ */
/*  Progress Summary                                                   */
/* ------------------------------------------------------------------ */

function ProgressSummary({
  todayDate,
  dayLabel,
  totalTasks,
  completedTasks,
  skippedTasks,
  estimatedMinutes,
  remainingMinutes,
  overdueTasks,
  progressPct,
  tasksByType,
}: {
  todayDate: string;
  dayLabel?: string;
  totalTasks: number;
  completedTasks: number;
  skippedTasks: number;
  estimatedMinutes: number;
  remainingMinutes: number;
  overdueTasks: number;
  progressPct: number;
  tasksByType: Record<string, number>;
}) {
  const isComplete = progressPct >= 100;

  return (
    <div className="rounded-[14px] border border-border/70 bg-card px-4 py-4">
      {/* Top row: date + percentage */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-foreground">
            {formatPersianDate(todayDate)}
          </div>
          {dayLabel && (
            <div className="mt-0.5 text-[11.5px] text-muted-foreground">
              {dayLabel}
            </div>
          )}
        </div>
        <div className="text-left">
          <div
            className={`text-[22px] font-semibold tabular-nums tracking-tight ${
              isComplete ? "text-success" : "text-foreground"
            }`}
          >
            {n(progressPct)}%
          </div>
          <div className="text-[11px] tabular-nums text-muted-foreground">
            {n(completedTasks)} از {n(totalTasks)} تسک
          </div>
        </div>
      </div>

      {/* Progress bar — thin Library-style hairline */}
      <div className="h-[3px] overflow-hidden rounded-full bg-foreground/[0.07]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className={`h-full rounded-full ${isComplete ? "bg-success" : "bg-foreground/55"}`}
        />
      </div>

      {/* Stats row */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {remainingMinutes > 0 && (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock size={11} strokeWidth={1.75} />
            {formatMinutes(remainingMinutes)} باقی‌مانده
          </span>
        )}
        {overdueTasks > 0 && (
          <span className="inline-flex items-center gap-1 tabular-nums text-destructive/85">
            <AlertTriangle size={11} strokeWidth={1.75} />
            {n(overdueTasks)} عقب‌افتاده
          </span>
        )}
        {skippedTasks > 0 && (
          <span className="inline-flex items-center gap-1 tabular-nums">
            {n(skippedTasks)} رد شده
          </span>
        )}
      </div>

      {/* Task type breakdown chips */}
      {Object.keys(tasksByType).length > 1 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {Object.entries(tasksByType).map(([type, count]) => {
            const ICONS: Record<string, React.ElementType> = {
              question_block: Target,
              flashcard_review: CreditCard,
              chapter_read: BookOpen,
              exam_block: GraduationCap,
            };
            const TypeIcon = ICONS[type];
            const LABELS: Record<string, string> = {
              question_block: "تست",
              flashcard_review: "فلش‌کارت",
              chapter_read: "مطالعه",
              chunk_review: "مرور",
              exam_block: "آزمون",
              notebook_review: "نوت‌بوک",
              custom_task: "دلخواه",
            };
            return (
              <span
                key={type}
                className="inline-flex items-center gap-1 rounded-full border border-border/55 bg-muted/40 px-2 py-[1px] text-[10.5px] text-muted-foreground/85"
              >
                {TypeIcon && <TypeIcon size={10} strokeWidth={1.75} />}
                <span className="tabular-nums">{LABELS[type] ?? type}: {n(count)}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface TodayTaskListProps {
  onShowOverdue?: () => void;
  onReschedule?: (taskId: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function TodayTaskList({ onShowOverdue, onReschedule }: TodayTaskListProps) {
  const [data, setData] = useState<TodayPlanResult | null>(null);
  const [upcomingTasks, setUpcomingTasks] = useState<UpcomingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showUpcoming, setShowUpcoming] = useState(true);

  const fetchAll = useCallback(async () => {
    let hasLocalData = false;

    // Local-first: show cached Dexie data immediately
    if (isLocalFirstEnabled()) {
      try {
        const local = await getTodayPlanLocal();
        if (local) {
          setData(local);
          setError(null);
          hasLocalData = true;
        }
      } catch { /* Dexie unavailable */ }
    }
    if (hasLocalData) setLoading(false);

    try {
      const [todayRes, upcomingRes] = await Promise.all([
        getTodayPlanAction(),
        getUpcomingTasksAction(10),
      ]);

      if (todayRes.ok) {
        setData(todayRes.data);
        setError(null);
        // Seed Dexie for the next offline load
        if (isLocalFirstEnabled()) {
          seedFromTodayPlan(todayRes.data).catch(() => {});
        }
      } else if (!hasLocalData) {
        setData(null);
        setError(todayRes.error.code === "NO_ACTIVE_PLAN" ? null : todayRes.error.message);
      }

      if (upcomingRes.ok) {
        setUpcomingTasks(upcomingRes.data as UpcomingTask[]);
      }
    } catch {
      if (!hasLocalData) {
        setError("خطا در دریافت اطلاعات");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useVisibilityRefresh(fetchAll, !loading);

  // ---- Loading ----

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="rounded-[14px] border border-border/70 bg-card px-4 py-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="h-4 w-24 rounded bg-muted/60" />
              <div className="h-3 w-16 rounded bg-muted/50" />
            </div>
            <div className="h-6 w-12 rounded bg-muted/60" />
          </div>
          <div className="h-[3px] rounded-full bg-muted/50" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-[14px] border border-border/70 bg-card px-3.5 py-3">
            <div className="flex items-start gap-3">
              <div className="h-7 w-7 rounded-md bg-muted/60" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-3/4 rounded bg-muted/55" />
                <div className="h-3 w-1/2 rounded bg-muted/45" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ---- Error ----

  if (error) {
    return (
      <div className="rounded-[14px] border border-border/70 bg-muted/30 px-4 py-6">
        <div className="flex flex-col items-center gap-3">
          <AlertTriangle size={22} className="text-muted-foreground/70" />
          <div className="text-center">
            <div className="mb-1 text-[13px] font-medium text-foreground">
              {error}
            </div>
            <div className="text-[11.5px] text-muted-foreground">
              اتصال شما را بررسی کنید و دوباره تلاش کنید
            </div>
          </div>
          <button
            onClick={() => { setLoading(true); fetchAll(); }}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/60 bg-background px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-foreground/[0.03]"
          >
            <RefreshCw size={12} strokeWidth={1.75} />
            تلاش مجدد
          </button>
        </div>
      </div>
    );
  }

  // ---- No active plan ----

  if (!data) {
    return (
      <div className="rounded-[14px] border border-border/70 bg-muted/30 px-6 py-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <CalendarCheck size={22} className="text-muted-foreground/60" />
          <div>
            <div className="mb-1 text-[13px] font-medium text-foreground">
              برنامه فعالی وجود ندارد
            </div>
            <div className="max-w-sm text-[11.5px] leading-5 text-muted-foreground">
              planner فقط نمای اجرایی را نشان می‌دهد. برای دیدن تسک‌های امروز و هفته، یک برنامه مطالعه فعال کنید.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Data classification ----

  const today = new Date().toISOString().slice(0, 10);

  // Filter out rescheduled tasks (they have been moved to another day)
  const todayTasks = data.tasks.filter((t) => t.status !== "rescheduled");

  // Overdue tasks from past days (separate section in the UI)
  const overdueTasks = data.overdueTasks ?? [];
  const overdueIds = new Set(overdueTasks.map((t) => t.id));

  // Today's active = not done, not overdue (overdue shown in its own section)
  const activeTasks = todayTasks.filter(
    (t) =>
      t.status !== "completed" &&
      t.status !== "skipped" &&
      t.status !== "overdue" &&
      !overdueIds.has(t.id),
  );
  const completedTasks = todayTasks.filter(
    (t) => t.status === "completed" || t.status === "skipped",
  );

  const totalTasks = todayTasks.length;
  const completedCount = todayTasks.filter((t) => t.status === "completed").length;
  const skippedCount = todayTasks.filter((t) => t.status === "skipped").length;
  const progressPct = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
  const estimatedMinutes = todayTasks.reduce((s, t) => s + t.estimatedMinutes, 0);
  const remainingMinutes = todayTasks
    .filter((t) => t.status === "pending" || t.status === "in_progress" || t.status === "overdue")
    .reduce((s, t) => s + t.estimatedMinutes, 0);

  const allDone = totalTasks > 0 && completedCount + skippedCount >= totalTasks;

  // Task type breakdown
  const tasksByType: Record<string, number> = {};
  todayTasks.forEach((t) => {
    tasksByType[t.taskType] = (tasksByType[t.taskType] ?? 0) + 1;
  });

  return (
    <div className="space-y-4">
      {/* ── PROGRESS SUMMARY ── */}
      <ProgressSummary
        todayDate={today}
        dayLabel={data.day?.label ?? undefined}
        totalTasks={totalTasks}
        completedTasks={completedCount}
        skippedTasks={skippedCount}
        estimatedMinutes={estimatedMinutes}
        remainingMinutes={remainingMinutes}
        overdueTasks={overdueTasks.length}
        progressPct={progressPct}
        tasksByType={tasksByType}
      />

      {/* ── OVERDUE SECTION ── */}
      {overdueTasks.length > 0 && (
        <div>
          <SectionHeader
            label={SECTION_LABEL.overdue}
            count={overdueTasks.length}
            tone="danger"
          />
          <div className="mt-1 space-y-1.5">
            {onShowOverdue ? (
              <button
                onClick={onShowOverdue}
                className="flex w-full items-center justify-between rounded-[14px] border border-destructive/25 bg-destructive/[0.04] px-3.5 py-2.5 text-[12px] transition-colors hover:bg-destructive/[0.06]"
              >
                <div className="flex items-center gap-2 text-destructive/85">
                  <AlertTriangle size={12} strokeWidth={1.75} />
                  <span className="font-medium">
                    {n(overdueTasks.length)} تسک عقب‌افتاده
                  </span>
                </div>
                <span className="text-[11px] font-medium text-foreground/80 underline-offset-2 hover:underline">
                  مدیریت یکجا
                </span>
              </button>
            ) : null}
            <AnimatePresence mode="popLayout">
              {overdueTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onMutate={fetchAll}
                  onReschedule={onReschedule}
                  showMoveToToday
                  showSnooze
                  section="overdue"
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ── ALL DONE CELEBRATION ── */}
      {allDone && (
        <div className="rounded-[14px] border border-border/70 bg-muted/30 px-4 py-5">
          <div className="flex flex-col items-center gap-2 text-center">
            <PartyPopper size={20} className="text-success" />
            <div className="text-[13px] font-medium text-foreground">
              تبریک! تسک‌های امروز تکمیل شد.
            </div>
          </div>
        </div>
      )}

      {/* ── REST DAY ── */}
      {data.day?.isRestDay === 1 && totalTasks === 0 && (
        <div className="rounded-[14px] border border-border/70 bg-muted/30 px-4 py-5">
          <div className="text-center">
            <div className="mb-1 text-[13px] font-medium text-foreground">
              ☕ امروز روز استراحت است
            </div>
            <div className="text-[11.5px] text-muted-foreground">
              استراحت کنید و انرژی جمع کنید.
            </div>
          </div>
        </div>
      )}

      {/* ── TODAY'S ACTIVE TASKS ── */}
      {activeTasks.length > 0 && (
        <div>
          <SectionHeader
            label={SECTION_LABEL.today}
            count={activeTasks.length}
          />
          <div className="mt-1 space-y-1.5">
            <AnimatePresence mode="popLayout">
              {activeTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onMutate={fetchAll}
                  onReschedule={onReschedule}
                  showSnooze
                  section="today"
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ── No Day Record ── */}
      {!data.day && totalTasks === 0 && !allDone && (
        <div className="rounded-[14px] border border-border/70 bg-muted/30 px-4 py-5">
          <div className="text-center text-[12.5px] text-muted-foreground">
            برای امروز تسکی تعریف نشده است.
          </div>
        </div>
      )}

      {/* ── UPCOMING (THIS WEEK) ── */}
      {upcomingTasks.length > 0 && (
        <div>
          <SectionHeader
            label={SECTION_LABEL.upcoming}
            count={upcomingTasks.length}
            collapsible
            collapsed={!showUpcoming}
            onToggle={() => setShowUpcoming((v) => !v)}
          />
          <AnimatePresence>
            {showUpcoming && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="mt-1 space-y-1.5">
                  {upcomingTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onMutate={fetchAll}
                      onReschedule={onReschedule}
                      showMoveToToday
                      showSnooze
                      section="upcoming"
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── COMPLETED SECTION ── */}
      {completedTasks.length > 0 && (
        <div>
          <SectionHeader
            label={SECTION_LABEL.completed}
            count={completedTasks.length}
            tone="success"
            collapsible
            collapsed={!showCompleted}
            onToggle={() => setShowCompleted((v) => !v)}
          />
          <AnimatePresence>
            {showCompleted && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="mt-1 space-y-1.5">
                  {completedTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onMutate={fetchAll}
                      section="completed"
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
