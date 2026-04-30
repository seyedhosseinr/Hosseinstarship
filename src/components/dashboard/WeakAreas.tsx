import Link from "next/link";
import { ArrowUpLeft, CheckCircle2, Target, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { WeakArea } from "./dashboard-types";
import { DashboardEmptyState } from "./DashboardEmptyState";
import { DashboardSection } from "./DashboardSection";
import { formatPercent, toneClasses } from "./dashboard-utils";
import { cn } from "@/lib/utils";

type WeakAreasProps = {
  areas: WeakArea[];
};

export function WeakAreas({ areas }: WeakAreasProps) {
  return (
    <DashboardSection
      title="Weak Areas"
      description={areas.length > 0 ? `${areas.length} نقطه ضعف قابل اقدام` : "ضعف فعال ثبت نشده"}
      eyebrow="WEAK DOMAIN"
      icon={<Target className="h-5 w-5" />}
    >
      {areas.length === 0 ? (
        <DashboardEmptyState
          icon={<CheckCircle2 className="h-5 w-5" />}
          title="فعلا نقطه ضعف واضحی ندارید"
          description="با حل سؤال بیشتر، ضعف‌های واقعی همین‌جا به مسیر تمرین وصل می‌شوند."
        />
      ) : (
        <div className="space-y-3">
          {areas.map((area) => {
            const tone = toneClasses[area.tone];
            const TrendIcon = area.trend === "improving" ? TrendingUp : area.trend === "declining" ? TrendingDown : Target;
            return (
              <article key={area.id} className={cn("rounded-xl border bg-card p-3", tone.border)}>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-bold text-foreground">{area.label}</h3>
                      <TrendIcon className={cn("h-4 w-4", tone.text)} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{area.action}</p>
                  </div>
                  <Badge variant={area.tone === "danger" ? "danger" : area.tone === "warning" ? "yield" : "review"}>
                    {formatPercent(area.accuracy)}
                  </Badge>
                </div>
                <Progress value={area.accuracy} className={cn("h-2.5", tone.progress)} />
                <Button asChild variant="ghostClinical" size="sm" className="mt-3 min-h-touch w-full">
                  <Link href={area.href}>
                    تمرین هدفمند
                    <ArrowUpLeft className="h-4 w-4" />
                  </Link>
                </Button>
              </article>
            );
          })}
        </div>
      )}
    </DashboardSection>
  );
}
