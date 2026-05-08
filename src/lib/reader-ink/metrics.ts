import type { ContentMetrics } from "./types";

interface MetricsInput {
  gpuCanvas: HTMLCanvasElement;
  fallbackCanvas: HTMLCanvasElement;
  scrollContainer: HTMLElement | null;
  contentSelector: string;
}

function syncCanvas(canvas: HTMLCanvasElement, metrics: ContentMetrics): void {
  if (canvas.width !== metrics.canvasWidth) canvas.width = metrics.canvasWidth;
  if (canvas.height !== metrics.canvasHeight) canvas.height = metrics.canvasHeight;

  const width = `${metrics.viewportWidth}px`;
  const height = `${metrics.viewportHeight}px`;
  if (canvas.style.width !== width) canvas.style.width = width;
  if (canvas.style.height !== height) canvas.style.height = height;
}

export function readContentMetrics({
  gpuCanvas,
  fallbackCanvas,
  scrollContainer,
  contentSelector,
}: MetricsInput): ContentMetrics {
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const content =
    scrollContainer?.querySelector<HTMLElement>(contentSelector) ?? scrollContainer;
  const rect = content?.getBoundingClientRect();

  const metrics: ContentMetrics = {
    dpr,
    viewportWidth,
    viewportHeight,
    canvasWidth: Math.max(1, Math.round(viewportWidth * dpr)),
    canvasHeight: Math.max(1, Math.round(viewportHeight * dpr)),
    contentLeft: rect?.left ?? 0,
    contentTop: rect?.top ?? 0,
    contentWidth: rect?.width ?? viewportWidth,
    contentHeight: rect?.height ?? viewportHeight,
    scrollTop: scrollContainer?.scrollTop ?? window.scrollY,
    scrollLeft: scrollContainer?.scrollLeft ?? window.scrollX,
  };

  syncCanvas(gpuCanvas, metrics);
  syncCanvas(fallbackCanvas, metrics);

  return metrics;
}

export function toContentX(clientX: number, metrics: ContentMetrics): number {
  return clientX - metrics.contentLeft;
}

export function toContentY(clientY: number, metrics: ContentMetrics): number {
  return clientY - metrics.contentTop;
}

export function toViewportX(contentX: number, metrics: ContentMetrics): number {
  return contentX + metrics.contentLeft;
}

export function toViewportY(contentY: number, metrics: ContentMetrics): number {
  return contentY + metrics.contentTop;
}
