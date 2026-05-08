"use client";

import { useEffect, useRef, type RefObject } from "react";

import type { ReaderAnnotation } from "@/hooks/useReaderAnnotations";
import { resolveAnchorRangeByFrameId } from "@/lib/local-first/anchorResolver";

/**
 * ReaderHighlightLayer
 *
 * Paints persisted Reader annotations without mutating the article DOM.
 *
 * Strategy:
 * 1. CSS Custom Highlight API for visual painting when supported.
 * 2. Transparent absolute overlay buttons for click/edit hit targets.
 * 3. Fallback visual overlay if CSS Custom Highlight API is unavailable.
 *
 * Important:
 * - This file is for persisted annotations only.
 * - Do not put WebGPU live ink here.
 * - WebGPU should live in a separate PencilGpuInkLayer.tsx.
 * - Final persistence remains the existing CSS Highlight + annotation storage path.
 */

interface Props {
  annotations: ReaderAnnotation[];
  contentSelector: string;
  scrollRef: RefObject<HTMLElement | null>;
  visible?: boolean;
}

type PaintKind = "highlight" | "underline";
type ResolutionMethod = "offsets" | "quote";

interface ResolvedAnnotationRange {
  id: string;
  kind: PaintKind;
  color: string | null;
  range: Range;
}

interface ResolvedRange {
  range: Range;
  method: ResolutionMethod;
}

interface Bucket {
  name: string;
  color: string | null;
  kind: PaintKind;
  ranges: ResolvedAnnotationRange[];
}

interface BuildResult {
  buckets: Map<string, Bucket>;
  painted: number;
  viaOffsets: number;
  viaQuote: number;
  missed: number;
}

interface CSSHighlightRegistry {
  set(name: string, value: object): void;
  delete(name: string): boolean;
  forEach(cb: (value: object, name: string) => void): void;
}

interface CSSWithHighlights {
  highlights?: CSSHighlightRegistry;
}

type HighlightOverlayElement = HTMLDivElement & {
  _delegatedClickHandler?: EventListener;
};

type RangeCache = Map<string, ResolvedRange | null>;

declare const Highlight: {
  new (...ranges: Range[]): object;
};

const HL_PREFIX = "rdr-hl-";
const UL_PREFIX = "rdr-ul-";
const LEGACY_UL_NAME = "rdr-ul";
const STYLE_SHEET_ID = "rdr-highlight-layer-styles";

/**
 * Canonical highlight palette — Readwise inspired
 * زرد Readwise به عنوان رنگ پیش‌فرض Reader استفاده می‌شود.
 */
const PALETTE: ReadonlyMap<string, string> = new Map([
  ["FFEB3B", "#FFEB3B"], // زرد اصلی Readwise
  ["A5D6A7", "#A5D6A7"], // سبز ملایم
  ["81D4FA", "#81D4FA"], // آبی روشن
  ["F8BBD0", "#F8BBD0"], // صورتی ملایم
  ["FFCC80", "#FFCC80"], // نارنجی ملایم
  ["default", "#FFEB3B"],
]);

function applyStyles(element: HTMLElement, styles: Record<string, string>): void {
  Object.assign(element.style, styles);
}

function getCssHighlightRegistry(): CSSHighlightRegistry | null {
  if (typeof window === "undefined") return null;

  const cssRoot = (window.CSS ?? null) as CSSWithHighlights | null;
  if (!cssRoot?.highlights) return null;
  if (typeof Highlight === "undefined") return null;

  return cssRoot.highlights;
}

function ensureHighlightStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_SHEET_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_SHEET_ID;

  const rules: string[] = [];

  for (const [hex, color] of PALETTE) {
    rules.push(
      `::highlight(${HL_PREFIX}${hex}) { background-color: ${color}; color: inherit; }`,
    );

    rules.push(
      `::highlight(${UL_PREFIX}${hex}) { text-decoration-line: underline; text-decoration-thickness: 2px; text-decoration-color: ${color}; text-underline-offset: 0.18em; color: inherit; }`,
    );
  }

  rules.push(
    `::highlight(${LEGACY_UL_NAME}) { text-decoration-line: underline; text-decoration-thickness: 2px; text-underline-offset: 0.18em; color: inherit; }`,
  );

  style.textContent = rules.join("\n");
  document.head.appendChild(style);
}

function clearOurBuckets(registry: CSSHighlightRegistry): void {
  const names: string[] = [];

  registry.forEach((_value, name) => {
    if (
      name.startsWith(HL_PREFIX) ||
      name.startsWith(UL_PREFIX) ||
      name === LEGACY_UL_NAME
    ) {
      names.push(name);
    }
  });

  for (const name of names) {
    registry.delete(name);
  }
}

function paintCssHighlights(
  registry: CSSHighlightRegistry,
  buckets: Map<string, Bucket>,
): void {
  clearOurBuckets(registry);

  for (const bucket of buckets.values()) {
    if (!bucket.ranges.length) continue;

    const highlight = new Highlight(...bucket.ranges.map((item) => item.range));
    registry.set(bucket.name, highlight);
  }
}

function hexFromColor(color: string | null | undefined): string {
  if (!color) return "default";

  const normalized = color.replace(/^#/, "").toUpperCase();
  return PALETTE.has(normalized) ? normalized : "default";
}

function colorFromHexKey(hex: string): string {
  return PALETTE.get(hex) ?? PALETTE.get("default") ?? "#FFEB3B";
}

function bucketName(ann: ReaderAnnotation): string {
  const hex = hexFromColor(ann.color);

  if (ann.type === "underline") return `${UL_PREFIX}${hex}`;
  if (ann.type === "highlight") return `${HL_PREFIX}${hex}`;

  return "";
}

function resolveRangeWithinSurface(
  surface: HTMLElement,
  start: number,
  end: number,
): Range | null {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || end < start) return null;

  const surfaceLength = (surface.textContent ?? "").length;
  if (end > surfaceLength) return null;

  const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT);

  let acc = 0;
  let startNode: Node | null = null;
  let startOffset = 0;
  let endNode: Node | null = null;
  let endOffset = 0;
  let lastNode: Node | null = null;
  let lastNodeLength = 0;

  let node: Node | null;
  while ((node = walker.nextNode())) {
    const len = node.textContent?.length ?? 0;
    const nodeEnd = acc + len;

    if (!startNode && start <= nodeEnd) {
      startNode = node;
      startOffset = Math.max(0, start - acc);
    }

    if (end <= nodeEnd) {
      endNode = node;
      endOffset = Math.max(0, end - acc);
      break;
    }

    acc = nodeEnd;
    lastNode = node;
    lastNodeLength = len;
  }

  if (!endNode && lastNode && end === acc) {
    endNode = lastNode;
    endOffset = lastNodeLength;
  }

  if (!startNode && lastNode && start === acc + lastNodeLength) {
    startNode = lastNode;
    startOffset = lastNodeLength;
  }

  if (!startNode || !endNode) return null;

  try {
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    return range;
  } catch {
    return null;
  }
}

function findRangeInSurfaceByQuote(surface: HTMLElement, quote: string): Range | null {
  const normalizedQuote = quote.trim();
  if (!normalizedQuote) return null;

  const text = surface.textContent ?? "";
  const index = text.indexOf(normalizedQuote);
  if (index < 0) return null;

  return resolveRangeWithinSurface(surface, index, index + normalizedQuote.length);
}

function findRangeByQuote(
  scope: ParentNode,
  frameId: string | null,
  quote: string,
): Range | null {
  if (!quote.trim()) return null;

  const root: HTMLElement | null = (() => {
    if (!frameId) {
      return scope instanceof HTMLElement ? scope : null;
    }

    const escaped =
      typeof CSS !== "undefined" && "escape" in CSS
        ? CSS.escape(frameId)
        : frameId;

    return scope.querySelector<HTMLElement>(`[data-frame-id="${escaped}"]`);
  })();

  if (!root) return null;

  const richSurfaces = Array.from(
    root.querySelectorAll<HTMLElement>("[data-reader-annotation-surface]"),
  );

  for (const surface of richSurfaces) {
    const range = findRangeInSurfaceByQuote(surface, quote);
    if (range) return range;
  }

  const canonicalSurface = root.querySelector<HTMLElement>(
    "[data-anchor-surface='canonical']",
  );

  if (canonicalSurface) {
    const range = findRangeInSurfaceByQuote(canonicalSurface, quote);
    if (range) return range;
  }

  return findRangeInSurfaceByQuote(root, quote);
}

function resolveAnnotationRange(
  article: HTMLElement,
  ann: ReaderAnnotation,
): ResolvedRange | null {
  if (
    ann.frameId &&
    typeof ann.blockOffsetStart === "number" &&
    typeof ann.blockOffsetEnd === "number"
  ) {
    const exact = resolveAnchorRangeByFrameId(
      article,
      ann.frameId,
      ann.blockOffsetStart,
      ann.blockOffsetEnd,
    );

    if (exact) {
      return {
        range: exact,
        method: "offsets",
      };
    }
  }

  const quoteRange = findRangeByQuote(article, ann.frameId ?? null, ann.quote);

  if (quoteRange) {
    return {
      range: quoteRange,
      method: "quote",
    };
  }

  return null;
}

function cacheKeyForAnnotation(ann: ReaderAnnotation): string {
  return [
    ann.id,
    ann.type,
    ann.frameId ?? "",
    ann.blockOffsetStart ?? "",
    ann.blockOffsetEnd ?? "",
    ann.quote ?? "",
  ].join("|");
}

function resolveWithCache(
  article: HTMLElement,
  ann: ReaderAnnotation,
  cache: RangeCache,
): ResolvedRange | null {
  const key = cacheKeyForAnnotation(ann);

  if (cache.has(key)) {
    return cache.get(key) ?? null;
  }

  const resolved = resolveAnnotationRange(article, ann);
  cache.set(key, resolved);

  return resolved;
}

function buildBuckets(
  article: HTMLElement,
  annotations: ReaderAnnotation[],
  visible: boolean,
  cache: RangeCache,
): BuildResult {
  const buckets = new Map<string, Bucket>();

  let viaOffsets = 0;
  let viaQuote = 0;
  let missed = 0;

  if (!visible) {
    return {
      buckets,
      painted: 0,
      viaOffsets,
      viaQuote,
      missed,
    };
  }

  for (const ann of annotations) {
    const name = bucketName(ann);
    if (!name) continue;

    const resolved = resolveWithCache(article, ann, cache);

    if (!resolved) {
      missed++;
      continue;
    }

    if (resolved.method === "offsets") {
      viaOffsets++;
    } else {
      viaQuote++;
    }

    const kind: PaintKind = ann.type === "underline" ? "underline" : "highlight";
    const colorKey = hexFromColor(ann.color);
    const color = ann.color ?? colorFromHexKey(colorKey);

    let bucket = buckets.get(name);
    if (!bucket) {
      bucket = {
        name,
        color,
        kind,
        ranges: [],
      };

      buckets.set(name, bucket);
    }

    bucket.ranges.push({
      id: ann.id,
      kind,
      color,
      range: resolved.range,
    });
  }

  return {
    buckets,
    painted: viaOffsets + viaQuote,
    viaOffsets,
    viaQuote,
    missed,
  };
}

function ensureOverlay(
  article: HTMLElement,
  overlayRef: RefObject<HTMLDivElement | null>,
): HTMLDivElement | null {
  if (overlayRef.current?.isConnected) {
    return overlayRef.current;
  }

  const host = article.parentElement;
  if (!host) return null;

  const hostStyle = window.getComputedStyle(host);
  if (hostStyle.position === "static") {
    host.style.position = "relative";
  }

  const overlay = document.createElement("div");
  overlay.dataset.readerHighlightOverlay = "true";

  applyStyles(overlay, {
    position: "absolute",
    inset: "0",
    pointerEvents: "none",
    zIndex: "2",
  });

  host.appendChild(overlay);
  overlayRef.current = overlay;

  return overlay;
}

function selectRange(range: Range): void {
  const selection = window.getSelection();
  if (!selection) return;

  selection.removeAllRanges();
  selection.addRange(range);
}

function dispatchAnnotationClicked(annotationId: string, kind: PaintKind): void {
  document.dispatchEvent(
    new CustomEvent("reader:annotation-clicked", {
      detail: {
        annotationId,
        kind,
      },
    }),
  );
}

function paintOverlayRects(params: {
  article: HTMLElement;
  overlay: HTMLDivElement;
  buckets: Map<string, Bucket>;
  supportsCustomHighlight: boolean;
}): void {
  const { overlay, buckets, supportsCustomHighlight } = params;
  const overlayEl = overlay as HighlightOverlayElement;

  if (overlayEl._delegatedClickHandler) {
    overlay.removeEventListener("click", overlayEl._delegatedClickHandler);
    overlayEl._delegatedClickHandler = undefined;
  }

  overlay.replaceChildren();

  const baseRect = overlay.getBoundingClientRect();
  const fragment = document.createDocumentFragment();

  const hitMap = new Map<
    string,
    {
      annotationId: string;
      kind: PaintKind;
      range: Range;
    }
  >();

  let hitIndex = 0;

  for (const bucket of buckets.values()) {
    for (const item of bucket.ranges) {
      const range = item.range.cloneRange();
      const rects = Array.from(range.getClientRects()).filter(
        (rect) => rect.width > 0 && rect.height > 0,
      );

      for (const rect of rects) {
        const hitId = `${item.id}::${hitIndex++}`;
        const button = document.createElement("button");

        button.type = "button";
        button.dataset.readerAnnotationHit = item.id;
        button.dataset.readerAnnotationHitId = hitId;

        button.setAttribute(
          "aria-label",
          bucket.kind === "underline" ? "Edit underline" : "Edit highlight",
        );

        applyStyles(button, {
          position: "absolute",
          left: `${rect.left - baseRect.left}px`,
          top: `${rect.top - baseRect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          padding: "0",
          margin: "0",
          border: "none",
          borderRadius: "0.125rem",
          cursor: "pointer",
          pointerEvents: "auto",
          background: "transparent",
          touchAction: "manipulation",
          outline: "none",
          WebkitTapHighlightColor: "transparent",
        });

        if (!supportsCustomHighlight) {
          if (bucket.kind === "underline") {
            button.style.borderBottom = `2px solid ${bucket.color ?? "#FFEB3B"}`;
            button.style.opacity = "0.75";
          } else {
            button.style.backgroundColor = bucket.color ?? "#FFEB3B";
            button.style.opacity = "0.72";
          }
        }

        hitMap.set(hitId, {
          annotationId: item.id,
          kind: bucket.kind,
          range,
        });

        fragment.appendChild(button);
      }
    }
  }

  overlay.appendChild(fragment);

  const handleClick: EventListener = (event) => {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      "[data-reader-annotation-hit-id]",
    );

    if (!target) return;

    const hitId = target.dataset.readerAnnotationHitId;
    if (!hitId) return;

    const meta = hitMap.get(hitId);
    if (!meta) return;

    event.stopPropagation();

    selectRange(meta.range.cloneRange());
    dispatchAnnotationClicked(meta.annotationId, meta.kind);
  };

  overlayEl._delegatedClickHandler = handleClick;
  overlay.addEventListener("click", handleClick);
}

function dispatchPaintStats(params: {
  painted: number;
  viaOffsets: number;
  viaQuote: number;
  missed: number;
  fallback: boolean;
}): void {
  document.dispatchEvent(
    new CustomEvent("reader:highlights-painted", {
      detail: params,
    }),
  );
}

export function ReaderHighlightLayer({
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

    const registry = getCssHighlightRegistry();
    const supportsCustomHighlight = !!registry;

    if (supportsCustomHighlight) {
      ensureHighlightStyles();
    }

    const rangeCache: RangeCache = new Map();

    let frame = 0;
    let disposed = false;
    let articleVisible = true;

    const repaint = () => {
      if (disposed) return;

      if (!articleVisible) {
        return;
      }

      const { buckets, painted, viaOffsets, viaQuote, missed } = buildBuckets(
        article,
        annotations,
        visible,
        rangeCache,
      );

      if (registry) {
        paintCssHighlights(registry, buckets);
      }

      const overlay = ensureOverlay(article, overlayRef);

      if (overlay) {
        paintOverlayRects({
          article,
          overlay,
          buckets,
          supportsCustomHighlight,
        });
      }

      dispatchPaintStats({
        painted,
        viaOffsets,
        viaQuote,
        missed,
        fallback: !supportsCustomHighlight,
      });
    };

    const scheduleRepaint = () => {
      if (disposed) return;

      if (frame) {
        cancelAnimationFrame(frame);
      }

      frame = requestAnimationFrame(repaint);
    };

    scheduleRepaint();

    const resizeObserver = new ResizeObserver(scheduleRepaint);
    resizeObserver.observe(article);

    const mutationObserver = new MutationObserver(() => {
      rangeCache.clear();
      scheduleRepaint();
    });

    mutationObserver.observe(article, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    let intersectionObserver: IntersectionObserver | null = null;

    if ("IntersectionObserver" in window) {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          const entry = entries[entries.length - 1];
          if (!entry) return;

          articleVisible = entry.isIntersecting;

          if (articleVisible) {
            scheduleRepaint();
          }
        },
        {
          threshold: 0,
        },
      );

      intersectionObserver.observe(article);
    }

    const stage = scrollRef.current;

    stage?.addEventListener("scroll", scheduleRepaint, {
      passive: true,
    });

    window.addEventListener("resize", scheduleRepaint, {
      passive: true,
    });

    return () => {
      disposed = true;

      if (frame) {
        cancelAnimationFrame(frame);
      }

      resizeObserver.disconnect();
      mutationObserver.disconnect();
      intersectionObserver?.disconnect();

      stage?.removeEventListener("scroll", scheduleRepaint);
      window.removeEventListener("resize", scheduleRepaint);

      if (registry) {
        clearOurBuckets(registry);
      }

      const overlay = overlayRef.current as HighlightOverlayElement | null;

      if (overlay?._delegatedClickHandler) {
        overlay.removeEventListener("click", overlay._delegatedClickHandler);
        overlay._delegatedClickHandler = undefined;
      }

      if (overlay?.parentElement) {
        overlay.parentElement.removeChild(overlay);
      }

      overlayRef.current = null;
    };
  }, [annotations, contentSelector, scrollRef, visible]);

  return null;
}