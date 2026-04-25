// src/lib/exam/pg-exam-queries.ts
// Async Drizzle exam queries. All functions use await getDb().

import { getDb } from '@/db/index';
import { eq, asc, desc, and, inArray, sql } from 'drizzle-orm';
import {
  examSessions,
  examSessionQuestions,
  questionAttempts,
  questions,
  questionOptions,
  chapters,
  questionBookmarks,
  flashcards,
  flashcardType,
  flashcardCreatedFrom,
  flashcardStatus,
} from '@/db/schema';
import type {
  ActiveQuestion,
  QuestionResult,
  ExamScore,
  SubjectBreakdown,
  ExamSessionSummary,
  VolumeBreakdown,
  PartBreakdown,
  QuestionOption,
} from '@/types/exam';
import {
  getCampbellChapterById,
  getPartForChapter,
  getVolumeForChapter,
} from './campbell-hierarchy';
import { shuffleOptionsForSessionQuestion } from './option-shuffle';

// Per-session-question shuffle key. Stable so refresh keeps the same layout,
// but independent of the stored correctness key so any positional bias in
// the source corpus is no longer visible to the user.
function optionShuffleKey(examSessionId: string, sessionQuestionId: string): string {
  return `opt|${examSessionId}|${sessionQuestionId}`;
}

// ─── Re-export DB row types ──────────────────────────────────────
export type ExamSession = typeof examSessions.$inferSelect;
export type ExamSessionQuestion = typeof examSessionQuestions.$inferSelect;
export type ExamSessionInsert = typeof examSessions.$inferInsert;

// ─── Utilities ───────────────────────────────────────────────────
function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Helpers to build QuestionResult from DB rows ────────────────
interface RawResultData {
  sq: typeof examSessionQuestions.$inferSelect;
  q: typeof questions.$inferSelect | undefined;
  opts: Array<typeof questionOptions.$inferSelect>;
}

function buildQuestionResult(data: RawResultData): QuestionResult {
  const { sq, q, opts } = data;
  const correctOptId = sq.correctOptionId ?? '';
  const selectedOptId = sq.selectedOptionId ?? null;
  // Shuffle display order per session-question. Identity-based correctness
  // is preserved; we only change what the user sees, not what is scored.
  const displayOpts = shuffleOptionsForSessionQuestion(
    opts,
    optionShuffleKey(sq.examSessionId, sq.id),
  );
  const correctIndex = displayOpts.findIndex((o) => o.id === correctOptId);

  // Look up Campbell hierarchy metadata
  const chapterId = q?.chapterId ?? null;
  const hierChapter = chapterId ? getCampbellChapterById(chapterId) : undefined;
  const hierPart = chapterId ? getPartForChapter(chapterId) : undefined;
  const hierVolume = chapterId ? getVolumeForChapter(chapterId) : undefined;

  const chapterNo = hierChapter?.chapterNo ?? null;
  const chapterTitle = hierChapter?.title ?? null;
  const partId = hierPart?.id ?? null;
  const partLabel = hierPart?.label ?? null;
  const volNoMatch = hierVolume?.id?.match(/^vol-(\d+)$/);
  const volumeNo = volNoMatch ? parseInt(volNoMatch[1], 10) : null;

  const outcome = (sq.outcome as 'correct' | 'incorrect' | 'omitted' | null) ?? null;

  // Reassign display letter from the (possibly shuffled) position so that
  // "A/B/C/D" always reflects the on-screen slot, not the stored optionKey.
  const qOptions: QuestionOption[] = displayOpts.map((o, idx) => ({
    id: o.id,
    key: String.fromCharCode(65 + idx),
    contentHtml: o.contentHtml,
    contentText: o.contentText ?? o.contentHtml,
    isCorrect: o.isCorrect === 1,
  }));

  return {
    orderIndex: sq.orderIndex,
    sessionQuestionId: sq.id,
    questionId: sq.questionId,
    stemHtml: sq.stemHtmlSnapshot ?? q?.stemHtml ?? '',
    explanationHtml: sq.explanationHtmlSnapshot ?? null,
    options: qOptions,
    selectedOptionId: selectedOptId,
    correctOptionId: correctOptId || null,
    outcome,
    isMarked: sq.isMarked === 1,
    timeSpentSeconds: sq.timeSpentSeconds ?? 0,
    // Campbell metadata
    chapterId,
    chapterNo,
    chapterTitle,
    partId,
    partLabel,
    volumeNo,
    difficulty: q?.difficulty ?? null,
    subject: q?.subject ?? null,
    // Convenience helpers
    isCorrect: outcome === 'correct',
    flagged: sq.isMarked === 1,
    userAnswer: selectedOptId,
    correctIndex: correctIndex >= 0 ? correctIndex : 0,
    // Legacy compat fields
    questionText: q?.stemText ?? (q?.stemHtml?.replace(/<[^>]+>/g, '') ?? ''),
    explanation: sq.explanationHtmlSnapshot ?? undefined,
  };
}

// ─── Session CRUD ─────────────────────────────────────────────────

export async function createExamSession(data: ExamSessionInsert): Promise<ExamSession> {
  const db = await getDb();
  const result = await db.insert(examSessions).values(data).returning();
  return result[0];
}

export async function getExamSessionById(id: string): Promise<ExamSession | undefined> {
  const db = await getDb();
  const rows = await db.select().from(examSessions).where(eq(examSessions.id, id)).limit(1);
  return rows[0];
}

export async function updateExamSession(
  id: string,
  data: Partial<ExamSession>,
): Promise<ExamSession | undefined> {
  const db = await getDb();
  const result = await db
    .update(examSessions)
    .set({ ...data, updatedAt: Date.now() })
    .where(eq(examSessions.id, id))
    .returning();
  return result[0];
}

export async function listExamSessions(opts?: {
  status?: string;
  limit?: number;
}): Promise<ExamSessionSummary[]> {
  const db = await getDb();
  let query = db
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
      startedAt: examSessions.startedAt,
      completedAt: examSessions.completedAt,
      elapsedSeconds: examSessions.elapsedSeconds,
    })
    .from(examSessions)
    .orderBy(desc(examSessions.startedAt))
    .$dynamic();

  if (opts?.status) {
    query = query.where(eq(examSessions.status, opts.status as 'active' | 'suspended' | 'completed' | 'abandoned')) as typeof query;
  }
  if (opts?.limit) {
    query = query.limit(opts.limit) as typeof query;
  }

  const rows = await query;
  return rows.map((r) => ({
    ...r,
    mode: r.mode as 'study' | 'tutor' | 'timed' | 'untimed',
    status: r.status as 'active' | 'suspended' | 'completed' | 'abandoned',
    scorePercent: r.scorePercent ?? null,
    completedAt: r.completedAt ?? null,
    totalCorrect: r.totalCorrect ?? 0,
    totalIncorrect: r.totalIncorrect ?? 0,
    totalOmitted: r.totalOmitted ?? 0,
    elapsedSeconds: r.elapsedSeconds ?? 0,
  }));
}

export async function deleteExamSession(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(examSessions).where(eq(examSessions.id, id));
}

// ─── Session Questions ────────────────────────────────────────────

export async function addQuestionsToSession(
  items: Array<typeof examSessionQuestions.$inferInsert>,
): Promise<void> {
  const db = await getDb();
  if (items.length === 0) return;
  await db.insert(examSessionQuestions).values(items);
}

export async function listSessionQuestions(
  examSessionId: string,
): Promise<ExamSessionQuestion[]> {
  const db = await getDb();
  return db
    .select()
    .from(examSessionQuestions)
    .where(eq(examSessionQuestions.examSessionId, examSessionId))
    .orderBy(asc(examSessionQuestions.orderIndex));
}

export async function getSessionQuestionByIndex(
  examSessionId: string,
  orderIndex: number,
): Promise<ExamSessionQuestion | undefined> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(examSessionQuestions)
    .where(
      and(
        eq(examSessionQuestions.examSessionId, examSessionId),
        eq(examSessionQuestions.orderIndex, orderIndex),
      ),
    )
    .limit(1);
  return rows[0];
}

export async function updateSessionQuestion(
  id: string,
  data: Partial<ExamSessionQuestion>,
): Promise<ExamSessionQuestion | undefined> {
  const db = await getDb();
  const result = await db
    .update(examSessionQuestions)
    .set(data)
    .where(eq(examSessionQuestions.id, id))
    .returning();
  return result[0];
}

export async function submitAnswer(params: {
  sessionQuestionId: string;
  selectedOptionId: string;
  correctOptionId: string;
  timeSpentSeconds: number;
  examSessionId: string;
  questionId: string;
}): Promise<ExamSessionQuestion> {
  const db = await getDb();
  const now = Date.now();

  const outcome: 'correct' | 'incorrect' =
    params.selectedOptionId === params.correctOptionId ? 'correct' : 'incorrect';

  const result = await db
    .update(examSessionQuestions)
    .set({
      selectedOptionId: params.selectedOptionId,
      outcome,
      isSubmitted: 1,
      timeSpentSeconds: params.timeSpentSeconds,
      answeredAt: now,
    })
    .where(eq(examSessionQuestions.id, params.sessionQuestionId))
    .returning();

  // Record question attempt
  await db.insert(questionAttempts).values({
    id: makeId('att'),
    questionId: params.questionId,
    examSessionId: params.examSessionId,
    selectedOptionId: params.selectedOptionId,
    correctOptionId: params.correctOptionId,
    outcome,
    timeSpentSeconds: params.timeSpentSeconds,
    attemptedAt: now,
    createdAt: now,
  });

  return result[0];
}

export async function finalizeExamSession(sessionId: string): Promise<ExamSession | undefined> {
  const db = await getDb();
  const now = Date.now();

  // Mark unanswered as omitted
  await db
    .update(examSessionQuestions)
    .set({ outcome: 'omitted', isSubmitted: 1, answeredAt: now })
    .where(
      and(
        eq(examSessionQuestions.examSessionId, sessionId),
        eq(examSessionQuestions.isSubmitted, 0),
      ),
    );

  // Count outcomes
  const sqRows = await db
    .select({
      outcome: examSessionQuestions.outcome,
    })
    .from(examSessionQuestions)
    .where(eq(examSessionQuestions.examSessionId, sessionId));

  let correct = 0;
  let incorrect = 0;
  let omitted = 0;
  for (const r of sqRows) {
    if (r.outcome === 'correct') correct++;
    else if (r.outcome === 'incorrect') incorrect++;
    else omitted++;
  }
  const total = sqRows.length;
  const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;

  const result = await db
    .update(examSessions)
    .set({
      status: 'completed',
      completedAt: now,
      totalCorrect: correct,
      totalIncorrect: incorrect,
      totalOmitted: omitted,
      scorePercent,
      updatedAt: now,
    })
    .where(eq(examSessions.id, sessionId))
    .returning();

  return result[0];
}

export async function getSessionProgress(sessionId: string): Promise<{
  total: number;
  answered: number;
  remaining: number;
  marked: number;
}> {
  const db = await getDb();
  const rows = await db
    .select({
      isSubmitted: examSessionQuestions.isSubmitted,
      isMarked: examSessionQuestions.isMarked,
    })
    .from(examSessionQuestions)
    .where(eq(examSessionQuestions.examSessionId, sessionId));

  const total = rows.length;
  const answered = rows.filter((r) => r.isSubmitted === 1).length;
  const marked = rows.filter((r) => r.isMarked === 1).length;
  return { total, answered, remaining: total - answered, marked };
}

// ─── Question Queries ─────────────────────────────────────────────

export async function listQuestions(params: {
  chapterIds?: string[];
  pool?: 'all' | 'unused' | 'incorrect' | 'marked' | 'bookmarked';
  difficulty?: string;
  limit?: number;
}): Promise<Array<{ id: string; chapterId: string; difficulty: string | null; subject: string | null }>> {
  const db = await getDb();

  // Resolve chapter DB IDs from "ch-N" hierarchy IDs
  let chapterDbIds: string[] = [];
  if (params.chapterIds && params.chapterIds.length > 0) {
    const chapterNos = params.chapterIds
      .map((id) => {
        const m = id.match(/^ch-(\d+)$/);
        return m ? parseInt(m[1], 10) : null;
      })
      .filter((n): n is number => n !== null);

    if (chapterNos.length > 0) {
      const dbChapters = await db
        .select({ id: chapters.id })
        .from(chapters)
        .where(inArray(chapters.chapterNo, chapterNos));
      chapterDbIds = dbChapters.map((c) => c.id);
    }
  }

  const baseCondition =
    chapterDbIds.length > 0
      ? and(eq(questions.isActive, 1), inArray(questions.chapterId, chapterDbIds))
      : eq(questions.isActive, 1);

  let baseRows = await db
    .select({ id: questions.id, chapterId: questions.chapterId, difficulty: questions.difficulty, subject: questions.subject })
    .from(questions)
    .where(baseCondition);

  // Apply pool filter
  const pool = params.pool ?? 'all';

  if (pool === 'unused' && baseRows.length > 0) {
    const ids = baseRows.map((r) => r.id);
    const attemptedRows = await db
      .select({ qid: questionAttempts.questionId })
      .from(questionAttempts)
      .where(inArray(questionAttempts.questionId, ids));
    const attemptedSet = new Set(attemptedRows.map((r) => r.qid));
    baseRows = baseRows.filter((q) => !attemptedSet.has(q.id));
  } else if (pool === 'incorrect' && baseRows.length > 0) {
    const ids = baseRows.map((r) => r.id);
    const attemptRows = await db
      .select({
        questionId: questionAttempts.questionId,
        outcome: questionAttempts.outcome,
        attemptedAt: questionAttempts.attemptedAt,
      })
      .from(questionAttempts)
      .where(inArray(questionAttempts.questionId, ids))
      .orderBy(desc(questionAttempts.attemptedAt));

    const latestOutcome = new Map<string, string>();
    for (const row of attemptRows) {
      if (!latestOutcome.has(row.questionId)) {
        latestOutcome.set(row.questionId, row.outcome);
      }
    }
    baseRows = baseRows.filter((q) => latestOutcome.get(q.id) === 'incorrect');
  } else if ((pool === 'marked' || pool === 'bookmarked') && baseRows.length > 0) {
    const ids = baseRows.map((r) => r.id);
    const bookmarkRows = await db
      .select({ questionId: questionBookmarks.questionId })
      .from(questionBookmarks)
      .where(inArray(questionBookmarks.questionId, ids));
    const bookmarkedSet = new Set(bookmarkRows.map((r) => r.questionId));
    baseRows = baseRows.filter((q) => bookmarkedSet.has(q.id));
  }

  if (params.difficulty) {
    baseRows = baseRows.filter((q) => q.difficulty === params.difficulty);
  }

  if (params.limit && params.limit > 0) {
    baseRows = baseRows.slice(0, params.limit);
  }

  return baseRows;
}

export async function getQuestionWithOptions(id: string): Promise<
  | {
      id: string;
      stemHtml: string;
      explanationHtml: string | null;
      chapterId: string;
      difficulty: string | null;
      subject: string | null;
      correctOptionId: string | null;
      options: QuestionOption[];
    }
  | undefined
> {
  const db = await getDb();
  const qRows = await db.select().from(questions).where(eq(questions.id, id)).limit(1);
  if (qRows.length === 0) return undefined;
  const q = qRows[0];

  const optRows = await db
    .select()
    .from(questionOptions)
    .where(eq(questionOptions.questionId, id))
    .orderBy(asc(questionOptions.sortOrder));

  const options: QuestionOption[] = optRows.map((o) => ({
    id: o.id,
    key: o.optionKey,
    contentHtml: o.contentHtml,
    contentText: o.contentText ?? o.contentHtml,
    isCorrect: o.isCorrect === 1,
  }));

  return {
    id: q.id,
    stemHtml: q.stemHtml,
    explanationHtml: q.explanationHtml ?? null,
    chapterId: q.chapterId,
    difficulty: q.difficulty ?? null,
    subject: q.subject ?? null,
    correctOptionId: q.correctOptionId ?? null,
    options,
  };
}

// ─── Session Detail ───────────────────────────────────────────────

export async function getSessionDetail(sessionId: string): Promise<{
  session: ExamSession;
  questions: QuestionResult[];
} | null> {
  const db = await getDb();

  const sessionRows = await db
    .select()
    .from(examSessions)
    .where(eq(examSessions.id, sessionId))
    .limit(1);
  if (sessionRows.length === 0) return null;
  const session = sessionRows[0];

  const sqRows = await db
    .select()
    .from(examSessionQuestions)
    .where(eq(examSessionQuestions.examSessionId, sessionId))
    .orderBy(asc(examSessionQuestions.orderIndex));

  if (sqRows.length === 0) return { session, questions: [] };

  const questionIds = sqRows.map((sq) => sq.questionId);
  const qRows = await db.select().from(questions).where(inArray(questions.id, questionIds));
  const optRows = await db
    .select()
    .from(questionOptions)
    .where(inArray(questionOptions.questionId, questionIds))
    .orderBy(asc(questionOptions.sortOrder));

  const qById = new Map(qRows.map((q) => [q.id, q]));
  const optsByQuestion = new Map<string, typeof optRows>();
  for (const o of optRows) {
    if (!optsByQuestion.has(o.questionId)) optsByQuestion.set(o.questionId, []);
    optsByQuestion.get(o.questionId)!.push(o);
  }

  const resultQuestions: QuestionResult[] = sqRows.map((sq) =>
    buildQuestionResult({
      sq,
      q: qById.get(sq.questionId),
      opts: optsByQuestion.get(sq.questionId) ?? [],
    }),
  );

  return { session, questions: resultQuestions };
}

// ─── Results by chapter ───────────────────────────────────────────

export async function getResultsByChapter(sessionId: string): Promise<
  Array<{
    chapterId: string | null;
    chapterTitle: string | null;
    chapterNo: number | null;
    volumeNo: number | null;
    partLabel: string | null;
    total: number;
    correct: number;
    incorrect: number;
    omitted: number;
    accuracy: number;
  }>
> {
  const detail = await getSessionDetail(sessionId);
  if (!detail) return [];

  const byChapter = new Map<
    string,
    {
      chapterId: string | null;
      chapterTitle: string | null;
      chapterNo: number | null;
      volumeNo: number | null;
      partLabel: string | null;
      results: QuestionResult[];
    }
  >();

  for (const r of detail.questions) {
    const key = r.chapterId ?? '__unknown__';
    if (!byChapter.has(key)) {
      byChapter.set(key, {
        chapterId: r.chapterId,
        chapterTitle: r.chapterTitle,
        chapterNo: r.chapterNo,
        volumeNo: r.volumeNo,
        partLabel: r.partLabel,
        results: [],
      });
    }
    byChapter.get(key)!.results.push(r);
  }

  return Array.from(byChapter.values()).map((ch) => {
    const total = ch.results.length;
    const correct = ch.results.filter((r) => r.outcome === 'correct').length;
    const incorrect = ch.results.filter((r) => r.outcome === 'incorrect').length;
    const omitted = ch.results.filter((r) => r.outcome === 'omitted' || r.outcome === null).length;
    return {
      chapterId: ch.chapterId,
      chapterTitle: ch.chapterTitle,
      chapterNo: ch.chapterNo,
      volumeNo: ch.volumeNo,
      partLabel: ch.partLabel,
      total,
      correct,
      incorrect,
      omitted,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
    };
  });
}

// ─── Bookmarks ────────────────────────────────────────────────────

export async function toggleBookmark(questionId: string): Promise<boolean> {
  const db = await getDb();
  const existing = await db
    .select({ questionId: questionBookmarks.questionId })
    .from(questionBookmarks)
    .where(eq(questionBookmarks.questionId, questionId))
    .limit(1);

  if (existing.length > 0) {
    await db.delete(questionBookmarks).where(eq(questionBookmarks.questionId, questionId));
    return false;
  } else {
    await db.insert(questionBookmarks).values({ questionId, createdAt: Date.now() });
    return true;
  }
}

export async function isBookmarked(questionId: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .select({ questionId: questionBookmarks.questionId })
    .from(questionBookmarks)
    .where(eq(questionBookmarks.questionId, questionId))
    .limit(1);
  return rows.length > 0;
}

// ─── Flashcard from question ──────────────────────────────────────

export async function createFlashcardFromQuestion(params: {
  questionId: string;
  examSessionId?: string;
  front: string;
  back: string;
  subject?: string;
  deck?: string;
}): Promise<string> {
  const db = await getDb();
  const now = Date.now();
  const id = makeId('fc');

  await db.insert(flashcards).values({
    id,
    sourceQuestionId: params.questionId,
    cardType: flashcardType.basic,
    createdFrom: flashcardCreatedFrom.question,
    status: flashcardStatus.active,
    frontHtml: params.front,
    backHtml: params.back,
    deck: params.deck ?? 'Exam Questions',
    fsrsStability: 0,
    fsrsDifficulty: 0,
    fsrsElapsedDays: 0,
    fsrsScheduledDays: 0,
    fsrsReps: 0,
    fsrsLapses: 0,
    fsrsState: 'new',
    learningStep: 0,
    easeFactor: 2.5,
    intervalDays: 0,
    isLeech: 0,
    leechCount: 0,
    isBuried: 0,
    importance: 5,
    isSuspended: 0,
    isArchived: 0,
    createdAt: now,
    updatedAt: now,
  });

  return id;
}

// ─── Session state (active exam view) ────────────────────────────

export async function pgGetSessionState(sessionId: string): Promise<{
  session: ExamSession;
  questions: ActiveQuestion[];
} | null> {
  const db = await getDb();

  const sessionRows = await db
    .select()
    .from(examSessions)
    .where(eq(examSessions.id, sessionId))
    .limit(1);
  if (sessionRows.length === 0) return null;
  const session = sessionRows[0];

  const sqRows = await db
    .select()
    .from(examSessionQuestions)
    .where(eq(examSessionQuestions.examSessionId, sessionId))
    .orderBy(asc(examSessionQuestions.orderIndex));

  if (sqRows.length === 0) return { session, questions: [] };

  const questionIds = sqRows.map((sq) => sq.questionId);
  const qRows = await db.select().from(questions).where(inArray(questions.id, questionIds));
  const optRows = await db
    .select()
    .from(questionOptions)
    .where(inArray(questionOptions.questionId, questionIds))
    .orderBy(asc(questionOptions.sortOrder));

  const qById = new Map(qRows.map((q) => [q.id, q]));
  const optsByQuestion = new Map<string, typeof optRows>();
  for (const o of optRows) {
    if (!optsByQuestion.has(o.questionId)) optsByQuestion.set(o.questionId, []);
    optsByQuestion.get(o.questionId)!.push(o);
  }

  const isTutor = session.mode === 'tutor';

  const activeQuestions: ActiveQuestion[] = sqRows.map((sq) => {
    const rawOpts = optsByQuestion.get(sq.questionId) ?? [];
    const opts = shuffleOptionsForSessionQuestion(
      rawOpts,
      optionShuffleKey(sq.examSessionId, sq.id),
    );
    const isSubmitted = sq.isSubmitted === 1;

    return {
      orderIndex: sq.orderIndex,
      sessionQuestionId: sq.id,
      questionId: sq.questionId,
      stemHtml: sq.stemHtmlSnapshot ?? qById.get(sq.questionId)?.stemHtml ?? '',
      options: opts.map((o, idx) => ({
        id: o.id,
        key: String.fromCharCode(65 + idx),
        contentHtml: o.contentHtml,
        contentText: o.contentText ?? o.contentHtml,
        isCorrect: isSubmitted || isTutor ? o.isCorrect === 1 : undefined,
      })),
      isMarked: sq.isMarked === 1,
      isSubmitted,
      selectedOptionId: sq.selectedOptionId ?? null,
      outcome: (sq.outcome as 'correct' | 'incorrect' | 'omitted' | null) ?? null,
      timeSpentSeconds: sq.timeSpentSeconds ?? 0,
      // In tutor mode or after submission, reveal explanation and correct answer
      ...(isSubmitted || isTutor
        ? {
            explanationHtml: sq.explanationHtmlSnapshot ?? undefined,
            correctOptionId: sq.correctOptionId ?? undefined,
          }
        : {}),
    };
  });

  return { session, questions: activeQuestions };
}

// ─── Create exam (question selection + session creation) ──────────

export async function pgCreateExamSession(params: {
  title?: string;
  mode: string;
  questionPoolMode: string;
  chapterIds: string[];
  questionCount: number;
}): Promise<{ sessionId: string; questions: ActiveQuestion[] }> {
  const db = await getDb();
  const now = Date.now();

  // Resolve chapter DB IDs from hierarchy IDs ("ch-N")
  let chapterDbIds: string[] = [];
  if (params.chapterIds.length > 0) {
    const chapterNos = params.chapterIds
      .map((id) => {
        const m = id.match(/^ch-(\d+)$/);
        return m ? parseInt(m[1], 10) : null;
      })
      .filter((n): n is number => n !== null);

    if (chapterNos.length > 0) {
      const dbChapters = await db
        .select({ id: chapters.id, chapterNo: chapters.chapterNo })
        .from(chapters)
        .where(inArray(chapters.chapterNo, chapterNos));
      chapterDbIds = dbChapters.map((c) => c.id);
    }
  }

  // Get candidate question IDs
  let candidateIds: string[] = [];
  if (chapterDbIds.length > 0) {
    const rows = await db
      .select({ id: questions.id })
      .from(questions)
      .where(and(eq(questions.isActive, 1), inArray(questions.chapterId, chapterDbIds)));
    candidateIds = rows.map((r) => r.id);
  } else {
    const rows = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.isActive, 1));
    candidateIds = rows.map((r) => r.id);
  }

  // Apply pool filter
  const poolMode = params.questionPoolMode;
  if (poolMode === 'unused' && candidateIds.length > 0) {
    const attemptedRows = await db
      .select({ questionId: questionAttempts.questionId })
      .from(questionAttempts)
      .where(inArray(questionAttempts.questionId, candidateIds));
    const attemptedSet = new Set(attemptedRows.map((r) => r.questionId));
    candidateIds = candidateIds.filter((id) => !attemptedSet.has(id));
  } else if (poolMode === 'incorrect' && candidateIds.length > 0) {
    const attemptRows = await db
      .select({
        questionId: questionAttempts.questionId,
        outcome: questionAttempts.outcome,
        attemptedAt: questionAttempts.attemptedAt,
      })
      .from(questionAttempts)
      .where(inArray(questionAttempts.questionId, candidateIds))
      .orderBy(desc(questionAttempts.attemptedAt));
    const latestOutcome = new Map<string, string>();
    for (const row of attemptRows) {
      if (!latestOutcome.has(row.questionId)) latestOutcome.set(row.questionId, row.outcome);
    }
    candidateIds = candidateIds.filter((id) => latestOutcome.get(id) === 'incorrect');
  } else if ((poolMode === 'marked' || poolMode === 'bookmarked') && candidateIds.length > 0) {
    const bookmarkRows = await db
      .select({ questionId: questionBookmarks.questionId })
      .from(questionBookmarks)
      .where(inArray(questionBookmarks.questionId, candidateIds));
    const bookmarkedSet = new Set(bookmarkRows.map((r) => r.questionId));
    candidateIds = candidateIds.filter((id) => bookmarkedSet.has(id));
  }

  shuffle(candidateIds);
  const selected = candidateIds.slice(0, params.questionCount);

  if (selected.length === 0) {
    throw new Error('NO_QUESTIONS');
  }

  // Fetch full question + options data
  const questionRows = await db.select().from(questions).where(inArray(questions.id, selected));
  const optionRows = await db
    .select()
    .from(questionOptions)
    .where(inArray(questionOptions.questionId, selected))
    .orderBy(asc(questionOptions.sortOrder));

  const qById = new Map(questionRows.map((q) => [q.id, q]));
  const optsByQuestion = new Map<string, typeof optionRows>();
  for (const o of optionRows) {
    if (!optsByQuestion.has(o.questionId)) optsByQuestion.set(o.questionId, []);
    optsByQuestion.get(o.questionId)!.push(o);
  }

  // Create session
  const sessionId = makeId('sess');
  const chapterIdsJson = params.chapterIds.length > 0 ? JSON.stringify(params.chapterIds) : null;

  await db.insert(examSessions).values({
    id: sessionId,
    title: params.title ?? `Exam ${new Date().toLocaleDateString()}`,
    mode: params.mode as 'study' | 'tutor' | 'timed' | 'untimed',
    status: 'active',
    questionPoolMode: poolMode as 'all' | 'unused' | 'incorrect' | 'marked' | 'custom',
    totalQuestions: selected.length,
    currentQuestionIndex: 0,
    selectedChapterIdsJson: chapterIdsJson as unknown as string[] | null,
    scorePercent: null,
    totalCorrect: 0,
    totalIncorrect: 0,
    totalOmitted: 0,
    startedAt: now,
    elapsedSeconds: 0,
    createdAt: now,
    updatedAt: now,
  });

  // Create session questions
  const activeQuestions: ActiveQuestion[] = [];
  for (let i = 0; i < selected.length; i++) {
    const qId = selected[i];
    const q = qById.get(qId);
    if (!q) continue;

    const opts = optsByQuestion.get(qId) ?? [];
    const correctOpt = opts.find((o) => o.isCorrect === 1);
    const sqId = makeId('sq');

    await db.insert(examSessionQuestions).values({
      id: sqId,
      examSessionId: sessionId,
      questionId: qId,
      orderIndex: i,
      stemHtmlSnapshot: q.stemHtml,
      explanationHtmlSnapshot: q.explanationHtml ?? null,
      correctOptionId: correctOpt?.id ?? null,
      isMarked: 0,
      isSubmitted: 0,
      timeSpentSeconds: 0,
      createdAt: now,
    });

    const displayOpts = shuffleOptionsForSessionQuestion(
      opts,
      optionShuffleKey(sessionId, sqId),
    );

    activeQuestions.push({
      orderIndex: i,
      sessionQuestionId: sqId,
      questionId: qId,
      stemHtml: q.stemHtml,
      options: displayOpts.map((o, idx) => ({
        id: o.id,
        key: String.fromCharCode(65 + idx),
        contentHtml: o.contentHtml,
        contentText: o.contentText ?? o.contentHtml,
      })),
      isMarked: false,
      isSubmitted: false,
      selectedOptionId: null,
      outcome: null,
      timeSpentSeconds: 0,
    });
  }

  return { sessionId, questions: activeQuestions };
}

// ─── Submit answer (by order index) ──────────────────────────────

export async function pgSubmitAnswer(params: {
  sessionId: string;
  sessionQuestionId: string;
  selectedOptionId: string;
  timeSpentSeconds: number;
}): Promise<{
  outcome: 'correct' | 'incorrect';
  correctOptionId: string;
  correctKey: string;
  explanation: string | null;
}> {
  const db = await getDb();
  const now = Date.now();

  const sqRows = await db
    .select()
    .from(examSessionQuestions)
    .where(
      and(
        eq(examSessionQuestions.id, params.sessionQuestionId),
        eq(examSessionQuestions.examSessionId, params.sessionId),
      ),
    )
    .limit(1);

  if (sqRows.length === 0) throw new Error('SESSION_QUESTION_NOT_FOUND');
  const sq = sqRows[0];

  if (sq.isSubmitted === 1) throw new Error('ALREADY_SUBMITTED');

  const correctOptionId = sq.correctOptionId ?? '';
  const outcome: 'correct' | 'incorrect' =
    params.selectedOptionId === correctOptionId ? 'correct' : 'incorrect';

  // NOTE: `correctKey` returns the STORED optionKey ("A"/"B"/...), not the
  // shuffled display letter the user sees. Identity-based UI should use
  // `correctOptionId`; any future consumer that wants a displayed letter
  // needs the per-session shuffle applied (see `option-shuffle.ts`).
  const correctOptRows = await db
    .select({ optionKey: questionOptions.optionKey })
    .from(questionOptions)
    .where(eq(questionOptions.id, correctOptionId))
    .limit(1);
  const correctKey = correctOptRows[0]?.optionKey ?? '';

  await db
    .update(examSessionQuestions)
    .set({
      selectedOptionId: params.selectedOptionId,
      outcome,
      isSubmitted: 1,
      timeSpentSeconds: params.timeSpentSeconds,
      answeredAt: now,
    })
    .where(eq(examSessionQuestions.id, params.sessionQuestionId));

  await db.insert(questionAttempts).values({
    id: makeId('att'),
    questionId: sq.questionId,
    examSessionId: params.sessionId,
    selectedOptionId: params.selectedOptionId,
    correctOptionId,
    outcome,
    timeSpentSeconds: params.timeSpentSeconds,
    attemptedAt: now,
    createdAt: now,
  });

  return {
    outcome,
    correctOptionId,
    correctKey,
    explanation: sq.explanationHtmlSnapshot ?? null,
  };
}

// ─── Toggle mark ──────────────────────────────────────────────────

export async function pgToggleMark(sessionId: string, sessionQuestionId: string): Promise<boolean> {
  const db = await getDb();

  const sqRows = await db
    .select({ isMarked: examSessionQuestions.isMarked })
    .from(examSessionQuestions)
    .where(
      and(
        eq(examSessionQuestions.id, sessionQuestionId),
        eq(examSessionQuestions.examSessionId, sessionId),
      ),
    )
    .limit(1);

  if (sqRows.length === 0) throw new Error('SESSION_QUESTION_NOT_FOUND');
  const newMark = sqRows[0].isMarked === 1 ? 0 : 1;

  await db
    .update(examSessionQuestions)
    .set({ isMarked: newMark })
    .where(eq(examSessionQuestions.id, sessionQuestionId));

  return newMark === 1;
}

// ─── Suspend / Resume ─────────────────────────────────────────────

export async function pgSuspendExam(sessionId: string, elapsedSeconds: number): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  await db
    .update(examSessions)
    .set({ status: 'suspended', suspendedAt: now, elapsedSeconds, updatedAt: now })
    .where(eq(examSessions.id, sessionId));
}

// ─── Finish exam ──────────────────────────────────────────────────

export async function pgFinishExam(
  sessionId: string,
  elapsedSeconds: number,
): Promise<{
  session: ExamSession;
  results: QuestionResult[];
  score: ExamScore;
  volumeBreakdown: VolumeBreakdown[];
}> {
  const db = await getDb();
  const now = Date.now();

  // Mark unanswered as omitted
  await db
    .update(examSessionQuestions)
    .set({ outcome: 'omitted', isSubmitted: 1, answeredAt: now })
    .where(
      and(
        eq(examSessionQuestions.examSessionId, sessionId),
        eq(examSessionQuestions.isSubmitted, 0),
      ),
    );

  // Count outcomes
  const sqRows = await db
    .select()
    .from(examSessionQuestions)
    .where(eq(examSessionQuestions.examSessionId, sessionId))
    .orderBy(asc(examSessionQuestions.orderIndex));

  let correct = 0;
  let incorrect = 0;
  let omitted = 0;
  for (const sq of sqRows) {
    if (sq.outcome === 'correct') correct++;
    else if (sq.outcome === 'incorrect') incorrect++;
    else omitted++;
  }

  const total = sqRows.length;
  const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;

  const updatedSessions = await db
    .update(examSessions)
    .set({
      status: 'completed',
      completedAt: now,
      elapsedSeconds,
      totalCorrect: correct,
      totalIncorrect: incorrect,
      totalOmitted: omitted,
      scorePercent,
      updatedAt: now,
    })
    .where(eq(examSessions.id, sessionId))
    .returning();

  const session = updatedSessions[0];

  const questionIds = sqRows.map((sq) => sq.questionId);
  const qRows = await db.select().from(questions).where(inArray(questions.id, questionIds));
  const optRows = await db
    .select()
    .from(questionOptions)
    .where(inArray(questionOptions.questionId, questionIds))
    .orderBy(asc(questionOptions.sortOrder));

  const qById = new Map(qRows.map((q) => [q.id, q]));
  const optsByQuestion = new Map<string, typeof optRows>();
  for (const o of optRows) {
    if (!optsByQuestion.has(o.questionId)) optsByQuestion.set(o.questionId, []);
    optsByQuestion.get(o.questionId)!.push(o);
  }

  const results: QuestionResult[] = sqRows.map((sq) =>
    buildQuestionResult({
      sq,
      q: qById.get(sq.questionId),
      opts: optsByQuestion.get(sq.questionId) ?? [],
    }),
  );

  const volumeBreakdown = buildVolumeBreakdown(results);
  const score: ExamScore = { correct, incorrect, unanswered: omitted, total, percentage: scorePercent };

  return { session, results, score, volumeBreakdown };
}

// ─── Get results for completed session ────────────────────────────

export async function pgGetExamResults(sessionId: string): Promise<{
  session: ExamSession;
  results: QuestionResult[];
  score: ExamScore;
  volumeBreakdown: VolumeBreakdown[];
} | null> {
  const db = await getDb();

  const sessionRows = await db
    .select()
    .from(examSessions)
    .where(eq(examSessions.id, sessionId))
    .limit(1);
  if (sessionRows.length === 0) return null;
  const session = sessionRows[0];

  const sqRows = await db
    .select()
    .from(examSessionQuestions)
    .where(eq(examSessionQuestions.examSessionId, sessionId))
    .orderBy(asc(examSessionQuestions.orderIndex));

  const questionIds = sqRows.map((sq) => sq.questionId);
  if (questionIds.length === 0) {
    return {
      session,
      results: [],
      score: { correct: 0, incorrect: 0, unanswered: 0, total: 0, percentage: 0 },
      volumeBreakdown: [],
    };
  }

  const qRows = await db.select().from(questions).where(inArray(questions.id, questionIds));
  const optRows = await db
    .select()
    .from(questionOptions)
    .where(inArray(questionOptions.questionId, questionIds))
    .orderBy(asc(questionOptions.sortOrder));

  const qById = new Map(qRows.map((q) => [q.id, q]));
  const optsByQuestion = new Map<string, typeof optRows>();
  for (const o of optRows) {
    if (!optsByQuestion.has(o.questionId)) optsByQuestion.set(o.questionId, []);
    optsByQuestion.get(o.questionId)!.push(o);
  }

  const results: QuestionResult[] = sqRows.map((sq) =>
    buildQuestionResult({
      sq,
      q: qById.get(sq.questionId),
      opts: optsByQuestion.get(sq.questionId) ?? [],
    }),
  );

  const score: ExamScore = {
    correct: session.totalCorrect ?? 0,
    incorrect: session.totalIncorrect ?? 0,
    unanswered: session.totalOmitted ?? 0,
    total: session.totalQuestions,
    percentage: session.scorePercent ?? 0,
  };

  return { session, results, score, volumeBreakdown: buildVolumeBreakdown(results) };
}

// ─── List exam history ────────────────────────────────────────────

export async function pgListExamHistory(limit = 50): Promise<ExamSession[]> {
  const db = await getDb();
  return db
    .select()
    .from(examSessions)
    .orderBy(desc(examSessions.startedAt))
    .limit(limit);
}

// ─── Get active/suspended session ────────────────────────────────

export async function pgGetActiveSession(): Promise<{
  session: ExamSession;
  questions: ActiveQuestion[];
} | null> {
  const db = await getDb();

  const rows = await db
    .select()
    .from(examSessions)
    .where(sql`${examSessions.status} IN ('active', 'suspended')`)
    .orderBy(desc(examSessions.startedAt))
    .limit(1);

  if (rows.length === 0) return null;
  return pgGetSessionState(rows[0].id);
}

// ─── Count questions ──────────────────────────────────────────────

export async function pgCountQuestions(chapterIds: string[], poolMode: string): Promise<number> {
  const db = await getDb();

  let chapterDbIds: string[] = [];
  if (chapterIds.length > 0) {
    const chapterNos = chapterIds
      .map((id) => {
        const m = id.match(/^ch-(\d+)$/);
        return m ? parseInt(m[1], 10) : null;
      })
      .filter((n): n is number => n !== null);

    if (chapterNos.length > 0) {
      const dbChapters = await db
        .select({ id: chapters.id })
        .from(chapters)
        .where(inArray(chapters.chapterNo, chapterNos));
      chapterDbIds = dbChapters.map((c) => c.id);
    }
  }

  const baseCondition =
    chapterDbIds.length > 0
      ? and(eq(questions.isActive, 1), inArray(questions.chapterId, chapterDbIds))
      : eq(questions.isActive, 1);

  const rows = await db.select({ id: questions.id }).from(questions).where(baseCondition);
  return rows.length;
}

export async function pgGetTotalQuestionCount(): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ id: questions.id })
    .from(questions)
    .where(eq(questions.isActive, 1));
  return rows.length;
}

// ─── Volume breakdown helper ──────────────────────────────────────

function buildVolumeBreakdown(results: QuestionResult[]): VolumeBreakdown[] {
  const volumeMap = new Map<
    number,
    { label: string; parts: Map<string, { label: string; results: QuestionResult[] }> }
  >();

  for (const r of results) {
    const volNo = r.volumeNo ?? 0;
    const volLabel = volNo > 0 ? `Volume ${volNo}` : 'Unknown Volume';
    const pid = r.partId ?? 'unknown';
    const pLabel = r.partLabel ?? pid;

    if (!volumeMap.has(volNo)) {
      volumeMap.set(volNo, { label: volLabel, parts: new Map() });
    }
    const vol = volumeMap.get(volNo)!;
    if (!vol.parts.has(pid)) {
      vol.parts.set(pid, { label: pLabel, results: [] });
    }
    vol.parts.get(pid)!.results.push(r);
  }

  const breakdown: VolumeBreakdown[] = [];

  for (const [volNo, volData] of Array.from(volumeMap.entries()).sort((a, b) => a[0] - b[0])) {
    const parts: PartBreakdown[] = [];

    for (const [pid, partEntry] of volData.parts.entries()) {
      const pTotal = partEntry.results.length;
      const pCorrect = partEntry.results.filter((r: QuestionResult) => r.outcome === 'correct').length;
      const pIncorrect = partEntry.results.filter((r: QuestionResult) => r.outcome === 'incorrect').length;
      const pOmitted = partEntry.results.filter((r: QuestionResult) => r.outcome === 'omitted' || r.outcome === null).length;
      parts.push({
        partId: pid,
        partLabel: partEntry.label,
        total: pTotal,
        correct: pCorrect,
        incorrect: pIncorrect,
        omitted: pOmitted,
        percentage: pTotal > 0 ? Math.round((pCorrect / pTotal) * 100) : 0,
      });
    }

    const vTotal = parts.reduce((s, p) => s + p.total, 0);
    const vCorrect = parts.reduce((s, p) => s + p.correct, 0);
    const vIncorrect = parts.reduce((s, p) => s + p.incorrect, 0);
    const vOmitted = parts.reduce((s, p) => s + p.omitted, 0);

    breakdown.push({
      volumeId: `vol-${volNo}`,
      volumeLabel: volData.label,
      total: vTotal,
      correct: vCorrect,
      incorrect: vIncorrect,
      omitted: vOmitted,
      percentage: vTotal > 0 ? Math.round((vCorrect / vTotal) * 100) : 0,
      parts,
    });
  }

  return breakdown;
}
