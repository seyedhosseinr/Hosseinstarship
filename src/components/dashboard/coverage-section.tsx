"use client"

import { ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { coverageBarClass, coverageRingColor, toPersianDigits } from "./utils"
import type { ChapterCoverage } from "./types"

function CoverageRing({ pct }: { pct: number }) {
  const r = 18
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  const color = coverageRingColor(pct)
  return (
    <div className="relative w-12 h-12 shrink-0">
      <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.1"
          strokeWidth="4"
        />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-all"
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tnum ltr"
        style={{ color }}
      >
        {toPersianDigits(pct)}٪
      </div>
    </div>
  )
}

function MiniBars({ skills }: { skills: { name: string; pct: number }[] }) {
  return (
    <div className="flex items-end gap-1 h-7" aria-hidden>
      {skills.map((s) => (
        <div key={s.name} className="flex-1 relative" title={`${s.name} ${s.pct}٪`}>
          <div className="absolute bottom-0 inset-x-0 bg-muted rounded-sm" style={{ height: "100%" }} />
          <div
            className={cn("absolute bottom-0 inset-x-0 rounded-sm", coverageBarClass(s.pct))}
            style={{ height: `${s.pct}%` }}
          />
        </div>
      ))}
    </div>
  )
}

export function CoverageSection({
  coverage,
  onOpenAll,
  onOpenChapter,
}: {
  coverage: ChapterCoverage[]
  onOpenAll?: () => void
  onOpenChapter?: (chapter: ChapterCoverage) => void
}) {
  const masteredCount = coverage.filter((c) => c.pct >= 70).length
  const totalDone = coverage.reduce((s, c) => s + c.done, 0)
  const totalAll = coverage.reduce((s, c) => s + c.total, 0)
  const overallPct = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <div>
          <p className="text-[13px] font-semibold tracking-tight">پوشش فصول CWW Urology</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            درصد تسلط بر موضوعات اصلی بورد ABU
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10.5px]">
          <span className="text-muted-foreground">
            <span className="tnum ltr font-medium text-foreground">
              {toPersianDigits(masteredCount)}
            </span>{" "}
            از{" "}
            <span className="tnum ltr">{toPersianDigits(coverage.length)}</span> فصل ≥۷۰٪
          </span>
          <span className="h-3 w-px bg-border" />
          <span className="text-muted-foreground">
            تسلط کلی:{" "}
            <span className="tnum ltr font-medium text-emerald-600 dark:text-emerald-400">
              {toPersianDigits(overallPct)}٪
            </span>
          </span>
          <button
            onClick={onOpenAll}
            className="text-[11px] text-primary hover:underline flex items-center gap-0.5 mr-1"
          >
            همه فصل‌ها
            <ChevronLeft size={11} />
          </button>
        </div>
      </div>

      {coverage.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-[11px] text-muted-foreground">
          هنوز coverage واقعی برای فصل ها ثبت نشده است.
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
        {coverage.map((ch) => (
          <button
            key={ch.sectionName}
            onClick={() => onOpenChapter?.(ch)}
            className="text-right group rounded-lg border border-border hover:border-foreground/20 hover:shadow-sm transition-all bg-card p-3 flex gap-3"
          >
            <CoverageRing pct={ch.pct} />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium truncate group-hover:text-primary transition">
                {ch.sectionFa}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 ltr text-left truncate">
                {ch.cwwRef}
              </p>
              <div className="flex items-center justify-between mt-1.5 mb-1">
                <span className="text-[10px] text-muted-foreground tnum">
                  {toPersianDigits(ch.done)} / {toPersianDigits(ch.total)}
                </span>
                <div className="flex gap-0.5">
                  {ch.subSkills.map((s) => (
                    <span
                      key={s.name}
                      className="text-[8.5px] text-muted-foreground/70"
                      title={`${s.name}: ${s.pct}٪`}
                    >
                      {s.name.slice(0, 3)}
                    </span>
                  ))}
                </div>
              </div>
              <MiniBars skills={ch.subSkills} />
            </div>
          </button>
        ))}
      </div>
      )}
    </div>
  )
}
