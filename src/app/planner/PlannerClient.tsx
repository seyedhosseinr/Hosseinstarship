"use client";

import { useCallback, useEffect, useState, Component, type ReactNode } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CalendarCheck, CalendarDays, Flame, RefreshCw, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Surface } from "@/components/ui/surface";
import { TodayTaskList } from "@/components/planner/TodayTaskList";
import { WeeklyView } from "@/components/planner/WeeklyView";
import { RescheduleDialog } from "@/components/planner/RescheduleDialog";
import { PLANNER_STYLES } from "@/components/planner/planner-tokens";
import { n, useVisibilityRefresh } from "@/components/planner/task-helpers";
import { cn } from "@/lib/utils";
import { getPlannerSummaryAction } from "@/lib/actions/planner-runtime-actions";
import { isLocalFirstEnabled } from "@/lib/local-first/flag";
import { getSummaryLocal } from "@/lib/local-first/planner-local";

type Tab = "today" | "week";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "today", label: "امروز", icon: CalendarCheck },
  { id: "week", label: "هفته", icon: CalendarDays },
];

type PlannerSummary = {
  plan: { title: string; progressPercent: number; completedTasks: number; totalTasks: number } | null;
  today: { totalTasks: number; completedTasks: number; progressPercent: number; estimatedMinutes: number } | null;
  streak: { current: number; longest: number };
  overdueTasks: number;
  upcomingTaskCount: number;
};

class PlannerErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("[PlannerRuntime]", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-4xl px-4 py-12 md:px-6">
          <Surface variant="subtle" padding="lg" radius="lg">
            <div className="flex flex-col items-center gap-4 py-8">
              <AlertTriangle size={22} className="text-muted-foreground/70" />
              <div className="text-[13.5px] font-semibold text-foreground">
                خطایی در نمایش planner رخ داد
              </div>
              <button
                onClick={() => {
                  this.setState({ hasError: false });
                  window.location.reload();
                }}
                className="inline-flex h-8 items-center gap-2 rounded-md border border-border/60 bg-background px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-foreground/[0.03]"
              >
                <RefreshCw size={12} />
                بارگذاری مجدد
              </button>
            </div>
          </Surface>
        </div>
      );
    }

    return this.props.children;
  }
}

function PlannerProgressBanner({ summary }: { summary: PlannerSummary | null }) {
  if (!summary?.plan) return null;

  const planPct = summary.plan.progressPercent;
  const todayDone = summary.today?.completedTasks ?? 0;
  const todayTotal = summary.today?.totalTasks ?? 0;
  const isComplete = planPct >= 100;

  return (
    <div className="mb-5 rounded-[14px] border border-border/70 bg-card px-4 py-3">
      <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <TrendingUp size={13} className="shrink-0 text-muted-foreground/70" />
          <span className="truncate text-[12.5px] font-medium text-foreground">
            {summary.plan.title}
          </span>
          <div className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-foreground/[0.06]">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500",
                isComplete ? "bg-success" : "bg-foreground/55",
              )}
              style={{ width: `${planPct}%` }}
            />
          </div>
          <span className="tabular-nums text-[11.5px] font-semibold text-foreground">
            {n(planPct)}%
          </span>
        </div>
        <div className="h-4 w-px bg-border/70" />
        <span className="flex items-center gap-1 tabular-nums">
          <CalendarCheck size={12} className="text-muted-foreground/70" />
          {n(todayDone)}/{n(todayTotal)}
        </span>
        {summary.streak.current > 0 ? (
          <span className="flex items-center gap-1 tabular-nums">
            <Flame size={12} className="text-muted-foreground/70" />
            {n(summary.streak.current)}
          </span>
        ) : null}
        {summary.overdueTasks > 0 ? (
          <span className="flex items-center gap-1 tabular-nums font-medium text-destructive/90">
            <AlertTriangle size={12} />
            {n(summary.overdueTasks)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default function PlannerClient() {
  const [activeTab, setActiveTab] = useState<Tab>("today");
  const [rescheduleTaskId, setRescheduleTaskId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [summary, setSummary] = useState<PlannerSummary | null>(null);

  const fetchSummary = useCallback(async () => {
    // Local-first: show cached summary immediately
    if (isLocalFirstEnabled()) {
      try {
        const local = await getSummaryLocal();
        if (local) setSummary(local);
      } catch { /* Dexie unavailable */ }
    }

    try {
      const result = await getPlannerSummaryAction();
      if (result.ok) {
        setSummary(result.data);
      }
    } catch {
      // silent refresh — local data already shown if available
    }
  }, []);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((value) => value + 1);
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useVisibilityRefresh(fetchSummary, true);

  return (
    <PlannerErrorBoundary>
      <div data-planner className="mx-auto max-w-4xl px-4 pb-14 md:px-6">
        <style dangerouslySetInnerHTML={{ __html: PLANNER_STYLES }} />
        <PageHeader
          title="برنامه مطالعه"
          description="نمای امروز و هفته‌ی پلن فعال شما."
          icon={<CalendarCheck size={18} className="text-muted-foreground" />}
          breadcrumb={[
            { label: "داشبورد", href: "/" },
            { label: "برنامه مطالعه" },
          ]}
        />

        <PlannerProgressBanner summary={summary} />

        {/* Linear-style segmented tabs */}
        <div
          role="tablist"
          aria-label="نمای planner"
          className="mb-5 inline-flex items-center gap-0.5 rounded-md border border-border/60 bg-muted/30 p-0.5"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative inline-flex h-7 items-center gap-1.5 rounded-[5px] px-3 text-[12.5px] font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40 focus-visible:ring-offset-0",
                  isActive
                    ? "bg-background text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <TabIcon size={13} strokeWidth={1.75} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <motion.div
          key={`${activeTab}-${refreshKey}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          {activeTab === "today" ? (
            <TodayTaskList onReschedule={setRescheduleTaskId} />
          ) : (
            <WeeklyView onReschedule={setRescheduleTaskId} />
          )}
        </motion.div>

        <RescheduleDialog
          open={rescheduleTaskId !== null}
          taskId={rescheduleTaskId}
          onClose={() => setRescheduleTaskId(null)}
          onDone={triggerRefresh}
        />
      </div>
    </PlannerErrorBoundary>
  );
}
