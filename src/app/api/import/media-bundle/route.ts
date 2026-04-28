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
import { inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { mediaAssets } from "@/db/schema";
import {
  runMediaBundleImport,
  unzipBundleBytes,
  type AssetUpserter,
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

/** Drizzle-backed upserter using ON CONFLICT (media_id) DO UPDATE. */
function drizzleUpserter(): AssetUpserter {
  return {
    async upsert(rows) {
      if (rows.length === 0) return { inserted: 0, updated: 0 };
      const db = await getDb();
      const ids = rows.map((r) => r.mediaId);

      // Find which mediaIds already exist so we can return inserted vs
      // updated counts. A single SELECT is cheap on the unique index.
      // `inArray` compiles to `media_id IN ($1, $2, ...)` — portable
      // across Postgres + PGlite. Avoids `= ANY((p1, p2))` which is the
      // record-tuple form and rejected by both runtimes.
      const existing = await db
        .select({ mediaId: mediaAssets.mediaId })
        .from(mediaAssets)
        .where(inArray(mediaAssets.mediaId, ids));
      const existingSet = new Set(existing.map((e) => e.mediaId));

      const now = Date.now();
      const values = rows.map((r) => ({
        id: r.mediaId, // also use mediaId as the primary id for stable upserts
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
        // the underlying column is plain TEXT. Match the project-wide
        // `jsonField()` convention: JSON.stringify on write, JSON.parse on read.
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
            // Per Phase 3 contract: refresh every importer-controlled
            // column except `id` and `createdAt` on conflict.
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

  const summary = await runMediaBundleImport({
    entries: unz.entries,
    selectedChapterNumber: chapterNumber,
    storage: fsStorage(),
    upserter: drizzleUpserter(),
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
