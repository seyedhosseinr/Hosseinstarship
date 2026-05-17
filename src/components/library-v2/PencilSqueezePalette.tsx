"use client";

/**
 * PencilSqueezePalette — GoodNotes 6-style radial crescent tool palette.
 *
 * ─── Trigger contract ───────────────────────────────────────────────────────
 * This component is rendered ONLY when ChapterReaderV2 receives the
 * "starship:pencil-squeeze" CustomEvent from a verified native iOS bridge.
 *
 * No PointerEvent, button value, long-press, touch-hold, or toolbar action
 * is allowed to open this palette.
 * Native Apple Pencil Pro squeeze requires an iOS/WKWebView bridge —
 * see ios/StarshipPencilBridge.swift.
 *
 * ─── Visual design ──────────────────────────────────────────────────────────
 * Reference: GoodNotes 6 on iPad Pro + Apple Pencil Pro.
 * • White crescent band fans from lower-left to upper-left of the pencil tip.
 * • Active tool sits in a raised colored bubble on the arc.
 * • Spring-in animation originates from the pencil tip position.
 * • Layered drop shadows lift the palette off the canvas.
 * • Color swatches and undo trail off at the upper end.
 * • Arc mirrors for left-side tips (right-handed assumption by default).
 */

import { useLayoutEffect, useState } from "react";
import type { AnnotationTool } from "./ChapterReaderV2";
import { Circle, Eraser, Highlighter, MousePointer2, Pen, Undo2 } from "lucide-react";

// ── Palette tools ────────────────────────────────────────────────────────────

type PaletteEntry = {
  id: AnnotationTool;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: React.ComponentType<any>;
};

const PALETTE_TOOLS: PaletteEntry[] = [
  { id: "pen",         label: "قلم",      Icon: Pen          },
  { id: "highlighter", label: "هایلایتر",  Icon: Highlighter  },
  { id: "eraser",      label: "پاک‌کن",    Icon: Eraser       },
  { id: "cursor",      label: "انتخاب",    Icon: MousePointer2 },
  { id: "circle",      label: "شکل",      Icon: Circle       },
];

const PALETTE_COLORS = [
  { value: "#D4B106", label: "زرد"    },
  { value: "#4B9BFF", label: "آبی"    },
  { value: "#57B26A", label: "سبز"    },
  { value: "#D96AA0", label: "صورتی" },
] as const;

// ── Arc geometry ─────────────────────────────────────────────────────────────
//
// SVG coordinate system: 0°=right, 90°=down, 180°=left, 270°=up (y-axis ↓).
//
// Default orientation (right-hand, tip on right side of screen):
//   CW from 148° (lower-left of tip) to 295° (near-top).
//   Layout sections:
//     148° – 215°  : 5 tool buttons
//     237°          : undo
//     253° – 281°  : 4 color swatches
//
// Left-side mirror (tip on left side of screen):
//   Each angle θ reflects as (180° − θ), and the sweep becomes CCW.
//   cos(180°-θ) = -cos(θ)  →  x-component flips.
//   sin(180°-θ) =  sin(θ)  →  y-component unchanged.
//   This produces a right-side fan symmetric to the left-side fan.

const ARC_R = 155;   // radius from tip to crescent centreline  (px)
const ARC_W = 64;    // crescent stroke width / band thickness  (px)

// Canonical (CW, right-side) angle landmarks:
const DEG = {
  start:       148,  // first tool (pen) – nearest to pencil tip
  toolEnd:     215,  // last tool  (circle)
  undo:        237,  // undo action
  colorStart:  254,  // first color swatch
  colorStep:    14,  // degrees between swatches
  end:         296,  // crescent tail end
} as const;

const BTN = 50;   // tool & undo button bounding square (px)
const DOT = 26;   // color swatch diameter               (px)

// ── Math helpers ─────────────────────────────────────────────────────────────

function d2r(deg: number) { return (deg * Math.PI) / 180; }

function polar(cx: number, cy: number, r: number, deg: number) {
  // cos/sin handle any angle including negative (wraps automatically)
  return { x: cx + Math.cos(d2r(deg)) * r, y: cy + Math.sin(d2r(deg)) * r };
}

/**
 * Reflect an angle horizontally (180° - θ).
 * Used to mirror the arc for left-side tips.
 */
function mirror(deg: number) { return 180 - deg; }

/**
 * CW arc span in degrees from `from` to `to` (always positive, 0–360).
 * Used to set the SVG large-arc-flag correctly.
 */
function cwSpan(from: number, to: number) {
  return ((to - from) % 360 + 360) % 360;
}

/**
 * Build an SVG arc path string.
 * @param cw true → clockwise (sweep-flag 1), false → counter-clockwise (0)
 */
function svgArcPath(
  cx: number, cy: number, r: number,
  startDeg: number, endDeg: number, cw: boolean,
): string {
  const { x: sx, y: sy } = polar(cx, cy, r, startDeg);
  const { x: ex, y: ey } = polar(cx, cy, r, endDeg);
  const span = cw ? cwSpan(startDeg, endDeg) : cwSpan(endDeg, startDeg);
  const large = span > 180 ? 1 : 0;
  const sweep = cw ? 1 : 0;
  return (
    `M ${sx.toFixed(2)} ${sy.toFixed(2)} ` +
    `A ${r} ${r} 0 ${large} ${sweep} ${ex.toFixed(2)} ${ey.toFixed(2)}`
  );
}

/** Return the tool position angle for normalised t ∈ [0,1]. */
function toolDeg(t: number, cw: boolean): number {
  const canonical = DEG.start + (DEG.toolEnd - DEG.start) * t;
  return cw ? canonical : mirror(canonical);
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface PencilSqueezePaletteProps {
  /** Viewport X of the Apple Pencil tip at the moment of squeeze. */
  tipX: number;
  /** Viewport Y of the Apple Pencil tip at the moment of squeeze. */
  tipY: number;
  activeTool: AnnotationTool;
  activeColor: string;
  onSelectTool: (t: AnnotationTool) => void;
  onSelectColor: (c: string) => void;
  onUndo: () => void;
  onClose: () => void;
}

export function PencilSqueezePalette({
  tipX,
  tipY,
  activeTool,
  activeColor,
  onSelectTool,
  onSelectColor,
  onUndo,
  onClose,
}: PencilSqueezePaletteProps) {

  // ── Spring-in mount animation ─────────────────────────────────────────────
  // Scale from the pencil tip position, spring easing (overshoot + settle).
  const [mounted, setMounted] = useState(false);
  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // ── Arc orientation: mirror for left-side tips ────────────────────────────
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const cw = tipX >= vw * 0.40; // CW for right side, CCW (mirrored) for left

  // ── Compute positions ─────────────────────────────────────────────────────
  const nTools = PALETTE_TOOLS.length;

  const toolItems = PALETTE_TOOLS.map((tool, i) => {
    const t = nTools > 1 ? i / (nTools - 1) : 0.5;
    const deg = toolDeg(t, cw);
    return {
      ...tool,
      ...polar(tipX, tipY, ARC_R, deg),
      isActive: tool.id === activeTool,
      // stagger delay for spring sequence (nearest tool appears first)
      delay: i * 18,
    };
  });

  const undoDeg = cw ? DEG.undo : mirror(DEG.undo);
  const undoPos = polar(tipX, tipY, ARC_R, undoDeg);

  const colorItems = PALETTE_COLORS.map((c, i) => {
    const deg = cw
      ? DEG.colorStart + i * DEG.colorStep
      : mirror(DEG.colorStart + i * DEG.colorStep);
    return { ...c, ...polar(tipX, tipY, ARC_R, deg), isActive: c.value === activeColor };
  });

  // ── Crescent SVG path ─────────────────────────────────────────────────────
  const arcStart = cw ? DEG.start : mirror(DEG.start);
  const arcEnd   = cw ? DEG.end   : mirror(DEG.end);
  const crescent = svgArcPath(tipX, tipY, ARC_R, arcStart, arcEnd, cw);

  // ── Spring transform anchored at the pencil tip ───────────────────────────
  const springStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 200,
    pointerEvents: "none",
    opacity: mounted ? 1 : 0,
    transform: mounted ? "scale(1)" : "scale(0.25)",
    transformOrigin: `${tipX}px ${tipY}px`,
    // cubic-bezier: slight overshoot for GoodNotes feel
    transition: mounted
      ? "opacity 0.18s ease-out, transform 0.38s cubic-bezier(0.175,0.885,0.32,1.275)"
      : "none",
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div data-pencil-squeeze-palette="1" style={springStyle}>

      {/* Full-screen dismiss layer */}
      <div
        style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}
        onPointerDown={onClose}
      />

      {/* ── SVG: crescent + active bubble + tip dot ── */}
      <svg
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          overflow: "visible",
          pointerEvents: "none",
        }}
      >
        <defs>
          {/* Layered elevation shadow — outer soft + inner crisp */}
          <filter id="psp-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="8"  stdDeviation="18" floodColor="#000" floodOpacity="0.12" />
            <feDropShadow dx="0" dy="2"  stdDeviation="4"  floodColor="#000" floodOpacity="0.14" />
            <feDropShadow dx="0" dy="0"  stdDeviation="1"  floodColor="#000" floodOpacity="0.08" />
          </filter>

          {/* Colored glow for active tool bubble */}
          <filter id="psp-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feDropShadow dx="0" dy="3" stdDeviation="8" floodColor={activeColor} floodOpacity="0.55" />
          </filter>

          {/* Inner shimmer: soft white highlight on crescent top edge */}
          <linearGradient id="psp-shimmer" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="white" stopOpacity="1"   />
            <stop offset="100%" stopColor="white" stopOpacity="0.88"/>
          </linearGradient>
        </defs>

        {/* ── White crescent band (main body) ── */}
        <path
          d={crescent}
          fill="none"
          stroke="url(#psp-shimmer)"
          strokeWidth={ARC_W}
          strokeLinecap="round"
          filter="url(#psp-shadow)"
        />
        {/* Thin inner-edge highlight for 3-D lift */}
        <path
          d={crescent}
          fill="none"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth={ARC_W - 10}
          strokeLinecap="round"
        />

        {/* ── Active tool raised bubble ── */}
        {toolItems.filter((t) => t.isActive).map((t) => (
          <g key="bubble" filter="url(#psp-glow)">
            {/* Outer coloured disc */}
            <circle cx={t.x} cy={t.y} r={BTN / 2 + 4} fill={activeColor} />
            {/* White inner ring (depth cue) */}
            <circle cx={t.x} cy={t.y} r={BTN / 2 + 4} fill="none"
              stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" />
          </g>
        ))}

        {/* ── Pencil tip anchor indicator ── */}
        <circle cx={tipX} cy={tipY} r={4.5}
          fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="1.5" />
        <circle cx={tipX} cy={tipY} r={2}
          fill="rgba(0,0,0,0.15)" />
      </svg>

      {/* ── Tool buttons ── */}
      {toolItems.map(({ id, label, Icon, x, y, isActive }) => (
        <button
          key={id}
          title={label}
          aria-label={label}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => { onSelectTool(id); onClose(); }}
          style={{
            position: "absolute",
            left:   x - BTN / 2,
            top:    y - BTN / 2,
            width:  BTN,
            height: BTN,
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            borderRadius: "50%",
            padding: 0,
            cursor: "pointer",
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
            // Scale-up micro-feedback on press (no JS needed)
            transition: "transform 0.12s ease",
          }}
          // Pressed-state scale via active pseudo-class (via onPointerDown CSS-in-JS)
          onPointerEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1.08)"; }}
          onPointerLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
        >
          <Icon
            style={{
              width: 23,
              height: 23,
              color: isActive ? "#ffffff" : "#3d3d3d",
              filter: isActive ? "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" : "none",
            }}
          />
        </button>
      ))}

      {/* ── Undo button ── */}
      <button
        title="بازگشت"
        aria-label="بازگشت"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => { onUndo(); onClose(); }}
        onPointerEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1.08)"; }}
        onPointerLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
        style={{
          position: "absolute",
          left:   undoPos.x - BTN / 2,
          top:    undoPos.y - BTN / 2,
          width:  BTN,
          height: BTN,
          pointerEvents: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          borderRadius: "50%",
          padding: 0,
          cursor: "pointer",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
          transition: "transform 0.12s ease",
        }}
      >
        <Undo2 style={{ width: 20, height: 20, color: "#4a4a4a" }} />
      </button>

      {/* ── Color swatches ── */}
      {colorItems.map(({ value, label, x, y, isActive }) => (
        <button
          key={value}
          aria-label={label}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onSelectColor(value)}
          onPointerEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1.18)"; }}
          onPointerLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = isActive ? "scale(1.12)" : "scale(1)"; }}
          style={{
            position: "absolute",
            left:   x - DOT / 2,
            top:    y - DOT / 2,
            width:  DOT,
            height: DOT,
            pointerEvents: "auto",
            borderRadius: "50%",
            background: value,
            border: isActive ? "3px solid white" : "2.5px solid rgba(255,255,255,0.9)",
            boxShadow: isActive
              ? `0 0 0 2.5px ${value}, 0 3px 10px rgba(0,0,0,0.22)`
              : "0 2px 6px rgba(0,0,0,0.18)",
            transform: isActive ? "scale(1.12)" : "scale(1)",
            cursor: "pointer",
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
            transition: "transform 0.14s ease, box-shadow 0.14s ease",
          }}
        />
      ))}
    </div>
  );
}
