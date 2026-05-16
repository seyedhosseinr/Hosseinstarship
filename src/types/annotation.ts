export interface StrokePoint { x: number; y: number; pressure?: number; t?: number }
export type StrokeAnnotationType = "stroke" | "arrow" | "highlight" | "comment" | "delete";
export interface StrokeAnnotationTarget {
  segmentId: string;
  surfaceId?: string;
  nodeId?: string | null;
  kind?: string;
  objectId?: string;
}

export interface StrokeAnnotationMetadata {
  id: string;
  type: "stroke" | "arrow";
  target: StrokeAnnotationTarget;
  color?: string;
  width?: number;
  createdAt?: string;
  updatedAt?: string;
}
export type AnnotationMetadata = StrokeAnnotationMetadata;
