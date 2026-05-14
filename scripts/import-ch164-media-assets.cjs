#!/usr/bin/env node

/*
 * Import Campbell chapter 164 media assets into Neon.
 *
 * Usage:
 *   $env:POSTGRES_URL="postgresql://..."
 *   node scripts/import-ch164-media-assets.cjs ./ch164-media
 *
 * The script only writes to media_assets and only upserts chapter 164 rows.
 */

const fs = require("node:fs/promises");
const path = require("node:path");
const { Client } = require("pg");

try {
  require("dotenv/config");
} catch {
  // dotenv is optional; POSTGRES_URL can be supplied directly in the shell.
}

const CHAPTER_NUMBER = 164;
const STORAGE_PREFIX = `/media/campbell/${CHAPTER_NUMBER}`;
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

function normalizeTags(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(String).map((tag) => tag.trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        return normalizeTags(parsed);
      } catch {
        // Fall through to comma-separated parsing for malformed legacy input.
      }
    }
    return trimmed.split(",").map((tag) => tag.trim()).filter(Boolean);
  }
  return [];
}

function normalizeBooleanFlag(value) {
  return value === true || value === 1 || value === "1" || value === "true" ? 1 : 0;
}

function asNullableInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function filenameToFigureNumber(filename) {
  const match = filename.match(/(?:fig|figure)[_-]?164[_-]?(\d+[a-z]?)/i);
  return match ? match[1].replace(/_/g, ".") : null;
}

function normalizeRefId(entry, filename) {
  const explicit = entry.ref_id || entry.refId || entry.reference || entry.reference_id;
  if (explicit) return String(explicit).trim();

  const figureNumber = filenameToFigureNumber(filename);
  if (figureNumber) return `figure:${CHAPTER_NUMBER}.${figureNumber}`;

  const stem = path.basename(filename, path.extname(filename)).toLowerCase();
  return `image:${CHAPTER_NUMBER}:${stem}`;
}

function normalizeKind(entry, filename) {
  const rawKind = String(entry.kind || entry.type || "").toLowerCase();
  if (rawKind === "figure" || rawKind === "image" || rawKind === "table") return rawKind;
  return filenameToFigureNumber(filename) ? "figure" : "image";
}

function normalizeLabel(entry, filename, refId) {
  const explicit = entry.figure_label || entry.figureLabel || entry.label || entry.title;
  if (explicit) return String(explicit).trim();

  const figureNumber = filenameToFigureNumber(filename);
  if (figureNumber) return `Figure ${CHAPTER_NUMBER}-${figureNumber}`;

  return refId;
}

function slugifyId(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeManifestEntries(manifest) {
  if (Array.isArray(manifest)) return manifest;
  if (Array.isArray(manifest.assets)) return manifest.assets;
  if (Array.isArray(manifest.images)) return manifest.images;
  if (Array.isArray(manifest.media)) return manifest.media;
  if (Array.isArray(manifest.items)) return manifest.items;

  // Also accept a filename-keyed manifest:
  // { "ch164_fig_164_1.png": { "tags": [...] } }
  return Object.entries(manifest).map(([filename, value]) => ({
    ...(value && typeof value === "object" ? value : {}),
    filename,
  }));
}

async function readChapterAssets(mediaDir) {
  // Read manifest metadata first; tags/captions/pages come from here.
  const manifestPath = path.join(mediaDir, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const manifestEntries = normalizeManifestEntries(manifest);

  const manifestByFilename = new Map();
  for (const entry of manifestEntries) {
    const filename = entry.filename || entry.file || entry.path || entry.name;
    if (filename) {
      manifestByFilename.set(path.basename(String(filename)), entry);
    }
  }

  // Only import image files physically present in this chapter media folder.
  const dirents = await fs.readdir(mediaDir, { withFileTypes: true });
  const imageFiles = dirents
    .filter((dirent) => dirent.isFile())
    .map((dirent) => dirent.name)
    .filter((filename) => IMAGE_EXTENSIONS.has(path.extname(filename).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return imageFiles.map((filename) => {
    const entry = manifestByFilename.get(filename) || {};
    const refId = normalizeRefId(entry, filename);
    const mediaId = entry.media_id || entry.mediaId || `campbell-${CHAPTER_NUMBER}-${slugifyId(refId)}`;
    const id = entry.id || mediaId;

    return {
      id,
      mediaId,
      chapterNumber: CHAPTER_NUMBER,
      segmentId: entry.segment_id || entry.segmentId || null,
      refId,
      figureLabel: normalizeLabel(entry, filename, refId),
      kind: normalizeKind(entry, filename),
      filename,
      storagePath: `${STORAGE_PREFIX}/${filename}`,
      sourcePage: asNullableInteger(entry.source_page || entry.sourcePage || entry.page),
      caption: entry.caption || entry.description || null,
      tagsJson: JSON.stringify(normalizeTags(entry.tags || entry.tags_json || entry.tagsJson)),
      highYield: normalizeBooleanFlag(entry.high_yield || entry.highYield),
    };
  });
}

async function main() {
  const postgresUrl = process.env.POSTGRES_URL;
  if (!postgresUrl) {
    throw new Error("POSTGRES_URL is required.");
  }

  const mediaDir = path.resolve(process.argv[2] || "ch164-media");
  const assets = await readChapterAssets(mediaDir);

  if (assets.length === 0) {
    console.log(`No image files found in ${mediaDir}. Nothing to import.`);
    return;
  }

  const client = new Client({
    connectionString: postgresUrl,
    ssl: postgresUrl.includes("sslmode=require") ? undefined : { rejectUnauthorized: false },
  });

  await client.connect();

  const summary = {
    inserted: 0,
    updated: 0,
    skippedConflictsOutsideChapter: 0,
    totalInputRows: assets.length,
  };

  try {
    await client.query("BEGIN");

    for (const asset of assets) {
      // This is the only write query. It touches media_assets only.
      // The conflict update is additionally guarded so a ref_id collision from
      // another chapter cannot update that other chapter's row.
      const result = await client.query(
        `
          INSERT INTO media_assets (
            id,
            media_id,
            chapter_number,
            segment_id,
            ref_id,
            figure_label,
            kind,
            filename,
            storage_path,
            source_page,
            caption,
            tags_json,
            high_yield,
            created_at,
            updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
            (extract(epoch from now()) * 1000)::bigint,
            (extract(epoch from now()) * 1000)::bigint
          )
          ON CONFLICT (ref_id) DO UPDATE
          SET
            id = EXCLUDED.id,
            media_id = EXCLUDED.media_id,
            chapter_number = EXCLUDED.chapter_number,
            segment_id = EXCLUDED.segment_id,
            figure_label = EXCLUDED.figure_label,
            kind = EXCLUDED.kind,
            filename = EXCLUDED.filename,
            storage_path = EXCLUDED.storage_path,
            source_page = EXCLUDED.source_page,
            caption = EXCLUDED.caption,
            tags_json = EXCLUDED.tags_json,
            high_yield = EXCLUDED.high_yield,
            updated_at = (extract(epoch from now()) * 1000)::bigint
          WHERE media_assets.chapter_number = $3
          RETURNING (xmax = 0) AS inserted
        `,
        [
          asset.id,
          asset.mediaId,
          asset.chapterNumber,
          asset.segmentId,
          asset.refId,
          asset.figureLabel,
          asset.kind,
          asset.filename,
          asset.storagePath,
          asset.sourcePage,
          asset.caption,
          asset.tagsJson,
          asset.highYield,
        ],
      );

      if (result.rowCount === 0) {
        summary.skippedConflictsOutsideChapter += 1;
      } else if (result.rows[0].inserted) {
        summary.inserted += 1;
      } else {
        summary.updated += 1;
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }

  console.log("Chapter 164 media import complete.");
  console.log(`Media folder: ${mediaDir}`);
  console.log(`Input image rows: ${summary.totalInputRows}`);
  console.log(`Inserted: ${summary.inserted}`);
  console.log(`Updated: ${summary.updated}`);
  console.log(`Skipped ref_id conflicts outside chapter 164: ${summary.skippedConflictsOutsideChapter}`);
}

main().catch((error) => {
  console.error("Chapter 164 media import failed.");
  console.error(error);
  process.exitCode = 1;
});
