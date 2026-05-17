"use client";

import { useEffect, useRef, type RefObject } from "react";

import type { ReaderAnnotation } from "@/hooks/useReaderAnnotations";
import { resolveAnchorRangeByFrameId } from "@/lib/local-first/anchorResolver";
import {
  READER_HIGHLIGHT_COLORS,
  DEFAULT_READER_HIGHLIGHT_COLOR,
} from "@/lib/readerHighlightPalette";

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
  underlineThickness?: number;
  highlightThickness?: number;
  /**
   * Called once at the start of every repaint and on unmount, before any
   * `onAnnotationRangeRegistered` calls. Use this to clear any external
   * `Map<annotationId, Range[]>` registry the caller maintains.
   */
  onAnnotationRangesCleared?: () => void;
  /**
   * Called once per resolved annotation range during a repaint. The supplied
   * `Range` is a fresh clone owned by the caller — the layer will not mutate
   * it after this call. Use it to populate a `Map<annotationId, Range[]>`
   * registry for downstream consumers (e.g. exact H-key deletion).
   */
  onAnnotationRangeRegistered?: (annotationId: string, range: Range) => void;
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
  _visualLayer?: HTMLDivElement;
};

type RangeCache = Map<string, ResolvedRange | null>;

declare const Highlight: {
  new (...ranges: Range[]): object;
};

const HL_PREFIX = "rdr-hl-";
const UL_PREFIX = "rdr-ul-";
const LEGACY_UL_NAME = "rdr-ul";
const STYLE_SHEET_ID = "rdr-highlight-layer-styles";

const HIGHLIGHT_VISUAL_INSET_RATIO = 0.08;
const HIGHLIGHT_VISUAL_MIN_INSET = 0.75;
const HIGHLIGHT_VISUAL_MAX_INSET = 2.5;
const HIGHLIGHT_VISUAL_MIN_HEIGHT = 8;
const HIGHLIGHT_DEFAULT_THICKNESS = 2.5;
const HIGHLIGHT_MAX_LINE_OVERFLOW = 6;

// ---------------------------------------------------------------------------
// Palette — single source of truth: readerHighlightPalette.ts
// ---------------------------------------------------------------------------

interface PaletteEntry {
  storage: string;   // full hex e.g. "#FFE566"
  background: string; // translucent rgba for CSS highlight background
  underline: string;  // solid hex for underline text-decoration
}

const PALETTE_MAP = new Map<string, PaletteEntry>(
  READER_HIGHLIGHT_COLORS.map((c) => [
    c.storage.replace(/^#/, "").toUpperCase(),
    { storage: c.storage, background: c.background, underline: c.underline },
  ]),
);

const DEFAULT_HEX_KEY = DEFAULT_READER_HIGHLIGHT_COLOR.replace(/^#/, "").toUpperCase();

// ---------------------------------------------------------------------------

function applyStyles(element: HTMLElement, styles: Record<string, string>): void {
  Object.assign(element.style, styles);
}

function createCompactHighlightVisual(
  backgroundColor: string,
): HTMLSpanElement {
  const visual = document.createElement("span");

  applyStyles(visual, {
    position: "absolute",
    borderRadius: "0.28em",
    backgroundColor,
    pointerEvents: "none",
  });

  return visual;
}

interface HighlightPaintRect {
  rect: DOMRect;
  top: number;
  height: number;
  baseTop: number;
  baseHeight: number;
}

interface HighlightLineGroup {
  rects: DOMRect[];
  top: number;
  bottom: number;
  center: number;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function computeHighlightVisualHeight(lineHeight: number, thickness: number): number {
  const safeThickness = Number.isFinite(thickness)
    ? Math.max(1, thickness)
    : HIGHLIGHT_DEFAULT_THICKNESS;
  const insetY = clampNumber(
    lineHeight * HIGHLIGHT_VISUAL_INSET_RATIO,
    HIGHLIGHT_VISUAL_MIN_INSET,
    HIGHLIGHT_VISUAL_MAX_INSET,
  );
  const baseHeight = Math.max(HIGHLIGHT_VISUAL_MIN_HEIGHT, lineHeight - insetY * 2);
  const extraHeight = (safeThickness - HIGHLIGHT_DEFAULT_THICKNESS) * 2.2;

  return clampNumber(
    baseHeight + extraHeight,
    HIGHLIGHT_VISUAL_MIN_HEIGHT,
    lineHeight + HIGHLIGHT_MAX_LINE_OVERFLOW,
  );
}

function normalizeHighlightRects(rects: DOMRect[], thickness: number): HighlightPaintRect[] {
  if (rects.length === 0) return [];

  const medianHeight = [...rects]
    .map((rect) => rect.height)
    .sort((a, b) => a - b)[Math.floor(rects.length / 2)];
  const lineTolerance = clampNumber(medianHeight * 0.35, 3, 8);
  const groups: HighlightLineGroup[] = [];

  for (const rect of [...rects].sort((a, b) => a.top - b.top || a.left - b.left)) {
    const center = rect.top + rect.height / 2;
    const group = groups.find((item) => Math.abs(center - item.center) <= lineTolerance);

    if (!group) {
      groups.push({
        rects: [rect],
        top: rect.top,
        bottom: rect.bottom,
        center,
      });
      continue;
    }

    group.rects.push(rect);
    group.top = Math.min(group.top, rect.top);
    group.bottom = Math.max(group.bottom, rect.bottom);
    group.center = (group.top + group.bottom) / 2;
  }

  return groups.flatMap((group) => {
    const lineHeight = Math.max(HIGHLIGHT_VISUAL_MIN_HEIGHT, group.bottom - group.top);
    const height = computeHighlightVisualHeight(lineHeight, thickness);
    const top = group.top + (lineHeight - height) / 2;
    const baseHeight = computeHighlightVisualHeight(lineHeight, HIGHLIGHT_DEFAULT_THICKNESS);
    const baseTop = group.top + (lineHeight - baseHeight) / 2;

    return group.rects.map((rect) => ({
      rect,
      top,
      height,
      baseTop,
      baseHeight,
    }));
  });
}

function getCssHighlightRegistry(): CSSHighlightRegistry | null {
  if (typeof window === "undefined") return null;

  const cssRoot = (window.CSS ?? null) as CSSWithHighlights | null;
  if (!cssRoot?.highlights) return null;
  if (typeof Highlight === "undefined") return null;

  return cssRoot.highlights;
}

function updateHighlightStyles(ulThickness: number): void {
  if (typeof document === "undefined") return;

  let style = document.getElementById(STYLE_SHEET_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_SHEET_ID;
    document.head.appendChild(style);
  }

  const t = `${ulThickness}px`;
  const rules: string[] = [];

  for (const [key, entry] of PALETTE_MAP) {
    rules.push(
      `::highlight(${HL_PREFIX}${key}) { background-color: ${entry.background}; color: inherit; }`,
    );
    rules.push(
      `::highlight(${UL_PREFIX}${key}) { text-decoration-line: underline; text-decoration-style: solid; text-decoration-thickness: ${t}; text-decoration-color: ${entry.underline}; text-underline-offset: 0.3em; text-decoration-skip-ink: none; color: inherit; }`,
    );
  }

  rules.push(
    `::highlight(${LEGACY_UL_NAME}) { text-decoration-line: underline; text-decoration-style: solid; text-decoration-thickness: ${t}; text-underline-offset: 0.3em; text-decoration-skip-ink: none; color: inherit; }`,
  );

  style.textContent = rules.join("\n");
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
  if (!color) return DEFAULT_HEX_KEY;

  const normalized = color.replace(/^#/, "").toUpperCase();
  return PALETTE_MAP.has(normalized) ? normalized : DEFAULT_HEX_KEY;
}

function entryFromHexKey(hex: string): PaletteEntry {
  return (
    PALETTE_MAP.get(hex) ??
    PALETTE_MAP.get(DEFAULT_HEX_KEY) ?? {
      storage: DEFAULT_READER_HIGHLIGHT_COLOR,
      background: READER_HIGHLIGHT_COLORS[0].background,
      underline: READER_HIGHLIGHT_COLORS[0].underline,
    }
  );
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
    const color = ann.color ?? entryFromHexKey(colorKey).storage;

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
    ensureVisualLayer(article, overlayRef.current as HighlightOverlayElement);
    return overlayRef.current;
  }

  const host = article.parentElement;
  if (!host) return null;

  const hostStyle = window.getComputedStyle(host);
  if (hostStyle.position === "static") {
    host.style.position = "relative";
  }

  const articleStyle = window.getComputedStyle(article);
  if (articleStyle.position === "static") {
    article.style.position = "relative";
  }
  if (articleStyle.zIndex === "auto") {
    article.style.zIndex = "1";
  }

  const overlay = document.createElement("div");
  overlay.dataset.readerHighlightOverlay = "true";

  applyStyles(overlay, {
    position: "absolute",
    inset: "0",
    pointerEvents: "none",
    zIndex: "3",
  });

  ensureVisualLayer(article, overlay as HighlightOverlayElement);
  host.appendChild(overlay);
  overlayRef.current = overlay;

  return overlay;
}

function ensureVisualLayer(
  article: HTMLElement,
  overlay: HighlightOverlayElement,
): HTMLDivElement | null {
  const host = article.parentElement;
  if (!host) return null;

  if (overlay._visualLayer?.isConnected) {
    return overlay._visualLayer;
  }

  const existing = host.querySelector<HTMLDivElement>(
    ":scope > [data-reader-highlight-visual-layer='true']",
  );
  if (existing) {
    overlay._visualLayer = existing;
    return existing;
  }

  const visualLayer = document.createElement("div");
  visualLayer.dataset.readerHighlightVisualLayer = "true";

  applyStyles(visualLayer, {
    position: "absolute",
    inset: "0",
    pointerEvents: "none",
    zIndex: "2",
  });

  host.appendChild(visualLayer);
  overlay._visualLayer = visualLayer;

  return visualLayer;
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
  highlightThickness: number;
}): void {
  const { overlay, buckets, supportsCustomHighlight, highlightThickness } = params;
  const overlayEl = overlay as HighlightOverlayElement;

  if (overlayEl._delegatedClickHandler) {
    overlay.removeEventListener("click", overlayEl._delegatedClickHandler);
    overlayEl._delegatedClickHandler = undefined;
  }

  overlay.replaceChildren();
  const visualLayer = overlayEl._visualLayer;
  visualLayer?.replaceChildren();

  const baseRect = overlay.getBoundingClientRect();
  const fragment = document.createDocumentFragment();
  const visualFragment = document.createDocumentFragment();

  const hitMap = new Map<
    string,
    {
      annotationId: string;
      kind: PaintKind;
      range: Range;
    }
  >();

  let hitIndex = 0;
  const pendingRects: Array<{
    annotationId: string;
    kind: PaintKind;
    range: Range;
    rect: DOMRect;
    entry: PaletteEntry;
  }> = [];

  for (const bucket of buckets.values()) {
    // Resolve the palette entry for this bucket's colour key so the
    // fallback overlay uses the correct background / underline value.
    const hexKey = bucket.name
      .replace(HL_PREFIX, "")
      .replace(UL_PREFIX, "");
    const entry = entryFromHexKey(hexKey);

    for (const item of bucket.ranges) {
      const range = item.range.cloneRange();
      const rects = Array.from(range.getClientRects()).filter(
        (rect) => rect.width > 0 && rect.height > 0,
      );

      for (const rect of rects) {
        pendingRects.push({
          annotationId: item.id,
          kind: bucket.kind,
          range,
          rect,
          entry,
        });
      }
    }
  }

  const highlightMetrics = new Map<DOMRect, HighlightPaintRect>();
  normalizeHighlightRects(
    pendingRects
      .filter((item) => item.kind === "highlight")
      .map((item) => item.rect),
    highlightThickness,
  ).forEach((paintRect) => {
    highlightMetrics.set(paintRect.rect, paintRect);
  });

  for (const item of pendingRects) {
    const paintRect =
      item.kind === "highlight"
        ? highlightMetrics.get(item.rect) ?? {
            rect: item.rect,
            top: item.rect.top,
            height: item.rect.height,
            baseTop: item.rect.top,
            baseHeight: item.rect.height,
          }
        : {
            rect: item.rect,
            top: item.rect.top,
            height: item.rect.height,
            baseTop: item.rect.top,
            baseHeight: item.rect.height,
          };
    const { rect } = paintRect;
    const hitId = `${item.annotationId}::${hitIndex++}`;
    const button = document.createElement("button");

    button.type = "button";
    button.dataset.readerAnnotationHit = item.annotationId;
    button.dataset.readerAnnotationHitId = hitId;

    button.setAttribute(
      "aria-label",
      item.kind === "underline" ? "Edit underline" : "Edit highlight",
    );

    applyStyles(button, {
      position: "absolute",
      left: `${rect.left - baseRect.left}px`,
      top: `${paintRect.top - baseRect.top}px`,
      width: `${rect.width}px`,
      height: `${paintRect.height}px`,
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
      overflow: "visible",
    });

    if (item.kind === "highlight" && visualLayer) {
      const visualRects = supportsCustomHighlight
        ? [
            { top: paintRect.top, height: Math.max(0, paintRect.baseTop - paintRect.top) },
            {
              top: paintRect.baseTop + paintRect.baseHeight,
              height: Math.max(
                0,
                paintRect.top + paintRect.height - (paintRect.baseTop + paintRect.baseHeight),
              ),
            },
          ]
        : [{ top: paintRect.top, height: paintRect.height }];

      for (const visualRect of visualRects) {
        if (visualRect.height < 0.5) continue;

        const visual = createCompactHighlightVisual(item.entry.background);
        applyStyles(visual, {
          left: `${rect.left - baseRect.left}px`,
          top: `${visualRect.top - baseRect.top}px`,
          width: `${rect.width}px`,
          height: `${visualRect.height}px`,
        });
        visualFragment.appendChild(visual);
      }
    } else if (item.kind === "underline" && !supportsCustomHighlight) {
      // Position a thin line ~4px below the bottom of the text rect.
      // box-shadow avoids affecting layout and clears the line-height gap.
      button.style.boxShadow = `0 4px 0 -1px ${item.entry.underline}`;
      button.style.opacity = "0.9";
    }

    hitMap.set(hitId, {
      annotationId: item.annotationId,
      kind: item.kind,
      range: item.range,
    });

    fragment.appendChild(button);
  }

  visualLayer?.appendChild(visualFragment);
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
  underlineThickness = 2.5,
  highlightThickness = 2.5,
  onAnnotationRangesCleared,
  onAnnotationRangeRegistered,
}: Props): null {
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Stable refs for the registry callbacks so they don't retrigger the
  // main repaint effect when the parent re-renders with new closures.
  const clearedRef = useRef(onAnnotationRangesCleared);
  const registerRef = useRef(onAnnotationRangeRegistered);
  useEffect(() => {
    clearedRef.current = onAnnotationRangesCleared;
  }, [onAnnotationRangesCleared]);
  useEffect(() => {
    registerRef.current = onAnnotationRangeRegistered;
  }, [onAnnotationRangeRegistered]);

  // Update CSS underline thickness whenever it changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (getCssHighlightRegistry()) updateHighlightStyles(underlineThickness);
  }, [underlineThickness]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const article = document.querySelector<HTMLElement>(contentSelector);
    if (!article) return;

    const registry = getCssHighlightRegistry();
    const supportsCustomHighlight = !!registry;

    if (supportsCustomHighlight) {
      updateHighlightStyles(underlineThickness);
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

      // Reset the external annotation-range registry before populating it
      // with the freshly-resolved ranges for this paint pass. This keeps the
      // registry in lock-step with what is currently on screen so that
      // exact-match consumers (e.g. H-key deletion) never see stale ranges.
      clearedRef.current?.();
      const registerFn = registerRef.current;
      if (registerFn) {
        for (const bucket of buckets.values()) {
          for (const item of bucket.ranges) {
            try {
              registerFn(item.id, item.range.cloneRange());
            } catch {
              // Range may belong to a node that was just detached — skip.
            }
          }
        }
      }

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
          highlightThickness,
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

      // Clear the external annotation-range registry so it cannot leak
      // ranges across chapter/route changes.
      clearedRef.current?.();

      const overlay = overlayRef.current as HighlightOverlayElement | null;
      const visualLayer =
        overlay?._visualLayer ??
        overlay?.parentElement?.querySelector<HTMLDivElement>(
          ":scope > [data-reader-highlight-visual-layer='true']",
        );

      if (overlay?._delegatedClickHandler) {
        overlay.removeEventListener("click", overlay._delegatedClickHandler);
        overlay._delegatedClickHandler = undefined;
      }

      if (visualLayer?.parentElement) {
        visualLayer.parentElement.removeChild(visualLayer);
      }

      if (overlay?.parentElement) {
        overlay.parentElement.removeChild(overlay);
      }

      overlayRef.current = null;
    };
  }, [annotations, contentSelector, scrollRef, visible, underlineThickness, highlightThickness]);

  return null;
}
