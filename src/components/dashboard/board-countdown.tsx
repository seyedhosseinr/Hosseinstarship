"use client"

import { Calendar, ChevronLeft, Target } from "lucide-react"

import { toPersianDigits } from "./utils"

export function BoardCountdown({
  daysUntilBoard,
  readinessPct,
}: {
  daysUntilBoard: number | null
  readinessPct: number
}) {
  const ringDeg = (readinessPct / 100) * 360
  const hasExamDate = daysUntilBoard != null

  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-card to-primary/5 p-4 flex flex-col min-h-full">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <Calendar size={14} className="text-primary" />
            <p className="text-[13px] font-semibold tracking-tight">شمارش معکوس بورد</p>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {hasExamDate ? "از برنامه مطالعه" : "تاریخ آزمون هنوز ثبت نشده"}
          </p>
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
          داده واقعی
        </span>
      </div>

      <div className="flex flex-1 items-center gap-4">
        <div
          className="relative w-[112px] h-[112px] shrink-0 rounded-full"
          style={{
            background: `conic-gradient(hsl(var(--primary)) ${ringDeg}deg, hsl(var(--muted)) ${ringDeg}deg)`,
          }}
        >
          <div className="absolute inset-[8px] rounded-full bg-card flex flex-col items-center justify-center">
            <p className="text-[9.5px] text-muted-foreground">روز مانده</p>
            <p className="text-3xl font-semibold tnum ltr leading-none mt-0.5">
              {hasExamDate ? toPersianDigits(daysUntilBoard) : "-"}
            </p>
            <p className="text-[10px] text-primary mt-1.5 tnum ltr font-medium">
              {toPersianDigits(readinessPct)}٪ آمادگی
            </p>
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <div className="flex items-center justify-between text-[10.5px] mb-1">
              <span className="font-medium">Readiness score</span>
              <span className="text-muted-foreground tnum ltr">
                {toPersianDigits(readinessPct)}٪
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${readinessPct}%` }}
              />
            </div>
          </div>

          <p className="text-[10.5px] text-muted-foreground leading-relaxed">
            با ثبت تاریخ آزمون و activity بیشتر، مسیر آمادگی دقیق تر می شود.
          </p>
        </div>
      </div>

      <button className="mt-4 w-full py-2 text-[12px] rounded-lg border border-border bg-background hover:bg-muted transition flex items-center justify-center gap-2 font-medium">
        <Target size={13} className="text-primary" />
        برنامه آمادگی
        <ChevronLeft size={12} />
      </button>
    </div>
  )
}
