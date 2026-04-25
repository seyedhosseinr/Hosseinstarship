/**
 * Shared planner UI helpers: labels, colors, routes, and lightweight hooks.
 */

import { useEffect, useRef } from "react";
import type { TaskStatusValue, TaskTypeValue } from "@/lib/planner/runtime-types";

const nf = new Intl.NumberFormat("fa-IR");
export const n = (value: number): string => nf.format(value);

export const TASK_TYPE_LABEL: Record<string, string> = {
  chapter_read: "مطالعه فصل",
  chunk_review: "مرور بخش",
  question_block: "تست‌زنی",
  flashcard_review: "فلش‌کارت",
  exam_block: "آزمون",
  notebook_review: "مرور جزوه",
  custom_task: "تسک دلخواه",
  weak_area_review: "مرور نقطه ضعف",
};

export function getTaskTypeLabel(type: TaskTypeValue | string): string {
  return TASK_TYPE_LABEL[type] ?? type;
}

export const TASK_TYPE_ICON: Record<string, string> = {
  chapter_read: "BookOpen",
  chunk_review: "FileText",
  question_block: "Target",
  flashcard_review: "CreditCard",
  exam_block: "GraduationCap",
  notebook_review: "Notebook",
  custom_task: "Pencil",
  weak_area_review: "AlertTriangle",
};

export const TASK_TYPE_COLOR: Record<string, { text: string; bg: string }> = {
  chapter_read:     { text: "hsl(var(--primary))",            bg: "hsl(var(--primary) / 0.08)" },
  chunk_review:     { text: "hsl(var(--primary))",            bg: "hsl(var(--primary) / 0.08)" },
  question_block:   { text: "hsl(var(--primary))",            bg: "hsl(var(--primary) / 0.10)" },
  flashcard_review: { text: "hsl(var(--warning))",            bg: "hsl(var(--warning) / 0.10)" },
  exam_block:       { text: "hsl(var(--danger))",             bg: "hsl(var(--danger) / 0.08)" },
  notebook_review:  { text: "hsl(var(--success))",            bg: "hsl(var(--success) / 0.08)" },
  custom_task:      { text: "hsl(var(--muted-foreground))",   bg: "hsl(var(--muted) / 0.5)" },
  weak_area_review: { text: "hsl(var(--danger))",             bg: "hsl(var(--danger) / 0.08)" },
};

export function getTaskTypeColor(type: string): { text: string; bg: string } {
  return TASK_TYPE_COLOR[type] ?? { text: "hsl(var(--muted-foreground))", bg: "hsl(var(--muted) / 0.5)" };
}

export function getTaskTypeRoute(
  taskType: string,
  linked?: {
    chapter?: { id: string; chapterNo?: number | null } | null;
    chunk?: { id: string } | null;
    examSession?: { id: string } | null;
    document?: { docId: string } | null;
    frame?: { frameId: string } | null;
  },
): string | null {
  const docHref = linked?.document?.docId
    ? `/notes/${linked.document.docId}${linked.frame?.frameId ? `?frame=${linked.frame.frameId}` : ""}`
    : null;

  const chapterNo = linked?.chapter?.chapterNo ?? null;
  const chapterHref = chapterNo != null ? `/library/campbell/chapter/${chapterNo}` : null;
  const qbankHref =
    chapterNo != null ? `/qbank?chapter=ch-${String(chapterNo).padStart(3, "0")}` : "/qbank";

  switch (taskType) {
    case "chapter_read":
    case "chunk_review":
    case "notebook_review":
      return docHref ?? chapterHref ?? "/library";

    case "question_block":
    case "weak_area_review":
      return qbankHref;

    case "flashcard_review":
      return "/flashcards/review";

    case "exam_block":
      return "/exam/builder";

    case "custom_task":
      return docHref ?? chapterHref ?? null;

    default:
      return null;
  }
}

export const TASK_STATUS_LABEL: Record<string, string> = {
  pending: "در انتظار",
  in_progress: "در حال انجام",
  completed: "انجام شده",
  skipped: "رد شده",
  overdue: "عقب‌افتاده",
  rescheduled: "تغییر تاریخ",
  snoozed: "به تعویق افتاده",
};

export type PlannerSection = "overdue" | "today" | "thisWeek" | "upcoming" | "completed";

export const SECTION_LABEL: Record<PlannerSection, string> = {
  overdue: "عقب‌افتاده",
  today: "امروز",
  thisWeek: "این هفته",
  upcoming: "آینده",
  completed: "تکمیل شده",
};

export const SECTION_ORDER: PlannerSection[] = ["overdue", "today", "thisWeek", "upcoming", "completed"];

export function getTaskStatusLabel(status: TaskStatusValue | string): string {
  return TASK_STATUS_LABEL[status] ?? status;
}

export function getStatusColors(status: string): { text: string; bg: string; dot: string } {
  switch (status) {
    case "completed":
      return { text: "hsl(var(--success))", bg: "hsl(var(--success) / 0.08)", dot: "hsl(var(--success))" };
    case "in_progress":
      return { text: "hsl(var(--primary))", bg: "hsl(var(--primary) / 0.10)", dot: "hsl(var(--primary))" };
    case "skipped":
      return { text: "hsl(var(--muted-foreground))", bg: "hsl(var(--muted) / 0.5)", dot: "hsl(var(--muted-foreground))" };
    case "overdue":
      return { text: "hsl(var(--danger))", bg: "hsl(var(--danger) / 0.08)", dot: "hsl(var(--danger))" };
    case "rescheduled":
    case "snoozed":
      return { text: "hsl(var(--warning))", bg: "hsl(var(--warning) / 0.10)", dot: "hsl(var(--warning))" };
    default:
      return { text: "hsl(var(--muted-foreground))", bg: "hsl(var(--muted) / 0.5)", dot: "hsl(var(--muted-foreground))" };
  }
}

export function getPriorityLabel(priority: number): string | null {
  if (priority >= 2) return "فوری";
  if (priority === 1) return "مهم";
  return null;
}

export function getPriorityColor(priority: number): { text: string; bg: string } | null {
  if (priority >= 2) return { text: "hsl(var(--danger-foreground))", bg: "hsl(var(--danger))" };
  if (priority === 1) return { text: "hsl(var(--warning-foreground))", bg: "hsl(var(--warning))" };
  return null;
}

const PERSIAN_DOW: Record<string, string> = {
  saturday: "شنبه",
  sunday: "یک‌شنبه",
  monday: "دوشنبه",
  tuesday: "سه‌شنبه",
  wednesday: "چهارشنبه",
  thursday: "پنج‌شنبه",
  friday: "جمعه",
};

const PERSIAN_DOW_SHORT: Record<string, string> = {
  saturday: "ش",
  sunday: "ی",
  monday: "د",
  tuesday: "س",
  wednesday: "چ",
  thursday: "پ",
  friday: "ج",
};

export function getDowLabel(dow: string, short = false): string {
  return short ? PERSIAN_DOW_SHORT[dow] ?? dow : PERSIAN_DOW[dow] ?? dow;
}

const dateFmt = new Intl.DateTimeFormat("fa-IR", {
  day: "numeric",
  month: "long",
});

const dateShortFmt = new Intl.DateTimeFormat("fa-IR", {
  day: "numeric",
  month: "short",
});

export function formatPersianDate(isoDate: string): string {
  try {
    return dateFmt.format(new Date(`${isoDate}T00:00:00`));
  } catch {
    return isoDate;
  }
}

export function formatPersianDateShort(isoDate: string): string {
  try {
    return dateShortFmt.format(new Date(`${isoDate}T00:00:00`));
  } catch {
    return isoDate;
  }
}

export function isToday(isoDate: string): boolean {
  return isoDate === new Date().toISOString().slice(0, 10);
}

export function formatRelativeDate(isoDate: string): string {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  if (isoDate === todayStr) return "امروز";

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isoDate === yesterday.toISOString().slice(0, 10)) return "دیروز";

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (isoDate === tomorrow.toISOString().slice(0, 10)) return "فردا";

  return formatPersianDate(isoDate);
}

export function formatMinutes(minutes: number): string {
  if (minutes < 1) return "کمتر از ۱ دقیقه";
  if (minutes < 60) return `${n(minutes)} دقیقه`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${n(hours)} ساعت`;
  return `${n(hours)} ساعت و ${n(rest)} دقیقه`;
}

export function formatElapsed(startedAtMs: number | null | undefined): string | null {
  if (!startedAtMs) return null;
  const elapsed = Math.max(0, Date.now() - startedAtMs);
  const mins = Math.floor(elapsed / 60000);
  if (mins < 1) return "همین الان";
  return `${formatMinutes(mins)} گذشته`;
}

export function useVisibilityRefresh(callback: () => void, enabled = true): void {
  const lastRefresh = useRef(Date.now());

  useEffect(() => {
    if (!enabled) return;

    function handleVisibility(): void {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefresh.current <= 5000) return;
      lastRefresh.current = now;
      callback();
    }

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [callback, enabled]);
}

export function taskTypeLabel(type: string): string {
  return getTaskTypeLabel(type);
}