import { toViewportX, toViewportY } from "./metrics";
import type { StrokeBuffer } from "./StrokeBuffer";
import type { ContentMetrics, InkRenderer } from "./types";

export class Canvas2dInkRenderer implements InkRenderer {
  readonly kind = "canvas2d";
  readonly ready = true;

  private ctx: CanvasRenderingContext2D | null;
  private metrics: ContentMetrics | null = null;
  private color = "#f59e0b";
  private lineWidth = 7;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d", { alpha: true });
  }

  resize(metrics: ContentMetrics): void {
    this.metrics = metrics;
    this.ctx?.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0);
    this.clear();
  }

  beginStroke(color: string, lineWidth: number): void {
    this.color = color;
    this.lineWidth = lineWidth;
    this.clear();
  }

  appendStroke(stroke: StrokeBuffer, dirtyPointIndex: number): void {
    const ctx = this.ctx;
    const metrics = this.metrics;
    if (!ctx || !metrics || stroke.count === 0) return;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = this.color;
    ctx.fillStyle = this.color;

    if (stroke.count === 1) {
      const r = this.widthFor(stroke, 0) * 0.5;
      ctx.beginPath();
      ctx.arc(
        toViewportX(stroke.x[0], metrics),
        toViewportY(stroke.y[0], metrics),
        r,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
      return;
    }

    const start = Math.max(0, Math.min(dirtyPointIndex - 1, stroke.count - 2));
    for (let i = start; i < stroke.count - 1; i++) {
      ctx.lineWidth = (this.widthFor(stroke, i) + this.widthFor(stroke, i + 1)) * 0.5;
      ctx.beginPath();
      ctx.moveTo(toViewportX(stroke.x[i], metrics), toViewportY(stroke.y[i], metrics));
      ctx.lineTo(
        toViewportX(stroke.x[i + 1], metrics),
        toViewportY(stroke.y[i + 1], metrics),
      );
      ctx.stroke();
    }

    ctx.restore();
  }

  endStroke(): void {
    // The controller clears transient selection ink after the existing
    // SelectionPopup flow has had a moment to settle.
  }

  clear(): void {
    if (!this.ctx || !this.metrics) return;
    this.ctx.clearRect(0, 0, this.metrics.viewportWidth, this.metrics.viewportHeight);
  }

  destroy(): void {
    this.clear();
    this.ctx = null;
  }

  private widthFor(stroke: StrokeBuffer, index: number): number {
    const p = Math.max(0, Math.min(1, stroke.pressure[index] || 0.5));
    return Math.max(1, this.lineWidth * (0.65 + p * 0.7));
  }
}
