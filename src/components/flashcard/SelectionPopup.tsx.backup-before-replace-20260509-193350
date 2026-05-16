"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Eraser, FileQuestion, Layers, MessageSquarePlus, Send, Underline as UnderlineIcon, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReaderAnnotation, ReaderSelectionPayload } from "@/hooks/useReaderAnnotations";
import { cn } from "@/lib/utils";

const HIGHLIGHT_COLORS = [
  "#DFFF4F", // lime-yellow
  "#B8F36B", // green
  "#98F0FF", // cyan
  "#F7A8D7", // pink
  "#F7BE62", // amber
] as const;

const POPUP_HALF_W = 220;
const LAST_COLOR_KEY = "reader:highlight-color:last";
const NOTE_MAX_CHARS = 2000;
const NOTE_COUNTER_THRESHOLD = 1800;

function getLastColor(): string {
  if (typeof localStorage === "undefined") return HIGHLIGHT_COLORS[0];
  return localStorage.getItem(LAST_COLOR_KEY) ?? HIGHLIGHT_COLORS[0];
}

function saveLastColor(color: string) {
  try { localStorage.setItem(LAST_COLOR_KEY, color); } catch {}
}

/**
 * Walk text nodes inside `root` up to `(container, offset)` and return the
 * linear offset within `root.textContent`. This is the inverse of asking the
 * browser where a given character in the rendered text lives — we compute
 * the character index that the range endpoint corresponds to.
 *
 * Returns -1 when the container is not inside root (shouldn't happen when
 * the selection is clamped to [data-frame-id]).
 */
function textOffsetWithin(root: Node, container: Node, offset: number): number {
  // If container is an element (e.g. selection spans child boundaries), the
  // offset points to a child index; translate by summing textContent of
  // earlier siblings.
  if (container.nodeType === Node.ELEMENT_NODE) {
    const el = container as Element;
    let sum = 0;
    for (let i = 0; i < offset && i < el.childNodes.length; i++) {
      sum += (el.childNodes[i].textContent ?? "").length;
    }
    // Now sum the offset of `container` itself within `root`.
    return sum + textOffsetOfNodeStart(root, container);
  }
  // Text node — walk.
  return textOffsetOfNodeStart(root, container) + offset;
}

function textOffsetOfNodeStart(root: Node, target: Node): number {
  if (target === root) return 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let acc = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node === target) return acc;
    // If `target` is an ancestor of a text node we already passed, we would
    // never hit equality; guard with contains().
    if (node.parentNode && target.contains(node)) return acc;
    acc += (node.textContent ?? "").length;
  }
  return acc;
}

export function findUniqueQuoteOffsets(blockText: string, quote: string) {
  const needle = quote.trim();
  if (!needle) return null;

  const first = blockText.indexOf(needle);
  if (first === -1) return null;

  const second = blockText.indexOf(needle, first + needle.length);
  if (second !== -1) return null;

  return { start: first, end: first + needle.length };
}

export type CanonicalSelectionResolution = {
  blockText?: string;
  start?: number;
  end?: number;
  contentHash?: string;
  resolution:
    | "canonical-range"
    | "quote-only-rich-pane"
    | "rich-pane-unique-quote"
    | "ambiguous-rich-pane"
    | "missing-canonical-surface";
};

export function resolveSelectionAgainstCanonicalSurface(
  frameElement: HTMLElement | null,
  range: Range | null,
  text: string,
): CanonicalSelectionResolution {
  const canonicalElement =
    frameElement?.querySelector<HTMLElement>("[data-anchor-surface='canonical']") ?? null;
  const contentHash =
    canonicalElement?.dataset.contentHash ??
    frameElement?.dataset.contentHash ??
    undefined;

  if (!canonicalElement || !range) {
    return {
      contentHash,
      resolution: "missing-canonical-surface",
    };
  }

  const canonicalRoot: Node = canonicalElement;
  const selectionInsideCanonical =
    canonicalRoot.contains(range.startContainer) &&
    canonicalRoot.contains(range.endContainer);

  if (selectionInsideCanonical) {
    const full = canonicalRoot.textContent ?? "";
    const start = textOffsetWithin(canonicalRoot, range.startContainer, range.startOffset);
    const end = textOffsetWithin(canonicalRoot, range.endContainer, range.endOffset);
    if (start >= 0 && end >= 0 && end >= start && end <= full.length) {
      return {
        blockText: full,
        start,
        end,
        contentHash,
        resolution: "canonical-range",
      };
    }
  }

  // Selection happened outside the canonical prose surface (for example inside
  // a rendered table cell, clinical pearl, trap/keypoint callout, or margin
  // note). Do NOT translate it to offsets in the hidden/compact canonical
  // prose: that makes the saved annotation paint on the wrong surface. Store a
  // quote-only anchor and let ReaderHighlightLayer re-resolve it against the
  // visible rich surfaces first.
  return {
    contentHash,
    resolution: "quote-only-rich-pane",
  };
}

interface SelectionPopupProps {
  allowCardCreation?: boolean;
  annotations?: ReaderAnnotation[];
  onCreateCard: (payload: ReaderSelectionPayload) => void;
  onCreateCloze: (payload: ReaderSelectionPayload) => void;
  onHighlight: (payload: ReaderSelectionPayload, color: string) => void;
  onRemoveHighlight: (annotationIds: string[]) => void;
  onUnderline: (payload: ReaderSelectionPayload) => void;
  /** commentText is provided by the popup's inline textarea — no window.prompt needed */
  onComment: (payload: ReaderSelectionPayload, commentText: string) => void;
  /** When true, text drag-selections auto-create a highlight without popup interaction. */
  autoHighlight?: boolean;
  onToggleAutoHighlight?: () => void;
}

export function SelectionPopup({
  allowCardCreation = true,
  annotations = [],
  onCreateCard,
  onCreateCloze,
  onHighlight,
  onRemoveHighlight,
  onUnderline,
  onComment,
  autoHighlight = false,
  onToggleAutoHighlight,
}: SelectionPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [isVisible, setIsVisible] = useState(false);
  const [commentMode, setCommentMode] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [activeColor, setActiveColor] = useState<string>(() => getLastColor());
  const [selectionPayload, setSelectionPayload] = useState<ReaderSelectionPayload>({
    text: "",
    frameId: null,
    sectionId: null,
  });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  // When the popup was triggered by a click on a painted annotation
  // (highlight/underline hit overlay or note marker), this holds the
  // clicked annotation's id so save/delete operate on that specific
  // row instead of the broader overlap set.
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);

  // Reset comment mode when popup closes
  useEffect(() => {
    if (!isVisible) {
      setCommentMode(false);
      setCommentText("");
      setEditingAnnotationId(null);
    }
  }, [isVisible]);

  // Focus textarea when entering comment mode
  useEffect(() => {
    if (commentMode) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [commentMode]);

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? "";
      if (!text || text.length < 3 || text.length > 2000) {
        setIsVisible(false);
        return;
      }

      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      const rect = range?.getBoundingClientRect();
      if (!rect) {
        setIsVisible(false);
        return;
      }

      const anchorElement =
        range?.commonAncestorContainer instanceof Element
          ? range.commonAncestorContainer
          : range?.commonAncestorContainer.parentElement;

      if (!anchorElement?.closest("[data-reader-content]")) {
        setIsVisible(false);
        return;
      }

      const frameElement = anchorElement?.closest<HTMLElement>("[data-frame-id]");
      const sectionElement = anchorElement?.closest<HTMLElement>("[data-section-id]");

      // Compute text offsets within the frame element so the annotation
      // layer can capture a real text-position anchor (prefix/suffix/
      // blockChecksum). We do this here, not in the hook, because we need
      // the live DOM Range — by the time the hook's callback fires the
      // selection has already collapsed.
      const resolved = resolveSelectionAgainstCanonicalSurface(frameElement ?? null, range, text);

      setSelectionPayload({
        text,
        frameId: frameElement?.dataset.frameId ?? null,
        sectionId: sectionElement?.dataset.sectionId ?? null,
        blockText: resolved.blockText,
        start: resolved.start,
        end: resolved.end,
        contentHash: resolved.contentHash,
      });

      const clampedX = Math.max(
        POPUP_HALF_W,
        Math.min(window.innerWidth - POPUP_HALF_W, rect.left + rect.width / 2),
      );

      setPosition({ x: clampedX, y: rect.top - 10 });
      setIsVisible(true);
    };

    // Trigger comes from useReaderSelectionWatcher via custom DOM events.
    // The settled event fires when a non-collapsed selection inside reader
    // content has stabilised; the cleared event fires when the selection
    // collapses or moves out of scope. The watcher absorbs the input-source
    // (mouse / pen / touch / keyboard / programmatic) so this component no
    // longer needs per-gesture listeners.
    const onSettled = () => handleSelectionChange();
    const onCleared = () => setIsVisible(false);

    // Click-to-edit: ReaderHighlightLayer / NoteMarkerLayer dispatch when
    // user clicks a painted annotation. We mark editingAnnotationId so
    // the eraser/save buttons act on that specific row.
    const onAnnotationClicked = (e: Event) => {
      const detail = (e as CustomEvent<{ annotationId: string }>).detail;
      if (detail?.annotationId) setEditingAnnotationId(detail.annotationId);
    };
    const onEditNote = (e: Event) => {
      const detail = (e as CustomEvent<{ annotationId: string; comment: string }>).detail;
      if (!detail?.annotationId) return;
      setEditingAnnotationId(detail.annotationId);
      setCommentText(detail.comment ?? "");
      setCommentMode(true);
    };

    const handleOutsideClick = (e: PointerEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        // Don't close on a pointerdown that lands inside content — the watcher
        // will reopen us with the new selection (or fire cleared if the
        // gesture collapses the selection). This prevents a flash-close
        // followed by flash-open on extend-selection clicks.
        const target = e.target as Element | null;
        if (target?.closest("[data-reader-content]")) return;
        setIsVisible(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsVisible(false);
      // Submit comment with Ctrl/Cmd+Enter
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && commentMode) {
        e.preventDefault();
        submitComment();
      }
    };

    document.addEventListener("reader:selection-settled", onSettled);
    document.addEventListener("reader:selection-cleared", onCleared);
    document.addEventListener("reader:annotation-clicked", onAnnotationClicked);
    document.addEventListener("reader:edit-note", onEditNote);
    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("reader:selection-settled", onSettled);
      document.removeEventListener("reader:selection-cleared", onCleared);
      document.removeEventListener("reader:annotation-clicked", onAnnotationClicked);
      document.removeEventListener("reader:edit-note", onEditNote);
      document.removeEventListener("pointerdown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentMode, commentText]);

  const overlappingHighlightIds = useMemo(() => {
    if (!selectionPayload.frameId || !selectionPayload.text) return [];
    const selLower = selectionPayload.text.toLowerCase();
    return annotations
      .filter(
        (ann) =>
          ann.type === "highlight" &&
          ann.frameId === selectionPayload.frameId &&
          (selLower.includes(ann.quote.toLowerCase()) ||
            ann.quote.toLowerCase().includes(selLower)),
      )
      .map((ann) => ann.id);
  }, [annotations, selectionPayload]);

  function submitComment() {
    const text = commentText.trim();
    if (!text) return;
    // Editing an existing note: delete the old row, then create a new one
    // at the same selection. Same-tick: parent state coalesces both calls.
    if (editingAnnotationId) {
      onRemoveHighlight([editingAnnotationId]);
    }
    onComment(selectionPayload, text);
    setIsVisible(false);
  }

  function deleteEditingAnnotation() {
    if (!editingAnnotationId) return;
    onRemoveHighlight([editingAnnotationId]);
    setIsVisible(false);
  }

  if (!isVisible) return null;

  return (
    <div
      ref={popupRef}
      className="fixed z-50 rounded-lib-lg border border-lib-border/60 bg-lib-surface/98 shadow-lg backdrop-blur-xl"
      style={{
        left: position.x,
        top: position.y,
        transform: "translate(-50%, -100%)",
        minWidth: commentMode ? "260px" : undefined,
      }}
    >
      {commentMode ? (
        /* ── Note input mode ── */
        <div className="p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-lib-text-secondary">Note</span>
            <button
              type="button"
              onClick={() => setCommentMode(false)}
              className="p-0.5 text-lib-text-muted hover:text-lib-text"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <textarea
            ref={textareaRef}
            value={commentText}
            onChange={(e) => {
              const v = e.target.value;
              // Hard cap mirrors maxLength but covers programmatic insertions
              // (Pencil Scribble pasteboard can occasionally exceed in one shot).
              setCommentText(v.length > NOTE_MAX_CHARS ? v.slice(0, NOTE_MAX_CHARS) : v);
            }}
            placeholder="Type your note… (Shift+Enter for newline)"
            rows={2}
            maxLength={NOTE_MAX_CHARS}
            // dir="auto" lets Persian + English mix render with correct
            // first-strong direction per paragraph.
            dir="auto"
            aria-label="Note text"
            className="w-full resize-none overflow-hidden rounded-lib-sm border border-lib-border bg-lib-hover px-3 py-2 text-sm text-lib-text placeholder:text-lib-text-muted focus:border-lib-accent focus:outline-none focus:ring-1 focus:ring-lib-accent"
            style={{ minHeight: "60px" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitComment();
              }
            }}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[10px] text-lib-text-muted/60">Enter to save · Shift+Enter for newline</span>
            {commentText.length > NOTE_COUNTER_THRESHOLD && (
              <span
                className={cn(
                  "ms-2 font-mono text-[10px] tabular-nums",
                  commentText.length >= NOTE_MAX_CHARS
                    ? "text-lib-danger"
                    : "text-lib-text-muted/70",
                )}
                aria-live="polite"
              >
                {commentText.length}/{NOTE_MAX_CHARS}
              </span>
            )}
            <div className="flex items-center gap-1.5">
              {editingAnnotationId && (
                <button
                  type="button"
                  onClick={deleteEditingAnnotation}
                  title="Delete note"
                  aria-label="Delete note"
                  className="inline-flex items-center gap-1 rounded-lib-sm border border-lib-border/60 px-2.5 py-1.5 text-xs font-medium text-lib-danger transition hover:bg-lib-danger/10"
                >
                  <Eraser className="h-3 w-3" />
                  Delete
                </button>
              )}
              <button
                type="button"
                disabled={!commentText.trim()}
                onClick={submitComment}
                className="inline-flex items-center gap-1.5 rounded-lib-sm bg-lib-accent px-3 py-1.5 text-xs font-medium text-lib-accent-fg transition hover:bg-lib-accent/90 disabled:opacity-40"
              >
                <Send className="h-3 w-3" />
                Save
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ── Main action mode ── */
        <div className="flex items-center gap-0.5 p-1.5">
          {allowCardCreation && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { onCreateCard(selectionPayload); setIsVisible(false); }}
                title="Create flashcard"
                className="h-8 w-8 p-0"
              >
                <Layers className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { onCreateCloze(selectionPayload); setIsVisible(false); }}
                title="Create cloze"
                className="h-8 w-8 p-0"
              >
                <FileQuestion className="h-4 w-4" />
              </Button>
              <div className="mx-0.5 h-5 w-px bg-lib-border" />
            </>
          )}

          {/* Highlight colors — last-used color is remembered across sessions */}
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => {
                if (overlappingHighlightIds.length > 0) onRemoveHighlight(overlappingHighlightIds);
                saveLastColor(color);
                setActiveColor(color);
                onHighlight(selectionPayload, color);
                setIsVisible(false);
              }}
              title={overlappingHighlightIds.length > 0 ? "Recolor" : "Highlight"}
              style={{ backgroundColor: color }}
              className={cn(
                "rounded-full shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-lib-accent/40 focus:ring-offset-1",
                color === activeColor
                  ? "h-7 w-7 border-2 border-lib-text/40 scale-110"
                  : "h-6 w-6 border-2 border-lib-surface hover:scale-110",
              )}
            />
          ))}

          {(editingAnnotationId || overlappingHighlightIds.length > 0) && (
            <>
              <div className="mx-0.5 h-5 w-px bg-lib-border" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // When opened by clicking a painted annotation, scope the
                  // delete to that specific row. Otherwise fall back to the
                  // overlap set (legacy multi-delete behaviour).
                  const ids = editingAnnotationId
                    ? [editingAnnotationId]
                    : overlappingHighlightIds;
                  onRemoveHighlight(ids);
                  setIsVisible(false);
                }}
                title={editingAnnotationId ? "Delete annotation" : "Remove highlight"}
                aria-label={editingAnnotationId ? "Delete annotation" : "Remove highlight"}
                className="h-8 w-8 p-0 text-lib-danger hover:bg-lib-danger/10 hover:text-lib-danger"
              >
                <Eraser className="h-4 w-4" />
              </Button>
            </>
          )}

          <div className="mx-0.5 h-5 w-px bg-lib-border" />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => { onUnderline(selectionPayload); setIsVisible(false); }}
            title="Underline"
            className="h-8 w-8 p-0"
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCommentMode(true)}
            title="Note"
            aria-label="Note"
            className="h-8 w-8 p-0"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
          {onToggleAutoHighlight && (
            <>
              <div className="mx-0.5 h-5 w-px bg-lib-border" />
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleAutoHighlight}
                title={autoHighlight ? "Auto highlight ON — click to turn off" : "Auto highlight OFF — click to turn on"}
                aria-pressed={autoHighlight}
                className={cn(
                  "h-8 w-8 p-0",
                  autoHighlight
                    ? "text-lib-accent bg-lib-accent-soft"
                    : "text-lib-text-muted hover:text-lib-text",
                )}
              >
                <Zap className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(false)}
            title="Close"
            className="h-8 w-8 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
