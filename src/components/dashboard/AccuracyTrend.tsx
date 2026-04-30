import { Activity } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DashboardEmptyState } from "./DashboardEmptyState";
import { DashboardSection } from "./DashboardSection";
import type { AccuracyPoint } from "./dashboard-types";

type AccuracyTrendProps = {
  points: AccuracyPoint[];
};

export function AccuracyTrend({ points }: AccuracyTrendProps) {
  return (
    <DashboardSection
      title="Accuracy Trend"
      description="روند دقت هفتگی بر اساس فعالیت ثبت‌شده"
      eyebrow="INSIGHT"
      icon={<Activity className="h-5 w-5" />}
      className="lg:col-span-2"
    >
      {points.length === 0 ? (
        <DashboardEmptyState
          icon={<Activity className="h-5 w-5" />}
          title="هنوز فعالیتی برای نمودار نیست"
          description="اولین آزمون یا تمرین هفته، روند دقت را اینجا روشن می‌کند."
        />
      ) : (
        <div className="h-[245px] w-full" aria-label="نمودار روند دقت">
          <ResponsiveContainer>
            <AreaChart data={points} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="dashboardAccuracy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.38} />
                  <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12,
                  color: "hsl(var(--popover-foreground))",
                  direction: "rtl",
                }}
                formatter={(value: number) => [`${value}%`, "دقت"]}
              />
              <Area
                type="monotone"
                dataKey="accuracy"
                stroke="hsl(var(--success))"
                strokeWidth={2.5}
                fill="url(#dashboardAccuracy)"
                dot={{ r: 4, fill: "hsl(var(--success))", strokeWidth: 2, stroke: "hsl(var(--card))" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardSection>
  );
}
