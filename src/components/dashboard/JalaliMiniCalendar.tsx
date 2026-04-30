"use client";

import { useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DashboardData } from "./dashboard-types";
import {
  buildCalendarCells,
  formatNumber,
  JALALI_MONTHS,
  JALALI_WD_SHORT,
  jalaliMonthDays,
  todayJalali,
} from "./dashboard-utils";
import { DashboardSection } from "./DashboardSection";
import { cn } from "@/lib/utils";

type JalaliMiniCalendarProps = {
  data: DashboardData;
};

export function JalaliMiniCalendar({ data }: JalaliMiniCalendarProps) {
  const today = todayJalali();
  const [view, setView] = useState({ jy: today.jy, jm: today.jm });
  const cells = useMemo(() => buildCalendarCells(data, view.jy, view.jm), [data, view.jm, view.jy]);
  const activeDays = cells.filter((cell) => cell.current && cell.intensity > 0).length;
  const isCurrentMonth = view.jy === today.jy && view.jm === today.jm;

  const previousMonth = () => setView((v) => (v.jm === 1 ? { jy: v.jy - 1, jm: 12 } : { ...v, jm: v.jm - 1 }));
  const nextMonth = () => setView((v) => (v.jm === 12 ? { jy: v.jy + 1, jm: 1 } : { ...v, jm: v.jm + 1 }));

  return (
    <DashboardSection
      title={`${JALALI_MONTHS[view.jm - 1]} ${formatNumber(view.jy)}`}
      description={`${formatNumber(activeDays)} از ${formatNumber(jalaliMonthDays(view.jy, view.jm))} روز فعال`}
      eyebrow="STUDY MAP"
      icon={<Calendar className="h-5 w-5" />}
      action={
        <div className="flex items-center gap-1">
          {!isCurrentMonth ? (
            <Button type="button" variant="ghostClinical" size="sm" onClick={() => setView({ jy: today.jy, jm: today.jm })}>
              امروز
            </Button>
          ) : null}
          <Button type="button" variant="ghostClinical" size="icon" aria-label="ماه بعد" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghostClinical" size="icon" aria-label="ماه قبل" onClick={previousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-7 gap-1 text-center" dir="rtl">
        {JALALI_WD_SHORT.map((day) => (
          <div key={day} className="py-1 text-xs font-bold text-muted-foreground">
            {day}
          </div>
        ))}
        {cells.map((cell) => (
          <div
            key={cell.key}
            className={cn(
              "relative flex aspect-square min-h-10 items-center justify-center rounded-xl border text-sm font-semibold tabular-nums",
              cell.current ? "border-border text-foreground" : "border-transparent text-muted-foreground/35",
              cell.today ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-muted/30",
            )}
            style={
              cell.current && cell.intensity > 0 && !cell.today
                ? { backgroundColor: `hsl(var(--primary) / ${Math.min(0.1 + cell.intensity / 160, 0.65)})` }
                : undefined
            }
          >
            {formatNumber(cell.day)}
            {cell.current && cell.intensity > 0 && !cell.today ? (
              <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" />
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <span>کم</span>
        {[0.16, 0.3, 0.48, 0.68].map((opacity) => (
          <span key={opacity} className="h-3 w-3 rounded-sm bg-primary" style={{ opacity }} />
        ))}
        <span>زیاد</span>
      </div>
    </DashboardSection>
  );
}
