"use client"

import { useState } from "react"
import { Brain, Target, BookOpen, NotebookPen, Coffee, Check, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { toPersianDigits } from "./utils"
import type { PlanBlock } from "./types"

const TYPE_CFG = {
  fsrs: { icon: Brain, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", ring: "ring-amber-500/30" },
  mcq: { icon: Target, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10", ring: "ring-sky-500/30" },
  read: { icon: BookOpen, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", ring: "ring-emerald-500/30" },
  note: { icon: NotebookPen, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/10", ring: "ring-violet-500/30" },
  break: { icon: Coffee, color: "text-muted-foreground", bg: "bg-muted", ring: "ring-border" },
}

export function TodayPlan({
  blocks,
  onOpenPlanner,
}: {
  blocks: PlanBlock[]
  onOpenPlanner?: () => void
}) {
  const [done, setDone] = useState<Record<string, boolean>>(
    Object.fromEntries(blocks.map((b) => [b.id, !!b.done])),
  )

  const total = blocks.length
  const completed = Object.values(done).filter(Boolean).length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  const totalMin = blocks.reduce((s, b) => s + b.estMinutes, 0)
  const doneMin = blocks
    .filter((b) => done[b.id])
    .reduce((s, b) => s + b.estMinutes, 0)

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[13px] font-semibold tracking-tight">برنامه امروز</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            <span className="tnum ltr">{toPersianDigits(doneMin)}</span> از{" "}
            <span className="tnum ltr">{toPersianDigits(totalMin)}</span> دقیقه ·{" "}
            <span className="text-emerald-600 dark:text-emerald-400 tnum ltr">
              {toPersianDigits(pct)}٪
            </span>{" "}
            انجام شد
          </p>
        </div>
        <button
          onClick={onOpenPlanner}
          aria-label="گزینه‌های بیشتر"
          className="text-muted-foreground hover:text-foreground p-1 rounded transition"
        >
          <MoreHorizontal size={14} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-primary to-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Timeline */}
      <ol className="relative space-y-2.5 flex-1">
        {/* Line */}
        <span
          aria-hidden
          className="absolute right-[14px] top-2 bottom-2 w-px bg-border"
        />

        {blocks.length === 0 ? (
          <li className="relative pr-10 py-8 text-[11px] text-muted-foreground">
            برای امروز task ثبت نشده است.
          </li>
        ) : blocks.map((b) => {
          const cfg = TYPE_CFG[b.type]
          const Icon = cfg.icon
          const isDone = done[b.id]

          return (
            <li key={b.id} className="relative flex items-start gap-3">
              <button
                onClick={() => setDone((d) => ({ ...d, [b.id]: !d[b.id] }))}
                className={cn(
                  "relative z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ring-2 ring-background transition-all",
                  isDone
                    ? "bg-emerald-500 text-white"
                    : cn(cfg.bg, cfg.color, "ring-2", cfg.ring),
                )}
                aria-label={isDone ? "علامت‌گذاری به عنوان انجام نشده" : "علامت‌گذاری به عنوان انجام شده"}
              >
                {isDone ? <Check size={13} /> : <Icon size={13} />}
              </button>

              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={cn(
                      "text-[12px] font-medium leading-tight",
                      isDone && "line-through text-muted-foreground",
                    )}
                  >
                    {b.title}
                  </p>
                  <span className="text-[10px] text-muted-foreground tnum ltr shrink-0">
                    {b.startFa}–{b.endFa}
                  </span>
                </div>
                <p className="text-[10.5px] text-muted-foreground mt-0.5 leading-tight truncate">
                  {b.subtitle}
                </p>
              </div>
            </li>
          )
        })}
      </ol>

      <button
        onClick={onOpenPlanner}
        className="mt-3 text-[11px] text-primary hover:underline font-medium self-start"
      >
        مشاهده تقویم کامل ←
      </button>
    </div>
  )
}
