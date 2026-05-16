"use client";

/**
 * inlineRich — v2
 *
 * Tiny inline-only "rich text" renderer for v7.5 notes. Supports:
 *
 *   - **bold**        → <strong>
 *   - *italic*        → <em>     (boundary-guarded so `1*2` isn't matched)
 *   - `inline code`   → <code>
 *
 * NOT a block parser. No tables, lists, code fences, headings, links,
 * images, HTML. Those live in dedicated structured panes (tableData /
 * interactiveData / mermaid / listItems[]) or in FrameBody's block
 * branch.
 *
 * What changed vs v1 (bugfix):
 * ─────────────────────────
 * • Removed hardcoded `font-semibold`, `italic`, `text-inherit`, and
 *   the code `bg / padding / rounded / font-mono / text-size` classes
 *   from the emitted <strong>/<em>/<code> tags.
 *
 *   Why: parent containers (FrameBody, FrameCardV2 titles, table
 *   cells, etc.) already specify `[&_strong]:font-[720]`, `[&_code]:…`,
 *   etc. When inlineRich also sets `font-semibold` on <strong>, the
 *   two CSS rules can conflict depending on cascade order — users
 *   reported strong rendering at weight 600 rather than the parent's
 *   720+. By stripping the className, the parent's descendant rule
 *   is authoritative and the browser default (`bolder` for strong,
 *   `italic` for em, `monospace` for code) covers the standalone
 *   case where no parent styles exist.
 *
 * • Added `unicode-bidi: isolate` (inline style) on every emphasis
 *   span. This prevents a Latin word wrapped in <strong>/<em>/<code>
 *   from disrupting the surrounding Persian run's direction or
 *   causing punctuation to jump position. Critical for mixed medical
 *   prose where bolded anatomic terms are mostly English.
 *
 * Anchor safety: same as v1 — stripping `**` markers shifts the
 * anchor surface's textContent. Existing annotations re-find by
 * quote-matching, so quotes that contained raw markers will miss
 * after the render upgrade. New selections are clean.
 *
 * Annotation overlay: ranges are computed in the ORIGINAL source
 * string by quote-matching, then each leaf text segment emitted
 * from the walk is sliced by intersecting ranges. Emphasis spans
 * inherit the annotation styling for their characters.
 */

import React, { type CSSProperties, type ReactNode } from "react";
import { MediaLeaf } from "@/components/starship-media/MediaLeaf";
import { detectMediaRefs } from "@/lib/starship-media/detectMediaRefs";

/**
 * @deprecated Annotations are no longer painted inline. This shape is
 * kept as an exported type only to keep older imports compiling; the
 * `renderInlineRich` function now ignores the argument entirely. All
 * highlight/underline rendering happens in ReaderHighlightLayer; all
 * note markers in NoteMarkerLayer.
 */
export interface InlineAnnotation {
  id: string;
  quote: string;
  type: "highlight" | "underline" | "comment" | string;
  color?: string | null;
  comment?: string | null;
}

// Single regex covers bold, italic, and inline code.
//   bold:   **…**           greedy-shortest, allows newlines inside
//   italic: *…*             requires non-word boundary on both sides
//   code:   `…`             single-line
const MD_PATTERN =
  /(\*\*[\s\S]+?\*\*|(?<![*\w])\*(?!\s|\*)[^*\n]+?(?<!\s)\*(?![*\w])|`[^`\n]+?`)/g;

/* Bidi-isolation applied to every emphasis span so embedded Latin
   tokens don't disrupt surrounding Persian bidi flow.  Using an
   inline style (not a class) guarantees it works even in contexts
   that strip Tailwind arbitrary selectors (RSC serialization, etc). */
const BIDI_ISOLATE: CSSProperties = {
  unicodeBidi: "isolate",
} as CSSProperties;

// Matches a Latin *phrase*: one or more consecutive Latin words separated
// by single spaces, captured as a single token.  Grouping words together
// is critical — if each word is its own span the RTL bidi algorithm
// treats the spaces between spans as neutral/RTL characters and reverses
// the word order (e.g. "staging cancer prostate" instead of
// "prostate cancer staging").
// Digits are excluded from the leading char so "Figure 1" is never
// consumed — figure refs stay inside the MediaLeaf path.
// {0,15} caps the greedy run at 16 words to avoid matching entire
// English-only paragraphs as one monolithic block.
const LATIN_PHRASE_RE =
  /[A-Za-z][A-Za-z0-9\-'.]*(?:[ ][A-Za-z][A-Za-z0-9\-'.]*){0,15}/g;

// LTR inline-block: the phrase is treated as a single atomic unit in the
// parent RTL line, direction ltr keeps the words in the right order
// inside, and unicode-bidi isolate prevents the span's content from
// affecting the surrounding Persian bidi resolution.
const LATIN_SPAN_STYLE: CSSProperties = {
  direction: "ltr",
  unicodeBidi: "isolate",
  display: "inline-block",
} as CSSProperties;

/**
 * Wrap a raw text leaf in a <MediaLeaf>. The leaf is invisible in the
 * common case (no <MediaRefProvider> upstream) — it returns the bare
 * text. When the Reader's provider is mounted, it transparently splices
 * <MediaRefAnchor>s in around detected figure / image / table refs.
 *
 * Orphan-marker stripping happens here so it covers leaves at every
 * recursion depth, not just top-level. Inner emphasis text never has
 * orphan markers (the regex paired them), so this is a no-op there.
 */
function pushTextLeaf(parts: ReactNode[], raw: string, key: string) {
  if (raw === "") return;
  const cleaned = stripOrphanMarkers(raw);
  if (cleaned === "") return;

  // Media references must stay in a single leaf so the detector can see
  // the keyword and number together ("Fig." + "164.1"). The Latin phrase
  // splitter below would otherwise isolate the keyword and leave MediaLeaf
  // with only the numeric suffix.
  if (detectMediaRefs(cleaned).length > 0) {
    parts.push(<MediaLeaf key={key} text={cleaned} />);
    return;
  }

  // Fast path: no Latin at all (pure Persian / Arabic / numerals).
  // Avoids running the phrase regex on every token.
  if (!/[A-Za-z]/.test(cleaned)) {
    parts.push(<MediaLeaf key={key} text={cleaned} />);
    return;
  }

  // Split the text into Latin phrases and non-Latin segments.
  // Each phrase becomes a single LTR inline-block span so its words
  // cannot be reordered by the parent paragraph's RTL bidi algorithm.
  const re = new RegExp(LATIN_PHRASE_RE.source, "g");
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    if (m.index > cursor) {
      nodes.push(
        <MediaLeaf key={`${key}-${i++}`} text={cleaned.slice(cursor, m.index)} />,
      );
    }
    nodes.push(
      <span key={`${key}-${i++}`} data-reader-latin="" style={LATIN_SPAN_STYLE}>
        {m[0]}
      </span>,
    );
    cursor = m.index + m[0].length;
  }
  if (cursor < cleaned.length) {
    nodes.push(
      <MediaLeaf key={`${key}-${i++}`} text={cleaned.slice(cursor)} />,
    );
  }

  parts.push(<React.Fragment key={key}>{nodes}</React.Fragment>);
}

function renderTokens(
  text: string,
  keyPrefix: string,
): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = new RegExp(MD_PATTERN.source, "g");
  let cursor = 0;
  let key = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > cursor) {
      pushTextLeaf(parts, text.slice(cursor, m.index), `${keyPrefix}t${key++}`);
    }
    const tok = m[0];
    if (tok.startsWith("**") && tok.endsWith("**")) {
      const inner = tok.slice(2, -2);
      parts.push(
        <strong key={`${keyPrefix}b${key++}`} style={BIDI_ISOLATE}>
          {renderTokens(inner, `${keyPrefix}b${key}.`)}
        </strong>,
      );
    } else if (tok.startsWith("`") && tok.endsWith("`")) {
      const inner = tok.slice(1, -1);
      parts.push(
        <code key={`${keyPrefix}c${key++}`} style={BIDI_ISOLATE}>
          {inner}
        </code>,
      );
    } else if (tok.startsWith("*") && tok.endsWith("*")) {
      const inner = tok.slice(1, -1);
      parts.push(
        <em key={`${keyPrefix}i${key++}`} style={BIDI_ISOLATE}>
          {renderTokens(inner, `${keyPrefix}i${key}.`)}
        </em>,
      );
    }
    cursor = m.index + tok.length;
    if (m.index === re.lastIndex) re.lastIndex += 1;
  }
  if (cursor < text.length) {
    pushTextLeaf(parts, text.slice(cursor), `${keyPrefix}t${key++}`);
  }
  return parts;
}

/**
 * Strip leading bullet markers that occasionally leak through from
 * list payloads (`* item`, `- item`, `• item`). These are NEVER
 * intended as emphasis — the surrounding renderer already wraps the
 * line in <li>.
 */
function stripLeadingBullet(text: string): string {
  return text.replace(/^\s*[*\-•]\s+/, "");
}

/**
 * Final defensive pass: any `**` that survived tokenization is an
 * orphan (unclosed pair, mismatched count, bidi boundary confusion).
 * Strip it from the visible output rather than leak the raw marker.
 */
function stripOrphanMarkers(text: string): string {
  if (!text.includes("**")) return text;
  return text.replace(/\*\*/g, "");
}

/**
 * Render a single line of text with inline emphasis and (optionally)
 * highlight/underline/comment annotations applied. Returns a
 * ReactNode suitable for inlining inside a <p>, <li>, table cell,
 * span, heading, etc.
 *
 * The emitted <strong>/<em>/<code> tags carry NO className — all
 * styling comes from the parent container's CSS descendant rules
 * (e.g. `[&_strong]:font-[720]` on a <p>).  The only inline style
 * applied is `unicode-bidi: isolate`, which is a bidi correctness
 * requirement, not an aesthetic choice.
 */
export function renderInlineRich(
  text: string,
  /**
   * @deprecated Annotations are now painted by ReaderHighlightLayer +
   * NoteMarkerLayer (CSS Custom Highlight + sibling overlay). The
   * argument is accepted for back-compat with older call sites but is
   * fully ignored. Will be removed in a follow-up cleanup.
   */
  _annotations?: InlineAnnotation[],
): ReactNode {
  if (text === null || text === undefined) return null;
  if (text === "") return text;
  const cleaned = stripLeadingBullet(text);
  /* Leaves are wrapped in <MediaLeaf> inside renderTokens (which also
     applies stripOrphanMarkers per leaf). No additional post-pass is
     needed — every node returned from renderTokens is already a JSX
     element ready to render. */
  const nodes = renderTokens(cleaned, "");
  if (nodes.length === 0) return null;
  if (nodes.length === 1) return nodes[0];
  return <>{nodes}</>;
}
