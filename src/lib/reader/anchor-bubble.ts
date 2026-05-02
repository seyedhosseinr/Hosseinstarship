/**
 * Reader anchor / inline source bubble — shared types and utilities.
 *
 * The Reader already renders every NOTE frame with `id={frame.id}` (see
 * FrameCardV2). That id is the canonical anchor used by every cross-link
 * (MCQ → note, flashcard → note, yield → note, annotation → note). This
 * module is the central place where those jumps coordinate scroll +
 * highlight + the contextual bubble.
 */

export type ReaderReferenceKind =
  | "mcq"
  | "flashcard"
  | "yield"
  | "annotation"
  | "note-link";

export interface ReaderAnchorJumpOptions {
  kind: ReaderReferenceKind;
  /** Persian label override; defaults to DEFAULT_REFERENCE_LABEL[kind]. */
  label?: string;
  /** Short context snippet shown beneath the label. */
  snippet?: string;
  /** Free-form id of the originating row (questionId, flashcardId, etc). */
  sourceId?: string;
}

export const DEFAULT_REFERENCE_LABEL: Record<ReaderReferenceKind, string> = {
  mcq: "منبع این سؤال",
  flashcard: "منبع این فلش‌کارت",
  yield: "نکته High-yield",
  annotation: "یادداشت متصل به این بخش",
  "note-link": "بخش مرتبط",
};

/** English short tag shown in the chip eyebrow (always LTR). */
export const REFERENCE_TAG: Record<ReaderReferenceKind, string> = {
  mcq: "MCQ source",
  flashcard: "Flashcard",
  yield: "Yield",
  annotation: "Annotation",
  "note-link": "Linked",
};

const HIGHLIGHT_CLASS = "reader-anchor-flash";
const HIGHLIGHT_DURATION_MS = 1600;
const ANCHOR_ID_RE = /^[A-Za-z0-9_:.\-؀-ۿ]+$/u;

/**
 * Conservative validator. We only ever use `getElementById`, but a stray
 * empty / control character could still cause downstream surprises (e.g.
 * being concatenated into a `location.hash`). Rejecting anything that
 * isn't a printable id keeps the surface tight.
 */
export function isSafeAnchorId(value: string | null | undefined): value is string {
  if (!value) return false;
  if (value.length === 0 || value.length > 256) return false;
  return ANCHOR_ID_RE.test(value);
}

/**
 * Wait for an element with the given id to appear in the DOM. Useful when
 * the Reader is hydrating or a segment renders lazily; we retry on rAF for
 * up to ~1s before giving up. Resolves to null if never found.
 */
export function waitForAnchor(
  anchorId: string,
  timeoutMs = 1000,
): Promise<HTMLElement | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  if (!isSafeAnchorId(anchorId)) return Promise.resolve(null);
  const immediate = document.getElementById(anchorId);
  if (immediate) return Promise.resolve(immediate);

  return new Promise((resolve) => {
    const start = performance.now();
    const tick = () => {
      const found = document.getElementById(anchorId);
      if (found) return resolve(found);
      if (performance.now() - start > timeoutMs) return resolve(null);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Apply a temporary highlight ring to a target block. The class is removed
 * after the animation finishes so re-triggering on the same block restarts
 * the animation cleanly. With reduced-motion, the class is still applied
 * briefly (CSS shortens the animation) so the user still gets a visual
 * confirmation.
 */
export function flashAnchor(el: HTMLElement) {
  el.classList.remove(HIGHLIGHT_CLASS);
  // Force reflow so the animation restarts when re-applied to the same node.
  void el.offsetWidth;
  el.classList.add(HIGHLIGHT_CLASS);
  window.setTimeout(() => {
    el.classList.remove(HIGHLIGHT_CLASS);
  }, HIGHLIGHT_DURATION_MS);
}

interface ScrollOptions extends ReaderAnchorJumpOptions {
  /** When true (default), write `location.hash = anchorId` (replaceState). */
  updateHash?: boolean;
  /** Hook called once the element has been located. */
  onResolved?: (el: HTMLElement, opts: ReaderAnchorJumpOptions) => void;
}

/**
 * Smoothly scroll to a NOTE block, flash it, optionally update the hash, and
 * notify the AnchorProvider so the inline bubble can render. Safe to call
 * even if the target hasn't mounted yet — it polls briefly via rAF.
 */
export async function scrollToReaderAnchor(
  anchorId: string,
  options: ScrollOptions,
): Promise<boolean> {
  if (!isSafeAnchorId(anchorId)) return false;
  const el = await waitForAnchor(anchorId);
  if (!el) return false;

  const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
  el.scrollIntoView({ behavior, block: "center" });
  flashAnchor(el);

  if (options.updateHash !== false && typeof window !== "undefined") {
    try {
      const url = new URL(window.location.href);
      url.hash = anchorId;
      window.history.replaceState(null, "", url);
    } catch {
      /* malformed URL — ignore */
    }
  }

  options.onResolved?.(el, options);
  return true;
}

/**
 * Read the current URL hash and return a normalized anchor id, or null.
 * Strips the leading `#` and decodes percent-encoded RTL/Persian characters.
 * Also rejects anything that fails the safe-id check.
 */
export function readAnchorFromHash(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return null;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    /* malformed; fall through with raw */
  }
  return isSafeAnchorId(decoded) ? decoded : null;
}

/**
 * Parse `?frame=<id>&ref=<kind>` from a URLSearchParams-like value. Used
 * by the Reader shells so flashcard / MCQ links can pre-bake the bubble
 * kind. Returns null if `frame` is missing or unsafe.
 */
export function parseFrameSearchParams(
  params: URLSearchParams | null | undefined,
): { anchorId: string; kind: ReaderReferenceKind } | null {
  if (!params) return null;
  const frame = params.get("frame");
  if (!isSafeAnchorId(frame)) return null;
  const refRaw = params.get("ref");
  const kind = isReferenceKind(refRaw) ? refRaw : "note-link";
  return { anchorId: frame, kind };
}

function isReferenceKind(value: string | null): value is ReaderReferenceKind {
  return (
    value === "mcq" ||
    value === "flashcard" ||
    value === "yield" ||
    value === "annotation" ||
    value === "note-link"
  );
}

/**
 * Build the canonical reader href for a source-link from a flashcard or MCQ.
 *
 * Priority:
 *  1. If `chapterNo` is present → Library Chapter Reader:
 *       `/library/campbell/chapter/<chapterNo>?frame=<frameId>&ref=<kind>`
 *  2. Else if `docId` is present → Note page (legacy / segment reader):
 *       `/notes/<docId>?frame=<frameId>&ref=<kind>`
 *  3. Else → null (caller should hide the link).
 *
 * `frameId` and `kind` are optional — omitted from the URL when absent.
 */
export function buildReaderSourceHref(opts: {
  chapterNo: number | null | undefined;
  docId: string | null | undefined;
  frameId: string | null | undefined;
  kind: ReaderReferenceKind;
}): string | null {
  const { chapterNo, docId, frameId, kind } = opts;
  const framePart = frameId ? `?frame=${encodeURIComponent(frameId)}&ref=${kind}` : "";

  if (chapterNo != null) {
    return `/library/campbell/chapter/${chapterNo}${framePart}`;
  }
  if (docId) {
    return `/notes/${docId}${framePart}`;
  }
  return null;
}
