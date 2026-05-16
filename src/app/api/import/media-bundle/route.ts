/**
 * POST /api/import/media-bundle
 *
 * Phase 3 — chapter media bundle importer endpoint. Accepts a multipart
 * upload with two fields:
 *   • `chapterNumber` (string, integer)
 *   • `bundle`        (ZIP file)
 *
 * Validates, extracts in memory, stores image payloads in Postgres/PGlite,
 * and upserts the media_assets registry. The Reader's resolver picks up the new rows
 * automatically without any cache invalidation — the in-process
 * `useMediaRegistry` cache only lives until the browser tab is closed
 * (or until the user clears the dev override).
 *
 * Read-only / out-of-scope (per Phase 3 contract):
 *   • no NOTE schema mutations
 *   • no Edge/V3 importer changes
 *   • no PDF parsing, no AI extraction
 *   • no remote vendor blob dependency — every storagePath is app-served
 */

import { NextResponse } from "next/server";

import { getDb } from "@/db";
import {
  drizzleUpserter,
  upsertMediaAssetPayloadsBatch,
} from "@/lib/starship-media/db";
import {
  runMediaBundleImport,
  unzipBundleBytes,
  type BundleStorage,
  type ImportManifestErrorCode,
  type ImportSummary,
} from "@/lib/starship-media/importer";
import {
  buildBundledMediaServePath,
  inferContentTypeFromPath,
  normalizeBundledMediaStorageKey,
} from "@/lib/starship-media/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DB-backed storage adapter. Safe on Vercel's read-only filesystem. */
function dbStorage(db: Awaited<ReturnType<typeof getDb>>): BundleStorage {
  return {
    async writeFile(relPath, data) {
      const storageKey = normalizeBundledMediaStorageKey(relPath);
      if (!storageKey) {
        throw new Error(`invalid storage key: ${relPath}`);
      }

      await upsertMediaAssetPayloadsBatch(db, [
        {
          storageKey,
          contentType: inferContentTypeFromPath(storageKey),
          base64Data: Buffer.from(data).toString("base64"),
          byteLength: data.byteLength,
        },
      ]);

      return buildBundledMediaServePath(storageKey);
    },
  };
}

interface ApiResponse {
  ok: boolean;
  summary: ImportSummary;
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
    storage: dbStorage(db),
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
