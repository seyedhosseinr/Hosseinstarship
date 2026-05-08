"use client"

import { useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Award, ChevronLeft, Filter } from "lucide-react"
import { cn } from "@/lib/utils"
import { toPersianDigits } from "./utils"
import type { DifficultyBucket, McqChapterStat, TrendPoint } from "./types"

function chapterColor(pct: number) {
  if (pct >= 80) return "hsl(var(--chart-2))"
  if (pct >= 70) return "hsl(var(--chart-1))"
  if (pct >= 60) return "hsl(var(--chart-3))"
  return "hsl(var(--chart-4))"
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ payload: { chapterFa?: string; chapterEn?: string; accuracy?: number; answered?: number; total?: number; cards?: number; label?: string } }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-2 shadow-lg text-popover-foreground">
      <p className="text-[11px] font-medium">
        {d.chapterFa ?? d.label ?? label}
        {d.chapterEn && (
          <span className="text-muted-foreground mr-1.5 ltr">· {d.chapterEn}</span>
        )}
      </p>
      {d.accuracy !== undefined && (
        <p className="text-[10.5px] text-muted-foreground mt-1 tnum">
          دقت: <span className="text-foreground font-medium ltr">{toPersianDigits(d.accuracy)}٪</span>
        </p>
      )}
      {d.answered !== undefined && d.total !== undefined && (
        <p className="text-[10px] text-muted-foreground tnum">
          {toPersianDigits(d.answered)} از {toPersianDigits(d.total)}
        </p>
      )}
      {d.cards !== undefined && (
        <p className="text-[10.5px] text-muted-foreground mt-1 tnum">
          کارت: <span className="text-foreground font-medium ltr">{toPersianDigits(d.cards)}</span>
        </p>
      )}
    </div>
  )
}

function McqByChapter({
  data,
  onOpenQbank,
}: {
  data: McqChapterStat[]
  onOpenQbank?: () => void
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[13px] font-semibold tracking-tight">عملکرد MCQ به تفکیک فصل</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            بر اساس فصل‌بندی Campbell-Walsh-Wein
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2.5">
            {[
              { label: "≥۸۰٪", color: "hsl(var(--chart-2))" },
              { label: "۷۰–۷۹٪", color: "hsl(var(--chart-1))" },
              { label: "۶۰–۶۹٪", color: "hsl(var(--chart-3))" },
              { label: "<۶۰٪", color: "hsl(var(--chart-4))" },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span
                  className="inline-block w-2 h-2 rounded-sm"
                  style={{ background: l.color }}
                />
                {l.label}
              </span>
            ))}
          </div>
          <button
            onClick={onOpenQbank}
            aria-label="فیلتر"
            className="w-7 h-7 rounded-md border border-border hover:bg-muted flex items-center justify-center transition text-muted-foreground"
          >
            <Filter size={12} />
          </button>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="h-[220px] w-full rounded-lg border border-dashed border-border flex items-center justify-center text-[11px] text-muted-foreground">
          هنوز عملکرد فصل ها ثبت نشده است.
        </div>
      ) : (
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 18, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid
              vertical={false}
              stroke="hsl(var(--border))"
              strokeDasharray="3 3"
              opacity={0.6}
            />
            <XAxis
              dataKey="chapterFa"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              dy={4}
            />
            <YAxis
              domain={[40, 100]}
              ticks={[50, 60, 70, 80, 90, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => `${toPersianDigits(v)}٪`}
              width={40}
            />
            <Tooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} content={<ChartTooltip />} />
            <ReferenceLine
              y={70}
              stroke="hsl(var(--chart-1))"
              strokeDasharray="4 3"
              strokeOpacity={0.5}
              label={{
                value: "ABU 70٪",
                position: "right",
                fontSize: 9,
                fill: "hsl(var(--chart-1))",
              }}
            />
            <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
              {data.map((entry) => (
                <Cell key={entry.chapterFa} fill={chapterColor(entry.accuracy)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      )}
    </div>
  )
}

function TrendChart({ data }: { data: TrendPoint[] }) {
  const [metric, setMetric] = useState<"accuracy" | "cards">("accuracy")
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[13px] font-semibold tracking-tight">روند اخیر</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              هنوز داده زمانی کافی وجود ندارد.
            </p>
          </div>
        </div>
        <div className="h-[180px] rounded-lg border border-dashed border-border flex items-center justify-center text-[11px] text-muted-foreground">
          بعد از ثبت activity واقعی، نمودار پر می شود.
        </div>
      </div>
    )
  }
  const last = data[data.length - 1]
  const first = data[0]
  const delta = last[metric] - first[metric]

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[13px] font-semibold tracking-tight">روند ۱۵ روز اخیر</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-semibold tnum ltr leading-none">
              {metric === "accuracy"
                ? `${toPersianDigits(last.accuracy)}٪`
                : toPersianDigits(last.cards)}
            </p>
            <span
              className={cn(
                "text-[10.5px] font-medium tnum ltr",
                delta >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400",
              )}
            >
              {delta >= 0 ? "+" : ""}
              {toPersianDigits(delta)}
              {metric === "accuracy" ? "٪" : ""}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-muted/60 p-0.5">
          {(["accuracy", "cards"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[10.5px] font-medium transition",
                metric === m
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "accuracy" ? "دقت" : "کارت‌ها"}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="hsl(var(--border))"
              strokeDasharray="3 3"
              opacity={0.5}
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
              interval={2}
              dy={4}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
              width={32}
              domain={metric === "accuracy" ? [60, 90] : [20, 60]}
            />
            <Tooltip content={<ChartTooltip />} />
            <Line
              type="monotone"
              dataKey={metric}
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "hsl(var(--chart-1))" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function DifficultyDonut({
  data,
  onOpenQbank,
}: {
  data: DifficultyBucket[]
  onOpenQbank?: () => void
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const hasData = total > 0

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[13px] font-semibold tracking-tight">توزیع سختی سؤالات</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            کل: <span className="tnum ltr">{toPersianDigits(total.toLocaleString())}</span> سؤال
          </p>
        </div>
        <Award size={14} className="text-muted-foreground" />
      </div>

      {hasData ? (
      <div className="grid grid-cols-2 gap-3 items-center">
        <div className="relative h-[150px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={62}
                paddingAngle={2}
                stroke="hsl(var(--card))"
                strokeWidth={2}
              >
                {data.map((d) => (
                  <Cell key={d.label} fill={d.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload as DifficultyBucket
                  return (
                    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 shadow-lg">
                      <p className="text-[11px] font-medium">{d.label}</p>
                      <p className="text-[10px] text-muted-foreground tnum">
                        {toPersianDigits(d.value.toLocaleString())} ·{" "}
                        {toPersianDigits(((d.value / total) * 100).toFixed(0))}٪
                      </p>
                    </div>
                  )
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-[9px] text-muted-foreground">میانگین</p>
            <p className="text-base font-semibold tnum ltr">۶٫۸ / ۱۰</p>
          </div>
        </div>

        <ul className="space-y-1.5">
          {data.map((d) => (
            <li key={d.label} className="flex items-center gap-2 text-[11px]">
              <span
                className="w-2 h-2 rounded-sm shrink-0"
                style={{ background: d.color }}
              />
              <span className="flex-1 text-muted-foreground">{d.label}</span>
              <span className="tnum ltr font-medium">
                {toPersianDigits(d.value)}
              </span>
              <span className="tnum ltr text-muted-foreground text-[9.5px] w-9 text-left">
                {toPersianDigits(Math.round((d.value / total) * 100))}٪
              </span>
            </li>
          ))}
        </ul>
      </div>
      ) : (
        <div className="h-[150px] rounded-lg border border-dashed border-border flex items-center justify-center text-[11px] text-muted-foreground">
          داده سختی/ضعف واقعی هنوز آماده نیست.
        </div>
      )}

      <button
        onClick={onOpenQbank}
        className="mt-3 w-full text-[11px] text-primary hover:underline font-medium flex items-center gap-0.5 justify-center"
      >
        تحلیل کامل سختی
        <ChevronLeft size={11} />
      </button>
    </div>
  )
}

export { McqByChapter, TrendChart }

export function AnalyticsSection({
  mcqByChapter,
  trend,
  onOpenQbank,
}: {
  mcqByChapter: McqChapterStat[]
  trend: TrendPoint[]
  onOpenQbank?: () => void
}) {
  return (
    <section className="grid grid-cols-1 xl:grid-cols-12 gap-3" aria-label="تحلیل عملکرد">
      <div className="xl:col-span-8">
        <McqByChapter data={mcqByChapter} onOpenQbank={onOpenQbank} />
      </div>
      <div className="xl:col-span-4">
        <TrendChart data={trend} />
      </div>
    </section>
  )
}
