// src/types/exam.ts
// Clean exam types — NO Dexie dependency

import type { McqAmbossReview } from "@/types/mcq-review";

export type ExamMode = 'study' | 'tutor' | 'timed' | 'untimed';
export type ExamPoolMode = 'all' | 'unused' | 'incorrect' | 'marked' | 'bookmarked';
export type ExamStatus = 'active' | 'suspended' | 'completed' | 'abandoned';
export type OutcomeType = 'correct' | 'incorrect' | 'omitted';

// Legacy aliases kept for backward-compat with existing component refs
export type QuestionPoolMode = ExamPoolMode;
export type AttemptOutcome = OutcomeType;
export type ExamPhase = 'idle' | 'building' | 'active' | 'paused' | 'finished' | 'review';

export interface ExamConfig {
  title?: string;
  mode: ExamMode;
  poolMode?: ExamPoolMode;
  questionCount: number;
  timeLimit: number; // seconds, 0 = no limit
  selectedVolumeIds: string[];
  selectedPartIds: string[];
  selectedChapterIds: string[];
  // legacy compat (same as poolMode)
  questionPoolMode?: ExamPoolMode;
  selectedSubjectIds?: string[];
  selectedSystemIds?: string[];
  difficulty?: string;
  shuffleOptions?: boolean;
  isSimulation?: boolean;
  subjects?: string[];
  tags?: string[];
  bookmarkedOnly?: boolean;
  incorrectOnly?: boolean;
  unusedOnly?: boolean;
  questionMode?: string;
}

export interface ExamScore {
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
  percentage: number;
}

export interface QuestionOption {
  id: string;
  key: string; // 'A', 'B', 'C', etc. (shuffled display letter)
  contentHtml: string;
  contentText?: string;
  isCorrect?: boolean;
  /** Original stored optionKey before shuffle — used to match review data. */
  originalKey?: string;
}

export interface ActiveQuestion {
  orderIndex: number;
  sessionQuestionId: string;
  questionId: string;
  stemHtml: string;
  options: QuestionOption[];
  isMarked: boolean;
  isSubmitted: boolean;
  selectedOptionId: string | null;
  outcome: OutcomeType | null;
  timeSpentSeconds: number;
  // Only present in tutor mode or review
  explanationHtml?: string;
  correctOptionId?: string;
  /** v6.1 AMBOSS-style structured review — present when isSubmitted or tutor mode. */
  review?: McqAmbossReview | null;
}

export interface QuestionResult {
  orderIndex: number;
  sessionQuestionId: string;
  questionId: string;
  stemHtml: string;
  explanationHtml: string | null;
  options: QuestionOption[];
  selectedOptionId: string | null;
  correctOptionId: string | null;
  outcome: OutcomeType | null;
  isMarked: boolean;
  timeSpentSeconds: number;
  // Campbell metadata
  chapterId: string | null;
  chapterNo: number | null;
  chapterTitle: string | null;
  partId: string | null;
  partLabel: string | null;
  volumeNo: number | null;
  difficulty: string | null;
  subject: string | null;
  // Convenience helpers (derived, not stored)
  isCorrect: boolean;
  flagged: boolean;
  /** Option ID of the selected answer (string) */
  userAnswer: string | null;
  /** Index of correct option in options array (0-based) */
  correctIndex: number;
  // Legacy fields for backwards-compat with existing components
  /** Plain text version of stemHtml — for display fallback */
  questionText: string;
  /** Plain text explanation (alias of explanationHtml) */
  explanation: string | undefined;
}

export interface SubjectBreakdown {
  subject: string; // volume label or part label
  label: string;   // display label
  type: 'volume' | 'part' | 'chapter';
  id: string;
  total: number;
  correct: number;
  incorrect: number;
  omitted: number;
  percentage: number;
}

export interface ExamSession {
  id: string;
  title: string | null;
  mode: ExamMode;
  status: ExamStatus;
  totalQuestions: number;
  currentQuestionIndex: number;
  scorePercent: number | null;
  totalCorrect: number;
  totalIncorrect: number;
  totalOmitted: number;
  startedAt: number;
  completedAt: number | null;
  elapsedSeconds: number;
}

export interface ExamSessionSummary {
  id: string;
  title: string | null;
  mode: ExamMode;
  status: ExamStatus;
  totalQuestions: number;
  totalCorrect: number;
  totalIncorrect: number;
  totalOmitted: number;
  scorePercent: number | null;
  startedAt: number;
  completedAt: number | null;
  elapsedSeconds: number;
}

export interface ActiveExamQuestion {
  orderIndex: number;
  sessionQuestionId: string;
  questionId: string;
  stemHtml: string;
  options: Array<{ id: string; key: string; contentHtml: string; contentText: string; originalKey?: string }>;
  isMarked: boolean;
  isSubmitted: boolean;
  selectedOptionId: string | null;
  outcome: OutcomeType | null;
  timeSpentSeconds: number;
  // Only included in tutor mode or review:
  explanationHtml?: string;
  correctOptionId?: string;
  review?: McqAmbossReview | null;
}

export interface ActiveExamState {
  sessionId: string;
  title: string | null;
  mode: ExamMode;
  status: ExamStatus;
  currentQuestionIndex: number;
  totalQuestions: number;
  elapsedSeconds: number;
  questions: ActiveExamQuestion[];
}

export interface ExamStartResult {
  sessionId: string;
  mode: ExamMode;
  totalQuestions: number;
  elapsedSeconds: number;
  questions: ActiveExamQuestion[];
}

// Legacy ExamSessionQuestion kept for backward-compat
export interface ExamSessionQuestion {
  sessionQuestionId: string;
  questionId: string;
  orderIndex: number;
  stemHtml: string;
  options: Array<{
    id: string;
    key: string;
    contentHtml: string;
  }>;
  correctOptionId?: string;
  correctKey?: string;
  explanation?: string;
  chapterId?: string;
  chapterNo?: number;
  difficulty?: string;
  subject?: string;
}

export interface VolumeBreakdown {
  volumeId: string;
  volumeLabel: string;
  total: number;
  correct: number;
  incorrect: number;
  omitted: number;
  percentage: number;
  parts: PartBreakdown[];
}

export interface PartBreakdown {
  partId: string;
  partLabel: string;
  total: number;
  correct: number;
  incorrect: number;
  omitted: number;
  percentage: number;
}
