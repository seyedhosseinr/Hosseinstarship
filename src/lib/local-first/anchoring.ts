/**
 * Annotation anchoring (see architecture §4).
 *
 * Every annotation is stored with:
 *   - sourceBlockId     — stable block ID from the note schema (frameId)
 *   - textQuote         — the exact selected text
 *   - textPositionStart — offset within the block text at capture time
 *   - textPositionEnd   — ...
 *   - prefix            — up to 32 chars before the selection (raw)
 *   - suffix            — up to 32 chars after the selection (raw)
 *   - blockChecksum     — hash16(block.text) at capture time
 *
 * Re-anchor on render, in this order:
 *   1. If the stored checksum still matches the current block text, the
 *      stored offsets are still valid.
 *   2. Otherwise, look for a UNIQUE occurrence of `textQuote` in the block.
 *   3. Otherwise, fuzzy-match `prefix + textQuote + suffix` against the
 *      block with a small edit-distance tolerance and re-locate the quote
 *      within the best match range.
 *   4. Otherwise, mark the annotation orphaned and surface it in the
 *      "Needs Review" list.
 *
 * Important: anchoring is TEXT-BASED. Never persist DOM offsets or element
 * indices — they break the instant the page re-renders differently.
 */

export { hash16 } from "./opfs";
import { hash16 } from "./opfs";

/* ── Capture: build the anchor payload from a raw selection ─ */

export interface AnchorCapture {
  textQuote: string;
  textPositionStart: number;
  textPositionEnd: number;
  prefix: string;
  suffix: string;
  blockChecksum: string;
  /**
   * Optional (v8.2): the frame's persisted content hash at capture time.
   * Serves as a stability hint layered on top of blockChecksum — see `reanchor`.
   * Distinct from blockChecksum because:
   *   - blockChecksum hashes the rendered block text the reader passed in
   *     (may include structured panes' text in its textContent).
   *   - contentHash hashes the canonical v8 content field (import-time).
   * When both are present on an anchor AND both still match, we get a strong
   * "canonical content unchanged" signal that cleanly distinguishes content
   * edits from cosmetic re-renders. Legacy anchors with no contentHash just
   * skip this path and fall back to the existing logic — nothing regresses.
   */
  contentHash?: string;
}

const PREFIX_SUFFIX_LEN = 32;

/**
 * Build an AnchorCapture from a block's current full text plus the offsets
 * where the user's selection landed.
 *
 * Callers in the reader typically compute `(start, end)` by walking the
 * selection range up to the nearest element that carries `data-frame-id`
 * and measuring text offsets there.
 *
 * v8.2: pass the frame's persisted `contentHash` via `opts.contentHash` to
 * enable the fast path in `reanchor`. Omitting it preserves legacy behavior.
 */
export async function captureAnchor(
  blockText: string,
  start: number,
  end: number,
  opts: { contentHash?: string } = {},
): Promise<AnchorCapture> {
  const clampedStart = Math.max(0, Math.min(start, blockText.length));
  const clampedEnd = Math.max(clampedStart, Math.min(end, blockText.length));
  const quote = blockText.slice(clampedStart, clampedEnd);
  const prefixStart = Math.max(0, clampedStart - PREFIX_SUFFIX_LEN);
  const suffixEnd = Math.min(blockText.length, clampedEnd + PREFIX_SUFFIX_LEN);
  return {
    textQuote: quote,
    textPositionStart: clampedStart,
    textPositionEnd: clampedEnd,
    prefix: blockText.slice(prefixStart, clampedStart),
    suffix: blockText.slice(clampedEnd, suffixEnd),
    blockChecksum: await hash16(blockText),
    contentHash: opts.contentHash,
  };
}

/* ── Re-anchor on render ───────────────────────────────────── */

export type ReanchorResult =
  | {
      ok: true;
      start: number;
      end: number;
      /** If set, caller should persist these values back onto the annotation row. */
      updated?: Partial<AnchorCapture>;
    }
  | { ok: false; reason: "orphaned" };

export interface ReanchorInput {
  textQuote: string;
  textPositionStart: number;
  textPositionEnd: number;
  prefix: string;
  suffix: string;
  blockChecksum: string;
  /** v8.2 — optional persisted content hash at capture time. */
  contentHash?: string;
}

/**
 * v8.2: optional inputs that carry stability hints about the current block.
 * When `currentContentHash` is supplied AND equals the anchor's stored
 * `contentHash`, the canonical content has not changed — a strong enough
 * signal that the stored offsets are trustworthy if they still enclose the
 * stored quote. Absent or mismatched, the function falls back to the
 * existing behavior exactly.
 */
export interface ReanchorContext {
  currentContentHash?: string;
}

function findAllOccurrences(haystack: string, needle: string): number[] {
  if (!needle) return [];
  const out: number[] = [];
  let idx = 0;
  while (idx <= haystack.length - needle.length) {
    const hit = haystack.indexOf(needle, idx);
    if (hit < 0) break;
    out.push(hit);
    idx = hit + 1;
  }
  return out;
}

/**
 * Levenshtein distance, capped at `maxDistance` for early termination.
 * Returns `maxDistance + 1` when the true distance exceeds the cap.
 */
function boundedLevenshtein(a: string, b: string, maxDistance: number): number {
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;
  if (a === b) return 0;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const prev = new Array<number>(cols);
  const curr = new Array<number>(cols);
  for (let j = 0; j < cols; j++) prev[j] = j;
  for (let i = 1; i < rows; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDistance) return maxDistance + 1;
    for (let j = 0; j < cols; j++) prev[j] = curr[j];
  }
  return prev[cols - 1];
}

/**
 * Best fuzzy window match of `probe` within `text`, sliding length ±20%.
 * Returns the absolute start index of the best unique match, or null.
 */
function fuzzyFindUnique(
  text: string,
  probe: string,
  tolerance: number,
): { start: number; length: number } | null {
  if (probe.length === 0 || text.length === 0) return null;
  const maxDistance = Math.max(1, Math.floor(probe.length * tolerance));
  const minLen = Math.max(1, probe.length - maxDistance);
  const maxLen = Math.min(text.length, probe.length + maxDistance);

  let best: { start: number; length: number; distance: number } | null = null;
  let secondBest: number | null = null;

  // Slide windows of varying length. O(n * k) — cheap for block-sized text.
  for (let windowLen = minLen; windowLen <= maxLen; windowLen++) {
    for (let start = 0; start + windowLen <= text.length; start++) {
      const window = text.slice(start, start + windowLen);
      const d = boundedLevenshtein(window, probe, maxDistance);
      if (d > maxDistance) continue;
      if (!best || d < best.distance) {
        if (best) secondBest = best.distance;
        best = { start, length: windowLen, distance: d };
      } else if (d === best.distance && start !== best.start) {
        secondBest = d;
      }
    }
  }

  if (!best) return null;
  // Require a clear winner — if another window is equally good, treat as
  // ambiguous and fall through to "orphaned".
  if (secondBest !== null && secondBest === best.distance) return null;
  return { start: best.start, length: best.length };
}

/**
 * Locate `quote` (or its best fuzzy match) inside an already-selected
 * `range` of text, returning absolute offsets within the original full
 * block text.
 */
function locateQuoteWithin(
  blockText: string,
  rangeStart: number,
  rangeLength: number,
  quote: string,
): { start: number; end: number } | null {
  const slice = blockText.slice(rangeStart, rangeStart + rangeLength);
  const direct = slice.indexOf(quote);
  if (direct >= 0) {
    return {
      start: rangeStart + direct,
      end: rangeStart + direct + quote.length,
    };
  }
  // Fall back: best 1-char fuzzy alignment — we already accepted the outer
  // window so some drift is expected.
  const inner = fuzzyFindUnique(slice, quote, 0.1);
  if (!inner) return null;
  return {
    start: rangeStart + inner.start,
    end: rangeStart + inner.start + inner.length,
  };
}

export async function reanchor(
  anchor: ReanchorInput,
  blockText: string,
  ctx: ReanchorContext = {},
): Promise<ReanchorResult> {
  // 0) Empty quote = nothing we can do.
  if (!anchor.textQuote) return { ok: false, reason: "orphaned" };

  // 0.5) v8.2 fast path — persisted content hash unchanged.
  // When both the stored anchor and the current frame report a contentHash
  // AND they match, the canonical backbone is unchanged. If the stored offsets
  // still enclose the stored quote, we can trust them without recomputing
  // hash16(blockText) at all. This is strictly additive: skipped whenever
  // either hash is absent or they differ → existing logic still runs.
  if (
    anchor.contentHash &&
    ctx.currentContentHash &&
    anchor.contentHash === ctx.currentContentHash &&
    anchor.textPositionStart >= 0 &&
    anchor.textPositionEnd <= blockText.length &&
    blockText.slice(anchor.textPositionStart, anchor.textPositionEnd) === anchor.textQuote
  ) {
    return {
      ok: true,
      start: anchor.textPositionStart,
      end: anchor.textPositionEnd,
    };
  }

  // 1) Checksum still matches — trust stored offsets.
  const currentChecksum = await hash16(blockText);
  if (currentChecksum === anchor.blockChecksum) {
    if (
      anchor.textPositionStart >= 0 &&
      anchor.textPositionEnd <= blockText.length &&
      blockText.slice(anchor.textPositionStart, anchor.textPositionEnd) === anchor.textQuote
    ) {
      return {
        ok: true,
        start: anchor.textPositionStart,
        end: anchor.textPositionEnd,
      };
    }
  }

  // 2) Unique exact textQuote match.
  const occ = findAllOccurrences(blockText, anchor.textQuote);
  if (occ.length === 1) {
    const start = occ[0];
    const end = start + anchor.textQuote.length;
    return {
      ok: true,
      start,
      end,
      updated: {
        textPositionStart: start,
        textPositionEnd: end,
        blockChecksum: currentChecksum,
        // v8.2: update the stability hint so subsequent re-anchors take the
        // fast path. Only write it when the caller supplied one.
        ...(ctx.currentContentHash ? { contentHash: ctx.currentContentHash } : {}),
      },
    };
  }

  // 3) Prefix+quote+suffix fuzzy match.
  const probe = anchor.prefix + anchor.textQuote + anchor.suffix;
  const best = fuzzyFindUnique(blockText, probe, 0.1);
  if (best) {
    const located = locateQuoteWithin(blockText, best.start, best.length, anchor.textQuote);
    if (located) {
      return {
        ok: true,
        start: located.start,
        end: located.end,
        updated: {
          textPositionStart: located.start,
          textPositionEnd: located.end,
          blockChecksum: currentChecksum,
          ...(ctx.currentContentHash ? { contentHash: ctx.currentContentHash } : {}),
        },
      };
    }
  }

  // 4) Give up — caller marks as orphaned.
  return { ok: false, reason: "orphaned" };
}
