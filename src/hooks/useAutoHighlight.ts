"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReaderAnnotation, ReaderSelectionPayload } from "./useReaderAnnotations";
import { resolveSelectionAgainstCanonicalSurface } from "@/components/flashcard/SelectionPopup";
import { DEFAULT_READER_HIGHLIGHT_COLOR, normalizeHighlightColor } from "@/lib/readerHighlightPalette";

export const AUTO_HIGHLIGHT_KEY = "starship.reader.autoHighlight";
const LAST_COLOR_KEY = "reader:highlight-color:last";

function readPref(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(AUTO_HIGHLIGHT_KEY) === "true";
}

function writePref(v: boolean) {
  try { localStorage.setItem(AUTO_HIGHLIGHT_KEY, String(v)); } catch {}
}

function getActiveColor(): string {
  if (typeof localStorage === "undefined") return DEFAULT_READER_HIGHLIGHT_COLOR;
  return normalizeHighlightColor(localStorage.getItem(LAST_COLOR_KEY));
}

interface UseAutoHighlightOptions {
  annotations: ReaderAnnotation[];
  onHighlight: (payload: ReaderSelectionPayload, color: string) => void;
  contentSelector?: string;
}

export function useAutoHighlight({
  annotations,
  onHighlight,
  contentSelector = "[data-reader-content]",
}: UseAutoHighlightOptions) {
  // Initialize with false to avoid SSR mismatch; hydrate on mount.
  const [enabled, setEnabled] = useState<boolean>(false);

  useEffect(() => {
    setEnabled(readPref());
  }, []);

  const toggle = useCallback(() => {
    setEnabled((v) => {
      const next = !v;
      writePref(next);
      return next;
    });
  }, []);

  // Stable refs so the settled-event handler reads current values
  // without needing to re-register on every render.
  const annotationsRef = useRef(annotations);
  const onHighlightRef = useRef(onHighlight);
  const enabledRef = useRef(enabled);

  useEffect(() => { annotationsRef.current = annotations; }, [annotations]);
  useEffect(() => { onHighlightRef.current = onHighlight; }, [onHighlight]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  useEffect(() => {
    const handler = () => {
      if (!enabledRef.current) return;

      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";
      // Mirror SelectionPopup's min/max guards exactly.
      if (!text || text.length < 3 || text.length > 2000) return;

      const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
      if (!range) return;

      // Must be inside the reader content container.
      const anchorEl =
        range.commonAncestorContainer instanceof Element
          ? range.commonAncestorContainer
          : (range.commonAncestorContainer as Node).parentElement;
      if (!anchorEl?.closest(contentSelector)) return;

      // Must not originate from interactive / UI regions.
      if (anchorEl.closest("input, textarea, [contenteditable=true], button, [role=menu], [role=dialog]")) return;

      const frameEl = anchorEl.closest<HTMLElement>("[data-frame-id]");
      const sectionEl = anchorEl.closest<HTMLElement>("[data-section-id]");
      const frameId = frameEl?.dataset.frameId ?? null;

      // Skip if an overlapping highlight for this range already exists
      // (mirrors overlappingHighlightIds logic in SelectionPopup).
      const textLower = text.toLowerCase();
      const isDuplicate = annotationsRef.current.some(
        (ann) =>
          ann.type === "highlight" &&
          ann.frameId === frameId &&
          (textLower.includes(ann.quote.toLowerCase()) ||
            ann.quote.toLowerCase().includes(textLower)),
      );
      if (isDuplicate) return;

      // Resolve with the same canonical-surface function used by SelectionPopup.
      const resolved = resolveSelectionAgainstCanonicalSurface(frameEl ?? null, range, text);

      const payload: ReaderSelectionPayload = {
        text,
        frameId,
        sectionId: sectionEl?.dataset.sectionId ?? null,
        blockText: resolved.blockText,
        start: resolved.start,
        end: resolved.end,
        contentHash: resolved.contentHash,
      };

      onHighlightRef.current(payload, getActiveColor());
    };

    document.addEventListener("reader:selection-settled", handler);
    return () => document.removeEventListener("reader:selection-settled", handler);
  }, [contentSelector]);

  return { autoHighlight: enabled, toggleAutoHighlight: toggle };
}

