/**
 * Anchor resolver — converts stored character offsets into a live DOM Range.
 *
 * The reader stores annotations with character offsets measured against the
 * canonical anchor surface inside a frame (the element with
 * `data-anchor-surface="canonical"`, set up in FrameCardV2). On render we
 * walk the surface's text nodes in document order, count UTF-16 code units,
 * and build a `Range` covering the requested span.
 *
 * Anchoring is intentionally text-based and offset-based — never DOM
 * position-based. Inline tags (<strong>, <em>, <code>, etc.) and bidi
 * boundaries don't affect the result because text nodes are iterated in
 * document order and only their `textContent.length` matters.
 *
 * Returns `null` (never throws) when:
 *   - frameElement is missing
 *   - start < 0 or end < start
 *   - end exceeds the canonical surface text length (stale anchor)
 *   - the surface contains no text nodes
 */

export interface ResolveOptions {
  /**
   * Override the canonical-surface query. Defaults to the historical
   * `[data-anchor-surface='canonical']` selector. Falls back to the
   * frame element itself if the selector finds nothing — this keeps us
   * compatible with frames that haven't been migrated yet.
   */
  surfaceSelector?: string;
}

const DEFAULT_SURFACE_SELECTOR = "[data-anchor-surface='canonical']";

export function findAnchorSurface(
  frameElement: HTMLElement | null,
  opts: ResolveOptions = {},
): HTMLElement | null {
  if (!frameElement) return null;
  const sel = opts.surfaceSelector ?? DEFAULT_SURFACE_SELECTOR;
  return frameElement.querySelector<HTMLElement>(sel) ?? frameElement;
}

export function resolveAnchorRange(
  frameElement: HTMLElement | null,
  start: number,
  end: number,
  opts: ResolveOptions = {},
): Range | null {
  const surface = findAnchorSurface(frameElement, opts);
  if (!surface) return null;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || end < start) return null;

  const surfaceLen = (surface.textContent ?? "").length;
  if (end > surfaceLen) return null;

  // Special case: empty surface and a (0,0) anchor — collapsed range at the
  // surface root. Useful for pinning a marker even when there's no text.
  if (surfaceLen === 0) {
    if (start !== 0 || end !== 0) return null;
    try {
      const range = document.createRange();
      range.setStart(surface, 0);
      range.setEnd(surface, 0);
      return range;
    } catch {
      return null;
    }
  }

  const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT);
  let acc = 0;
  let startNode: Node | null = null;
  let startOff = 0;
  let endNode: Node | null = null;
  let endOff = 0;
  let lastNode: Node | null = null;
  let lastNodeLen = 0;

  let node: Node | null;
  while ((node = walker.nextNode())) {
    const len = node.textContent?.length ?? 0;
    const nodeEnd = acc + len;

    if (startNode === null && start <= nodeEnd) {
      startNode = node;
      startOff = Math.max(0, start - acc);
    }
    if (end <= nodeEnd) {
      endNode = node;
      endOff = Math.max(0, end - acc);
      break;
    }
    acc = nodeEnd;
    lastNode = node;
    lastNodeLen = len;
  }

  // Edge: end exactly at surfaceLen and walker terminated without setting
  // endNode (the offset matches the trailing boundary of the last text
  // node). Pin to that node's end.
  if (!endNode && lastNode && end === acc) {
    endNode = lastNode;
    endOff = lastNodeLen;
  }

  // Edge: start at exact end of content (start === surfaceLen). Pin to
  // last node end, collapsed.
  if (!startNode && lastNode && start === acc + lastNodeLen) {
    startNode = lastNode;
    startOff = lastNodeLen;
  }

  if (!startNode || !endNode) return null;

  try {
    const range = document.createRange();
    range.setStart(startNode, startOff);
    range.setEnd(endNode, endOff);
    return range;
  } catch {
    return null;
  }
}

/**
 * Convenience: resolve from a known docId scope and frameId. Used by the
 * highlight layer when iterating many annotations.
 */
export function resolveAnchorRangeByFrameId(
  scope: ParentNode,
  frameId: string,
  start: number,
  end: number,
  opts: ResolveOptions = {},
): Range | null {
  const escaped =
    typeof CSS !== "undefined" && "escape" in CSS
      ? CSS.escape(frameId)
      : frameId.replace(/"/g, '\\"');
  const frame = scope.querySelector<HTMLElement>(`[data-frame-id="${escaped}"]`);
  if (!frame) return null;
  return resolveAnchorRange(frame, start, end, opts);
}
