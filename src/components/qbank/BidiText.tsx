"use client";

// Persian/Arabic Unicode ranges — characters that strongly push RTL direction
const IS_PERSIAN = (cp: number): boolean =>
  (cp >= 0x0600 && cp <= 0x06ff) || // Arabic block (Persian, Urdu, Arabic)
  (cp >= 0xfb50 && cp <= 0xfdff) || // Arabic Presentation Forms-A
  (cp >= 0xfe70 && cp <= 0xfeff) || // Arabic Presentation Forms-B
  cp === 0x200c ||                   // ZWNJ (widely used in Persian)
  cp === 0x200d;                     // ZWJ

// Latin / medical characters — when grouped, force LTR isolation
const IS_LATIN = (cp: number): boolean =>
  (cp >= 0x0041 && cp <= 0x005a) || // A-Z
  (cp >= 0x0061 && cp <= 0x007a) || // a-z
  (cp >= 0x0030 && cp <= 0x0039) || // 0-9
  (cp >= 0x0370 && cp <= 0x03ff);   // Greek letters: α β γ δ etc.

type BidiSegment = { kind: "latin" | "persian"; text: string };

/**
 * Split mixed Persian/Latin text into directional segments.
 *
 * Algorithm:
 *   - Persian characters → "persian" segment
 *   - Latin/Greek/digit characters → "latin" segment
 *   - Neutral chars (spaces, punctuation, …) → absorbed into whichever
 *     segment is currently open; this keeps "transition zone" as one run
 *     and keeps "BPH " together before the Persian "از" starts.
 *
 * The caller wraps each "latin" segment in <bdi dir="ltr"> so the browser's
 * bidi algorithm does not reorder multi-word medical phrases inside an RTL line.
 */
export function segmentBidi(text: string): BidiSegment[] {
  if (!text) return [];

  const segments: BidiSegment[] = [];
  let currentKind: "latin" | "persian" | null = null;
  let buffer = "";

  for (let i = 0; i < text.length; ) {
    const cp = text.codePointAt(i) ?? text.charCodeAt(i);
    const charLen = cp > 0xffff ? 2 : 1;
    const ch = text.slice(i, i + charLen);

    if (IS_PERSIAN(cp)) {
      if (currentKind !== "persian") {
        if (buffer) segments.push({ kind: currentKind ?? "persian", text: buffer });
        buffer = "";
        currentKind = "persian";
      }
      buffer += ch;
    } else if (IS_LATIN(cp)) {
      if (currentKind !== "latin") {
        if (buffer) segments.push({ kind: currentKind ?? "persian", text: buffer });
        buffer = "";
        currentKind = "latin";
      }
      buffer += ch;
    } else {
      // Neutral character (space, punctuation, hyphen, =, /, …)
      // Absorbed into the current run; if nothing is open yet, treat as persian.
      if (!currentKind) currentKind = "persian";
      buffer += ch;
    }

    i += charLen;
  }

  if (buffer) segments.push({ kind: currentKind ?? "persian", text: buffer });
  return segments;
}

type BidiTextProps = {
  text: string;
  className?: string;
};

/**
 * Renders mixed Persian/Latin medical text with correct bidi isolation.
 *
 * Latin runs (ASCII words, digits, Greek letters, medical abbreviations) are
 * wrapped in <bdi dir="ltr"> so multi-word English terms like
 * "transition zone" or "benign prostatic hyperplasia" keep their left-to-right
 * reading order inside an RTL Persian paragraph.
 *
 * Does NOT use dangerouslySetInnerHTML.
 */
export function BidiText({ text, className }: BidiTextProps) {
  const segments = segmentBidi(text);
  if (!segments.length) return null;

  // Pure Latin-only text: render as a single LTR bdi.
  if (segments.length === 1 && segments[0].kind === "latin") {
    return (
      <bdi dir="ltr" className={className}>
        {text}
      </bdi>
    );
  }

  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.kind === "latin" ? (
          <bdi key={i} dir="ltr">
            {seg.text}
          </bdi>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </span>
  );
}
