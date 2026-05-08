import { Canvas2dInkRenderer } from "./Canvas2dInkRenderer";
import { readContentMetrics } from "./metrics";
import { StrokeBuffer } from "./StrokeBuffer";
import { WebGpuInkRenderer } from "./WebGpuInkRenderer";
import {
  DEFAULT_INK_OPTIONS,
  type ContentMetrics,
  type InkControllerConfig,
  type InkLayerOptions,
  type InkPoint,
  type InkRenderer,
  type PencilStrokeDetail,
} from "./types";

type PencilEvent = CustomEvent<PencilStrokeDetail>;

export class InkController {
  private gpuRenderer: WebGpuInkRenderer;
  private canvasRenderer: Canvas2dInkRenderer;
  private renderer: InkRenderer;
  private metrics: ContentMetrics | null = null;
  private stroke: StrokeBuffer | null = null;
  private options: InkLayerOptions;
  private isActive: boolean;
  private color: string;
  private clearTimer = 0;
  private resizeObserver: ResizeObserver | null = null;
  private observedContent: HTMLElement | null = null;
  private destroyed = false;

  constructor(private readonly config: InkControllerConfig) {
    this.options = { ...DEFAULT_INK_OPTIONS, ...config.options };
    this.isActive = config.isActive;
    this.color = config.color;
    this.gpuRenderer = new WebGpuInkRenderer(config.gpuCanvas, this.options);
    this.canvasRenderer = new Canvas2dInkRenderer(config.fallbackCanvas);
    this.renderer = this.canvasRenderer;

    this.configureCanvasChrome();
    this.refreshMetrics();
    this.attach();
  }

  update(input: {
    isActive?: boolean;
    color?: string;
    options?: Partial<InkLayerOptions>;
  }): void {
    if (typeof input.isActive === "boolean") {
      this.isActive = input.isActive;
      if (!this.isActive) this.cancelStroke();
    }

    if (input.color) this.color = input.color;

    if (input.options) {
      this.options = { ...this.options, ...input.options };
      this.gpuRenderer.setOptions(this.options);
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.detach();
    this.cancelStroke();
    this.gpuRenderer.destroy();
    this.canvasRenderer.destroy();
  }

  private attach(): void {
    document.addEventListener("reader:pencil-stroke-start", this.onStart as EventListener);
    document.addEventListener("reader:pencil-stroke-move", this.onMove as EventListener);
    document.addEventListener("reader:pencil-stroke-end", this.onEnd as EventListener);
    document.addEventListener("reader:pencil-stroke-cancel", this.onCancel as EventListener);

    window.addEventListener("resize", this.onMetricsInvalidated, { passive: true });
    window.addEventListener("orientationchange", this.onMetricsInvalidated, {
      passive: true,
    });
    this.config.scrollContainer?.addEventListener("scroll", this.onMetricsInvalidated, {
      passive: true,
    });

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(this.onMetricsInvalidated);
      if (this.config.scrollContainer) this.resizeObserver.observe(this.config.scrollContainer);
      this.observeContentElement();
    }
  }

  private detach(): void {
    document.removeEventListener("reader:pencil-stroke-start", this.onStart as EventListener);
    document.removeEventListener("reader:pencil-stroke-move", this.onMove as EventListener);
    document.removeEventListener("reader:pencil-stroke-end", this.onEnd as EventListener);
    document.removeEventListener("reader:pencil-stroke-cancel", this.onCancel as EventListener);

    window.removeEventListener("resize", this.onMetricsInvalidated);
    window.removeEventListener("orientationchange", this.onMetricsInvalidated);
    this.config.scrollContainer?.removeEventListener("scroll", this.onMetricsInvalidated);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  private configureCanvasChrome(): void {
    for (const canvas of [this.config.gpuCanvas, this.config.fallbackCanvas]) {
      canvas.style.position = "fixed";
      canvas.style.inset = "0";
      canvas.style.pointerEvents = "none";
      canvas.style.touchAction = "none";
      canvas.style.userSelect = "none";
    }
  }

  private refreshMetrics(): void {
    if (this.destroyed) return;

    this.observeContentElement();
    this.metrics = readContentMetrics(this.config);
    this.gpuRenderer.resize(this.metrics);
    this.canvasRenderer.resize(this.metrics);
    this.renderer.resize(this.metrics);

    if (this.stroke) {
      this.renderer.appendStroke(this.stroke, 0);
    }
  }

  private observeContentElement(): void {
    if (!this.resizeObserver || !this.config.scrollContainer) return;

    const next =
      this.config.scrollContainer.querySelector<HTMLElement>(this.config.contentSelector) ??
      null;
    if (next === this.observedContent) return;

    if (this.observedContent) this.resizeObserver.unobserve(this.observedContent);
    this.observedContent = next;
    if (next) this.resizeObserver.observe(next);
  }

  private selectRenderer(): InkRenderer {
    if (this.gpuRenderer.ready) {
      this.config.gpuCanvas.style.opacity = "1";
      this.config.fallbackCanvas.style.opacity = "0";
      return this.gpuRenderer;
    }

    this.config.gpuCanvas.style.opacity = "0";
    this.config.fallbackCanvas.style.opacity = "1";
    return this.canvasRenderer;
  }

  private appendPoints(points: InkPoint[]): number {
    if (!this.stroke || !this.metrics) return 0;

    const dirtyPointIndex = this.stroke.count;
    for (const point of points) {
      const prev = this.stroke.count - 1;
      if (prev >= 0) {
        const dx = point.x - (this.stroke.x[prev] + this.metrics.contentLeft);
        const dy = point.y - (this.stroke.y[prev] + this.metrics.contentTop);
        if (Math.hypot(dx, dy) < 0.35) continue;
      }
      this.stroke.appendClientPoint(point, this.metrics);
    }

    return dirtyPointIndex;
  }

  private cancelStroke(): void {
    if (this.clearTimer) {
      window.clearTimeout(this.clearTimer);
      this.clearTimer = 0;
    }
    this.stroke = null;
    this.gpuRenderer.clear();
    this.canvasRenderer.clear();
  }

  private onMetricsInvalidated = (): void => {
    this.refreshMetrics();
  };

  private onStart = (event: PencilEvent): void => {
    if (!this.isActive) return;

    if (this.clearTimer) {
      window.clearTimeout(this.clearTimer);
      this.clearTimer = 0;
    }

    if (!this.metrics) this.refreshMetrics();
    if (!this.metrics) return;

    this.renderer = this.selectRenderer();
    this.stroke = new StrokeBuffer(this.color, this.options.lineWidth);
    this.renderer.beginStroke(this.color, this.options.lineWidth);

    const dirtyPointIndex = this.appendPoints(event.detail.points);
    this.renderer.appendStroke(this.stroke, dirtyPointIndex);
  };

  private onMove = (event: PencilEvent): void => {
    if (!this.isActive || !this.stroke) return;

    const dirtyPointIndex = this.appendPoints(event.detail.points);
    this.renderer.appendStroke(this.stroke, dirtyPointIndex);
  };

  private onEnd = (event: PencilEvent): void => {
    if (!this.stroke) return;

    const dirtyPointIndex = this.appendPoints(event.detail.points);
    this.renderer.appendStroke(this.stroke, dirtyPointIndex);
    this.renderer.endStroke();

    this.clearTimer = window.setTimeout(() => {
      this.stroke = null;
      this.renderer.clear();
      this.clearTimer = 0;
    }, this.options.fadeOutMs);
  };

  private onCancel = (): void => {
    this.cancelStroke();
  };
}
