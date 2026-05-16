/**
 * annotation.ts
 * Shared annotation types for the Outliner feature.
 * Used by annotation-repository.ts, outliner-store.ts, and CRDT layer.
 */

// ── Annotation type aliases ───────────────────────────────────────────────────

export type StrokeAnnotationType = "stroke" | "arrow";

// ── Point types ───────────────────────────────────────────────────────────────

export interface StrokePoint {
  x: number;
  y: number;
  pressure?: number;
  t?: number;
}

// ── Annotation target ─────────────────────────────────────────────────────────

export interface AnnotationTarget {
  segmentId: string;
  kind: "surface" | "node" | "edge";
  surfaceId: string;
  objectId: string;
}

// ── Individual annotation types ───────────────────────────────────────────────

export interface StrokeAnnotationMetadata {
  id: string;
  type: "stroke" | "arrow";
  target: AnnotationTarget;
  color: string;
  width: number;
  snapped: boolean;
  snappedShape: "line" | "arrow" | "enclosure" | null;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  strokeBlobRef: string;
  createdAt: number;
  updatedAt: number;
}

export interface CommentAnnotation {
  id: string;
  type: "comment";
  target: AnnotationTarget;
  body: string;
  resolved: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface BookmarkAnnotation {
  id: string;
  type: "bookmark";
  target: AnnotationTarget;
  createdAt: number;
}

export interface MarkerAnnotation {
  id: string;
  type: "marker" | "highlight";
  target: AnnotationTarget;
  importance: "important" | "resolved";
  createdAt: number;
}

// ── Union ─────────────────────────────────────────────────────────────────────

export type Annotation =
  | StrokeAnnotationMetadata
  | CommentAnnotation
  | BookmarkAnnotation
  | MarkerAnnotation;

// ── Operation discriminated union ─────────────────────────────────────────────

export type AnnotationOp =
  | { op: "addStroke"; payload: StrokeAnnotationMetadata; points: StrokePoint[] }
  | { op: "deleteStroke"; id: string; segmentId: string }
  | { op: "updateStroke"; id: string; patch: { color?: string; width?: number } }
  | { op: "addComment"; payload: CommentAnnotation }
  | { op: "updateComment"; id: string; patch: { body?: string; resolved?: boolean } }
  | { op: "deleteComment"; id: string }
  | { op: "toggleBookmark"; target: AnnotationTarget }
  | { op: "markImportant"; target: AnnotationTarget; importance: "important" | "resolved" }
  | { op: "deleteMarker"; id: string };
