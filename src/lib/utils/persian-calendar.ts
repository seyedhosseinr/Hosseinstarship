/**
 * Persian (Jalali/Shamsi) calendar utilities.
 *
 * Wraps date-fns-jalali to provide a Jalali-aware calendar grid,
 * Persian month/day names, and Persian numeral formatting.
 *
 * Week starts on Saturday (weekStartsOn: 6).
 */

import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  getDay,
} from "date-fns-jalali";
import { faIR } from "date-fns-jalali/locale/fa-IR";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Short weekday labels (Saturday-first). */
export const PERSIAN_WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"] as const;

/** Full weekday names (Saturday-first). */
export const PERSIAN_WEEKDAYS_FULL = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنج‌شنبه",
  "جمعه",
] as const;

/** Jalali month names. */
export const PERSIAN_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
] as const;

/* ------------------------------------------------------------------ */
/*  Numeral conversion                                                 */
/* ------------------------------------------------------------------ */

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** Convert an integer to Persian-numeral string. */
export function toPersianNum(num: number): string {
  return num.toString().replace(/\d/g, (d) => PERSIAN_DIGITS[parseInt(d)]);
}

/* ------------------------------------------------------------------ */
/*  Calendar grid                                                      */
/* ------------------------------------------------------------------ */

/**
 * Returns every Date object needed to render a full calendar page
 * for the given month (6-week grid, Saturday start).
 */
export function getCalendarDays(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 6 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 6 });
  return eachDayOfInterval({ start, end });
}

/* ------------------------------------------------------------------ */
/*  Format helpers                                                     */
/* ------------------------------------------------------------------ */

/** "اسفند ۱۴۰۴" */
export function formatPersianMonth(date: Date): string {
  return format(date, "MMMM yyyy", { locale: faIR });
}

/** Day-of-month number in Persian numerals, e.g. "۱۵" */
export function formatPersianDay(date: Date): string {
  return format(date, "d", { locale: faIR });
}

/** Full date: "شنبه ۱۵ اسفند ۱۴۰۴" */
export function formatPersianDate(date: Date): string {
  return format(date, "EEEE d MMMM yyyy", { locale: faIR });
}

/* ------------------------------------------------------------------ */
/*  Re-exports (so calendar components import from one place)          */
/* ------------------------------------------------------------------ */

export {
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  getDay,
  format as formatJalali,
};
