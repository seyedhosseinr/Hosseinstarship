import { Brain } from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { DashboardEmptyState } from "./DashboardEmptyState";
import { DashboardSection } from "./DashboardSection";
import type { RadarDomain } from "./dashboard-types";
import { formatPercent, toneClasses } from "./dashboard-utils";
import { cn } from "@/lib/utils";

type MasteryRadarProps = {
  domains: RadarDomain[];
};

export function MasteryRadar({ domains }: MasteryRadarProps) {
  return (
    <DashboardSection
      title="Mastery Radar"
      description="Baseline یعنی ترکیب تسلط و اعتماد، نه میانگین جمعیت"
      eyebrow="ANALYTICS"
      icon={<Brain className="h-5 w-5" />}
    >
      {domains.length === 0 ? (
        <DashboardEmptyState
          icon={<Brain className="h-5 w-5" />}
          title="هنوز رادار تسلط شکل نگرفته"
          description="با آزمون و مرور بیشتر، حوزه‌های تسلط از داده محلی ساخته می‌شوند."
        />
      ) : (
        <>
          <div className="h-[250px] w-full" aria-label="رادار تسلط حوزه‌ها">
            <ResponsiveContainer>
              <RadarChart data={domains.map((d) => ({ subject: d.domain, you: d.you, baseline: d.baseline }))}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <PolarRadiusAxis domain={[0, 100]} axisLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Radar name="You" dataKey="you" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.24} strokeWidth={2} />
                <Radar name="Confidence baseline" dataKey="baseline" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground))" fillOpacity={0.08} strokeDasharray="4 4" />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    color: "hsl(var(--popover-foreground))",
                    direction: "rtl",
                  }}
                  formatter={(value: number, name: string) => [
                    `${value}%`,
                    name === "you" ? "شما" : "Confidence baseline",
                  ]}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {domains.map((domain) => {
              const Icon = domain.icon;
              const tone = toneClasses[domain.tone];
              return (
                <div key={domain.domain} className="flex items-center gap-2 rounded-xl bg-muted/50 p-2">
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", tone.soft, tone.text)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{domain.domain}</span>
                  <Badge variant={domain.you < 65 ? "danger" : "mastery"}>{formatPercent(domain.you)}</Badge>
                </div>
              );
            })}
          </div>
        </>
      )}
    </DashboardSection>
  );
}
