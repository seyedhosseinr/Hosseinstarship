/**
 * Dexie (IndexedDB) schema for the local-first layer.
 *
 * Database: `starship-local-first`, version 1.
 *
 * Stores are intentionally kept independent of the existing PGlite OPFS
 * database (`opfs-ahp://starship-v1`). A PGlite corruption must not wipe
 * the outbox, and PGlite migrations must not risk stepping on this store.
 *
 * See `docs/local-first-architecture.md` Â§1.1 for the full spec.
 */

import Dexie, { type Table } from "dexie";
import type { HandwrittenNote } from "@/lib/handwriting/types";

/* â”€â”€ Enums / literal types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export type EntityType =
  | "note"
  | "highlight"
  | "annotation"
  | "flashcard_review"
  | "planner_item"
  | "import_manifest"
  | "imported_file"
  | "note_edit";

export type OutboxStatus =
  | "pending"
  | "in_flight"
  | "synced"
  | "failed"
  | "conflict";

export type OutboxOperation = "create" | "update" | "delete";

export type AnnotationStatus = "active" | "orphaned" | "needs_reanchor";

export type PlannerTaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "skipped";

export type PlannerPlanStatus = "active" | "archived" | "draft";

export type ImportManifestStatus =
  | "queued"
  | "parsing"
  | "ready"
  | "pushed"
  | "failed";

/* â”€â”€ Row types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export interface OutboxRow {
  mutationId: string;
  entityType: EntityType;
  entityLocalId: string;
  entityServerId: string | null;
  operation: OutboxOperation;
  payload: unknown;
  baseVersion: number | null;
  localCreatedAt: string;
  localUpdatedAt: string;
  syncStatus: OutboxStatus;
  attemptCount: number;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  lastError: string | null;
  dependsOn: string[];
}

export interface IdMapRow {
  entityType: EntityType;
  localId: string;
  serverId: string;
  mappedAt: string;
}

export interface TombstoneRow {
  entityType: EntityType;
  localId: string;
  deletedAt: string;
  serverConfirmedAt: string | null;
}

export interface AnnotationRow {
  id: string; // localId (UUID v4)
  serverId: string | null;
  docId: string;
  chapterNo: number | null;
  sourceBlockId: string; // a.k.a. frameId
  kind: "highlight" | "underline" | "comment";
  color: string | null;
  comment: string | null;
  // Anchoring fields
  textQuote: string;
  textPositionStart: number;
  textPositionEnd: number;
  prefix: string;
  suffix: string;
  blockChecksum: string;
  /**
   * v8.2 (optional): persisted contentHash from the frame at capture time.
   * Enables a fast-path in `reanchor`. Absent on legacy rows (pre-v8.2) and
   * on any capture where the frame didn't supply a contentHash â€” both cases
   * are handled by the existing hash16(blockText) path.
   */
  contentHash?: string;
  // Lifecycle
  status: AnnotationStatus;
  localCreatedAt: string;
  localUpdatedAt: string;
}

export interface PlannerPlanRow {
  id: string;
  serverId: string | null;
  title: string;
  status: PlannerPlanStatus;
  startDate: string | null;
  endDate: string | null;
  payload: unknown;
  localUpdatedAt: string;
}

export interface PlannerDayRow {
  id: string;
  serverId: string | null;
  planId: string;
  isoDate: string;
  payload: unknown;
  localUpdatedAt: string;
}

export interface PlannerTaskRow {
  id: string;
  serverId: string | null;
  planId: string;
  dayId: string;
  scheduledFor: string;
  status: PlannerTaskStatus;
  title: string;
  kind: string;
  payload: unknown;
  localUpdatedAt: string;
}

export interface FlashcardReviewRow {
  reviewLocalId: string; // same as mutationId of the matching outbox entry
  flashcardId: string;
  rating: number; // FSRS grade 1..4
  reviewedAt: string;
  nextDue: string | null;
  payload: unknown;
  synced: 0 | 1; // indexed as number
}

export interface NoteEditRow {
  editLocalId: string;
  noteId: string;
  diff: unknown;
  appliedAt: string;
  synced: 0 | 1;
}

export interface ImportManifestRow {
  sha256: string;
  serverId: string | null;
  originalName: string;
  mime: string;
  sizeBytes: number;
  status: ImportManifestStatus;
  localCreatedAt: string;
  lastError: string | null;
}

export interface DashboardSnapshotRow {
  name: "latest";
  capturedAt: string;
  stats: unknown;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export interface UndoEntry {
  id: string;
  entityType: EntityType;
  entityLocalId: string;
  inverseOperation: OutboxOperation;
  inversePayload: unknown;
  createdAt: string;
}

export interface AttachmentMapRow {
  url: string;
  sha256: string;
  ext: string;
  sizeBytes: number;
  cachedAt: string;
  lastAccessedAt: string;
}

/**
 * Local user note row — mirrors the server-side `lf_user_notes` table.
 * isDeleted uses 0/1 so it can be indexed in Dexie (booleans are not
 * indexable in IndexedDB).
 */
export interface UserNoteRow {
  id: string;
  docId: string;
  segmentId: string;
  chapterNo: number | null;
  title: string | null;
  body: string;
  tagsJson: string | null;
  isDeleted: 0 | 1;
  createdAt: string;
  updatedAt: string;
}

/* â”€â”€ Dexie class â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export class StarshipLocalFirstDb extends Dexie {
  outbox!: Table<OutboxRow, string>;
  idMap!: Table<IdMapRow, [EntityType, string]>;
  tombstones!: Table<TombstoneRow, [EntityType, string]>;
  annotations!: Table<AnnotationRow, string>;
  plannerPlans!: Table<PlannerPlanRow, string>;
  plannerDays!: Table<PlannerDayRow, string>;
  plannerTasks!: Table<PlannerTaskRow, string>;
  flashcardReviews!: Table<FlashcardReviewRow, string>;
  noteEdits!: Table<NoteEditRow, string>;
  importManifests!: Table<ImportManifestRow, string>;
  dashboardSnapshot!: Table<DashboardSnapshotRow, string>;
  meta!: Table<MetaRow, string>;
  undoStack!: Table<UndoEntry, string>;
  attachmentMap!: Table<AttachmentMapRow, string>;
  handwrittenNotes!: Table<HandwrittenNote, string>;
  userNotes!: Table<UserNoteRow, string>;

  constructor() {
    super("starship-local-first");
    this.version(1).stores({
      outbox:
        "mutationId, syncStatus, entityType, nextAttemptAt, localCreatedAt, [entityType+entityLocalId], [syncStatus+nextAttemptAt]",
      idMap:
        "[entityType+localId], entityType, serverId, [entityType+serverId]",
      tombstones:
        "[entityType+localId], entityType, deletedAt, serverConfirmedAt",
      annotations:
        "id, docId, chapterNo, sourceBlockId, status, [docId+sourceBlockId], localUpdatedAt",
      plannerPlans: "id, status",
      plannerDays: "id, planId, isoDate",
      plannerTasks:
        "id, planId, dayId, scheduledFor, status, localUpdatedAt",
      flashcardReviews:
        "reviewLocalId, flashcardId, reviewedAt, synced",
      noteEdits: "editLocalId, noteId, appliedAt, synced",
      importManifests: "sha256, status, localCreatedAt, serverId",
      dashboardSnapshot: "name",
      meta: "key",
    });
    this.version(2).stores({
      undoStack: "id, entityType, entityLocalId, createdAt",
      attachmentMap: "url, sha256, lastAccessedAt",
    });
    this.version(3).stores({
      handwrittenNotes:
        "id, anchorKey, chapterId, segmentId, blockId, updatedAt, deletedAt, [chapterId+segmentId+blockId]",
    });
    this.version(4).stores({
      userNotes:
        "id, docId, segmentId, chapterNo, isDeleted, updatedAt, [docId+isDeleted]",
    });
  }
}

/* â”€â”€ Singleton accessor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

let _db: StarshipLocalFirstDb | null = null;

/**
 * Returns the singleton Dexie instance. MUST only be called in a browser
 * context â€” server-side callers will see a loud error because Dexie cannot
 * open without `indexedDB`. Callers should gate on `typeof window !== 'undefined'`
 * or on `isLocalFirstEnabled()` which also implies a browser.
 */
export function getLocalDb(): StarshipLocalFirstDb {
  if (typeof window === "undefined") {
    throw new Error("getLocalDb() called on the server");
  }
  if (!_db) _db = new StarshipLocalFirstDb();
  return _db;
}

/** Destroy + reopen (used by debug panel reset button). */
export async function resetLocalDb(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    if (_db) {
      await _db.delete();
      _db = null;
    } else {
      await Dexie.delete("starship-local-first");
    }
  } catch {
    /* swallow â€” the reopen will surface any real error */
  }
}

/* â”€â”€ Meta k/v helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export async function getMeta<T>(key: string): Promise<T | null> {
  const row = await getLocalDb().meta.get(key);
  return row ? (row.value as T) : null;
}

export async function setMeta<T>(key: string, value: T): Promise<void> {
  await getLocalDb().meta.put({ key, value });
}
