"use client";

import { READER_HIGHLIGHT_COLORS } from "@/lib/readerHighlightPalette";

function buildCSS(): string {
  const rules: string[] = [];

  for (const c of READER_HIGHLIGHT_COLORS) {
    const key = c.storage.replace(/^#/, "");
    rules.push(
      `::highlight(rdr-hl-${key}) { background-color: transparent; color: inherit; }`,
    );
    rules.push(
      `::highlight(rdr-ul-${key}) { text-decoration-line: underline; text-decoration-style: solid; text-decoration-thickness: 2px; text-underline-offset: 0.18em; text-decoration-color: ${c.underline}; color: inherit; }`,
    );
  }

  // Legacy underline bucket (no colour suffix) — keeps old annotations working
  rules.push(
    `::highlight(rdr-ul) { text-decoration-line: underline; text-decoration-style: solid; text-decoration-thickness: 2px; text-underline-offset: 0.18em; text-decoration-color: color-mix(in oklab, hsl(var(--primary)) 65%, transparent); }`,
  );

  return `@supports selector(::highlight(x)) {\n${rules.join("\n")}\n}`;
}

const CSS = buildCSS();

export default function ReaderHighlightStyles() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}
