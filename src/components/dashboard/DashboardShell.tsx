"use client";

import { useCallback, useMemo } from "react";
import { ActivityFeed } from "./ActivityFeed";
import { AccuracyTrend } from "./AccuracyTrend";
import { CommandCenter } from "./CommandCenter";
import { DailyMissions } from "./DailyMissions";
import { DashboardHero } from "./DashboardHero";
import { JalaliMiniCalendar } from "./JalaliMiniCalendar";
import { MasteryRadar } from "./MasteryRadar";
import { SmartPath } from "./SmartPath";
import { WeakAreas } from "./WeakAreas";
import {
  buildAccuracyData,
  buildActivityFeed,
  buildCommandMetrics,
  buildFeatureLinks,
  buildFlashcardPulse,
  buildHeroModel,
  buildMissions,
  buildRadarData,
  buildSmartPath,
  buildTrapPatterns,
  buildWeakAreas,
} from "./dashboard-utils";
import { useDashboardData } from "@/lib/dashboard/useDashboardData";
import { useThemeStore } from "@/store/useThemeStore";

export function DashboardShell() {
  const dashboard = useDashboardData();
  const theme = useThemeStore((state) => (state.theme === "dark" ? "dark" : "light"));
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const onToggleTheme = useCallback(() => toggleTheme(), [toggleTheme]);

  const viewModel = useMemo(
    () => ({
      hero: buildHeroModel(dashboard),
      commands: buildCommandMetrics(dashboard),
      smartPath: buildSmartPath(dashboard),
      missions: buildMissions(dashboard),
      weakAreas: buildWeakAreas(dashboard),
      radar: buildRadarData(dashboard),
      accuracy: buildAccuracyData(dashboard),
      activity: buildActivityFeed(dashboard),
      flashcardPulse: buildFlashcardPulse(dashboard),
      traps: buildTrapPatterns(dashboard),
      featureLinks: buildFeatureLinks(dashboard),
    }),
    [dashboard],
  );

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-background text-foreground"
      data-dashboard-loading={dashboard.loading ? "true" : "false"}
    >
      <DashboardHero hero={viewModel.hero} theme={theme} onToggleTheme={onToggleTheme} />

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div className="lg:col-span-3">
          <CommandCenter metrics={viewModel.commands} />
        </div>

        <SmartPath steps={viewModel.smartPath} />
        <DailyMissions missions={viewModel.missions} />

        <WeakAreas areas={viewModel.weakAreas} />
        <AccuracyTrend points={viewModel.accuracy} />

        <JalaliMiniCalendar data={dashboard} />
        <MasteryRadar domains={viewModel.radar} />

        <ActivityFeed
          activity={viewModel.activity}
          flashcardPulse={viewModel.flashcardPulse}
          traps={viewModel.traps}
          featureLinks={viewModel.featureLinks}
        />
      </div>
    </main>
  );
}
