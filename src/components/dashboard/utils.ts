import type { FsrsCardState, SyncStatus } from "./types"

export function accuracyTone(pct: number) {
  if (pct >= 80) return "emerald"
  if (pct >= 70) return "teal"
  return "amber"
}

export function accuracyClass(pct: number) {
  if (pct >= 80) return "text-emerald-600 dark:text-emerald-400"
  if (pct >= 70) return "text-sky-600 dark:text-sky-400"
  return "text-amber-600 dark:text-amber-400"
}

export function coverageBarClass(pct: number) {
  if (pct >= 70) return "bg-emerald-500"
  if (pct >= 50) return "bg-sky-500"
  return "bg-amber-500"
}

export function coverageRingColor(pct: number) {
  if (pct >= 70) return "oklch(0.65 0.15 145)"
  if (pct >= 50) return "oklch(0.62 0.13 220)"
  return "oklch(0.7 0.16 70)"
}

export const FSRS_STATE_CONFIG: Record<
  FsrsCardState,
  { label: string; bg: string; text: string; ring: string }
> = {
  new: {
    label: "جدید",
    bg: "bg-sky-50 dark:bg-sky-950/40",
    text: "text-sky-700 dark:text-sky-300",
    ring: "ring-sky-500/20",
  },
  learning: {
    label: "یادگیری",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    ring: "ring-amber-500/20",
  },
  review: {
    label: "مرور",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-500/20",
  },
  relearning: {
    label: "بازیادگیری",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-300",
    ring: "ring-rose-500/20",
  },
}

export const SYNC_CONFIG: Record<
  SyncStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  synced: {
    label: "همگام با Neon",
    bg: "bg-emerald-50 dark:bg-emerald-950/50",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  syncing: {
    label: "در حال همگام‌سازی…",
    bg: "bg-sky-50 dark:bg-sky-950/50",
    text: "text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500 animate-pulse",
  },
  error: {
    label: "خطا در همگام‌سازی",
    bg: "bg-rose-50 dark:bg-rose-950/50",
    text: "text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  offline: {
    label: "آفلاین · حافظه محلی",
    bg: "bg-muted",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground",
  },
}

export function persianGreeting(d: Date = new Date()) {
  const h = d.getHours()
  if (h < 5) return "شب بخیر"
  if (h < 12) return "صبح بخیر"
  if (h < 17) return "ظهر بخیر"
  if (h < 20) return "عصر بخیر"
  return "شب بخیر"
}

/** Convert latin digits to Persian for display */
export function toPersianDigits(s: string | number) {
  const map = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"]
  return String(s).replace(/\d/g, (d) => map[+d])
}
