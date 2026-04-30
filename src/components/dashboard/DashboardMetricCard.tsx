import Link from "next/link";
import { ArrowUpLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ClinicalTone, DashboardIcon } from "./dashboard-types";
import { toneClasses } from "./dashboard-utils";
import { cn } from "@/lib/utils";

type DashboardMetricCardProps = {
  label: string;
  value: string;
  helper: string;
  href?: string;
  actionLabel?: string;
  tone: ClinicalTone;
  icon: DashboardIcon;
  className?: string;
};

export function DashboardMetricCard({
  label,
  value,
  helper,
  href,
  actionLabel,
  tone,
  icon: Icon,
  className,
}: DashboardMetricCardProps) {
  const toneClass = toneClasses[tone];

  return (
    <Card variant="clinical" className={cn("rounded-2xl", toneClass.border, className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <Badge variant="outline" className={cn("border-current/20", toneClass.text)}>
            {label}
          </Badge>
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", toneClass.soft, toneClass.text)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <p className={cn("text-3xl font-black tabular-nums tracking-normal", toneClass.text)}>{value}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{helper}</p>
          </div>
          {href && actionLabel ? (
            <Button asChild variant="ghostClinical" size="sm" className="min-h-touch shrink-0">
              <Link href={href} aria-label={`${actionLabel}: ${label}`}>
                {actionLabel}
                <ArrowUpLeft className="h-4 w-4" />
              </Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
