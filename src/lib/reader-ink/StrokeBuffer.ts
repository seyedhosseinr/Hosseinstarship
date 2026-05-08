import { toContentX, toContentY } from "./metrics";
import type { ContentMetrics, InkPoint } from "./types";

const INITIAL_POINT_CAPACITY = 1024;

export class StrokeBuffer {
  x: Float32Array;
  y: Float32Array;
  pressure: Float32Array;
  time: Float32Array;

  count = 0;
  color: string;
  lineWidth: number;

  constructor(color: string, lineWidth: number, capacity = INITIAL_POINT_CAPACITY) {
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.pressure = new Float32Array(capacity);
    this.time = new Float32Array(capacity);
    this.color = color;
    this.lineWidth = lineWidth;
  }

  reset(color: string, lineWidth: number): void {
    this.count = 0;
    this.color = color;
    this.lineWidth = lineWidth;
  }

  appendClientPoint(point: InkPoint, metrics: ContentMetrics): void {
    this.append(
      toContentX(point.x, metrics),
      toContentY(point.y, metrics),
      point.pressure,
      point.time,
    );
  }

  append(x: number, y: number, pressure: number, time: number): void {
    this.ensureCapacity(this.count + 1);
    const i = this.count;
    this.x[i] = x;
    this.y[i] = y;
    this.pressure[i] = pressure > 0 ? pressure : 0.5;
    this.time[i] = time;
    this.count = i + 1;
  }

  private ensureCapacity(nextCount: number): void {
    if (nextCount <= this.x.length) return;

    let nextCapacity = this.x.length;
    while (nextCapacity < nextCount) nextCapacity *= 2;

    const nextX = new Float32Array(nextCapacity);
    const nextY = new Float32Array(nextCapacity);
    const nextPressure = new Float32Array(nextCapacity);
    const nextTime = new Float32Array(nextCapacity);

    nextX.set(this.x);
    nextY.set(this.y);
    nextPressure.set(this.pressure);
    nextTime.set(this.time);

    this.x = nextX;
    this.y = nextY;
    this.pressure = nextPressure;
    this.time = nextTime;
  }
}
