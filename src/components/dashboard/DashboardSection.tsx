import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DashboardSectionProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function DashboardSection({
  title,
  description,
  eyebrow,
  icon,
  action,
  children,
  className,
  contentClassName,
}: DashboardSectionProps) {
  return (
    <section className={className}>
      <Card variant="clinical" className="h-full overflow-hidden rounded-2xl">
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 p-5 pb-3">
          <div className="flex min-w-0 items-start gap-3">
            {icon ? (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                {icon}
              </div>
            ) : null}
            <div className="min-w-0">
              {eyebrow ? (
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  {eyebrow}
                </p>
              ) : null}
              <CardTitle className="text-base">{title}</CardTitle>
              {description ? <CardDescription className="mt-1 leading-6">{description}</CardDescription> : null}
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </CardHeader>
        <CardContent className={cn("p-5 pt-2", contentClassName)}>{children}</CardContent>
      </Card>
    </section>
  );
}
