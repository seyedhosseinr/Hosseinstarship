"use client"

import { Flame } from "lucide-react"
import { cn } from "@/lib/utils"
import { toPersianDigits } from "./utils"

const DAY_LABELS = ["ش", "ی", "د", "س", "چ", "پ", "ج"]

const INTENSITY_BG = [
  "bg-muted",
  "bg-emerald-500/20",
  "bg-emerald-500/45",
  "bg-emerald-500/70",
  "bg-emerald-500",
]

export function StreakHeatmap({
  data,
  streak,
  longest = 22,
}: {
  data: number[][]
  streak: number
  longest?: number
}) {
  const totalDays = data.flat().filter((v) => v > 0).length
  const totalCells = data.length * 7

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <Flame size={14} className="text-amber-600 dark:text-amber-400" />
            <p className="text-[13px] font-semibold tracking-tight">رشته مطالعه</p>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            <span className="tnum ltr text-foreground font-medium">
              {toPersianDigits(totalDays)}
            </span>{" "}
            از{" "}
            <span className="tnum ltr">{toPersianDigits(totalCells)}</span> روز فعال در ۱۲ هفته اخیر
          </p>
        </div>
        <div className="text-left">
          <p className="text-2xl font-semibold tnum ltr leading-none text-amber-600 dark:text-amber-400">
            {toPersianDigits(streak)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            رکورد:{" "}
            <span className="tnum ltr">{toPersianDigits(longest)}</span> روز
          </p>
        </div>
      </div>

      <div className="flex gap-1.5">
        {/* Day labels (RTL: top to bottom, Saturday first for Iranian week) */}
        <div className="flex flex-col gap-[3px] justify-between text-[9px] text-muted-foreground py-0.5 shrink-0">
          {DAY_LABELS.map((d, i) => (
            <span key={d} className={cn("h-[10px] leading-none", i % 2 === 1 && "opacity-0")}>
              {d}
            </span>
          ))}
        </div>

        {/* Grid: 12 weeks horizontally */}
        <div className="flex-1 grid grid-flow-col auto-cols-fr gap-[3px]">
          {data.map((week, wIdx) => (
            <div key={wIdx} className="grid grid-rows-7 gap-[3px]">
              {week.map((intensity, dIdx) => (
                <div
                  key={dIdx}
                  className={cn(
                    "aspect-square rounded-[3px] transition-all hover:ring-2 hover:ring-foreground/30",
                    INTENSITY_BG[intensity],
                  )}
                  title={`هفته ${wIdx + 1} · ${DAY_LABELS[dIdx]} · ${intensity * 25}٪`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
        <span>کم</span>
        {INTENSITY_BG.map((bg, i) => (
          <span key={i} className={cn("w-3 h-3 rounded-[3px]", bg)} />
        ))}
        <span>زیاد</span>
      </div>
    </div>
  )
}
