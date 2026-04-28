/**
 * Phase 3 — chapter media bundle importer (server-side, dependency-injected).
 *
 * Pipeline (separate concerns):
 *   • `unzipBundleBytes(zipBytes)` — turn a ZIP buffer into a flat
 *     `{ path: Uint8Array }` map. Used by the API route. Optional —
 *     callers that already have a flat map (folder-style upload) skip it.
 *   • `runMediaBundleImport({ entries, selectedChapterNumber, ... })`
 *     consumes a flat entries map plus injectable `BundleStorage` and
 *     `AssetUpserter` deps and returns an `ImportSummary`. Pure — no
 *     filesystem, no DB, no zip. Trivially testable.
 *
 * Per-asset categorisation maps directly to the Phase 3 summary:
 *   received | imported | skipped | failed | duplicate-media-id |
 *   missing-file | invalid-kind | invalid-chapterNumber-mismatch
 */

import { unzipSync, strFromU8 } from "fflate";
import {
  validateManifest,
  type ManifestRejectedEntry,
  type ManifestValidEntry,
} from "./manifest";

export interface BundleStorage {
  /**
   * Persist `data` under `relPath` (relative to the storage root) and
   * return the public URL the lightbox's <img> consumes. Implementations
   * own directory creation and any sandboxing.
   */
  writeFile(relPath: string, data: Uint8Array): Promise<string>;
}

export interface MediaAssetUpsertRow {
  mediaId: string;
  chapterNumber: number;
  segmentId: string | null;
  refId: string | null;
  figureLabel: string | null;
  kind: "figure" | "image" | "table";
  filename: string;
  storagePath: string;
  sourcePage: number | null;
  caption: string | null;
  tags: string[] | null;
  highYield: boolean;
}

export interface AssetUpserter {
  upsert(rows: MediaAssetUpsertRow[]): Promise<{ inserted: number; updated: number }>;
}

export type BundleEntries = Record<string, Uint8Array>;

export type ImportManifestErrorCode =
  | "missing-manifest"
  | "manifest-not-json"
  | "not-an-object"
  | "missing-chapter-number"
  | "chapter-mismatch"
  | "missing-assets"
  | "assets-not-array"
  | "empty-assets"
  | "zip-error";

export interface ImportSummary {
  ok: boolean;
  receivedAssets: number;
  imported: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  manifestError?: {
    error: ImportManifestErrorCode;
    message: string;
    manifestChapterNumber?: number;
  };
  /** Per-entry rejections (duplicate, invalid-kind, invalid-filename, etc.) */
  rejected: ManifestRejectedEntry[];
  missingFiles: Array<{ mediaId: string; filename: string }>;
  writeFailures: Array<{ mediaId: string; filename: string; reason: string }>;
  importedMediaIds: string[];
}

function emptySummary(): ImportSummary {
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
  };
}

/**
 * Decode a ZIP buffer into a flat `path → bytes` map. The API route
 * uses this; the test suite skips it and supplies the map directly.
 *
 * Returns `{ ok: false, error }` on garbage input. fflate's `zipSync`
 * input quirks don't affect `unzipSync`, which reads real ZIP archives
 * produced by the OS / external tools (the importer's actual input).
 */
export function unzipBundleBytes(
  zipBytes: Uint8Array,
): { ok: true; entries: BundleEntries } | { ok: false; error: string } {
  try {
    const raw = unzipSync(zipBytes);
    const entries: BundleEntries = {};
    for (const [k, v] of Object.entries(raw)) {
      // Skip directory stubs (entries whose key ends in /).
      if (k.endsWith("/")) continue;
      entries[k] = v;
    }
    return { ok: true, entries };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "failed to read zip",
    };
  }
}

/**
 * Find `manifest.json` regardless of whether the bundle nests its
 * contents in a single root folder. Accepts:
 *   - manifest.json at root
 *   - <single-root>/manifest.json with no further leading segments
 */
function findManifestAndPrefix(entries: BundleEntries): {
  manifestBytes: Uint8Array;
  prefix: string;
} | null {
  if (entries["manifest.json"]) {
    return { manifestBytes: entries["manifest.json"]!, prefix: "" };
  }
  for (const key of Object.keys(entries)) {
    if (key.endsWith("/manifest.json")) {
      const prefix = key.slice(0, key.length - "manifest.json".length);
      // Guard: only accept a single-root layout (no slashes in prefix
      // beyond the trailing one). Stops "deep/nested/manifest.json".
      const inner = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
      if (!inner.includes("/")) {
        return { manifestBytes: entries[key]!, prefix };
      }
    }
  }
  return null;
}

export async function runMediaBundleImport({
  entries,
  selectedChapterNumber,
  storage,
  upserter,
}: {
  entries: BundleEntries;
  selectedChapterNumber: number;
  storage: BundleStorage;
  upserter: AssetUpserter;
}): Promise<ImportSummary> {
  const summary = emptySummary();

  const located = findManifestAndPrefix(entries);
  if (!located) {
    summary.manifestError = {
      error: "missing-manifest",
      message: "Bundle does not contain manifest.json at root or one level deep.",
    };
    return summary;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(strFromU8(located.manifestBytes));
  } catch (err) {
    summary.manifestError = {
      error: "manifest-not-json",
      message: err instanceof Error ? err.message : "manifest.json is not valid JSON",
    };
    return summary;
  }

  const validation = validateManifest(parsed, selectedChapterNumber);
  if (!validation.ok) {
    summary.manifestError = {
      error: validation.error,
      message: validation.message,
      manifestChapterNumber: validation.manifestChapterNumber,
    };
    return summary;
  }

  summary.receivedAssets = validation.valid.length + validation.rejected.length;
  summary.rejected = validation.rejected;
  summary.skipped = validation.rejected.length;

  // Stage 1 — locate each manifest entry's bytes in the bundle.
  const stagedRows: MediaAssetUpsertRow[] = [];
  const stagedEntries: Array<{ entry: ManifestValidEntry; bytes: Uint8Array }> = [];
  for (const entry of validation.valid) {
    const inBundlePath = located.prefix + entry.filename;
    const bytes = entries[inBundlePath] ?? entries[entry.filename];
    if (!bytes) {
      summary.missingFiles.push({
        mediaId: entry.mediaId,
        filename: entry.filename,
      });
      continue;
    }
    stagedEntries.push({ entry, bytes });
  }

  // Stage 2 — write each present file via the storage adapter.
  for (const { entry, bytes } of stagedEntries) {
    try {
      const relPath = `campbell/${selectedChapterNumber}/${entry.filename}`;
      const storagePath = await storage.writeFile(relPath, bytes);
      stagedRows.push({
        mediaId: entry.mediaId,
        chapterNumber: selectedChapterNumber,
        segmentId: entry.segmentId,
        refId: entry.refId,
        figureLabel: entry.figureLabel,
        kind: entry.kind,
        filename: entry.filename,
        storagePath,
        sourcePage: entry.sourcePage,
        caption: entry.caption,
        tags: entry.tags,
        highYield: entry.highYield,
      });
    } catch (err) {
      summary.writeFailures.push({
        mediaId: entry.mediaId,
        filename: entry.filename,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Stage 3 — bulk upsert all successfully staged rows.
  if (stagedRows.length > 0) {
    try {
      const result = await upserter.upsert(stagedRows);
      summary.inserted = result.inserted;
      summary.updated = result.updated;
      summary.imported = result.inserted + result.updated;
      summary.importedMediaIds = stagedRows.map((r) => r.mediaId);
    } catch (err) {
      summary.writeFailures.push(
        ...stagedRows.map((r) => ({
          mediaId: r.mediaId,
          filename: r.filename,
          reason: err instanceof Error ? err.message : String(err),
        })),
      );
    }
  }

  summary.failed = summary.writeFailures.length;
  summary.ok =
    summary.imported > 0 &&
    summary.failed === 0 &&
    !summary.manifestError;
  return summary;
}
