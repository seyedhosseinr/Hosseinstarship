"use client";

/**
 * OutlinerWebGLCanvas — unified 5-pass WebGL2 pipeline
 * ──────────────────────────────────────────────────────
 *  Pass 1 · Heatmap   Additive radial glows under nodes (green → amber → red by risk)
 *  Pass 2 · Edges     GPU-tessellated bezier tubes with animated flow dashes + arrowheads
 *  Pass 3 · Particles 5 sprites per edge flowing along beziers (additive glow)
 *  Pass 4 · LOD quads Colored node cards via WebGL when zoom < 0.55 (DOM hidden)
 *  Pass 5 · DOF       retained as an available shader, disabled by default for Study Clarity Mode
 *
 * Falls back to SVG via onFallback() on WebGL2 unavailability or context loss.
 */

import { useCallback, useEffect, useRef } from "react";
import {
  type LayoutEdge,
  type LayoutNode,
  NODE_W,
  NODE_H,
} from "@/components/algorithms/useAlgorithmLayout";

// ─── Constants ────────────────────────────────────────────────────────────────

const LOD_THRESHOLD      = 0.55;   // zoom below → WebGL quads replace DOM cards
const PARTICLES_PER_EDGE = 3;
const HEAT_RADIUS        = 90;     // CSS px
const CURVE_SAMPLES      = 30;     // bezier subdivisions per edge
const HALF_THICK         = 1.35;   // edge half-width CSS px
const ARROW_LEN          = 10;
const ARROW_HW           = 5.5;

// ─── Colour tables ────────────────────────────────────────────────────────────

const EDGE_RGBA: Record<string, readonly [number, number, number, number]> = {
  escalation:       [0.937, 0.267, 0.267, 0.90],
  trap:             [0.984, 0.447, 0.522, 0.90],
  exception_branch: [0.976, 0.451, 0.086, 0.90],
  threshold_split:  [0.961, 0.620, 0.043, 0.90],
  default:          [0.610, 0.670, 0.750, 0.88],
};
function edgeRGBA(t?: string): readonly [number, number, number, number] {
  return EDGE_RGBA[t ?? "default"] ?? EDGE_RGBA.default;
}

const RISK: Record<string, number> = {
  escalation: 1.00, trap: 0.88, exception_branch: 0.68, exception: 0.68,
  threshold_split: 0.60, threshold: 0.60, test: 0.45, question: 0.38,
  finding: 0.25, mechanism: 0.30, clinical_effect: 0.20, classification: 0.15,
  treatment: 0.10, endpoint: 0.08, entry: 0.05,
};

const NODE_RGBA: Record<string, [number, number, number, number]> = {
  entry:          [0.235, 0.443, 0.996, 1.0],
  question:       [0.537, 0.231, 0.988, 1.0],
  test:           [0.063, 0.651, 0.937, 1.0],
  finding:        [0.573, 0.651, 0.722, 1.0],
  threshold:      [0.961, 0.620, 0.043, 1.0],
  treatment:      [0.133, 0.686, 0.275, 1.0],
  escalation:     [0.937, 0.267, 0.267, 1.0],
  endpoint:       [0.408, 0.459, 0.502, 1.0],
  trap:           [0.984, 0.251, 0.380, 1.0],
  exception:      [0.976, 0.451, 0.086, 1.0],
  mechanism:      [0.663, 0.290, 0.988, 1.0],
  clinical_effect:[0.078, 0.694, 0.651, 1.0],
  classification: [0.388, 0.400, 0.945, 1.0],
};
const DEFAULT_NODE_RGBA: [number, number, number, number] = [0.5, 0.55, 0.62, 1.0];

// ─── GLSL programs ────────────────────────────────────────────────────────────

// ·· Edge (bezier tubes + flow dashes) ·········································
const EDGE_VERT = /* glsl */`#version 300 es
precision highp float;
in vec2  a_pos;
in float a_t;
in float a_side;
in vec4  a_color;
in float a_hi;
uniform vec2 u_res;
out vec4  v_color;
out float v_t;
out float v_side;
out float v_hi;
void main(){
  vec2 ndc=(a_pos/u_res)*2.0-1.0; ndc.y*=-1.0;
  gl_Position=vec4(ndc,0.0,1.0);
  v_color=a_color; v_t=a_t; v_side=a_side; v_hi=a_hi;
}`;

const EDGE_FRAG = /* glsl */`#version 300 es
precision mediump float;
in vec4  v_color;
in float v_t;
in float v_side;
in float v_hi;
uniform float u_time;
out vec4 fragColor;
void main(){
  float aa    = 1.0-smoothstep(0.60,1.0,abs(v_side));
  float phase = fract(v_t*5.0-u_time*0.45);
  float dash  = smoothstep(0.00,0.10,phase)*(1.0-smoothstep(0.50,0.62,phase));
  float flow  = 0.40+0.60*dash;
  float bright= mix(flow,1.0,v_hi*0.75);
  vec4 col=v_color; col.rgb*=bright; col.a*=aa;
  fragColor=col;
}`;

// ·· Heatmap (radial glow per node) ············································
const HEAT_VERT = /* glsl */`#version 300 es
precision highp float;
in vec2  a_pos;
in vec2  a_center;
in float a_risk;
uniform vec2 u_res;
out vec2  v_pos;
out vec2  v_center;
out float v_risk;
void main(){
  v_pos=a_pos; v_center=a_center; v_risk=a_risk;
  vec2 ndc=(a_pos/u_res)*2.0-1.0; ndc.y*=-1.0;
  gl_Position=vec4(ndc,0.0,1.0);
}`;

const HEAT_FRAG = /* glsl */`#version 300 es
precision mediump float;
in vec2  v_pos;
in vec2  v_center;
in float v_risk;
uniform float u_heat_r;
out vec4 fragColor;
void main(){
  float dist=length(v_pos-v_center)/u_heat_r;
  float h=1.0-clamp(dist,0.0,1.0);
  h=h*h*h;
  vec3 cool=vec3(0.18,0.83,0.45);
  vec3 warm=vec3(1.00,0.80,0.10);
  vec3 hot =vec3(0.95,0.22,0.22);
  vec3 col =mix(cool,warm,smoothstep(0.0,0.5,v_risk));
      col =mix(col, hot, smoothstep(0.5,1.0,v_risk));
  fragColor=vec4(col, h*0.14*v_risk);
}`;

// ·· Particles (gl.POINTS sprites) ·············································
const PART_VERT = /* glsl */`#version 300 es
precision highp float;
in vec2  a_pos;
in vec4  a_color;
in float a_size;
uniform vec2 u_res;
out vec4 v_color;
void main(){
  vec2 ndc=(a_pos/u_res)*2.0-1.0; ndc.y*=-1.0;
  gl_Position=vec4(ndc,0.0,1.0);
  gl_PointSize=a_size;
  v_color=a_color;
}`;

const PART_FRAG = /* glsl */`#version 300 es
precision mediump float;
in vec4 v_color;
out vec4 fragColor;
void main(){
  vec2 pc=gl_PointCoord-0.5;
  float d=dot(pc,pc)*4.0;
  float alpha=(1.0-d)*(1.0-d)*v_color.a;
  if(alpha<0.01) discard;
  fragColor=vec4(v_color.rgb,alpha);
}`;

// ·· DOF post-process (16-sample circular bokeh, FBO round-trip) ···············
const DOF_VERT = /* glsl */`#version 300 es
precision highp float;
void main(){
  // Fullscreen triangle — no VBO, driven by gl_VertexID
  float x=float((gl_VertexID&1)*4-1);
  float y=float(((gl_VertexID>>1)&1)*4-1);
  gl_Position=vec4(x,y,0.0,1.0);
}`;

const DOF_FRAG = /* glsl */`#version 300 es
precision mediump float;
uniform sampler2D u_scene;
uniform vec2      u_res;
uniform vec2      u_focus_uv;
uniform float     u_strength;
out vec4 fragColor;
const int N=16;
const vec2 DISK[16]=vec2[16](
  vec2( 0.000, 0.000),vec2( 0.541, 0.000),
  vec2( 0.383, 0.383),vec2( 0.000, 0.541),
  vec2(-0.383, 0.383),vec2(-0.541, 0.000),
  vec2(-0.383,-0.383),vec2( 0.000,-0.541),
  vec2( 0.383,-0.383),vec2( 0.271, 0.469),
  vec2(-0.271, 0.469),vec2(-0.469, 0.271),
  vec2(-0.469,-0.271),vec2(-0.271,-0.469),
  vec2( 0.271,-0.469),vec2( 0.469,-0.271)
);
void main(){
  vec2 uv=gl_FragCoord.xy/u_res;
  float dist=length(uv-u_focus_uv);
  float blur=smoothstep(0.08,0.65,dist)*u_strength;
  float maxR=14.0/max(u_res.x,u_res.y);
  float blurR=blur*maxR;
  vec4  col=vec4(0.0); float total=0.0;
  for(int i=0;i<N;i++){
    float w=1.0-length(DISK[i]);
    col+=texture(u_scene,uv+DISK[i]*blurR)*w;
    total+=w;
  }
  col/=total;
  float g=fract(sin(dot(uv*1000.0,vec2(12.9898,78.233)))*43758.5453);
  col.rgb+=(g-0.5)*0.010;
  fragColor=col;
}`;

// ·· LOD node quads (simple coloured rects replacing DOM cards) ················
const SIM_VERT = /* glsl */`#version 300 es
precision highp float;
in vec2 a_pos;
in vec4 a_color;
uniform vec2 u_res;
out vec4 v_color;
void main(){
  vec2 ndc=(a_pos/u_res)*2.0-1.0; ndc.y*=-1.0;
  gl_Position=vec4(ndc,0.0,1.0);
  v_color=a_color;
}`;

const SIM_FRAG = /* glsl */`#version 300 es
precision mediump float;
in vec4 v_color;
out vec4 fragColor;
void main(){ fragColor=v_color; }`;

// ─── Types ────────────────────────────────────────────────────────────────────

type P2 = [number, number];

interface Particle { edgeIdx: number; t: number; speed: number; }

interface FBO { fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number; }

type AttrDef = { name: string; size: number; offset: number };

// ─── Geometry builders ────────────────────────────────────────────────────────

function cubicBez(p0: P2, p1: P2, p2: P2, p3: P2, t: number): P2 {
  const u = 1 - t;
  return [
    u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0],
    u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1],
  ];
}
function perpNorm(a: P2, b: P2): P2 {
  const dx=b[0]-a[0], dy=b[1]-a[1], l=Math.hypot(dx,dy)||1;
  return [-dy/l, dx/l];
}
function unitDir(a: P2, b: P2): P2 {
  const dx=b[0]-a[0], dy=b[1]-a[1], l=Math.hypot(dx,dy)||1;
  return [dx/l, dy/l];
}

function evalBezierEdge(le: LayoutEdge, t: number): P2 {
  const {fromPos: f, toPos: to} = le;
  const dy = Math.abs(to.y - f.y);
  const cp = Math.max(40, dy / 2);
  return cubicBez([f.x,f.y],[f.x,f.y+cp],[to.x,to.y-cp],[to.x,to.y], t);
}

// Edge stride = 9: [x, y, t, side, r, g, b, a, hi]
const ES = 9;

function buildEdgeBuffers(
  edges: LayoutEdge[],
  selected: string | null,
  visited: Set<string>,
  zoom: number,
  ancestorSet?: Set<string>,
  nextSet?: Set<string>,
): { stripData: Float32Array; arrowData: Float32Array } {
  const strip: number[] = [];
  const arrow: number[] = [];

  for (let ei = 0; ei < edges.length; ei++) {
    const le = edges[ei];
    const { edge, fromPos: f, toPos: to } = le;
    const [er, eg, eb, baseA] = edgeRGBA(edge.edgeType) as [number,number,number,number];

    // F2: next-decision edge leaves selected node toward an outgoing neighbor
    const isNext = selected !== null && edge.from === selected && (nextSet?.has(edge.to) ?? false);
    // F1: ancestor-path edge — both endpoints on the clinical path to selected
    const isPath = !isNext && (ancestorSet?.size ?? 0) > 0
                 && (ancestorSet?.has(edge.from) ?? false)
                 && (ancestorSet?.has(edge.to) ?? false);

    const isHi  = selected === edge.from || selected === edge.to
                || visited.has(edge.from) || visited.has(edge.to)
                || isPath || isNext;
    const dimmed = selected !== null && !isHi;
    const alpha  = dimmed ? Math.max(baseA * 0.42, 0.34) : baseA;
    const hi     = isHi ? 1.0 : 0.0;

    // F2: next-decision edges get an emerald tint to signal "what to decide next"
    // F1: ancestor-path edges get a subtle sky-blue tint to trace the clinical path
    let r = er, g = eg, b = eb;
    if (isNext) {
      r = er * 0.15 + 0.04;
      g = Math.min(eg * 0.20 + 0.68, 0.95);
      b = eb * 0.15 + 0.12;
    } else if (isPath) {
      r = er * 0.20 + 0.05;
      g = Math.min(eg * 0.30 + 0.42, 0.80);
      b = Math.min(eb * 0.30 + 0.52, 0.95);
    }

    const screenScale = Math.max(0.25, zoom);
    const hw = (isNext ? HALF_THICK * 2.0 : isPath ? HALF_THICK * 1.65 : isHi ? HALF_THICK * 1.55 : HALF_THICK) / screenScale;

    const dy = Math.abs(to.y - f.y);
    const cp = Math.max(40, dy / 2);
    const p0: P2=[f.x,f.y], p1: P2=[f.x,f.y+cp], p2: P2=[to.x,to.y-cp], p3: P2=[to.x,to.y];
    const pts: P2[] = Array.from({length: CURVE_SAMPLES+1}, (_,i) =>
      cubicBez(p0,p1,p2,p3, i/CURVE_SAMPLES));

    // Degenerate triangle to break strip between edges
    if (ei > 0 && strip.length > 0) {
      strip.push(...strip.slice(-ES));
      const n0 = perpNorm(pts[0], pts[1]);
      strip.push(pts[0][0]-n0[0]*hw, pts[0][1]-n0[1]*hw, 0,-1,r,g,b,alpha,hi);
    }

    for (let i = 0; i <= CURVE_SAMPLES; i++) {
      const t = i / CURVE_SAMPLES;
      const p = pts[i];
      const n = i < CURVE_SAMPLES ? perpNorm(pts[i],pts[i+1]) : perpNorm(pts[i-1],pts[i]);
      strip.push(p[0]-n[0]*hw, p[1]-n[1]*hw, t,-1,r,g,b,alpha,hi);
      strip.push(p[0]+n[0]*hw, p[1]+n[1]*hw, t,+1,r,g,b,alpha,hi);
    }

    // Arrowhead
    const endPt  = pts[CURVE_SAMPLES];
    const prevPt = pts[CURVE_SAMPLES-1];
    const [atx,aty] = unitDir(prevPt,endPt);
    const [anx,any] = [-aty,atx];
    const tip:  P2 = [endPt[0],               endPt[1]];
    const arrowLen = ARROW_LEN / screenScale;
    const arrowHw  = ARROW_HW / screenScale;
    const aL:   P2 = [endPt[0]-atx*arrowLen-anx*arrowHw, endPt[1]-aty*arrowLen-any*arrowHw];
    const aR:   P2 = [endPt[0]-atx*arrowLen+anx*arrowHw, endPt[1]-aty*arrowLen+any*arrowHw];
    const aA    = dimmed ? 0.32 : Math.min(baseA*1.05,1.0);
    for (const [px,py] of [tip,aL,aR] as P2[])
      arrow.push(px,py,1.0,0.0,r,g,b,aA,hi);
  }

  return { stripData: new Float32Array(strip), arrowData: new Float32Array(arrow) };
}

// Heat stride = 5: [x, y, cx, cy, risk]
const HS = 5;

// F6: educational heat overrides node risk using trap count, testable point, checkpoint linkage
function buildHeatGeo(nodes: LayoutNode[], eduHeatOverride?: Map<string, number>, zoom = 1): Float32Array {
  const data: number[] = [];
  const screenScale = Math.max(0.25, zoom);
  for (const ln of nodes) {
    const risk = eduHeatOverride?.get(ln.node.nodeId) ?? RISK[ln.node.nodeType] ?? 0.15;
    if (risk < 0.05) continue;
    const cx = ln.x + NODE_W/2, cy = ln.y + NODE_H/2;
    const r = HEAT_RADIUS / screenScale;
    const x0=cx-r, y0=cy-r, x1=cx+r, y1=cy+r;
    for (const [px,py] of [[x0,y0],[x1,y0],[x0,y1],[x1,y0],[x1,y1],[x0,y1]] as P2[])
      data.push(px,py,cx,cy,risk);
  }
  return new Float32Array(data);
}

// LOD stride = 6: [x, y, r, g, b, a]
const LS = 6;

function buildLODGeo(nodes: LayoutNode[]): Float32Array {
  const data: number[] = [];
  for (const ln of nodes) {
    const [r,g,b] = NODE_RGBA[ln.node.nodeType] ?? DEFAULT_NODE_RGBA;
    const x0=ln.x, y0=ln.y, x1=ln.x+NODE_W, y1=ln.y+NODE_H;
    // Card body (clear study tint for low-zoom overview)
    const br=r*0.22+0.78, bg=g*0.22+0.78, bb=b*0.22+0.78;
    for (const [px,py] of [[x0,y0],[x1,y0],[x0,y1],[x1,y0],[x1,y1],[x0,y1]] as P2[])
      data.push(px,py,br,bg,bb,0.98);
    // Top stripe (3 CSS px)
    const sy1 = y0+3;
    for (const [px,py] of [[x0,y0],[x1,y0],[x0,sy1],[x1,y0],[x1,sy1],[x0,sy1]] as P2[])
      data.push(px,py,r,g,b,1.0);
  }
  return new Float32Array(data);
}

// Particle stride = 7: [x, y, r, g, b, a, size]
const PS = 7;

function initParticles(edgeCount: number): Particle[] {
  const ps: Particle[] = [];
  for (let e = 0; e < edgeCount; e++)
    for (let p = 0; p < PARTICLES_PER_EDGE; p++)
      ps.push({ edgeIdx: e, t: p / PARTICLES_PER_EDGE, speed: 0.18 + Math.random() * 0.14 });
  return ps;
}

function stepParticles(ps: Particle[], dt: number): void {
  for (const p of ps) p.t = (p.t + p.speed * dt) % 1.0;
}

function buildParticleGeo(ps: Particle[], edges: LayoutEdge[], zoom = 1): Float32Array {
  const data: number[] = [];
  const screenScale = Math.max(0.25, zoom);
  for (const p of ps) {
    const le = edges[p.edgeIdx];
    if (!le) continue;
    const [x,y] = evalBezierEdge(le, p.t);
    const [r,g,b] = edgeRGBA(le.edge.edgeType) as [number,number,number,number];
    data.push(x, y, Math.min(r*1.15,1), Math.min(g*1.15,1), Math.min(b*1.15,1), 0.42, 3.0 / screenScale);
  }
  return new Float32Array(data);
}

// ─── WebGL helpers ────────────────────────────────────────────────────────────

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) ?? "shader compile error";
    gl.deleteShader(sh);
    throw new Error(log);
  }
  return sh;
}

function linkProgram(gl: WebGL2RenderingContext, vSrc: string, fSrc: string): WebGLProgram {
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER,   vSrc));
  gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, fSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog) ?? "program link error";
    gl.deleteProgram(prog);
    throw new Error(log);
  }
  return prog;
}

function makeVAO(
  gl: WebGL2RenderingContext,
  prog: WebGLProgram,
  buf: WebGLBuffer,
  stride: number,
  attrs: AttrDef[],
): WebGLVertexArrayObject {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  for (const { name, size, offset } of attrs) {
    const loc = gl.getAttribLocation(prog, name);
    if (loc < 0) continue;
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride*4, offset*4);
  }
  gl.bindVertexArray(null);
  return vao;
}

function mkFBO(gl: WebGL2RenderingContext, w: number, h: number): FBO {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return { fb, tex, w, h };
}

function resizeFBO(gl: WebGL2RenderingContext, fbo: FBO, w: number, h: number): FBO {
  if (fbo.w === w && fbo.h === h) return fbo;
  gl.deleteFramebuffer(fbo.fb);
  gl.deleteTexture(fbo.tex);
  return mkFBO(gl, w, h);
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface OutlinerWebGLCanvasProps {
  layoutEdges:  LayoutEdge[];
  layoutNodes:  LayoutNode[];
  canvasWidth:  number;
  canvasHeight: number;
  selectedNodeId: string | null;
  visitedPath:  string[];
  zoom:         number;
  onFallback:   () => void;
  // Clinical Cognition Layer — all optional so existing callers are unaffected
  ancestorPath?: string[];          // F1: node IDs on clinical path from root → selected
  nextNodeIds?:  string[];          // F2: outgoing neighbors of selected (next decisions)
  eduHeat?:      Map<string, number>; // F6: educational heat override per nodeId (0-1)
}

export function OutlinerWebGLCanvas({
  layoutEdges,
  layoutNodes,
  canvasWidth,
  canvasHeight,
  selectedNodeId,
  visitedPath,
  zoom,
  onFallback,
  ancestorPath,
  nextNodeIds,
  eduHeat,
}: OutlinerWebGLCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef     = useRef<WebGL2RenderingContext | null>(null);

  // Programs
  const edgeProgRef = useRef<WebGLProgram | null>(null);
  const heatProgRef = useRef<WebGLProgram | null>(null);
  const partProgRef = useRef<WebGLProgram | null>(null);
  const dofProgRef  = useRef<WebGLProgram | null>(null);
  const simProgRef  = useRef<WebGLProgram | null>(null);

  // Buffers + VAOs
  const eStripBuf = useRef<WebGLBuffer | null>(null);
  const eArrowBuf = useRef<WebGLBuffer | null>(null);
  const heatBuf   = useRef<WebGLBuffer | null>(null);
  const partBuf   = useRef<WebGLBuffer | null>(null);
  const simBuf    = useRef<WebGLBuffer | null>(null);
  const eStripVAO = useRef<WebGLVertexArrayObject | null>(null);
  const eArrowVAO = useRef<WebGLVertexArrayObject | null>(null);
  const heatVAO   = useRef<WebGLVertexArrayObject | null>(null);
  const partVAO   = useRef<WebGLVertexArrayObject | null>(null);
  const simVAO    = useRef<WebGLVertexArrayObject | null>(null);

  // FBO for DOF pass
  const fboRef = useRef<FBO | null>(null);

  // Render-loop counters (vertex counts, not byte counts)
  const eStripLen = useRef(0);
  const eArrowLen = useRef(0);
  const heatLen   = useRef(0);
  const simLen    = useRef(0);
  const partLen   = useRef(0);

  // Timing + particles
  const rafRef      = useRef(0);
  const t0Ref       = useRef(performance.now());
  const prevTRef    = useRef(performance.now());
  const particleRef = useRef<Particle[]>([]);

  // Props mirrored into refs — draw loop reads these without re-triggering effects
  const edgesRef    = useRef(layoutEdges);
  const nodesRef    = useRef(layoutNodes);
  const selectedRef = useRef(selectedNodeId);
  const zoomRef     = useRef(zoom);
  const cssWRef     = useRef(canvasWidth);
  const cssHRef     = useRef(canvasHeight);

  edgesRef.current    = layoutEdges;
  nodesRef.current    = layoutNodes;
  selectedRef.current = selectedNodeId;
  zoomRef.current     = zoom;
  cssWRef.current     = canvasWidth;
  cssHRef.current     = canvasHeight;

  const fallback = useCallback(() => onFallback(), [onFallback]);

  // ── Init effect: compile all programs, create all buffers ───────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("webgl2", {
      antialias: true, alpha: true, premultipliedAlpha: true,
    });
    if (!ctx) { fallback(); return; }

    try {
      const ep = linkProgram(ctx, EDGE_VERT, EDGE_FRAG);
      const hp = linkProgram(ctx, HEAT_VERT, HEAT_FRAG);
      const pp = linkProgram(ctx, PART_VERT, PART_FRAG);
      const dp = linkProgram(ctx, DOF_VERT,  DOF_FRAG);
      const sp = linkProgram(ctx, SIM_VERT,  SIM_FRAG);

      const sb = ctx.createBuffer()!, ab = ctx.createBuffer()!;
      const hb = ctx.createBuffer()!, pb = ctx.createBuffer()!;
      const lb = ctx.createBuffer()!;

      glRef.current      = ctx;
      edgeProgRef.current = ep; heatProgRef.current = hp;
      partProgRef.current = pp; dofProgRef.current  = dp; simProgRef.current = sp;
      eStripBuf.current = sb; eArrowBuf.current = ab;
      heatBuf.current   = hb; partBuf.current   = pb; simBuf.current = lb;

      const edgeAttrs: AttrDef[] = [
        { name:"a_pos",   size:2, offset:0 },
        { name:"a_t",     size:1, offset:2 },
        { name:"a_side",  size:1, offset:3 },
        { name:"a_color", size:4, offset:4 },
        { name:"a_hi",    size:1, offset:8 },
      ];
      eStripVAO.current = makeVAO(ctx, ep, sb, ES, edgeAttrs);
      eArrowVAO.current = makeVAO(ctx, ep, ab, ES, edgeAttrs);

      heatVAO.current = makeVAO(ctx, hp, hb, HS, [
        { name:"a_pos",    size:2, offset:0 },
        { name:"a_center", size:2, offset:2 },
        { name:"a_risk",   size:1, offset:4 },
      ]);

      partVAO.current = makeVAO(ctx, pp, pb, PS, [
        { name:"a_pos",   size:2, offset:0 },
        { name:"a_color", size:4, offset:2 },
        { name:"a_size",  size:1, offset:6 },
      ]);

      simVAO.current = makeVAO(ctx, sp, lb, LS, [
        { name:"a_pos",   size:2, offset:0 },
        { name:"a_color", size:4, offset:2 },
      ]);
    } catch (err) {
      console.warn("[OutlinerWebGLCanvas] init failed, SVG fallback:", err);
      fallback();
      return;
    }

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(rafRef.current);
      fallback();
    };
    canvas.addEventListener("webglcontextlost", handleContextLost);

    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      cancelAnimationFrame(rafRef.current);
      const g = glRef.current;
      if (!g) return;
      for (const r of [edgeProgRef, heatProgRef, partProgRef, dofProgRef, simProgRef])
        g.deleteProgram(r.current);
      for (const r of [eStripBuf, eArrowBuf, heatBuf, partBuf, simBuf])
        g.deleteBuffer(r.current);
      for (const r of [eStripVAO, eArrowVAO, heatVAO, partVAO, simVAO])
        g.deleteVertexArray(r.current);
      if (fboRef.current) { g.deleteFramebuffer(fboRef.current.fb); g.deleteTexture(fboRef.current.tex); }
      glRef.current = null;
    };
  }, [fallback]);

  // ── Data effect: rebuild static geometry + (re)start RAF loop ───────────────
  useEffect(() => {
    const gl = glRef.current;
    if (!gl || !eStripVAO.current || !edgeProgRef.current) return;

    const visited     = new Set(visitedPath);
    const ancestorSet = new Set(ancestorPath ?? []);
    const nextSet     = new Set(nextNodeIds  ?? []);

    // Edge geometry — F1/F2: pass ancestor and next-decision sets for visual emphasis
    const { stripData, arrowData } = buildEdgeBuffers(layoutEdges, selectedNodeId, visited, zoom, ancestorSet, nextSet);
    gl.bindBuffer(gl.ARRAY_BUFFER, eStripBuf.current);
    gl.bufferData(gl.ARRAY_BUFFER, stripData, gl.DYNAMIC_DRAW);
    eStripLen.current = stripData.length / ES;
    gl.bindBuffer(gl.ARRAY_BUFFER, eArrowBuf.current);
    gl.bufferData(gl.ARRAY_BUFFER, arrowData, gl.DYNAMIC_DRAW);
    eArrowLen.current = arrowData.length / ES;

    // Heat geometry — F6: educational heat boosts trap/testable nodes above baseline risk
    const hData = buildHeatGeo(layoutNodes, eduHeat, zoom);
    gl.bindBuffer(gl.ARRAY_BUFFER, heatBuf.current);
    gl.bufferData(gl.ARRAY_BUFFER, hData, gl.STATIC_DRAW);
    heatLen.current = hData.length / HS;

    // LOD geometry (static per layout)
    const lData = buildLODGeo(layoutNodes);
    gl.bindBuffer(gl.ARRAY_BUFFER, simBuf.current);
    gl.bufferData(gl.ARRAY_BUFFER, lData, gl.STATIC_DRAW);
    simLen.current = lData.length / LS;

    // Particles: re-init on edge layout change
    particleRef.current = initParticles(layoutEdges.length);
    const initPGeo = buildParticleGeo(particleRef.current, layoutEdges, zoom);
    gl.bindBuffer(gl.ARRAY_BUFFER, partBuf.current);
    gl.bufferData(gl.ARRAY_BUFFER, initPGeo, gl.DYNAMIC_DRAW);
    partLen.current = initPGeo.length / PS;

    // Cache uniform locations once per data rebuild
    const ep = edgeProgRef.current!;
    const hp = heatProgRef.current!;
    const pp = partProgRef.current!;
    const dp = dofProgRef.current!;
    const sp = simProgRef.current!;

    const uERes    = gl.getUniformLocation(ep, "u_res");
    const uETime   = gl.getUniformLocation(ep, "u_time");
    const uHRes    = gl.getUniformLocation(hp, "u_res");
    const uHHeatR  = gl.getUniformLocation(hp, "u_heat_r");
    const uPRes    = gl.getUniformLocation(pp, "u_res");
    const uDScene  = gl.getUniformLocation(dp, "u_scene");
    const uDRes    = gl.getUniformLocation(dp, "u_res");
    const uDFocus  = gl.getUniformLocation(dp, "u_focus_uv");
    const uDStr    = gl.getUniformLocation(dp, "u_strength");
    const uSRes    = gl.getUniformLocation(sp, "u_res");

    const canvas = canvasRef.current!;
    cancelAnimationFrame(rafRef.current);
    prevTRef.current = performance.now();

    function draw() {
      const g = glRef.current;
      if (!g) return;

      // Resize canvas to match CSS size × devicePixelRatio
      const dpr = Math.round(window.devicePixelRatio || 1);
      const cssW = cssWRef.current, cssH = cssHRef.current;
      const pw = Math.round(cssW * dpr), ph = Math.round(cssH * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw; canvas.height = ph;
      }

      const now = performance.now();
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const elapsed = reduceMotion ? 0 : (now - t0Ref.current) / 1000;
      const dt      = reduceMotion ? 0 : Math.min((now - prevTRef.current) / 1000, 0.1);
      prevTRef.current = now;

      // Step particles + upload (skip when reduced-motion)
      if (!reduceMotion) {
        stepParticles(particleRef.current, dt);
        const pGeo = buildParticleGeo(particleRef.current, edgesRef.current, zoomRef.current);
        if (partBuf.current) {
          g.bindBuffer(g.ARRAY_BUFFER, partBuf.current);
          g.bufferSubData(g.ARRAY_BUFFER, 0, pGeo);
          partLen.current = pGeo.length / PS;
        }
      }

      const sel     = selectedRef.current;
      // Study Clarity Mode keeps focus educational: rings and edge cues, never blur.
      const useDOF  = false;
      const lodMode = zoomRef.current < LOD_THRESHOLD;

      // Bind FBO when DOF is active, else render directly
      if (useDOF) {
        fboRef.current = resizeFBO(g, fboRef.current ?? mkFBO(g, pw, ph), pw, ph);
        g.bindFramebuffer(g.FRAMEBUFFER, fboRef.current.fb);
      } else {
        g.bindFramebuffer(g.FRAMEBUFFER, null);
      }

      g.viewport(0, 0, pw, ph);
      g.clearColor(0, 0, 0, 0);
      g.clear(g.COLOR_BUFFER_BIT);
      g.enable(g.BLEND);

      // ── Pass 1: Heatmap (additive glow) ─────────────────────────────────────
      // blendFuncSeparate: RGB additive (glow accumulation), Alpha additive
      // → canvas stores premultiplied RGBA; browser composites correctly with premultipliedAlpha:true
      if (heatLen.current > 0) {
        g.blendFuncSeparate(g.SRC_ALPHA, g.ONE, g.ONE, g.ONE);
        g.useProgram(hp);
        g.uniform2f(uHRes, cssW, cssH);
        g.uniform1f(uHHeatR, HEAT_RADIUS / Math.max(0.25, zoomRef.current));
        g.bindVertexArray(heatVAO.current);
        g.drawArrays(g.TRIANGLES, 0, heatLen.current);
      }

      // ── Pass 2: Edge tubes (normal alpha blend) ──────────────────────────────
      // RGB: over-composite onto heatmap glow; Alpha: accumulates correctly (not squared)
      g.blendFuncSeparate(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA, g.ONE, g.ONE_MINUS_SRC_ALPHA);
      g.useProgram(ep);
      g.uniform2f(uERes, cssW, cssH);
      g.uniform1f(uETime, elapsed);
      if (eStripLen.current > 0) {
        g.bindVertexArray(eStripVAO.current);
        g.drawArrays(g.TRIANGLE_STRIP, 0, eStripLen.current);
      }
      if (eArrowLen.current > 0) {
        g.bindVertexArray(eArrowVAO.current);
        g.drawArrays(g.TRIANGLES, 0, eArrowLen.current);
      }

      // ── Pass 3: Particles (additive sparkle) ─────────────────────────────────
      // Same as heatmap: additive RGB glow, additive alpha accumulation
      if (!reduceMotion && partLen.current > 0) {
        g.blendFuncSeparate(g.SRC_ALPHA, g.ONE, g.ONE, g.ONE);
        g.useProgram(pp);
        g.uniform2f(uPRes, cssW, cssH);
        g.bindVertexArray(partVAO.current);
        g.drawArrays(g.POINTS, 0, partLen.current);
      }

      // ── Pass 4: LOD node quads (normal alpha blend) ──────────────────────────
      // Same as edges: correct premultiplied over-compositing
      if (lodMode && simLen.current > 0) {
        g.blendFuncSeparate(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA, g.ONE, g.ONE_MINUS_SRC_ALPHA);
        g.useProgram(sp);
        g.uniform2f(uSRes, cssW, cssH);
        g.bindVertexArray(simVAO.current);
        g.drawArrays(g.TRIANGLES, 0, simLen.current);
      }

      g.bindVertexArray(null);

      // ── Pass 5: DOF post-process ─────────────────────────────────────────────
      if (useDOF && fboRef.current) {
        g.bindFramebuffer(g.FRAMEBUFFER, null);
        g.viewport(0, 0, pw, ph);
        g.clearColor(0, 0, 0, 0);
        g.clear(g.COLOR_BUFFER_BIT);
        g.blendFunc(g.ONE, g.ZERO); // replace — DOF output is final

        // Focus UV: CSS node centre → FBO texture UV (Y flipped for GL convention)
        const selNode = nodesRef.current.find(ln => ln.node.nodeId === sel);
        const focusU  = selNode ? (selNode.x + NODE_W/2) / cssW       : 0.5;
        const focusV  = selNode ? 1 - (selNode.y + NODE_H/2) / cssH   : 0.5;

        g.useProgram(dp);
        g.activeTexture(g.TEXTURE0);
        g.bindTexture(g.TEXTURE_2D, fboRef.current.tex);
        g.uniform1i(uDScene, 0);
        g.uniform2f(uDRes,   pw, ph);
        g.uniform2f(uDFocus, focusU, focusV);
        g.uniform1f(uDStr,   1.0);
        g.drawArrays(g.TRIANGLES, 0, 3);   // fullscreen triangle, no VAO needed
        g.bindTexture(g.TEXTURE_2D, null);
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [layoutEdges, layoutNodes, selectedNodeId, visitedPath, canvasWidth, canvasHeight, zoom, ancestorPath, nextNodeIds, eduHeat]);

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
        // zIndex 0: sits above the dot-grid background but below DOM node cards
        // (cards have no explicit z-index and come later in the DOM → they paint on top)
        zIndex: 0,
      }}
    />
  );
}

export { LOD_THRESHOLD };
