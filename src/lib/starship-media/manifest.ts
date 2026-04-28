/**
 * Pure manifest validator for the Phase 3 chapter media bundle importer.
 *
 * Takes a parsed JSON object plus the chapter number the user picked in
 * the UI, runs every Phase 3 validation rule, and returns either:
 *   - a typed `ManifestValidationOk` when every entry is acceptable for
 *     a write attempt (note: a "valid" entry can still fail at write
 *     time if its filename is missing from the bundle — that's the
 *     importer's concern, not the validator's)
 *   - a `ManifestValidationError` containing structured per-entry
 *     reasons so the UI can show a useful summary table
 *
 * No IO, no fs, no DB. The importer in `importer.ts` consumes the
 * validated manifest and writes the bundle.
 */

const KIND_ALLOWED = new Set(["figure", "image", "table"] as const);
type AllowedKind = "figure" | "image" | "table";

/** Disallow path traversal, slashes, NUL, leading dots, or whitespace. */
const SAFE_FILENAME_RE = /^[A-Za-z0-9_\-.]+\.[A-Za-z0-9]+$/;
const SAFE_ID_RE = /^[A-Za-z0-9_:.\-]+$/;

export interface ManifestAssetInput {
  mediaId: string;
  refId?: string | null;
  figureLabel?: string | null;
  kind: string;
  filename: string;
  segmentId?: string | null;
  sourcePage?: number | null;
  caption?: string | null;
  tags?: string[] | null;
  highYield?: boolean | null;
}

export interface ManifestValidEntry {
  mediaId: string;
  refId: string | null;
  figureLabel: string | null;
  kind: AllowedKind;
  filename: string;
  segmentId: string | null;
  sourcePage: number | null;
  caption: string | null;
  tags: string[] | null;
  highYield: boolean;
}

export type ManifestRejectReason =
  | "duplicate-media-id"
  | "invalid-kind"
  | "invalid-filename"
  | "invalid-media-id"
  | "missing-required-field";

export interface ManifestRejectedEntry {
  index: number;
  mediaId: string | null;
  reason: ManifestRejectReason;
  detail: string;
}

export interface ManifestValidationOk {
  ok: true;
  chapterNumber: number;
  /** Entries cleared for write attempts. */
  valid: ManifestValidEntry[];
  /** Per-entry validation failures. Always empty in a "clean" bundle. */
  rejected: ManifestRejectedEntry[];
}

export interface ManifestValidationError {
  ok: false;
  /** "shape" errors fail the whole bundle before any per-entry pass. */
  error: "not-an-object" | "missing-chapter-number" | "chapter-mismatch" | "missing-assets" | "assets-not-array" | "empty-assets";
  message: string;
  /** When the failure is `chapter-mismatch`, this is the value the
   *  manifest claimed (the user picked a different one in the UI). */
  manifestChapterNumber?: number;
}

export type ManifestValidationResult =
  | ManifestValidationOk
  | ManifestValidationError;

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}
function asOptionalString(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "string") return v.length > 0 ? v : null;
  return null;
}
function asOptionalInt(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "number" && Number.isInteger(v)) return v;
  return null;
}
function asOptionalBool(v: unknown): boolean {
  return v === true;
}
function asOptionalStringArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.filter((x) => typeof x === "string" && x.length > 0);
  return out.length ? (out as string[]) : null;
}

/**
 * Validate a parsed manifest against the user-selected chapter.
 *
 * Pre-conditions: `parsed` is the result of `JSON.parse` on the raw
 * `manifest.json` file — callers should catch parse errors themselves
 * and surface them to the user with the file name attached.
 */
export function validateManifest(
  parsed: unknown,
  selectedChapterNumber: number,
): ManifestValidationResult {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      error: "not-an-object",
      message: "manifest.json must be a JSON object.",
    };
  }
  const root = parsed as Record<string, unknown>;

  const chapterNumber = root.chapterNumber;
  if (typeof chapterNumber !== "number" || !Number.isInteger(chapterNumber)) {
    return {
      ok: false,
      error: "missing-chapter-number",
      message: "manifest.chapterNumber must be an integer.",
    };
  }
  if (chapterNumber !== selectedChapterNumber) {
    return {
      ok: false,
      error: "chapter-mismatch",
      manifestChapterNumber: chapterNumber,
      message: `Manifest chapterNumber (${chapterNumber}) does not match the selected chapter (${selectedChapterNumber}).`,
    };
  }

  if (!("assets" in root)) {
    return {
      ok: false,
      error: "missing-assets",
      message: "manifest.assets is required.",
    };
  }
  if (!Array.isArray(root.assets)) {
    return {
      ok: false,
      error: "assets-not-array",
      message: "manifest.assets must be an array.",
    };
  }
  if (root.assets.length === 0) {
    return {
      ok: false,
      error: "empty-assets",
      message: "manifest.assets is empty — nothing to import.",
    };
  }

  const valid: ManifestValidEntry[] = [];
  const rejected: ManifestRejectedEntry[] = [];
  const seenMediaId = new Set<string>();

  for (let i = 0; i < root.assets.length; i++) {
    const raw = root.assets[i];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      rejected.push({
        index: i,
        mediaId: null,
        reason: "missing-required-field",
        detail: "asset entry must be an object",
      });
      continue;
    }
    const a = raw as Record<string, unknown>;
    const mediaId = asString(a.mediaId);
    const filename = asString(a.filename);
    const kind = asString(a.kind);

    if (!mediaId) {
      rejected.push({
        index: i,
        mediaId: null,
        reason: "missing-required-field",
        detail: "mediaId is required and must be a non-empty string",
      });
      continue;
    }
    if (!SAFE_ID_RE.test(mediaId)) {
      rejected.push({
        index: i,
        mediaId,
        reason: "invalid-media-id",
        detail: `mediaId must match ${SAFE_ID_RE} (got "${mediaId}")`,
      });
      continue;
    }
    if (seenMediaId.has(mediaId)) {
      rejected.push({
        index: i,
        mediaId,
        reason: "duplicate-media-id",
        detail: `mediaId "${mediaId}" appears more than once in the manifest`,
      });
      continue;
    }
    if (!kind) {
      rejected.push({
        index: i,
        mediaId,
        reason: "missing-required-field",
        detail: "kind is required",
      });
      continue;
    }
    if (!KIND_ALLOWED.has(kind as AllowedKind)) {
      rejected.push({
        index: i,
        mediaId,
        reason: "invalid-kind",
        detail: `kind must be one of figure|image|table (got "${kind}")`,
      });
      continue;
    }
    if (!filename) {
      rejected.push({
        index: i,
        mediaId,
        reason: "missing-required-field",
        detail: "filename is required",
      });
      continue;
    }
    if (!SAFE_FILENAME_RE.test(filename)) {
      rejected.push({
        index: i,
        mediaId,
        reason: "invalid-filename",
        detail: `filename must match ${SAFE_FILENAME_RE} (got "${filename}")`,
      });
      continue;
    }

    seenMediaId.add(mediaId);
    valid.push({
      mediaId,
      refId: asOptionalString(a.refId),
      figureLabel: asOptionalString(a.figureLabel),
      kind: kind as AllowedKind,
      filename,
      segmentId: asOptionalString(a.segmentId),
      sourcePage: asOptionalInt(a.sourcePage),
      caption: asOptionalString(a.caption),
      tags: asOptionalStringArray(a.tags),
      highYield: asOptionalBool(a.highYield),
    });
  }

  return { ok: true, chapterNumber, valid, rejected };
}

/** Used by both the importer and the API route's path-safety guard. */
export function isSafeFilename(filename: string): boolean {
  return SAFE_FILENAME_RE.test(filename);
}
