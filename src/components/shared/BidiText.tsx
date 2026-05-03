/**
 * BidiText — renders Persian-dominant plain text with isolated LTR spans.
 *
 * No "use client" needed: this component uses no hooks, no browser APIs,
 * and no event handlers.  It is safe as a server component and as a child
 * of client components.
 *
 * Latin/Greek medical terms (alpha-blocker, PDE5 inhibitor, 5 mg,
 * 148_01:q-01, transition zone, BPH, LUTS …) are wrapped in:
 *   dir="ltr"  style="direction:ltr;unicode-bidi:isolate;display:inline"
 *   data-bidi-run="ltr"
 *
 * The outer wrapper is direction-neutral (inherits the parent dir="rtl").
 * No whole-container LTR direction is introduced.
 *
 * Usage (plain text):
 *   <div dir="rtl" lang="fa" data-bidi-text="flashcard">
 *     <BidiText text={strip(card.frontHtml)} />
 *   </div>
 */

import React from "react";
import { splitBidiRuns } from "@/lib/text/bidi";

interface BidiTextProps {
  /** Plain-text string (HTML already stripped). */
  text: string;
  className?: string;
}

const LTR_STYLE: React.CSSProperties = {
  direction: "ltr",
  unicodeBidi: "isolate",
  display: "inline",
  whiteSpace: "inherit",
};

export function BidiText({ text, className }: BidiTextProps) {
  if (!text) return null;

  const runs = splitBidiRuns(text);
  if (runs.length === 0) return null;

  // Fast path: single RTL-only segment
  if (runs.length === 1 && !runs[0].isLtr) {
    return className ? (
      <span className={className}>{runs[0].text}</span>
    ) : (
      <>{runs[0].text}</>
    );
  }

  return (
    <span className={className}>
      {runs.map((run, idx) =>
        run.isLtr ? (
          <span
            key={idx}
            dir="ltr"
            style={LTR_STYLE}
            data-bidi-run="ltr"
          >
            {run.text}
          </span>
        ) : (
          <React.Fragment key={idx}>{run.text}</React.Fragment>
        ),
      )}
    </span>
  );
}
