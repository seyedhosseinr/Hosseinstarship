"use client";

/**
 * WebGLEdgeLayer
 * GPU-rendered bezier edge layer for the Outliner DAG canvas.
 *
 * Replaces the SVG AlgorithmEdgeLayer with a WebGL2 canvas that provides:
 *  - Smooth anti-aliased thick bezier curves (triangle-strip tessellation)
 *  - Animated flow dashes (GPU fragment shader)
 *  - Type-based colour coding matching the SVG version
 *  - HiDPI (devicePixelRatio) aware rendering
 *  - Graceful fallback: calls onFallback() if WebGL2 is unavailable
 */

import { useCallback, useEffect, useRef } from "react";
import type { LayoutEdge } from "@/components/algorithms/useAlgorithmLayout";

// ── Config ────────────────────────────────────────────────────────────────────

const CURVE_SAMPLES = 30;   // bezier sample count per edge (higher = smoother)
const HALF_THICK    = 1.6;  // edge half-thickness, in CSS pixels
const ARROW_LEN     = 10;   // arrowhead length, CSS px
const ARROW_HW      = 5.5;  // arrowhead half-width, CSS px

// ── Colours (RGBA 0..1) — matching AlgorithmEdgeLayer colour codes ────────────

const RGBA: Record<string, readonly [number, number, number, number]> = {
  escalation:       [0.937, 0.267, 0.267, 0.90], // #ef4444
  trap:             [0.984, 0.447, 0.522, 0.90], // #fb7185
  exception_branch: [0.976, 0.451, 0.086, 0.90], // #f97316
  threshold_split:  [0.961, 0.620, 0.043, 0.90], // #f59e0b
  default:          [0.610, 0.670, 0.750, 0.88], // slate-400, visible in both light and dark mode
};

function edgeRGBA(type?: string): readonly [number, number, number, number] {
  return RGBA[type ?? "default"] ?? RGBA.default;
}

// ── GLSL shaders ──────────────────────────────────────────────────────────────

const VERT_SRC = /* glsl */ `#version 300 es
precision highp float;
// per-vertex attributes
in vec2  a_pos;    // pixel-space position (already extruded off the centre-line)
in float a_t;      // normalised arc length 0→1 along the bezier
in float a_side;   // −1 (left) or +1 (right) of the centreline
in vec4  a_color;  // RGBA
in float a_hi;     // 0=dim, 1=highlighted/selected

uniform vec2 u_res; // canvas CSS-pixel size

out vec4  v_color;
out float v_t;
out float v_side;
out float v_hi;

void main() {
  // pixel → NDC  (Y is flipped: CSS top=0 → GL bottom=0)
  vec2 ndc = (a_pos / u_res) * 2.0 - 1.0;
  ndc.y   *= -1.0;
  gl_Position = vec4(ndc, 0.0, 1.0);
  v_color = a_color;
  v_t     = a_t;
  v_side  = a_side;
  v_hi    = a_hi;
}`;

const FRAG_SRC = /* glsl */ `#version 300 es
precision mediump float;

in vec4  v_color;
in float v_t;
in float v_side;
in float v_hi;

uniform float u_time; // seconds since mount

out vec4 fragColor;

void main() {
  // ── Soft anti-aliasing across the edge width ──────────────────────────
  float aa = 1.0 - smoothstep(0.6, 1.0, abs(v_side));

  // ── Flow animation: dashes moving from source → target ───────────────
  // phase: 5 dashes per edge, moving at 0.45 edge-lengths per second
  float phase = fract(v_t * 5.0 - u_time * 0.45);
  float dash  = smoothstep(0.00, 0.10, phase)
              * (1.0 - smoothstep(0.50, 0.62, phase));
  // Between dashes the edge is dimmer (0.4), not invisible
  float flow  = 0.40 + 0.60 * dash;

  // ── Highlighted edges are fully bright; others follow the flow ────────
  float bright = mix(flow, 1.0, v_hi * 0.75);

  vec4 col  = v_color;
  col.rgb  *= bright;
  col.a    *= aa;
  fragColor = col;
}`;

// ── Types ─────────────────────────────────────────────────────────────────────

type P2 = [number, number];

// Vertex layout  [x, y, t, side, r, g, b, a, hi]  = 9 floats
const STRIDE = 9;

// ── Bezier sampling ───────────────────────────────────────────────────────────

function cubicBez(p0: P2, p1: P2, p2: P2, p3: P2, t: number): P2 {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}

/** Unit perpendicular (90° CCW) to the direction p→q. */
function perpNorm(p: P2, q: P2): P2 {
  const dx = q[0] - p[0], dy = q[1] - p[1];
  const len = Math.hypot(dx, dy) || 1;
  return [-dy / len, dx / len];
}

/** Unit vector from p toward q. */
function unitDir(p: P2, q: P2): P2 {
  const dx = q[0] - p[0], dy = q[1] - p[1];
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}

// ── Geometry builder ──────────────────────────────────────────────────────────

function buildBuffers(
  edges: LayoutEdge[],
  selected: string | null,
  visited: Set<string>,
): { stripData: Float32Array; arrowData: Float32Array } {
  const strip: number[] = [];
  const arrow: number[] = [];

  for (let ei = 0; ei < edges.length; ei++) {
    const { edge, fromPos, toPos } = edges[ei];
    const [r, g, b, baseA] = edgeRGBA(edge.edgeType) as [number, number, number, number];

    const isHi    = selected === edge.from || selected === edge.to
                  || visited.has(edge.from) || visited.has(edge.to);
    const dimmed  = selected !== null && !isHi;
    const alpha   = dimmed ? baseA * 0.14 : baseA;
    const hi      = isHi ? 1.0 : 0.0;
    const hw      = isHi ? HALF_THICK * 1.9 : HALF_THICK;

    // Bezier control points — matches AlgorithmEdgeLayer.tsx formula exactly
    const fx = fromPos.x, fy = fromPos.y;
    const tx = toPos.x,   ty = toPos.y;
    const cp = Math.max(40, Math.abs(ty - fy) / 2);
    const p0: P2 = [fx, fy],      p1: P2 = [fx, fy + cp];
    const p2: P2 = [tx, ty - cp], p3: P2 = [tx, ty];

    // Sample the bezier
    const pts: P2[] = Array.from({ length: CURVE_SAMPLES + 1 }, (_, i) =>
      cubicBez(p0, p1, p2, p3, i / CURVE_SAMPLES),
    );

    // ── Triangle-strip degenerate connector between edges ─────────────────
    if (ei > 0 && strip.length > 0) {
      // Repeat last vertex of previous edge
      strip.push(...strip.slice(-STRIDE));
      // Repeat first vertex of this edge (computed below)
      const n0 = perpNorm(pts[0], pts[1]);
      strip.push(
        pts[0][0] - n0[0] * hw, pts[0][1] - n0[1] * hw,
        0, -1, r, g, b, alpha, hi,
      );
    }

    // ── Triangle-strip for the bezier tube ────────────────────────────────
    for (let i = 0; i <= CURVE_SAMPLES; i++) {
      const t = i / CURVE_SAMPLES;
      const p = pts[i];
      // Tangent normal: use forward diff except at last point
      const n = i < CURVE_SAMPLES
        ? perpNorm(pts[i], pts[i + 1])
        : perpNorm(pts[i - 1], pts[i]);

      // Left vertex  (side = −1)
      strip.push(p[0] - n[0] * hw, p[1] - n[1] * hw, t, -1, r, g, b, alpha, hi);
      // Right vertex (side = +1)
      strip.push(p[0] + n[0] * hw, p[1] + n[1] * hw, t, +1, r, g, b, alpha, hi);
    }

    // ── Arrowhead triangle at the endpoint (toPos) ────────────────────────
    const endPt  = pts[CURVE_SAMPLES];
    const prevPt = pts[CURVE_SAMPLES - 1];
    const [atx, aty] = unitDir(prevPt, endPt);  // forward tangent
    const [anx, any] = [-aty, atx];              // perpendicular

    // tip = the endpoint; base = pulled back ARROW_LEN along the curve
    const tip: P2  = [endPt[0],                       endPt[1]];
    const base: P2 = [endPt[0] - atx * ARROW_LEN,     endPt[1] - aty * ARROW_LEN];
    const aL: P2   = [base[0]  - anx * ARROW_HW,      base[1]  - any * ARROW_HW];
    const aR: P2   = [base[0]  + anx * ARROW_HW,      base[1]  + any * ARROW_HW];

    const aAlpha = dimmed ? 0.10 : Math.min(baseA * 1.15, 1.0);
    for (const [px, py] of [tip, aL, aR] as P2[]) {
      arrow.push(px, py, 1.0, 0.0, r, g, b, aAlpha, hi);
    }
  }

  return {
    stripData: new Float32Array(strip),
    arrowData: new Float32Array(arrow),
  };
}

// ── WebGL helpers ─────────────────────────────────────────────────────────────

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const msg = gl.getShaderInfoLog(sh) ?? "shader compile error";
    gl.deleteShader(sh);
    throw new Error(msg);
  }
  return sh;
}

function makeProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER,   VERT_SRC));
  gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const msg = gl.getProgramInfoLog(prog) ?? "program link error";
    gl.deleteProgram(prog);
    throw new Error(msg);
  }
  return prog;
}

/** Bind buffer to VAO and set up all vertex attribute pointers. */
function makeVAO(
  gl: WebGL2RenderingContext,
  prog: WebGLProgram,
  buf: WebGLBuffer,
): WebGLVertexArrayObject {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  const byteStride = STRIDE * 4;

  function ptr(name: string, size: number, offset: number) {
    const loc = gl.getAttribLocation(prog, name);
    if (loc < 0) return; // attribute optimised-away by GLSL compiler — skip
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, byteStride, offset * 4);
  }
  ptr("a_pos",   2, 0);
  ptr("a_t",     1, 2);
  ptr("a_side",  1, 3);
  ptr("a_color", 4, 4);
  ptr("a_hi",    1, 8);

  gl.bindVertexArray(null);
  return vao;
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface WebGLEdgeLayerProps {
  layoutEdges: LayoutEdge[];
  canvasWidth: number;
  canvasHeight: number;
  selectedNodeId: string | null;
  visitedPath: string[];
  /** Called if WebGL2 context creation or shader compilation fails. */
  onFallback: () => void;
}

export function WebGLEdgeLayer({
  layoutEdges,
  canvasWidth,
  canvasHeight,
  selectedNodeId,
  visitedPath,
  onFallback,
}: WebGLEdgeLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // WebGL objects — created once, reused across renders
  const glRef      = useRef<WebGL2RenderingContext | null>(null);
  const progRef    = useRef<WebGLProgram | null>(null);
  const stripVAO   = useRef<WebGLVertexArrayObject | null>(null);
  const stripBuf   = useRef<WebGLBuffer | null>(null);
  const arrowVAO   = useRef<WebGLVertexArrayObject | null>(null);
  const arrowBuf   = useRef<WebGLBuffer | null>(null);

  // Render-loop state
  const rafRef     = useRef(0);
  const t0Ref      = useRef(performance.now());
  const stripLen   = useRef(0);
  const arrowLen   = useRef(0);

  // Stable fallback reference (parent should wrap with useCallback too)
  const fallback = useCallback(() => onFallback(), [onFallback]);

  // ── One-time WebGL2 initialisation ─────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("webgl2", {
      antialias: true,
      alpha: true,
      premultipliedAlpha: false,
    });
    if (!ctx) { fallback(); return; }

    try {
      const prog  = makeProgram(ctx);
      const sb    = ctx.createBuffer()!;
      const ab    = ctx.createBuffer()!;

      glRef.current    = ctx;
      progRef.current  = prog;
      stripBuf.current = sb;
      arrowBuf.current = ab;
      stripVAO.current = makeVAO(ctx, prog, sb);
      arrowVAO.current = makeVAO(ctx, prog, ab);
    } catch (err) {
      console.warn("[WebGLEdgeLayer] init failed, falling back to SVG:", err);
      fallback();
    }

    // Handle WebGL context loss — cancel the RAF and fall back to SVG
    const handleContextLost = (e: Event) => {
      e.preventDefault(); // prevent the browser's default context restore attempt
      cancelAnimationFrame(rafRef.current);
      fallback();
    };
    canvas.addEventListener("webglcontextlost", handleContextLost);

    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      cancelAnimationFrame(rafRef.current);
      const g = glRef.current;
      if (!g) return;
      g.deleteProgram(progRef.current);
      g.deleteBuffer(stripBuf.current);
      g.deleteBuffer(arrowBuf.current);
      g.deleteVertexArray(stripVAO.current);
      g.deleteVertexArray(arrowVAO.current);
      glRef.current = null;
    };
  }, [fallback]);

  // ── Rebuild geometry + (re)start render loop on data change ─────────────
  useEffect(() => {
    const ctx = glRef.current;
    if (!ctx || !progRef.current || !stripVAO.current) return;

    // Rebuild CPU-side geometry
    const visited = new Set(visitedPath);
    const { stripData, arrowData } = buildBuffers(layoutEdges, selectedNodeId, visited);

    // Upload to GPU
    ctx.bindBuffer(ctx.ARRAY_BUFFER, stripBuf.current);
    ctx.bufferData(ctx.ARRAY_BUFFER, stripData, ctx.DYNAMIC_DRAW);
    stripLen.current = stripData.length / STRIDE;

    ctx.bindBuffer(ctx.ARRAY_BUFFER, arrowBuf.current);
    ctx.bufferData(ctx.ARRAY_BUFFER, arrowData, ctx.DYNAMIC_DRAW);
    arrowLen.current = arrowData.length / STRIDE;

    // Cache uniform locations
    const p    = progRef.current;
    const uRes = ctx.getUniformLocation(p, "u_res");
    const uT   = ctx.getUniformLocation(p, "u_time");

    cancelAnimationFrame(rafRef.current);

    const canvas = canvasRef.current!;

    function draw() {
      // Re-read from ref inside the closure — TypeScript widens const captures
      // across closure boundaries, so we must narrow again here.
      const gl = glRef.current;
      if (!gl) return;

      const dpr = Math.round(window.devicePixelRatio || 1);
      const pw  = Math.round(canvasWidth  * dpr);
      const ph  = Math.round(canvasHeight * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width  = pw;
        canvas.height = ph;
      }

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      gl.useProgram(p);
      gl.uniform2f(uRes, canvasWidth, canvasHeight); // CSS-pixel space
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const elapsed = reduceMotion ? 0 : (performance.now() - t0Ref.current) / 1000;
      gl.uniform1f(uT, elapsed);

      if (stripLen.current > 0) {
        gl.bindVertexArray(stripVAO.current);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, stripLen.current);
      }
      if (arrowLen.current > 0) {
        gl.bindVertexArray(arrowVAO.current);
        gl.drawArrays(gl.TRIANGLES, 0, arrowLen.current);
      }
      gl.bindVertexArray(null);

      rafRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [layoutEdges, selectedNodeId, visitedPath, canvasWidth, canvasHeight]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: canvasWidth,
        height: canvasHeight,
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
}
