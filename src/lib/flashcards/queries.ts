import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { getDb } from "@/db/index";
import {
  chapters,
  flashcardDecks,
  flashcardReviewHistory,
  flashcardReviews,
  flashcards,
} from "@/db/schema";

type FlashcardRow = typeof flashcards.$inferSelect;
type FlashcardInsert = typeof flashcards.$inferInsert;
type FlashcardUpdate = Partial<typeof flashcards.$inferSelect>;
type FlashcardReviewInsert = typeof flashcardReviews.$inferInsert;
type FlashcardReviewHistoryInsert = typeof flashcardReviewHistory.$inferInsert;
type FlashcardDeckInsert = typeof flashcardDecks.$inferInsert;

export type FlashcardListItem = {
  id: string;
  frontHtml: string;
  backHtml: string;
  cardType: string;
  chapterNo: number | null;
  chapterTitle: string | null;
  deck: string | null;
  sourceQuestionId: string | null;
  sourceDocId: string | null;
  sourceFrameId: string | null;
  fsrsDue: number | null;
  fsrsState: string;
  fsrsStability: number;
  fsrsDifficulty: number;
  fsrsElapsedDays: number;
  fsrsScheduledDays: number;
  fsrsReps: number;
  fsrsLapses: number;
  fsrsLastReview: number | null;
  learningStep: number;
  easeFactor: number;
  isLeech: boolean;
  isSuspended: boolean;
  isBuried: boolean;
  siblingGroup: string | null;
  importance: number;
  updatedAt: number;
  tags: string[];
};

export type FlashcardStatsSnapshot = {
  total: number;
  due: number;
  suspended: number;
  reviewed: number;
  newCount: number;
  learning: number;
  leech: number;
  /** Number of times the user pressed FSRS Hard (rating=2). This is NOT the same as leech. */
  hardReviews: number;
  hardReviews7d: number;
  /** Cards whose current FSRS difficulty is high enough to be treated as difficult. */
  difficultCards: number;
  avgDifficulty: number;
  recentReviewCount: number;
  deckCount: number;
};

export type RecentFlashcardReview = {
  id: string;
  flashcardId: string;
  rating: 1 | 2 | 3 | 4;
  reviewedAt: number;
  flashcardFrontHtml: string;
};

export function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  }

  return [];
}

export function jsonField<T>(value: T | null): T | null {
  return (value == null ? null : JSON.stringify(value)) as unknown as T | null;
}

function toListItem(row: {
  card: FlashcardRow;
  chapterTitle: string | null;
}): FlashcardListItem {
  return {
    id: row.card.id,
    frontHtml: row.card.frontHtml,
    backHtml: row.card.backHtml,
    cardType: row.card.cardType,
    chapterNo: row.card.chapterNo,
    chapterTitle: row.chapterTitle ?? null,
    deck: row.card.deck,
    sourceQuestionId: row.card.sourceQuestionId ?? null,
    sourceDocId: row.card.sourceDocId ?? null,
    sourceFrameId: row.card.sourceFrameId ?? null,
    fsrsDue: row.card.fsrsDue,
    fsrsState: row.card.fsrsState,
    fsrsStability: row.card.fsrsStability,
    fsrsDifficulty: row.card.fsrsDifficulty,
    fsrsElapsedDays: row.card.fsrsElapsedDays,
    fsrsScheduledDays: row.card.fsrsScheduledDays,
    fsrsReps: row.card.fsrsReps,
    fsrsLapses: row.card.fsrsLapses,
    fsrsLastReview: row.card.fsrsLastReview,
    learningStep: row.card.learningStep,
    easeFactor: row.card.easeFactor,
    isLeech: Boolean(row.card.isLeech),
    isSuspended: Boolean(row.card.isSuspended),
    isBuried: Boolean(row.card.isBuried),
    siblingGroup: row.card.siblingGroup ?? null,
    importance: row.card.importance,
    updatedAt: row.card.updatedAt,
    tags: parseStringArray(row.card.tagsJson),
  };
}

function escapeLike(value: string) {
  return value.replace(/[%_]/g, "\\$&");
}

function buildListFilters(input: {
  search?: string;
  dueOnly?: boolean;
  chapterNo?: number;
}) {
  const filters = [
    eq(flashcards.isArchived, 0),
    eq(flashcards.status, "active"),
  ];

  if (input.chapterNo != null) {
    filters.push(eq(flashcards.chapterNo, input.chapterNo));
  }

  if (input.dueOnly) {
    filters.push(eq(flashcards.isSuspended, 0));
    filters.push(eq(flashcards.isBuried, 0));
    filters.push(lte(flashcards.fsrsDue, Date.now()));
  }

  if (input.search?.trim()) {
    const pattern = `%${escapeLike(input.search.trim())}%`;
    filters.push(
      or(
        ilike(flashcards.frontHtml, pattern),
        ilike(flashcards.backHtml, pattern),
        ilike(flashcards.deck, pattern),
        ilike(chapters.title, pattern),
      )!,
    );
  }

  return and(...filters);
}

export async function listFlashcards(input: {
  search?: string;
  limit?: number;
  dueOnly?: boolean;
  chapterNo?: number;
} = {}): Promise<FlashcardListItem[]> {
  const db = await getDb();
  const rows = await db
    .select({
      card: flashcards,
      chapterTitle: chapters.title,
    })
    .from(flashcards)
    .leftJoin(chapters, eq(flashcards.chapterId, chapters.id))
    .where(buildListFilters(input))
    .orderBy(
      asc(flashcards.isSuspended),
      asc(flashcards.fsrsDue),
      desc(flashcards.updatedAt),
    )
    .limit(input.limit ?? 48);

  return rows.map(toListItem);
}

export async function countDueFlashcards(chapterNo?: number | null) {
  const db = await getDb();
  const filters = [
    eq(flashcards.isArchived, 0),
    eq(flashcards.status, "active"),
    eq(flashcards.isSuspended, 0),
    eq(flashcards.isBuried, 0),
    lte(flashcards.fsrsDue, Date.now()),
  ];
  if (chapterNo != null) {
    filters.push(eq(flashcards.chapterNo, chapterNo));
  }
  const rows = await db
    .select({ value: count(flashcards.id) })
    .from(flashcards)
    .where(and(...filters));

  return Number(rows[0]?.value ?? 0);
}

export async function getFlashcardStatsSnapshot(): Promise<FlashcardStatsSnapshot> {
  const db = await getDb();
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const [
    totalRow,
    dueRow,
    suspendedRow,
    reviewedRow,
    newRow,
    learningRow,
    leechRow,
    hardReviewsRow,
    hardReviews7dRow,
    difficultCardsRow,
    avgDifficultyRow,
    recentReviewsRow,
    deckCountRow,
  ] = await Promise.all([
    db.select({ value: count(flashcards.id) }).from(flashcards).where(eq(flashcards.isArchived, 0)),
    db
      .select({ value: count(flashcards.id) })
      .from(flashcards)
      .where(
        and(
          eq(flashcards.isArchived, 0),
          eq(flashcards.status, "active"),
          eq(flashcards.isSuspended, 0),
          eq(flashcards.isBuried, 0),
          lte(flashcards.fsrsDue, now),
        ),
      ),
    db.select({ value: count(flashcards.id) }).from(flashcards).where(and(eq(flashcards.isArchived, 0), eq(flashcards.isSuspended, 1))),
    db.select({ value: count(flashcards.id) }).from(flashcards).where(and(eq(flashcards.isArchived, 0), sql`${flashcards.fsrsReps} > 0`)),
    db.select({ value: count(flashcards.id) }).from(flashcards).where(and(eq(flashcards.isArchived, 0), eq(flashcards.fsrsState, "new"))),
    db
      .select({ value: count(flashcards.id) })
      .from(flashcards)
      .where(and(eq(flashcards.isArchived, 0), or(eq(flashcards.fsrsState, "learning"), eq(flashcards.fsrsState, "relearning")))),
    db.select({ value: count(flashcards.id) }).from(flashcards).where(and(eq(flashcards.isArchived, 0), eq(flashcards.isLeech, 1))),
    db.select({ value: count(flashcardReviews.id) }).from(flashcardReviews).where(eq(flashcardReviews.rating, 2)),
    db.select({ value: count(flashcardReviews.id) }).from(flashcardReviews).where(and(eq(flashcardReviews.rating, 2), gte(flashcardReviews.reviewedAt, weekAgo))),
    db.select({ value: count(flashcards.id) }).from(flashcards).where(and(eq(flashcards.isArchived, 0), gte(flashcards.fsrsDifficulty, 7))),
    db.select({ value: sql<number>`COALESCE(AVG(NULLIF(${flashcards.fsrsDifficulty}, 0)), 0)` }).from(flashcards).where(eq(flashcards.isArchived, 0)),
    db.select({ value: count(flashcardReviews.id) }).from(flashcardReviews).where(gte(flashcardReviews.reviewedAt, weekAgo)),
    db.select({ value: count(flashcardDecks.id) }).from(flashcardDecks),
  ]);

  return {
    total: Number(totalRow[0]?.value ?? 0),
    due: Number(dueRow[0]?.value ?? 0),
    suspended: Number(suspendedRow[0]?.value ?? 0),
    reviewed: Number(reviewedRow[0]?.value ?? 0),
    newCount: Number(newRow[0]?.value ?? 0),
    learning: Number(learningRow[0]?.value ?? 0),
    leech: Number(leechRow[0]?.value ?? 0),
    hardReviews: Number(hardReviewsRow[0]?.value ?? 0),
    hardReviews7d: Number(hardReviews7dRow[0]?.value ?? 0),
    difficultCards: Number(difficultCardsRow[0]?.value ?? 0),
    avgDifficulty: Number(avgDifficultyRow[0]?.value ?? 0),
    recentReviewCount: Number(recentReviewsRow[0]?.value ?? 0),
    deckCount: Number(deckCountRow[0]?.value ?? 0),
  };
}

export async function listRecentFlashcardReviews(limit = 12): Promise<RecentFlashcardReview[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: flashcardReviews.id,
      flashcardId: flashcardReviews.flashcardId,
      rating: flashcardReviews.rating,
      reviewedAt: flashcardReviews.reviewedAt,
      flashcardFrontHtml: flashcards.frontHtml,
    })
    .from(flashcardReviews)
    .innerJoin(flashcards, eq(flashcardReviews.flashcardId, flashcards.id))
    .orderBy(desc(flashcardReviews.reviewedAt))
    .limit(limit);

  return rows.map((row: {
    id: string;
    flashcardId: string;
    rating: 1 | 2 | 3 | 4;
    reviewedAt: number;
    flashcardFrontHtml: string;
  }) => ({
    id: row.id,
    flashcardId: row.flashcardId,
    rating: row.rating,
    reviewedAt: row.reviewedAt,
    flashcardFrontHtml: row.flashcardFrontHtml,
  }));
}

export async function findFlashcardById(id: string) {
  const db = await getDb();
  const rows = await db.select().from(flashcards).where(eq(flashcards.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function insertFlashcard(values: FlashcardInsert) {
  const db = await getDb();
  const rows = await db.insert(flashcards).values(values).returning();
  return rows[0] ?? null;
}

export async function updateFlashcardById(id: string, values: FlashcardUpdate) {
  const db = await getDb();
  const rows = await db
    .update(flashcards)
    .set({ ...values, updatedAt: Date.now() })
    .where(eq(flashcards.id, id))
    .returning();

  return rows[0] ?? null;
}

export async function findChapterByIdOrNo(input: { chapterId?: string | null; chapterNo?: number | null }) {
  const db = await getDb();

  if (input.chapterId) {
    const rows = await db
      .select({
        id: chapters.id,
        chapterNo: chapters.chapterNo,
        title: chapters.title,
      })
      .from(chapters)
      .where(eq(chapters.id, input.chapterId))
      .limit(1);

    return rows[0] ?? null;
  }

  if (input.chapterNo != null) {
    const rows = await db
      .select({
        id: chapters.id,
        chapterNo: chapters.chapterNo,
        title: chapters.title,
      })
      .from(chapters)
      .where(eq(chapters.chapterNo, input.chapterNo))
      .limit(1);

    return rows[0] ?? null;
  }

  return null;
}

export async function findDeckByName(name: string, chapterNo?: number | null) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(flashcardDecks)
    .where(
      chapterNo == null
        ? and(eq(flashcardDecks.name, name), sql`${flashcardDecks.chapterNo} is null`)
        : and(eq(flashcardDecks.name, name), eq(flashcardDecks.chapterNo, chapterNo)),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function insertDeck(values: FlashcardDeckInsert) {
  const db = await getDb();
  const rows = await db.insert(flashcardDecks).values(values).returning();
  return rows[0] ?? null;
}

export async function getLatestReviewHistory(flashcardId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(flashcardReviewHistory)
    .where(and(eq(flashcardReviewHistory.flashcardId, flashcardId), eq(flashcardReviewHistory.undone, 0)))
    .orderBy(desc(flashcardReviewHistory.reviewedAt))
    .limit(1);

  return rows[0] ?? null;
}

export async function getLatestReviewRecord(flashcardId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(flashcardReviews)
    .where(eq(flashcardReviews.flashcardId, flashcardId))
    .orderBy(desc(flashcardReviews.reviewedAt))
    .limit(1);

  return rows[0] ?? null;
}

export async function insertReview(values: FlashcardReviewInsert) {
  const db = await getDb();
  const rows = await db.insert(flashcardReviews).values(values).returning();
  return rows[0] ?? null;
}

export async function insertReviewHistory(values: FlashcardReviewHistoryInsert) {
  const db = await getDb();
  const rows = await db.insert(flashcardReviewHistory).values(values).returning();
  return rows[0] ?? null;
}

export async function markReviewHistoryUndone(id: string) {
  const db = await getDb();
  const rows = await db
    .update(flashcardReviewHistory)
    .set({ undone: 1 })
    .where(eq(flashcardReviewHistory.id, id))
    .returning();

  return rows[0] ?? null;
}

export async function deleteReviewRecord(id: string) {
  const db = await getDb();
  const rows = await db.delete(flashcardReviews).where(eq(flashcardReviews.id, id)).returning();
  return rows[0] ?? null;
}

export async function burySiblingCards(input: { siblingGroup: string; currentCardId: string; until: number }) {
  const db = await getDb();
  const rows = await db
    .update(flashcards)
    .set({
      isBuried: 1,
      buriedUntil: input.until,
      updatedAt: Date.now(),
    })
    .where(and(eq(flashcards.siblingGroup, input.siblingGroup), ne(flashcards.id, input.currentCardId)))
    .returning();

  return rows.length;
}

export async function refreshLeechFlags(flashcardId: string, nextLapses: number) {
  const db = await getDb();
  const isLeech = nextLapses >= 8;
  const rows = await db
    .update(flashcards)
    .set({
      isLeech: isLeech ? 1 : 0,
      leechCount: isLeech ? nextLapses : 0,
      updatedAt: Date.now(),
    })
    .where(eq(flashcards.id, flashcardId))
    .returning();

  return rows[0] ?? null;
}
