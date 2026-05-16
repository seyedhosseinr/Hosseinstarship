import type { StrokeAnnotationMetadata, StrokePoint, StrokeAnnotationType } from "@/types/annotation";

type Bounds = { nodeId: string; x: number; y: number; width: number; height: number };

interface StrokeEngineOptions {
  segmentId: string;
  surfaceId: string;
  color: string;
  width: number;
  annotationType: StrokeAnnotationType;
  onStrokeCommit: (metadata: StrokeAnnotationMetadata, points: StrokePoint[]) => void;
  onStrokeDelete: (annotationId: string) => void;
  getNodeBounds: () => Bounds[];
  getLoadedStrokes: () => StrokeAnnotationMetadata[];
  isDeleteMode: () => boolean;
}

export class StrokeEngine {
  color: string;
  width: number;
  annotationType: StrokeAnnotationType;
  private canvas: HTMLCanvasElement;
  private options: StrokeEngineOptions;

  constructor(canvas: HTMLCanvasElement, options: StrokeEngineOptions) {
    this.canvas = canvas;
    this.options = options;
    this.color = options.color;
    this.width = options.width;
    this.annotationType = options.annotationType;
    this.syncSize();
  }

  syncSize() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(rect.width));
    this.canvas.height = Math.max(1, Math.round(rect.height));
  }

  loadStoredStrokes(_entries: Array<{ metadata: StrokeAnnotationMetadata; points: StrokePoint[] }>) {
    this.syncSize();
  }

  destroy() {
    this.options.getLoadedStrokes();
  }
}
