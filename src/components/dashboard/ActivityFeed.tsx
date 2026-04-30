"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowUpLeft,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  HeartPulse,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ActivityItem, FeatureLinkModel, FlashcardPulseModel, TrapPattern } from "./dashboard-types";
import { DashboardEmptyState } from "./DashboardEmptyState";
import { DashboardSection } from "./DashboardSection";
import { formatNumber, formatPercent, toneClasses } from "./dashboard-utils";
import { cn } from "@/lib/utils";

type ActivityFeedProps = {
  activity: ActivityItem[];
  flashcardPulse: FlashcardPulseModel;
  traps: TrapPattern[];
  featureLinks: FeatureLinkModel[];
};

export function ActivityFeed({ activity, flashcardPulse, traps, featureLinks }: ActivityFeedProps) {
  const [resolved, setResolved] = useState<Record<string, boolean>>({});
  const visibleTraps = useMemo(
    () => traps.map((trap) => ({ ...trap, resolved: resolved[trap.id] ?? trap.resolved })),
    [resolved, traps],
  );
  const retentionTone = flashcardPulse.retentionRate >= 85 ? "success" : flashcardPulse.retentionRate >= 60 ? "warning" : "danger";
  const retention = toneClasses[retentionTone];
  const pulseStats: Array<[string, number, typeof CreditCard]> = [
    ["امروز باقی‌مانده", flashcardPulse.dueToday, CreditCard],
    ["این هفته", flashcardPulse.dueThisWeek, Clock],
    ["مرور شده", flashcardPulse.reviewedToday, CheckCircle2],
    ["عقب‌مانده", flashcardPulse.overdue, AlertTriangle],
    ["بالغ", flashcardPulse.matureCards, HeartPulse],
    ["در حال یادگیری", flashcardPulse.learningCards, Layers],
    ["جدید", flashcardPulse.newCards, CreditCard],
    ["کل کارت‌ها", flashcardPulse.totalCards, BookOpen],
  ];

  return (
    <DashboardSection
      title="Clinical Feed"
      description="فعالیت، سلامت SRS، الگوهای خطا و مسیرهای اصلی"
      eyebrow="RECENT"
      icon={<Activity className="h-5 w-5" />}
      className="lg:col-span-3"
      contentClassName="pt-0"
    >
      <Tabs defaultValue="activity" className="w-full">
        <TabsList className="mb-1 flex w-full justify-start overflow-x-auto">
          <TabsTrigger value="activity">فعالیت</TabsTrigger>
          <TabsTrigger value="srs">SRS</TabsTrigger>
          <TabsTrigger value="traps">تله‌ها</TabsTrigger>
          <TabsTrigger value="shortcuts">مسیرها</TabsTrigger>
        </TabsList>

        <TabsContent value="activity">
          {activity.length === 0 ? (
            <DashboardEmptyState
              icon={<Clock className="h-5 w-5" />}
              title="تایم‌لاین خالی است"
              description="مطالعه، آزمون یا مرور کارت‌ها بعد از ثبت، اینجا نمایش داده می‌شود."
            />
          ) : (
            <ScrollArea className="max-h-[330px]">
              <div className="space-y-2">
                {activity.map((item) => {
                  const tone = toneClasses[item.tone];
                  return (
                    <article key={item.id} className="flex gap-3 rounded-xl border border-border bg-card p-3">
                      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tone.soft, tone.text)}>
                        {item.tone === "success" ? <Check className="h-4 w-4" /> : item.tone === "danger" ? <AlertTriangle className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-7 text-foreground">{item.text}</p>
                        <p className="text-xs text-muted-foreground">{item.time}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="srs">
          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-border bg-muted/30 p-4 text-center">
              <div className={cn("mx-auto flex h-24 w-24 items-center justify-center rounded-full border-8 bg-card", retention.border)}>
                <span className={cn("text-2xl font-black tabular-nums", retention.text)}>{formatPercent(flashcardPulse.retentionRate)}</span>
              </div>
              <p className="mt-3 text-sm font-bold text-foreground">Retention Rate</p>
              <Badge className="mt-2" variant={retentionTone === "danger" ? "danger" : retentionTone === "warning" ? "yield" : "mastery"}>
                {retentionTone === "success" ? "عالی" : retentionTone === "warning" ? "متوسط" : "نیازمند مرور"}
              </Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {pulseStats.map(([label, value, Icon]) => (
                <div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="text-sm text-muted-foreground">{label}</span>
                  </div>
                  <span className="font-bold tabular-nums text-foreground">{formatNumber(value)}</span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="traps">
          {visibleTraps.length === 0 ? (
            <DashboardEmptyState
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="تله فعال ثبت نشده"
              description="بعد از تحلیل اشتباهات، الگوهای دام‌دار اینجا برای مرور سریع می‌آیند."
            />
          ) : (
            <ScrollArea className="max-h-[360px]">
              <div className="space-y-2">
                {visibleTraps.map((trap) => (
                  <article key={trap.id} className={cn("rounded-xl border p-3", trap.resolved ? "border-success/20 bg-success/5" : "border-warning/25 bg-card")}>
                    <div className="flex items-start gap-3">
                      <Button
                        type="button"
                        variant={trap.resolved ? "clinicalSoft" : "outline"}
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={() => setResolved((prev) => ({ ...prev, [trap.id]: !(prev[trap.id] ?? trap.resolved) }))}
                        aria-label={trap.resolved ? "بازگرداندن تله به حالت فعال" : "علامت‌گذاری تله به عنوان حل‌شده"}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-sm font-semibold leading-7 text-foreground", trap.resolved && "line-through opacity-60")}>
                          {trap.question}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="yield">{trap.trapType}</Badge>
                          <Badge variant="outline">{trap.domain}</Badge>
                          <Badge variant={trap.difficulty === "Hard" ? "danger" : "outline"}>{trap.difficulty}</Badge>
                        </div>
                        <div className="mt-3 rounded-xl bg-muted/60 p-3 text-xs leading-6 text-muted-foreground">
                          <p>
                            پاسخ شما: <span className="text-danger">{trap.yourAnswer}</span>
                          </p>
                          <p>
                            پاسخ صحیح: <span className="text-success">{trap.correctAnswer}</span>
                          </p>
                          <p className="mt-1">{trap.explanation}</p>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="shortcuts">
          {featureLinks.length === 0 ? (
            <DashboardEmptyState
              icon={<Layers className="h-5 w-5" />}
              title="مسیر سریعی فعال نیست"
              description="وقتی قابلیت‌ها در runtime فعال باشند، میانبرهای آفلاین همین‌جا می‌آیند."
            />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {featureLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Button key={link.key} asChild variant="outline" className="h-auto min-h-[72px] justify-start rounded-xl p-3">
                    <Link href={link.href} className="flex w-full items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1 text-right">
                        <span className="block truncate text-sm font-bold text-foreground">{link.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{link.subtitle}</span>
                      </span>
                      {link.count != null && link.count > 0 ? <Badge variant="mastery">{formatNumber(link.count)}</Badge> : null}
                      <ArrowUpLeft className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </Button>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </DashboardSection>
  );
}
