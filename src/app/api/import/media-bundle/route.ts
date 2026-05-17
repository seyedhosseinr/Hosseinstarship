/**
 * POST /api/import/media-bundle
 *
 * Phase 3 — chapter media bundle importer endpoint. Accepts a multipart
 * upload with two fields:
 *   • `chapterNumber` (string, integer)
 *   • `bundle`        (ZIP file)
 *
 * Validates, extracts in memory, writes payloads into
 * `media_asset_payloads`, and upserts the media_assets registry. The
 * Reader's resolver picks up the new rows automatically without any
 * cache invalidation — the in-process `useMediaRegistry` cache only
 * lives until the browser tab is closed (or until the user clears the
 * dev override).
 *
 * Read-only / out-of-scope (per Phase 3 contract):
 *   • no NOTE schema mutations
 *   • no Edge/V3 importer changes
 *   • no PDF parsing, no AI extraction
 *   • no remote URL storage — every storagePath stays chapter-local
 */

import { NextResponse } from "next/server";

import { getDb } from "@/db";
import {
  deleteMediaAssetsByIds,
  drizzleBundleStorage,
  drizzleUpserter,
  listAllMediaAssets,
} from "@/lib/starship-media/db";
import {
  runMediaBundleImport,
  unzipBundleBytes,
  type ImportManifestErrorCode,
  type ImportSummary,
} from "@/lib/starship-media/importer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ApiResponse {
  ok: boolean;
  summary: ImportSummary;
}

/** List all imported media assets across all chapters. */
export async function GET(): Promise<NextResponse> {
  try {
    const db = await getDb();
    const assets = await listAllMediaAssets(db);
    return NextResponse.json({ ok: true, assets });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

/** Delete media assets by mediaId list. Body: { mediaIds: string[] } */
export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => null) as { mediaIds?: unknown } | null;
    const mediaIds = body?.mediaIds;
    if (!Array.isArray(mediaIds) || mediaIds.some((id) => typeof id !== "string")) {
      return NextResponse.json({ ok: false, error: "mediaIds must be a string array" }, { status: 400 });
    }
    const db = await getDb();
    const deleted = await deleteMediaAssetsByIds(db, mediaIds as string[]);
    return NextResponse.json({ ok: true, deleted });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse<ApiResponse>> {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json(
      { ok: false, summary: errorSummary("missing-manifest", "Could not read multipart form data.") },
      { status: 400 },
    );
  }

  const chapterNumberRaw = form.get("chapterNumber");
  const bundleFile = form.get("bundle");
  const chapterNumber = Number(chapterNumberRaw);

  if (!Number.isInteger(chapterNumber) || chapterNumber <= 0) {
    return NextResponse.json(
      {
        ok: false,
        summary: errorSummary(
          "missing-chapter-number",
          "chapterNumber must be a positive integer.",
        ),
      },
      { status: 400 },
    );
  }
  if (!(bundleFile instanceof File)) {
    return NextResponse.json(
      {
        ok: false,
        summary: errorSummary("missing-manifest", "bundle file is required."),
      },
      { status: 400 },
    );
  }

  const arr = new Uint8Array(await bundleFile.arrayBuffer());
  const unz = unzipBundleBytes(arr);
  if (!unz.ok) {
    return NextResponse.json({
      ok: false,
      summary: errorSummary("zip-error", unz.error),
    });
  }

  const db = await getDb();
  const summary = await runMediaBundleImport({
    entries: unz.entries,
    selectedChapterNumber: chapterNumber,
    storage: drizzleBundleStorage(db),
    upserter: drizzleUpserter(db),
  });
  return NextResponse.json({ ok: summary.ok, summary });
}

function errorSummary(
  error: ImportManifestErrorCode,
  message: string,
): ImportSummary {
  return {
    ok: false,
    receivedAssets: 0,
    imported: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    rejected: [],
    missingFiles: [],
    writeFailures: [],
    importedMediaIds: [],
    manifestError: { error, message },
  };
}
