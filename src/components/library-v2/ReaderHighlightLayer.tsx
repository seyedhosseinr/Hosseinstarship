"use client";

import { useEffect, useRef, type RefObject } from "react";

import {
  resolveAnchorRange,
  resolveAnchorRangeByFrameId,
} from "@/lib/local-first/anchorResolver";
import type { ReaderAnnotation } from "@/hooks/useReaderAnnotations";

/**
 * Paint highlight + underline annotations onto reader text without
 * mutating the article DOM.
 *
 * Primary path: CSS Custom Highlight API. Each (kind, color) pairs to a
 * named bucket; ranges are pushed into a Highlight() and registered in
 * `CSS.highlights`. The browser renders them with the ::highlight() rules
 * defined in `reader-highlights.css`.
 *
 * Fallback path: when `CSS.highlights` is undefined (older Safari < 17.2,
 * Firefox < 124), render absolutely-positioned <div> rectangles inside a
 * portal-style overlay that follows the reader stage. Uses
 * `Range.getClientRects()` so multi-line spans paint correctly.
 *
 * Re-resolves ranges on:
 *   - annotations array changes
 *   - article ResizeObserver fires (font-size / column-width / window resize)
 *   - reader stage scroll (fallback path only — Custom Highlight tracks
 *     scroll natively)
 *
 * Anchoring: uses stored character offsets when present, falls back to
 * a one-shot quote-search inside the canonical surface for legacy rows.
 */

interface Props {
  annotations: ReaderAnnotation[];
  contentSelector: string;
  scrollRef: RefObject<HTMLElement | null>;
  visible?: boolean;
}

interface Bucket {
  name: string;
  color: string | null;
  kind: "highlight" | "underline";
  ranges: { id: string; range: Range }[];
}

const HL_PREFIX = "rdr-hl-";
const UL_NAME = "rdr-ul";

const PALETTE_HEX = new Set(["DFFF4F", "B8F36B", "98F0FF", "F7A8D7", "F7BE62"]);

function hexFromColor(color: string | null | undefined): string {
  if (!color) return "default";
  const m = color.replace(/^#/, "").toUpperCase();
  return PALETTE_HEX.has(m) ? m : "default";
}

function bucketName(ann: ReaderAnnotation): string {
  if (ann.type === "underline") return UL_NAME;
  if (ann.type === "highlight") return `${HL_PREFIX}${hexFromColor(ann.color)}`;
  return ""; // comments handled by NoteMarkerLayer in 3b
}

function findRangeByQuote(
  scope: ParentNode,
  frameId: string | null,
  quote: string,
): Range | null {
  // Legacy fallback: stored row has no offsets. Find the quote inside the
  // frame's canonical surface (or the frame itself), pick the first match.
  if (!quote.trim()) return null;
  const escaped =
    typeof CSS !== "undefined" && "escape" in CSS
      ? CSS.escape(frameId ?? "")
      : (frameId ?? "");
  const frame = frameId
    ? scope.querySelector<HTMLElement>(`[data-frame-id="${escaped}"]`)
    : null;
  if (!frame) return null;
  const surface =
    frame.querySelector<HTMLElement>("[data-anchor-surface='canonical']") ??
    frame;
  const text = surface.textContent ?? "";
  const idx = text.indexOf(quote);
  if (idx < 0) return null;
  return resolveAnchorRange(frame, idx, idx + quote.length);
}

interface CSSHighlightRegistry {
  set(name: string, value: object): void;
  delete(name: string): boolean;
  forEach(cb: (value: object, name: string) => void): void;
}

interface CSSWithHighlights {
  highlights?: CSSHighlightRegistry;
}

declare const Highlight: {
  new (...ranges: Range[]): object;
};

function clearOurBuckets(reg: CSSHighlightRegistry) {
  const toDelete: string[] = [];
  reg.forEach((_v, name) => {
    if (name.startsWith(HL_PREFIX) || name === UL_NAME) toDelete.push(name);
  });
  for (const name of toDelete) reg.delete(name);
}

function selectRange(range: Range): void {
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}

function dispatchAnnotationClicked(annotationId: string, kind: "highlight" | "underline"): void {
  document.dispatchEvent(
    new CustomEvent("reader:annotation-clicked", {
      detail: { annotationId, kind },
    }),
  );
}

export function ReaderHighlightLayer({
  annotations,
  contentSelector,
  scrollRef,
  visible = true,
}: Props): null {
  // Used in fallback path to host overlay rects.
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const cssRoot = (window.CSS ?? null) as CSSWithHighlights | null;
    const supportsCustomHighlight = !!cssRoot?.highlights && typeof Highlight !== "undefined";

    const article = document.querySelector<HTMLElement>(contentSelector);
    if (!article) return;

    const repaint = () => {
      // Build buckets — one Highlight per (kind, color).
      const buckets = new Map<string, Bucket>();
      let resolvedExact = 0;
      let resolvedQuote = 0;
      let missed = 0;
      if (visible) {
        for (const ann of annotations) {
          const name = bucketName(ann);
          if (!name) continue; // comment is rendered by the marker layer
          let range: Range | null = null;
          let viaOffsets = false;
          if (
            typeof ann.blockOffsetStart === "number" &&
            typeof ann.blockOffsetEnd === "number" &&
            ann.frameId
          ) {
            range = resolveAnchorRangeByFrameId(
              article,
              ann.frameId,
              ann.blockOffsetStart,
              ann.blockOffsetEnd,
            );
            if (range) viaOffsets = true;
          }
          if (!range) {
            range = findRangeByQuote(article, ann.frameId, ann.quote);
          }
          if (!range) {
            missed++;
            continue;
          }
          if (viaOffsets) resolvedExact++;
          else resolvedQuote++;
          let bucket = buckets.get(name);
          if (!bucket) {
            bucket = {
              name,
              color: ann.color ?? null,
              kind: ann.type === "underline" ? "underline" : "highlight",
              ranges: [],
            };
            buckets.set(name, bucket);
          }
          bucket.ranges.push({ id: ann.id, range });
        }
      }

      // Custom Highlight path paints visually via CSS.highlights.
      // Fallback path paints visually via overlay rects.
      // Either way, we always paint a HIT overlay (transparent buttons
      // per range rect with pointer-events:auto) so click-to-edit works.
      if (supportsCustomHighlight && cssRoot?.highlights) {
        clearOurBuckets(cssRoot.highlights);
        for (const bucket of buckets.values()) {
          if (!bucket.ranges.length) continue;
          const h = new Highlight(...bucket.ranges.map((r) => r.range));
          cssRoot.highlights.set(bucket.name, h);
        }
      }

      let overlay = overlayRef.current;
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.dataset.readerHighlightOverlay = "true";
        Object.assign(overlay.style, {
          position: "absolute",
          inset: "0",
          pointerEvents: "none", // children re-enable per hit rect
          zIndex: "1",
        });
        const articleParent = article.parentElement;
        if (articleParent) {
          const cs = window.getComputedStyle(articleParent);
          if (cs.position === "static") {
            articleParent.style.position = "relative";
          }
          articleParent.appendChild(overlay);
          overlayRef.current = overlay;
        }
      }
      if (!overlay) return;
      overlay.replaceChildren();
      const articleRect = article.getBoundingClientRect();
      for (const bucket of buckets.values()) {
        for (const { id, range } of bucket.ranges) {
          const rects = range.getClientRects();
          for (const rect of Array.from(rects)) {
            const el = document.createElement("button");
            el.type = "button";
            el.dataset.readerAnnotationHit = id;
            el.setAttribute(
              "aria-label",
              bucket.kind === "underline" ? "Edit underline" : "Edit highlight",
            );
            Object.assign(el.style, {
              position: "absolute",
              left: `${rect.left - articleRect.left}px`,
              top: `${rect.top - articleRect.top}px`,
              width: `${rect.width}px`,
              height: `${rect.height}px`,
              padding: "0",
              margin: "0",
              border: "none",
              borderRadius: "0.2rem",
              cursor: "pointer",
              pointerEvents: "auto",
              background: "transparent",
            });
            if (!supportsCustomHighlight) {
              if (bucket.kind === "underline") {
                el.style.borderBottom = "2px solid currentColor";
                el.style.opacity = "0.65";
              } else {
                el.style.backgroundColor = bucket.color ?? "#DFFF4F";
                el.style.mixBlendMode = "multiply";
              }
            }
            // Capture the live range so the click handler keeps working
            // even if the overlay is repainted while the click bubbles.
            const r = range.cloneRange();
            const annId = id;
            const annKind = bucket.kind;
            el.addEventListener("click", (e) => {
              e.stopPropagation();
              selectRange(r);
              dispatchAnnotationClicked(annId, annKind);
            });
            overlay.appendChild(el);
          }
        }
      }

      // Tell the debug overlay how the last repaint went.
      document.dispatchEvent(
        new CustomEvent("reader:highlights-painted", {
          detail: {
            painted: resolvedExact + resolvedQuote,
            viaOffsets: resolvedExact,
            viaQuote: resolvedQuote,
            missed,
            fallback: !supportsCustomHighlight,
          },
        }),
      );
    };

    // Initial paint after the next frame so layout is settled.
    let raf = requestAnimationFrame(repaint);

    const ro = new ResizeObserver(() => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(repaint);
    });
    ro.observe(article);

    let scrollRaf = 0;
    const stage = scrollRef.current;
    const onScroll = () => {
      // Custom Highlight rendering itself tracks scroll natively, but the
      // hit overlay (transparent click rects) is DOM and must be re-laid
      // out on scroll to keep click targets aligned with painted spans.
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
      if (supportsCustomHighlight && cssRoot?.highlights) {
        clearOurBuckets(cssRoot.highlights);
      }
      const overlay = overlayRef.current;
      if (overlay && overlay.parentElement) {
        overlay.parentElement.removeChild(overlay);
      }
      overlayRef.current = null;
    };
  }, [annotations, contentSelector, scrollRef, visible]);

  return null;
}
