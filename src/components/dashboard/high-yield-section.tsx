"use client"

import { useRef } from "react"
import { ChevronLeft, ChevronRight, Flame, Brain, Target } from "lucide-react"
import { cn } from "@/lib/utils"
import { accuracyClass, toPersianDigits } from "./utils"
import type { HighYieldTopic } from "./types"

export function HighYieldSection({
  topics,
  onOpenTopic,
}: {
  topics: HighYieldTopic[]
  onOpenTopic?: (topic: HighYieldTopic) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  const scroll = (dir: "next" | "prev") => {
    if (!ref.current) return
    const amount = 280 * (dir === "next" ? -1 : 1) // RTL: next = scroll left
    ref.current.scrollBy({ left: amount, behavior: "smooth" })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between mb-3 gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <Flame size={14} className="text-amber-600 dark:text-amber-400" />
            <p className="text-[13px] font-semibold tracking-tight">موضوعات پر‌بازده بورد</p>
            <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium ltr">
              YIELD ≥ ۸
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            بر اساس آمار تاریخی ABU + الگوریتم URO-ZERO
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => scroll("prev")}
            aria-label="قبلی"
            className="w-7 h-7 rounded-md border border-border hover:bg-muted flex items-center justify-center transition"
          >
            <ChevronRight size={13} />
          </button>
          <button
            onClick={() => scroll("next")}
            aria-label="بعدی"
            className="w-7 h-7 rounded-md border border-border hover:bg-muted flex items-center justify-center transition"
          >
            <ChevronLeft size={13} />
          </button>
        </div>
      </div>

      <div
        ref={ref}
        className="flex gap-3 overflow-x-auto scrollbar-thin pb-1 snap-x snap-mandatory"
      >
        {topics.length === 0 ? (
          <div className="w-full rounded-lg border border-dashed border-border p-8 text-center text-[11px] text-muted-foreground">
            پیشنهاد high-yield واقعی هنوز از analytics برنگشته است.
          </div>
        ) : topics.map((t) => {
          const masteryPct = Math.round((t.mastered / t.total) * 100)
          return (
            <button
              key={t.id}
              onClick={() => onOpenTopic?.(t)}
              className="snap-start text-right group shrink-0 w-[260px] rounded-lg border border-border bg-card hover:border-foreground/20 hover:shadow-sm transition-all p-3.5 flex flex-col"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[13px] font-semibold truncate text-left ltr group-hover:text-primary transition"
                    title={t.title}
                  >
                    {t.title}
                  </p>
                  <p className="text-[10.5px] text-muted-foreground mt-0.5">
                    {t.chapterFa}{" "}
                    <span className="text-muted-foreground/60 mx-1">·</span>
                    <span className="ltr">{t.cwwRef}</span>
                  </p>
                </div>
                <div className="text-center shrink-0">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-semibold tnum ltr text-[12.5px]">
                    {t.yieldScore.toFixed(1)}
                  </div>
                  <p className="text-[8.5px] text-muted-foreground mt-1">YIELD</p>
                </div>
              </div>

              {/* Mastery bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-muted-foreground">تسلط</span>
                  <span className="tnum ltr font-medium">
                    {toPersianDigits(t.mastered)}/{toPersianDigits(t.total)} ·{" "}
                    {toPersianDigits(masteryPct)}٪
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      masteryPct >= 70
                        ? "bg-emerald-500"
                        : masteryPct >= 50
                          ? "bg-sky-500"
                          : "bg-amber-500",
                    )}
                    style={{ width: `${masteryPct}%` }}
                  />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[10.5px]">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Brain size={11} className="text-amber-600 dark:text-amber-400" />
                  <span className="tnum ltr font-medium text-foreground">
                    {toPersianDigits(t.due)}
                  </span>{" "}
                  سررسید
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Target size={11} className={accuracyClass(t.accuracy)} />
                  <span
                    className={cn("tnum ltr font-medium", accuracyClass(t.accuracy))}
                  >
                    {toPersianDigits(t.accuracy)}٪
                  </span>{" "}
                  دقت
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between">
                <span className="text-[10.5px] text-primary font-medium group-hover:underline">
                  مطالعه ←
                </span>
                <span className="text-[9.5px] text-muted-foreground">۱۵–۲۵ دقیقه</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
