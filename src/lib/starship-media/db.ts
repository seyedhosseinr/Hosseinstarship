/**
 * DB adapters for the Phase 3 media-bundle pipeline.
 *
 * Two narrow helpers extracted from the API route so the upsert
 * contract and the row→client mapping can be unit-tested directly
 * against a real Drizzle/PGlite instance — without going through HTTP
 * + multipart parsing every time. The route is a thin wrapper around
 * these.
 *
 * Two correctness contracts these functions LOCK in (each surfaced
 * during Phase 3.5 manual verification):
 *
 *   1. The pre-flight existence query MUST use `inArray` (compiles to
 *      `WHERE media_id IN ($1, $2, ...)`). The naive form
 *      `sql\`= ANY(${ids})\`` compiles to `= ANY(($1, $2))` — the
 *      record-tuple form, which both Postgres and PGlite reject.
 *
 *   2. `tags` round-trips through a TEXT column as JSON. The schema's
 *      `.$type<string[] | null>()` is a TS-only annotation; the
 *      runtime value MUST be JSON.stringify'd on write and JSON.parse'd
 *      on read. Mirrors `lf_user_notes.tagsJson` and the
 *      `import-light/jsonField` convention.
 */

import { eq, inArray, sql } from "drizzle-orm";
import { mediaAssetPayloads, mediaAssets } from "@/db/schema";
import type { AppDrizzleInstance } from "@/db/index";
import type { AssetUpserter, MediaAssetUpsertRow } from "./importer";
import type { MediaAsset, MediaAssetKind } from "./types";
import {
  buildBundledMediaServePath,
  storagePathToBundledMediaKey,
} from "./storage";

/**
 * Bulk upsert N media-asset rows into the `media_assets` table, keyed
 * by the unique `media_id` column. Returns the inserted-vs-updated
 * split so the importer summary can show a meaningful count after a
 * re-import. Drizzle batches every value tuple into a single
 * `INSERT ... ON CONFLICT (media_id) DO UPDATE SET ...` statement.
 *
 * Boolean stored as 0/1 (project convention; see `lf_user_notes.is_deleted`).
 */
export async function upsertMediaAssetsBatch(
  db: AppDrizzleInstance,
  rows: MediaAssetUpsertRow[],
  now: number = Date.now(),
): Promise<{ inserted: number; updated: number }> {
  if (rows.length === 0) return { inserted: 0, updated: 0 };

  const ids = rows.map((r) => r.mediaId);

  // `inArray` compiles to `media_id IN ($1, $2, ...)` — portable across
  // Postgres + PGlite. Avoids `= ANY((p1, p2))` (record-tuple form).
  const existing = await db
    .select({ mediaId: mediaAssets.mediaId })
    .from(mediaAssets)
    .where(inArray(mediaAssets.mediaId, ids));
  const existingSet = new Set(existing.map((e) => e.mediaId));

  const values = rows.map((r) => ({
    id: r.mediaId,
    mediaId: r.mediaId,
    chapterNumber: r.chapterNumber,
    segmentId: r.segmentId,
    refId: r.refId,
    figureLabel: r.figureLabel,
    kind: r.kind,
    filename: r.filename,
    storagePath: r.storagePath,
    sourcePage: r.sourcePage,
    caption: r.caption,
    // The schema's `.$type<string[] | null>()` is a TS-only annotation;
    // the column itself is plain TEXT. Match the project-wide
    // `jsonField` convention: stringify on write, parse on read.
    tagsJson: r.tags ? (JSON.stringify(r.tags) as unknown as string[]) : null,
    highYield: r.highYield ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  }));

  await db
    .insert(mediaAssets)
    .values(values)
    .onConflictDoUpdate({
      target: mediaAssets.mediaId,
      set: {
        chapterNumber: sql`excluded.chapter_number`,
        segmentId: sql`excluded.segment_id`,
        refId: sql`excluded.ref_id`,
        figureLabel: sql`excluded.figure_label`,
        kind: sql`excluded.kind`,
        filename: sql`excluded.filename`,
        storagePath: sql`excluded.storage_path`,
        sourcePage: sql`excluded.source_page`,
        caption: sql`excluded.caption`,
        tagsJson: sql`excluded.tags_json`,
        highYield: sql`excluded.high_yield`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

  const inserted = rows.length - existingSet.size;
  const updated = rows.length - inserted;
  return { inserted, updated };
}

/** Drizzle-backed `AssetUpserter` for the production route. */
export function drizzleUpserter(db: AppDrizzleInstance): AssetUpserter {
  return {
    upsert: (rows) => upsertMediaAssetsBatch(db, rows),
  };
}

export interface MediaAssetPayloadUpsertRow {
  storageKey: string;
  contentType: string;
  base64Data: string;
  byteLength: number;
}

export async function upsertMediaAssetPayloadsBatch(
  db: AppDrizzleInstance,
  rows: MediaAssetPayloadUpsertRow[],
  now: number = Date.now(),
): Promise<{ inserted: number; updated: number }> {
  if (rows.length === 0) return { inserted: 0, updated: 0 };

  const keys = rows.map((row) => row.storageKey);
  const existing = await db
    .select({ storageKey: mediaAssetPayloads.storageKey })
    .from(mediaAssetPayloads)
    .where(inArray(mediaAssetPayloads.storageKey, keys));
  const existingSet = new Set(existing.map((row) => row.storageKey));

  await db
    .insert(mediaAssetPayloads)
    .values(
      rows.map((row) => ({
        storageKey: row.storageKey,
        contentType: row.contentType,
        base64Data: row.base64Data,
        byteLength: row.byteLength,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: mediaAssetPayloads.storageKey,
      set: {
        contentType: sql`excluded.content_type`,
        base64Data: sql`excluded.base64_data`,
        byteLength: sql`excluded.byte_length`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

  const inserted = rows.length - existingSet.size;
  const updated = rows.length - inserted;
  return { inserted, updated };
}

export async function getMediaAssetPayloadByStorageKey(
  db: AppDrizzleInstance,
  storageKey: string,
): Promise<{
  storageKey: string;
  contentType: string;
  base64Data: string;
  byteLength: number;
} | null> {
  const [row] = await db
    .select()
    .from(mediaAssetPayloads)
    .where(eq(mediaAssetPayloads.storageKey, storageKey))
    .limit(1);

  if (!row) return null;

  return {
    storageKey: row.storageKey,
    contentType: row.contentType,
    base64Data: row.base64Data,
    byteLength: row.byteLength,
  };
}

/**
 * Fetch every `media_assets` row for one chapter and convert each into
 * the client-shaped `MediaAsset`. Used by `GET /api/media-registry/:chapter`.
 *
 * Critical: `tags_json` is decoded back into `string[]` here. The
 * registry route used to return the raw column value, which broke the
 * resolver's tier-3 contract whenever an importer wrote tags through
 * the new pipeline.
 */
export async function listMediaAssetsForChapter(
  db: AppDrizzleInstance,
  chapterNumber: number,
): Promise<MediaAsset[]> {
  const rows = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.chapterNumber, chapterNumber));
  return rows.map(rowToMediaAsset);
}

/** Convert a raw `media_assets` row into the client-facing `MediaAsset`. */
export function rowToMediaAsset(
  row: typeof mediaAssets.$inferSelect,
): MediaAsset {
  const normalizedStoragePath = normalizeMediaStoragePath(row.storagePath);
  return {
    id: row.id,
    mediaId: row.mediaId,
    chapterNumber: row.chapterNumber,
    segmentId: row.segmentId,
    refId: row.refId,
    figureLabel: row.figureLabel,
    kind: row.kind as MediaAssetKind,
    filename: row.filename,
    storagePath: normalizedStoragePath,
    sourcePage: row.sourcePage,
    caption: row.caption,
    tags: parseTagsJson(row.tagsJson),
    highYield: row.highYield === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeMediaStoragePath(raw: string | null): string | null {
  if (!raw) return null;
  const storageKey = storagePathToBundledMediaKey(raw);
  if (storageKey) {
    return buildBundledMediaServePath(storageKey);
  }
  return raw;
}

/**
 * Tolerant tags parser. The column is TEXT carrying a JSON-encoded
 * string array, but legacy rows or rows written outside this pipeline
 * may have a raw JS array (Drizzle's `$type<>()` doesn't enforce the
 * write shape). Accept either; bail to null on garbage.
 */
function parseTagsJson(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    return raw.filter((t): t is string => typeof t === "string");
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((t): t is string => typeof t === "string");
      }
    } catch {
      /* fall through */
    }
  }
  return null;
}
