"use client"

import { ChevronLeft, Sparkles, Brain, Filter } from "lucide-react"
import { cn } from "@/lib/utils"
import { FSRS_STATE_CONFIG, toPersianDigits } from "./utils"
import type { FsrsCard } from "./types"

function StateBadge({ state }: { state: FsrsCard["state"] }) {
  const cfg = FSRS_STATE_CONFIG[state]
  return (
    <span className={cn("text-[9.5px] px-1.5 py-0.5 rounded font-medium", cfg.bg, cfg.text)}>
      {cfg.label}
    </span>
  )
}

function YieldGauge({ score }: { score: number }) {
  const pct = (score / 10) * 100
  const tone =
    score >= 9
      ? "text-rose-600 dark:text-rose-400"
      : score >= 8
        ? "text-amber-600 dark:text-amber-400"
        : "text-sky-600 dark:text-sky-400"
  const ringColor =
    score >= 9
      ? "oklch(0.6 0.18 25)"
      : score >= 8
        ? "oklch(0.7 0.16 70)"
        : "oklch(0.62 0.13 230)"

  const r = 14
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c

  return (
    <div className="relative w-9 h-9 shrink-0">
      <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.12"
          strokeWidth="2.5"
        />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className={cn("absolute inset-0 flex items-center justify-center text-[10.5px] font-semibold tnum ltr", tone)}>
        {score.toFixed(1)}
      </div>
    </div>
  )
}

export function FsrsQueue({
  queue,
  onStartStudy,
  onOptimize,
}: {
  queue: FsrsCard[]
  onStartStudy?: () => void
  onOptimize?: () => void
}) {
  const avgStability =
    queue.length > 0
      ? queue.reduce((sum, card) => sum + card.stability, 0) / queue.length
      : 0

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-[13px] font-semibold tracking-tight">صف مطالعه FSRS</p>
            <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium ltr">
              YIELD
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            مرتب‌شده بر اساس FSRS Stability × Board Relevance
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            aria-label="فیلتر"
            className="w-7 h-7 rounded-md border border-border hover:bg-muted flex items-center justify-center transition text-muted-foreground"
          >
            <Filter size={12} />
          </button>
          <button
            onClick={onOptimize}
            className="text-[11px] text-primary hover:underline flex items-center gap-0.5 px-2 py-1"
          >
            <Sparkles size={11} />
            بهینه‌سازی
            <ChevronLeft size={11} />
          </button>
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-muted/50 px-3 py-2">
          <p className="text-[9.5px] text-muted-foreground">سررسید اکنون</p>
          <p className="text-base font-semibold text-amber-600 dark:text-amber-400 tnum ltr leading-tight">
            {toPersianDigits(queue.filter((c) => c.dueIn === "اکنون").length)}
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 px-3 py-2">
          <p className="text-[9.5px] text-muted-foreground">جدید</p>
          <p className="text-base font-semibold text-sky-600 dark:text-sky-400 tnum ltr leading-tight">
            {toPersianDigits(queue.filter((c) => c.state === "new").length)}
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 px-3 py-2">
          <p className="text-[9.5px] text-muted-foreground">میانگین Stability</p>
          <p className="text-base font-semibold tnum ltr leading-tight">
            {toPersianDigits(avgStability.toFixed(1))}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 flex-1">
        {queue.length === 0 ? (
          <div className="flex-1 rounded-lg border border-dashed border-border p-6 text-center text-[11px] text-muted-foreground">
            صف مرور فعلاً داده واقعی ندارد.
          </div>
        ) : queue.map((card) => (
          <button
            key={card.id}
            className="text-right flex items-center gap-3 p-2.5 rounded-lg border border-transparent hover:border-border hover:bg-muted/50 transition group"
          >
            <YieldGauge score={card.yieldScore} />

            <div className="flex-1 min-w-0">
              <p
                className="text-[12px] font-medium truncate text-left ltr group-hover:text-primary transition"
                title={card.title}
              >
                {card.title}
              </p>
              <div className="flex gap-1.5 mt-1 items-center flex-wrap">
                <StateBadge state={card.state} />
                <span className="text-[10px] text-muted-foreground">{card.chapterFa}</span>
                <span className="text-[10px] text-muted-foreground/60">·</span>
                <span className="text-[10px] text-muted-foreground tnum">{card.dueIn}</span>
                {card.stability > 0 && (
                  <span className="text-[10px] text-muted-foreground/70 tnum ltr mr-auto">
                    S {card.stability.toFixed(1)} · D {card.difficulty.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={onStartStudy}
        className="mt-3 w-full py-2.5 text-[12px] rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-95 transition flex items-center justify-center gap-2 shadow-sm"
      >
        <Brain size={14} />
        شروع مطالعه ·{" "}
        <span className="tnum ltr">{toPersianDigits(queue.length)}</span> کارت
      </button>
    </div>
  )
}
