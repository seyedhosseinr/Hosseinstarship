"use client";

import React from "react";
import { renderInlineRich } from "./inlineRich";
import { cn } from "@/lib/utils";

/**
 * CSS type helper — `textWrap`, `textJustify`, `unicodeBidi`,
 * `hyphens` shipped unevenly across @types/react versions.
 */
type ReaderCSS = React.CSSProperties & {
  textWrap?: "balance" | "pretty" | "wrap" | "nowrap";
  textJustify?: "inter-word" | "inter-character" | "auto" | "none";
  unicodeBidi?:
    | "normal"
    | "embed"
    | "isolate"
    | "bidi-override"
    | "isolate-override"
    | "plaintext";
  hyphens?: "none" | "manual" | "auto";
};

/* ═══════════════════════════════════════════════════════════════════
   FrameBody — v4 (Persian-dominant, respect-ambient-RTL)
   ─────────────────────────────────────────────────────────────────
   Renders the prose surface of a frame. Supports paragraphs, flat +
   nested bullets, ordered lists, pipe tables, blockquotes, code
   fences, inline **bold**, *italic*, `code`, annotations.

   What changed from v3 (critical):
   ──────────────────────────────
   • REMOVED `dir="auto"` from EVERY body-text element. Persian is
     the dominant language in this reader; a paragraph that happens
     to start with a Latin medical term ("bulbospongiosus برای…") was
     being detected as LTR by dir=auto and the entire paragraph was
     flipping to English-dominant flow. The correct approach is to
     let the ambient page dir="rtl" take effect and let the Unicode
     Bidi Algorithm handle embedded Latin tokens — which is what it's
     designed for.

   • Justify is now OPT-IN via the `justify` prop (default: false).
     Persian paragraphs with sparse Latin tokens + forced justify
     produce visible "rivers" of whitespace that look unbalanced.
     text-align: start (which resolves to right in RTL) with
     text-wrap: pretty gives a natural book-like flow.

   • Leading raised from 1.88 → 1.95 on primary body. Persian needs
     slightly more leading than Latin to breathe — the combining
     marks and diacritics stack vertically and collide at tight line
     heights.

   • Unicode-bidi: isolate is applied via inlineRich (no longer via
     Tailwind arbitrary selectors). More robust across RSC / SSR.

   • Heavy strong (720) retained. Because inlineRich no longer pins
     weight to 600, the parent descendant rule wins cleanly.

   What's kept for LTR-only content:
   ─────────────────────────────
   • Code blocks → `dir="ltr"` (programming syntax is always LTR).
   • Ordered-list markers → `tabular-nums` + mono font.
═══════════════════════════════════════════════════════════════════ */

type FrameBodyProps = {
  body: string;
  compact?: boolean;
  /**
   * Dim "canonical text" mode. Used when a structured display pane
   * (table / list / interactive) carries the same information with
   * higher visual priority. Prose stays in the DOM (anchor-safe,
   * selectable) but de-emphasized.
   */
  anchorPrimary?: boolean;
  /**
   * Opt in to `text-align: justify` with inter-word spacing.
   * Default: false. Forced justify on Persian paragraphs with sparse
   * Latin tokens produces whitespace rivers; natural start-alignment
   * reads better out of the box.
   */
  justify?: boolean;
};

/* ═══════════════════════════════════════════════════════════════════
   Block classifiers
═══════════════════════════════════════════════════════════════════ */

function isTable(lines: string[]) {
  return lines.length >= 2 && lines.every((line) => line.trim().startsWith("|"));
}
function isBulletList(lines: string[]) {
  return lines.every((line) => /^\s*[-*]\s+/.test(line));
}
function isOrderedList(lines: string[]) {
  return lines.every((line) => /^\s*\d+\.\s+/.test(line));
}
function isCodeFence(lines: string[]) {
  return (
    lines[0]?.trim().startsWith("```") &&
    lines[lines.length - 1]?.trim().startsWith("```")
  );
}
function isBlockquote(lines: string[]) {
  return lines.every((line) => /^\s*>\s?/.test(line));
}

/* ═══════════════════════════════════════════════════════════════════
   Inline tone sets
   ───────────────────────────────────────────────────────────────────
   Strong = 720 (visible bold across Persian variable fonts).
   Em     = italic + mild color shift.
   Code   = hairline border + subtle tint.
   Bidi-isolate on emphasis/code now lives on the inlineRich tags
   themselves (as inline style), so we don't repeat it in every
   selector here.
═══════════════════════════════════════════════════════════════════ */

const INLINE_TONE_COMPACT = cn(
  "[&_strong]:font-[800] [&_strong]:text-inherit",
  "[&_em]:[font-style:oblique_12deg] [&_em]:text-inherit [&_em]:opacity-95",
  "[&_code]:rounded-[4px] [&_code]:border [&_code]:border-lib-border/40",
  "[&_code]:bg-lib-hover/60 [&_code]:px-1 [&_code]:py-[1px]",
  "[&_code]:font-mono [&_code]:text-[0.9em] [&_code]:text-lib-text/95",
);

const INLINE_TONE_PRIMARY = cn(
  "[&_strong]:font-[800] [&_strong]:text-lib-text",
  "[&_em]:[font-style:oblique_12deg] [&_em]:text-lib-text/95",
  "[&_code]:rounded-[4px] [&_code]:border [&_code]:border-lib-border/40",
  "[&_code]:bg-lib-hover/60 [&_code]:px-1.5 [&_code]:py-[1px]",
  "[&_code]:font-mono [&_code]:text-[0.9em] [&_code]:text-lib-text",
);

/* ═══════════════════════════════════════════════════════════════════
   Table renderer (pipe syntax, markdown-like)
   ───────────────────────────────────────────────────────────────────
   Minimalist hairline design — no outer border, no heavy bg,
   no zebra. 1.5px header underline + hairline row separators.
   Parses markdown alignment from the separator row:
     :---   → start   (RTL start = right, LTR start = left)
     ---:   → end     (opposite of start)
     :---:  → center
     ---    → start   (default)
   Alignment per column applies to <th> and every <td>. Cells still
   inherit RTL from ambient; Latin tokens inside use inlineRich's
   bidi-isolate safety.
═══════════════════════════════════════════════════════════════════ */

type ColAlign = "start" | "end" | "center";

function parseAlignmentRow(row: string[]): ColAlign[] | null {
  if (!row.every((cell) => /^:?-+:?$/.test(cell))) return null;
  return row.map((cell) => {
    const hasStart = cell.startsWith(":");
    const hasEnd = cell.endsWith(":");
    if (hasStart && hasEnd) return "center";
    if (hasEnd) return "end";
    return "start";
  });
}

function renderTable(lines: string[], compact: boolean) {
  const rows = lines.map((line) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim()),
  );

  // Pull alignment out of the second row (if it's a separator row).
  let alignments: ColAlign[] = [];
  const headerRow: string[] = rows[0] ?? [];
  let bodyRows: string[][] = [];
  if (rows.length >= 2) {
    const maybeAlign = parseAlignmentRow(rows[1]);
    if (maybeAlign) {
      alignments = maybeAlign;
      bodyRows = rows.slice(2);
    } else {
      bodyRows = rows.slice(1);
    }
  }
  const alignFor = (i: number): ColAlign => alignments[i] ?? "start";

  return (
    <div className="my-3 -mx-1 overflow-x-auto">
      <table
        className={cn(
          "w-full border-collapse",
          compact ? "text-[13px] leading-[1.58]" : "text-[14.25px] leading-[1.6]",
        )}
      >
        <thead>
          <tr>
            {headerRow.map((cell, index) => (
              <th
                key={index}
                className={cn(
                  "border-b-[1.5px] border-lib-border/85 px-3.5 py-2",
                  "align-bottom font-[700] leading-[1.6] text-lib-text",
                  "[&_strong]:font-[780] [&_em]:[font-style:oblique_12deg]",
                  "[&_code]:rounded-[3px] [&_code]:bg-lib-hover/50 [&_code]:px-1",
                  "[&_code]:font-mono [&_code]:text-[0.9em]",
                )}
                style={{ textAlign: alignFor(index) }}
              >
                {renderInlineRich(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={cn(
                "border-b border-lib-border/25 last:border-b-0",
                "transition-colors hover:bg-lib-hover/18",
              )}
            >
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={cn(
                    "px-3.5 py-2.5 align-top text-lib-text/90",
                    compact ? "leading-[1.55]" : "leading-[1.58]",
                    "[&_strong]:font-[800] [&_strong]:text-lib-text",
                    "[&_em]:[font-style:oblique_12deg] [&_em]:text-lib-text/95",
                    "[&_code]:rounded-[4px] [&_code]:border [&_code]:border-lib-border/35",
                    "[&_code]:bg-lib-hover/45 [&_code]:px-1 [&_code]:py-[1px]",
                    "[&_code]:font-mono [&_code]:text-[0.9em] [&_code]:text-lib-text",
                  )}
                  style={{ textAlign: alignFor(cellIndex) }}
                >
                  {renderInlineRich(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Blockquote
═══════════════════════════════════════════════════════════════════ */

function renderBlockquote(
  lines: string[],
  inlineToneClass: string,
  compact: boolean,
) {
  const text = lines.map((line) => line.replace(/^\s*>\s?/, "")).join(" ");
  const style: ReaderCSS = {
    textAlign: "start",
    textWrap: "pretty",
    overflowWrap: "break-word",
  };
  return (
    <blockquote
      className={cn(
        "border-s-[3px] border-lib-accent/35 bg-lib-hover/20 ps-3.5 pe-3 py-1.5",
        "rounded-e-[4px] italic text-lib-text/90",
        compact ? "text-[13.5px] leading-[1.62]" : "text-[15px] leading-[1.68]",
        inlineToneClass,
      )}
      style={style}
    >
      {renderInlineRich(text)}
    </blockquote>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Main
═══════════════════════════════════════════════════════════════════ */

export function FrameBody({
  body,
  compact = false,
  anchorPrimary = true,
  justify = false,
}: FrameBodyProps) {
  if (!body?.trim()) return null;

  const blocks = body
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  /* Shared paragraph style.  No `dir` attribute — inherit ambient. */
  const proseStyle: ReaderCSS = {
    textAlign: justify ? "justify" : "start",
    textJustify: justify ? "inter-word" : undefined,
    textAlignLast: justify ? "start" : undefined,
    textWrap: "pretty",
    overflowWrap: "break-word",
    wordBreak: "normal",
    lineBreak: "auto",
    hyphens: justify ? "auto" : "manual",
  };

  const inlineToneClass = compact ? INLINE_TONE_COMPACT : INLINE_TONE_PRIMARY;

  const paragraphClassName = compact
    ? cn("text-[13.5px] leading-[1.62] text-inherit", inlineToneClass)
    : cn(
        /* `max-w-[var(--reader-prose-w,70ch)]` — the 70ch is the
           reading-sanctuary default. The user's app can set
           `--reader-prose-w` on document root (or any ancestor)
           to widen during fullscreen, e.g.:
             :root[data-reader-fullscreen] {
               --reader-prose-w: min(92ch, 100%);
             }
           `mx-auto` centers the constrained block within its
           container so wide viewports don't leave dead space on
           one side. */
        "mx-auto max-w-[var(--reader-prose-w,70ch)] text-[15.5px] leading-[1.8] text-lib-text/92",
        inlineToneClass,
      );

  const listClassName = compact
    ? cn(
        "space-y-[4px] ps-5 text-[13.5px] leading-[1.6]",
        "marker:text-lib-text-muted/55",
        inlineToneClass,
      )
    : cn(
        /* Same CSS-variable + mx-auto rationale as paragraphClassName. */
        "mx-auto max-w-[var(--reader-prose-w,70ch)] space-y-[6px] ps-6 text-[15.5px] leading-[1.8] text-lib-text/92",
        "marker:text-lib-text-muted/50",
        inlineToneClass,
      );

  /* ─── Dim mode ─── */
  if (!anchorPrimary) {
    const dimStyle: ReaderCSS = {
      textAlign: "start",
      textWrap: "pretty",
      overflowWrap: "break-word",
      hyphens: "manual",
    };
    return (
      <section
        data-anchor-mode="compact"
        aria-label="canonical text"
        className={cn(
          "mt-2 rounded-e-[4px]",
          "border-s-[2px] border-lib-border/40 ps-3 pe-1 py-0.5",
          "text-[13px] leading-[1.62] text-lib-text-muted/85",
          "[&_strong]:font-[680] [&_strong]:text-lib-text-muted",
          "[&_em]:[font-style:oblique_12deg] [&_em]:text-lib-text-muted",
          "[&_code]:rounded-[3px] [&_code]:bg-lib-hover/40 [&_code]:px-1",
          "[&_code]:font-mono [&_code]:text-[0.9em]",
        )}
      >
        <div className="space-y-2">
          {blocks.map((block, index) => (
            <p key={index} className="whitespace-pre-wrap" style={dimStyle}>
              {renderInlineRich(block)}
            </p>
          ))}
        </div>
      </section>
    );
  }

  /* ─── Primary reading surface ─── */
  return (
    <div
      className={compact ? "space-y-[6px]" : "space-y-[9px]"}
      data-anchor-mode="primary"
    >
      {blocks.map((block, index) => {
        const lines = block
          .split("\n")
          .map((line) => line.trimEnd())
          .filter(Boolean);
        if (lines.length === 0) return null;

        // ─── Code fence (always LTR) ──
        if (isCodeFence(lines)) {
          return (
            <pre
              key={index}
              dir="ltr"
              className={cn(
                "overflow-x-auto rounded-[8px] border border-lib-border/40",
                "bg-zinc-950/95 px-4 py-3 text-zinc-100",
                "font-mono text-[12.75px] leading-[1.68]",
                "dark:bg-zinc-900/80",
              )}
            >
              <code>{lines.slice(1, -1).join("\n")}</code>
            </pre>
          );
        }

        // ─── Table ──
        if (isTable(lines)) {
          return <div key={index}>{renderTable(lines, compact)}</div>;
        }

        // ─── Blockquote ──
        if (isBlockquote(lines)) {
          return (
            <div key={index}>
              {renderBlockquote(lines, inlineToneClass, compact)}
            </div>
          );
        }

        // ─── Bullet list (with 2-space-indent nested support) ──
        if (isBulletList(lines)) {
          const items = lines.map((line) => {
            const match = line.match(/^(\s*)[-*]\s+(.*)$/);
            return {
              depth: match ? Math.floor((match[1]?.length ?? 0) / 2) : 0,
              text: match?.[2] ?? line,
            };
          });

          const liStyle: ReaderCSS = {
            textAlign: justify ? "justify" : "start",
            textJustify: justify ? "inter-word" : undefined,
            textAlignLast: justify ? "start" : undefined,
            textWrap: "pretty",
            overflowWrap: "break-word",
            hyphens: justify ? "auto" : "manual",
          };

          return (
            <ul
              key={index}
              className={cn("list-disc", listClassName)}
            >
              {items.map((item, lineIndex) => (
                <li
                  key={lineIndex}
                  className={item.depth > 0 ? "list-[circle]" : undefined}
                  style={{
                    ...liStyle,
                    marginInlineStart:
                      item.depth > 0 ? `${item.depth * 14}px` : undefined,
                  }}
                >
                  {renderInlineRich(item.text)}
                </li>
              ))}
            </ul>
          );
        }

        // ─── Ordered list ──
        if (isOrderedList(lines)) {
          const liStyle: ReaderCSS = {
            textAlign: justify ? "justify" : "start",
            textJustify: justify ? "inter-word" : undefined,
            textAlignLast: justify ? "start" : undefined,
            textWrap: "pretty",
            overflowWrap: "break-word",
            hyphens: justify ? "auto" : "manual",
          };

          return (
            <ol
              key={index}
              className={cn(
                "list-decimal tabular-nums",
                listClassName,
                "marker:font-mono marker:text-[0.88em] marker:text-lib-text-muted/60",
              )}
            >
              {lines.map((line, lineIndex) => (
                <li key={lineIndex} style={liStyle}>
                  {renderInlineRich(line.replace(/^\s*\d+\.\s+/, ""))}
                </li>
              ))}
            </ol>
          );
        }

        // ─── Paragraph (default) ──
        return (
          <p key={index} className={paragraphClassName} style={proseStyle}>
            {renderInlineRich(lines.join(" "))}
          </p>
        );
      })}
    </div>
  );
}
