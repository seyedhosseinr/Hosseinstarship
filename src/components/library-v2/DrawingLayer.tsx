"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";

export type DrawTool = "pen" | "eraser";

interface Pt { x: number; y: number; p: number }
interface Stroke { pts: Pt[]; color: string; w: number; erase: boolean }

export interface DrawingLayerHandle {
  clear: () => void;
  undo: () => void;
}

interface DrawingLayerProps {
  isActive: boolean;
  color: string;
  lineWidth: number;
  tool: DrawTool;
  storageKey?: string;
}

// Pure canvas renderer — no component state captured, safe to call from callbacks
function drawStroke(g: CanvasRenderingContext2D, s: Stroke) {
  const n = s.pts.length;
  if (n === 0) return;
  g.save();
  g.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
  g.lineCap = "round";
  g.lineJoin = "round";
  g.lineWidth = s.w;
  if (n === 1) {
    // Single tap → dot
    g.fillStyle = s.erase ? "rgba(0,0,0,1)" : s.color;
    g.beginPath();
    g.arc(s.pts[0].x, s.pts[0].y, s.w / 2, 0, Math.PI * 2);
    g.fill();
  } else {
    g.strokeStyle = s.erase ? "rgba(0,0,0,1)" : s.color;
    g.beginPath();
    g.moveTo(s.pts[0].x, s.pts[0].y);
    // Quadratic bezier through midpoints — smooth, no corners
    for (let i = 1; i < n - 1; i++) {
      const mid = {
        x: (s.pts[i].x + s.pts[i + 1].x) / 2,
        y: (s.pts[i].y + s.pts[i + 1].y) / 2,
      };
      g.quadraticCurveTo(s.pts[i].x, s.pts[i].y, mid.x, mid.y);
    }
    g.lineTo(s.pts[n - 1].x, s.pts[n - 1].y);
    g.stroke();
  }
  g.restore();
}

export const DrawingLayer = forwardRef<DrawingLayerHandle, DrawingLayerProps>(
  function DrawingLayer({ isActive, color, lineWidth, tool, storageKey }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const strokes = useRef<Stroke[]>([]);
    const cur = useRef<Stroke | null>(null);
    const drawing = useRef(false);
    const raf = useRef(0);

    // Mutable prop refs so event handlers stay stable (no re-attach on every color change)
    const colorRef = useRef(color);
    const lwRef = useRef(lineWidth);
    const toolRef = useRef(tool);
    const activeRef = useRef(isActive);

    useEffect(() => { colorRef.current = color; }, [color]);
    useEffect(() => { lwRef.current = lineWidth; }, [lineWidth]);
    useEffect(() => { toolRef.current = tool; }, [tool]);
    useEffect(() => { activeRef.current = isActive; }, [isActive]);

    const redraw = useCallback(() => {
      const c = canvasRef.current;
      const g = c?.getContext("2d");
      if (!c || !g) return;
      g.clearRect(0, 0, c.width, c.height);
      for (const s of strokes.current) drawStroke(g, s);
      if (cur.current) drawStroke(g, cur.current);
    }, []);

    const persist = useCallback(() => {
      if (!storageKey) return;
      try {
        localStorage.setItem(`drw:${storageKey}`, JSON.stringify(strokes.current));
      } catch { /* quota exceeded — silently skip */ }
    }, [storageKey]);

    useImperativeHandle(ref, () => ({
      clear() {
        strokes.current = [];
        cur.current = null;
        redraw();
        if (storageKey) try { localStorage.removeItem(`drw:${storageKey}`); } catch {}
      },
      undo() {
        strokes.current.pop();
        redraw();
        persist();
      },
    }), [redraw, persist, storageKey]);

    // Cancel in-flight stroke when pen mode is disabled
    useEffect(() => {
      if (!isActive && drawing.current) {
        drawing.current = false;
        cur.current = null;
        redraw();
      }
    }, [isActive, redraw]);

    // Resize canvas to match viewport (drawings are viewport-relative)
    useEffect(() => {
      const c = canvasRef.current;
      if (!c) return;
      const resize = () => {
        c.width = window.innerWidth;
        c.height = window.innerHeight;
        redraw();
      };
      resize();
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }, [redraw]);

    // Restore saved strokes on mount
    useEffect(() => {
      if (!storageKey) return;
      try {
        const raw = localStorage.getItem(`drw:${storageKey}`);
        if (raw) {
          strokes.current = JSON.parse(raw) as Stroke[];
          redraw();
        }
      } catch {}
    }, [storageKey, redraw]);

    // Palm rejection: while a pen is drawing, only that pen's pointerId is
    // honored. Finger / palm pointers are ignored on the canvas. Finger
    // vertical scroll still works because the canvas sets touch-action:
    // pan-y when active, letting the browser pan ReaderStage below.
    const activePenId = useRef<number | null>(null);

    // Stable handlers — read props via refs so listeners never need re-attaching
    const onDown = useCallback((e: PointerEvent) => {
      if (!activeRef.current) return;
      if (e.pointerType !== "pen") return; // palm / finger rejected
      if (activePenId.current !== null && e.pointerId !== activePenId.current) return;
      // Scribble pass-through: if pen lands on any writable field that
      // sits above the canvas in z-order (popup textarea, panel search,
      // future contenteditable), let iPadOS handle handwriting → text.
      const t = e.target as Element | null;
      if (t?.closest("input, textarea, [contenteditable=true]")) return;
      e.preventDefault();
      const c = canvasRef.current;
      if (!c) return;
      c.setPointerCapture(e.pointerId);
      activePenId.current = e.pointerId;
      drawing.current = true;
      const r = c.getBoundingClientRect();
      cur.current = {
        pts: [{ x: e.clientX - r.left, y: e.clientY - r.top, p: e.pressure || 0.5 }],
        color: colorRef.current,
        w: lwRef.current,
        erase: toolRef.current === "eraser",
      };
    }, []);

    const onMove = useCallback((e: PointerEvent) => {
      if (!activeRef.current || !drawing.current || !cur.current) return;
      if (e.pointerType !== "pen") return;
      if (activePenId.current !== null && e.pointerId !== activePenId.current) return;
      e.preventDefault();
      const c = canvasRef.current;
      if (!c) return;
      const r = c.getBoundingClientRect();
      // Consume sub-frame coalesced samples so pressure/position precision
      // is preserved on high-rate Pencil input (up to 240Hz on ProMotion).
      const samples =
        typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
      if (samples.length > 0) {
        for (const s of samples) {
          cur.current.pts.push({
            x: s.clientX - r.left,
            y: s.clientY - r.top,
            p: s.pressure || 0.5,
          });
        }
      } else {
        cur.current.pts.push({
          x: e.clientX - r.left,
          y: e.clientY - r.top,
          p: e.pressure || 0.5,
        });
      }
      if (!raf.current) {
        raf.current = requestAnimationFrame(() => { raf.current = 0; redraw(); });
      }
    }, [redraw]);

    const onUp = useCallback((e: PointerEvent) => {
      if (!drawing.current) return;
      if (activePenId.current !== null && e.pointerId !== activePenId.current) return;
      e.preventDefault();
      drawing.current = false;
      activePenId.current = null;
      if (cur.current && cur.current.pts.length > 0) {
        strokes.current.push(cur.current);
        persist();
      }
      cur.current = null;
      redraw();
    }, [redraw, persist]);

    useEffect(() => {
      const c = canvasRef.current;
      if (!c) return;
      c.addEventListener("pointerdown", onDown);
      c.addEventListener("pointermove", onMove);
      c.addEventListener("pointerup", onUp);
      c.addEventListener("pointercancel", onUp);
      return () => {
        c.removeEventListener("pointerdown", onDown);
        c.removeEventListener("pointermove", onMove);
        c.removeEventListener("pointerup", onUp);
        c.removeEventListener("pointercancel", onUp);
        // Drop any pending redraw so an unmount during an active stroke
        // doesn't fire against a disposed canvas on the next frame.
        if (raf.current) {
          cancelAnimationFrame(raf.current);
          raf.current = 0;
        }
      };
    }, [onDown, onMove, onUp]);

    return (
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 35,
          pointerEvents: isActive ? "auto" : "none",
          cursor: isActive
            ? tool === "eraser"
              ? "cell"
              : "crosshair"
            : "default",
          // Active canvas sits above the reader. `touch-action: pan-y` lets
          // the browser reserve finger vertical pan gestures and bubble the
          // scroll to ReaderStage; pen (pointerType === "pen") is not
          // consumed by pan-y and still fires as pointer events we can
          // preventDefault. Horizontal finger drag is not a pan-y gesture,
          // so it reaches pointerdown — and is rejected by the pen-only
          // gate above. When inactive, `touch-action: none` is harmless
          // because the canvas is pointer-events:none and skipped from hit
          // testing entirely.
          touchAction: isActive ? "pan-y" : "none",
        }}
      />
    );
  },
);
