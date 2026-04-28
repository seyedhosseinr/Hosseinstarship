/**
 * detectMediaRefs — pure scanner for image / figure / table references
 * embedded in NOTE prose.
 *
 * Phase 1 contract:
 *   • READ-ONLY. Does not mutate input. Does not assume any importer or
 *     stored media exists.
 *   • Returns absolute character offsets into the source string so the
 *     Reader can splice anchors in without re-parsing.
 *   • Recognises both English keywords (Figure, Fig, Fig., Image, Table)
 *     and Persian keywords (شکل, تصویر, جدول).
 *   • Numbers may use ASCII digits or Persian-Indic digits (۰-۹), and may
 *     include a "section.subsection" or "section-subsection" suffix
 *     (e.g. 164.4, 164-4, 164–4).
 *   • Word boundaries use Unicode letter classes so it never misfires on
 *     "Figured", "Imaged", "تصویری", etc.
 *
 * Out of scope (later phases): caption parsing, page numbers,
 * abbreviation resolution, multi-figure ranges (Figs 5–7).
 */

export type MediaRefKind = "figure" | "image" | "table";

export interface MediaRefMatch {
  /** Inclusive start offset into the source string. */
  start: number;
  /** Exclusive end offset into the source string. */
  end: number;
  /** Verbatim slice of the source — preserves keyword + spacing + number. */
  raw: string;
  /** Normalised English-side classification. */
  kind: MediaRefKind;
  /** Verbatim keyword token as it appeared (e.g. "Fig.", "تصویر"). */
  keyword: string;
  /** Verbatim number token (may contain ASCII or Persian-Indic digits). */
  number: string;
  /** Display label, e.g. "Fig. 164.4" or "تصویر ۲". */
  label: string;
  /**
   * Stable id derived from kind + ASCII-normalised number. Two refs in the
   * same chapter+segment that resolve to the same imported asset will share
   * this id once the importer lands.
   */
  refId: string;
}

const KEYWORDS = "Figure|Fig\\.|Fig|Image|Table|تصویر|شکل|جدول";
// `\p{L}` covers Latin, Persian/Arabic, etc. We *exclude* digits from the
// boundary class because "Fig 5" → boundary between "Fig" and " " is fine,
// but we don't want "AFig 5" or "تصویری 5" to match.
const KEYWORD_BOUNDARY = "(?<![\\p{L}])(?:" + KEYWORDS + ")(?![\\p{L}])";
// Allow regular space, NBSP, ZWNJ (used in Persian compounds), or thin
// space between keyword and number. Require at least one character — we
// intentionally do NOT match "Fig5" (too prone to misfire on raw IDs).
const SEPARATOR = "[\\s\\u00A0\\u200C]+";
// Number: one run of ASCII digits or Persian-Indic digits, optionally a
// dot/hyphen/en-dash followed by another run.
const DIGIT_RUN = "[0-9\\u06F0-\\u06F9]+";
const NUMBER = `(${DIGIT_RUN}(?:[.\\-\\u2013]${DIGIT_RUN})?)`;

const MEDIA_REF_PATTERN = new RegExp(
  `(${KEYWORD_BOUNDARY})${SEPARATOR}${NUMBER}`,
  "giu",
);

const PERSIAN_DIGIT_OFFSET = 0x06f0 - 0x30; // map ۰..۹ → 0..9

function asciiDigits(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.charCodeAt(0);
    if (code >= 0x06f0 && code <= 0x06f9) {
      out += String.fromCharCode(code - PERSIAN_DIGIT_OFFSET);
    } else {
      out += ch;
    }
  }
  return out;
}

function classify(keyword: string): MediaRefKind {
  const lower = keyword.toLowerCase();
  if (lower === "table" || keyword === "جدول") return "table";
  if (lower === "image" || keyword === "تصویر") return "image";
  // Figure / Fig / Fig. / شکل
  return "figure";
}

/**
 * Scan `text` and return every media reference, in order, non-overlapping.
 *
 * Cheap to call: a single regex pass with no allocations beyond the match
 * array. Safe to call on every text leaf the Reader emits.
 */
export function detectMediaRefs(text: string): MediaRefMatch[] {
  if (!text || text.length < 4) return [];
  // Cheap pre-filter — the regex is non-trivial; skip strings with no
  // candidate keyword characters at all.
  if (
    !/Fig|Image|Table|تصویر|شکل|جدول/i.test(text)
  ) {
    return [];
  }

  const out: MediaRefMatch[] = [];
  const re = new RegExp(MEDIA_REF_PATTERN.source, MEDIA_REF_PATTERN.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const keyword = m[1]!;
    const number = m[2]!;
    const start = m.index;
    const end = start + m[0].length;
    const kind = classify(keyword);
    const normalisedNumber = asciiDigits(number).replace(/[–]/g, "-");
    out.push({
      start,
      end,
      raw: m[0],
      kind,
      keyword,
      number,
      label: `${keyword} ${number}`,
      refId: `${kind}:${normalisedNumber}`,
    });
    if (m.index === re.lastIndex) re.lastIndex += 1;
  }
  return out;
}

/** Convenience: ASCII-normalise a number string (Persian-Indic → 0-9). */
export function normaliseRefNumber(number: string): string {
  return asciiDigits(number).replace(/[–]/g, "-");
}
