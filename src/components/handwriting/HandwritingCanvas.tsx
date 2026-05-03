"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  forwardRef,
  type PointerEvent,
} from "react";
import type { HandwritingStroke, HandwritingPoint } from "@/lib/handwriting/types";

export interface HandwritingCanvasHandle {
  clear(): void;
  undo(): void;
}

interface HandwritingCanvasProps {
  strokes: HandwritingStroke[];
  onChange(strokes: HandwritingStroke[]): void;
  tool: "pen" | "eraser";
  color: string;
  width: number;
  className?: string;
}

const ERASER_RADIUS = 20;

function newId(): string {
  return crypto.randomUUID();
}

function renderStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: HandwritingStroke[],
  dpr: number,
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue;

    if (stroke.tool === "eraser") {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = stroke.width * dpr;
    } else {
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width * dpr;
    }

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x * dpr, stroke.points[0].y * dpr);

    for (let i = 1; i < stroke.points.length; i++) {
      const prev = stroke.points[i - 1];
      const curr = stroke.points[i];
      // Quadratic curve midpoint smoothing
      const mx = (prev.x + curr.x) / 2;
      const my = (prev.y + curr.y) / 2;
      ctx.quadraticCurveTo(prev.x * dpr, prev.y * dpr, mx * dpr, my * dpr);
    }

    const last = stroke.points[stroke.points.length - 1];
    ctx.lineTo(last.x * dpr, last.y * dpr);
    ctx.stroke();
    ctx.restore();
  }
}

export const HandwritingCanvas = forwardRef<
  HandwritingCanvasHandle,
  HandwritingCanvasProps
>(function HandwritingCanvas(
  { strokes, onChange, tool, color, width, className },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentStrokeRef = useRef<HandwritingPoint[]>([]);
  const isDrawingRef = useRef(false);
  const strokesRef = useRef(strokes);

  // Keep ref in sync so pointer handlers always see current strokes.
  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  // Re-render when strokes or size change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    renderStrokes(ctx, strokes, dpr);
  }, [strokes]);

  // Resize observer — keeps canvas pixel dimensions correct on rotate/resize.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sync = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width: w, height: h } = canvas.getBoundingClientRect();
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const ctx = canvas.getContext("2d");
      if (ctx) renderStrokes(ctx, strokesRef.current, dpr);
    };

    const ro = new ResizeObserver(sync);
    ro.observe(canvas);
    sync();
    return () => ro.disconnect();
  }, []);

  const getPoint = useCallback(
    (e: PointerEvent<HTMLCanvasElement>): HandwritingPoint => {
      const rect = canvasRef.current!.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        pressure: e.pressure > 0 ? e.pressure : undefined,
        t: e.timeStamp,
      };
    },
    [],
  );

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLCanvasElement>) => {
      // Only respond to stylus or primary mouse button.
      if (e.pointerType === "touch" && e.buttons !== 1) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      isDrawingRef.current = true;
      currentStrokeRef.current = [getPoint(e)];
    },
    [getPoint],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return;
      const pt = getPoint(e);
      currentStrokeRef.current.push(pt);

      // Live preview: draw the in-progress stroke on top.
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;

      const liveStroke: HandwritingStroke = {
        id: "__live__",
        points: currentStrokeRef.current,
        color,
        width,
        tool,
      };
      renderStrokes(ctx, [...strokesRef.current, liveStroke], dpr);
    },
    [color, width, tool, getPoint],
  );

  const onPointerUp = useCallback(
    (e: PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;

      const points = currentStrokeRef.current;
      currentStrokeRef.current = [];

      if (points.length === 0) return;

      const newStroke: HandwritingStroke = {
        id: newId(),
        points,
        color,
        width,
        tool,
      };

      if (tool === "eraser") {
        // Remove strokes that overlap the eraser path.
        const erased = strokesRef.current.filter((s) => {
          return !points.some((ep) =>
            s.points.some(
              (sp) =>
                Math.hypot(sp.x - ep.x, sp.y - ep.y) < ERASER_RADIUS,
            ),
          );
        });
        onChange(erased);
      } else {
        onChange([...strokesRef.current, newStroke]);
      }

      void e; // suppress unused var warning — e is used via getPoint inside move
    },
    [color, width, tool, onChange],
  );

  useImperativeHandle(
    ref,
    () => ({
      clear() {
        onChange([]);
      },
      undo() {
        const current = strokesRef.current;
        if (current.length === 0) return;
        // Remove pen strokes one at a time; skip eraser entries.
        const lastPenIdx = [...current]
          .reverse()
          .findIndex((s) => s.tool === "pen");
        if (lastPenIdx === -1) {
          onChange([]);
          return;
        }
        const realIdx = current.length - 1 - lastPenIdx;
        onChange(current.filter((_, i) => i !== realIdx));
      },
    }),
    [onChange],
  );

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ touchAction: "none", cursor: tool === "eraser" ? "cell" : "crosshair" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
});
