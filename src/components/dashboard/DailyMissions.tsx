import { Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { Mission } from "./dashboard-types";
import { DashboardSection } from "./DashboardSection";
import { formatNumber, toneClasses } from "./dashboard-utils";
import { cn } from "@/lib/utils";

type DailyMissionsProps = {
  missions: Mission[];
};

export function DailyMissions({ missions }: DailyMissionsProps) {
  return (
    <DashboardSection
      title="Daily Missions"
      description="پیشرفت واقعی امروز؛ عقب‌مانده به‌عنوان هشدار نمایش داده می‌شود"
      eyebrow="TODAY FOCUS"
      icon={<Flame className="h-5 w-5" />}
    >
      <div className="space-y-4">
        {missions.map((mission) => {
          const Icon = mission.icon;
          const tone = toneClasses[mission.tone];
          const current = mission.suffix ? `${formatNumber(mission.current)} ${mission.suffix}` : formatNumber(mission.current);
          const target = mission.target > 0 ? (mission.suffix ? `${formatNumber(mission.target)} ${mission.suffix}` : formatNumber(mission.target)) : "۰";

          return (
            <div key={mission.id} className="rounded-xl border border-border bg-muted/30 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tone.soft, tone.text)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{mission.label}</p>
                    {mission.warning ? <p className="text-xs leading-5 text-warning">{mission.warning}</p> : null}
                  </div>
                </div>
                <Badge variant={mission.warning ? "yield" : "outline"} className="tabular-nums">
                  {current}/{target}
                </Badge>
              </div>
              <Progress value={mission.progress} className={cn("h-2.5", tone.progress)} />
            </div>
          );
        })}
      </div>
    </DashboardSection>
  );
}
