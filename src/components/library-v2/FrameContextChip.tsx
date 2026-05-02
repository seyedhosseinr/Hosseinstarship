"use client";

/**
 * FrameContextChip — Reader-native contextual chip system.
 *
 * Renders compact, click-to-expand chips at the bottom of eligible frames,
 * giving the learner a quick study-hint without cluttering the reading
 * surface.  Inspired by Grok's referenced-message bubbles: small, unobtrusive,
 * actionable on demand.
 *
 * Chip classes (shown only when the frame qualifies):
 *  • "High-yield"   — kind === "high_yield" OR frame.highYield flag
 *  • "Key takeaway" — kind === "keypoint"
 *  • "Pearl"        — kind === "pearl"  (shows clinical-relevance hint)
 *  • "Exam trap"    — kind === "trap" | "pitfall" | "warning"
 *  • "N MCQs"       — frame has linked questions (complementary to footer)
 *
 * Each chip is a button; clicking opens a small RTL popover with a brief
 * Persian study hint.  Clicking outside or the × button closes it.
 * No URL params, no flashcard data, no external navigation needed.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { HelpCircle, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FrameViewModel } from "@/lib/contract/note-viewer.types";

/* ─────────────────────────────────────────────────────────────
   Chip definitions
───────────────────────────────────────────────────────────── */

interface ChipConfig {
  id: string;
  icon: ReactNode;
  label: string;     // Short LTR label on the chip button
  titleFa: string;   // Persian heading inside the popover
  bodyFa: string;    // Persian body text inside the popover
  chipCls: string;   // Tailwind colour classes for the chip
  ringCls: string;   // Border/ring colour for the popover
}

function buildChips(frame: FrameViewModel): ChipConfig[] {
  const chips: ChipConfig[] = [];

  const isHighYield =
    frame.kind === "high_yield" ||
    (frame.v8Flags?.highYield ?? frame.highYield ?? false);

  const isKeyPoint = frame.kind === "keypoint";
  const isPearl = frame.kind === "pearl";
  const isTrap =
    frame.kind === "trap" ||
    frame.kind === "pitfall" ||
    frame.kind === "warning";
  const mcqCount = frame.linkedQuestions.length;

  if (isHighYield) {
    chips.push({
      id: "hy",
      icon: <Sparkles className="h-2.5 w-2.5 shrink-0" aria-hidden />,
      label: "High-yield",
      titleFa: "نکته پربازده",
      bodyFa:
        "این بخش به عنوان نکته پربازده برای آزمون علوم پزشکی علامت‌گذاری شده است. " +
        "در مرور سریع پیش از آزمون به این بخش توجه ویژه داشته باشید.",
      chipCls:
        "border-amber-400/40 bg-amber-400/[0.07] text-amber-700 dark:text-amber-300 " +
        "hover:bg-amber-400/[0.15]",
      ringCls: "border-amber-300/50 dark:border-amber-600/40",
    });
  }

  if (isKeyPoint) {
    chips.push({
      id: "kp",
      icon: (
        <span aria-hidden className="shrink-0 text-[10px] leading-none">
          ✨
        </span>
      ),
      label: "Key takeaway",
      titleFa: "نکته کلیدی",
      bodyFa:
        "این نکته کلیدی خلاصه‌ای از مهم‌ترین مطالب این بخش است. " +
        "برای مرور سریع و تثبیت مطالب پیش از آزمون بسیار مناسب است.",
      chipCls:
        "border-emerald-400/40 bg-emerald-400/[0.07] text-emerald-700 dark:text-emerald-300 " +
        "hover:bg-emerald-400/[0.15]",
      ringCls: "border-emerald-300/50 dark:border-emerald-600/40",
    });
  }

  if (isPearl) {
    chips.push({
      id: "pearl",
      icon: (
        <span aria-hidden className="shrink-0 text-[10px] leading-none">
          💡
        </span>
      ),
      label: "Pearl",
      titleFa: "نکته بالینی",
      bodyFa:
        "این یک نکته بالینی ارزشمند است که اغلب در موقعیت‌های بالینی واقعی " +
        "و آزمون‌های علوم پزشکی مطرح می‌شود.",
      chipCls:
        "border-amber-400/35 bg-amber-400/[0.06] text-amber-700 dark:text-amber-300 " +
        "hover:bg-amber-400/[0.12]",
      ringCls: "border-amber-300/45 dark:border-amber-600/35",
    });
  }

  if (isTrap) {
    chips.push({
      id: "trap",
      icon: (
        <span aria-hidden className="shrink-0 text-[10px] leading-none">
          ⚠️
        </span>
      ),
      label: frame.kind === "trap" ? "Exam trap" : "Caution",
      titleFa: frame.kind === "trap" ? "تله آزمون" : "هشدار بالینی",
      bodyFa:
        frame.kind === "trap"
          ? "این یک تله رایج در آزمون‌های علوم پزشکی است. " +
            "پاسخ منطقی اول لزوماً درست نیست — با دقت تحلیل کنید."
          : "این بخش یک هشدار بالینی مهم دارد. " +
            "در مدیریت بیمار دقت و توجه ویژه‌ای لازم است.",
      chipCls:
        "border-rose-400/40 bg-rose-400/[0.06] text-rose-700 dark:text-rose-300 " +
        "hover:bg-rose-400/[0.13]",
      ringCls: "border-rose-300/50 dark:border-rose-600/40",
    });
  }

  if (mcqCount > 0) {
    chips.push({
      id: "mcq",
      icon: <HelpCircle className="h-2.5 w-2.5 shrink-0" aria-hidden />,
      label: `${mcqCount} MCQ${mcqCount > 1 ? "s" : ""}`,
      titleFa: "منبع سؤال چندگزینه‌ای",
      bodyFa:
        `این بخش منبع ${mcqCount} سؤال چندگزینه‌ای است. ` +
        "مطالب این قسمت به طور مستقیم در آزمون‌های علوم پزشکی مطرح شده‌اند.",
      chipCls:
        "border-sky-400/40 bg-sky-400/[0.07] text-sky-700 dark:text-sky-300 " +
        "hover:bg-sky-400/[0.14]",
      ringCls: "border-sky-300/50 dark:border-sky-600/40",
    });
  }

  return chips;
}

/* ─────────────────────────────────────────────────────────────
   Single chip + popover
───────────────────────────────────────────────────────────── */

function SingleChip({ chip }: { chip: ChipConfig }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click/touch
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      {/* ── Chip button ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex items-center gap-1 rounded-full",
          "border px-[7px] py-[2.5px]",
          "text-[9.5px] font-[650] leading-[1.45] tracking-[0.025em]",
          "transition-colors duration-100",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lib-accent/50",
          chip.chipCls,
        )}
      >
        {chip.icon}
        <span>{chip.label}</span>
      </button>

      {/* ── Popover — opens downward, RTL Persian text ── */}
      {open && (
        <div
          role="dialog"
          aria-modal="false"
          dir="rtl"
          className={cn(
            "absolute top-full z-30 mt-1.5 start-0",
            "w-[min(19rem,calc(100vw-2.5rem))]",
            "rounded-[10px] border bg-lib-glass backdrop-blur-xl",
            "shadow-[0_8px_28px_-8px_hsl(var(--foreground)/0.16)]",
            "px-3.5 py-2.5",
            chip.ringCls,
          )}
        >
          {/* heading row */}
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[11.5px] font-[700] leading-snug text-lib-text">
              {chip.titleFa}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="بستن"
              className={cn(
                "ms-auto flex h-[18px] w-[18px] shrink-0 items-center justify-center",
                "rounded-full text-lib-text-muted transition-colors",
                "hover:bg-lib-hover hover:text-lib-text",
              )}
            >
              <X className="h-[11px] w-[11px]" />
            </button>
          </div>

          {/* body text */}
          <p className="text-[12.5px] leading-[1.72] text-lib-text-secondary">
            {chip.bodyFa}
          </p>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Public export
───────────────────────────────────────────────────────────── */

/**
 * Drop inside `innerBody` in FrameCardV2. Returns null for frames that have
 * no context chips (ordinary core/concept/algorithm frames with no flags).
 */
export function FrameContextChip({ frame }: { frame: FrameViewModel }) {
  const chips = buildChips(frame);
  if (chips.length === 0) return null;

  return (
    // dir="ltr" keeps chip buttons left-aligned and prevents RTL parent
    // from reversing the row order or flipping pill borders.
    <div
      dir="ltr"
      className="mt-2.5 flex flex-wrap items-center gap-1.5"
      data-frame-context-chips
    >
      {chips.map((chip) => (
        <SingleChip key={chip.id} chip={chip} />
      ))}
    </div>
  );
}
