"use client";

/**
 * useDashboardData — adapter hook that bridges real project data into
 * the shapes HosseinStarshipDashboard.tsx already consumes.
 *
 * The dashboard file is NEVER modified.  All adaptation happens here.
 *
 * Data sources wired:
 *  - Zustand stores: useGamificationStore (xp/level/streak)
 *  - Shell context counts from the supported server runtime
 *  - Server API /api/dashboard/stats → KPIs, chapter perf, weekly activity, exams, planner slice
 */

import { useEffect, useMemo, useState } from "react";
import { useGamificationStore } from "@/store/useAppStore";
import { SUPPORTED_RUNTIME_CAPABILITIES, type RuntimeCapabilities } from "@/lib/runtime/capabilities";
import { getDashboardStats } from "@/hooks/useDb";
import { isLocalFirstEnabled } from "@/lib/local-first/flag";
import {
  captureDashboardSnapshot,
  loadDashboardSnapshot,
} from "@/lib/local-first/snapshot";

/* ------------------------------------------------------------------ */
/*  Adapter-local types                                                */
/* ------------------------------------------------------------------ */

type DashboardCounts = {
  questions: number;
  flashcards: number;
  notebooks: number;
  exams: number;
  dueFlashcards: number;
};

type AppShellContextResponse = {
  stats?: Partial<DashboardCounts> & {
    avgScore?: number;
  };
  capabilities?: Partial<RuntimeCapabilities>;
};

type ChapterPerf = {
  chapterId: string;
  chapterTitle: string | null;
  total: number;
  correct: number;
  accuracy: number;
};

type WeeklyActivityPoint = {
  day: string;
  count: number;
  correct: number;
};

type MonthlyActivityPoint = {
  date: string;
  questionsAnswered: number;
  cardsReviewed: number;
  minutesStudied: number;
};

type RecentExam = {
  id: string;
  title: string | null;
  mode: string | null;
  status: string | null;
  totalQuestions: number | null;
  totalCorrect: number | null;
  totalIncorrect: number | null;
  totalOmitted: number | null;
  scorePercent: number | null;
  completedAt: number | null;
  elapsedSeconds: number | null;
};

type PlannerAgg = {
  available: boolean;
  reason?: string;
  weekTaskCount: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  todayTasks: number;
  completionRate: number;
};

type PlannerTaskObj = {
  id: string;
  title: string;
  taskType: string;
  status: string;
  estimatedMinutes: number;
  priority: number;
  scheduledFor: string | null;
};

type ActivePlanInfo = {
  id: string;
  title: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  totalTasks: number;
  completedTasks: number;
  progressPercent: number;
};

type FlashcardAgg = {
  total: number;
  dueToday: number;
  mastered: number;
};

type FsrsStatsByChapter = {
  chapterId: string;
  totalCards: number;
  dueCards: number;
  reviewedCards: number;
  avgRetention: number | null;
  avgStability: number | null;
  lastReviewedAt: string | null;
};

type ReaderStatsByChapter = {
  chapterId: string;
  readPercent: number;
  lastReadAt: string | null;
};

type QBankAgg = {
  totalQuestions: number;
  attemptedQuestions: number;
  correctAnswers: number;
  totalAttempts: number;
  testCount: number;
  accuracy: number;
  usage: number;
};

type ReadinessScore = {
  score: number;
  level: "not_ready" | "needs_work" | "developing" | "proficient" | "ready";
  factors: {
    coverage: number;
    accuracy: number;
    retention: number;
    consistency: number;
    weakAreas: number;
  };
  trend: "improving" | "stable" | "declining";
};

type DetailedWeakArea = {
  id: string;
  type: "subject" | "chapter" | "concept";
  key: string;
  label: string;
  accuracy: number;
  questionsAttempted: number;
  flashcardRetention: number;
  masteryScore: number;
  trend: "improving" | "stable" | "declining";
  suggestedAction: string;
  color: string;
};

type DashboardRecommendation = {
  id: string;
  title: string;
  subtitle: string;
  accuracy: number;
  duration: string;
  mcqCount: number;
  reason: string;
  alert?: string;
  type: "weak_area" | "review" | "new_content" | "practice";
  href: string;
  priority: number;
};

type TrapQuestion = {
  id: string;
  question: string;
  trapType: "distractor" | "partial-truth" | "absolute-language" | "reversal" | "look-alike";
  domain: string;
  difficulty: "Easy" | "Medium" | "Hard";
  yourAnswer: string;
  correctAnswer: string;
  explanation: string;
  isHard: boolean;
  resolved: boolean;
  attemptedAt: number;
};

type StudyNote = {
  id: string;
  title: string;
  preview: string;
  detail: string;
  category: string;
  linkedMCQs: number;
  linkedFlashcards: number;
  concepts: string[];
  createdAt: string;
};

type WeakSpot = {
  domain: string;
  accuracy: number;
  avgAccuracy: number;
  questionsAnswered: number;
  trend: "improving" | "declining" | "stable";
};

type DashboardActivityItem = {
  id: string;
  text: string;
  time: string;
  timestamp: number;
  tone: "blue" | "emerald" | "rose" | "amber" | "violet";
  type: "exam" | "flashcard" | "note" | "planner" | "achievement";
};

type ActivityFeedRow = {
  id: string;
  type: "card_review" | "mcq_block" | "chapter_read";
  entityLabel: string;
  detail: string;
  delta: string;
  timestamp: string;
};

type FsrsDetailedStats = {
  dueToday: number;
  dueThisWeek: number;
  reviewedToday: number;
  retentionRate: number;
  leechCount: number;
  avgStability: number;
  avgDifficulty: number;
  matureCards: number;
  totalCards: number;
  overdue: number;
  learningCards: number;
  newCards: number;
};

type PlannerDetailedStats = {
  available: boolean;
  reason?: string;
  todayTasks: number;
  completedToday: number;
  overdueTasks: number;
  upcomingTasks: Array<{ id: string; title: string; scheduledFor: string }>;
  dailyGoalMinutes: number;
  dailyGoalProgress: number;
  examDate: string | null;
  daysToExam: number | null;
  studyStreak: number;
};

type DashboardSnapshot = {
  readinessScore: ReadinessScore;
  weakAreas: DetailedWeakArea[];
  recommendations: DashboardRecommendation[];
  trapQuestions: TrapQuestion[];
  recentNotes: StudyNote[];
  activityFeed: ActivityFeedRow[];
  fsrsStats: FsrsDetailedStats;
  plannerStats: PlannerDetailedStats;
  monthlyActivity: MonthlyActivityPoint[];
};

type DashboardServerStats = {
  accuracy: number;
  weakAreaCount: number;
  /** Chapter-level accuracy from real DB */
  chapterPerformance: ChapterPerf[];
  /** 7-day activity from real DB */
  weeklyActivity: WeeklyActivityPoint[];
  /** Recent completed exams from real DB */
  recentExams: RecentExam[];
  /** Planner aggregate stats from real DB */
  plannerStats: PlannerAgg;
  /** Study seconds today from real DB */
  studyTimeToday: number;
  /** Flashcard aggregate from real DB */
  flashcardStats: FlashcardAgg;
  fsrsStatsByChapter: FsrsStatsByChapter[];
  readerStatsByChapter: ReaderStatsByChapter[];
  /** Today's actual task objects from planner */
  todayTaskObjects: PlannerTaskObj[];
  /** Overdue task objects from planner */
  overdueTaskObjects: PlannerTaskObj[];
  /** Active plan info */
  activePlanInfo: ActivePlanInfo | null;
  /** Full qbank stats from real DB */
  qbankStats: QBankAgg;
  /** Domain mastery analytics from real DB */
  domainMastery: DomainMasteryObj[];
  /** Optional analytics snapshot */
  analyticsSnapshot: {
    overallAccuracy: number;
    questionsAnswered: number;
    questionsRemaining: number;
    totalStudyMinutes: number;
    avgTimePerQuestion: number;
    cardsReviewed: number;
    cardsDueToday: number;
    retentionRate: number;
    chaptersCompleted: number;
    chaptersTotal: number;
    segmentsMastered: number;
    segmentsTotal: number;
    accuracyTrend: "up" | "down" | "stable";
    studyTrend: "up" | "down" | "stable";
    daysToExam: number | null;
    predictedScore: number | null;
    readinessLevel: "not_ready" | "needs_work" | "on_track" | "ready";
    topStrengths: string[];
    topWeaknesses: string[];
    recommendedFocus: string[];
  } | null;
  strengthsAndWeaknesses: {
    strengths: Array<{ dimension: string; key: string; accuracy: number; questionsAnswered: number }>;
    weaknesses: Array<{ dimension: string; key: string; accuracy: number; questionsAnswered: number; recommendedAction?: string }>;
  };
  readinessScore: ReadinessScore | null;
  detailedWeakAreas: DetailedWeakArea[];
  dashboardRecommendations: DashboardRecommendation[];
  trapQuestions: TrapQuestion[];
  studyNotes: StudyNote[];
  weakSpots: WeakSpot[];
  activityFeed: ActivityFeedRow[];
  fsrsStats: FsrsDetailedStats | null;
  plannerDetailedStats: PlannerDetailedStats | null;
  monthlyActivity: MonthlyActivityPoint[];
  dashboardSnapshot: DashboardSnapshot | null;
};

interface DomainMasteryObj {
  domain: string;
  masteryScore: number;
  confidence: number;
  questionAccuracy?: number;
  retentionScore?: number;
  completionScore?: number;
  recencyScore?: number;
  volume: number;
  sourceCoverage: { qbank: boolean; srs: boolean; notes: boolean; planner: boolean };
}

type PlannerTodayInfo = {
  hasActivePlan: boolean;
  planTitle: string | null;
  todayTasks: number;
  completedToday: number;
  overdueTasks: number;
  /** When false, planner aggregates must not be interpreted as real zeros. */
  available: boolean;
  reason?: string;
};

type FeatureLink = {
  key: string;
  title: string;
  subtitle: string;
  href: string;
  accent: string;
  count?: number;
};

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */

const EMPTY_SERVER_STATS: DashboardServerStats = {
  accuracy: 0,
  weakAreaCount: 0,
  chapterPerformance: [],
  weeklyActivity: [],
  recentExams: [],
  plannerStats: {
    available: false,
    weekTaskCount: 0,
    totalTasks: 0,
    completedTasks: 0,
    overdueTasks: 0,
    todayTasks: 0,
    completionRate: 0,
  },
  studyTimeToday: 0,
  flashcardStats: { total: 0, dueToday: 0, mastered: 0 },
  fsrsStatsByChapter: [],
  readerStatsByChapter: [],
  qbankStats: {
    totalQuestions: 0,
    attemptedQuestions: 0,
    correctAnswers: 0,
    totalAttempts: 0,
    testCount: 0,
    accuracy: 0,
    usage: 0,
  },
  todayTaskObjects: [],
  overdueTaskObjects: [],
  activePlanInfo: null,
  domainMastery: [],
  analyticsSnapshot: null,
  strengthsAndWeaknesses: { strengths: [], weaknesses: [] },
  readinessScore: null,
  detailedWeakAreas: [],
  dashboardRecommendations: [],
  trapQuestions: [],
  studyNotes: [],
  weakSpots: [],
  activityFeed: [],
  fsrsStats: null,
  plannerDetailedStats: null,
  monthlyActivity: [],
  dashboardSnapshot: null,
};

const EMPTY_PLANNER: PlannerTodayInfo = {
  hasActivePlan: false,
  planTitle: null,
  todayTasks: 0,
  completedToday: 0,
  overdueTasks: 0,
  available: false,
};

const EMPTY_COUNTS: DashboardCounts = {
  questions: 0,
  flashcards: 0,
  notebooks: 0,
  exams: 0,
  dueFlashcards: 0,
};

/* ------------------------------------------------------------------ */
/*  Payload normalizers                                                */
/* ------------------------------------------------------------------ */

function normalizePlannerPayload(payload: any): PlannerTodayInfo {
  const body = payload?.data ?? payload?.result ?? payload;
  if (!body || typeof body !== "object") return EMPTY_PLANNER;

  const tasks = Array.isArray(body.tasks) ? body.tasks : [];
  const overdueTasks = Array.isArray(body.overdueTasks)
    ? body.overdueTasks
    : [];
  const completedToday = tasks.filter(
    (t: any) => t?.status === "completed",
  ).length;

  return {
    hasActivePlan: !!body.plan,
    planTitle: body?.plan?.title ?? null,
    todayTasks: tasks.length,
    completedToday,
    overdueTasks: overdueTasks.length,
    available: body.available === true && !!body.plan,
    reason: typeof body.reason === "string" ? body.reason : undefined,
  };
}

function normalizeStatsPayload(json: any): DashboardServerStats {
  if (!json || typeof json !== "object") return EMPTY_SERVER_STATS;

  return {
    accuracy: Number(json.accuracy) || 0,
    weakAreaCount: Number(json.weakAreaCount) || 0,

    chapterPerformance: Array.isArray(json.chapterPerformance)
      ? json.chapterPerformance
      : [],

    weeklyActivity: Array.isArray(json.weeklyActivity)
      ? json.weeklyActivity
      : [],

    recentExams: Array.isArray(json.recentExams) ? json.recentExams : [],

    plannerStats:
      json.planner && typeof json.planner === "object"
        ? {
            available: json.planner.available === true,
            reason: typeof json.planner.reason === "string" ? json.planner.reason : undefined,
            weekTaskCount: Number(json.planner.weekTaskCount) || 0,
            totalTasks: Number(json.planner.totalTasks) || 0,
            completedTasks: Number(json.planner.completedTasks) || 0,
            overdueTasks: Number(json.planner.overdueTasks) || 0,
            todayTasks: Number(json.planner.todayTasks) || 0,
            completionRate: Number(json.planner.completionRate) || 0,
          }
        : EMPTY_SERVER_STATS.plannerStats,

    studyTimeToday: Number(json.studyTimeToday) || 0,

    flashcardStats:
      json.flashcards && typeof json.flashcards === "object"
        ? {
            total: Number(json.flashcards.total) || 0,
            dueToday: Number(json.flashcards.dueToday) || 0,
            mastered: Number(json.flashcards.mastered) || 0,
          }
        : EMPTY_SERVER_STATS.flashcardStats,

    fsrsStatsByChapter: Array.isArray(json.fsrsStatsByChapter)
      ? json.fsrsStatsByChapter.map((item: any) => ({
          chapterId: String(item.chapterId ?? ""),
          totalCards: Number(item.totalCards) || 0,
          dueCards: Number(item.dueCards) || 0,
          reviewedCards: Number(item.reviewedCards) || 0,
          avgRetention: item.avgRetention == null ? null : Math.min(100, Math.max(0, Number(item.avgRetention))),
          avgStability: item.avgStability == null ? null : Math.max(0, Number(item.avgStability)),
          lastReviewedAt: item.lastReviewedAt == null ? null : String(item.lastReviewedAt),
        }))
      : [],

    readerStatsByChapter: Array.isArray(json.readerStatsByChapter)
      ? json.readerStatsByChapter.map((item: any) => ({
          chapterId: String(item.chapterId ?? ""),
          readPercent: Math.min(100, Math.max(0, Number(item.readPercent) || 0)),
          lastReadAt: item.lastReadAt == null ? null : String(item.lastReadAt),
        }))
      : [],

    qbankStats:
      json.qbank && typeof json.qbank === "object"
        ? {
            totalQuestions: Number(json.qbank.totalQuestions) || 0,
            attemptedQuestions: Number(json.qbank.attemptedQuestions) || 0,
            correctAnswers: Number(json.qbank.correctAnswers) || 0,
            totalAttempts: Number(json.qbank.totalAttempts) || 0,
            testCount: Number(json.qbank.testCount) || 0,
            accuracy: Number(json.qbank.accuracy) || 0,
            usage: Number(json.qbank.usage) || 0,
          }
        : EMPTY_SERVER_STATS.qbankStats,

    todayTaskObjects: Array.isArray(json.todayTasks)
      ? json.todayTasks.map((t: any) => ({
          id: String(t.id ?? ""),
          title: String(t.title ?? ""),
          taskType: String(t.taskType ?? ""),
          status: String(t.status ?? "pending"),
          estimatedMinutes: Number(t.estimatedMinutes) || 0,
          priority: Number(t.priority) || 0,
          scheduledFor: t.scheduledFor ?? null,
        }))
      : [],

    overdueTaskObjects: Array.isArray(json.overdueTasks)
      ? json.overdueTasks.map((t: any) => ({
          id: String(t.id ?? ""),
          title: String(t.title ?? ""),
          taskType: String(t.taskType ?? ""),
          status: String(t.status ?? "overdue"),
          estimatedMinutes: Number(t.estimatedMinutes) || 0,
          priority: Number(t.priority) || 0,
          scheduledFor: t.scheduledFor ?? null,
        }))
      : [],

    activePlanInfo:
      json.activePlan && typeof json.activePlan === "object"
        ? {
            id: String(json.activePlan.id ?? ""),
            title: json.activePlan.title ?? null,
            status: String(json.activePlan.status ?? ""),
            startDate: json.activePlan.startDate ?? null,
            endDate: json.activePlan.endDate ?? null,
            totalTasks: Number(json.activePlan.totalTasks) || 0,
            completedTasks: Number(json.activePlan.completedTasks) || 0,
            progressPercent: Number(json.activePlan.progressPercent) || 0,
          }
        : null,

    domainMastery: Array.isArray(json.domainMastery?.domainMastery)
      ? json.domainMastery.domainMastery.map((d: any) => ({
          domain: String(d.domain ?? ""),
          masteryScore: Number(d.masteryScore) || 0,
          confidence: Number(d.confidence) || 0,
          questionAccuracy: d.questionAccuracy != null ? Number(d.questionAccuracy) : undefined,
          retentionScore: d.retentionScore != null ? Number(d.retentionScore) : undefined,
          completionScore: d.completionScore != null ? Number(d.completionScore) : undefined,
          recencyScore: d.recencyScore != null ? Number(d.recencyScore) : undefined,
          volume: Number(d.volume) || 0,
          sourceCoverage: d.sourceCoverage ?? { qbank: false, srs: false, notes: false, planner: false },
        }))
      : [],

    analyticsSnapshot:
      json.analyticsSnapshot && typeof json.analyticsSnapshot === "object"
        ? {
            overallAccuracy: Number(json.analyticsSnapshot.overallAccuracy) || 0,
            questionsAnswered: Number(json.analyticsSnapshot.questionsAnswered) || 0,
            questionsRemaining: Number(json.analyticsSnapshot.questionsRemaining) || 0,
            totalStudyMinutes: Number(json.analyticsSnapshot.totalStudyMinutes) || 0,
            avgTimePerQuestion: Number(json.analyticsSnapshot.avgTimePerQuestion) || 0,
            cardsReviewed: Number(json.analyticsSnapshot.cardsReviewed) || 0,
            cardsDueToday: Number(json.analyticsSnapshot.cardsDueToday) || 0,
            retentionRate: Number(json.analyticsSnapshot.retentionRate) || 0,
            chaptersCompleted: Number(json.analyticsSnapshot.chaptersCompleted) || 0,
            chaptersTotal: Number(json.analyticsSnapshot.chaptersTotal) || 0,
            segmentsMastered: Number(json.analyticsSnapshot.segmentsMastered) || 0,
            segmentsTotal: Number(json.analyticsSnapshot.segmentsTotal) || 0,
            accuracyTrend: json.analyticsSnapshot.accuracyTrend ?? "stable",
            studyTrend: json.analyticsSnapshot.studyTrend ?? "stable",
            daysToExam: json.analyticsSnapshot.daysToExam != null ? Number(json.analyticsSnapshot.daysToExam) : null,
            predictedScore: json.analyticsSnapshot.predictedScore != null ? Number(json.analyticsSnapshot.predictedScore) : null,
            readinessLevel: json.analyticsSnapshot.readinessLevel ?? "not_ready",
            topStrengths: Array.isArray(json.analyticsSnapshot.topStrengths) ? json.analyticsSnapshot.topStrengths.map(String) : [],
            topWeaknesses: Array.isArray(json.analyticsSnapshot.topWeaknesses) ? json.analyticsSnapshot.topWeaknesses.map(String) : [],
            recommendedFocus: Array.isArray(json.analyticsSnapshot.recommendedFocus) ? json.analyticsSnapshot.recommendedFocus.map(String) : [],
          }
        : null,

    strengthsAndWeaknesses:
      json.strengthsAndWeaknesses && typeof json.strengthsAndWeaknesses === "object"
        ? {
            strengths: Array.isArray(json.strengthsAndWeaknesses.strengths)
              ? json.strengthsAndWeaknesses.strengths.map((item: any) => ({
                  dimension: String(item.dimension ?? ""),
                  key: String(item.key ?? ""),
                  accuracy: Number(item.accuracy) || 0,
                  questionsAnswered: Number(item.questionsAnswered) || 0,
                }))
              : [],
            weaknesses: Array.isArray(json.strengthsAndWeaknesses.weaknesses)
              ? json.strengthsAndWeaknesses.weaknesses.map((item: any) => ({
                  dimension: String(item.dimension ?? ""),
                  key: String(item.key ?? ""),
                  accuracy: Number(item.accuracy) || 0,
                  questionsAnswered: Number(item.questionsAnswered) || 0,
                  recommendedAction: item.recommendedAction != null ? String(item.recommendedAction) : undefined,
                }))
              : [],
          }
        : EMPTY_SERVER_STATS.strengthsAndWeaknesses,

    readinessScore:
      json.readinessScore && typeof json.readinessScore === "object"
        ? {
            score: Number(json.readinessScore.score) || 0,
            level: json.readinessScore.level ?? "not_ready",
            factors: {
              coverage: Number(json.readinessScore.factors?.coverage) || 0,
              accuracy: Number(json.readinessScore.factors?.accuracy) || 0,
              retention: Number(json.readinessScore.factors?.retention) || 0,
              consistency: Number(json.readinessScore.factors?.consistency) || 0,
              weakAreas: Number(json.readinessScore.factors?.weakAreas) || 0,
            },
            trend: json.readinessScore.trend ?? "stable",
          }
        : null,

    detailedWeakAreas: Array.isArray(json.detailedWeakAreas)
      ? json.detailedWeakAreas.map((item: any) => ({
          id: String(item.id ?? ""),
          type: item.type ?? "chapter",
          key: String(item.key ?? ""),
          label: String(item.label ?? ""),
          accuracy: Number(item.accuracy) || 0,
          questionsAttempted: Number(item.questionsAttempted) || 0,
          flashcardRetention: Number(item.flashcardRetention) || 0,
          masteryScore: Number(item.masteryScore) || 0,
          trend: item.trend ?? "stable",
          suggestedAction: String(item.suggestedAction ?? ""),
          color: String(item.color ?? "var(--blue)"),
        }))
      : [],

    dashboardRecommendations: Array.isArray(json.dashboardRecommendations)
      ? json.dashboardRecommendations.map((item: any) => ({
          id: String(item.id ?? ""),
          title: String(item.title ?? ""),
          subtitle: String(item.subtitle ?? ""),
          accuracy: Number(item.accuracy) || 0,
          duration: String(item.duration ?? ""),
          mcqCount: Number(item.mcqCount) || 0,
          reason: String(item.reason ?? ""),
          alert: item.alert != null ? String(item.alert) : undefined,
          type: item.type ?? "practice",
          href: String(item.href ?? "/history"),
          priority: Number(item.priority) || 0,
        }))
      : [],

    trapQuestions: Array.isArray(json.trapQuestions)
      ? json.trapQuestions.map((item: any) => ({
          id: String(item.id ?? ""),
          question: String(item.question ?? ""),
          trapType: item.trapType ?? "distractor",
          domain: String(item.domain ?? ""),
          difficulty: item.difficulty ?? "Medium",
          yourAnswer: String(item.yourAnswer ?? ""),
          correctAnswer: String(item.correctAnswer ?? ""),
          explanation: String(item.explanation ?? ""),
          isHard: !!item.isHard,
          resolved: !!item.resolved,
          attemptedAt: Number(item.attemptedAt) || 0,
        }))
      : [],

    studyNotes: Array.isArray(json.studyNotes)
      ? json.studyNotes.map((item: any) => ({
          id: String(item.id ?? ""),
          title: String(item.title ?? ""),
          preview: String(item.preview ?? ""),
          detail: String(item.detail ?? ""),
          category: String(item.category ?? ""),
          linkedMCQs: Number(item.linkedMCQs) || 0,
          linkedFlashcards: Number(item.linkedFlashcards) || 0,
          concepts: Array.isArray(item.concepts) ? item.concepts.map(String) : [],
          createdAt: String(item.createdAt ?? ""),
        }))
      : [],

    weakSpots: Array.isArray(json.weakSpots)
      ? json.weakSpots.map((item: any) => ({
          domain: String(item.domain ?? ""),
          accuracy: Number(item.accuracy) || 0,
          avgAccuracy: Number(item.avgAccuracy) || 0,
          questionsAnswered: Number(item.questionsAnswered) || 0,
          trend: item.trend ?? "stable",
        }))
      : [],

    activityFeed: Array.isArray(json.activityFeed)
      ? json.activityFeed.map((item: any) => ({
          id: String(item.id ?? Math.random()),
          type: item.type ?? "card_review",
          entityLabel: String(item.entityLabel ?? ""),
          detail: String(item.detail ?? ""),
          delta: String(item.delta ?? ""),
          timestamp: String(item.timestamp ?? ""),
        }))
      : [],

    fsrsStats:
      json.fsrsStats && typeof json.fsrsStats === "object"
        ? {
            dueToday: Number(json.fsrsStats.dueToday) || 0,
            dueThisWeek: Number(json.fsrsStats.dueThisWeek) || 0,
            reviewedToday: Number(json.fsrsStats.reviewedToday) || 0,
            retentionRate: Number(json.fsrsStats.retentionRate) || 0,
            leechCount: Number(json.fsrsStats.leechCount) || 0,
            avgStability: Number(json.fsrsStats.avgStability) || 0,
            avgDifficulty: Number(json.fsrsStats.avgDifficulty) || 0,
            matureCards: Number(json.fsrsStats.matureCards) || 0,
            totalCards: Number(json.fsrsStats.totalCards) || 0,
            overdue: Number(json.fsrsStats.overdue) || 0,
            learningCards: Number(json.fsrsStats.learningCards) || 0,
            newCards: Number(json.fsrsStats.newCards) || 0,
          }
        : null,

    plannerDetailedStats:
      json.plannerDetailedStats && typeof json.plannerDetailedStats === "object"
        ? {
            available:
              json.plannerDetailedStats.available === true ||
              (json.planner && typeof json.planner === "object" && json.planner.available === true),
            reason:
              (typeof json.plannerDetailedStats.reason === "string"
                ? json.plannerDetailedStats.reason
                : undefined) ??
              (json.planner && typeof json.planner === "object" && typeof json.planner.reason === "string"
                ? json.planner.reason
                : undefined),
            todayTasks: Number(json.plannerDetailedStats.todayTasks) || 0,
            completedToday: Number(json.plannerDetailedStats.completedToday) || 0,
            overdueTasks: Number(json.plannerDetailedStats.overdueTasks) || 0,
            upcomingTasks: Array.isArray(json.plannerDetailedStats.upcomingTasks)
              ? json.plannerDetailedStats.upcomingTasks.map((item: any) => ({
                  id: String(item.id ?? ""),
                  title: String(item.title ?? ""),
                  scheduledFor: String(item.scheduledFor ?? ""),
                }))
              : [],
            dailyGoalMinutes: Number(json.plannerDetailedStats.dailyGoalMinutes) || 0,
            dailyGoalProgress: Number(json.plannerDetailedStats.dailyGoalProgress) || 0,
            examDate: json.plannerDetailedStats.examDate ?? null,
            daysToExam: json.plannerDetailedStats.daysToExam != null ? Number(json.plannerDetailedStats.daysToExam) : null,
            studyStreak: Number(json.plannerDetailedStats.studyStreak) || 0,
          }
        : null,

    monthlyActivity: Array.isArray(json.monthlyActivity)
      ? json.monthlyActivity.map((item: any) => ({
          date: String(item.date ?? ""),
          questionsAnswered: Number(item.questionsAnswered) || 0,
          cardsReviewed: Number(item.cardsReviewed) || 0,
          minutesStudied: Number(item.minutesStudied) || 0,
        }))
      : [],

    dashboardSnapshot:
      json.dashboardSnapshot && typeof json.dashboardSnapshot === "object"
        ? {
            readinessScore: json.dashboardSnapshot.readinessScore ?? {
              score: 0,
              level: "not_ready",
              factors: { coverage: 0, accuracy: 0, retention: 0, consistency: 0, weakAreas: 0 },
              trend: "stable",
            },
            weakAreas: Array.isArray(json.dashboardSnapshot.weakAreas) ? json.dashboardSnapshot.weakAreas : [],
            recommendations: Array.isArray(json.dashboardSnapshot.recommendations) ? json.dashboardSnapshot.recommendations : [],
            trapQuestions: Array.isArray(json.dashboardSnapshot.trapQuestions) ? json.dashboardSnapshot.trapQuestions : [],
            recentNotes: Array.isArray(json.dashboardSnapshot.recentNotes) ? json.dashboardSnapshot.recentNotes : [],
            activityFeed: Array.isArray(json.dashboardSnapshot.activityFeed) ? json.dashboardSnapshot.activityFeed : [],
            fsrsStats: json.dashboardSnapshot.fsrsStats ?? {
              dueToday: 0,
              dueThisWeek: 0,
              reviewedToday: 0,
              retentionRate: 0,
              leechCount: 0,
              avgStability: 0,
              avgDifficulty: 0,
              matureCards: 0,
              totalCards: 0,
              overdue: 0,
              learningCards: 0,
              newCards: 0,
            },
            plannerStats: json.dashboardSnapshot.plannerStats && typeof json.dashboardSnapshot.plannerStats === "object"
              ? {
                  available:
                    json.dashboardSnapshot.plannerStats.available === true ||
                    (json.planner && typeof json.planner === "object" && json.planner.available === true),
                  reason:
                    (typeof json.dashboardSnapshot.plannerStats.reason === "string"
                      ? json.dashboardSnapshot.plannerStats.reason
                      : undefined) ??
                    (json.planner && typeof json.planner === "object" && typeof json.planner.reason === "string"
                      ? json.planner.reason
                      : undefined),
                  todayTasks: Number(json.dashboardSnapshot.plannerStats.todayTasks) || 0,
                  completedToday: Number(json.dashboardSnapshot.plannerStats.completedToday) || 0,
                  overdueTasks: Number(json.dashboardSnapshot.plannerStats.overdueTasks) || 0,
                  upcomingTasks: Array.isArray(json.dashboardSnapshot.plannerStats.upcomingTasks)
                    ? json.dashboardSnapshot.plannerStats.upcomingTasks.map((item: any) => ({
                        id: String(item.id ?? ""),
                        title: String(item.title ?? ""),
                        scheduledFor: String(item.scheduledFor ?? ""),
                      }))
                    : [],
                  dailyGoalMinutes: Number(json.dashboardSnapshot.plannerStats.dailyGoalMinutes) || 0,
                  dailyGoalProgress: Number(json.dashboardSnapshot.plannerStats.dailyGoalProgress) || 0,
                  examDate: json.dashboardSnapshot.plannerStats.examDate ?? null,
                  daysToExam:
                    json.dashboardSnapshot.plannerStats.daysToExam != null
                      ? Number(json.dashboardSnapshot.plannerStats.daysToExam)
                      : null,
                  studyStreak: Number(json.dashboardSnapshot.plannerStats.studyStreak) || 0,
                }
              : {
                  available: false,
                  todayTasks: 0,
                  completedToday: 0,
                  overdueTasks: 0,
                  upcomingTasks: [],
                  dailyGoalMinutes: 0,
                  dailyGoalProgress: 0,
                  examDate: null,
                  daysToExam: null,
                  studyStreak: 0,
                },
            monthlyActivity: Array.isArray(json.dashboardSnapshot.monthlyActivity) ? json.dashboardSnapshot.monthlyActivity : [],
          }
        : null,
  };
}

/* ------------------------------------------------------------------ */
/*  Main hook                                                          */
/* ------------------------------------------------------------------ */

export function useDashboardData() {
  const xp = useGamificationStore((s) => Math.max(0, Number(s.xp) || 0));
  const level = useGamificationStore((s) => Math.max(1, Number(s.level) || 1));
  const streak = useGamificationStore((s) =>
    Math.max(0, Number(s.streak) || 0),
  );
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<DashboardCounts>(EMPTY_COUNTS);
  const [capabilities, setCapabilities] = useState<RuntimeCapabilities>(SUPPORTED_RUNTIME_CAPABILITIES);
  const [serverStats, setServerStats] =
    useState<DashboardServerStats>(EMPTY_SERVER_STATS);
  const [planner, setPlanner] = useState<PlannerTodayInfo>(EMPTY_PLANNER);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      // ── Fire API calls immediately ──────────────────────────────────
      // Don't wait for OPFS/PGlite to finish before starting network requests
      const apiPromises = Promise.all([
        fetch("/api/app-shell/context", { cache: "no-store" }).catch(() => null),
        fetch("/api/dashboard/stats", { cache: "no-store" }).catch(() => null),
      ]);

      // ── Local-first: hydrate instantly from the last captured snapshot
      //    so the page renders even in airplane mode. Non-blocking: the
      //    rest of the load still runs underneath.
      if (isLocalFirstEnabled()) {
        try {
          const snap = await loadDashboardSnapshot<DashboardServerStats>();
          if (!cancelled && snap) {
            setServerStats(snap.stats);
          }
        } catch {
          /* snapshot unavailable — fine */
        }
      }

      // ── OPFS-first: read local counts immediately ──────────────────
      // Timeout protects against PGlite WASM init hang (e.g. missing
      // SharedArrayBuffer / OPFS access) so the dashboard always renders.
      try {
        const local = await Promise.race([
          getDashboardStats(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("PGlite timeout")), 8000),
          ),
        ]);
        if (!cancelled) {
          setCounts({
            questions: local.totalQuestions,
            flashcards: local.totalFlashcards,
            notebooks: 0,
            exams: local.totalSessions,
            dueFlashcards: local.dueFlashcards,
          });
          setServerStats((prev) => ({
            ...prev,
            chapterPerformance: local.chapterPerformance,
            fsrsStatsByChapter: local.fsrsStatsByChapter,
            readerStatsByChapter: local.readerStatsByChapter,
            activityFeed: local.activityFeed,
          }));
        }
      } catch {
        // OPFS unavailable or timed out — will try API below
      }

      // ── Network: enrich with server stats if online ────────────────
      try {
        const [contextResponse, statsResponse] = await apiPromises;

        if (contextResponse && contextResponse.ok) {
          const contextJson = (await contextResponse.json().catch(() => null)) as AppShellContextResponse | null;
          if (!cancelled && contextJson) {
            setCounts((prev) => ({
              questions: Number(contextJson.stats?.questions) || prev.questions,
              flashcards: Number(contextJson.stats?.flashcards) || prev.flashcards,
              notebooks: Number(contextJson.stats?.notebooks) || prev.notebooks,
              exams: Number(contextJson.stats?.exams) || prev.exams,
              dueFlashcards: Number(contextJson.stats?.dueFlashcards) || prev.dueFlashcards,
            }));
            setCapabilities({
              ...SUPPORTED_RUNTIME_CAPABILITIES,
              ...contextJson.capabilities,
            });
          }
        } else if (!cancelled) {
          setCapabilities(SUPPORTED_RUNTIME_CAPABILITIES);
        }

        if (statsResponse && statsResponse.ok) {
          const statsJson = await statsResponse.json().catch(() => null);
          if (!cancelled && statsJson) {
            const normalized = normalizeStatsPayload(statsJson);
            setServerStats(normalized);
            const ps = normalized.plannerStats;
            setPlanner({
              hasActivePlan: ps.available === true && !!normalized.activePlanInfo,
              planTitle: normalized.activePlanInfo?.title ?? null,
              todayTasks: ps.available ? ps.todayTasks : 0,
              completedToday: normalized.plannerDetailedStats?.completedToday ?? 0,
              overdueTasks: ps.available ? ps.overdueTasks : 0,
              available: ps.available === true,
              reason: ps.reason,
            });
            if (isLocalFirstEnabled()) {
              captureDashboardSnapshot(normalized).catch(() => {
                /* snapshot write is best-effort */
              });
            }
          }
        } else if (!cancelled) {
          setPlanner(EMPTY_PLANNER);
        }
      } catch {
        if (!cancelled) {
          setCapabilities(SUPPORTED_RUNTIME_CAPABILITIES);
          setPlanner(EMPTY_PLANNER);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    const dueToday = Math.max(
      0,
      Number(serverStats.flashcardStats?.dueToday) || counts.dueFlashcards || 0,
    );
    const displayCounts = {
      ...counts,
      flashcards: Math.max(
        0,
        Number(serverStats.flashcardStats?.total) || counts.flashcards,
      ),
      dueFlashcards: dueToday,
    };
    const hour = new Date().getHours();
    const greeting =
      hour < 5
        ? "بامداد بخیر"
        : hour < 12
          ? "صبح بخیر"
          : hour < 17
            ? "ظهر بخیر"
            : hour < 22
              ? "عصر بخیر"
              : "شب بخیر";

    const etaPerCard = 0.58;
    const etaMinutes = dueToday === 0 ? 0 : Math.ceil(dueToday * etaPerCard);
    const xpPerLevel = level * XP_PER_LEVEL_DISPLAY;
    const progressPercent = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          ((xp % XP_PER_LEVEL_DISPLAY) / XP_PER_LEVEL_DISPLAY) * 100,
        ),
      ),
    );
    const nextLevelXP = Math.max(
      0,
      xpPerLevel - (xp % XP_PER_LEVEL_DISPLAY),
    );

    const rawFeatureLinks: FeatureLink[] = [
      {
        key: "review",
        title: "مرور",
        subtitle: "Review / SRS",
        href: "/flashcards/review",
        accent: "#0AA6B8",
        count: dueToday,
      },
      {
        key: "qbank",
        title: "بانک سوالات",
        subtitle: "Questions",
        href: "/qbank",
        accent: "#047A88",
        count: counts.questions,
      },
      {
        key: "flashcards",
        title: "فلشکارت\u200Cها",
        subtitle: "Flashcards",
        href: "/flashcards",
        accent: "#7C6FD4",
        count: displayCounts.flashcards,
      },
      {
        key: "notebooks",
        title: "نوت\u200Cبوک\u200Cها",
        subtitle: "Notebooks",
        href: "/notebooks",
        accent: "#D97706",
        count: counts.notebooks,
      },
      {
        key: "planner",
        title: "برنامه\u200Cریزی",
        subtitle: "Planner",
        href: "/planner",
        accent: "#16A34A",
        count: serverStats.plannerStats.available ? serverStats.plannerStats.todayTasks : undefined,
      },
      {
        key: "history",
        title: "تاریخچه",
        subtitle: "Exam history",
        href: "/history",
        accent: "#E88B30",
        count: counts.exams,
      },
      {
        key: "analytics",
        title: "آنالیتیکس",
        subtitle: "Analytics",
        href: "/history",
        accent: "#2DB5C6",
      },
      {
        key: "exam-builder",
        title: "سازنده آزمون",
        subtitle: "Exam builder",
        href: "/exam/builder",
        accent: "#D946A8",
      },
      {
        key: "exam-active",
        title: "آزمون فعال",
        subtitle: "Active exam",
        href: "/exam/active",
        accent: "#DC2626",
      },
      {
        key: "import",
        title: "ایمپورت",
        subtitle: "Import",
        href: "/import",
        accent: "#5B63D4",
      },
      {
        key: "srs-insights",
        title: "بینش SRS",
        subtitle: "Insights",
        href: "/flashcards/stats",
        accent: "#22C55E",
      },
      {
        key: "settings",
        title: "تنظیمات",
        subtitle: "Settings",
        href: "/settings",
        accent: "#6B7780",
      },
    ];
    const featureCapabilityMap: Record<string, keyof RuntimeCapabilities> = {
      review: "review",
      qbank: "qbank",
      flashcards: "flashcards",
      notebooks: "library",
      planner: "planner",
      history: "history",
      analytics: "analytics",
      "exam-builder": "qbank",
      "exam-active": "qbank",
      import: "import",
      "srs-insights": "review",
      settings: "settings",
    };
    const featureLinks = rawFeatureLinks.filter(
      (item) => capabilities[featureCapabilityMap[item.key] ?? "library"],
    );

    return {
      loading,
      greeting,
      brand: "Hossein Starship",
      mission: "Mission Control",
      dueToday,
      xp,
      level,
      streak,
      etaMinutes,
      progressPercent,
      nextLevelXP,
      counts: displayCounts,
      serverStats,
      planner,
      readinessScore: serverStats.readinessScore,
      dashboardRecommendations: serverStats.dashboardRecommendations,
      trapQuestions: serverStats.trapQuestions,
      studyNotes: serverStats.studyNotes,
      weakSpots: serverStats.weakSpots,
      activityFeed: serverStats.activityFeed,
      fsrsStats: serverStats.fsrsStats,
      plannerDetailedStats: serverStats.plannerDetailedStats,
      monthlyActivity: serverStats.monthlyActivity,
      dashboardSnapshot: serverStats.dashboardSnapshot,
      featureLinks,
    };
  }, [loading, xp, level, streak, counts, capabilities, serverStats, planner]);
}

const XP_PER_LEVEL_DISPLAY = 500;
