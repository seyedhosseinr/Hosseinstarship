"use client";

/**
 * WeeklyView — Saturdayâ€"Friday week strip with day columns.
 *
 * Each column shows the day's tasks in a compact layout.
 * Supports navigating to previous/next weeks.
 * Uses getWeekPlanAction to fetch data.
 */

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ChevronRight,
  ChevronLeft,
  CalendarCheck,
  Coffee,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { TaskCard } from "./TaskCard";
import {
  n,
  getDowLabel,
  formatPersianDateShort,
  isToday,
  useVisibilityRefresh,
} from "./task-helpers";
import { getWeekPlanAction } from "@/lib/actions/planner-runtime-actions";
import type { WeekPlanResult } from "@/lib/planner/runtime-types";
import { isLocalFirstEnabled } from "@/lib/local-first/flag";
import { getWeekPlanLocal, seedFromWeekPlan } from "@/lib/local-first/planner-local";

interface WeeklyViewProps {
  onReschedule?: (taskId: string) => void;
  onShowOverdue?: () => void;
}

function addWeeks(isoDate: string, weeks: number): string {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

export function WeeklyView({ onReschedule, onShowOverdue }: WeeklyViewProps) {
  const [data, setData] = useState<WeekPlanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refDate, setRefDate] = useState<string | undefined>(undefined);

  const fetchWeek = useCallback(async () => {
    setLoading(true);
    let hasLocalData = false;

    // Local-first: show cached Dexie data immediately
    if (isLocalFirstEnabled()) {
      try {
        const local = await getWeekPlanLocal(refDate);
        if (local) {
          setData(local);
          setError(null);
          hasLocalData = true;
          setLoading(false);
        }
      } catch { /* Dexie unavailable */ }
    }

    try {
      const res = await getWeekPlanAction(refDate);
      if (res.ok) {
        setData(res.data);
        setError(null);
        if (isLocalFirstEnabled()) {
          seedFromWeekPlan(res.data).catch(() => {});
        }
      } else if (!hasLocalData) {
        setData(null);
        setError(res.error?.message ?? "خطا در دریافت اطلاعات");
      }
    } catch {
      if (!hasLocalData) {
        setData(null);
        setError("خطا در دریافت اطلاعات هفته");
      }
    } finally {
      setLoading(false);
    }
  }, [refDate]);

  useEffect(() => {
    fetchWeek();
  }, [fetchWeek]);

  // Re-fetch when tab regains focus
  useVisibilityRefresh(fetchWeek, !loading);

  function goPrev() {
    const base = data?.weekStart ?? new Date().toISOString().slice(0, 10);
    setRefDate(addWeeks(base, -1));
  }

  function goNext() {
    const base = data?.weekStart ?? new Date().toISOString().slice(0, 10);
    setRefDate(addWeeks(base, 1));
  }

  function goThisWeek() {
    setRefDate(undefined);
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-7 w-24 rounded bg-muted/50" />
          <div className="h-7 w-32 rounded bg-muted/40" />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-28 rounded-[14px] border border-border/60 bg-muted/30" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[14px] border border-border/70 bg-muted/30 px-4 py-6">
        <div className="flex flex-col items-center gap-3">
          <AlertTriangle size={22} className="text-muted-foreground/70" />
          <div className="text-center text-[13px] font-medium text-foreground">
            {error}
          </div>
          <button
            onClick={() => { setError(null); fetchWeek(); }}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/60 bg-background px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-foreground/[0.03]"
          >
            <RefreshCw size={12} strokeWidth={1.75} />
            تلاش مجدد
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-[14px] border border-border/70 bg-muted/30 px-6 py-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <CalendarCheck size={22} className="text-muted-foreground/60" />
          <div className="text-[13px] font-medium text-foreground">
            برنامه فعالی وجود ندارد
          </div>
        </div>
      </div>
    );
  }

  const progressPct =
    data.totalTasks > 0
      ? Math.round((data.completedTasks / data.totalTasks) * 100)
      : 0;

  // Check if we're currently viewing "this week"
  const todayStr = new Date().toISOString().slice(0, 10);
  const isCurrentWeek = todayStr >= data.weekStart && todayStr <= data.weekEnd;

  return (
    <div className="space-y-4">
      {/* ---- Week Navigation ---- */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={goNext}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
            title="هفته بعد"
          >
            <ChevronRight size={15} strokeWidth={1.75} />
          </button>
          <button
            onClick={goPrev}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
            title="هفته قبل"
          >
            <ChevronLeft size={15} strokeWidth={1.75} />
          </button>
          {!isCurrentWeek && (
            <button
              onClick={goThisWeek}
              className="ml-1 inline-flex h-7 items-center rounded-md border border-border/60 bg-background px-2.5 text-[11.5px] font-medium text-foreground transition-colors hover:bg-foreground/[0.03]"
            >
              این هفته
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11.5px] tabular-nums">
          <span className="text-muted-foreground">
            {formatPersianDateShort(data.weekStart)} — {formatPersianDateShort(data.weekEnd)}
          </span>
          <span className="text-foreground/80 font-medium">
            {n(progressPct)}%
          </span>
        </div>
      </div>

      {/* ---- Week Progress Bar ---- */}
      <div className="h-[3px] overflow-hidden rounded-full bg-foreground/[0.07]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.4 }}
          className="h-full rounded-full bg-foreground/55"
        />
      </div>

      {/* ---- Day Columns (responsive grid) ---- */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-7">
        {data.days.map((day) => {
          const dayTasks = day.tasks ?? [];
          const dayCompleted = dayTasks.filter((t) => t.status === "completed").length;
          const dayTotal = dayTasks.length;
          const todayFlag = isToday(day.date);
          const isRest = day.isRestDay === 1;

          return (
            <motion.div
              key={day.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`
                min-h-[116px] rounded-[14px] border bg-card p-2.5 transition-colors
                ${todayFlag ? "border-foreground/35" : "border-border/65"}
              `}
            >
              {/* Day Header */}
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={`
                      text-[11px] font-semibold
                      ${todayFlag ? "text-foreground" : "text-foreground/75"}
                    `}
                  >
                    {getDowLabel(day.dayOfWeek, true)}
                  </span>
                  <span className="text-[10px] tabular-nums text-muted-foreground/70">
                    {formatPersianDateShort(day.date)}
                  </span>
                </div>
                {dayTotal > 0 && (
                  <span className="text-[10px] tabular-nums text-muted-foreground/70">
                    {n(dayCompleted)}/{n(dayTotal)}
                  </span>
                )}
              </div>

              {/* Rest Day Indicator */}
              {isRest && dayTotal === 0 && (
                <div className="flex flex-col items-center py-3 text-center text-muted-foreground/55">
                  <Coffee size={13} strokeWidth={1.75} />
                  <span className="mt-1 text-[10px]">استراحت</span>
                </div>
              )}

              {/* Compact Task Cards */}
              <div className="space-y-1">
                {dayTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onMutate={fetchWeek}
                    onReschedule={onReschedule}
                    compact
                  />
                ))}
              </div>

              {/* Empty non-rest day */}
              {!isRest && dayTotal === 0 && (
                <div className="py-3 text-center">
                  <span className="text-[10px] text-muted-foreground/55">
                    بدون تسک
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* ---- Overdue Tasks Summary ---- */}
      {data.overdueTasks.length > 0 && (
        <button
          onClick={onShowOverdue}
          disabled={!onShowOverdue}
          className="flex w-full items-center justify-between rounded-[14px] border border-destructive/25 bg-destructive/[0.04] px-3.5 py-2.5 text-[12px] transition-colors disabled:cursor-default enabled:hover:bg-destructive/[0.06]"
        >
          <div className="flex items-center gap-2 text-destructive/85">
            <AlertTriangle size={12} strokeWidth={1.75} />
            <span className="font-medium">{n(data.overdueTasks.length)} تسک عقب‌افتاده</span>
            <span className="text-muted-foreground">در این هفته</span>
          </div>
          {onShowOverdue && (
            <span className="text-[11px] font-medium text-foreground/80 underline-offset-2 hover:underline">
              مدیریت
            </span>
          )}
        </button>
      )}
    </div>
  );
}
