import type { InkLayerOptions } from "./types";
import { DEFAULT_INK_OPTIONS } from "./types";
import type { StrokeBuffer } from "./StrokeBuffer";

export const VERTEX_FLOATS = 6;
export const VERTEX_BYTES = VERTEX_FLOATS * Float32Array.BYTES_PER_ELEMENT;

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

function parseColor(input: string): Rgba {
  if (input.startsWith("#")) {
    const hex = input.slice(1);
    const full =
      hex.length === 3
        ? hex.split("").map((c) => c + c).join("")
        : hex.padEnd(6, "0").slice(0, 6);
    const value = Number.parseInt(full, 16);
    return {
      r: ((value >> 16) & 255) / 255,
      g: ((value >> 8) & 255) / 255,
      b: (value & 255) / 255,
      a: 0.9,
    };
  }

  return { r: 0.96, g: 0.62, b: 0.04, a: 0.9 };
}

export class StrokeMesher {
  vertices: Float32Array;
  vertexCount = 0;
  meshedPointCount = 0;
  dirtyVertexStart = 0;

  private color = parseColor("#f59e0b");
  private options: InkLayerOptions = DEFAULT_INK_OPTIONS;

  constructor(maxVertices: number) {
    this.vertices = new Float32Array(maxVertices * VERTEX_FLOATS);
  }

  reset(color: string, options: InkLayerOptions): void {
    this.vertexCount = 0;
    this.meshedPointCount = 0;
    this.dirtyVertexStart = 0;
    this.color = parseColor(color);
    this.options = options;
  }

  meshTail(stroke: StrokeBuffer, dirtyPointIndex: number): void {
    if (stroke.count < 1) return;

    if (stroke.count === 1) {
      this.vertexCount = 0;
      this.dirtyVertexStart = 0;
      this.writeDot(stroke, 0);
      this.meshedPointCount = 1;
      return;
    }

    const firstDirtySegment = Math.max(0, Math.min(dirtyPointIndex - 1, stroke.count - 2));
    this.vertexCount = firstDirtySegment * 6;
    this.dirtyVertexStart = this.vertexCount;

    for (let i = firstDirtySegment; i < stroke.count - 1; i++) {
      this.writeSegment(stroke, i);
    }

    this.meshedPointCount = stroke.count;
  }

  private widthFor(stroke: StrokeBuffer, index: number): number {
    const p = Math.max(0, Math.min(1, stroke.pressure[index] || 0.5));
    const scale =
      this.options.minPressureWidth +
      (this.options.maxPressureWidth - this.options.minPressureWidth) * p;
    return Math.max(1, stroke.lineWidth * scale);
  }

  private writeDot(stroke: StrokeBuffer, index: number): void {
    const radius = this.widthFor(stroke, index) * 0.5;
    const x = stroke.x[index];
    const y = stroke.y[index];
    this.writeQuad(x - radius, y - radius, x + radius, y - radius, x - radius, y + radius, x + radius, y + radius);
  }

  private writeSegment(stroke: StrokeBuffer, index: number): void {
    const x0 = stroke.x[index];
    const y0 = stroke.y[index];
    const x1 = stroke.x[index + 1];
    const y1 = stroke.y[index + 1];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);

    if (len < 0.01) {
      this.writeDot(stroke, index);
      return;
    }

    const nx = -dy / len;
    const ny = dx / len;
    const w0 = this.widthFor(stroke, index) * 0.5;
    const w1 = this.widthFor(stroke, index + 1) * 0.5;

    this.writeQuad(
      x0 + nx * w0,
      y0 + ny * w0,
      x0 - nx * w0,
      y0 - ny * w0,
      x1 + nx * w1,
      y1 + ny * w1,
      x1 - nx * w1,
      y1 - ny * w1,
    );
  }

  private writeQuad(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
    dx: number,
    dy: number,
  ): void {
    this.writeVertex(ax, ay);
    this.writeVertex(bx, by);
    this.writeVertex(cx, cy);
    this.writeVertex(cx, cy);
    this.writeVertex(bx, by);
    this.writeVertex(dx, dy);
  }

  private writeVertex(x: number, y: number): void {
    const base = this.vertexCount * VERTEX_FLOATS;
    if (base + VERTEX_FLOATS > this.vertices.length) return;

    this.vertices[base] = x;
    this.vertices[base + 1] = y;
    this.vertices[base + 2] = this.color.r;
    this.vertices[base + 3] = this.color.g;
    this.vertices[base + 4] = this.color.b;
    this.vertices[base + 5] = this.color.a;
    this.vertexCount++;
  }
}
