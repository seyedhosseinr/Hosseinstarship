import { Skeleton } from "@/components/ui/skeleton";

/* ── Glass Card Wrapper ── */
function GlassCardSkeleton({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[20px] border border-border/30 bg-card/60 p-6 backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

/* ── Section Head Skeleton ── */
function SectionHeadSkeleton() {
  return (
    <div className="mb-5 flex items-center gap-3">
      <Skeleton className="h-9 w-9 rounded-[10px]" />
      <div>
        <Skeleton className="mb-1.5 h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

/* ── Hero Skeleton ── */
function HeroSkeleton() {
  return (
    <GlassCardSkeleton className="mx-auto max-w-[1440px]">
      <div className="flex flex-col items-center gap-6 md:flex-row md:items-start md:justify-between">
        {/* Greeting text (left / RTL right) */}
        <div className="flex flex-col gap-2 text-center md:text-start">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="mt-1 h-3 w-40" />
        </div>

        {/* Large circular score ring (120px) */}
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-[120px] w-[120px] rounded-full" />
          <Skeleton className="h-3 w-20" />
        </div>

        {/* 2x2 grid of mini stat cards */}
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 rounded-xl bg-muted/20 px-4 py-3"
            >
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* XP progress bar */}
      <div className="mt-5 flex items-center gap-3">
        <Skeleton className="h-2.5 flex-1 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </div>
    </GlassCardSkeleton>
  );
}

/* ── Command Center Skeleton ── */
export function CommandCenterSkeleton() {
  return (
    <GlassCardSkeleton>
      <SectionHeadSkeleton />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-3 rounded-2xl bg-muted/20 p-5"
          >
            <Skeleton className="h-12 w-12 rounded-xl" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
    </GlassCardSkeleton>
  );
}

/* ── Radar Chart Skeleton ── */
export function RadarChartSkeleton() {
  return (
    <GlassCardSkeleton>
      <SectionHeadSkeleton />
      <div className="flex h-[260px] items-center justify-center">
        <div className="relative">
          <Skeleton className="h-48 w-48 rounded-full opacity-20" />
          <Skeleton className="absolute inset-4 rounded-full opacity-35" />
          <Skeleton className="absolute inset-12 rounded-full opacity-50" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 rounded-[10px]" />
        ))}
      </div>
    </GlassCardSkeleton>
  );
}

/* ── Trend Chart Skeleton ── */
export function TrendChartSkeleton() {
  return (
    <GlassCardSkeleton>
      <SectionHeadSkeleton />
      <div className="flex h-[240px] items-end gap-3 px-4 pt-8">
        {[55, 62, 68, 65, 75, 79, 81].map((h, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t-md"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </GlassCardSkeleton>
  );
}

/* ── Calendar Skeleton ── */
export function CalendarSkeleton() {
  return (
    <GlassCardSkeleton>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Skeleton className="mb-1.5 h-4 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9 rounded-[10px]" />
          <Skeleton className="h-9 w-9 rounded-[10px]" />
        </div>
      </div>
      <div className="mb-2 grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="mx-auto h-4 w-4" />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    </GlassCardSkeleton>
  );
}

/* ── Card List Skeleton (reusable for Smart Path, Weak Areas, Daily Missions, etc.) ── */
export function CardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <GlassCardSkeleton>
      <SectionHeadSkeleton />
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-xl bg-muted/20 p-3.5"
          >
            <Skeleton className="mt-0.5 h-6 w-6 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </GlassCardSkeleton>
  );
}

/* ── Flashcard Pulse Skeleton ── */
export function FlashcardPulseSkeleton() {
  return (
    <GlassCardSkeleton>
      <SectionHeadSkeleton />
      <div className="flex items-start gap-5">
        {/* Ring */}
        <Skeleton className="h-20 w-20 shrink-0 rounded-full" />
        {/* Stat rows */}
        <div className="flex-1 space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3.5 w-12" />
            </div>
          ))}
        </div>
      </div>
      {/* Progress bar */}
      <Skeleton className="mt-5 h-2 w-full rounded-full" />
    </GlassCardSkeleton>
  );
}

/* ── Feature Hub Skeleton ── */
export function FeatureHubSkeleton() {
  return (
    <GlassCardSkeleton>
      <SectionHeadSkeleton />
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-2 rounded-xl bg-muted/20 p-4"
          >
            <Skeleton className="h-11 w-11 rounded-xl" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    </GlassCardSkeleton>
  );
}

/* ── KPI Row (alias for Hero) ── */
export function KPIRowSkeleton() {
  return <HeroSkeleton />;
}

/* ── Activity Timeline Skeleton ── */
function ActivityTimelineSkeleton() {
  return (
    <GlassCardSkeleton>
      <SectionHeadSkeleton />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="mt-1 h-3 w-3 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </GlassCardSkeleton>
  );
}

/* ── Full Dashboard Skeleton ── */
export function FullDashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-5 p-5">
      {/* ── 1. HERO ── */}
      <HeroSkeleton />

      {/* ── 2. COMMAND CENTER ── */}
      <CommandCenterSkeleton />

      {/* ── 3. BENTO GRID ── */}
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Row 1: Mastery Radar | Accuracy Trend | Jalali Calendar */}
        <RadarChartSkeleton />
        <TrendChartSkeleton />
        <CalendarSkeleton />

        {/* Row 2: Smart Path (2col wide) | Daily Missions */}
        <div className="md:col-span-2">
          <CardListSkeleton count={3} />
        </div>
        <CardListSkeleton count={4} />

        {/* Row 3: Weak Areas | Flashcard Pulse | Trap Patterns */}
        <CardListSkeleton count={3} />
        <FlashcardPulseSkeleton />
        <CardListSkeleton count={3} />

        {/* Row 4: Activity Timeline | Feature Hub (2col wide) */}
        <ActivityTimelineSkeleton />
        <div className="md:col-span-2">
          <FeatureHubSkeleton />
        </div>
      </div>
    </div>
  );
}
