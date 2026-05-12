#!/usr/bin/env tsx
/* eslint-disable no-console */

import * as nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());

const COMMAND = process.argv[2] ?? "verify";
const NEON_COMMANDS = new Set(["apply-neon", "cleanup-neon"]);
if (NEON_COMMANDS.has(COMMAND)) {
  process.env.DB_RUNTIME = "postgres";
  process.env.DATABASE_URL ??=
    process.env.NEON_DATABASE_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL;
} else {
  process.env.DB_RUNTIME ??= "pglite";
}

import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { eq, inArray, like } from "drizzle-orm";

import {
  attemptOutcome,
  chapterProgress,
  chapterProgressStatus,
  chapters,
  chunkStudySessions,
  conceptMastery,
  examMode,
  examSessions,
  examStatus,
  flashcardCreatedFrom,
  flashcardReviews,
  flashcardStatus,
  flashcardType,
  flashcards,
  planDayStatus,
  planStatus,
  questionAttempts,
  questionOptions,
  questionPoolMode,
  questionType,
  questions,
  reviewRating,
  studyPlanDays,
  studyPlannerSettings,
  studyPlans,
  studyTasks,
  targetMode,
  taskSourceType,
  taskStatus,
  taskType,
} from "@/db/schema";

const PREFIX = "dashboard-smoke";
const USER_ID = `${PREFIX}-user`;
const PLAN_ID = `${PREFIX}-plan`;
const PLAN_DAY_ID = `${PREFIX}-plan-day`;
const SETTINGS_ID = `${PREFIX}-settings`;
const TODAY = new Date().toISOString().slice(0, 10);
const NOW = Date.now();
const DAY = 86_400_000;

const syntheticChapters = [
  {
    id: `${PREFIX}-ch-strong`,
    chapterNo: 901,
    title: "Synthetic Strong Chapter",
    partTitle: "Dashboard Synthetic",
    volumeNo: 9,
    pageStart: 1,
    pageEnd: 10,
    mcq: { total: 12, correct: 11 },
    fsrs: { total: 8, due: 0, reviewed: 8, retention: 94, stability: 16, lastOffset: 1 },
    reader: { progress: 92, durationSeconds: 1_200, offset: 0 },
  },
  {
    id: `${PREFIX}-ch-weak`,
    chapterNo: 902,
    title: "Synthetic Weak Chapter",
    partTitle: "Dashboard Synthetic",
    volumeNo: 9,
    pageStart: 11,
    pageEnd: 20,
    mcq: { total: 10, correct: 4 },
    fsrs: { total: 7, due: 4, reviewed: 5, retention: 58, stability: 3, lastOffset: 3 },
    reader: { progress: 28, durationSeconds: 600, offset: 2 },
  },
  {
    id: `${PREFIX}-ch-overdue`,
    chapterNo: 903,
    title: "Synthetic Overdue Chapter",
    partTitle: "Dashboard Synthetic",
    volumeNo: 9,
    pageStart: 21,
    pageEnd: 30,
    mcq: { total: 8, correct: 3 },
    fsrs: { total: 6, due: 5, reviewed: 4, retention: 45, stability: 2, lastOffset: 9 },
    reader: { progress: 12, durationSeconds: 420, offset: 8 },
  },
  {
    id: `${PREFIX}-ch-sparse`,
    chapterNo: 904,
    title: "Synthetic Sparse Chapter",
    partTitle: "Dashboard Synthetic",
    volumeNo: 9,
    pageStart: 31,
    pageEnd: 40,
    mcq: { total: 0, correct: 0 },
    fsrs: { total: 0, due: 0, reviewed: 0, retention: null, stability: 0, lastOffset: null },
    reader: { progress: 0, durationSeconds: 0, offset: null },
  },
];

type GetDb = typeof import("@/db/index")["getDb"];
type Db = Awaited<ReturnType<GetDb>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

function id(suffix: string) {
  return `${PREFIX}-${suffix}`;
}

function isoDateOffset(days: number) {
  return new Date(NOW + days * DAY).toISOString().slice(0, 10);
}

async function getSeedDb() {
  const { getDb } = await import("@/db/index");
  return getDb();
}

async function getSeedRuntime() {
  const { getDbRuntime } = await import("@/db/index");
  return getDbRuntime();
}

async function assertSafeRuntime({ allowPostgres = false } = {}) {
  if (process.env.VERCEL === "1") {
    throw new Error("Refusing to seed dashboard smoke data on Vercel.");
  }

  const runtime = await getSeedRuntime();
  if (runtime === "postgres" && !allowPostgres && process.env.DASHBOARD_SMOKE_ALLOW_POSTGRES !== "1") {
    throw new Error("Refusing to seed Postgres. Set DASHBOARD_SMOKE_ALLOW_POSTGRES=1 only for a disposable database.");
  }

  if (process.env.NODE_ENV === "production" && process.env.DASHBOARD_SMOKE_ALLOW_PRODUCTION !== "1") {
    throw new Error("Refusing to seed in NODE_ENV=production.");
  }
}

async function cleanupRows(dbOrTx: Db | Tx) {
  await dbOrTx.delete(questionOptions).where(like(questionOptions.id, `${PREFIX}-%`));
  await dbOrTx.delete(questionAttempts).where(like(questionAttempts.id, `${PREFIX}-%`));
  await dbOrTx.delete(flashcardReviews).where(like(flashcardReviews.id, `${PREFIX}-%`));
  await dbOrTx.delete(studyTasks).where(like(studyTasks.id, `${PREFIX}-%`));
  await dbOrTx.delete(studyPlanDays).where(like(studyPlanDays.id, `${PREFIX}-%`));
  await dbOrTx.delete(studyPlannerSettings).where(eq(studyPlannerSettings.id, SETTINGS_ID));
  await dbOrTx.delete(studyPlans).where(eq(studyPlans.id, PLAN_ID));
  await dbOrTx.delete(examSessions).where(like(examSessions.id, `${PREFIX}-%`));
  await dbOrTx.delete(chunkStudySessions).where(like(chunkStudySessions.id, `${PREFIX}-%`));
  await dbOrTx.delete(conceptMastery).where(like(conceptMastery.id, `${PREFIX}-%`));
  await dbOrTx.delete(chapterProgress).where(inArray(chapterProgress.chapterNo, syntheticChapters.map((chapter) => chapter.chapterNo)));
  await dbOrTx.delete(flashcards).where(like(flashcards.id, `${PREFIX}-%`));
  await dbOrTx.delete(questions).where(like(questions.id, `${PREFIX}-%`));
  await dbOrTx.delete(chapters).where(like(chapters.id, `${PREFIX}-%`));
}

async function upsertRows<T extends { [key: string]: unknown }>(
  dbOrTx: Db | Tx,
  table: { [key: string]: unknown },
  rows: T[],
  target: unknown,
) {
  for (const row of rows) {
    await dbOrTx
      .insert(table as never)
      .values(row as never)
      .onConflictDoUpdate({ target: target as never, set: row as never });
  }
}

function questionRows() {
  const rows: Array<typeof questions.$inferInsert> = [];
  for (const chapter of syntheticChapters) {
    for (let index = 0; index < chapter.mcq.total; index += 1) {
      rows.push({
        id: id(`q-${chapter.chapterNo}-${index + 1}`),
        chapterId: chapter.id,
        externalKey: id(`q-ext-${chapter.chapterNo}-${index + 1}`),
        stemHtml: `<p>${chapter.title} synthetic MCQ ${index + 1}</p>`,
        stemText: `${chapter.title} synthetic MCQ ${index + 1}`,
        leadIn: "Choose the best answer.",
        explanationHtml: "<p>Dashboard smoke explanation.</p>",
        questionType: questionType.singleBestAnswer,
        difficulty: index % 3 === 0 ? "hard" : "medium",
        subject: "dashboard-smoke",
        system: "dashboard-smoke",
        category: "dashboard-smoke",
        topic: chapter.title,
        tagsJson: JSON.stringify(["dashboard-smoke"]) as unknown as string[],
        correctOptionId: id(`qo-${chapter.chapterNo}-${index + 1}-a`),
        sourceJson: JSON.stringify({ seed: PREFIX }) as unknown as Record<string, unknown>,
        createdAt: NOW - 10 * DAY,
        updatedAt: NOW,
        originId: PREFIX,
      });
    }
  }
  return rows;
}

function questionOptionRows() {
  return questionRows().flatMap((question) => [
    {
      id: `${question.id}-a`,
      questionId: question.id,
      optionKey: "A",
      contentHtml: "<p>Correct synthetic option</p>",
      contentText: "Correct synthetic option",
      isCorrect: 1,
      sortOrder: 0,
    },
    {
      id: `${question.id}-b`,
      questionId: question.id,
      optionKey: "B",
      contentHtml: "<p>Distractor synthetic option</p>",
      contentText: "Distractor synthetic option",
      isCorrect: 0,
      sortOrder: 1,
    },
  ] satisfies Array<typeof questionOptions.$inferInsert>);
}

function questionAttemptRows() {
  const rows: Array<typeof questionAttempts.$inferInsert> = [];
  for (const chapter of syntheticChapters) {
    for (let index = 0; index < chapter.mcq.total; index += 1) {
      const correct = index < chapter.mcq.correct;
      rows.push({
        id: id(`qa-${chapter.chapterNo}-${index + 1}`),
        questionId: id(`q-${chapter.chapterNo}-${index + 1}`),
        examSessionId: id(`exam-${chapter.chapterNo}`),
        selectedOptionId: id(`qo-${chapter.chapterNo}-${index + 1}-${correct ? "a" : "b"}`),
        correctOptionId: id(`qo-${chapter.chapterNo}-${index + 1}-a`),
        outcome: correct ? attemptOutcome.correct : attemptOutcome.incorrect,
        confidence: correct ? 4 : 2,
        timeSpentSeconds: 80 + index * 5,
        attemptedAt: NOW - (index % 7) * DAY - index * 60_000,
        metadataJson: JSON.stringify({ seed: PREFIX }) as unknown as Record<string, unknown>,
        createdAt: NOW - (index % 7) * DAY,
        originId: PREFIX,
      });
    }
  }
  return rows;
}

function flashcardRows() {
  const rows: Array<typeof flashcards.$inferInsert> = [];
  for (const chapter of syntheticChapters) {
    for (let index = 0; index < chapter.fsrs.total; index += 1) {
      const reviewed = index < chapter.fsrs.reviewed;
      const due = index < chapter.fsrs.due;
      const isOverdue = chapter.id.endsWith("overdue") && due;
      rows.push({
        id: id(`fc-${chapter.chapterNo}-${index + 1}`),
        chapterId: chapter.id,
        chapterNo: chapter.chapterNo,
        cardType: flashcardType.basic,
        createdFrom: flashcardCreatedFrom.manual,
        status: flashcardStatus.active,
        deck: "Dashboard smoke deck",
        frontHtml: `<p>${chapter.title} synthetic FSRS card ${index + 1}</p>`,
        backHtml: "<p>Dashboard smoke answer.</p>",
        tagsJson: JSON.stringify(["dashboard-smoke"]) as unknown as string[],
        sourceJson: JSON.stringify({ seed: PREFIX }) as unknown as Record<string, unknown>,
        fsrsStability: chapter.fsrs.stability,
        fsrsDifficulty: chapter.id.endsWith("strong") ? 3.2 : 7.2,
        fsrsElapsedDays: reviewed ? 2 : 0,
        fsrsScheduledDays: reviewed ? (chapter.id.endsWith("strong") ? 30 : 4) : 0,
        fsrsReps: reviewed ? 3 : 0,
        fsrsLapses: chapter.id.endsWith("overdue") ? 2 : 0,
        fsrsState: reviewed ? "review" : "new",
        fsrsLastReview: reviewed ? NOW - (chapter.fsrs.lastOffset ?? 1) * DAY : null,
        fsrsDue: due ? NOW - (isOverdue ? 2 * DAY : 60_000) : NOW + (index + 2) * DAY,
        intervalDays: reviewed ? (chapter.id.endsWith("strong") ? 30 : 4) : 0,
        isLeech: chapter.id.endsWith("overdue") && index === 0 ? 1 : 0,
        leechCount: chapter.id.endsWith("overdue") && index === 0 ? 8 : 0,
        importance: chapter.id.endsWith("overdue") ? 5 : 3,
        yieldScore: chapter.id.endsWith("overdue") ? 5 : 3,
        isSuspended: 0,
        isArchived: 0,
        isDeleted: 0,
        createdAt: NOW - 12 * DAY,
        updatedAt: NOW - index * 60_000,
        originId: PREFIX,
      });
    }
  }
  return rows;
}

function flashcardReviewRows() {
  const rows: Array<typeof flashcardReviews.$inferInsert> = [];
  for (const chapter of syntheticChapters) {
    for (let index = 0; index < chapter.fsrs.reviewed; index += 1) {
      const reviewedAt = NOW - (chapter.fsrs.lastOffset ?? 1) * DAY - index * 30_000;
      rows.push({
        id: id(`fr-${chapter.chapterNo}-${index + 1}`),
        flashcardId: id(`fc-${chapter.chapterNo}-${index + 1}`),
        rating: chapter.id.endsWith("strong") ? reviewRating.easy : index % 2 === 0 ? reviewRating.hard : reviewRating.good,
        state: "review",
        dueAt: NOW + (index + 1) * DAY,
        reviewedAt,
        elapsedDays: 1,
        scheduledDays: chapter.id.endsWith("strong") ? 30 : 4,
        stability: Math.round(chapter.fsrs.stability * 1000),
        difficulty: chapter.id.endsWith("strong") ? 3200 : 7200,
        retrievability: Math.round((chapter.fsrs.retention ?? 50) * 10),
        fsrsSnapshotJson: JSON.stringify({ seed: PREFIX }) as unknown as Record<string, unknown>,
        createdAt: reviewedAt,
        originId: PREFIX,
      });
    }
  }
  rows.push({
    id: id("fr-today-extra"),
    flashcardId: id("fc-902-1"),
    rating: reviewRating.hard,
    state: "review",
    dueAt: NOW + DAY,
    reviewedAt: NOW - 10 * 60_000,
    elapsedDays: 0,
    scheduledDays: 1,
    stability: 3000,
    difficulty: 7200,
    retrievability: 580,
    fsrsSnapshotJson: JSON.stringify({ seed: PREFIX }) as unknown as Record<string, unknown>,
    createdAt: NOW - 10 * 60_000,
    originId: PREFIX,
  });
  return rows;
}

function readerRows() {
  return syntheticChapters
    .filter((chapter) => chapter.reader.offset != null)
    .map((chapter) => {
      const startedAt = NOW - (chapter.reader.offset ?? 0) * DAY;
      return {
        id: id(`reader-${chapter.chapterNo}`),
        chapterId: chapter.id,
        startedAt,
        endedAt: startedAt + chapter.reader.durationSeconds * 1000,
        durationSeconds: chapter.reader.durationSeconds,
        progressPercent: chapter.reader.progress,
        metadataJson: JSON.stringify({ seed: PREFIX }) as unknown as Record<string, unknown>,
        createdAt: startedAt,
      } satisfies typeof chunkStudySessions.$inferInsert;
    });
}

function examRows() {
  return syntheticChapters
    .filter((chapter) => chapter.mcq.total > 0)
    .map((chapter, index) => ({
      id: id(`exam-${chapter.chapterNo}`),
      title: `${chapter.title} synthetic MCQ block`,
      mode: examMode.timed,
      status: examStatus.completed,
      questionPoolMode: questionPoolMode.custom,
      totalQuestions: chapter.mcq.total,
      selectedChapterIdsJson: JSON.stringify([chapter.id]) as unknown as string[],
      scorePercent: Math.round((chapter.mcq.correct / chapter.mcq.total) * 100),
      totalCorrect: chapter.mcq.correct,
      totalIncorrect: chapter.mcq.total - chapter.mcq.correct,
      totalOmitted: 0,
      startedAt: NOW - index * DAY - 90 * 60_000,
      completedAt: NOW - index * DAY - 30 * 60_000,
      elapsedSeconds: 3600,
      createdAt: NOW - index * DAY - 90 * 60_000,
      updatedAt: NOW - index * DAY - 30 * 60_000,
      originId: PREFIX,
    } satisfies typeof examSessions.$inferInsert));
}

function plannerRows() {
  const tasks: Array<typeof studyTasks.$inferInsert> = [
    {
      id: id("task-read"),
      planId: PLAN_ID,
      dayId: PLAN_DAY_ID,
      taskType: taskType.chapterRead,
      status: taskStatus.completed,
      title: "Read synthetic strong chapter",
      estimatedMinutes: 45,
      actualMinutes: 45,
      priority: 1,
      scheduledFor: TODAY,
      completedAt: NOW - 2 * 60 * 60_000,
      sourceType: taskSourceType.manual,
      originRefId: syntheticChapters[0].id,
      createdAt: NOW - DAY,
      updatedAt: NOW,
      originId: PREFIX,
    },
    {
      id: id("task-fsrs"),
      planId: PLAN_ID,
      dayId: PLAN_DAY_ID,
      taskType: taskType.flashcardReview,
      status: taskStatus.completed,
      title: "Review synthetic due cards",
      estimatedMinutes: 30,
      actualMinutes: 25,
      priority: 2,
      scheduledFor: TODAY,
      completedAt: NOW - 60 * 60_000,
      sourceType: taskSourceType.fsrsDue,
      originRefId: id("fc-902-1"),
      createdAt: NOW - DAY,
      updatedAt: NOW,
      originId: PREFIX,
    },
    {
      id: id("task-mcq"),
      planId: PLAN_ID,
      dayId: PLAN_DAY_ID,
      taskType: taskType.questionBlock,
      status: taskStatus.pending,
      title: "Synthetic weak MCQ remediation",
      estimatedMinutes: 40,
      priority: 2,
      scheduledFor: TODAY,
      sourceType: taskSourceType.weakArea,
      originRefId: syntheticChapters[1].id,
      createdAt: NOW - DAY,
      updatedAt: NOW,
      originId: PREFIX,
    },
    {
      id: id("task-overdue"),
      planId: PLAN_ID,
      dayId: PLAN_DAY_ID,
      taskType: taskType.weakAreaReview,
      status: taskStatus.overdue,
      title: "Synthetic overdue chapter rescue",
      estimatedMinutes: 35,
      priority: 2,
      scheduledFor: TODAY,
      dueAt: NOW - 2 * DAY,
      sourceType: taskSourceType.weakArea,
      originRefId: syntheticChapters[2].id,
      createdAt: NOW - 3 * DAY,
      updatedAt: NOW,
      originId: PREFIX,
    },
  ];

  return {
    plan: {
      id: PLAN_ID,
      title: "Dashboard Smoke Plan",
      description: "Synthetic dashboard wiring smoke plan.",
      status: planStatus.active,
      startDate: isoDateOffset(-7),
      endDate: isoDateOffset(30),
      selectedChapterIdsJson: JSON.stringify(syntheticChapters.map((chapter) => chapter.id)) as unknown as string[],
      goalJson: JSON.stringify({ seed: PREFIX }) as unknown as Record<string, unknown>,
      totalTasks: tasks.length,
      completedTasks: 2,
      progressPercent: 50,
      examDate: "2026-08-27",
      targetMode: targetMode.examPrep,
      dailyTimeBudgetMin: 120,
      createdAt: NOW - 7 * DAY,
      updatedAt: NOW,
    } satisfies typeof studyPlans.$inferInsert,
    day: {
      id: PLAN_DAY_ID,
      planId: PLAN_ID,
      date: TODAY,
      dayOfWeek: "sunday",
      label: "Dashboard smoke day",
      totalTasks: tasks.length,
      completedTasks: 2,
      estimatedMinutes: 150,
      actualMinutes: 70,
      targetMinutes: 120,
      assignedMinutes: 150,
      completedMinutes: 70,
      status: planDayStatus.partial,
      createdAt: NOW - DAY,
      updatedAt: NOW,
    } satisfies typeof studyPlanDays.$inferInsert,
    settings: {
      id: SETTINGS_ID,
      defaultPlanId: PLAN_ID,
      dailyGoalMinutes: 120,
      streakCurrent: 14,
      streakLongest: 21,
      lastStudyDate: TODAY,
      preferencesJson: JSON.stringify({ seed: PREFIX }) as unknown as Record<string, unknown>,
      userId: USER_ID,
      createdAt: NOW - 7 * DAY,
      updatedAt: NOW,
    } satisfies typeof studyPlannerSettings.$inferInsert,
    tasks,
  };
}

function conceptRows() {
  return syntheticChapters.slice(0, 3).map((chapter, index) => ({
    id: id(`concept-${index + 1}`),
    userId: USER_ID,
    conceptId: `${chapter.id}-concept`,
    masteryScore: index === 0 ? 88 : index === 1 ? 46 : 34,
    questionAccuracy: chapter.mcq.total > 0 ? Math.round((chapter.mcq.correct / chapter.mcq.total) * 100) : 0,
    flashcardRetention: chapter.fsrs.retention ?? 0,
    recencyScore: index === 0 ? 90 : 40,
    exposureCount: chapter.mcq.total + chapter.fsrs.total,
    lastReviewedAt: NOW - index * DAY,
    createdAt: NOW - 7 * DAY,
    updatedAt: NOW,
  } satisfies typeof conceptMastery.$inferInsert));
}

function chapterRows() {
  return syntheticChapters.map((chapter) => ({
    id: chapter.id,
    volumeNo: chapter.volumeNo,
    partNo: 99,
    partTitle: chapter.partTitle,
    sectionTitle: "Synthetic dashboard wiring",
    chapterNo: chapter.chapterNo,
    title: chapter.title,
    slug: chapter.id,
    pageStart: chapter.pageStart,
    pageEnd: chapter.pageEnd,
    sourceBook: "Dashboard Smoke",
    sourceEdition: "synthetic",
    createdAt: NOW,
    updatedAt: NOW,
  } satisfies typeof chapters.$inferInsert));
}

function chapterProgressRows() {
  return syntheticChapters.map((chapter) => ({
    chapterNo: chapter.chapterNo,
    status: chapter.id.endsWith("strong") ? chapterProgressStatus.mastered : chapterProgressStatus.reading,
    readCount: chapter.reader.progress > 0 ? 1 : 0,
    lastReadAt: chapter.reader.offset == null ? null : NOW - chapter.reader.offset * DAY,
    qAttempted: chapter.mcq.total,
    qCorrect: chapter.mcq.correct,
    originId: PREFIX,
  } satisfies typeof chapterProgress.$inferInsert));
}

async function applySeed() {
  await assertSafeRuntime();
  const db = await getSeedDb();
  const qRows = questionRows();
  const planner = plannerRows();

  await db.transaction(async (tx) => {
    await cleanupRows(tx);

    await tx.insert(chapters).values(chapterRows());

    await tx.insert(questions).values(qRows);
    await tx.insert(questionOptions).values(questionOptionRows());
    await tx.insert(examSessions).values(examRows());
    await tx.insert(questionAttempts).values(questionAttemptRows());
    await tx.insert(flashcards).values(flashcardRows());
    await tx.insert(flashcardReviews).values(flashcardReviewRows());
    await tx.insert(chunkStudySessions).values(readerRows());
    await tx.insert(chapterProgress).values(chapterProgressRows());
    await tx.insert(studyPlans).values(planner.plan);
    await tx.insert(studyPlanDays).values(planner.day);
    await tx.insert(studyPlannerSettings).values(planner.settings);
    await tx.insert(studyTasks).values(planner.tasks);
    await tx.insert(conceptMastery).values(conceptRows());
  });

  console.log(`Applied ${PREFIX} synthetic dashboard dataset.`);
}

async function applyNeonSeed() {
  await assertSafeRuntime({ allowPostgres: true });
  const db = await getSeedDb();
  const qRows = questionRows();
  const planner = plannerRows();

  await db.transaction(async (tx) => {
    await upsertRows(tx, chapters, chapterRows(), chapters.id);
    await upsertRows(tx, questions, qRows, questions.id);
    await upsertRows(tx, questionOptions, questionOptionRows(), questionOptions.id);
    await upsertRows(tx, examSessions, examRows(), examSessions.id);
    await upsertRows(tx, questionAttempts, questionAttemptRows(), questionAttempts.id);
    await upsertRows(tx, flashcards, flashcardRows(), flashcards.id);
    await upsertRows(tx, flashcardReviews, flashcardReviewRows(), flashcardReviews.id);
    await upsertRows(tx, chunkStudySessions, readerRows(), chunkStudySessions.id);
    await upsertRows(tx, chapterProgress, chapterProgressRows(), chapterProgress.chapterNo);
    await upsertRows(tx, studyPlans, [planner.plan], studyPlans.id);
    await upsertRows(tx, studyPlanDays, [planner.day], studyPlanDays.id);
    await upsertRows(tx, studyPlannerSettings, [planner.settings], studyPlannerSettings.id);
    await upsertRows(tx, studyTasks, planner.tasks, studyTasks.id);
    await upsertRows(tx, conceptMastery, conceptRows(), conceptMastery.id);
  });

  console.log(`Applied ${PREFIX} synthetic dashboard dataset to Neon.`);
}

function assertSlice(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function verifySeed() {
  await assertSafeRuntime();
  const { getHostedDashboardLiteData } = await import("@/lib/dashboard/lite-queries");
  const { countDueFlashcards } = await import("@/lib/flashcards/queries");
  const { listManagedDueFlashcards } = await import("@/lib/services/flashcard-service");
  const [stats, dueCards, totalDue] = await Promise.all([
    getHostedDashboardLiteData(),
    listManagedDueFlashcards(4),
    countDueFlashcards(),
  ]);

  const syntheticChapterIds = new Set(syntheticChapters.map((chapter) => chapter.id));
  assertSlice(stats.chapterPerformance.some((row) => syntheticChapterIds.has(row.chapterId)), "Missing synthetic chapter performance.");
  assertSlice(stats.fsrsStatsByChapter.some((row) => syntheticChapterIds.has(row.chapterId) && row.dueCards > 0), "Missing synthetic FSRS due stats.");
  assertSlice(stats.readerStatsByChapter.some((row) => syntheticChapterIds.has(row.chapterId) && row.readPercent > 0), "Missing synthetic reader stats.");
  assertSlice(stats.weeklyActivity.length > 0, "Missing weekly activity.");
  assertSlice(stats.monthlyActivity.some((row) => row.questionsAnswered > 0 || row.cardsReviewed > 0 || row.minutesStudied > 0), "Missing monthly activity.");
  assertSlice(stats.activityFeed.some((row) => row.id.startsWith(PREFIX)), "Missing synthetic activity feed.");
  assertSlice((stats.domainMastery.domainMastery ?? []).some((row) => row.domain.includes(PREFIX)), "Missing synthetic concept mastery.");
  assertSlice(stats.planner.todayTasks >= 3, "Missing synthetic planner tasks.");
  assertSlice(stats.plannerDetailedStats.todayTasks >= 3, "Missing synthetic planner detail.");
  assertSlice(totalDue >= 1, "Expected at least one due synthetic flashcard.");
  assertSlice(dueCards.some((card) => card.id.startsWith(`${PREFIX}-fc-`)), "Review queue did not include synthetic due cards.");

  console.log("Dashboard synthetic verification passed.");
  console.log(
    JSON.stringify(
      {
        chapterPerformance: stats.chapterPerformance.filter((row) => syntheticChapterIds.has(row.chapterId)).length,
        dueCards: totalDue,
        reviewQueue: dueCards.map((card) => card.id),
        weeklyActivity: stats.weeklyActivity.length,
        monthlyActivity: stats.monthlyActivity.filter((row) => row.questionsAnswered || row.cardsReviewed || row.minutesStudied).length,
        activityFeed: stats.activityFeed.filter((row) => row.id.startsWith(PREFIX)).length,
        plannerTodayTasks: stats.plannerDetailedStats.todayTasks,
      },
      null,
      2,
    ),
  );
}

async function cleanupSeed() {
  await assertSafeRuntime();
  const db = await getSeedDb();
  await db.transaction(async (tx) => {
    await cleanupRows(tx);
  });
  console.log(`Cleaned ${PREFIX} synthetic dashboard dataset.`);
}

async function cleanupNeonSeed() {
  await assertSafeRuntime({ allowPostgres: true });
  const db = await getSeedDb();
  await db.transaction(async (tx) => {
    await cleanupRows(tx);
  });
  console.log(`Cleaned ${PREFIX} synthetic dashboard dataset from Neon.`);
}

async function main() {
  const command = COMMAND;
  if (!["apply", "verify", "cleanup", "apply-neon", "cleanup-neon"].includes(command)) {
    throw new Error("Usage: npx tsx --tsconfig tsconfig.json scripts/seed-dashboard-cards.ts <apply|verify|cleanup|apply-neon|cleanup-neon>");
  }

  if (command === "apply") await applySeed();
  if (command === "apply-neon") await applyNeonSeed();
  if (command === "verify") await verifySeed();
  if (command === "cleanup") await cleanupSeed();
  if (command === "cleanup-neon") await cleanupNeonSeed();
}

function cleanupPGliteLock() {
  try {
    const location = process.env.PGLITE_DATA_DIR ?? process.env.PGLITE_DB_PATH ?? join(process.cwd(), ".pglite", "starship");
    const pid = join(location, "postmaster.pid");
    if (existsSync(pid)) rmSync(pid);
  } catch {
    // Best-effort only; the next PGlite bootstrap can still recover.
  }
}

main()
  .then(() => {
    cleanupPGliteLock();
    process.exit(0);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    cleanupPGliteLock();
    process.exit(1);
  });
