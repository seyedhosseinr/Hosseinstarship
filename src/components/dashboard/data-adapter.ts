"use client"

import type { useDashboardData } from "@/lib/dashboard/useDashboardData"
import type {
  ActivityItem,
  ChapterCoverage,
  DashboardStats,
  DifficultyBucket,
  FsrsCard,
  FsrsCardState,
  GraphEdge,
  GraphNode,
  HighYieldTopic,
  McqChapterStat,
  NotebookItem,
  PlanBlock,
  SidebarChapter,
  SidebarCounts,
  TrendPoint,
} from "./types"

type DashboardData = ReturnType<typeof useDashboardData>

const DAY_MS = 24 * 60 * 60 * 1000
const EMPTY_SPARK = [0, 0, 0, 0, 0, 0, 0]
const CHAPTER_COLORS = [
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-teal-500",
]

function asNumber(value: unknown, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function round(value: unknown) {
  return Math.round(asNumber(value))
}

function seriesFromLast(value: number, length = 7) {
  const end = Math.max(0, round(value))
  if (end === 0) return EMPTY_SPARK.slice(0, length)

  return Array.from({ length }, (_, i) => {
    const factor = 0.62 + i * (0.38 / Math.max(1, length - 1))
    return Math.max(0, Math.round(end * factor))
  })
}

function formatClock(value: string | null | undefined, fallbackHour: number) {
  const date = value ? new Date(value) : null
  const valid = date && !Number.isNaN(date.getTime())
  const hours = valid ? date.getHours() : fallbackHour
  const minutes = valid ? date.getMinutes() : 0
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

function addMinutes(clock: string, minutes: number) {
  const [h = "0", m = "0"] = clock.split(":")
  const total = asNumber(h) * 60 + asNumber(m) + Math.max(15, minutes)
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

function planType(taskType: string): PlanBlock["type"] {
  const lower = taskType.toLowerCase()
  if (lower.includes("flash") || lower.includes("srs") || lower.includes("review")) return "fsrs"
  if (lower.includes("question") || lower.includes("mcq") || lower.includes("exam")) return "mcq"
  if (lower.includes("note")) return "note"
  if (lower.includes("break")) return "break"
  return "read"
}

function activityType(type: string): ActivityItem["type"] {
  switch (type) {
    case "exam":
      return "mcq"
    case "flashcard":
      return "fsrs"
    case "note":
      return "note"
    case "planner":
      return "sync"
    default:
      return "ai"
  }
}

function activityGroup(timestamp: number): ActivityItem["group"] {
  if (!timestamp) return "earlier"

  const start = new Date()
  start.setHours(0, 0, 0, 0)
  if (timestamp >= start.getTime()) return "today"
  if (timestamp >= start.getTime() - DAY_MS) return "yesterday"
  return "earlier"
}

function relativeTime(timestamp: number, fallback: string) {
  if (!timestamp) return fallback

  const diffMinutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000))
  if (diffMinutes < 60) return `${diffMinutes} دقیقه پیش`

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} ساعت پیش`

  return `${Math.round(diffHours / 24)} روز پیش`
}

function graphGroup(label: string): GraphNode["group"] {
  const lower = label.toLowerCase()
  if (lower.includes("kidney") || lower.includes("renal") || lower.includes("کلیه")) return "renal"
  if (lower.includes("bladder") || lower.includes("مثانه")) return "bladder"
  if (lower.includes("prostate") || lower.includes("پروستات")) return "prostate"
  if (lower.includes("test") || lower.includes("بیضه")) return "testis"
  if (lower.includes("adrenal") || lower.includes("آدرنال")) return "adrenal"
  return "general"
}

function buildStats(data: DashboardData): DashboardStats {
  const server = data.serverStats
  const weekly = server.weeklyActivity ?? []
  const qbank = server.qbankStats
  const analytics = server.analyticsSnapshot
  const fsrs = data.fsrsStats
  const planner = data.plannerDetailedStats
  const mcqThisWeek = weekly.reduce((sum, point) => sum + asNumber(point.count), 0)
  const accuracy = asNumber(server.accuracy || qbank.accuracy || analytics?.overallAccuracy)
  const readiness = asNumber(data.readinessScore?.score ?? analytics?.predictedScore)
  const retention = asNumber(fsrs?.retentionRate)
  const fallbackReadiness =
    readiness > 0
      ? readiness
      : accuracy || retention
        ? Math.round(accuracy * 0.6 + retention * 0.4)
        : 0

  return {
    cardsDueToday: data.dueToday,
    cardsDueDelta: asNumber(fsrs?.overdue),
    mcqThisWeek: mcqThisWeek || qbank.totalAttempts || qbank.attemptedQuestions || 0,
    mcqWeekDelta: analytics?.studyTrend === "up" ? 1 : analytics?.studyTrend === "down" ? -1 : 0,
    overallAccuracy: clamp(round(accuracy)),
    accuracyDelta: analytics?.accuracyTrend === "up" ? 1 : analytics?.accuracyTrend === "down" ? -1 : 0,
    streakDays: data.streak || planner?.studyStreak || 0,
    boardReadinessPct: clamp(round(fallbackReadiness)),
    daysUntilBoard: planner?.daysToExam ?? analytics?.daysToExam ?? null,
    focusLabel:
      data.dashboardRecommendations[0]?.title ??
      data.weakSpots[0]?.domain ??
      analytics?.recommendedFocus[0],
    spark: {
      cardsDue: seriesFromLast(data.dueToday),
      mcq: weekly.length ? weekly.map((point) => round(point.count)).slice(-7) : seriesFromLast(mcqThisWeek),
      accuracy: weekly.length
        ? weekly.map((point) => clamp(round((asNumber(point.correct) / Math.max(1, asNumber(point.count))) * 100))).slice(-7)
        : seriesFromLast(accuracy),
      readiness: seriesFromLast(fallbackReadiness),
    },
  }
}

function buildPlan(data: DashboardData): PlanBlock[] {
  const tasks = data.serverStats.todayTaskObjects ?? []
  if (tasks.length) {
    return tasks.slice(0, 6).map((task, index) => {
      const start = formatClock(task.scheduledFor, 8 + index)
      const minutes = task.estimatedMinutes || 30
      return {
        id: task.id || `task-${index}`,
        startFa: start,
        endFa: addMinutes(start, minutes),
        title: task.title || "Study task",
        subtitle: `${minutes} دقیقه`,
        type: planType(task.taskType),
        estMinutes: minutes,
        done: task.status === "completed",
      }
    })
  }

  const upcoming = data.plannerDetailedStats?.upcomingTasks ?? []
  if (upcoming.length) {
    return upcoming.slice(0, 5).map((task, index) => {
      const start = formatClock(task.scheduledFor, 9 + index)
      return {
        id: task.id || `upcoming-${index}`,
        startFa: start,
        endFa: addMinutes(start, 45),
        title: task.title || "Study block",
        subtitle: "از برنامه مطالعه",
        type: "read",
        estMinutes: 45,
      }
    })
  }

  return []
}

function buildFsrsQueue(data: DashboardData): FsrsCard[] {
  const weakAreas = data.serverStats.detailedWeakAreas ?? []
  const recommendations = data.dashboardRecommendations ?? []
  const source = weakAreas.length ? weakAreas : recommendations

  return source.slice(0, 6).map((item, index) => {
    const label = "label" in item ? item.label : item.title
    const accuracy = "accuracy" in item ? asNumber(item.accuracy) : 0
    const state: FsrsCardState = index === 0 ? "review" : accuracy > 0 && accuracy < 55 ? "relearning" : "learning"

    return {
      id: item.id || `fsrs-${index}`,
      title: label || "Focused review",
      chapterFa: "key" in item ? item.key : item.subtitle,
      yieldScore: accuracy ? clamp(10 - accuracy / 20, 5.5, 9.8) : 0,
      dueIn: index === 0 ? "اکنون" : `${index * 15} دقیقه`,
      state,
      stability: accuracy ? clamp(accuracy / 8, 1, 24) : 0,
      difficulty: accuracy ? clamp((100 - accuracy) / 100, 0.1, 0.9) : 0,
    }
  })
}

function buildMcqByChapter(data: DashboardData): McqChapterStat[] {
  const chapters = data.serverStats.chapterPerformance ?? []

  return chapters.slice(0, 8).map((chapter) => ({
    chapterFa: chapter.chapterTitle ?? chapter.chapterId,
    chapterEn: chapter.chapterId,
    accuracy: clamp(round(chapter.accuracy)),
    answered: round(chapter.total),
    total: Math.max(1, round(chapter.total)),
  }))
}

function buildTrend(data: DashboardData): TrendPoint[] {
  const weekly = data.serverStats.weeklyActivity ?? []
  if (weekly.length) {
    return weekly.slice(-15).map((point) => ({
      label: point.day,
      accuracy: clamp(round((asNumber(point.correct) / Math.max(1, asNumber(point.count))) * 100)),
      cards: round(point.count),
    }))
  }

  const monthly = data.monthlyActivity ?? []
  return monthly.slice(-15).map((point) => ({
    label: point.date.slice(5),
    accuracy: clamp(round(data.serverStats.accuracy)),
    cards: round(point.cardsReviewed + point.questionsAnswered),
  }))
}

function buildCoverage(data: DashboardData): ChapterCoverage[] {
  const domains = data.serverStats.domainMastery ?? []
  if (domains.length) {
    return domains.slice(0, 6).map((domain) => ({
      sectionName: domain.domain,
      sectionFa: domain.domain,
      cwwRef: "Local-first mastery",
      pct: clamp(round(domain.masteryScore)),
      done: round(domain.volume),
      total: Math.max(1, round(domain.volume)),
      subSkills: [
        { name: "QBank", pct: clamp(round(domain.questionAccuracy ?? domain.masteryScore)) },
        { name: "SRS", pct: clamp(round(domain.retentionScore ?? domain.masteryScore)) },
        { name: "Coverage", pct: clamp(round(domain.completionScore ?? domain.masteryScore)) },
        { name: "Recency", pct: clamp(round(domain.recencyScore ?? domain.masteryScore)) },
      ],
    }))
  }

  const chapters = data.serverStats.chapterPerformance ?? []
  return chapters.slice(0, 6).map((chapter) => ({
    sectionName: chapter.chapterId,
    sectionFa: chapter.chapterTitle ?? chapter.chapterId,
    cwwRef: "Chapter analytics",
    pct: clamp(round(chapter.accuracy)),
    done: round(chapter.correct),
    total: Math.max(1, round(chapter.total)),
    subSkills: [
      { name: "Accuracy", pct: clamp(round(chapter.accuracy)) },
      { name: "Volume", pct: clamp(round((chapter.total / 50) * 100)) },
      { name: "Correct", pct: clamp(round((chapter.correct / Math.max(1, chapter.total)) * 100)) },
    ],
  }))
}

function buildHighYield(data: DashboardData): HighYieldTopic[] {
  const recs = data.dashboardRecommendations ?? []
  if (recs.length) {
    return recs.slice(0, 8).map((rec, index) => ({
      id: rec.id || `rec-${index}`,
      title: rec.title,
      chapterFa: rec.subtitle,
      yieldScore: rec.priority > 0 ? clamp(6 + rec.priority, 1, 10) : 0,
      due: data.dueToday,
      mastered: Math.max(0, rec.mcqCount - Math.round(rec.mcqCount * ((100 - rec.accuracy) / 100))),
      total: Math.max(1, rec.mcqCount),
      accuracy: clamp(round(rec.accuracy)),
      cwwRef: rec.reason || "Recommended focus",
    }))
  }

  const weakAreas = data.serverStats.detailedWeakAreas ?? []
  return weakAreas.slice(0, 8).map((area, index) => ({
    id: area.id || `weak-${index}`,
    title: area.label,
    chapterFa: area.key,
    yieldScore: area.accuracy ? clamp(9.5 - area.accuracy / 25, 1, 10) : 0,
    due: data.dueToday,
    mastered: Math.max(0, Math.round(area.questionsAttempted * (area.accuracy / 100))),
    total: Math.max(1, area.questionsAttempted),
    accuracy: clamp(round(area.accuracy)),
    cwwRef: area.suggestedAction || "Weak-area review",
  }))
}

function buildDifficulty(data: DashboardData): DifficultyBucket[] {
  const stats = data.serverStats.strengthsAndWeaknesses
  const strengths = stats.strengths.reduce((sum, item) => sum + asNumber(item.questionsAnswered), 0)
  const weaknesses = stats.weaknesses.reduce((sum, item) => sum + asNumber(item.questionsAnswered), 0)
  if (!strengths && !weaknesses) return []

  return [
    { label: "قوی", value: strengths, color: "hsl(var(--chart-2))" },
    { label: "نیازمند مرور", value: weaknesses, color: "hsl(var(--chart-3))" },
  ].filter((item) => item.value > 0)
}

function buildGraph(data: DashboardData): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const labels = [
    ...(data.serverStats.domainMastery ?? []).map((domain) => ({
      id: domain.domain,
      label: domain.domain,
      size: clamp(14 + domain.masteryScore / 6, 14, 30),
    })),
    ...(data.weakSpots ?? []).map((spot) => ({
      id: spot.domain,
      label: spot.domain,
      size: clamp(28 - spot.accuracy / 7, 14, 28),
    })),
  ]
  const unique = Array.from(new Map(labels.map((item) => [item.id, item])).values()).slice(0, 12)
  const nodes: GraphNode[] = unique.map((item) => ({
    id: item.id,
    label: item.label,
    group: graphGroup(item.label),
    size: item.size,
  }))
  const edges: GraphEdge[] = nodes.slice(1).map((node, index) => ({
    source: nodes[index].id,
    target: node.id,
    weight: 1 + (index % 3),
  }))

  return { nodes, edges }
}

function buildHeatmap(data: DashboardData): number[][] {
  const monthly = data.monthlyActivity ?? []
  const byDay = new Map(
    monthly.map((point) => [
      point.date,
      asNumber(point.questionsAnswered) + asNumber(point.cardsReviewed) + Math.round(asNumber(point.minutesStudied) / 20),
    ]),
  )
  const today = new Date()
  const days = Array.from({ length: 84 }, (_, index) => {
    const date = new Date(today.getTime() - (83 - index) * DAY_MS)
    const key = date.toISOString().slice(0, 10)
    const value = byDay.get(key) ?? 0
    if (value <= 0) return 0
    if (value < 5) return 1
    if (value < 15) return 2
    if (value < 30) return 3
    return 4
  })

  return Array.from({ length: 12 }, (_, week) => days.slice(week * 7, week * 7 + 7))
}

function buildActivity(data: DashboardData): ActivityItem[] {
  const items = data.activityFeed ?? []
  if (items.length) {
    return items.slice(0, 12).map((item) => ({
      id: item.id,
      type: activityType(item.type),
      text: item.text,
      meta: item.time,
      timeAgo: relativeTime(item.timestamp, item.time),
      group: activityGroup(item.timestamp),
    }))
  }

  const localItems: ActivityItem[] = []
  if (data.dueToday > 0) {
    localItems.push({
      id: "local-fsrs",
      type: "fsrs",
      text: `${data.dueToday} کارت برای مرور امروز آماده است`,
      meta: "OPFS / snapshot",
      timeAgo: "اکنون",
      group: "today",
    })
  }
  if (data.serverStats.qbankStats.totalAttempts > 0) {
    localItems.push({
      id: "local-qbank",
      type: "mcq",
      text: `${data.serverStats.qbankStats.totalAttempts} پاسخ MCQ در داشبورد ثبت شده`,
      meta: `${round(data.serverStats.qbankStats.accuracy)}% accuracy`,
      timeAgo: "امروز",
      group: "today",
    })
  }

  return localItems
}

function buildNotes(data: DashboardData): NotebookItem[] {
  const notes = data.studyNotes ?? []
  return notes.slice(0, 5).map((note, index) => ({
    id: note.id,
    title: note.title,
    excerpt: note.preview || note.detail,
    chapterFa: note.category || "Note",
    updatedFa: note.createdAt,
    pinned: index < 2,
  }))
}

function buildSidebarChapters(coverage: ChapterCoverage[]): SidebarChapter[] {
  return coverage.slice(0, 6).map((chapter, index) => ({
    id: chapter.sectionName,
    fa: chapter.sectionFa,
    en: chapter.cwwRef,
    count: chapter.done,
    color: CHAPTER_COLORS[index % CHAPTER_COLORS.length],
  }))
}

function buildSidebarCounts(data: DashboardData): SidebarCounts {
  return {
    due: data.dueToday,
    qbank: data.counts.questions,
    notes: data.counts.notebooks,
    planner: data.planner.todayTasks,
  }
}

export function buildDashboardModel(data: DashboardData) {
  const coverage = buildCoverage(data)
  const graph = buildGraph(data)

  return {
    stats: buildStats(data),
    plan: buildPlan(data),
    fsrsQueue: buildFsrsQueue(data),
    mcqByChapter: buildMcqByChapter(data),
    trend: buildTrend(data),
    coverage,
    highYield: buildHighYield(data),
    difficulty: buildDifficulty(data),
    graphNodes: graph.nodes,
    graphEdges: graph.edges,
    heatmap: buildHeatmap(data),
    activity: buildActivity(data),
    notes: buildNotes(data),
    sidebarCounts: buildSidebarCounts(data),
    sidebarChapters: buildSidebarChapters(coverage),
  }
}
