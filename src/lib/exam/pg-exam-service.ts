// src/lib/exam/pg-exam-service.ts
// Async exam service layer. API routes import from here.

import {
  pgCreateExamSession,
  pgGetSessionState,
  pgSubmitAnswer,
  pgToggleMark,
  pgSuspendExam,
  pgFinishExam,
  pgGetExamResults,
  pgListExamHistory,
  pgGetActiveSession,
  pgCountQuestions,
  pgGetTotalQuestionCount,
  getSessionQuestionByIndex,
  listSessionQuestions,
} from './pg-exam-queries';
import { resolveChapterIds } from './campbell-hierarchy';
import type {
  ActiveQuestion,
  QuestionResult,
  ExamScore,
  SubjectBreakdown,
  ExamSessionSummary,
  VolumeBreakdown,
} from '@/types/exam';
import type { McqAmbossReview } from '@/types/mcq-review';
import { getDb } from '@/db/index';
import { examSessions } from '@/db/schema';
import { eq } from 'drizzle-orm';

// ─── Error class ──────────────────────────────────────────────────

export class ExamServiceError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'ExamServiceError';
  }
}

// ─── Params ───────────────────────────────────────────────────────

export interface CreateExamParams {
  title?: string;
  mode: 'study' | 'tutor' | 'timed' | 'untimed';
  poolMode: 'all' | 'unused' | 'incorrect' | 'marked' | 'bookmarked';
  questionCount: number;
  selectedVolumeIds: string[];
  selectedPartIds: string[];
  selectedChapterIds: string[];
}

// ─── Start exam ───────────────────────────────────────────────────

export async function startExam(params: CreateExamParams): Promise<{
  sessionId: string;
  totalQuestions: number;
  questions: ActiveQuestion[];
}> {
  const chapterIds = resolveChapterIds(
    params.selectedVolumeIds,
    params.selectedPartIds,
    params.selectedChapterIds,
  );

  try {
    const result = await pgCreateExamSession({
      title: params.title,
      mode: params.mode,
      questionPoolMode: params.poolMode,
      chapterIds,
      questionCount: params.questionCount,
    });

    return {
      sessionId: result.sessionId,
      totalQuestions: result.questions.length,
      questions: result.questions,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'NO_QUESTIONS') {
      throw new ExamServiceError(
        'NO_QUESTIONS',
        'No questions found matching the selected criteria. Try a different pool or chapter selection.',
      );
    }
    throw err;
  }
}

// ─── Get exam state ───────────────────────────────────────────────

export async function getExamState(sessionId: string): Promise<{
  session: {
    id: string;
    title: string | null;
    mode: string;
    status: string;
    currentQuestionIndex: number;
    totalQuestions: number;
    elapsedSeconds: number;
  };
  questions: ActiveQuestion[];
  progress: {
    total: number;
    answered: number;
    remaining: number;
    marked: number;
  };
}> {
  const data = await pgGetSessionState(sessionId);
  if (!data) {
    throw new ExamServiceError('NOT_FOUND', `Exam session ${sessionId} not found.`);
  }

  const { session, questions } = data;
  const answered = questions.filter((q) => q.isSubmitted).length;
  const marked = questions.filter((q) => q.isMarked).length;

  return {
    session: {
      id: session.id,
      title: session.title ?? null,
      mode: session.mode,
      status: session.status,
      currentQuestionIndex: session.currentQuestionIndex ?? 0,
      totalQuestions: session.totalQuestions,
      elapsedSeconds: session.elapsedSeconds ?? 0,
    },
    questions,
    progress: {
      total: questions.length,
      answered,
      remaining: questions.length - answered,
      marked,
    },
  };
}

// ─── Submit answer ────────────────────────────────────────────────

export async function submitAnswer(
  sessionId: string,
  orderIndex: number,
  selectedOptionId: string,
  timeSpentSeconds: number,
): Promise<{ outcome: string; correctOptionId: string; isCorrect: boolean; explanation: string | null; review: McqAmbossReview | null }> {
  // Look up session question by order index
  const sq = await getSessionQuestionByIndex(sessionId, orderIndex);
  if (!sq) {
    throw new ExamServiceError(
      'NOT_FOUND',
      `Question at index ${orderIndex} not found in session ${sessionId}.`,
    );
  }

  if (sq.isSubmitted === 1) {
    throw new ExamServiceError('ALREADY_SUBMITTED', 'This question has already been answered.');
  }

  const result = await pgSubmitAnswer({
    sessionId,
    sessionQuestionId: sq.id,
    selectedOptionId,
    timeSpentSeconds,
  });

  return {
    outcome: result.outcome,
    correctOptionId: result.correctOptionId,
    isCorrect: result.outcome === 'correct',
    explanation: result.explanation,
    review: result.review,
  };
}

// ─── Toggle mark ──────────────────────────────────────────────────

export async function toggleMark(
  sessionId: string,
  orderIndex: number,
): Promise<{ isMarked: boolean }> {
  const sq = await getSessionQuestionByIndex(sessionId, orderIndex);
  if (!sq) {
    throw new ExamServiceError(
      'NOT_FOUND',
      `Question at index ${orderIndex} not found in session ${sessionId}.`,
    );
  }

  const isMarked = await pgToggleMark(sessionId, sq.id);
  return { isMarked };
}

// ─── Suspend exam ─────────────────────────────────────────────────

export async function suspendExam(sessionId: string, elapsedSeconds: number): Promise<void> {
  const session = await getExamSessionRow(sessionId);
  if (session.status === 'completed' || session.status === 'abandoned') {
    throw new ExamServiceError(
      'INVALID_STATE',
      `Cannot suspend a ${session.status} exam.`,
    );
  }
  await pgSuspendExam(sessionId, elapsedSeconds);
}

// ─── Resume exam ──────────────────────────────────────────────────

export async function resumeExam(sessionId: string): Promise<typeof examSessions.$inferSelect> {
  const db = await getDb();
  const session = await getExamSessionRow(sessionId);

  if (session.status !== 'suspended') {
    throw new ExamServiceError('INVALID_STATE', 'Only suspended exams can be resumed.');
  }

  const result = await db
    .update(examSessions)
    .set({ status: 'active', updatedAt: Date.now() })
    .where(eq(examSessions.id, sessionId))
    .returning();

  return result[0];
}

// ─── Finish exam ──────────────────────────────────────────────────

export async function finishExam(
  sessionId: string,
  elapsedSeconds: number,
): Promise<{
  session: { id: string; title: string | null; mode: string; status: string; scorePercent: number | null; totalCorrect: number; totalIncorrect: number; totalOmitted: number; totalQuestions: number; elapsedSeconds: number; completedAt: number | null };
  score: ExamScore;
  results: QuestionResult[];
  breakdown: SubjectBreakdown[];
}> {
  const data = await pgFinishExam(sessionId, elapsedSeconds);

  const breakdown = buildSubjectBreakdown(data.volumeBreakdown);

  return {
    session: {
      id: data.session.id,
      title: data.session.title ?? null,
      mode: data.session.mode,
      status: data.session.status,
      scorePercent: data.session.scorePercent ?? null,
      totalCorrect: data.session.totalCorrect ?? 0,
      totalIncorrect: data.session.totalIncorrect ?? 0,
      totalOmitted: data.session.totalOmitted ?? 0,
      totalQuestions: data.session.totalQuestions,
      elapsedSeconds: data.session.elapsedSeconds ?? 0,
      completedAt: data.session.completedAt ?? null,
    },
    score: data.score,
    results: data.results,
    breakdown,
  };
}

// ─── Get exam results ─────────────────────────────────────────────

export async function getExamResults(sessionId: string): Promise<{
  session: { id: string; title: string | null; mode: string; status: string; scorePercent: number | null; totalCorrect: number; totalIncorrect: number; totalOmitted: number; totalQuestions: number; elapsedSeconds: number; completedAt: number | null };
  score: ExamScore;
  results: QuestionResult[];
  breakdown: SubjectBreakdown[];
}> {
  const data = await pgGetExamResults(sessionId);
  if (!data) {
    throw new ExamServiceError('NOT_FOUND', `Exam session ${sessionId} not found.`);
  }

  const breakdown = buildSubjectBreakdown(data.volumeBreakdown);

  return {
    session: {
      id: data.session.id,
      title: data.session.title ?? null,
      mode: data.session.mode,
      status: data.session.status,
      scorePercent: data.session.scorePercent ?? null,
      totalCorrect: data.session.totalCorrect ?? 0,
      totalIncorrect: data.session.totalIncorrect ?? 0,
      totalOmitted: data.session.totalOmitted ?? 0,
      totalQuestions: data.session.totalQuestions,
      elapsedSeconds: data.session.elapsedSeconds ?? 0,
      completedAt: data.session.completedAt ?? null,
    },
    score: data.score,
    results: data.results,
    breakdown,
  };
}

// ─── Get exam review (with correctOptionId exposed) ───────────────

export async function getExamReview(sessionId: string): Promise<{
  session: { id: string; title: string | null; mode: string; status: string };
  questions: QuestionResult[];
}> {
  const data = await pgGetExamResults(sessionId);
  if (!data) {
    throw new ExamServiceError('NOT_FOUND', `Exam session ${sessionId} not found.`);
  }

  return {
    session: {
      id: data.session.id,
      title: data.session.title ?? null,
      mode: data.session.mode,
      status: data.session.status,
    },
    questions: data.results,
  };
}

// ─── Get exam history ─────────────────────────────────────────────

export async function getExamHistory(limit = 20): Promise<ExamSessionSummary[]> {
  const sessions = await pgListExamHistory(limit);
  return sessions.map((s) => ({
    id: s.id,
    title: s.title ?? null,
    mode: s.mode as 'study' | 'tutor' | 'timed' | 'untimed',
    status: s.status as 'active' | 'suspended' | 'completed' | 'abandoned',
    totalQuestions: s.totalQuestions,
    totalCorrect: s.totalCorrect ?? 0,
    totalIncorrect: s.totalIncorrect ?? 0,
    totalOmitted: s.totalOmitted ?? 0,
    scorePercent: s.scorePercent ?? null,
    startedAt: s.startedAt,
    completedAt: s.completedAt ?? null,
    elapsedSeconds: s.elapsedSeconds ?? 0,
  }));
}

// ─── Internal helpers ─────────────────────────────────────────────

async function getExamSessionRow(sessionId: string): Promise<typeof examSessions.$inferSelect> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(examSessions)
    .where(eq(examSessions.id, sessionId))
    .limit(1);
  if (rows.length === 0) {
    throw new ExamServiceError('NOT_FOUND', `Exam session ${sessionId} not found.`);
  }
  return rows[0];
}

function buildSubjectBreakdown(volumeBreakdown: VolumeBreakdown[]): SubjectBreakdown[] {
  const result: SubjectBreakdown[] = [];

  for (const vol of volumeBreakdown) {
    result.push({
      subject: vol.volumeLabel,
      label: vol.volumeLabel,
      type: 'volume',
      id: vol.volumeId,
      total: vol.total,
      correct: vol.correct,
      incorrect: vol.incorrect,
      omitted: vol.omitted,
      percentage: vol.percentage,
    });

    for (const part of vol.parts) {
      result.push({
        subject: part.partLabel,
        label: part.partLabel,
        type: 'part',
        id: part.partId,
        total: part.total,
        correct: part.correct,
        incorrect: part.incorrect,
        omitted: part.omitted,
        percentage: part.percentage,
      });
    }
  }

  return result;
}

// ─── Re-export pass-through functions ────────────────────────────

export {
  pgGetActiveSession as getActiveExamSession,
  pgCountQuestions as countQuestionsForPool,
  pgGetTotalQuestionCount as getTotalQuestionCount,
};
