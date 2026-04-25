"use client";

/**
 * TaskCard — UWorld-style study task card with full action set.
 *
 * Renders a single study task with status badge, task type icon,
 * progress, and action buttons: complete, start, skip/snooze,
 * move to today, reschedule, open linked resource.
 *
 * Used in both Today/Section and Weekly views.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  FileText,
  Target,
  CreditCard,
  GraduationCap,
  Notebook,
  Pencil,
  Check,
  SkipForward,
  Play,
  Clock,
  AlertTriangle,
  CalendarDays,
  ExternalLink,
  ArrowLeft,
  AlarmClock,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getTaskTypeLabel,
  getStatusColors,
  getTaskStatusLabel,
  getTaskTypeRoute,
  n,
  formatMinutes,
  getPriorityLabel,
} from "./task-helpers";
import {
  completeTaskAction,
  moveToTodayAction,
  skipTaskAction,
  snoozeTaskAction,
  startTaskAction,
} from "@/lib/actions/planner-runtime-actions";
import { isLocalFirstEnabled } from "@/lib/local-first/flag";
import {
  completeTask as lfComplete,
  skipTask as lfSkip,
  startTask as lfStart,
  snoozeTask as lfSnooze,
  moveTaskToToday as lfMoveToToday,
} from "@/lib/local-first/planner-local";
import { useEntitySyncStatus } from "@/hooks/useEntitySyncStatus";
import { SyncDot } from "@/components/local-first/SyncDot";

/* ------------------------------------------------------------------ */
/*  Icon resolver                                                      */
/* ------------------------------------------------------------------ */

const TASK_TYPE_ICONS: Record<string, React.ElementType> = {
  chapter_read: BookOpen,
  chunk_review: FileText,
  question_block: Target,
  flashcard_review: CreditCard,
  exam_block: GraduationCap,
  notebook_review: Notebook,
  custom_task: Pencil,
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface TaskCardProps {
  task: {
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
  };
  /** Called after a mutation so parent can re-fetch */
  onMutate?: () => void;
  /** If provided, shows a reschedule trigger */
  onReschedule?: (taskId: string) => void;
  /** Compact rendering for weekly view cells */
  compact?: boolean;
  /** Show "move to today" action (for overdue/upcoming tasks) */
  showMoveToToday?: boolean;
  /** Show snooze action */
  showSnooze?: boolean;
  /** Section context — affects styling */
  section?: "overdue" | "today" | "thisWeek" | "upcoming" | "completed";
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function TaskCard({
  task,
  onMutate,
  onReschedule,
  compact,
  showMoveToToday,
  showSnooze,
  section,
}: TaskCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showActions, setShowActions] = useState(false);
  const router = useRouter();
  const syncStatus = useEntitySyncStatus("planner_item", task.id);

  const status = task.status;
  const isDone = status === "completed";
  const isSkipped = status === "skipped";
  const isOverdue = status === "overdue";
  const isActive = status === "in_progress";
  const isActionable = status === "pending" || isOverdue;
  const hasOverflowActions = Boolean(showMoveToToday || showSnooze);

  const Icon = TASK_TYPE_ICONS[task.taskType] ?? Pencil;
  const statusColors = getStatusColors(status);

  // ---- Handlers ----

  function handleMutationError(res: { ok: false; error: { code: string; message: string } }) {
    if (res.error.code === "NOT_FOUND") {
      toast.error("این تسک دیگر وجود ندارد");
      onMutate?.();
    } else if (res.error.code === "INVALID_STATE") {
      toast.error("وضعیت تسک تغییر کرده — لیست بروزرسانی شد");
      onMutate?.();
    } else {
      toast.error(res.error.message);
    }
  }

  function handleComplete() {
    startTransition(async () => {
      if (isLocalFirstEnabled()) {
        try { await lfComplete(task.id); toast.success("تسک تکمیل شد"); onMutate?.(); return; } catch { /* fall through */ }
      }
      const res = await completeTaskAction(task.id);
      if (res.ok) {
        toast.success("تسک تکمیل شد");
        onMutate?.();
      } else {
        handleMutationError(res);
      }
    });
  }

  function handleSkip() {
    startTransition(async () => {
      if (isLocalFirstEnabled()) {
        try { await lfSkip(task.id); toast.success("تسک رد شد"); onMutate?.(); return; } catch { /* fall through */ }
      }
      const res = await skipTaskAction(task.id);
      if (res.ok) {
        toast.success("تسک رد شد");
        onMutate?.();
      } else {
        handleMutationError(res);
      }
    });
  }

  function handleStart() {
    startTransition(async () => {
      if (isLocalFirstEnabled()) {
        try { await lfStart(task.id); toast.success("شروع شد"); onMutate?.(); return; } catch { /* fall through */ }
      }
      const res = await startTaskAction(task.id);
      if (res.ok) {
        toast.success("شروع شد");
        onMutate?.();
      } else {
        handleMutationError(res);
      }
    });
  }

  function handleSnooze(days: number) {
    startTransition(async () => {
      if (isLocalFirstEnabled()) {
        try { await lfSnooze(task.id, days); toast.success(days === 1 ? "به فردا منتقل شد" : `${n(days)} روز به تعویق افتاد`); onMutate?.(); return; } catch { /* fall through */ }
      }
      const res = await snoozeTaskAction(task.id, days);
      if (res.ok) {
        toast.success(days === 1 ? "به فردا منتقل شد" : `${n(days)} روز به تعویق افتاد`);
        onMutate?.();
      } else {
        handleMutationError(res);
      }
    });
    setShowActions(false);
  }

  function handleMoveToToday() {
    startTransition(async () => {
      if (isLocalFirstEnabled()) {
        try { await lfMoveToToday(task.id); toast.success("به امروز منتقل شد"); onMutate?.(); return; } catch { /* fall through */ }
      }
      const res = await moveToTodayAction(task.id);
      if (res.ok) {
        toast.success("به امروز منتقل شد");
        onMutate?.();
      } else {
        handleMutationError(res);
      }
    });
    setShowActions(false);
  }

  function handleNavigateToContent() {
    const route = getTaskTypeRoute(task.taskType, {
      chapter: task.linkedChapter,
      chunk: task.linkedChunk,
      examSession: task.linkedExamSession,
      document: task.linkedDocument,
      frame: task.linkedFrame,
    });
    if (route) router.push(route);
  }

  // ---- Compact Card (weekly view) ----

  if (compact) {
    const hasLink = !!getTaskTypeRoute(task.taskType, {
      chapter: task.linkedChapter,
      chunk: task.linkedChunk,
      examSession: task.linkedExamSession,
      document: task.linkedDocument,
      frame: task.linkedFrame,
    });

    const dotClass = isDone
      ? "bg-success"
      : isSkipped
        ? "bg-muted-foreground/50"
        : isOverdue
          ? "bg-destructive/80"
          : isActive
            ? "bg-foreground"
            : "bg-muted-foreground/50";

    return (
      <motion.div
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: isPending ? 0.5 : 1 }}
        className={`
          group flex items-center gap-2 rounded-md border border-transparent px-2 py-1 text-[11.5px]
          text-foreground/90 transition-colors
          hover:bg-foreground/[0.03] hover:border-border/50
          ${isDone ? "opacity-60" : ""}
          ${isSkipped ? "opacity-55 line-through" : ""}
        `}
      >
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
        <Icon size={12} strokeWidth={1.75} className="shrink-0 text-muted-foreground/70" />
        <span className="flex-1 truncate">{task.title}</span>
        {task.priority > 0 && (
          <AlertTriangle size={10} className="shrink-0 text-destructive/80" />
        )}
        {(isActionable || isActive) && (
          <button
            onClick={handleComplete}
            disabled={isPending}
            className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-foreground/[0.06] hover:text-foreground group-hover:opacity-100"
            title="تکمیل"
          >
            <Check size={11} strokeWidth={2} />
          </button>
        )}
        {hasLink && (
          <button
            onClick={handleNavigateToContent}
            className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-foreground/[0.06] hover:text-foreground group-hover:opacity-100"
            title="مشاهده محتوا"
          >
            <ExternalLink size={10} strokeWidth={1.75} />
          </button>
        )}
      </motion.div>
    );
  }

  // ---- Full Card ----

  const contentRoute = getTaskTypeRoute(task.taskType, {
    chapter: task.linkedChapter,
    chunk: task.linkedChunk,
    examSession: task.linkedExamSession,
    document: task.linkedDocument,
    frame: task.linkedFrame,
  });
  const priorityLabel = getPriorityLabel(task.priority);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
    >
      <div
        className={cn(
          "group relative rounded-[14px] border bg-card px-3.5 py-3 transition-colors",
          "hover:bg-foreground/[0.015]",
          isDone && "opacity-75 bg-muted/30",
          isSkipped && "opacity-60",
          isOverdue ? "border-destructive/35" : "border-border/65",
          isPending && "pointer-events-none",
        )}
      >
        {/* Pending overlay */}
        {isPending && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[14px] bg-card/60 backdrop-blur-[1px]">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-foreground/70 border-t-transparent" />
          </div>
        )}

        <div className="flex items-start gap-3">
          {/* Left — Icon + Check */}
          <div className="flex flex-col items-center gap-1.5 pt-0.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
              <Icon size={14} strokeWidth={1.75} />
            </div>
            {(isActionable || isActive) && (
              <button
                onClick={handleComplete}
                disabled={isPending}
                className="flex h-5 w-5 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground transition-colors hover:border-foreground/50 hover:text-foreground"
                title="تکمیل"
              >
                <Check size={10} strokeWidth={2.25} className="opacity-0 transition-opacity group-hover:opacity-80" />
              </button>
            )}
            {isDone && (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-success/12 text-success">
                <Check size={11} strokeWidth={2.25} />
              </div>
            )}
          </div>

          {/* Center — Content */}
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  "text-[13px] font-medium leading-5 text-foreground",
                  (isDone || isSkipped) && "line-through text-muted-foreground",
                )}
              >
                {task.title}
              </span>
              {priorityLabel && (
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-1.5 py-[1px] text-[10px] font-medium",
                    task.priority >= 2
                      ? "border-destructive/25 bg-destructive/8 text-destructive/90"
                      : "border-warning/25 bg-warning/10 text-warning",
                  )}
                >
                  {priorityLabel}
                </span>
              )}
            </div>

            {/* Type + linked entity */}
            <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted-foreground">
              <span className="inline-flex items-center rounded-full border border-border/55 bg-muted/40 px-1.5 py-[1px] text-[10.5px] text-muted-foreground/85">
                {getTaskTypeLabel(task.taskType)}
              </span>
              {task.linkedChapter && (
                contentRoute ? (
                  <button
                    onClick={handleNavigateToContent}
                    className="inline-flex items-center gap-1 text-foreground/80 underline-offset-2 transition-colors hover:text-foreground hover:underline"
                  >
                    فصل {n(task.linkedChapter.chapterNo)} — {task.linkedChapter.title}
                    <ExternalLink size={10} strokeWidth={1.75} />
                  </button>
                ) : (
                  <span>فصل {n(task.linkedChapter.chapterNo)} — {task.linkedChapter.title}</span>
                )
              )}
              {task.linkedChunk && task.linkedChunk.title && (
                <span>{task.linkedChunk.title}</span>
              )}
              {task.linkedExamSession && (
                contentRoute ? (
                  <button
                    onClick={handleNavigateToContent}
                    className="inline-flex items-center gap-1 text-foreground/80 underline-offset-2 transition-colors hover:text-foreground hover:underline"
                  >
                    {task.linkedExamSession.title ?? "آزمون"}
                    <ExternalLink size={10} strokeWidth={1.75} />
                  </button>
                ) : (
                  <span>{task.linkedExamSession.title ?? "آزمون"}</span>
                )
              )}
              {contentRoute && !task.linkedChapter && !task.linkedExamSession && (
                <button
                  onClick={handleNavigateToContent}
                  className="inline-flex items-center gap-1 text-foreground/80 underline-offset-2 transition-colors hover:text-foreground hover:underline"
                >
                  مشاهده
                  <ExternalLink size={10} strokeWidth={1.75} />
                </button>
              )}
            </div>

            {/* Description */}
            {task.description && !isDone && (
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                {task.description}
              </p>
            )}

            {/* Progress bar */}
            {task.targetCount != null && task.targetCount > 0 && !isDone && (
              <div className="mt-2">
                <div className="mb-1 flex items-center justify-between text-[10.5px] tabular-nums text-muted-foreground">
                  <span>{n(task.completedCount)} از {n(task.targetCount)}</span>
                  <span>{n(task.progressPercent)}%</span>
                </div>
                <div className="h-[3px] overflow-hidden rounded-full bg-foreground/[0.07]">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-300",
                      status === "completed" ? "bg-success" : status === "overdue" ? "bg-destructive/75" : "bg-foreground/55",
                    )}
                    style={{ width: `${task.progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Duration + Status */}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              {task.estimatedMinutes > 0 && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Clock size={11} strokeWidth={1.75} />
                  {formatMinutes(task.estimatedMinutes)}
                </span>
              )}
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  status === "completed" && "text-success",
                  status === "overdue" && "text-destructive/85",
                )}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: statusColors.dot }}
                />
                {getTaskStatusLabel(status)}
              </span>
              {syncStatus && <SyncDot status={syncStatus} />}
            </div>
          </div>

          {/* Right — Action buttons */}
          {(isActionable || isActive) && (
            <div className="relative flex flex-col items-end gap-0.5">
              {isActionable && (
                <button
                  onClick={handleStart}
                  disabled={isPending}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
                  title="شروع"
                >
                  <Play size={13} strokeWidth={1.75} />
                </button>
              )}

              {/* Move to Today — for overdue/upcoming tasks */}
              {showMoveToToday && (
                <button
                  onClick={handleMoveToToday}
                  disabled={isPending}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
                  title="انتقال به امروز"
                >
                  <ArrowLeft size={13} strokeWidth={1.75} />
                </button>
              )}

              {/* Snooze — quick 1 day */}
              {showSnooze && (
                <button
                  onClick={() => handleSnooze(1)}
                  disabled={isPending}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
                  title="تعویق به فردا"
                >
                  <AlarmClock size={13} strokeWidth={1.75} />
                </button>
              )}

              <button
                onClick={handleSkip}
                disabled={isPending}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
                title="رد کردن"
              >
                <SkipForward size={13} strokeWidth={1.75} />
              </button>

              {onReschedule && (
                <button
                  onClick={() => onReschedule(task.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
                  title="تغییر تاریخ"
                >
                  <CalendarDays size={13} strokeWidth={1.75} />
                </button>
              )}

              {hasOverflowActions ? (
                <div className="relative">
                  <button
                    onClick={() => setShowActions(!showActions)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-colors hover:bg-foreground/[0.05] hover:text-foreground group-hover:opacity-100"
                    title="عملیات بیشتر"
                  >
                    <MoreHorizontal size={13} strokeWidth={1.75} />
                  </button>

                  <AnimatePresence>
                    {showActions && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowActions(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.98, y: -2 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.98, y: -2 }}
                          transition={{ duration: 0.12 }}
                          className="absolute left-0 top-full z-20 mt-1 min-w-[168px] rounded-lg border border-border/70 bg-popover p-1 text-[12px] shadow-[0_6px_24px_-8px_rgba(0,0,0,0.12)]"
                        >
                          {showSnooze ? (
                            <>
                              <button
                                onClick={() => handleSnooze(1)}
                                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-right text-foreground/90 transition-colors hover:bg-foreground/[0.04]"
                              >
                                <AlarmClock size={12} strokeWidth={1.75} className="text-muted-foreground/70" />
                                تعویق ۱ روز
                              </button>
                              <button
                                onClick={() => handleSnooze(2)}
                                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-right text-foreground/90 transition-colors hover:bg-foreground/[0.04]"
                              >
                                <AlarmClock size={12} strokeWidth={1.75} className="text-muted-foreground/70" />
                                تعویق ۲ روز
                              </button>
                              <button
                                onClick={() => handleSnooze(7)}
                                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-right text-foreground/90 transition-colors hover:bg-foreground/[0.04]"
                              >
                                <AlarmClock size={12} strokeWidth={1.75} className="text-muted-foreground/70" />
                                تعویق ۱ هفته
                              </button>
                            </>
                          ) : null}
                          {showMoveToToday ? (
                            <button
                              onClick={handleMoveToToday}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-right text-foreground/90 transition-colors hover:bg-foreground/[0.04]"
                            >
                              <ArrowLeft size={12} strokeWidth={1.75} className="text-muted-foreground/70" />
                              انتقال به امروز
                            </button>
                          ) : null}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              ) : null}
            </div>
          )}

          {/* Completed/Skipped — open content only */}
          {(isDone || isSkipped) && contentRoute && (
            <button
              onClick={handleNavigateToContent}
              className="flex h-7 w-7 shrink-0 items-center justify-center self-start rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
              title="مشاهده محتوا"
            >
              <ExternalLink size={13} strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
