import Dexie from "dexie";
import { getLocalDb } from "@/lib/local-first/idb";
import { makeAnchorKey } from "./anchor-key";
import type { HandwrittenNote, HandwritingStroke } from "./types";

function now(): string {
  return new Date().toISOString();
}

function newId(): string {
  return crypto.randomUUID();
}

/**
 * Load the handwritten note for a specific anchor, or null if none exists.
 * Only returns notes that have not been soft-deleted.
 */
export async function loadHandwrittenNote(
  chapterId: string,
  segmentId: string,
  blockId: string,
): Promise<HandwrittenNote | null> {
  const anchorKey = makeAnchorKey(chapterId, segmentId, blockId);
  const db = getLocalDb();
  const row = await db.handwrittenNotes
    .where("anchorKey")
    .equals(anchorKey)
    .and((r) => !r.deletedAt)
    .first();
  return row ?? null;
}

/**
 * Save (upsert) strokes for an anchor.
 * Creates a new record on first save; updates strokes + updatedAt on subsequent saves.
 */
export async function saveHandwrittenNote(
  chapterId: string,
  segmentId: string,
  blockId: string,
  strokes: HandwritingStroke[],
  viewportHint?: HandwrittenNote["viewportHint"],
): Promise<HandwrittenNote> {
  const anchorKey = makeAnchorKey(chapterId, segmentId, blockId);
  const db = getLocalDb();

  const existing = await db.handwrittenNotes
    .where("anchorKey")
    .equals(anchorKey)
    .and((r) => !r.deletedAt)
    .first();

  if (existing) {
    const updated: HandwrittenNote = {
      ...existing,
      strokes,
      viewportHint: viewportHint ?? existing.viewportHint,
      updatedAt: now(),
    };
    await db.handwrittenNotes.put(updated);
    return updated;
  }

  const created: HandwrittenNote = {
    id: newId(),
    chapterId,
    segmentId,
    blockId,
    anchorKey,
    strokes,
    viewportHint,
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null,
  };
  await db.handwrittenNotes.put(created);
  return created;
}

/** Soft-delete all handwritten notes for an anchor. */
export async function clearHandwrittenNote(
  chapterId: string,
  segmentId: string,
  blockId: string,
): Promise<void> {
  const anchorKey = makeAnchorKey(chapterId, segmentId, blockId);
  const db = getLocalDb();
  const rows = await db.handwrittenNotes
    .where("anchorKey")
    .equals(anchorKey)
    .and((r) => !r.deletedAt)
    .toArray();
  const ts = now();
  await Promise.all(
    rows.map((r) => db.handwrittenNotes.put({ ...r, deletedAt: ts, updatedAt: ts })),
  );
}

/** List all active (non-deleted) notes for a chapter+segment pair. */
export async function listHandwrittenNotesBySegment(
  chapterId: string,
  segmentId: string,
): Promise<HandwrittenNote[]> {
  const db = getLocalDb();
  return db.handwrittenNotes
    .where("[chapterId+segmentId+blockId]")
    .between(
      [chapterId, segmentId, Dexie.minKey],
      [chapterId, segmentId, Dexie.maxKey],
    )
    .and((r) => !r.deletedAt)
    .toArray();
}
