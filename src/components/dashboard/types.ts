export type SyncStatus = "synced" | "syncing" | "error" | "offline"

export type FsrsCardState = "new" | "learning" | "review" | "relearning"

export interface FsrsCard {
  id: string
  title: string
  chapterFa: string
  yieldScore: number
  dueIn: string
  state: FsrsCardState
  stability: number
  difficulty: number
}

export interface McqChapterStat {
  chapterFa: string
  chapterEn: string
  accuracy: number
  answered: number
  total: number
}

export interface ChapterCoverage {
  sectionName: string
  sectionFa: string
  cwwRef: string
  pct: number
  done: number
  total: number
  /** Sub-skills accuracy 0-100 for radar-style summary */
  subSkills: { name: string; pct: number }[]
}

export interface SidebarChapter {
  id: string
  fa: string
  en: string
  count?: number
  color: string
}

export interface SidebarCounts {
  due: number
  qbank: number
  notes: number
  planner: number
}

export interface ActivityItem {
  id: string
  type: "mcq" | "fsrs" | "note" | "sync" | "ai"
  text: string
  meta?: string
  timeAgo: string
  group: "today" | "yesterday" | "earlier"
}

export interface DashboardStats {
  cardsDueToday: number
  cardsDueDelta: number // % vs last week
  mcqThisWeek: number
  mcqWeekDelta: number
  overallAccuracy: number
  accuracyDelta: number
  streakDays: number
  boardReadinessPct: number
  daysUntilBoard: number | null
  focusLabel?: string
  /** sparkline data points for each KPI */
  spark: {
    cardsDue: number[]
    mcq: number[]
    accuracy: number[]
    readiness: number[]
  }
}

export interface PlanBlock {
  id: string
  startFa: string
  endFa: string
  title: string
  subtitle: string
  type: "fsrs" | "mcq" | "read" | "note" | "break"
  estMinutes: number
  done?: boolean
}

export interface HighYieldTopic {
  id: string
  title: string
  chapterFa: string
  yieldScore: number
  due: number
  mastered: number
  total: number
  accuracy: number
  cwwRef: string
}

export interface TrendPoint {
  /** Persian date label e.g. "۲۰ اسفند" */
  label: string
  accuracy: number
  cards: number
}

export interface DifficultyBucket {
  label: string
  value: number
  color: string
}

export interface GraphNode {
  id: string
  label: string
  group: "renal" | "bladder" | "prostate" | "testis" | "adrenal" | "general"
  size: number
}

export interface GraphEdge {
  source: string
  target: string
  weight: number
}

export interface NotebookItem {
  id: string
  title: string
  excerpt: string
  chapterFa: string
  updatedFa: string
  pinned?: boolean
}
