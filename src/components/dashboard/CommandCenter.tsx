import type { CommandMetric } from "./dashboard-types";
import { DashboardMetricCard } from "./DashboardMetricCard";

type CommandCenterProps = {
  metrics: CommandMetric[];
};

export function CommandCenter({ metrics }: CommandCenterProps) {
  return (
    <section aria-label="مرکز فرمان امروز" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <DashboardMetricCard
          key={metric.key}
          label={metric.label}
          value={metric.value}
          helper={metric.helper}
          href={metric.href}
          actionLabel={metric.actionLabel}
          tone={metric.tone}
          icon={metric.icon}
        />
      ))}
    </section>
  );
}
