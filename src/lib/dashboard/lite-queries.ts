import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "@/db/index";
import {
  chapters,
  flashcards,
  flashcardReviews,
  planStatus,
  questionAttempts,
  questions,
  studyPlannerSettings,
  studyPlans,
  studyTasks,
  taskStatus,
} from "@/db/schema";
import { getLibraryDashboardData } from "@/lib/library/queries";

type ChapterPerformanceRow = {
  chapterId: string;
  chapterTitle: string | null;
  total: number;
  correct: number;
  accuracy: number;
};

type WeeklyActivityRow = {
  day: string;
  count: number;
  correct: number;
};

function todayBoundsMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const startMs = d.getTime();
  return { startMs, endMs: startMs + 86_400_000 };
}

function buildHostedReadiness(input: {
  totalIncluded: number;
  totalRead: number;
  accuracy: number;
  flashcardsTotal: number;
  dueToday: number;
  weakAreaCount: number;
}) {
  const coverage =
    input.totalIncluded > 0 ? Math.round((input.totalRead / input.totalIncluded) * 100) : 0;
  const retention =
    input.flashcardsTotal > 0
      ? Math.max(0, Math.round(((input.flashcardsTotal - input.dueToday) / input.flashcardsTotal) * 100))
      : 0;
  const consistency = input.totalRead > 0 ? Math.min(100, 25 + input.totalRead) : 0;
  const weakAreas = Math.max(0, 100 - Math.min(60, input.weakAreaCount * 12));

  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(coverage * 0.35 + input.accuracy * 0.35 + retention * 0.15 + consistency * 0.15 - input.weakAreaCount * 3),
    ),
  );

  const level =
    score >= 85 ? "ready" :
    score >= 70 ? "proficient" :
    score >= 55 ? "developing" :
    score >= 40 ? "needs_work" :
    "not_ready";

  return {
    score,
    level,
    factors: {
      coverage,
      accuracy: input.accuracy,
      retention,
      consistency,
      weakAreas,
    },
    trend: "stable" as const,
  };
}

async function getQbankLiteStats() {
  const db = await getDb();
  const [totalRow, attemptRow] = await Promise.all([
    db.select({ value: count(questions.id) }).from(questions).limit(1),
    db
      .select({
        attemptedQuestions: sql<number>`COUNT(DISTINCT ${questionAttempts.questionId})`,
        correctAnswers: sql<number>`SUM(CASE WHEN ${questionAttempts.outcome} = 'correct' THEN 1 ELSE 0 END)`,
        totalAttempts: count(questionAttempts.id),
      })
      .from(questionAttempts)
      .limit(1),
  ]);

  const totalQuestions = totalRow[0]?.value ?? 0;
  const attemptedQuestions = attemptRow[0]?.attemptedQuestions ?? 0;
  const correctAnswers = attemptRow[0]?.correctAnswers ?? 0;
  const totalAttempts = attemptRow[0]?.totalAttempts ?? 0;

  return {
    totalQuestions,
    attemptedQuestions,
    correctAnswers,
    totalAttempts,
    testCount: 0,
    accuracy: totalAttempts > 0 ? Math.round((correctAnswers / totalAttempts) * 100) : 0,
    usage: totalQuestions > 0 ? Math.round((attemptedQuestions / totalQuestions) * 100) : 0,
  };
}

async function getFlashcardLiteStats() {
  const db = await getDb();
  const now = Date.now();
  const { startMs, endMs } = todayBoundsMs();
  const weekAhead = now + 7 * 86_400_000;

  const activeCards = and(
    eq(flashcards.isArchived, 0),
    eq(flashcards.status, "active"),
  );

  const [
    totalRow,
    dueRow,
    masteredRow,
    dueWeekRow,
    reviewedTodayRow,
    leechRow,
    avgRow,
    matureRow,
    overdueRow,
    learningRow,
    newRow,
  ] = await Promise.all([
    db.select({ value: count(flashcards.id) }).from(flashcards).where(eq(flashcards.isArchived, 0)).limit(1),
    db.select({ value: count(flashcards.id) }).from(flashcards).where(and(activeCards, eq(flashcards.isSuspended, 0), eq(flashcards.isBuried, 0), lte(flashcards.fsrsDue, now))).limit(1),
    db.select({ value: count(flashcards.id) }).from(flashcards).where(and(activeCards, eq(flashcards.fsrsState, "review"))).limit(1),
    db.select({ value: count(flashcards.id) }).from(flashcards).where(and(activeCards, eq(flashcards.isSuspended, 0), eq(flashcards.isBuried, 0), lte(flashcards.fsrsDue, weekAhead))).limit(1),
    db.select({ value: count(flashcardReviews.id) }).from(flashcardReviews).where(and(gte(flashcardReviews.reviewedAt, startMs), lte(flashcardReviews.reviewedAt, endMs - 1))).limit(1),
    db.select({ value: count(flashcards.id) }).from(flashcards).where(and(eq(flashcards.isArchived, 0), eq(flashcards.isLeech, 1))).limit(1),
    db.select({
      avgStability: sql<number>`COALESCE(AVG(NULLIF(${flashcards.fsrsStability}, 0)), 0)`,
      avgDifficulty: sql<number>`COALESCE(AVG(NULLIF(${flashcards.fsrsDifficulty}, 0)), 0)`,
    }).from(flashcards).where(eq(flashcards.isArchived, 0)).limit(1),
    db.select({ value: count(flashcards.id) }).from(flashcards).where(and(activeCards, eq(flashcards.fsrsState, "review"), gte(flashcards.fsrsScheduledDays, 21))).limit(1),
    db.select({ value: count(flashcards.id) }).from(flashcards).where(and(activeCards, eq(flashcards.isSuspended, 0), eq(flashcards.isBuried, 0), lte(flashcards.fsrsDue, startMs - 1))).limit(1),
    db.select({ value: count(flashcards.id) }).from(flashcards).where(and(activeCards, sql`${flashcards.fsrsState} in ('learning', 'relearning')`)).limit(1),
    db.select({ value: count(flashcards.id) }).from(flashcards).where(and(activeCards, eq(flashcards.fsrsState, "new"))).limit(1),
  ]);

  return {
    total: Number(totalRow[0]?.value ?? 0),
    dueToday: Number(dueRow[0]?.value ?? 0),
    mastered: Number(masteredRow[0]?.value ?? 0),
    dueThisWeek: Number(dueWeekRow[0]?.value ?? 0),
    reviewedToday: Number(reviewedTodayRow[0]?.value ?? 0),
    leechCount: Number(leechRow[0]?.value ?? 0),
    avgStability: Number(avgRow[0]?.avgStability ?? 0),
    avgDifficulty: Number(avgRow[0]?.avgDifficulty ?? 0),
    matureCards: Number(matureRow[0]?.value ?? 0),
    overdue: Number(overdueRow[0]?.value ?? 0),
    learningCards: Number(learningRow[0]?.value ?? 0),
    newCards: Number(newRow[0]?.value ?? 0),
  };
}

async function getChapterPerformanceLite(): Promise<ChapterPerformanceRow[]> {
  const db = await getDb();
  const rows = await db
    .select({
      chapterId: questions.chapterId,
      chapterTitle: chapters.title,
      total: count(questionAttempts.id),
      correct: sql<number>`SUM(CASE WHEN ${questionAttempts.outcome} = 'correct' THEN 1 ELSE 0 END)`,
    })
    .from(questionAttempts)
    .innerJoin(questions, eq(questionAttempts.questionId, questions.id))
    .innerJoin(chapters, eq(questions.chapterId, chapters.id))
    .groupBy(questions.chapterId, chapters.title);

  return rows
    .map((row) => ({
      chapterId: row.chapterId ?? `chapter-${row.chapterTitle ?? "unknown"}`,
      chapterTitle: row.chapterTitle,
      total: row.total,
      correct: row.correct ?? 0,
      accuracy: row.total > 0 ? Math.round(((row.correct ?? 0) / row.total) * 100) : 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy);
}

const PLANNER_STATS_EMPTY = {
  examDate: null as string | null,
  daysToExam: null as number | null,
  totalTasks: 0,
  completedTasks: 0,
  todayTasks: 0,
  completedToday: 0,
  overdueTasks: 0,
  studyStreak: 0,
  dailyGoalMinutes: 120,
};

async function getPlannerLiteStats(): Promise<typeof PLANNER_STATS_EMPTY> {
  try {
    const db = await getDb();
    const today = new Date().toISOString().slice(0, 10);

    const [activePlanRows, todayTaskRows, settingsRows] = await Promise.all([
      db
        .select({
          examDate: studyPlans.examDate,
          totalTasks: studyPlans.totalTasks,
          completedTasks: studyPlans.completedTasks,
        })
        .from(studyPlans)
        .where(eq(studyPlans.status, planStatus.active))
        .orderBy(desc(studyPlans.createdAt))
        .limit(1),
      db
        .select({
          todayTasks: count(studyTasks.id),
          completedToday: sql<number>`SUM(CASE WHEN ${studyTasks.status} = ${taskStatus.completed} THEN 1 ELSE 0 END)`,
          overdueTasks: sql<number>`SUM(CASE WHEN ${studyTasks.status} = ${taskStatus.overdue} THEN 1 ELSE 0 END)`,
        })
        .from(studyTasks)
        .where(eq(studyTasks.scheduledFor, today))
        .limit(1),
      db
        .select({
          studyStreak: studyPlannerSettings.streakCurrent,
          dailyGoalMinutes: studyPlannerSettings.dailyGoalMinutes,
        })
        .from(studyPlannerSettings)
        .limit(1),
    ]);

    const plan = activePlanRows[0];
    const todayRow = todayTaskRows[0];
    const settings = settingsRows[0];

    let daysToExam: number | null = null;
    if (plan?.examDate) {
      const examMs = new Date(plan.examDate).getTime();
      const nowMs = new Date(today).getTime();
      daysToExam = Math.max(0, Math.ceil((examMs - nowMs) / 86_400_000));
    }

    return {
      examDate: plan?.examDate ?? null,
      daysToExam,
      totalTasks: plan?.totalTasks ?? 0,
      completedTasks: plan?.completedTasks ?? 0,
      todayTasks: todayRow?.todayTasks ?? 0,
      completedToday: todayRow?.completedToday ?? 0,
      overdueTasks: todayRow?.overdueTasks ?? 0,
      studyStreak: settings?.studyStreak ?? 0,
      dailyGoalMinutes: settings?.dailyGoalMinutes ?? 120,
    };
  } catch (err) {
    console.error("[getPlannerLiteStats] DB query failed:", err);
    return PLANNER_STATS_EMPTY;
  }
}

async function getWeeklyActivityLite(): Promise<WeeklyActivityRow[]> {
  const db = await getDb();
  const sevenDaysAgo = Date.now() - 7 * 86_400_000;
  const rows = await db
    .select({
      attemptedAt: questionAttempts.attemptedAt,
      outcome: questionAttempts.outcome,
    })
    .from(questionAttempts)
    .where(gte(questionAttempts.attemptedAt, sevenDaysAgo));

  const byDay = new Map<string, { count: number; correct: number }>();
  for (const row of rows) {
    const day = new Date(row.attemptedAt).toISOString().slice(0, 10);
    const current = byDay.get(day) ?? { count: 0, correct: 0 };
    current.count += 1;
    if (row.outcome === "correct") current.correct += 1;
    byDay.set(day, current);
  }

  return Array.from(byDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, stats]) => ({
      day,
      count: stats.count,
      correct: stats.correct,
    }));
}

export async function getHostedDashboardLiteData() {
  const [libraryData, qbankStats, flashcardStats, chapterPerformance, weeklyActivity, plannerStats] = await Promise.all([
    getLibraryDashboardData(),
    getQbankLiteStats(),
    getFlashcardLiteStats(),
    getChapterPerformanceLite(),
    getWeeklyActivityLite(),
    getPlannerLiteStats(),
  ]);

  const readinessScore = buildHostedReadiness({
    totalIncluded: libraryData.totalIncluded,
    totalRead: libraryData.totalRead,
    accuracy: qbankStats.accuracy,
    flashcardsTotal: flashcardStats.total,
    dueToday: flashcardStats.dueToday,
    weakAreaCount: libraryData.weakChapters.length,
  });

  return {
    accuracy: qbankStats.accuracy,
    weakAreaCount: libraryData.weakChapters.length,
    qbank: qbankStats,
    flashcards: flashcardStats,
    planner: {
      totalTasks: plannerStats.totalTasks,
      completedTasks: plannerStats.completedTasks,
      completedPlanTasks: plannerStats.completedTasks,
      overdueTasks: plannerStats.overdueTasks,
      todayTasks: plannerStats.todayTasks,
      completionRate: plannerStats.totalTasks > 0
        ? Math.round((plannerStats.completedTasks / plannerStats.totalTasks) * 100)
        : 0,
    },
    recentExams: [],
    studyTimeToday: 0,
    weeklyActivity,
    chapterPerformance,
    domainMastery: { domainMastery: [] },
    analyticsSnapshot: null,
    strengthsAndWeaknesses: {
      strengths: [],
      weaknesses: libraryData.weakChapters.map((item) => ({
        dimension: "chapter",
        key: item.title,
        accuracy: item.accuracyPercent,
        questionsAnswered: item.attempted,
        recommendedAction: "Review this chapter in the library and revisit linked flashcards.",
      })),
    },
    readinessScore,
    detailedWeakAreas: libraryData.weakChapters.map((item) => ({
      id: `chapter-${item.chapterNo}`,
      type: "chapter" as const,
      key: String(item.chapterNo),
      label: item.title,
      accuracy: item.accuracyPercent,
      questionsAttempted: item.attempted,
      flashcardRetention: 0,
      masteryScore: item.accuracyPercent,
      trend: "stable" as const,
      suggestedAction: "Review the chapter and linked notes.",
      color: "var(--amber)",
    })),
    dashboardRecommendations: [],
    trapQuestions: [],
    studyNotes: [],
    weakSpots: libraryData.weakChapters.map((item) => ({
      domain: item.title,
      accuracy: item.accuracyPercent,
      avgAccuracy: Math.min(100, item.accuracyPercent + 8),
      questionsAnswered: item.attempted,
      trend: "stable" as const,
    })),
    activityFeed: libraryData.recentlyRead.map((item) => ({
      id: `read-${item.chapterNo}`,
      text: `Reviewed ${item.title}`,
      time: new Date(item.lastReadAt).toLocaleDateString("en-CA"),
      timestamp: item.lastReadAt,
      tone: "blue" as const,
      type: "note" as const,
    })),
    fsrsStats: {
      dueToday: flashcardStats.dueToday,
      dueThisWeek: flashcardStats.dueThisWeek,
      reviewedToday: flashcardStats.reviewedToday,
      retentionRate: readinessScore.factors.retention,
      leechCount: flashcardStats.leechCount,
      avgStability: flashcardStats.avgStability,
      avgDifficulty: flashcardStats.avgDifficulty,
      matureCards: flashcardStats.matureCards,
      totalCards: flashcardStats.total,
      overdue: flashcardStats.overdue,
      learningCards: flashcardStats.learningCards,
      newCards: flashcardStats.newCards,
    },
    plannerDetailedStats: {
      todayTasks: plannerStats.todayTasks,
      completedToday: plannerStats.completedToday,
      overdueTasks: plannerStats.overdueTasks,
      upcomingTasks: [],
      dailyGoalMinutes: plannerStats.dailyGoalMinutes,
      dailyGoalProgress: plannerStats.dailyGoalMinutes > 0
        ? Math.min(100, Math.round((plannerStats.completedToday / plannerStats.todayTasks) * 100))
        : 0,
      examDate: plannerStats.examDate,
      daysToExam: plannerStats.daysToExam,
      studyStreak: plannerStats.studyStreak,
    },
    monthlyActivity: [],
    dashboardSnapshot: {
      readinessScore,
      weakAreas: [],
      recommendations: [],
      trapQuestions: [],
      recentNotes: [],
      activityFeed: [],
      fsrsStats: {
        dueToday: flashcardStats.dueToday,
        dueThisWeek: flashcardStats.dueThisWeek,
        reviewedToday: flashcardStats.reviewedToday,
        retentionRate: readinessScore.factors.retention,
        leechCount: flashcardStats.leechCount,
        avgStability: flashcardStats.avgStability,
        avgDifficulty: flashcardStats.avgDifficulty,
        matureCards: flashcardStats.matureCards,
        totalCards: flashcardStats.total,
        overdue: flashcardStats.overdue,
        learningCards: flashcardStats.learningCards,
        newCards: flashcardStats.newCards,
      },
      plannerStats: {
        todayTasks: plannerStats.todayTasks,
        completedToday: plannerStats.completedToday,
        overdueTasks: plannerStats.overdueTasks,
        upcomingTasks: [],
        dailyGoalMinutes: plannerStats.dailyGoalMinutes,
        dailyGoalProgress: plannerStats.dailyGoalMinutes > 0
          ? Math.min(100, Math.round((plannerStats.completedToday / plannerStats.todayTasks) * 100))
          : 0,
        examDate: plannerStats.examDate,
        daysToExam: plannerStats.daysToExam,
        studyStreak: plannerStats.studyStreak,
      },
      monthlyActivity: [],
    },
    tasks: {
      today: [] as Array<never>,
      overdue: [] as Array<never>,
    },
    todayTasks: [],
    overdueTasks: [],
    activePlan: null,
  };
}
