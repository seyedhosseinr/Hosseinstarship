/**
 * annotation-repository.ts
 * Browser-only. Never import in server components or API routes.
 *
 * Single write path: all annotation mutations go through applyAnnotationOp.
 * Allowed layering: UI → store.applyOp → applyAnnotationOp → this module → PGLite/OPFS + CRDT
 *
 * CRDT integration (Prompt 6):
 *   After each PGLite write, the mutation is mirrored to the Yjs CRDT doc via
 *   crdtManager. The CRDT doc is the sync layer; PGLite is the query cache.
 *   Ops are queued inside crdtManager if the doc is not yet initialised and
 *   flushed automatically once init() resolves — no silent drops.
 */

import { getBrowserDb } from "@/db/pglite-browser";
import { crdtManager } from "@/lib/crdt-manager";
import type {
  Annotation,
  AnnotationOp,
  AnnotationTarget,
  BookmarkAnnotation,
  CommentAnnotation,
  MarkerAnnotation,
  StrokeAnnotationMetadata,
  StrokePoint,
} from "@/types/annotation";

// ── OPFS availability ─────────────────────────────────────────────────────────

let _opfsAvailable: boolean | null = null;

async function isOpfsAvailable(): Promise<boolean> {
  if (_opfsAvailable !== null) return _opfsAvailable;
  try {
    await navigator.storage.getDirectory();
    _opfsAvailable = true;
  } catch {
    _opfsAvailable = false;
  }
  return _opfsAvailable;
}

// ── OPFS key conventions ──────────────────────────────────────────────────────

/** Key stored in PGLite stroke_blob_ref column */
export function strokeBlobKey(segmentId: string, annotationId: string): string {
  return `outliner-strokes:${segmentId}:${annotationId}`;
}

/** OPFS filename within the outliner-strokes directory */
function strokeBlobFilename(segmentId: string, annotationId: string): string {
  // Use __ separator so both parts are recoverable; colons are invalid on some FS
  return `${segmentId}__${annotationId}.json`;
}

// ── Stroke blob storage ───────────────────────────────────────────────────────

export async function writeStrokeBlob(
  segmentId: string,
  annotationId: string,
  points: StrokePoint[],
): Promise<void> {
  const data = JSON.stringify(points);

  if (await isOpfsAvailable()) {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle("outliner-strokes", { create: true });
    const file = await dir.getFileHandle(strokeBlobFilename(segmentId, annotationId), { create: true });
    const writable = await file.createWritable();
    await writable.write(data);
    await writable.close();
  } else {
    // Fallback: localStorage — use only when OPFS unavailable; large stroke arrays may hit quota
    try {
      localStorage.setItem(strokeBlobKey(segmentId, annotationId), data);
    } catch {
      console.warn("[annotation-repository] localStorage fallback write failed for", annotationId);
    }
  }
}

export async function readStrokeBlob(
  segmentId: string,
  annotationId: string,
): Promise<StrokePoint[] | null> {
  if (await isOpfsAvailable()) {
    try {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle("outliner-strokes", { create: true });
      const file = await dir.getFileHandle(strokeBlobFilename(segmentId, annotationId));
      const fileObj = await file.getFile();
      const text = await fileObj.text();
      return JSON.parse(text) as StrokePoint[];
    } catch {
      return null;
    }
  } else {
    const raw = localStorage.getItem(strokeBlobKey(segmentId, annotationId));
    return raw ? (JSON.parse(raw) as StrokePoint[]) : null;
  }
}

async function deleteStrokeBlob(segmentId: string, annotationId: string): Promise<void> {
  if (await isOpfsAvailable()) {
    try {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle("outliner-strokes", { create: true });
      await dir.removeEntry(strokeBlobFilename(segmentId, annotationId));
    } catch { /* already gone */ }
  } else {
    localStorage.removeItem(strokeBlobKey(segmentId, annotationId));
  }
}

// ── PGLite row type ───────────────────────────────────────────────────────────

interface AnnotationRow {
  id: string;
  segment_id: string;
  type: string;
  target_kind: string;
  surface_id: string;
  object_id: string;
  color: string | null;
  width: number | null;
  snapped: number | null;
  snapped_shape: string | null;
  bounds_json: string | null;
  body: string | null;
  resolved: number | null;
  importance: string | null;
  stroke_blob_ref: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

function rowToAnnotation(row: AnnotationRow): Annotation | null {
  const target: AnnotationTarget = {
    segmentId: row.segment_id,
    kind: row.target_kind as AnnotationTarget["kind"],
    surfaceId: row.surface_id,
    objectId: row.object_id,
  };

  if (row.type === "stroke" || row.type === "arrow") {
    const m: StrokeAnnotationMetadata = {
      id: row.id,
      type: row.type,
      target,
      color: row.color ?? "#ef4444",
      width: row.width ?? 2,
      snapped: !!row.snapped,
      snappedShape: (row.snapped_shape as "line" | "arrow" | "enclosure" | null) ?? null,
      bounds: row.bounds_json
        ? (JSON.parse(row.bounds_json) as StrokeAnnotationMetadata["bounds"])
        : { minX: 0, minY: 0, maxX: 0, maxY: 0 },
      strokeBlobRef: row.stroke_blob_ref ?? strokeBlobKey(row.segment_id, row.id),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    return m;
  }

  if (row.type === "comment") {
    const c: CommentAnnotation = {
      id: row.id,
      type: "comment",
      target,
      body: row.body ?? "",
      resolved: !!row.resolved,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    return c;
  }

  if (row.type === "bookmark") {
    const b: BookmarkAnnotation = {
      id: row.id,
      type: "bookmark",
      target,
      createdAt: row.created_at,
    };
    return b;
  }

  if (row.type === "marker" || row.type === "highlight") {
    const m: MarkerAnnotation = {
      id: row.id,
      type: row.type,
      target,
      importance: (row.importance as "important" | "resolved") ?? "important",
      createdAt: row.created_at,
    };
    return m;
  }

  return null;
}

// ── Upsert (used by CRDT hydration) ──────────────────────────────────────────

// Returns the most-recent timestamp for any annotation type.
// Stroke/Comment have an explicit updatedAt; Bookmark/Marker only have createdAt.
function annotationTimestamp(a: Annotation): number {
  return (a as unknown as { updatedAt?: number }).updatedAt ?? a.createdAt;
}

/**
 * Upsert a single annotation into PGLite from the CRDT doc.
 * Source-of-truth contract: never overwrite a PGLite row that is the same age or
 * newer than the CRDT entry. Each ON CONFLICT clause includes a WHERE guard so
 * the UPDATE is skipped when outliner_annotations.updated_at >= EXCLUDED.updated_at.
 */
export async function upsertAnnotationMeta(annotation: Annotation): Promise<void> {
  const { pg } = await getBrowserDb();
  const t = annotation.target;

  if (annotation.type === "stroke" || annotation.type === "arrow") {
    const s = annotation as StrokeAnnotationMetadata;
    const ts = annotationTimestamp(s);
    await pg.query(
      `INSERT INTO outliner_annotations
         (id, segment_id, type, target_kind, surface_id, object_id,
          color, width, snapped, snapped_shape, bounds_json, stroke_blob_ref,
          created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (id) DO UPDATE SET
         color = EXCLUDED.color, width = EXCLUDED.width,
         updated_at = EXCLUDED.updated_at, deleted_at = NULL
       WHERE outliner_annotations.updated_at < EXCLUDED.updated_at`,
      [
        s.id, t.segmentId, s.type, t.kind, t.surfaceId, t.objectId,
        s.color, s.width, s.snapped ? 1 : 0, s.snappedShape ?? null,
        JSON.stringify(s.bounds),
        strokeBlobKey(t.segmentId, s.id),
        s.createdAt, ts,
      ],
    );
    return;
  }

  if (annotation.type === "comment") {
    const c = annotation as CommentAnnotation;
    const ts = annotationTimestamp(c);
    await pg.query(
      `INSERT INTO outliner_annotations
         (id, segment_id, type, target_kind, surface_id, object_id,
          body, resolved, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET
         body = EXCLUDED.body, resolved = EXCLUDED.resolved,
         updated_at = EXCLUDED.updated_at, deleted_at = NULL
       WHERE outliner_annotations.updated_at < EXCLUDED.updated_at`,
      [
        c.id, t.segmentId, "comment", t.kind, t.surfaceId, t.objectId,
        c.body, c.resolved ? 1 : 0, c.createdAt, ts,
      ],
    );
    return;
  }

  if (annotation.type === "bookmark") {
    const b = annotation as BookmarkAnnotation;
    const ts = annotationTimestamp(b); // createdAt fallback (no updatedAt on BookmarkAnnotation)
    await pg.query(
      `INSERT INTO outliner_annotations
         (id, segment_id, type, target_kind, surface_id, object_id,
          created_at, updated_at)
       VALUES ($1,$2,'bookmark',$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET
         updated_at = EXCLUDED.updated_at, deleted_at = NULL
       WHERE outliner_annotations.updated_at < EXCLUDED.updated_at`,
      [b.id, t.segmentId, t.kind, t.surfaceId, t.objectId, b.createdAt, ts],
    );
    return;
  }

  if (annotation.type === "marker" || annotation.type === "highlight") {
    const m = annotation as MarkerAnnotation;
    const ts = annotationTimestamp(m); // createdAt fallback (no updatedAt on MarkerAnnotation)
    await pg.query(
      `INSERT INTO outliner_annotations
         (id, segment_id, type, target_kind, surface_id, object_id,
          importance, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET
         importance = EXCLUDED.importance,
         updated_at = EXCLUDED.updated_at, deleted_at = NULL
       WHERE outliner_annotations.updated_at < EXCLUDED.updated_at`,
      [
        m.id, t.segmentId, m.type, t.kind, t.surfaceId, t.objectId,
        m.importance, m.createdAt, ts,
      ],
    );
  }
}

// ── CRDT hydration ────────────────────────────────────────────────────────────

/**
 * hydratePGLiteFromCRDT()
 * ────────────────────────
 * On segment load, pull all annotation metadata from the CRDT doc and upsert
 * into PGLite. Each upsert is guarded by an updatedAt comparison so PGLite
 * rows that are same-age or newer than the CRDT entry are never overwritten.
 *
 * Stroke blobs (StrokePoint[]) are NOT in Yjs in v1 — they live in OPFS only.
 * No stroke blob restoration happens here.
 *
 * Call after crdtManager.init(segmentId) resolves.
 */
export async function hydratePGLiteFromCRDT(segmentId: string): Promise<void> {
  if (!crdtManager.isReady()) return;

  const allMeta = crdtManager.getAllAnnotations();
  for (const [, annotation] of allMeta) {
    if (annotation.target?.segmentId !== segmentId) continue;
    try {
      await upsertAnnotationMeta(annotation);
    } catch (err) {
      console.warn("[annotation-repository] hydration upsert failed for", annotation.id, err);
    }
  }
}

// ── Read ─────────────────────────────────────────────────────────────────────

export async function loadAnnotationsForSurface(
  segmentId: string,
  surfaceId: string,
): Promise<Annotation[]> {
  const { pg } = await getBrowserDb();
  const result = await pg.query<AnnotationRow>(
    `SELECT * FROM outliner_annotations
     WHERE segment_id = $1 AND surface_id = $2 AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [segmentId, surfaceId],
  );
  return result.rows.flatMap((row) => {
    const a = rowToAnnotation(row);
    return a ? [a] : [];
  });
}

// ── applyAnnotationOp — single write path ─────────────────────────────────────

export async function applyAnnotationOp(op: AnnotationOp): Promise<void> {
  const { pg } = await getBrowserDb();
  const now = Date.now();

  switch (op.op) {
    case "addStroke": {
      const m = op.payload;
      await writeStrokeBlob(m.target.segmentId, m.id, op.points);
      await pg.query(
        `INSERT INTO outliner_annotations
           (id, segment_id, type, target_kind, surface_id, object_id,
            color, width, snapped, snapped_shape, bounds_json, stroke_blob_ref,
            created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (id) DO NOTHING`,
        [
          m.id, m.target.segmentId, m.type, m.target.kind,
          m.target.surfaceId, m.target.objectId,
          m.color, m.width, m.snapped ? 1 : 0, m.snappedShape ?? null,
          JSON.stringify(m.bounds),
          strokeBlobKey(m.target.segmentId, m.id),
          m.createdAt, m.updatedAt,
        ],
      );
      // CRDT mirror: metadata only — stroke blobs live in OPFS (v1 policy)
      if (crdtManager.isReady()) {
        crdtManager.addAnnotation(m);
      }
      break;
    }

    case "deleteStroke": {
      await deleteStrokeBlob(op.segmentId, op.id);
      await pg.query(
        `UPDATE outliner_annotations SET deleted_at = $1, updated_at = $2 WHERE id = $3`,
        [now, now, op.id],
      );
      // CRDT mirror: soft-delete metadata only
      if (crdtManager.isReady()) {
        crdtManager.deleteAnnotation(op.id);
      }
      break;
    }

    case "updateStroke": {
      if (op.patch.color !== undefined) {
        await pg.query(
          `UPDATE outliner_annotations SET color = $1, updated_at = $2 WHERE id = $3`,
          [op.patch.color, now, op.id],
        );
      }
      // CRDT mirror: patch the annotation JSON
      if (crdtManager.isReady()) {
        crdtManager.updateAnnotation(op.id, op.patch);
      }
      break;
    }

    case "addComment": {
      const c = op.payload;
      await pg.query(
        `INSERT INTO outliner_annotations
           (id, segment_id, type, target_kind, surface_id, object_id,
            body, resolved, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO NOTHING`,
        [
          c.id, c.target.segmentId, "comment", c.target.kind,
          c.target.surfaceId, c.target.objectId,
          c.body, 0, c.createdAt, c.updatedAt,
        ],
      );
      // CRDT mirror
      if (crdtManager.isReady()) {
        crdtManager.addAnnotation(c);
      }
      break;
    }

    case "updateComment": {
      const { patch } = op;
      if (patch.body !== undefined) {
        await pg.query(
          `UPDATE outliner_annotations SET body = $1, updated_at = $2 WHERE id = $3`,
          [patch.body, now, op.id],
        );
      }
      if (patch.resolved !== undefined) {
        await pg.query(
          `UPDATE outliner_annotations SET resolved = $1, updated_at = $2 WHERE id = $3`,
          [patch.resolved ? 1 : 0, now, op.id],
        );
      }
      // CRDT mirror
      if (crdtManager.isReady()) {
        crdtManager.updateAnnotation(op.id, patch as Partial<Record<string, unknown>>);
      }
      break;
    }

    case "deleteComment": {
      await pg.query(
        `UPDATE outliner_annotations SET deleted_at = $1, updated_at = $2 WHERE id = $3`,
        [now, now, op.id],
      );
      // CRDT mirror
      if (crdtManager.isReady()) {
        crdtManager.deleteAnnotation(op.id);
      }
      break;
    }

    case "toggleBookmark": {
      const t = op.target;
      const existing = await pg.query<{ id: string; deleted_at: number | null }>(
        `SELECT id, deleted_at FROM outliner_annotations
         WHERE segment_id = $1 AND surface_id = $2 AND object_id = $3 AND type = 'bookmark'
         LIMIT 1`,
        [t.segmentId, t.surfaceId, t.objectId],
      );
      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        const nextDeleted = row.deleted_at == null ? now : null;
        await pg.query(
          `UPDATE outliner_annotations SET deleted_at = $1, updated_at = $2 WHERE id = $3`,
          [nextDeleted, now, row.id],
        );
        // CRDT mirror: bookmark is now active or removed
        if (crdtManager.isReady()) {
          const isNowActive = nextDeleted === null;
          crdtManager.setBookmark(t.objectId, isNowActive);
          if (isNowActive) {
            const bm: BookmarkAnnotation = { id: row.id, type: "bookmark", target: t, createdAt: now };
            crdtManager.addAnnotation(bm);
          } else {
            crdtManager.deleteAnnotation(row.id);
          }
        }
      } else {
        const id = crypto.randomUUID();
        await pg.query(
          `INSERT INTO outliner_annotations
             (id, segment_id, type, target_kind, surface_id, object_id, created_at, updated_at)
           VALUES ($1,$2,'bookmark',$3,$4,$5,$6,$7)`,
          [id, t.segmentId, t.kind, t.surfaceId, t.objectId, now, now],
        );
        // CRDT mirror: new bookmark added
        if (crdtManager.isReady()) {
          const bm: BookmarkAnnotation = { id, type: "bookmark", target: t, createdAt: now };
          crdtManager.addAnnotation(bm);
          crdtManager.setBookmark(t.objectId, true);
        }
      }
      break;
    }

    case "markImportant": {
      const t = op.target;
      const existing = await pg.query<{ id: string }>(
        `SELECT id FROM outliner_annotations
         WHERE segment_id = $1 AND surface_id = $2 AND object_id = $3
           AND type IN ('marker','highlight') AND deleted_at IS NULL
         LIMIT 1`,
        [t.segmentId, t.surfaceId, t.objectId],
      );
      if (existing.rows.length > 0) {
        await pg.query(
          `UPDATE outliner_annotations
           SET importance = $1, deleted_at = NULL, updated_at = $2
           WHERE id = $3`,
          [op.importance, now, existing.rows[0].id],
        );
        // CRDT mirror
        if (crdtManager.isReady()) {
          crdtManager.setMarker(t.objectId, op.importance);
          crdtManager.updateAnnotation(existing.rows[0].id, { importance: op.importance });
        }
      } else {
        const id = crypto.randomUUID();
        await pg.query(
          `INSERT INTO outliner_annotations
             (id, segment_id, type, target_kind, surface_id, object_id,
              importance, created_at, updated_at)
           VALUES ($1,$2,'marker',$3,$4,$5,$6,$7,$8)`,
          [id, t.segmentId, t.kind, t.surfaceId, t.objectId, op.importance, now, now],
        );
        // CRDT mirror
        if (crdtManager.isReady()) {
          const marker: MarkerAnnotation = {
            id, type: "marker", target: t, importance: op.importance, createdAt: now,
          };
          crdtManager.addAnnotation(marker);
          crdtManager.setMarker(t.objectId, op.importance);
        }
      }
      break;
    }

    case "deleteMarker": {
      await pg.query(
        `UPDATE outliner_annotations SET deleted_at = $1, updated_at = $2 WHERE id = $3`,
        [now, now, op.id],
      );
      // CRDT mirror — objectId unknown here, use deleteAnnotation only
      if (crdtManager.isReady()) {
        crdtManager.deleteAnnotation(op.id);
      }
      break;
    }
  }
}
