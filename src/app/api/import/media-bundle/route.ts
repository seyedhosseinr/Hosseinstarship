/**
 * POST /api/import/media-bundle
 *
 * Phase 3 — chapter media bundle importer endpoint. Accepts a multipart
 * upload with two fields:
 *   • `chapterNumber` (string, integer)
 *   • `bundle`        (ZIP file)
 *
 * Validates, extracts in memory, writes images under
 * `public/media/campbell/<chapterNumber>/<filename>`, and upserts the
 * media_assets registry. The Reader's resolver picks up the new rows
 * automatically without any cache invalidation — the in-process
 * `useMediaRegistry` cache only lives until the browser tab is closed
 * (or until the user clears the dev override).
 *
 * Read-only / out-of-scope (per Phase 3 contract):
 *   • no NOTE schema mutations
 *   • no Edge/V3 importer changes
 *   • no PDF parsing, no AI extraction
 *   • no remote URL storage — every storagePath is local public/
 */

import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { drizzleUpserter } from "@/lib/starship-media/db";
import {
  runMediaBundleImport,
  unzipBundleBytes,
  type BundleStorage,
  type ImportManifestErrorCode,
  type ImportSummary,
} from "@/lib/starship-media/importer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PUBLIC_MEDIA_ROOT = path.join(process.cwd(), "public", "media");

/** Filesystem-backed storage adapter. Writes under public/media/<rel>. */
function fsStorage(): BundleStorage {
  return {
    async writeFile(relPath, data) {
      // Defensive: re-validate the relative path doesn't escape the
      // sandbox even though the importer only ever produces paths
      // shaped like `campbell/<chapter>/<safe-filename>`.
      const target = path.join(PUBLIC_MEDIA_ROOT, relPath);
      const sandboxRoot = path.resolve(PUBLIC_MEDIA_ROOT);
      const resolved = path.resolve(target);
      if (!resolved.startsWith(sandboxRoot + path.sep) && resolved !== sandboxRoot) {
        throw new Error(`refusing to write outside sandbox: ${relPath}`);
      }
      await mkdir(path.dirname(resolved), { recursive: true });
      await writeFile(resolved, data);
      // Public URL — Next serves /public at the root.
      return `/media/${relPath.split(path.sep).join("/")}`;
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
    storage: fsStorage(),
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
