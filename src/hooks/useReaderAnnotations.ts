"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { isLocalFirstEnabled } from "@/lib/local-first/flag";
import {
  createAnnotation as lfCreate,
  deleteAnnotation as lfDelete,
  listAnnotationsForDoc as lfList,
  migrateAnnotationsFromLocalStorage,
} from "@/lib/local-first/annotations";
import { captureAnchor } from "@/lib/local-first/anchoring";
import type { AnnotationRow } from "@/lib/local-first/idb";

export type ReaderAnnotationType = "highlight" | "underline" | "comment";

/**
 * Selection payload emitted by SelectionPopup.
 *
 * blockText + start + end are populated when the selection landed inside an
 * element that carries [data-frame-id]. They are REQUIRED to capture a real
 * text-position anchor (prefix/suffix/offsets/blockChecksum). When absent
 * (e.g. cross-frame selection), the annotation falls back to a quote-only
 * anchor and re-anchoring relies on the unique-textQuote step.
 */
export type ReaderSelectionPayload = {
  text: string;
  frameId: string | null;
  sectionId: string | null;
  blockText?: string;
  start?: number;
  end?: number;
  /**
   * v8.2: optional persisted contentHash of the frame (from FrameViewModel).
   * When supplied, captureAnchor stores it on the anchor and `reanchor` can
   * take a fast path on subsequent renders. Safe to omit — legacy behavior.
   */
  contentHash?: string;
};

export type ReaderAnnotation = {
  id: string;
  docId: string;
  chapterNo: number;
  frameId: string | null;
  sectionId: string | null;
  quote: string;
  type: ReaderAnnotationType;
  color?: string | null;
  comment: string | null;
  createdAt: string;
  /**
   * Character offsets within the frame's canonical anchor surface
   * (`[data-anchor-surface="canonical"]`). Populated when the selection
   * carried blockText + start + end at capture time. Used by the
   * highlight layer to resolve a live DOM Range without quote-search.
   * Absent on legacy localStorage rows that pre-date the anchor capture
   * pass — those rows fall back to quote-based resolution at render time.
   */
  blockOffsetStart?: number;
  blockOffsetEnd?: number;
};

type AddReaderAnnotationInput = {
  selection: ReaderSelectionPayload;
  type: ReaderAnnotationType;
  color?: string | null;
  comment?: string | null;
};

/* ── Legacy (localStorage) path ────────────────────────────── */

function buildStorageKey(docId: string) {
  return `reader-annotations:${docId}`;
}

function safeParseAnnotations(value: string | null): ReaderAnnotation[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => migrateAnnotation(row))
      .filter((row): row is ReaderAnnotation => row !== null);
  } catch {
    return [];
  }
}

const KIND_VALUES: ReadonlySet<ReaderAnnotationType> = new Set([
  "highlight",
  "underline",
  "comment",
]);

function isString(v: unknown): v is string {
  return typeof v === "string";
}

/**
 * Pure migration: best-effort coerce an unknown JSON shape (legacy
 * localStorage row, partial Dexie row, hand-edited backup) into a
 * canonical `ReaderAnnotation`.
 *
 * Rules:
 *   - `kind` (or legacy `type`) defaults to "highlight" when missing or
 *     unrecognised. The default is read-time only — the next save through
 *     `addAnnotation` writes the explicit kind back to storage.
 *   - `quote` is required; rows without it return null (caller filters).
 *   - Numeric/string fields are coerced; missing strings become "".
 *   - Unknown fields are dropped.
 *
 * Returns `null` for shapes that cannot be reasonably interpreted (no
 * id, no quote/textQuote). Callers MUST filter nulls.
 */
export function migrateAnnotation(input: unknown): ReaderAnnotation | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;

  const id = isString(r.id) && r.id.length > 0 ? r.id : null;
  const quoteSource = isString(r.quote)
    ? r.quote
    : isString(r.textQuote)
      ? r.textQuote
      : null;
  if (!id || !quoteSource) return null;

  // `type` is the historical field name on legacy + ReaderAnnotation rows;
  // `kind` is the Dexie row name. Accept either.
  const rawKind =
    (isString(r.type) && r.type) || (isString(r.kind) && r.kind) || "";
  const type: ReaderAnnotationType = KIND_VALUES.has(
    rawKind as ReaderAnnotationType,
  )
    ? (rawKind as ReaderAnnotationType)
    : "highlight";

  const docId = isString(r.docId) ? r.docId : "";
  const chapterNo = typeof r.chapterNo === "number" ? r.chapterNo : 0;
  const frameId = isString(r.frameId)
    ? r.frameId
    : isString(r.sourceBlockId) && r.sourceBlockId.length > 0
      ? r.sourceBlockId
      : null;
  const sectionId = isString(r.sectionId) ? r.sectionId : null;
  const color = isString(r.color) ? r.color : null;
  const comment = isString(r.comment) ? r.comment : null;
  const createdAt = isString(r.createdAt)
    ? r.createdAt
    : isString(r.localCreatedAt)
      ? r.localCreatedAt
      : new Date(0).toISOString();

  return {
    id,
    docId,
    chapterNo,
    frameId,
    sectionId,
    quote: quoteSource,
    type,
    color,
    comment,
    createdAt,
  };
}

function createAnnotationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ann_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/* ── Mappers: Dexie AnnotationRow ⇄ ReaderAnnotation ───────── */

function rowToReader(row: AnnotationRow): ReaderAnnotation {
  // Treat (0,0) as "no usable offset" — that's what migration writes for
  // legacy rows. The highlight layer falls back to quote-search for those.
  const hasOffsets =
    typeof row.textPositionStart === "number" &&
    typeof row.textPositionEnd === "number" &&
    row.textPositionEnd > row.textPositionStart;
  return {
    id: row.id,
    docId: row.docId,
    chapterNo: row.chapterNo ?? 0,
    frameId: row.sourceBlockId || null,
    sectionId: null,
    quote: row.textQuote,
    type: row.kind,
    color: row.color,
    comment: row.comment,
    createdAt: row.localCreatedAt,
    ...(hasOffsets
      ? {
          blockOffsetStart: row.textPositionStart,
          blockOffsetEnd: row.textPositionEnd,
        }
      : {}),
  };
}

/* ── Hook ──────────────────────────────────────────────────── */

export function useReaderAnnotations(docId: string, chapterNo: number) {
  const [annotations, setAnnotations] = useState<ReaderAnnotation[]>([]);
  const localFirst = useMemo(() => isLocalFirstEnabled(), []);

  /* ── Initial load ── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    if (localFirst) {
      (async () => {
        try {
          await migrateAnnotationsFromLocalStorage();
          const rows = await lfList(docId);
          if (cancelled) return;
          setAnnotations(
            rows
              .map(rowToReader)
              .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
          );
        } catch {
          // If Dexie is unavailable for any reason, fall back to localStorage
          // to preserve the user's existing highlights.
          if (cancelled) return;
          setAnnotations(
            safeParseAnnotations(window.localStorage.getItem(buildStorageKey(docId))),
          );
        }
      })();
    } else {
      setAnnotations(safeParseAnnotations(window.localStorage.getItem(buildStorageKey(docId))));
    }

    return () => {
      cancelled = true;
    };
  }, [docId, localFirst]);

  /* ── Legacy persistence: keep writing localStorage when flag is OFF. ── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localFirst) return;
    window.localStorage.setItem(buildStorageKey(docId), JSON.stringify(annotations));
  }, [annotations, docId, localFirst]);

  /* ── addAnnotation ── */
  const addAnnotation = useCallback(
    ({ selection, type, color, comment }: AddReaderAnnotationInput) => {
      const quote = selection.text.trim();
      if (!quote) return null;

      if (localFirst) {
        // Optimistic local state update first, then Dexie write.
        const hasOptimisticOffsets =
          typeof selection.start === "number" &&
          typeof selection.end === "number" &&
          selection.end > selection.start;
        const optimistic: ReaderAnnotation = {
          id: createAnnotationId(),
          docId,
          chapterNo,
          frameId: selection.frameId,
          sectionId: selection.sectionId,
          quote,
          type,
          color: color ?? null,
          comment: comment?.trim() ? comment.trim() : null,
          createdAt: new Date().toISOString(),
          ...(hasOptimisticOffsets
            ? {
                blockOffsetStart: selection.start!,
                blockOffsetEnd: selection.end!,
              }
            : {}),
        };
        setAnnotations((cur) => [optimistic, ...cur]);

        // Build the full anchor capture when the selection carries
        // blockText + offsets. This is what lets re-anchor survive edits that
        // move or rewrite surrounding text. Fall back to quote-only when the
        // selection crossed a frame boundary or we couldn't resolve the
        // block root (e.g. selection inside a nested image caption).
        const buildPayload = async (): Promise<Parameters<typeof lfCreate>[0]> => {
          const base = {
            docId,
            chapterNo,
            sourceBlockId: selection.frameId ?? "",
            kind: type,
            color: color ?? null,
            comment: comment?.trim() ? comment.trim() : null,
          };
          if (
            typeof selection.blockText === "string" &&
            typeof selection.start === "number" &&
            typeof selection.end === "number" &&
            selection.end >= selection.start
          ) {
            const capture = await captureAnchor(
              selection.blockText,
              selection.start,
              selection.end,
              { contentHash: selection.contentHash },
            );
            return {
              ...base,
              textQuote: capture.textQuote || quote,
              textPositionStart: capture.textPositionStart,
              textPositionEnd: capture.textPositionEnd,
              prefix: capture.prefix,
              suffix: capture.suffix,
              blockChecksum: capture.blockChecksum,
              // v8.2: stability hint for re-anchor fast path
              contentHash: capture.contentHash,
            };
          }
          return {
            ...base,
            textQuote: quote,
            textPositionStart: 0,
            textPositionEnd: 0,
            prefix: "",
            suffix: "",
            blockChecksum: "",
          };
        };

        void buildPayload().then((payload) => lfCreate(payload)).then((row) => {
          // Replace optimistic id with the Dexie-generated one.
          setAnnotations((cur) => {
            const idx = cur.findIndex((a) => a.id === optimistic.id);
            if (idx < 0) return cur;
            const next = cur.slice();
            next[idx] = rowToReader(row);
            return next;
          });
        }).catch(() => {
          // Roll back on failure — user can retry.
          setAnnotations((cur) => cur.filter((a) => a.id !== optimistic.id));
        });

        return optimistic;
      }

      // Legacy path
      const annotation: ReaderAnnotation = {
        id: createAnnotationId(),
        docId,
        chapterNo,
        frameId: selection.frameId,
        sectionId: selection.sectionId,
        quote,
        type,
        color: color ?? null,
        comment: comment?.trim() ? comment.trim() : null,
        createdAt: new Date().toISOString(),
      };
      setAnnotations((current) => [annotation, ...current]);
      return annotation;
    },
    [chapterNo, docId, localFirst],
  );

  /* ── removeAnnotation ── */
  const removeAnnotation = useCallback(
    (annotationId: string) => {
      setAnnotations((current) => current.filter((a) => a.id !== annotationId));
      if (localFirst) {
        void lfDelete(annotationId).catch(() => {
          /* UI already removed; surface via sync-engine retry */
        });
      }
    },
    [localFirst],
  );

  const annotationCountByFrameId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const annotation of annotations) {
      if (!annotation.frameId) continue;
      counts.set(annotation.frameId, (counts.get(annotation.frameId) ?? 0) + 1);
    }
    return counts;
  }, [annotations]);

  return {
    annotations,
    addAnnotation,
    removeAnnotation,
    annotationCountByFrameId,
  };
}
