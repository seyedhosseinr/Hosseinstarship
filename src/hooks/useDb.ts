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
  chapterPerformance: LocalChapterMcqStats[];
  fsrsStatsByChapter: LocalFsrsStatsByChapter[];
  readerStatsByChapter: LocalReaderStatsByChapter[];
  activityFeed: LocalActivityFeedRow[];
}

export interface LocalChapterProgress {
  chapter_no: number;
  status: string;
  read_count: number;
  last_read_at: number | null;
  q_attempted: number;
  q_correct: number;
}

export interface LocalChapterMcqStats {
  chapterId: string;
  chapterTitle: string | null;
  total: number;
  correct: number;
  accuracy: number;
}

export interface LocalFsrsStatsByChapter {
  chapterId: string;
  totalCards: number;
  dueCards: number;
  reviewedCards: number;
  avgRetention: number | null;
  avgStability: number | null;
  lastReviewedAt: string | null;
}

export interface LocalReaderStatsByChapter {
  chapterId: string;
  readPercent: number;
  lastReadAt: string | null;
}

export interface LocalActivityFeedRow {
  id: string;
  type: "card_review" | "mcq_block" | "chapter_read";
  entityLabel: string;
  detail: string;
  delta: string;
  timestamp: string;
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

export async function getLocalFsrsStatsByChapter(): Promise<LocalFsrsStatsByChapter[]> {
  const { pg } = await getBrowserDb();
  const now = Date.now();
  const result = await pg.query<LocalFsrsStatsByChapter>(
    `SELECT
        chapter_id AS "chapterId",
        CAST(COUNT(*) AS INTEGER) AS "totalCards",
        CAST(SUM(CASE WHEN fsrs_due IS NOT NULL AND fsrs_due <= $1 THEN 1 ELSE 0 END) AS INTEGER) AS "dueCards",
        CAST(SUM(CASE WHEN fsrs_reps > 0 THEN 1 ELSE 0 END) AS INTEGER) AS "reviewedCards",
        AVG(
          CASE
            WHEN fsrs_stability > 0 AND fsrs_last_review IS NOT NULL
            THEN POWER(
              1.0 + (19.0 / 81.0)
                * GREATEST(0.0, ($1::float8 - CAST(fsrs_last_review AS float8)) / 86400000.0)
                / fsrs_stability,
              -0.5
            ) * 100.0
            WHEN fsrs_stability > 0 THEN 100.0
            ELSE NULL
          END
        ) AS "avgRetention",
        AVG(NULLIF(fsrs_stability, 0)) AS "avgStability",
        CAST(MAX(fsrs_last_review) AS TEXT) AS "lastReviewedAt"
     FROM flashcards
     WHERE chapter_id IS NOT NULL
       AND is_deleted = 0
       AND is_archived = 0
     GROUP BY chapter_id`,
    [now],
  );

  return result.rows.map((row) => ({
    chapterId: row.chapterId ?? "",
    totalCards: Number(row.totalCards) || 0,
    dueCards: Number(row.dueCards) || 0,
    reviewedCards: Number(row.reviewedCards) || 0,
    avgRetention: row.avgRetention == null ? null : Math.min(100, Math.max(0, Number(row.avgRetention))),
    avgStability: row.avgStability == null ? null : Math.max(0, Number(row.avgStability)),
    lastReviewedAt: row.lastReviewedAt ?? null,
  }));
}

export async function getLocalReaderStatsByChapter(): Promise<LocalReaderStatsByChapter[]> {
  const { pg } = await getBrowserDb();
  const result = await pg.query<LocalReaderStatsByChapter>(
    `SELECT
        chapter_id AS "chapterId",
        AVG(LEAST(100, GREATEST(0, COALESCE(progress_percent, 0)))) AS "readPercent",
        CAST(MAX(COALESCE(ended_at, started_at, created_at)) AS TEXT) AS "lastReadAt"
     FROM chunk_study_sessions
     WHERE chapter_id IS NOT NULL
     GROUP BY chapter_id`,
  );

  return result.rows.map((row) => ({
    chapterId: row.chapterId ?? "",
    readPercent: Math.min(100, Math.max(0, Number(row.readPercent) || 0)),
    lastReadAt: row.lastReadAt ?? null,
  }));
}

export async function getLocalChapterMcqStats(): Promise<LocalChapterMcqStats[]> {
  const { pg } = await getBrowserDb();
  const result = await pg.query<Omit<LocalChapterMcqStats, "accuracy">>(
    `SELECT
        q.chapter_id AS "chapterId",
        c.title AS "chapterTitle",
        CAST(COUNT(qa.id) AS INTEGER) AS total,
        CAST(SUM(CASE WHEN qa.outcome = 'correct' THEN 1 ELSE 0 END) AS INTEGER) AS correct
     FROM question_attempts qa
     INNER JOIN questions q ON qa.question_id = q.id
     INNER JOIN chapters c ON q.chapter_id = c.id
     WHERE qa.is_deleted = 0
       AND q.is_deleted = 0
     GROUP BY q.chapter_id, c.title`,
  );

  return result.rows
    .map((row) => {
      const total = Number(row.total) || 0;
      const correct = Number(row.correct) || 0;

      return {
        chapterId: row.chapterId,
        chapterTitle: row.chapterTitle,
        total,
        correct,
        accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      };
    })
    .sort((a, b) => a.accuracy - b.accuracy);
}

export async function getLocalActivityFeed(): Promise<LocalActivityFeedRow[]> {
  const { pg } = await getBrowserDb();

  const [cardReviews, mcqBlocks, chapterReads] = await Promise.all([
    pg.query<{ id: string; entityLabel: string; delta: string; timestamp: number | null }>(
      `SELECT
          CAST(id AS TEXT) AS id,
          COALESCE(chapter_id, 'Flashcard') AS "entityLabel",
          '+1 کارت' AS delta,
          fsrs_last_review AS timestamp
       FROM flashcards
       WHERE fsrs_last_review IS NOT NULL
         AND is_deleted = 0
         AND is_archived = 0
       ORDER BY fsrs_last_review DESC
       LIMIT 5`,
    ),
    pg.query<{ id: string; entityLabel: string; delta: string; timestamp: number | null }>(
      `SELECT
          CAST(id AS TEXT) AS id,
          COALESCE(title, 'MCQ Block') AS "entityLabel",
          CAST(total_correct AS TEXT) || '/' || CAST(total_questions AS TEXT) AS delta,
          completed_at AS timestamp
       FROM exam_sessions
       WHERE completed_at IS NOT NULL
         AND is_deleted = 0
       ORDER BY completed_at DESC
       LIMIT 5`,
    ),
    pg.query<{ id: string; entityLabel: string; delta: string; timestamp: number | null }>(
      `SELECT
          CAST(id AS TEXT) AS id,
          COALESCE(chapter_id, 'فصل') AS "entityLabel",
          CAST(COALESCE(duration_seconds, 0) AS TEXT) || ' ثانیه' AS delta,
          COALESCE(ended_at, started_at, created_at) AS timestamp
       FROM chunk_study_sessions
       WHERE chapter_id IS NOT NULL
       ORDER BY COALESCE(ended_at, started_at, created_at) DESC
       LIMIT 5`,
    ),
  ]);

  return [
    ...cardReviews.rows.map((row) => ({
      id: row.id,
      type: "card_review" as const,
      entityLabel: row.entityLabel,
      detail: "مرور شد",
      delta: row.delta,
      timestamp: String(row.timestamp ?? ""),
    })),
    ...mcqBlocks.rows.map((row) => ({
      id: row.id,
      type: "mcq_block" as const,
      entityLabel: row.entityLabel,
      detail: "",
      delta: row.delta,
      timestamp: String(row.timestamp ?? ""),
    })),
    ...chapterReads.rows.map((row) => ({
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

/**
 * Basic counts for the dashboard: questions, flashcards, exam sessions, due flashcards.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const { pg } = await getBrowserDb();
  const now = Date.now();

  const [
    qRow,
    fRow,
    sRow,
    dRow,
    chapterPerformance,
    fsrsStatsByChapter,
    readerStatsByChapter,
    activityFeed,
  ] = await Promise.all([
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
    getLocalChapterMcqStats(),
    getLocalFsrsStatsByChapter(),
    getLocalReaderStatsByChapter(),
    getLocalActivityFeed(),
  ]);

  return {
    totalQuestions:  qRow.rows[0]?.cnt ?? 0,
    totalFlashcards: fRow.rows[0]?.cnt ?? 0,
    totalSessions:  sRow.rows[0]?.cnt ?? 0,
    dueFlashcards:  dRow.rows[0]?.cnt ?? 0,
    chapterPerformance,
    fsrsStatsByChapter,
    readerStatsByChapter,
    activityFeed,
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
