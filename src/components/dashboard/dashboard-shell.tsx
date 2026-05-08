"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { useDashboardData } from "@/lib/dashboard/useDashboardData"
import { ActivityFeed } from "./activity-feed"
import { AnalyticsSection, DifficultyDonut } from "./analytics-section"
import { AppSidebar } from "./app-sidebar"
import { BoardCountdown } from "./board-countdown"
import { CommandPalette } from "./command-palette"
import { CoverageSection } from "./coverage-section"
import { FsrsQueue } from "./fsrs-queue"
import { HeroSection } from "./hero-section"
import { HighYieldSection } from "./high-yield-section"
import { KnowledgeGraph } from "./knowledge-graph"
import { NotebookSection } from "./notebook-section"
import { StreakHeatmap } from "./streak-heatmap"
import { TodayPlan } from "./today-plan"
import { Topbar } from "./topbar"
import { buildDashboardModel } from "./data-adapter"
import type { SyncStatus } from "./types"

const ROUTES: Record<string, string> = {
  dashboard: "/",
  study: "/flashcards/review",
  mcq: "/qbank",
  library: "/library",
  notes: "/library",
  schedule: "/planner-v2",
  leaderboard: "/history",
  settings: "/settings",
  "start-study": "/flashcards/review",
  "mcq-block": "/exam/builder",
  "new-mcq": "/exam/builder",
  "new-note": "/library",
  "all-notes": "/library",
  "all-chapters": "/library",
  "all-topics": "/yield",
  "activity-history": "/history",
  optimize: "/flashcards/review",
  "topic-rcc": "/library",
  "topic-bph": "/library",
  "topic-bladder": "/library",
}

const ACTION_LABEL: Record<string, string> = {
  optimize: "صف مرور بر اساس داده های فعلی مرتب شد.",
  search: "جست وجو",
  "ai-tnm": "مسیر AI باز شد.",
  "ai-bcg": "مسیر AI باز شد.",
}

export function DashboardShell() {
  const router = useRouter()
  const dashboard = useDashboardData()
  const model = useMemo(() => buildDashboardModel(dashboard), [dashboard])
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [active, setActive] = useState("dashboard")
  const [online, setOnline] = useState(true)

  const syncStatus: SyncStatus = !online
    ? "offline"
    : dashboard.loading
      ? "syncing"
      : "synced"

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    const updateOnlineState = () => setOnline(navigator.onLine)

    updateOnlineState()
    window.addEventListener("online", updateOnlineState)
    window.addEventListener("offline", updateOnlineState)
    return () => {
      window.removeEventListener("online", updateOnlineState)
      window.removeEventListener("offline", updateOnlineState)
    }
  }, [])

  const navigate = useCallback(
    (id: string) => {
      setActive(id)
      const href = ROUTES[id]
      if (href) router.push(href)
    },
    [router],
  )

  const handleAction = useCallback(
    (id: string) => {
      const href = ROUTES[id]
      if (href) {
        router.push(href)
        return
      }

      const label = ACTION_LABEL[id]
      if (label) {
        toast.success(label)
        return
      }

      toast.message("این بخش هنوز مسیر مستقل ندارد.")
    },
    [router],
  )

  return (
    <div className="starship-dashboard-root min-h-screen bg-background text-foreground flex isolate" dir="rtl">
      <AppSidebar
        active={active}
        counts={model.sidebarCounts}
        chapters={model.sidebarChapters}
        onNavigate={navigate}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          onOpenCommand={() => setPaletteOpen(true)}
          syncStatus={syncStatus}
          onOpenHistory={() => handleAction("leaderboard")}
          onOpenSettings={() => handleAction("settings")}
        />

        <main className="flex-1 overflow-x-hidden">
          <div className="w-full max-w-none px-3 lg:px-4 2xl:px-5 py-4 space-y-3">
            <HeroSection
              stats={model.stats}
              onStartStudy={() => handleAction("start-study")}
              onStartMcq={() => handleAction("mcq-block")}
            />

            <section className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch">
              <div className="xl:col-span-6">
                <TodayPlan
                  blocks={model.plan}
                  onOpenPlanner={() => handleAction("schedule")}
                />
              </div>
              <div className="xl:col-span-6">
                <FsrsQueue
                  queue={model.fsrsQueue}
                  onStartStudy={() => handleAction("start-study")}
                  onOptimize={() => handleAction("optimize")}
                />
              </div>
            </section>

            <AnalyticsSection
              mcqByChapter={model.mcqByChapter}
              trend={model.trend}
              onOpenQbank={() => handleAction("mcq")}
            />

            <section className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch">
              <div className="xl:col-span-8">
                <CoverageSection
                  coverage={model.coverage}
                  onOpenAll={() => handleAction("all-chapters")}
                  onOpenChapter={() => handleAction("library")}
                />
              </div>
              <div className="xl:col-span-4">
                <DifficultyDonut
                  data={model.difficulty}
                  onOpenQbank={() => handleAction("mcq")}
                />
              </div>
            </section>

            <HighYieldSection
              topics={model.highYield}
              onOpenTopic={() => handleAction("all-topics")}
            />

            <section className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch">
              <div className="xl:col-span-5">
                <KnowledgeGraph nodes={model.graphNodes} edges={model.graphEdges} />
              </div>
              <div className="xl:col-span-4">
                <StreakHeatmap
                  data={model.heatmap}
                  streak={model.stats.streakDays}
                  longest={model.stats.streakDays}
                />
              </div>
              <div className="xl:col-span-3">
                <BoardCountdown
                  daysUntilBoard={model.stats.daysUntilBoard}
                  readinessPct={model.stats.boardReadinessPct}
                />
              </div>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-12 gap-3">
              <div className="xl:col-span-7">
                <NotebookSection
                  notes={model.notes}
                  onCreateNote={() => handleAction("new-note")}
                  onOpenAll={() => handleAction("all-notes")}
                  onOpenNote={(id) => router.push(`/notes/${encodeURIComponent(id)}`)}
                />
              </div>
              <div className="xl:col-span-5">
                <ActivityFeed
                  items={model.activity}
                  onOpenAll={() => handleAction("activity-history")}
                />
              </div>
            </section>

            <footer className="pt-2 pb-4 text-center text-[11px] text-muted-foreground">
              <span className="ltr">Urology OS</span> · Mission Control · v
              <span className="ltr tnum">1.0.0</span>
            </footer>
          </div>
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onAction={handleAction}
      />
    </div>
  )
}
