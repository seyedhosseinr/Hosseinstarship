import { and, count, desc, eq, gte, isNotNull, lte, or, sql } from "drizzle-orm";
import { getDb } from "@/db/index";
import {
  chapters,
  chunkStudySessions,
  conceptMastery,
  examSessions,
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

export type MonthlyActivityRow = {
  date: string;
  questionsAnswered: number;
  cardsReviewed: number;
  minutesStudied: number;
};

type FsrsStatsByChapterRow = {
  chapterId: string;
  totalCards: number;
  dueCards: number;
  reviewedCards: number;
  /**
   * FSRS-5 retrievability R(t,S) averaged across reviewed cards using actual elapsed
   * time since last review.  Formula: R = (1 + 19/81 × t/S)^(-0.5) × 100
   * Range 0–100.  NULL when no card has been reviewed yet.
   */
  avgRetention: number | null;
  /** Average FSRS stability in days for reviewed cards in this chapter (NULL if none). */
  avgStability: number | null;
  lastReviewedAt: string | null;
};

type ReaderStatsByChapterRow = {
  chapterId: string;
  readPercent: number;
  lastReadAt: string | null;
};

type ActivityFeedRow = {
  id: string;
  type: "card_review" | "mcq_block" | "chapter_read";
  entityLabel: string;
  detail: string;
  delta: string;
  timestamp: string;
};

type DashboardActivityItem = {
  id: string;
  text: string;
  time: string;
  timestamp: number;
  tone: "blue" | "emerald" | "rose" | "amber" | "violet";
  type: "exam" | "flashcard" | "note" | "planner" | "achievement";
};

type MonthlyActivitySources = {
  questions: Array<{ attemptedAt: number; timeSpentSeconds: number | null }>;
  reviews: Array<{ reviewedAt: number }>;
  tasks: Array<{ completedAt: number | null; actualMinutes: number | null }>;
  chunks: Array<{ startedAt: number; durationSeconds: number | null }>;
};

function todayBoundsMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const startMs = d.getTime();
  return { startMs, endMs: startMs + 86_400_000 };
}

function dayKey(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function stripHtml(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatActivityDate(timestamp: number) {
  return timestamp > 0 ? new Date(timestamp).toLocaleDateString("en-CA") : "";
}

function monthBoundsMs(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(year, month, 1);
  end.setHours(0, 0, 0, 0);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

function recentDayBoundsMs(days: number) {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 1);

  const start = new Date(end);
  start.setDate(start.getDate() - Math.max(1, days));
  return { startMs: start.getTime(), endMs: end.getTime() };
}

function enumerateDays(startMs: number, endMs: number) {
  const days: string[] = [];
  const cursor = new Date(startMs);
  cursor.setHours(12, 0, 0, 0);
  while (cursor.getTime() < endMs) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function buildMonthlyActivityRows(
  startMs: number,
  endMs: number,
  sources: MonthlyActivitySources,
): MonthlyActivityRow[] {
  const byDate = new Map<string, MonthlyActivityRow>();
  for (const date of enumerateDays(startMs, endMs)) {
    byDate.set(date, { date, questionsAnswered: 0, cardsReviewed: 0, minutesStudied: 0 });
  }

  for (const row of sources.questions) {
    const item = byDate.get(dayKey(row.attemptedAt));
    if (!item) continue;
    item.questionsAnswered += 1;
    item.minutesStudied += Math.max(0, Math.round((Number(row.timeSpentSeconds) || 0) / 60));
  }

  for (const row of sources.reviews) {
    const item = byDate.get(dayKey(row.reviewedAt));
    if (item) item.cardsReviewed += 1;
  }

  for (const row of sources.tasks) {
    if (!row.completedAt) continue;
    const item = byDate.get(dayKey(row.completedAt));
    if (item) item.minutesStudied += Math.max(0, Number(row.actualMinutes) || 0);
  }

  for (const row of sources.chunks) {
    const item = byDate.get(dayKey(row.startedAt));
    if (item) item.minutesStudied += Math.max(0, Math.round((Number(row.durationSeconds) || 0) / 60));
  }

  return Array.from(byDate.values());
}

/**
 * Compute a scientifically calibrated readiness score for medical board preparation.
 *
 * Weights rationale (total 100 %):
 *   Coverage  30 % — every topic must be seen before exam day
 *   Accuracy  30 % — MCQ performance is the most direct exam proxy
 *   Retention 25 % — actual FSRS-5 retrievability (R̄) across all reviewed cards;
 *                    this is the probability of correct recall right now
 *   Maturity  15 % — fraction of cards with interval ≥ 21 days (long-term consolidation)
 *
 * Penalty: −2 points per identified weak chapter area (capped to avoid negative scores).
 *
 * @param avgRetrievability  Weighted-average FSRS-5 R(t,S) across chapters (0–100).
 *                           Pass 0 when no cards have been reviewed yet.
 * @param matureCards        Count of cards in "review" state with scheduled_days ≥ 21.
 */
function buildHostedReadiness(input: {
  totalIncluded: number;
  totalRead: number;
  accuracy: number;
  flashcardsTotal: number;
  dueToday: number;
  weakAreaCount: number;
  /** Actual FSRS-5 retrievability average (0-100). 0 means no data yet. */
  avgRetrievability: number;
  /** Cards consolidated into long-term memory (interval >= 21 days). */
  matureCards: number;
}) {
  const coverage =
    input.totalIncluded > 0
      ? Math.round((input.totalRead / input.totalIncluded) * 100)
      : 0;

  // Retention = true FSRS-5 retrievability (probability of recall right now).
  // Falls back to a coarser "not-yet-due" ratio when no retrievability data exists.
  const retention =
    input.avgRetrievability > 0
      ? Math.round(input.avgRetrievability)
      : input.flashcardsTotal > 0
        ? Math.max(0, Math.round(((input.flashcardsTotal - input.dueToday) / input.flashcardsTotal) * 100))
        : 0;

  // Maturity = fraction of cards truly consolidated into long-term memory (≥21-day interval).
  // A rising maturity score proves sustained review over weeks, not just cramming.
  const maturity =
    input.flashcardsTotal > 0
      ? Math.round((input.matureCards / input.flashcardsTotal) * 100)
      : 0;

  const weakAreas = Math.max(0, 100 - Math.min(60, input.weakAreaCount * 12));

  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        coverage   * 0.30 +
        input.accuracy * 0.30 +
        retention  * 0.25 +
        maturity   * 0.15 -
        input.weakAreaCount * 2,
      ),
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
      // "consistency" slot repurposed: maturity is a better long-term study indicator
      // than the old linear chapter-count proxy.
      consistency: maturity,
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

async function getFsrsStatsByChapterLite(): Promise<FsrsStatsByChapterRow[]> {
  const db = await getDb();
  const now = Date.now();

  const rows = await db
    .select({
      chapterId: flashcards.chapterId,
      chapterNo: flashcards.chapterNo,
      totalCards: count(flashcards.id),
      dueCards: sql<number>`
        COUNT(*) FILTER (
          WHERE ${flashcards.fsrsDue} IS NOT NULL
          AND ${flashcards.fsrsDue} <= ${now}
        )
      `,
      reviewedCards: sql<number>`
        COUNT(*) FILTER (WHERE ${flashcards.fsrsReps} > 0)
      `,
      /**
       * FSRS-5 retrievability: R(t,S) = (1 + 19/81 × t/S)^(-0.5) × 100
       * where t = actual elapsed days since last review (not a fixed 1-day proxy).
       * Cards with no review (stability = 0) are excluded from the average.
       */
      avgRetention: sql<number | null>`
        AVG(
          CASE
            WHEN ${flashcards.fsrsStability} > 0
              AND ${flashcards.fsrsLastReview} IS NOT NULL
            THEN POWER(
              1.0 + (19.0 / 81.0)
                * GREATEST(0.0,
                    (${now}::float8 - CAST(${flashcards.fsrsLastReview} AS float8))
                    / 86400000.0)
                / ${flashcards.fsrsStability},
              -0.5
            ) * 100.0
            WHEN ${flashcards.fsrsStability} > 0
            THEN 100.0
            ELSE NULL
          END
        )
      `,
      /** Average stability in days for reviewed cards (NULLIF excludes unreviewed). */
      avgStability: sql<number | null>`
        AVG(NULLIF(${flashcards.fsrsStability}, 0))
      `,
      lastReviewedAt: sql<string | null>`
        MAX(${flashcards.fsrsLastReview})::text
      `,
    })
    .from(flashcards)
    .where(
      and(
        or(isNotNull(flashcards.chapterId), isNotNull(flashcards.chapterNo)),
        eq(flashcards.isArchived, 0),
        eq(flashcards.isDeleted, 0),
      ),
    )
    .groupBy(flashcards.chapterId, flashcards.chapterNo);

  return rows.map((row) => ({
    chapterId: row.chapterNo ? `ch-${Number(row.chapterNo)}` : row.chapterId ?? "",
    totalCards: Number(row.totalCards) || 0,
    dueCards: Number(row.dueCards) || 0,
    reviewedCards: Number(row.reviewedCards) || 0,
    avgRetention: row.avgRetention == null ? null : Math.min(100, Math.max(0, Number(row.avgRetention))),
    avgStability: row.avgStability == null ? null : Math.max(0, Number(row.avgStability)),
    lastReviewedAt: row.lastReviewedAt,
  }));
}

async function getReaderStatsByChapterLite(): Promise<ReaderStatsByChapterRow[]> {
  const db = await getDb();

  const rows = await db
    .select({
      chapterId: chunkStudySessions.chapterId,
      chapterNo: chapters.chapterNo,
      readPercent: sql<number>`
        AVG(
          LEAST(100, GREATEST(0, ${chunkStudySessions.progressPercent}))
        )
      `,
      lastReadAt: sql<string | null>`
        MAX(
          COALESCE(
            ${chunkStudySessions.endedAt},
            ${chunkStudySessions.startedAt},
            ${chunkStudySessions.createdAt}
          )
        )::text
      `,
    })
    .from(chunkStudySessions)
    .innerJoin(chapters, eq(chunkStudySessions.chapterId, chapters.id))
    .where(isNotNull(chunkStudySessions.chapterId))
    .groupBy(chunkStudySessions.chapterId, chapters.chapterNo);

  return rows.map((row) => ({
    chapterId: row.chapterNo ? `ch-${Number(row.chapterNo)}` : row.chapterId ?? "",
    readPercent: Math.min(100, Math.max(0, Number(row.readPercent) || 0)),
    lastReadAt: row.lastReadAt ?? null,
  }));
}

async function getActivityFeedLite(): Promise<ActivityFeedRow[]> {
  const db = await getDb();

  const [cardReviews, mcqBlocks, chapterReads] = await Promise.all([
    db
      .select({
        id: sql<string>`CAST(${flashcards.id} AS TEXT)`,
        entityLabel: sql<string>`COALESCE('ch-' || CAST(${flashcards.chapterNo} AS TEXT), ${flashcards.chapterId}, 'Flashcard')`,
        delta: sql<string>`'+1 Ú©Ø§Ø±Øª'`,
        timestamp: flashcards.fsrsLastReview,
      })
      .from(flashcards)
      .where(
        and(
          isNotNull(flashcards.fsrsLastReview),
          eq(flashcards.isDeleted, 0),
          eq(flashcards.isArchived, 0),
        ),
      )
      .orderBy(desc(flashcards.fsrsLastReview))
      .limit(5),

    db
      .select({
        id: sql<string>`CAST(${examSessions.id} AS TEXT)`,
        entityLabel: sql<string>`COALESCE(${examSessions.title}, 'MCQ Block')`,
        delta: sql<string>`
          CAST(${examSessions.totalCorrect} AS TEXT) || '/' ||
          CAST(${examSessions.totalQuestions} AS TEXT)
        `,
        timestamp: examSessions.completedAt,
      })
      .from(examSessions)
      .where(and(isNotNull(examSessions.completedAt), eq(examSessions.isDeleted, 0)))
      .orderBy(desc(examSessions.completedAt))
      .limit(5),

    db
      .select({
        id: sql<string>`CAST(${chunkStudySessions.id} AS TEXT)`,
        entityLabel: sql<string>`COALESCE('ch-' || CAST(${chapters.chapterNo} AS TEXT), ${chunkStudySessions.chapterId}, 'ÙØµÙ„')`,
        delta: sql<string>`
          CAST(COALESCE(${chunkStudySessions.durationSeconds}, 0) AS TEXT) || ' Ø«Ø§Ù†ÛŒÙ‡'
        `,
        timestamp: sql<string>`
          COALESCE(
            ${chunkStudySessions.endedAt},
            ${chunkStudySessions.startedAt},
            ${chunkStudySessions.createdAt}
          )
        `,
      })
      .from(chunkStudySessions)
      .leftJoin(chapters, eq(chunkStudySessions.chapterId, chapters.id))
      .where(isNotNull(chunkStudySessions.chapterId))
      .orderBy(desc(sql`
        COALESCE(
          ${chunkStudySessions.endedAt},
          ${chunkStudySessions.startedAt},
          ${chunkStudySessions.createdAt}
        )
      `))
      .limit(5),
  ]);

  return [
    ...cardReviews.map((row) => ({
      id: row.id,
      type: "card_review" as const,
      entityLabel: row.entityLabel,
      detail: "Ù…Ø±ÙˆØ± Ø´Ø¯",
      delta: row.delta,
      timestamp: String(row.timestamp ?? ""),
    })),
    ...mcqBlocks.map((row) => ({
      id: row.id,
      type: "mcq_block" as const,
      entityLabel: row.entityLabel,
      detail: "",
      delta: row.delta,
      timestamp: String(row.timestamp ?? ""),
    })),
    ...chapterReads.map((row) => ({
      id: row.id,
      type: "chapter_read" as const,
      entityLabel: row.entityLabel,
      detail: "Ø®ÙˆØ§Ù†Ø¯Ù‡ Ø´Ø¯",
      delta: row.delta,
      timestamp: String(row.timestamp ?? ""),
    })),
  ]
    .filter((row) => !!row.timestamp)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 10);
}

async function getChapterPerformanceLite(): Promise<ChapterPerformanceRow[]> {
  const db = await getDb();
  const rows = await db
    .select({
      chapterId: questions.chapterId,
      chapterNo: chapters.chapterNo,
      chapterTitle: chapters.title,
      total: count(questionAttempts.id),
      correct: sql<number>`SUM(CASE WHEN ${questionAttempts.outcome} = 'correct' THEN 1 ELSE 0 END)`,
    })
    .from(questionAttempts)
    .innerJoin(questions, eq(questionAttempts.questionId, questions.id))
    .innerJoin(chapters, eq(questions.chapterId, chapters.id))
    .groupBy(questions.chapterId, chapters.chapterNo, chapters.title);

  return rows
    .map((row) => ({
      chapterId: row.chapterNo ? `ch-${Number(row.chapterNo)}` : row.chapterId ?? `chapter-${row.chapterTitle ?? "unknown"}`,
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
  tasksToday: [] as Array<{
    id: string;
    title: string;
    taskType: string;
    status: string;
    estimatedMinutes: number;
    priority: number;
    scheduledFor: string | null;
  }>,
  tasksOverdue: [] as Array<{
    id: string;
    title: string;
    taskType: string;
    status: string;
    estimatedMinutes: number;
    priority: number;
    scheduledFor: string | null;
  }>,
  activePlan: null as null | {
    id: string;
    title: string | null;
    status: string;
    startDate: string | null;
    endDate: string | null;
    totalTasks: number;
    completedTasks: number;
    progressPercent: number;
  },
};

async function getPlannerLiteStats(): Promise<typeof PLANNER_STATS_EMPTY> {
  try {
    const db = await getDb();
    const today = new Date().toISOString().slice(0, 10);

    const [activePlanRows, todayTaskRows, settingsRows, tasksTodayRows, tasksOverdueRows] = await Promise.all([
      db
        .select({
          id: studyPlans.id,
          title: studyPlans.title,
          status: studyPlans.status,
          startDate: studyPlans.startDate,
          endDate: studyPlans.endDate,
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
      db
        .select({
          id: studyTasks.id,
          title: studyTasks.title,
          taskType: studyTasks.taskType,
          status: studyTasks.status,
          estimatedMinutes: studyTasks.estimatedMinutes,
          priority: studyTasks.priority,
          scheduledFor: studyTasks.scheduledFor,
        })
        .from(studyTasks)
        .where(eq(studyTasks.scheduledFor, today))
        .orderBy(desc(studyTasks.priority))
        .limit(10),
      db
        .select({
          id: studyTasks.id,
          title: studyTasks.title,
          taskType: studyTasks.taskType,
          status: studyTasks.status,
          estimatedMinutes: studyTasks.estimatedMinutes,
          priority: studyTasks.priority,
          scheduledFor: studyTasks.scheduledFor,
        })
        .from(studyTasks)
        .where(eq(studyTasks.status, taskStatus.overdue))
        .orderBy(desc(studyTasks.priority))
        .limit(10),
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
      tasksToday: tasksTodayRows.map((task) => ({
        id: String(task.id),
        title: task.title,
        taskType: task.taskType,
        status: task.status,
        estimatedMinutes: task.estimatedMinutes ?? 0,
        priority: task.priority ?? 0,
        scheduledFor: task.scheduledFor,
      })),
      tasksOverdue: tasksOverdueRows.map((task) => ({
        id: String(task.id),
        title: task.title,
        taskType: task.taskType,
        status: task.status,
        estimatedMinutes: task.estimatedMinutes ?? 0,
        priority: task.priority ?? 0,
        scheduledFor: task.scheduledFor,
      })),
      activePlan: plan
        ? {
            id: String(plan.id),
            title: plan.title ?? null,
            status: String(plan.status),
            startDate: plan.startDate ?? null,
            endDate: plan.endDate ?? null,
            totalTasks: plan.totalTasks ?? 0,
            completedTasks: plan.completedTasks ?? 0,
            progressPercent:
              plan.totalTasks && plan.totalTasks > 0
                ? Math.round(((plan.completedTasks ?? 0) / plan.totalTasks) * 100)
                : 0,
          }
        : null,
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

async function getDomainMasteryLite() {
  const db = await getDb();
  const rows = await db
    .select({
      domain: conceptMastery.conceptId,
      masteryScore: conceptMastery.masteryScore,
      questionAccuracy: conceptMastery.questionAccuracy,
      retentionScore: conceptMastery.flashcardRetention,
      recencyScore: conceptMastery.recencyScore,
      volume: conceptMastery.exposureCount,
    })
    .from(conceptMastery)
    .orderBy(desc(conceptMastery.lastReviewedAt))
    .limit(16);

  return {
    domainMastery: rows.map((row) => {
      const masteryScore = Number(row.masteryScore) || 0;
      const questionAccuracy = Number(row.questionAccuracy) || 0;
      const retentionScore = Number(row.retentionScore) || 0;
      const recencyScore = Number(row.recencyScore) || 0;
      return {
        domain: row.domain,
        masteryScore,
        confidence: Math.min(100, Math.max(0, Number(row.volume) || 0)),
        questionAccuracy,
        retentionScore,
        completionScore: masteryScore,
        recencyScore,
        volume: Number(row.volume) || 0,
        sourceCoverage: {
          qbank: questionAccuracy > 0,
          srs: retentionScore > 0,
          notes: false,
          planner: recencyScore > 0,
        },
      };
    }),
  };
}

export async function getMonthlyActivityLite(input?: {
  year?: number;
  month?: number;
  days?: number;
}): Promise<MonthlyActivityRow[]> {
  const db = await getDb();
  const now = new Date();
  const { startMs, endMs } =
    input?.days != null
      ? recentDayBoundsMs(input.days)
      : monthBoundsMs(
          Number(input?.year) || now.getFullYear(),
          Number(input?.month) || now.getMonth() + 1,
        );

  const [questionRows, reviewRows, taskRows, chunkRows] = await Promise.all([
    db
      .select({
        attemptedAt: questionAttempts.attemptedAt,
        timeSpentSeconds: questionAttempts.timeSpentSeconds,
      })
      .from(questionAttempts)
      .where(and(gte(questionAttempts.attemptedAt, startMs), lte(questionAttempts.attemptedAt, endMs - 1))),
    db
      .select({ reviewedAt: flashcardReviews.reviewedAt })
      .from(flashcardReviews)
      .where(and(gte(flashcardReviews.reviewedAt, startMs), lte(flashcardReviews.reviewedAt, endMs - 1))),
    db
      .select({
        completedAt: studyTasks.completedAt,
        actualMinutes: studyTasks.actualMinutes,
      })
      .from(studyTasks)
      .where(and(eq(studyTasks.status, taskStatus.completed), gte(studyTasks.completedAt, startMs), lte(studyTasks.completedAt, endMs - 1))),
    db
      .select({
        startedAt: chunkStudySessions.startedAt,
        durationSeconds: chunkStudySessions.durationSeconds,
      })
      .from(chunkStudySessions)
      .where(and(gte(chunkStudySessions.startedAt, startMs), lte(chunkStudySessions.startedAt, endMs - 1))),
  ]);

  return buildMonthlyActivityRows(startMs, endMs, {
    questions: questionRows,
    reviews: reviewRows,
    tasks: taskRows,
    chunks: chunkRows,
  });
}

async function getRecentActivityFeedLite(libraryData: Awaited<ReturnType<typeof getLibraryDashboardData>>): Promise<DashboardActivityItem[]> {
  const db = await getDb();
  const since = Date.now() - 30 * 86_400_000;
  const [questionRows, reviewRows, taskRows] = await Promise.all([
    db
      .select({
        id: questionAttempts.id,
        outcome: questionAttempts.outcome,
        attemptedAt: questionAttempts.attemptedAt,
        timeSpentSeconds: questionAttempts.timeSpentSeconds,
        chapterTitle: chapters.title,
      })
      .from(questionAttempts)
      .innerJoin(questions, eq(questionAttempts.questionId, questions.id))
      .innerJoin(chapters, eq(questions.chapterId, chapters.id))
      .where(gte(questionAttempts.attemptedAt, since))
      .orderBy(desc(questionAttempts.attemptedAt))
      .limit(8),
    db
      .select({
        id: flashcardReviews.id,
        rating: flashcardReviews.rating,
        reviewedAt: flashcardReviews.reviewedAt,
        frontHtml: flashcards.frontHtml,
        deck: flashcards.deck,
      })
      .from(flashcardReviews)
      .innerJoin(flashcards, eq(flashcardReviews.flashcardId, flashcards.id))
      .where(gte(flashcardReviews.reviewedAt, since))
      .orderBy(desc(flashcardReviews.reviewedAt))
      .limit(8),
    db
      .select({
        id: studyTasks.id,
        title: studyTasks.title,
        taskType: studyTasks.taskType,
        completedAt: studyTasks.completedAt,
        actualMinutes: studyTasks.actualMinutes,
      })
      .from(studyTasks)
      .where(and(eq(studyTasks.status, taskStatus.completed), gte(studyTasks.completedAt, since)))
      .orderBy(desc(studyTasks.completedAt))
      .limit(8),
  ]);

  const items: DashboardActivityItem[] = [
    ...libraryData.recentlyRead.map((item) => ({
      id: `read-${item.chapterNo}`,
      text: `Reviewed ${item.title}`,
      time: formatActivityDate(item.lastReadAt),
      timestamp: item.lastReadAt,
      tone: "blue" as const,
      type: "note" as const,
    })),
    ...questionRows.map((item) => ({
      id: `mcq-${item.id}`,
      text: `Answered MCQ in ${item.chapterTitle}`,
      time: formatActivityDate(item.attemptedAt),
      timestamp: item.attemptedAt,
      tone: item.outcome === "correct" ? "emerald" as const : "amber" as const,
      type: "exam" as const,
    })),
    ...reviewRows.map((item) => ({
      id: `fsrs-${item.id}`,
      text: `Reviewed FSRS card: ${stripHtml(item.frontHtml).slice(0, 80) || item.deck || "Flashcard"}`,
      time: formatActivityDate(item.reviewedAt),
      timestamp: item.reviewedAt,
      tone: item.rating >= 3 ? "emerald" as const : "amber" as const,
      type: "flashcard" as const,
    })),
    ...taskRows
      .filter((item) => item.completedAt != null)
      .map((item) => ({
        id: `planner-${item.id}`,
        text: `Completed planner task: ${item.title}`,
        time: formatActivityDate(item.completedAt ?? 0),
        timestamp: item.completedAt ?? 0,
        tone: "violet" as const,
        type: "planner" as const,
      })),
  ];

  return items
    .filter((item) => item.timestamp > 0)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 12);
}

async function getRecentExamsLite() {
  const db = await getDb();
  const rows = await db
    .select({
      id: examSessions.id,
      title: examSessions.title,
      mode: examSessions.mode,
      status: examSessions.status,
      totalQuestions: examSessions.totalQuestions,
      totalCorrect: examSessions.totalCorrect,
      totalIncorrect: examSessions.totalIncorrect,
      totalOmitted: examSessions.totalOmitted,
      scorePercent: examSessions.scorePercent,
      completedAt: examSessions.completedAt,
      elapsedSeconds: examSessions.elapsedSeconds,
    })
    .from(examSessions)
    .where(eq(examSessions.isDeleted, 0))
    .orderBy(desc(examSessions.completedAt))
    .limit(8);

  return rows.map((row) => ({
    id: String(row.id),
    title: row.title ?? null,
    mode: row.mode ?? null,
    status: row.status ?? null,
    totalQuestions: row.totalQuestions ?? null,
    totalCorrect: row.totalCorrect ?? null,
    totalIncorrect: row.totalIncorrect ?? null,
    totalOmitted: row.totalOmitted ?? null,
    scorePercent: row.scorePercent ?? null,
    completedAt: row.completedAt ?? null,
    elapsedSeconds: row.elapsedSeconds ?? null,
  }));
}

async function getTrapQuestionsLite() {
  const db = await getDb();
  const rows = await db
    .select({
      questionId: questionAttempts.questionId,
      attempts: count(questionAttempts.id),
      lastAttemptAt: sql<number>`MAX(${questionAttempts.attemptedAt})`,
    })
    .from(questionAttempts)
    .where(eq(questionAttempts.outcome, "incorrect"))
    .groupBy(questionAttempts.questionId)
    .orderBy(desc(count(questionAttempts.id)))
    .limit(5);

  return rows.map((row, index) => ({
    id: `trap-${row.questionId}`,
    question: `Question ${row.questionId}`,
    trapType: "distractor" as const,
    domain: "qbank",
    difficulty: "Medium" as const,
    yourAnswer: "Incorrect",
    correctAnswer: "â€”",
    explanation: "Derived from repeated incorrect attempts in real QBank history.",
    isHard: (row.attempts ?? 0) >= 2,
    resolved: false,
    attemptedAt: Number(row.lastAttemptAt) || Date.now() - index,
  }));
}

export async function getHostedDashboardLiteData() {
  const [libraryData, qbankStats, flashcardStats, fsrsStatsByChapter, readerStatsByChapter, activityFeed, chapterPerformance, weeklyActivity, plannerStats, monthlyActivity, domainMastery, recentExams, trapQuestions] = await Promise.all([
    getLibraryDashboardData(),
    getQbankLiteStats(),
    getFlashcardLiteStats(),
    getFsrsStatsByChapterLite(),
    getReaderStatsByChapterLite(),
    getActivityFeedLite(),
    getChapterPerformanceLite(),
    getWeeklyActivityLite(),
    getPlannerLiteStats(),
    getMonthlyActivityLite({ days: 35 }),
    getDomainMasteryLite(),
    getRecentExamsLite(),
    getTrapQuestionsLite(),
  ]);

  // Compute weighted-average FSRS-5 retrievability across all chapters.
  // Weight each chapter by its reviewed-card count so larger chapters dominate.
  const totalReviewedCards = fsrsStatsByChapter.reduce(
    (sum, c) => sum + (c.reviewedCards || 0), 0,
  );
  const avgRetrievability =
    totalReviewedCards > 0
      ? fsrsStatsByChapter.reduce((sum, c) => {
          if (c.avgRetention == null || c.reviewedCards === 0) return sum;
          return sum + c.avgRetention * c.reviewedCards;
        }, 0) / totalReviewedCards
      : 0;

  const readinessScore = buildHostedReadiness({
    totalIncluded: libraryData.totalIncluded,
    totalRead: libraryData.totalRead,
    accuracy: qbankStats.accuracy,
    flashcardsTotal: flashcardStats.total,
    dueToday: flashcardStats.dueToday,
    weakAreaCount: libraryData.weakChapters.length,
    avgRetrievability: Math.round(avgRetrievability * 10) / 10,
    matureCards: flashcardStats.matureCards,
  });

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayActivity = monthlyActivity.find((row) => row.date === todayKey);
  const studyTimeToday = Math.max(0, (todayActivity?.minutesStudied ?? 0) * 60);

  const dashboardRecommendations = chapterPerformance
    .slice(0, 3)
    .map((row, index) => ({
      id: `weak-${row.chapterId}-${index}`,
      title: row.chapterTitle || row.chapterId,
      subtitle: "ØªÙ…Ø±Ú©Ø² Ù¾ÛŒØ´Ù†Ù‡Ø§Ø¯ÛŒ Ø§Ù…Ø±ÙˆØ²",
      accuracy: row.accuracy,
      duration: "15m",
      mcqCount: row.total,
      reason: "Based on lowest chapter accuracy from real attempts.",
      type: "weak_area" as const,
      href: `/qbank?chapter=${row.chapterId}`,
      priority: Math.max(1, 100 - row.accuracy),
    }));

  const studyNotes = libraryData.recentlyRead.slice(0, 5).map((item, index) => ({
    id: `note-${item.chapterNo}-${index}`,
    title: item.title,
    preview: `Chapter ${item.chapterNo}`,
    detail: "Recent reading progress captured from library activity.",
    category: "reader",
    linkedMCQs: 0,
    linkedFlashcards: 0,
    concepts: [],
    createdAt: new Date(item.lastReadAt).toISOString(),
  }));

  const analyticsSnapshot = {
    overallAccuracy: qbankStats.accuracy,
    questionsAnswered: qbankStats.totalAttempts,
    questionsRemaining: Math.max(0, qbankStats.totalQuestions - qbankStats.attemptedQuestions),
    totalStudyMinutes: Math.round(monthlyActivity.reduce((sum, row) => sum + row.minutesStudied, 0)),
    avgTimePerQuestion: qbankStats.totalAttempts > 0 ? Math.round(studyTimeToday / qbankStats.totalAttempts) : 0,
    cardsReviewed: flashcardStats.reviewedToday,
    cardsDueToday: flashcardStats.dueToday,
    retentionRate: readinessScore.factors.retention,
    chaptersCompleted: libraryData.totalRead,
    chaptersTotal: libraryData.totalIncluded,
    segmentsMastered: flashcardStats.matureCards,
    segmentsTotal: flashcardStats.total,
    accuracyTrend: "stable" as const,
    studyTrend: "stable" as const,
    daysToExam: plannerStats.daysToExam,
    predictedScore: null,
    readinessLevel:
      readinessScore.level === "ready" ? "ready" :
      readinessScore.level === "proficient" ? "on_track" :
      readinessScore.level === "developing" ? "needs_work" :
      "not_ready",
    topStrengths: chapterPerformance.filter((item) => item.total > 0 && item.accuracy >= 80).sort((a, b) => b.accuracy - a.accuracy).slice(0, 3).map((item) => item.chapterTitle ?? item.chapterId),
    topWeaknesses: libraryData.weakChapters.slice(0, 3).map((item) => item.title),
    recommendedFocus: dashboardRecommendations.map((item) => item.title),
  };

  return {
    accuracy: qbankStats.accuracy,
    weakAreaCount: libraryData.weakChapters.length,
    qbank: qbankStats,
    flashcards: flashcardStats,
    fsrsStatsByChapter,
    readerStatsByChapter,
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
    recentExams,
    studyTimeToday,
    weeklyActivity,
    chapterPerformance,
    domainMastery,
    analyticsSnapshot,
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
    dashboardRecommendations,
    trapQuestions,
    studyNotes,
    weakSpots: libraryData.weakChapters.map((item) => ({
      domain: item.title,
      accuracy: item.accuracyPercent,
      avgAccuracy: Math.min(100, item.accuracyPercent + 8),
      questionsAnswered: item.attempted,
      trend: "stable" as const,
    })),
    activityFeed,
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
      dailyGoalProgress: plannerStats.dailyGoalMinutes > 0 && plannerStats.todayTasks > 0
        ? Math.min(100, Math.round((plannerStats.completedToday / plannerStats.todayTasks) * 100))
        : 0,
      examDate: plannerStats.examDate,
      daysToExam: plannerStats.daysToExam,
      studyStreak: plannerStats.studyStreak,
    },
    monthlyActivity,
    dashboardSnapshot: {
      readinessScore,
      weakAreas: [],
      recommendations: dashboardRecommendations,
      trapQuestions,
      recentNotes: studyNotes,
      activityFeed,
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
        dailyGoalProgress: plannerStats.dailyGoalMinutes > 0 && plannerStats.todayTasks > 0
          ? Math.min(100, Math.round((plannerStats.completedToday / plannerStats.todayTasks) * 100))
          : 0,
        examDate: plannerStats.examDate,
        daysToExam: plannerStats.daysToExam,
        studyStreak: plannerStats.studyStreak,
      },
      monthlyActivity,
    },
    tasks: {
      today: plannerStats.tasksToday,
      overdue: plannerStats.tasksOverdue,
    },
    todayTasks: plannerStats.tasksToday,
    overdueTasks: plannerStats.tasksOverdue,
    activePlan: plannerStats.activePlan,
  };
}


