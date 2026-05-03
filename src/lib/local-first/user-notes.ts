/**
 * User notes store — Dexie + outbox integration.
 *
 * Mirrors the annotations.ts pattern:
 *   1. Write to the local Dexie `userNotes` table immediately.
 *   2. Enqueue an outbox mutation so the sync engine pushes to the server.
 *
 * Server-side handlers in the push route:
 *   entityType "note"  → applyUserNote   (create / update / delete)
 *   entityType "note_edit" → applyNoteEdit  (body-only patch — unused here)
 *
 * Phase 1: uses simple create/update/delete (all as "note" mutations).
 * The server's applyUserNote uses INSERT ON CONFLICT DO UPDATE so create
 * and update share the same payload shape.
 */

import { getLocalDb, type UserNoteRow } from "./idb";
import { enqueueMutation, resolveServerId } from "./outbox";
import { uuidV4 } from "./uuid";

/* ── Input types ─────────────────────────────────────────── */

export interface CreateUserNoteInput {
  docId: string;
  segmentId: string;
  chapterNo: number | null;
  title: string | null;
  body: string;
  tags?: string[];
}

export interface UpdateUserNoteInput {
  title?: string | null;
  body?: string;
  tags?: string[];
}

/* ── Create ──────────────────────────────────────────────── */

export async function createUserNote(
  input: CreateUserNoteInput,
): Promise<UserNoteRow> {
  const now = new Date().toISOString();
  const row: UserNoteRow = {
    id: uuidV4(),
    docId: input.docId,
    segmentId: input.segmentId,
    chapterNo: input.chapterNo ?? null,
    title: input.title?.trim() || null,
    body: input.body,
    tagsJson: input.tags?.length ? JSON.stringify(input.tags) : null,
    isDeleted: 0,
    createdAt: now,
    updatedAt: now,
  };

  const db = getLocalDb();
  await db.transaction("rw", db.userNotes, db.outbox, async () => {
    await db.userNotes.put(row);
    await enqueueMutation({
      entityType: "note",
      entityLocalId: row.id,
      operation: "create",
      payload: {
        title: row.title,
        body: row.body,
        tags: input.tags ?? [],
      },
    });
  });

  return row;
}

/* ── Update ──────────────────────────────────────────────── */

export async function updateUserNote(
  id: string,
  patch: UpdateUserNoteInput,
): Promise<void> {
  const db = getLocalDb();
  const existing = await db.userNotes.get(id);
  if (!existing || existing.isDeleted) return;

  const now = new Date().toISOString();
  const updated: UserNoteRow = {
    ...existing,
    title:
      "title" in patch
        ? patch.title?.trim() || null
        : existing.title,
    body: patch.body !== undefined ? patch.body : existing.body,
    tagsJson:
      patch.tags !== undefined
        ? patch.tags.length
          ? JSON.stringify(patch.tags)
          : null
        : existing.tagsJson,
    updatedAt: now,
  };

  await db.transaction("rw", db.userNotes, db.outbox, async () => {
    await db.userNotes.put(updated);
    await enqueueMutation({
      entityType: "note",
      entityLocalId: id,
      operation: "update",
      payload: {
        title: updated.title,
        body: updated.body,
        tags: updated.tagsJson ? (JSON.parse(updated.tagsJson) as string[]) : [],
      },
    });
  });
}

/* ── Delete (soft) ───────────────────────────────────────── */

export async function deleteUserNote(id: string): Promise<void> {
  const db = getLocalDb();

  // Gate the delete on any in-flight create so ordering is preserved.
  const pendingCreate = await db.outbox
    .where("[entityType+entityLocalId]")
    .equals(["note", id])
    .and((r) => r.operation === "create" && r.syncStatus !== "synced")
    .first();

  const mappedServerId = await resolveServerId("note", id);

  await db.transaction("rw", db.userNotes, db.outbox, db.tombstones, async () => {
    const existing = await db.userNotes.get(id);
    if (!existing) return;
    const now = new Date().toISOString();

    // Soft-delete locally so the row survives for tombstone tracking.
    await db.userNotes.put({ ...existing, isDeleted: 1, updatedAt: now });

    await db.tombstones.put({
      entityType: "note",
      localId: id,
      deletedAt: now,
      serverConfirmedAt: null,
    });

    await enqueueMutation({
      entityType: "note",
      entityLocalId: id,
      entityServerId: mappedServerId ?? null,
      operation: "delete",
      payload: { id: mappedServerId ?? id },
      dependsOn: pendingCreate ? [pendingCreate.mutationId] : [],
    });
  });
}

/* ── Read ────────────────────────────────────────────────── */

/**
 * List all active (non-deleted) user notes for a given docId,
 * sorted newest-first by updatedAt.
 */
export async function listUserNotesForDoc(
  docId: string,
): Promise<UserNoteRow[]> {
  const rows = await getLocalDb()
    .userNotes.where("docId")
    .equals(docId)
    .and((r) => !r.isDeleted)
    .toArray();

  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Get a single note by id. Returns null if not found or soft-deleted. */
export async function getUserNote(id: string): Promise<UserNoteRow | null> {
  const row = await getLocalDb().userNotes.get(id);
  return row && !row.isDeleted ? row : null;
}
