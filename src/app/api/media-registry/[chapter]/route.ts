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
 *
 * Row → client mapping (including tags_json parse) lives in
 * `lib/starship-media/db.ts` so it's directly unit-testable.
 */
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { listMediaAssetsForChapter } from "@/lib/starship-media/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const assets = await listMediaAssetsForChapter(db, chapterNumber);
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
