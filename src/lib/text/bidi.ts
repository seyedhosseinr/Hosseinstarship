/**
 * bidi.ts — Persian medical text BiDi run splitter
 *
 * Two exports:
 *
 *   splitBidiRuns(text)      — split plain text into RTL/LTR runs
 *   processHtmlBidi(html)    — inject bidi spans into HTML text nodes
 *                              (preserves all HTML tags unchanged)
 *
 * A run is LTR when it contains at least one Latin or Greek letter and no
 * Arabic/Persian character.  Everything else stays in RTL context.
 *
 * Handles all medical tokenisation cases:
 *   alpha-blocker, beta3 agonist, 5alpha-reductase inhibitor,
 *   PDE5 inhibitor, PSA velocity, DHT mitogen, transition zone,
 *   peripheral zone, 5 mg, 12-month follow-up, 148_01:q-01,
 *   BPH, LUTS, TURP, HoLEP, and Greek letter prefixed terms.
 *
 * Key decisions:
 *   - Greek letters (U+0370-U+03FF) are LTR-strong
 *   - ASCII digits are LTR when they sit in the same non-RTL island as a
 *     Latin/Greek letter (e.g. "5 mg", "beta3", "148_01:q-01")
 *   - Neutral connectors (space, hyphen, underscore, colon …) bridge inside
 *     a run as long as no RTL character appears
 *   - Persian digits (U+06F0-U+06F9) are inside the Arabic block → RTL
 *
 * Does NOT mutate the source string.  Safe to call on server and client.
 */

// ---------------------------------------------------------------------------
// Character class testers
// ---------------------------------------------------------------------------

// RTL-strong: Arabic / Persian Unicode blocks
//   U+0600-U+06FF  Arabic (covers Arabic + Persian letters and digits ۰-۹)
//   U+0750-U+077F  Arabic Supplement
//   U+08A0-U+08FF  Arabic Extended-A
//   U+FB50-U+FDFF  Arabic Presentation Forms-A
//   U+FE70-U+FEFF  Arabic Presentation Forms-B
//   U+200F          Right-to-Left Mark
function isRtl(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? 0;
  return (
    (cp >= 0x0600 && cp <= 0x06ff) ||
    (cp >= 0x0750 && cp <= 0x077f) ||
    (cp >= 0x08a0 && cp <= 0x08ff) ||
    (cp >= 0xfb50 && cp <= 0xfdff) ||
    (cp >= 0xfe70 && cp <= 0xfeff) ||
    cp === 0x200f
  );
}

// LTR-strong: Latin letters (basic + extended) and Greek alphabet
//   U+0041-U+005A  A-Z
//   U+0061-U+007A  a-z
//   U+00C0-U+024F  Latin Extended-A/B
//   U+0370-U+03FF  Greek (alpha beta gamma … and their uppercase forms)
//   U+1E00-U+1EFF  Latin Extended Additional
function isLtr(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? 0;
  return (
    (cp >= 0x0041 && cp <= 0x005a) ||
    (cp >= 0x0061 && cp <= 0x007a) ||
    (cp >= 0x00c0 && cp <= 0x024f) ||
    (cp >= 0x0370 && cp <= 0x03ff) ||
    (cp >= 0x1e00 && cp <= 0x1eff)
  );
}

// ---------------------------------------------------------------------------
// splitBidiRuns — plain text splitter
// ---------------------------------------------------------------------------

export interface BidiRun {
  text: string;
  isLtr: boolean;
}

/**
 * Splits plain `text` into RTL and LTR runs.
 *
 * Rules:
 *   1. A contiguous span of non-RTL characters that contains at least one
 *      Latin/Greek letter is an LTR run.
 *   2. Leading/trailing ASCII spaces on an LTR run are trimmed and merged
 *      into the surrounding RTL context (preserves Persian word-spacing).
 *   3. Consecutive RTL entries are merged into one.
 *   4. Spans with only digits/punctuation and no letters stay RTL.
 */
export function splitBidiRuns(text: string): BidiRun[] {
  if (!text) return [];

  const result: BidiRun[] = [];
  const chars = [...text]; // proper Unicode code-point iteration
  const n = chars.length;
  let i = 0;

  function pushRtl(s: string): void {
    if (!s) return;
    const last = result[result.length - 1];
    if (last && !last.isLtr) {
      last.text += s;
    } else {
      result.push({ text: s, isLtr: false });
    }
  }

  while (i < n) {
    // ── Phase 1: consume RTL run ──────────────────────────────────────────
    // Advance j through RTL chars and any neutral spans that don't contain
    // a Latin/Greek letter before the next RTL character.
    let j = i;
    outer: while (j < n) {
      if (isRtl(chars[j])) {
        j++;
      } else {
        // Non-RTL chunk at j — scan ahead for the first Latin/Greek letter.
        let k = j;
        let hasLtr = false;
        while (k < n && !isRtl(chars[k])) {
          if (isLtr(chars[k])) { hasLtr = true; }
          k++;
        }
        if (hasLtr) break outer; // LTR island found — end RTL run
        j = k; // neutral-only span, absorb into RTL run
      }
    }

    if (j > i) pushRtl(chars.slice(i, j).join(''));
    i = j;
    if (i >= n) break;

    // ── Phase 2: consume LTR island ───────────────────────────────────────
    let k = i;
    while (k < n && !isRtl(chars[k])) k++;
    const island = chars.slice(i, k).join('');

    // Trim leading spaces → merge into preceding RTL context
    let ls = 0;
    while (ls < island.length && island[ls] === ' ') ls++;
    // Trim trailing spaces → will open the next RTL segment
    let re = island.length;
    while (re > ls && island[re - 1] === ' ') re--;

    if (ls > 0) pushRtl(island.slice(0, ls));
    if (re > ls) result.push({ text: island.slice(ls, re), isLtr: true });
    if (re < island.length) pushRtl(island.slice(re));

    i = k;
  }

  return result;
}

// ---------------------------------------------------------------------------
// processHtmlBidi — HTML string bidi injector
// ---------------------------------------------------------------------------

/**
 * Walks the text nodes of an HTML string and wraps LTR runs in isolated
 * inline spans, leaving all HTML tags unchanged.
 *
 * Use this with dangerouslySetInnerHTML when the flashcard HTML must be
 * preserved (bold, italic, block structure) while still getting correct
 * bidi isolation for embedded medical terms.
 *
 * Example input:
 *   "<p>درمان با <strong>PDE5 inhibitor</strong> می‌تواند LUTS را بهتر کند</p>"
 *
 * Example output:
 *   "<p>درمان با <strong>
 *     <span dir="ltr" style="direction:ltr;unicode-bidi:isolate;display:inline"
 *           data-bidi-run="ltr">PDE5 inhibitor</span>
 *   </strong> می‌تواند
 *     <span dir="ltr" ...>LUTS</span>
 *   را بهتر کند</p>"
 *
 * Note: text nodes are processed as raw HTML text (entities like &amp; are
 * not decoded).  This is correct because the text will be re-injected via
 * innerHTML and the browser will decode entities in the final render.
 */
export function processHtmlBidi(html: string): string {
  if (!html) return html;

  // Split on HTML tags vs. text nodes.
  // Capturing group means the tag tokens are included in the result array.
  return html.replace(
    /(<[^>]*>)|([^<]+)/g,
    (_, tag: string | undefined, text: string | undefined) => {
      if (tag !== undefined) return tag; // pass tags through unchanged

      const t = text ?? '';
      if (!t) return t;

      const runs = splitBidiRuns(t);
      if (runs.length === 0) return t;
      if (runs.every((r) => !r.isLtr)) return t; // all RTL — no change

      return runs
        .map((r) =>
          r.isLtr
            ? `<span dir="ltr" ` +
              `style="direction:ltr;unicode-bidi:isolate;display:inline" ` +
              `data-bidi-run="ltr">${r.text}</span>`
            : r.text,
        )
        .join('');
    },
  );
}
