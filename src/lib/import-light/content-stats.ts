/**
 * Server-side queries for content statistics.
 * Used by the Content Manager page to show totals per category.
 */
import { count, max } from "drizzle-orm";
import { getDb } from "@/db/index";
import { questions, flashcards, noteDocuments, yieldAnnotations } from "@/db/schema";

export type ContentStats = {
  questions: { total: number; lastImportedAt: number | null };
  flashcards: { total: number; lastImportedAt: number | null };
  notes: { total: number; lastImportedAt: number | null };
  yield: { total: number; lastImportedAt: number | null };
};

export type ContentStatsResult =
  | { ok: true; stats: ContentStats }
  | { ok: false; error: string };

/**
 * Error-safe variant — never throws. Returns `{ ok: false, error }` on any
 * DB failure so the caller can render a degraded UI instead of crashing.
 */
export async function safeGetContentStats(): Promise<ContentStatsResult> {
  try {
    return { ok: true, stats: await getContentStats() };
  } catch (err) {
    const message =
      err instanceof Error
        ? `${err.name}: ${err.message}`
        : typeof err === "object" && err !== null
          ? JSON.stringify(err)
          : String(err);
    return { ok: false, error: message };
  }
}

export async function getContentStats(): Promise<ContentStats> {
  const db = await getDb();

  const [qRows, fRows, nRows, yRows] = await Promise.all([
    db.select({ total: count(), lastAt: max(questions.createdAt) }).from(questions),
    db.select({ total: count(), lastAt: max(flashcards.createdAt) }).from(flashcards),
    db.select({ total: count(), lastAt: max(noteDocuments.createdAt) }).from(noteDocuments),
    db.select({ total: count(), lastAt: max(yieldAnnotations.createdAt) }).from(yieldAnnotations),
  ]);

  return {
    questions: {
      total: qRows[0]?.total ?? 0,
      lastImportedAt: qRows[0]?.lastAt ? Number(qRows[0].lastAt) : null,
    },
    flashcards: {
      total: fRows[0]?.total ?? 0,
      lastImportedAt: fRows[0]?.lastAt ? Number(fRows[0].lastAt) : null,
    },
    notes: {
      total: nRows[0]?.total ?? 0,
      lastImportedAt: nRows[0]?.lastAt ? Number(nRows[0].lastAt) : null,
    },
    yield: {
      total: yRows[0]?.total ?? 0,
      lastImportedAt: yRows[0]?.lastAt ? Number(yRows[0].lastAt) : null,
    },
  };
}
