import Link from "next/link";
import { Lightbulb, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { SmartPathStep } from "./dashboard-types";
import { DashboardEmptyState } from "./DashboardEmptyState";
import { DashboardSection } from "./DashboardSection";
import { formatNumber, formatPercent, toneClasses } from "./dashboard-utils";
import { cn } from "@/lib/utils";

type SmartPathProps = {
  steps: SmartPathStep[];
};

export function SmartPath({ steps }: SmartPathProps) {
  return (
    <DashboardSection
      title="Smart Path"
      description="۲ تا ۳ حرکت بعدی، بدون تکرار توصیه اصلی"
      eyebrow="STUDY PATH"
      icon={<Lightbulb className="h-5 w-5" />}
      className="lg:col-span-2"
    >
      {steps.length === 0 ? (
        <DashboardEmptyState
          icon={<Lightbulb className="h-5 w-5" />}
          title="مسیر هوشمند در حال یادگیری است"
          description="با چند مرور یا آزمون، پیشنهادهای دقیق‌تر و محلی ساخته می‌شوند."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const tone = toneClasses[step.tone];
            return (
              <article
                key={step.id}
                className={cn(
                  "flex min-h-[210px] flex-col rounded-2xl border bg-card p-4",
                  tone.border,
                  index === 0 ? "shadow-sm shadow-primary/10" : "",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", tone.soft, tone.text)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <Badge variant={step.tone === "danger" ? "danger" : step.tone === "warning" ? "yield" : "review"}>
                    {index + 1}
                  </Badge>
                </div>
                <h3 className="mt-4 text-base font-bold leading-7 text-foreground">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.subtitle}</p>
                <p className="mt-3 flex-1 text-sm leading-7 text-foreground/80">{step.reason}</p>
                {step.alert ? (
                  <Alert variant="warning" className="mb-3 p-3">
                    <AlertDescription className="text-xs">{step.alert}</AlertDescription>
                  </Alert>
                ) : null}
                <div className="mb-4 flex flex-wrap gap-2">
                  <Badge variant="outline">{step.duration}</Badge>
                  <Badge variant="outline">{formatNumber(step.mcqCount)} MCQ</Badge>
                  <Badge variant={step.accuracy < 65 ? "danger" : "mastery"}>{formatPercent(step.accuracy)}</Badge>
                </div>
                <Button asChild variant={index === 0 ? "clinical" : "clinicalSoft"} className="min-h-touch">
                  <Link href={step.href}>
                    <Play className="h-4 w-4" />
                    شروع
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
