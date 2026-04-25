"use client";

import { useEffect, useRef, type RefObject } from "react";

import {
  resolveAnchorRange,
  resolveAnchorRangeByFrameId,
} from "@/lib/local-first/anchorResolver";
import type { ReaderAnnotation } from "@/hooks/useReaderAnnotations";

/**
 * Sticky-note marker overlay.
 *
 * For every `kind: "comment"` annotation, paint a small clickable glyph
 * at the trailing edge of the resolved Range (right in LTR, left in
 * RTL). The marker is absolutely positioned inside an overlay that lives
 * as a sibling of the article — never inside React-owned DOM.
 *
 * Click on a marker programmatically restores the selection to the
 * annotation's range. The selection watcher then fires
 * `reader:selection-settled` and SelectionPopup opens with the existing
 * payload. Auto-opening the comment editor for edit/delete is wired in
 * commit 5 (click-to-edit on painted annotations).
 *
 * Repaints on annotations change, article ResizeObserver, and stage
 * scroll (rAF-throttled).
 */

interface Props {
  annotations: ReaderAnnotation[];
  contentSelector: string;
  scrollRef: RefObject<HTMLElement | null>;
  visible?: boolean;
}

const MARKER_SIZE = 14;

function findRangeForComment(
  scope: ParentNode,
  ann: ReaderAnnotation,
): Range | null {
  if (
    typeof ann.blockOffsetStart === "number" &&
    typeof ann.blockOffsetEnd === "number" &&
    ann.frameId
  ) {
    const r = resolveAnchorRangeByFrameId(
      scope,
      ann.frameId,
      ann.blockOffsetStart,
      ann.blockOffsetEnd,
    );
    if (r) return r;
  }
  // Legacy fallback: first occurrence of quote inside the frame.
  if (!ann.quote.trim() || !ann.frameId) return null;
  const escaped =
    typeof CSS !== "undefined" && "escape" in CSS
      ? CSS.escape(ann.frameId)
      : ann.frameId;
  const frame = scope.querySelector<HTMLElement>(
    `[data-frame-id="${escaped}"]`,
  );
  if (!frame) return null;
  const surface =
    frame.querySelector<HTMLElement>("[data-anchor-surface='canonical']") ??
    frame;
  const text = surface.textContent ?? "";
  const idx = text.indexOf(ann.quote);
  if (idx < 0) return null;
  return resolveAnchorRange(frame, idx, idx + ann.quote.length);
}

function rectIsRtl(scope: HTMLElement): boolean {
  return window.getComputedStyle(scope).direction === "rtl";
}

function selectRange(range: Range): void {
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}

export function NoteMarkerLayer({
  annotations,
  contentSelector,
  scrollRef,
  visible = true,
}: Props): null {
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const article = document.querySelector<HTMLElement>(contentSelector);
    if (!article) return;
    const articleParent = article.parentElement;
    if (!articleParent) return;

    // Ensure positioning context.
    const cs = window.getComputedStyle(articleParent);
    if (cs.position === "static") {
      articleParent.style.position = "relative";
    }

    let overlay = overlayRef.current;
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.dataset.readerNoteOverlay = "true";
      Object.assign(overlay.style, {
        position: "absolute",
        inset: "0",
        pointerEvents: "none", // children re-enable for the glyphs
        zIndex: "2",
      });
      articleParent.appendChild(overlay);
      overlayRef.current = overlay;
    }

    const repaint = () => {
      if (!overlay) return;
      overlay.replaceChildren();
      if (!visible) return;
      const articleRect = article.getBoundingClientRect();
      const rtl = rectIsRtl(article);

      for (const ann of annotations) {
        if (ann.type !== "comment") continue;
        const range = findRangeForComment(article, ann);
        if (!range) continue;
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;

        const x = rtl
          ? rect.left - articleRect.left - MARKER_SIZE
          : rect.right - articleRect.left;
        const y = rect.top - articleRect.top + (rect.height - MARKER_SIZE) / 2;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.readerNoteMarker = ann.id;
        const excerpt = (ann.comment ?? "").trim().slice(0, 80) || "Note";
        btn.setAttribute("aria-label", `Note: ${excerpt}`);
        btn.title = excerpt;
        Object.assign(btn.style, {
          position: "absolute",
          left: `${x}px`,
          top: `${y}px`,
          width: `${MARKER_SIZE}px`,
          height: `${MARKER_SIZE}px`,
          padding: "0",
          margin: "0",
          border: "none",
          borderRadius: "9999px",
          background: "color-mix(in oklab, hsl(var(--primary)) 80%, transparent)",
          color: "white",
          cursor: "pointer",
          pointerEvents: "auto",
          fontSize: "10px",
          lineHeight: "1",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
        });
        btn.textContent = "✎";
        const annId = ann.id;
        const annComment = ann.comment ?? "";
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          selectRange(range);
          // Tells SelectionPopup to enter commentMode and pre-populate
          // with the existing note text (so save = update, delete = remove).
          document.dispatchEvent(
            new CustomEvent("reader:edit-note", {
              detail: { annotationId: annId, comment: annComment },
            }),
          );
        });
        overlay.appendChild(btn);
      }
    };

    let raf = requestAnimationFrame(repaint);
    const ro = new ResizeObserver(() => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(repaint);
    });
    ro.observe(article);

    let scrollRaf = 0;
    const stage = scrollRef.current;
    const onScroll = () => {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = 0;
        repaint();
      });
    };
    stage?.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
      ro.disconnect();
      stage?.removeEventListener("scroll", onScroll);
      const o = overlayRef.current;
      if (o && o.parentElement) o.parentElement.removeChild(o);
      overlayRef.current = null;
    };
  }, [annotations, contentSelector, scrollRef, visible]);

  return null;
}
