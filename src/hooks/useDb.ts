"use client";

/**
 * useDb.ts — Typed query helpers over the browser OPFS database.
 *
 * Every helper calls getBrowserDb() which returns a Drizzle+PGliteWorker pair.
 * Safe to call from any client component. All queries hit the local OPFS DB —
 * no network involved.
 */

import { getBrowserDb } from "@/db/pglite-browser";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LocalFlashcard {
  id: string;
  front_html: string;
  back_html: string;
  card_type: string;
  chapter_no: number | null;
  deck: string | null;
  tags_json: string | null;
  fsrs_due: number | null;
  fsrs_state: string | null;
  fsrs_stability: number | null;
  fsrs_difficulty: number | null;
  fsrs_reps: number | null;
  fsrs_lapses: number | null;
  fsrs_last_review: number | null;
  created_at: number;
  updated_at: number;
  is_deleted: number;
}

export interface DashboardStats {
  totalQuestions: number;
  totalFlashcards: number;
  totalSessions: number;
  dueFlashcards: number;
  chapterPerformance?: any;
  fsrsStatsByChapter?: any;
  readerStatsByChapter?: any;
  activityFeed?: any;
}

export interface LocalChapterProgress {
  chapter_no: number;
  status: string;
  read_count: number;
  last_read_at: number | null;
  q_attempted: number;
  q_correct: number;
}

// ── Query helpers ─────────────────────────────────────────────────────────────

/**
 * Flashcards due for review: fsrs_due <= now, not deleted, ordered by due date.
 */
export async function getFlashcardsForReview(limit: number): Promise<LocalFlashcard[]> {
  const { pg } = await getBrowserDb();
  const now = Date.now();
  const result = await pg.query<LocalFlashcard>(
    `SELECT id, front_html, back_html, card_type, chapter_no, deck,
            tags_json, fsrs_due, fsrs_state, fsrs_stability, fsrs_difficulty,
            fsrs_reps, fsrs_lapses, fsrs_last_review,
            created_at, updated_at, is_deleted
     FROM flashcards
     WHERE is_deleted = 0
       AND (fsrs_due IS NULL OR fsrs_due <= $1)
     ORDER BY fsrs_due ASC NULLS FIRST
     LIMIT $2`,
    [now, limit],
  );
  return result.rows;
}

/**
 * Flashcards belonging to a specific chapter.
 */
export async function getFlashcardsByChapter(chapterNo: number): Promise<LocalFlashcard[]> {
  const { pg } = await getBrowserDb();
  const result = await pg.query<LocalFlashcard>(
    `SELECT id, front_html, back_html, card_type, chapter_no, deck,
            tags_json, fsrs_due, fsrs_state, fsrs_stability, fsrs_difficulty,
            fsrs_reps, fsrs_lapses, fsrs_last_review,
            created_at, updated_at, is_deleted
     FROM flashcards
     WHERE is_deleted = 0 AND chapter_no = $1
     ORDER BY created_at DESC`,
    [chapterNo],
  );
  return result.rows;
}

/**
 * Basic counts for the dashboard: questions, flashcards, exam sessions, due flashcards.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const { pg } = await getBrowserDb();
  const now = Date.now();

  const [qRow, fRow, sRow, dRow] = await Promise.all([
    pg.query<{ cnt: number }>(
      `SELECT count(*)::int AS cnt FROM questions WHERE is_deleted = 0`,
    ),
    pg.query<{ cnt: number }>(
      `SELECT count(*)::int AS cnt FROM flashcards WHERE is_deleted = 0`,
    ),
    pg.query<{ cnt: number }>(
      `SELECT count(*)::int AS cnt FROM exam_sessions WHERE is_deleted = 0`,
    ),
    pg.query<{ cnt: number }>(
      `SELECT count(*)::int AS cnt FROM flashcards WHERE is_deleted = 0 AND (fsrs_due IS NULL OR fsrs_due <= $1)`,
      [now],
    ),
  ]);

  return {
    totalQuestions:  qRow.rows[0]?.cnt ?? 0,
    totalFlashcards: fRow.rows[0]?.cnt ?? 0,
    totalSessions:  sRow.rows[0]?.cnt ?? 0,
    dueFlashcards:  dRow.rows[0]?.cnt ?? 0,
  };
}

/**
 * Progress record for a specific chapter.
 */
export async function getChapterProgress(chapterNo: number): Promise<LocalChapterProgress | null> {
  const { pg } = await getBrowserDb();
  const result = await pg.query<LocalChapterProgress>(
    `SELECT chapter_no, status, read_count, last_read_at, q_attempted, q_correct
     FROM chapter_progress
     WHERE chapter_no = $1`,
    [chapterNo],
  );
  return result.rows[0] ?? null;
}
