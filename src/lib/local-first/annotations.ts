/**
 * Annotation store (Dexie) with outbox integration.
 *
 * Every write here:
 *   1. Commits to the Dexie `annotations` store.
 *   2. Enqueues an outbox row so the sync engine can push to the server.
 *
 * Reads are Dexie-only — never fetch. Callers that need server-truth
 * annotations for a fresh device will get them via the sync engine's pull
 * phase (implemented in Phase 6 alongside the server endpoint).
 */

import { getLocalDb, type AnnotationRow } from "./idb";
import { enqueueMutation, resolveServerId } from "./outbox";
import { uuidV4 } from "./uuid";

/* ── Input types mirroring the existing useReaderAnnotations API ─ */

export interface CreateAnnotationInput {
  docId: string;
  chapterNo: number | null;
  sourceBlockId: string;
  kind: "highlight" | "underline" | "comment";
  color?: string | null;
  comment?: string | null;
  textQuote: string;
  textPositionStart: number;
  textPositionEnd: number;
  prefix: string;
  suffix: string;
  blockChecksum: string;
  /** v8.2: optional persisted content hash for re-anchor fast path. */
  contentHash?: string;
}

/* ── Create ────────────────────────────────────────────────── */

export async function createAnnotation(input: CreateAnnotationInput): Promise<AnnotationRow> {
  const now = new Date().toISOString();
  const row: AnnotationRow = {
    id: uuidV4(),
    serverId: null,
    docId: input.docId,
    chapterNo: input.chapterNo,
    sourceBlockId: input.sourceBlockId,
    kind: input.kind,
    color: input.color ?? null,
    comment: input.comment?.trim() ? input.comment.trim() : null,
    textQuote: input.textQuote,
    textPositionStart: input.textPositionStart,
    textPositionEnd: input.textPositionEnd,
    prefix: input.prefix,
    suffix: input.suffix,
    blockChecksum: input.blockChecksum,
    ...(input.contentHash ? { contentHash: input.contentHash } : {}),
    status: "active",
    localCreatedAt: now,
    localUpdatedAt: now,
  };

  const db = getLocalDb();
  await db.transaction("rw", db.annotations, db.outbox, async () => {
    await db.annotations.put(row);
    await enqueueMutation({
      entityType: "annotation",
      entityLocalId: row.id,
      operation: "create",
      payload: {
        docId: row.docId,
        chapterNo: row.chapterNo,
        sourceBlockId: row.sourceBlockId,
        kind: row.kind,
        color: row.color,
        comment: row.comment,
        textQuote: row.textQuote,
        textPositionStart: row.textPositionStart,
        textPositionEnd: row.textPositionEnd,
        prefix: row.prefix,
        suffix: row.suffix,
        blockChecksum: row.blockChecksum,
        createdAt: row.localCreatedAt,
      },
    });
  });
  return row;
}

/* ── Delete ────────────────────────────────────────────────── */

export async function deleteAnnotation(localId: string): Promise<void> {
  const db = getLocalDb();

  // Find any pending create mutation for this localId so we can depend on it.
  // If the create hasn't reached 'synced' yet, our delete must not race it.
  const pendingCreate = await db.outbox
    .where("[entityType+entityLocalId]")
    .equals(["annotation", localId])
    .and((r) => r.operation === "create" && r.syncStatus !== "synced")
    .first();

  // Prefer any already-mapped server id, fall back to local row's serverId.
  const mappedServerId = await resolveServerId("annotation", localId);

  await db.transaction("rw", db.annotations, db.outbox, db.tombstones, async () => {
    const existing = await db.annotations.get(localId);
    if (!existing) return;
    const now = new Date().toISOString();
    await db.annotations.delete(localId);
    await db.tombstones.put({
      entityType: "annotation",
      localId,
      deletedAt: now,
      serverConfirmedAt: null,
    });
    const serverId = mappedServerId ?? existing.serverId ?? null;
    await enqueueMutation({
      entityType: "annotation",
      entityLocalId: localId,
      entityServerId: serverId,
      operation: "delete",
      payload: { id: serverId ?? localId },
      dependsOn: pendingCreate ? [pendingCreate.mutationId] : [],
    });
  });
}

/* ── Update (e.g. re-anchor, comment edit) ──────────────────── */

export async function updateAnnotationAnchor(
  localId: string,
  patch: Partial<
    Pick<
      AnnotationRow,
      "textPositionStart" | "textPositionEnd" | "blockChecksum" | "status"
    >
  >,
): Promise<void> {
  const db = getLocalDb();
  await db.transaction("rw", db.annotations, async () => {
    const existing = await db.annotations.get(localId);
    if (!existing) return;
    await db.annotations.put({
      ...existing,
      ...patch,
      localUpdatedAt: new Date().toISOString(),
    });
  });
  // Re-anchor is a purely local repair; no outbox entry.
}

export async function markOrphaned(localId: string): Promise<void> {
  await updateAnnotationAnchor(localId, { status: "orphaned" });
}

/* ── Read ──────────────────────────────────────────────────── */

export async function listAnnotationsForDoc(docId: string): Promise<AnnotationRow[]> {
  return getLocalDb().annotations.where("docId").equals(docId).toArray();
}

export async function listOrphanedAnnotations(): Promise<AnnotationRow[]> {
  return getLocalDb().annotations.where("status").equals("orphaned").toArray();
}

/* ── One-time migration from localStorage ──────────────────── */

interface LegacyAnnotation {
  id: string;
  docId: string;
  chapterNo: number;
  frameId: string | null;
  sectionId: string | null;
  quote: string;
  type: "highlight" | "underline" | "comment";
  color?: string | null;
  comment: string | null;
  createdAt: string;
}

const LEGACY_PREFIX = "reader-annotations:";
const MIGRATION_MARK_KEY = "meta";

/**
 * Copy every `reader-annotations:*` localStorage entry into Dexie, marking
 * each migrated annotation as `needs_reanchor` so it re-anchors on next
 * render. localStorage rows are NOT deleted — the Phase 6 cleanup sweep
 * handles that after a successful flag-on period.
 */
export async function migrateAnnotationsFromLocalStorage(): Promise<number> {
  if (typeof window === "undefined") return 0;
  const db = getLocalDb();
  const already = await db.meta.get("annotations-migrated-v1");
  if (already) return 0;

  let migrated = 0;
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(LEGACY_PREFIX)) keys.push(k);
  }

  for (const key of keys) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    let parsed: LegacyAnnotation[] = [];
    try {
      const v = JSON.parse(raw);
      if (Array.isArray(v)) parsed = v as LegacyAnnotation[];
    } catch {
      continue;
    }
    for (const a of parsed) {
      const existing = await db.annotations.get(a.id);
      if (existing) continue;
      const now = new Date().toISOString();
      const row: AnnotationRow = {
        id: a.id,
        serverId: null,
        docId: a.docId,
        chapterNo: a.chapterNo ?? null,
        sourceBlockId: a.frameId ?? "",
        kind: a.type,
        color: a.color ?? null,
        comment: a.comment,
        textQuote: a.quote,
        // No stored offsets in legacy — reanchor will discover them.
        textPositionStart: 0,
        textPositionEnd: 0,
        prefix: "",
        suffix: "",
        blockChecksum: "",
        status: "needs_reanchor",
        localCreatedAt: a.createdAt || now,
        localUpdatedAt: now,
      };
      await db.annotations.put(row);
      migrated++;
    }
  }

  // Mark migration complete so we don't re-run it on every boot.
  await db.meta.put({ key: "annotations-migrated-v1", value: { at: new Date().toISOString() } });
  void MIGRATION_MARK_KEY;
  return migrated;
}
