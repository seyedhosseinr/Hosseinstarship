"use client";

/**
 * PlannerTaskCard — Bucket-aware task card that wraps the existing TaskCard,
 * adding a source badge and bucket-specific quick actions.
 */

import { useState, useCallback, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarCheck,
  CheckCircle2,
  ArrowLeft,
  Clock,
  Zap,
  AlertTriangle,
  Brain,
  ExternalLink,
  GripVertical,
  Check,
} from "lucide-react";
import { Surface } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { C } from "./planner-tokens";
import {
  getTaskTypeLabel,
  getTaskTypeColor,
  getStatusColors,
  formatMinutes,
  n,
} from "./task-helpers";
import type { TaskBucket } from "@/lib/planner/types";
import type { DragTaskData } from "./dnd/PlannerDndContext";

/* ------------------------------------------------------------------ */
/*  Source type labels & colors                                        */
/* ------------------------------------------------------------------ */

const SOURCE_LABEL: Record<string, string> = {
  manual: "دستی",
  ai_generated: "هوش مصنوعی",
  fsrs_due: "FSRS",
  weak_area: "نقطه ضعف",
};

const SOURCE_COLOR: Record<string, { text: string; bg: string }> = {
  manual:       { text: "hsl(var(--muted-foreground))", bg: "hsl(var(--muted) / 0.5)" },
  ai_generated: { text: "hsl(var(--primary))",          bg: "hsl(var(--primary) / 0.08)" },
  fsrs_due:     { text: "hsl(var(--warning))",          bg: "hsl(var(--warning) / 0.10)" },
  weak_area:    { text: "hsl(var(--danger))",           bg: "hsl(var(--danger) / 0.08)" },
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface PlannerTaskCardProps {
  task: {
    id: string;
    taskType: string;
    status: string;
    title: string;
    description?: string | null;
    estimatedMinutes: number;
    priority: number;
    sourceType?: string | null;
    scheduledFor?: string | null;
    linkUrl?: string | null;
    linkLabel?: string | null;
  };
  bucket: TaskBucket;
  onComplete?: (taskId: string) => void;
  onReschedule?: (taskId: string) => void;
  onMoveToToday?: (taskId: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PlannerTaskCard({
  task,
  bucket,
  onComplete,
  onReschedule,
  onMoveToToday,
}: PlannerTaskCardProps) {
  const router = useRouter();
  const [isCompleting, setIsCompleting] = useState(false);
  const typeColor = getTaskTypeColor(task.taskType);
  const statusColor = getStatusColors(task.status);

  /* ---- Drag & Drop ---- */
  const dragData: DragTaskData = {
    type: "task",
    taskId: task.id,
    sourceDate: task.scheduledFor ?? null,
    sourceBucket: bucket,
    taskTitle: task.title,
    taskType: task.taskType,
  };

  const {
    attributes,
    listeners,
    setNodeRef: dragRef,
    transform,
    isDragging,
  } = useDraggable({ id: task.id, data: dragData });
  const sourceLabel = task.sourceType ? SOURCE_LABEL[task.sourceType] : null;
  const sourceColor = task.sourceType
    ? SOURCE_COLOR[task.sourceType] ?? SOURCE_COLOR.manual
    : null;

  const isCompleted = task.status === "completed";

  const handleCompleteClick = useCallback(() => {
    if (!onComplete || isCompleting) return;
    setIsCompleting(true);
    // Brief delay for the checkmark animation, then fire the real callback
    setTimeout(() => onComplete(task.id), 250);
  }, [onComplete, isCompleting, task.id]);

  const dragStyle: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 50 : undefined,
    boxShadow: isDragging
      ? "0 8px 24px rgba(15,23,42,0.18)"
      : undefined,
  };

  return (
    <div ref={dragRef} style={dragStyle} {...attributes}>
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{
        opacity: isDragging ? 0.4 : isCompleting ? 0.5 : isCompleted ? 0.6 : 1,
        y: 0,
        scale: isCompleting ? 0.97 : 1,
      }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
    <Surface
      variant="default"
      padding="sm"
      className="group transition-all hover:shadow-[0_2px_8px_rgba(15,23,42,0.06)] dark:hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:border-primary/25"
    >
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        <button
          type="button"
          className="mt-1 p-0.5 rounded cursor-grab active:cursor-grabbing hover:bg-muted transition-colors flex-shrink-0 touch-none"
          style={{ color: C.textMuted }}
          {...listeners}
        >
          <GripVertical size={14} />
        </button>

        {/* Status dot */}
        <span
          className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: statusColor.dot }}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-sm font-semibold truncate"
              style={{
                color: isCompleted ? C.textMuted : C.text,
                textDecoration: isCompleted ? "line-through" : "none",
              }}
            >
              {task.title}
            </span>

            {/* Type badge */}
            <span
              className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ color: typeColor.text, backgroundColor: typeColor.bg }}
            >
              {getTaskTypeLabel(task.taskType)}
            </span>

            {/* Source badge */}
            {sourceLabel && sourceColor && (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                style={{ color: sourceColor.text, backgroundColor: sourceColor.bg }}
              >
                {task.sourceType === "ai_generated" && <Brain size={9} />}
                {task.sourceType === "fsrs_due" && <Zap size={9} />}
                {task.sourceType === "weak_area" && <AlertTriangle size={9} />}
                {sourceLabel}
              </span>
            )}

            {/* Priority */}
            {task.priority >= 2 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                فوری
              </Badge>
            )}
            {task.priority === 1 && (
              <Badge variant="warning" className="text-[10px] px-1.5 py-0">
                مهم
              </Badge>
            )}

            {/* Linked concept label */}
            {task.linkLabel && (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full truncate max-w-[140px]"
                style={{ color: C.accent, backgroundColor: "hsl(var(--primary) / 0.10)" }}
              >
                <ExternalLink size={8} />
                {task.linkLabel}
              </span>
            )}
          </div>

          {/* Description (if present) */}
          {task.description && (
            <p
              className="text-xs mt-0.5 line-clamp-1"
              style={{ color: C.textMuted }}
            >
              {task.description}
            </p>
          )}

          {/* Meta row */}
          <div
            className="flex items-center gap-3 mt-1 text-[11px]"
            style={{ color: C.textMuted }}
          >
            {task.estimatedMinutes > 0 && (
              <span className="flex items-center gap-0.5">
                <Clock size={10} />
                {formatMinutes(task.estimatedMinutes)}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {/* Complete */}
          {!isCompleted && onComplete && (
            <button
              type="button"
              title="تکمیل"
              onClick={handleCompleteClick}
              disabled={isCompleting}
              className="p-1.5 rounded-lg hover:bg-success/10 transition-colors relative"
              style={{ color: C.success }}
            >
              <AnimatePresence mode="wait">
                {isCompleting ? (
                  <motion.span
                    key="check"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1.2 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                  >
                    <Check size={16} strokeWidth={3} />
                  </motion.span>
                ) : (
                  <motion.span key="circle" initial={false}>
                    <CheckCircle2 size={16} />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          )}

          {/* Move to today (for overdue / upcoming / thisWeek) */}
          {(bucket === "overdue" || bucket === "upcoming" || bucket === "thisWeek") &&
            !isCompleted &&
            onMoveToToday && (
              <button
                type="button"
                title="انتقال به امروز"
                onClick={() => onMoveToToday(task.id)}
                className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                style={{ color: C.accent }}
              >
                <ArrowLeft size={16} />
              </button>
            )}

          {/* Reschedule */}
          {!isCompleted && onReschedule && (
            <button
              type="button"
              title="تغییر تاریخ"
              onClick={() => onReschedule(task.id)}
              className="p-1.5 rounded-lg hover:bg-warning/10 transition-colors"
              style={{ color: C.warning }}
            >
              <CalendarCheck size={16} />
            </button>
          )}

          {/* Open link */}
          {task.linkUrl && (
            <button
              type="button"
              title={task.linkLabel ?? "باز کردن"}
              onClick={() => router.push(task.linkUrl!)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              style={{ color: C.accent }}
            >
              <ExternalLink size={16} />
            </button>
          )}
        </div>
      </div>
    </Surface>
    </motion.div>
    </div>
  );
}
