"use client"

import { useEffect, useState } from "react"
import { ArrowUpRight, Brain, Flame, Target, TrendingUp } from "lucide-react"

import { cn } from "@/lib/utils"
import { persianGreeting, toPersianDigits } from "./utils"
import type { DashboardStats } from "./types"

function Sparkline({
  data,
  tone = "primary",
  height = 32,
  width = 90,
}: {
  data: number[]
  tone?: "primary" | "amber" | "emerald" | "sky"
  height?: number
  width?: number
}) {
  const pointsSource = data.length ? data : [0, 0, 0, 0, 0, 0, 0]
  const min = Math.min(...pointsSource)
  const max = Math.max(...pointsSource)
  const range = max - min || 1
  const step = width / Math.max(1, pointsSource.length - 1)
  const points = pointsSource
    .map((value, index) => `${index * step},${height - ((value - min) / range) * height}`)
    .join(" ")

  const stroke =
    tone === "amber"
      ? "oklch(0.7 0.16 70)"
      : tone === "emerald"
        ? "oklch(0.65 0.15 145)"
        : tone === "sky"
          ? "oklch(0.62 0.13 230)"
          : "oklch(0.52 0.11 200)"

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={width}
        cy={height - ((pointsSource[pointsSource.length - 1] - min) / range) * height}
        r={2.5}
        fill={stroke}
      />
    </svg>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  unit,
  delta,
  deltaLabel,
  tone,
  spark,
  sparkTone,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  value: string
  unit?: string
  delta?: number
  deltaLabel?: string
  tone: "primary" | "amber" | "emerald" | "sky"
  spark: number[]
  sparkTone: "primary" | "amber" | "emerald" | "sky"
}) {
  const toneClass =
    tone === "amber"
      ? "text-amber-600 dark:text-amber-400 bg-amber-500/10"
      : tone === "emerald"
        ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
        : tone === "sky"
          ? "text-sky-600 dark:text-sky-400 bg-sky-500/10"
          : "text-primary bg-primary/10"

  const isPositive = (delta ?? 0) >= 0

  return (
    <div className="relative group rounded-xl border border-border bg-card p-4 hover:shadow-sm hover:border-foreground/20 transition-all min-h-[148px]">
      <div className="flex items-start justify-between gap-2">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", toneClass)}>
          <Icon size={16} />
        </div>
        {delta !== undefined && delta !== 0 && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded ltr tnum",
              isPositive
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-rose-500/10 text-rose-700 dark:text-rose-400",
            )}
          >
            <TrendingUp size={9} className={cn(!isPositive && "rotate-180")} />
            {isPositive ? "+" : ""}
            {toPersianDigits(delta)}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <p className="text-3xl font-semibold tracking-tight tnum leading-none">
          {value}
        </p>
        {unit && <span className="text-[11px] text-muted-foreground font-normal">{unit}</span>}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground leading-tight">{label}</p>
      {deltaLabel && (
        <p className="text-[10px] text-muted-foreground/80 mt-0.5">{deltaLabel}</p>
      )}

      <div className="absolute bottom-3 left-3 opacity-90">
        <Sparkline data={spark} tone={sparkTone} />
      </div>
    </div>
  )
}

export function HeroSection({
  stats,
  onStartStudy,
  onStartMcq,
}: {
  stats: DashboardStats
  onStartStudy?: () => void
  onStartMcq?: () => void
}) {
  const [greeting, setGreeting] = useState("")
  const [todayFa, setTodayFa] = useState("")

  useEffect(() => {
    const d = new Date()
    setGreeting(persianGreeting(d))
    setTodayFa(
      d.toLocaleDateString("fa-IR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    )
  }, [])

  return (
    <section className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch" aria-label="خلاصه روز">
      <div className="xl:col-span-5 relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/5 via-card to-card p-5 flex flex-col justify-between min-h-[312px]">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06] dark:opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground) / 0.08) 1px, transparent 1px), linear-gradient(to right, hsl(var(--foreground) / 0.08) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage: "radial-gradient(ellipse at top right, black 0%, transparent 70%)",
          }}
        />

        <div className="relative">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {todayFa}
            </span>
          </div>
          <h2 className="mt-2 text-2xl md:text-[28px] font-semibold tracking-tight text-balance leading-tight">
            {greeting}، <span className="text-primary">Hossein Starship</span>
          </h2>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground leading-relaxed text-pretty max-w-md">
            امروز <strong className="text-foreground tnum ltr">{toPersianDigits(stats.cardsDueToday)}</strong> کارت
            FSRS سررسید دارید.
            {stats.focusLabel ? (
              <>
                {" "}تمرکز پیشنهادی: <strong className="text-foreground">{stats.focusLabel}</strong>.
              </>
            ) : null}
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-4">
            <button
              onClick={onStartStudy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[12.5px] font-medium hover:opacity-95 transition shadow-sm"
            >
              <Brain size={14} />
              شروع مرور
              <ArrowUpRight size={13} />
            </button>
            <button
              onClick={onStartMcq}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background text-[12.5px] font-medium hover:bg-muted transition"
            >
              <Target size={14} />
              بلوک MCQ
            </button>
          </div>
        </div>

        <div className="relative mt-5 flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <div className="w-8 h-8 rounded-md bg-amber-500/15 flex items-center justify-center">
            <Flame size={15} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11.5px] font-medium leading-tight">
              <span className="tnum ltr">{toPersianDigits(stats.streakDays)}</span> روز پیوسته مطالعه
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              از store محلی برنامه خوانده می شود.
            </p>
          </div>
          <div className="text-left ltr tnum">
            <p className="text-[10px] text-muted-foreground">آمادگی</p>
            <p className="text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">
              {toPersianDigits(stats.boardReadinessPct)}٪
            </p>
          </div>
        </div>
      </div>

      <div className="xl:col-span-7 grid grid-cols-2 gap-3">
        <KpiCard
          icon={Brain}
          label="کارت های FSRS سررسید"
          value={toPersianDigits(stats.cardsDueToday)}
          unit="کارت"
          delta={stats.cardsDueDelta}
          deltaLabel={stats.cardsDueDelta ? "overdue از FSRS" : undefined}
          tone="amber"
          spark={stats.spark.cardsDue}
          sparkTone="amber"
        />
        <KpiCard
          icon={Target}
          label="MCQ این هفته"
          value={toPersianDigits(stats.mcqThisWeek)}
          unit="پاسخ"
          delta={stats.mcqWeekDelta}
          deltaLabel="از activity واقعی"
          tone="sky"
          spark={stats.spark.mcq}
          sparkTone="sky"
        />
        <KpiCard
          icon={TrendingUp}
          label="دقت کلی پاسخ گویی"
          value={`${toPersianDigits(stats.overallAccuracy)}٪`}
          delta={stats.accuracyDelta}
          deltaLabel="از dashboard stats"
          tone="emerald"
          spark={stats.spark.accuracy}
          sparkTone="emerald"
        />
        <KpiCard
          icon={Flame}
          label="آمادگی بورد"
          value={`${toPersianDigits(stats.boardReadinessPct)}٪`}
          deltaLabel={
            stats.daysUntilBoard == null
              ? "تاریخ آزمون ثبت نشده"
              : `${toPersianDigits(stats.daysUntilBoard)} روز تا آزمون`
          }
          tone="primary"
          spark={stats.spark.readiness}
          sparkTone="primary"
        />
      </div>
    </section>
  )
}
