export type InkTool = "pen" | "eraser";

export interface InkPoint {
  x: number;
  y: number;
  pressure: number;
  time: number;
  predicted?: boolean;
}

export interface PencilStrokeDetail {
  pointerId: number;
  points: InkPoint[];
  predictedPoints: InkPoint[];
  pressure: number;
  tiltX: number;
  tiltY: number;
  twist: number;
}

export interface ContentMetrics {
  dpr: number;
  viewportWidth: number;
  viewportHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  contentLeft: number;
  contentTop: number;
  contentWidth: number;
  contentHeight: number;
  scrollTop: number;
  scrollLeft: number;
}

export interface InkLayerOptions {
  lineWidth: number;
  minPressureWidth: number;
  maxPressureWidth: number;
  fadeOutMs: number;
}

export interface InkControllerConfig {
  gpuCanvas: HTMLCanvasElement;
  fallbackCanvas: HTMLCanvasElement;
  scrollContainer: HTMLElement | null;
  contentSelector: string;
  isActive: boolean;
  color: string;
  options?: Partial<InkLayerOptions>;
}

export interface InkRenderer {
  readonly kind: "webgpu" | "canvas2d";
  readonly ready: boolean;
  resize(metrics: ContentMetrics): void;
  beginStroke(color: string, lineWidth: number): void;
  appendStroke(stroke: import("./StrokeBuffer").StrokeBuffer, dirtyPointIndex: number): void;
  endStroke(): void;
  clear(): void;
  destroy(): void;
}

export const DEFAULT_INK_OPTIONS: InkLayerOptions = {
  lineWidth: 7,
  minPressureWidth: 0.65,
  maxPressureWidth: 1.35,
  fadeOutMs: 180,
};
