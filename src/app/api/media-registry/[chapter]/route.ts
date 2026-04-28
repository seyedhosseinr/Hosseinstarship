/**
 * GET /api/media-registry/:chapter
 *
 * Returns the read-only manifest of `media_assets` rows for a single
 * chapter. The Reader's <MediaRefProvider> calls this once per chapter
 * load and runs the resolver in-memory against detected references.
 *
 * Response shape:
 *   { ok: true, chapterNumber: number, assets: MediaAsset[] }   (200)
 *   { ok: false, error: string }                                (4xx/5xx)
 *
 * Phase 2 contract:
 *   - read-only — no POST / PUT / DELETE
 *   - empty manifest is the normal case (registry is unpopulated until
 *     the importer ships) and yields []
 *   - cheap on cold DB: a single indexed scan by chapter_number
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { mediaAssets } from "@/db/schema";
import type { MediaAsset, MediaAssetKind } from "@/lib/starship-media/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tolerant tags decoder. The column is TEXT carrying a JSON-encoded
 * string array, but rows written by code that pre-dates the importer
 * pipeline may have a raw JS array stuffed in directly. Accept either;
 * bail to null on garbage.
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

interface RouteContext {
  params: Promise<{ chapter: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const params = await context.params;
  const chapterNumber = Number(params.chapter);
  if (!Number.isInteger(chapterNumber) || chapterNumber <= 0) {
    return NextResponse.json(
      { ok: false, error: "invalid-chapter" },
      { status: 400 },
    );
  }

  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.chapterNumber, chapterNumber));

    const assets: MediaAsset[] = rows.map((row) => ({
      id: row.id,
      mediaId: row.mediaId,
      chapterNumber: row.chapterNumber,
      segmentId: row.segmentId,
      refId: row.refId,
      figureLabel: row.figureLabel,
      kind: row.kind as MediaAssetKind,
      filename: row.filename,
      storagePath: row.storagePath,
      sourcePage: row.sourcePage,
      caption: row.caption,
      tags: parseTagsJson(row.tagsJson),
      highYield: row.highYield === 1,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    return NextResponse.json(
      { ok: true, chapterNumber, assets },
      { headers: { "cache-control": "private, max-age=60" } },
    );
  } catch (err) {
    /* DB not provisioned yet (e.g. fresh PGlite without 0003 applied) is
       a benign condition for the Reader — return an empty manifest so
       the lightbox keeps the unmatched fallback behavior. We still log
       so a misconfigured prod env doesn't go silent. */
    // eslint-disable-next-line no-console
    console.warn("[media-registry] lookup failed:", err);
    return NextResponse.json({ ok: true, chapterNumber, assets: [] });
  }
}
