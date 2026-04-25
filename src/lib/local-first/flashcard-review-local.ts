/**
 * Local-first flashcard review submission.
 *
 * The existing path (`FlashcardReviewScreen` + `useOptimisticFlashcard`)
 * already updates PGlite immediately. The gap is: reviews are then POSTed
 * non-idempotently via a server call that is lost if the network is down.
 *
 * This module provides an idempotent alternative: every review is written
 * as a Dexie row with a stable `reviewLocalId = mutationId` so the server
 * can dedupe on the push endpoint. Callers do NOT need to re-apply FSRS
 * locally — `FlashcardReviewScreen` already does that via `ts-fsrs`.
 */

import type { FlashcardReviewRow } from "./idb";
import { getLocalDb } from "./idb";
import { enqueueMutation } from "./outbox";
import { uuidV4 } from "./uuid";

export interface SubmitReviewInput {
  flashcardId: string;
  /** FSRS grade: 1 = Again, 2 = Hard, 3 = Good, 4 = Easy. */
  rating: 1 | 2 | 3 | 4;
  reviewedAt?: string;
  nextDue?: string | null;
  /** Opaque FSRS state the server should persist verbatim. */
  payload: unknown;
}

export interface SubmitReviewResult {
  reviewLocalId: string;
  mutationId: string;
}

/**
 * Persist a review locally and enqueue it for server push.
 *
 * Idempotency: `reviewLocalId` IS the mutationId. If the network fails and
 * the client retries, the same UUID reaches the server both times and the
 * server dedupes. Never derive a review id from `Date.now()`.
 */
export async function submitReviewLocal(
  input: SubmitReviewInput,
): Promise<SubmitReviewResult> {
  const reviewLocalId = uuidV4();
  const reviewedAt = input.reviewedAt ?? new Date().toISOString();
  const row: FlashcardReviewRow = {
    reviewLocalId,
    flashcardId: input.flashcardId,
    rating: input.rating,
    reviewedAt,
    nextDue: input.nextDue ?? null,
    payload: input.payload,
    synced: 0,
  };

  const db = getLocalDb();
  await db.transaction("rw", db.flashcardReviews, db.outbox, async () => {
    await db.flashcardReviews.put(row);
    await enqueueMutation({
      entityType: "flashcard_review",
      entityLocalId: reviewLocalId,
      operation: "create",
      payload: {
        reviewLocalId,
        flashcardId: row.flashcardId,
        rating: row.rating,
        reviewedAt: row.reviewedAt,
        nextDue: row.nextDue,
        fsrs: row.payload,
      },
    });
  });

  return { reviewLocalId, mutationId: reviewLocalId };
}

/** Mark a review row as synced (used by the sync-engine pull phase). */
export async function markReviewSynced(reviewLocalId: string): Promise<void> {
  const db = getLocalDb();
  const row = await db.flashcardReviews.get(reviewLocalId);
  if (!row) return;
  await db.flashcardReviews.put({ ...row, synced: 1 });
}

export async function listUnsyncedReviews(): Promise<FlashcardReviewRow[]> {
  return getLocalDb().flashcardReviews.where("synced").equals(0).toArray();
}
