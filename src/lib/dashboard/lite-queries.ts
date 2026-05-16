import { and, count, desc, eq, gte, isNotNull, lte, or, sql } from "drizzle-orm";
import { getDb } from "@/db/index";
import {
  chapters,
  chunkStudySessions,
  conceptMastery,
  examSessions,
  flashcards,
  flashcardReviews,
  questionAttempts,
  questions,
  studyTasks,
  taskStatus,
} from "@/db/schema";
import { getLibraryDashboardData } from "@/lib/library/queries";
import { getPlannerDashboardSlice } from "@/lib/planner/planner-dashboard-slice";

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
  avgRetention: number | null;
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
      avgRetention: sql<number | null>`
        AVG(
          CASE WHEN ${flashcards.fsrsStability} > 0
          THEN EXP(-1.0 / ${flashcards.fsrsStability}) * 100
          ELSE NULL END
        )
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
    avgRetention: row.avgRetention == null ? null : Number(row.avgRetention),
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
      detail: "مرور شد",
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
      detail: "خوانده شد",
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
  const [libraryData, qbankStats, flashcardStats, fsrsStatsByChapter, readerStatsByChapter, activityFeed, chapterPerformance, weeklyActivity, plannerSlice, monthlyActivity, domainMastery, recentExams, trapQuestions] = await Promise.all([
    getLibraryDashboardData(),
    getQbankLiteStats(),
    getFlashcardLiteStats(),
    getFsrsStatsByChapterLite(),
    getReaderStatsByChapterLite(),
    getActivityFeedLite(),
    getChapterPerformanceLite(),
    getWeeklyActivityLite(),
    getPlannerDashboardSlice(),
    getMonthlyActivityLite({ days: 35 }),
    getDomainMasteryLite(),
    getRecentExamsLite(),
    getTrapQuestionsLite(),
  ]);

  const readinessScore = buildHostedReadiness({
    totalIncluded: libraryData.totalIncluded,
    totalRead: libraryData.totalRead,
    accuracy: qbankStats.accuracy,
    flashcardsTotal: flashcardStats.total,
    dueToday: flashcardStats.dueToday,
    weakAreaCount: libraryData.weakChapters.length,
  });

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayActivity = monthlyActivity.find((row) => row.date === todayKey);
  const studyTimeToday = Math.max(0, (todayActivity?.minutesStudied ?? 0) * 60);

  const dashboardRecommendations = chapterPerformance
    .slice(0, 3)
    .map((row, index) => ({
      id: `weak-${row.chapterId}-${index}`,
      title: row.chapterTitle || row.chapterId,
      subtitle: "تمرکز پیشنهادی امروز",
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
    daysToExam: plannerSlice.available ? plannerSlice.daysToExam : null,
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
      available: plannerSlice.available,
      reason: plannerSlice.reason,
      totalTasks: plannerSlice.available ? plannerSlice.totalTasks : 0,
      completedTasks: plannerSlice.available ? plannerSlice.completedTasks : 0,
      completedPlanTasks: plannerSlice.available ? plannerSlice.completedTasks : 0,
      overdueTasks: plannerSlice.available ? plannerSlice.overdueTasks : 0,
      todayTasks: plannerSlice.available ? plannerSlice.todayTasks : 0,
      weekTaskCount: plannerSlice.available ? plannerSlice.weekTasks.length : 0,
      completionRate:
        plannerSlice.available && plannerSlice.totalTasks > 0
          ? Math.round((plannerSlice.completedTasks / plannerSlice.totalTasks) * 100)
          : 0,
      tasksToday: plannerSlice.tasksToday,
      tasksOverdue: plannerSlice.tasksOverdue,
      weekTasks: plannerSlice.weekTasks,
      activePlan: plannerSlice.available ? plannerSlice.activePlan : null,
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
      available: plannerSlice.available,
      reason: plannerSlice.reason,
      todayTasks: plannerSlice.todayTasks,
      completedToday: plannerSlice.completedToday,
      overdueTasks: plannerSlice.overdueTasks,
      upcomingTasks: plannerSlice.upcomingTasks,
      dailyGoalMinutes: plannerSlice.dailyGoalMinutes,
      dailyGoalProgress:
        plannerSlice.available && plannerSlice.dailyGoalMinutes > 0 && plannerSlice.todayTasks > 0
          ? Math.min(100, Math.round((plannerSlice.completedToday / plannerSlice.todayTasks) * 100))
          : 0,
      examDate: plannerSlice.examDate,
      daysToExam: plannerSlice.daysToExam,
      studyStreak: plannerSlice.studyStreak,
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
        available: plannerSlice.available,
        reason: plannerSlice.reason,
        todayTasks: plannerSlice.todayTasks,
        completedToday: plannerSlice.completedToday,
        overdueTasks: plannerSlice.overdueTasks,
        upcomingTasks: plannerSlice.upcomingTasks,
        dailyGoalMinutes: plannerSlice.dailyGoalMinutes,
        dailyGoalProgress:
          plannerSlice.available && plannerSlice.dailyGoalMinutes > 0 && plannerSlice.todayTasks > 0
            ? Math.min(100, Math.round((plannerSlice.completedToday / plannerSlice.todayTasks) * 100))
            : 0,
        examDate: plannerSlice.examDate,
        daysToExam: plannerSlice.daysToExam,
        studyStreak: plannerSlice.studyStreak,
      },
      monthlyActivity,
    },
    tasks: {
      today: plannerSlice.tasksToday,
      overdue: plannerSlice.tasksOverdue,
    },
    todayTasks: plannerSlice.tasksToday,
    overdueTasks: plannerSlice.tasksOverdue,
    activePlan: plannerSlice.available ? plannerSlice.activePlan : null,
  };
}


