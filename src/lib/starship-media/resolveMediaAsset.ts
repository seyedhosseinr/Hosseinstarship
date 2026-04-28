/**
 * resolveMediaAsset — pure, deterministic matcher for the Phase 2 reader.
 *
 * Takes a detected reference (from `detectMediaRefs`) plus the active
 * (chapterNo, segmentId) tuple and returns the best-matching MediaAsset
 * from a candidate registry, or `null` when no match is found.
 *
 * Priority order (first hit wins; deterministic — no fuzzy matching):
 *   1. exact `refId` match                 (e.g. ref="figure:164.4" → asset.refId="figure:164.4")
 *   2. normalised `figureLabel` match      (e.g. "Figure 164.4" ≡ "Fig. 164-4")
 *   3. chapter + kind + normalised number  (asset.refId or label parses to same num)
 *
 * Tie-break inside any tier: prefer the asset whose `segmentId` matches
 * the active segment; otherwise prefer the asset with `segmentId === null`
 * (chapter-wide); otherwise pick the lexicographically smallest `mediaId`
 * to keep the result stable across DB orderings.
 *
 * The function never throws and never mutates inputs. Callers that have
 * an empty registry (no fetch yet, or no matches) will get `null` back
 * and the lightbox will keep showing the existing fallback content.
 */

import type { MediaRefMatch } from "./detectMediaRefs";
import { normaliseRefNumber } from "./detectMediaRefs";
import type { MediaAsset } from "./types";

export interface ResolveContext {
  chapterNo: number | null;
  segmentId: string | null;
}

/**
 * Canonical form of a figure label, used by tier-2 matching.
 *
 * "Figure 164.4", "fig. 164-4", "Fig 164–4" → "figure:164-4"
 * "تصویر ۲", "Image 2"                       → "image:2"
 * "شکل ۳", "Figure 3"                        → "figure:3"
 * "Table 5.2"                                → "table:5.2"  (kept as-is in number)
 *
 * Works on either a free-form label string or an asset row that may
 * carry a `figureLabel`. Returns null if it cannot find a keyword + number.
 */
const KEYWORD_TO_KIND: Record<string, "figure" | "image" | "table"> = {
  figure: "figure",
  fig: "figure",
  "fig.": "figure",
  شکل: "figure",
  image: "image",
  تصویر: "image",
  table: "table",
  جدول: "table",
};

const KEYWORD_PATTERN =
  /(figure|fig\.|fig|image|table|تصویر|شکل|جدول)\s*([0-9۰-۹]+(?:[.\-–][0-9۰-۹]+)?)/i;

export function canonicaliseLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  const m = KEYWORD_PATTERN.exec(label.trim());
  if (!m) return null;
  const kind = KEYWORD_TO_KIND[m[1].toLowerCase() as keyof typeof KEYWORD_TO_KIND];
  if (!kind) return null;
  const num = normaliseRefNumber(m[2]);
  return `${kind}:${num}`;
}

/**
 * Pull the canonical id from whatever the asset has on it.
 * Prefers the explicit refId column; falls back to canonicalising the
 * label; finally synthesises one from kind + filename when possible.
 */
function assetCanonicalId(asset: MediaAsset): string | null {
  if (asset.refId && asset.refId.includes(":")) return asset.refId.toLowerCase();
  return canonicaliseLabel(asset.figureLabel);
}

function tieBreak(
  candidates: MediaAsset[],
  ctx: ResolveContext,
): MediaAsset {
  if (candidates.length === 1) return candidates[0]!;

  // Prefer same-segment, then chapter-wide (segmentId === null), then
  // anything else.
  const segMatch = candidates.filter(
    (a) => a.segmentId !== null && a.segmentId === ctx.segmentId,
  );
  if (segMatch.length === 1) return segMatch[0]!;
  if (segMatch.length > 1) {
    return [...segMatch].sort((a, b) => a.mediaId.localeCompare(b.mediaId))[0]!;
  }
  const chapterWide = candidates.filter((a) => a.segmentId === null);
  if (chapterWide.length >= 1) {
    return [...chapterWide].sort((a, b) => a.mediaId.localeCompare(b.mediaId))[0]!;
  }
  return [...candidates].sort((a, b) => a.mediaId.localeCompare(b.mediaId))[0]!;
}

export function resolveMediaAsset(
  ref: MediaRefMatch,
  ctx: ResolveContext,
  registry: readonly MediaAsset[],
): MediaAsset | null {
  if (!registry.length) return null;

  // Tier 1 — exact refId. Case-insensitive on the prefix, but the digit
  // half should already be ASCII-normalised on both sides since the
  // detector and the resolver use the same `normaliseRefNumber`.
  const refIdLower = ref.refId.toLowerCase();
  const t1 = registry.filter(
    (a) => (a.refId ?? "").toLowerCase() === refIdLower,
  );
  if (t1.length) return tieBreak(t1, ctx);

  // Tier 2 — canonicalised figureLabel.
  const refKey = `${ref.kind}:${normaliseRefNumber(ref.number)}`;
  const t2 = registry.filter(
    (a) => canonicaliseLabel(a.figureLabel) === refKey,
  );
  if (t2.length) return tieBreak(t2, ctx);

  // Tier 3 — chapter + kind + number. Falls back to canonicalising
  // either side of the registry row so legacy rows missing `refId` are
  // still findable as long as their label parses.
  if (ctx.chapterNo !== null) {
    const t3 = registry.filter((a) => {
      if (a.chapterNumber !== ctx.chapterNo) return false;
      if (a.kind !== ref.kind) return false;
      const id = assetCanonicalId(a);
      return id === refKey;
    });
    if (t3.length) return tieBreak(t3, ctx);
  }

  return null;
}
