"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import {
  Activity, AlertCircle, AlertOctagon, AlertTriangle, ArrowRightCircle,
  BookOpen, CheckCircle2, ClipboardList, Cog, Eye, FlaskConical, HelpCircle,
  Layers, PlayCircle, RefreshCw, Square, TrendingUp, Users, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAlgorithmLayout, NODE_W, NODE_H } from "@/components/algorithms/useAlgorithmLayout";
import { AlgorithmEdgeLayer } from "@/components/algorithms/AlgorithmEdgeLayer";
import { OutlinerWebGLCanvas, LOD_THRESHOLD } from "@/components/outliner/OutlinerWebGLCanvas";
import type { AlgorithmNodeV4, AlgorithmEdgeV4 } from "@/types/algorithm-ir-v4";
import type { AlgorithmSurface } from "@/types/algorithm-ir";
import { readString } from "@/components/outliner/surface-families";
import { useOutlinerStore } from "@/components/outliner/outliner-store";
import type { OutlinerMode } from "@/components/outliner/outliner-store";

const MIN_GRAPH_ZOOM = 0.57;

// ── Node colour / icon table — every nodeType has a distinct entry ────────────

const NODE_COLORS: Record<string, string> = {
  entry:          "#3B82F6",
  question:       "#8B5CF6",
  mechanism:      "#0EA5E9",
  concept:        "#0EA5E9",
  clinical_effect:"#0EA5E9",
  treatment:      "#22C55E",
  action:         "#22C55E",
  threshold:      "#F59E0B",
  observation:    "#94A3B8",
  finding:        "#94A3B8",
  test:           "#0EA5E9",
  follow_up:      "#14B8A6",
  endpoint:       "#9CA3AF",
  escalation:     "#DC2626",
  complication:   "#DC2626",
  exception:      "#F97316",
  classification: "#6366F1",
  risk_group:     "#A855F7",
  trap:           "#F43F5E",
};
const DEFAULT_NODE_COLOR = "#94A3B8";

function nodeColor(nodeType: string): string {
  return NODE_COLORS[nodeType] ?? DEFAULT_NODE_COLOR;
}

type IconComponent = React.FC<{ size?: number; color?: string; strokeWidth?: number }>;

const NODE_ICONS: Record<string, IconComponent> = {
  entry:          ArrowRightCircle,
  question:       HelpCircle,
  mechanism:      Cog,
  concept:        BookOpen,
  clinical_effect:Activity,
  treatment:      CheckCircle2,
  action:         PlayCircle,
  threshold:      Zap,
  observation:    Eye,
  finding:        ClipboardList,
  test:           FlaskConical,
  follow_up:      RefreshCw,
  endpoint:       Square,
  escalation:     TrendingUp,
  complication:   AlertTriangle,
  exception:      AlertOctagon,
  classification: Layers,
  risk_group:     Users,
  trap:           AlertCircle,
};

// ── memoryRole pill table ─────────────────────────────────────────────────────

interface PillStyle { label: string; bg: string; text: string }

const MEMORY_ROLE_PILLS: Record<string, PillStyle> = {
  entry_anchor:  { label: "ورود",       bg: "#DBEAFE", text: "#1D4ED8" },
  decision_gate: { label: "تصمیم",      bg: "#EDE9FE", text: "#6D28D9" },
  golden_number: { label: "عدد طلایی",  bg: "#FEF3C7", text: "#92400E" },
  red_flag:      { label: "پرچم قرمز",  bg: "#FEE2E2", text: "#B91C1C" },
  trap:          { label: "دام",         bg: "#FFE4E6", text: "#BE123C" },
  review_hook:   { label: "مرور",        bg: "#CCFBF1", text: "#0F766E" },
  exception:     { label: "استثنا",      bg: "#FFEDD5", text: "#C2410C" },
  endpoint:      { label: "پایان",       bg: "#F3F4F6", text: "#374151" },
};

// ── nodeType → Persian role label ─────────────────────────────────────────────

const NODE_TYPE_ROLE_LABELS: Record<string, string> = {
  entry:          "نقطه ورود بالینی",
  question:       "تصمیم کلیدی",
  mechanism:      "مکانیسم",
  concept:        "مفهوم",
  clinical_effect:"اثر بالینی",
  test:           "آزمایش/تست",
  treatment:      "اقدام درمانی",
  action:         "اقدام",
  threshold:      "آستانه عددی",
  observation:    "یافته بالینی",
  finding:        "یافته",
  follow_up:      "پیگیری",
  endpoint:       "پایان مسیر",
  escalation:     "تشدید مسیر",
  complication:   "عارضه",
  exception:      "استثنا",
  classification: "طبقه‌بندی",
  risk_group:     "گروه خطر",
  trap:           "دام بوردی",
};

// ── Edge style table — every edgeType has a distinct entry ────────────────────

interface EdgeStyle { color: string; dash: string }

const EDGE_STYLES: Record<string, EdgeStyle> = {
  progression:           { color: "#CBD5E1", dash: "none" },
  finding_to_action:     { color: "#22C55E", dash: "none" },
  test_to_result:        { color: "#0EA5E9", dash: "none" },
  yes_no:                { color: "#64748B", dash: "none" },
  threshold_split:       { color: "#F59E0B", dash: "6 3" },
  failure_branch:        { color: "#F43F5E", dash: "6 3" },
  exception_branch:      { color: "#F97316", dash: "6 3" },
  classification_branch: { color: "#6366F1", dash: "6 3" },
  risk_split:            { color: "#A855F7", dash: "6 3" },
  follow_up_trigger:     { color: "#14B8A6", dash: "2 3" },
  concept_to_effect:     { color: "#0EA5E9", dash: "2 3" },
  trap:                  { color: "#DC2626", dash: "6 3" },
};
const DEFAULT_EDGE_STYLE: EdgeStyle = { color: "#94A3B8", dash: "none" };

function edgeStyle(edgeType?: string): EdgeStyle {
  return EDGE_STYLES[edgeType ?? ""] ?? DEFAULT_EDGE_STYLE;
}

// ── Clinical Cognition Layer ───────────────────────────────────────────────────

function computeAncestorPath(edges: AlgorithmEdgeV4[], targetNodeId: string): Set<string> {
  const parents = new Map<string, string[]>();
  for (const edge of edges) {
    const list = parents.get(edge.to) ?? [];
    list.push(edge.from);
    parents.set(edge.to, list);
  }
  const result = new Set<string>([targetNodeId]);
  const queue  = [targetNodeId];
  while (queue.length > 0) {
    const nid = queue.shift()!;
    for (const pid of parents.get(nid) ?? []) {
      if (!result.has(pid)) { result.add(pid); queue.push(pid); }
    }
  }
  return result;
}

function nodeEduHeat(node: AlgorithmNodeV4, cpCount: number): number {
  let h = 0;
  if (node.nodeType === "trap" || node.memoryRole === "trap") h += 0.40;
  else if (node.nodeType === "escalation")                    h += 0.30;
  else if (node.nodeType === "threshold")                     h += 0.20;
  else if (node.nodeType === "question" || node.nodeType === "test") h += 0.14;
  if (node.testablePoint)                                     h += 0.25;
  if ((node.linkedBlockIds ?? []).length > 0)                 h += 0.10;
  if (cpCount > 0)                                            h += 0.15;
  return h > 0 ? Math.min(1.0, h) : 0;
}

// ── NodeCard — the new spec-compliant card ────────────────────────────────────

interface NodeCardProps {
  node: AlgorithmNodeV4;
  surfaceId: string;
  x?: number;
  y?: number;
  isSelected: boolean;
  isInPath: boolean;
  isConnected: boolean;
  isAncestorPath?: boolean;
  isNextDecision?: boolean;
  hasCheckpoint?: boolean;
  mode: OutlinerMode;
  isLabelRevealed: boolean;
  modeOpacity: number;
  modeFilter: string;
  onClick: (nodeId: string) => void;
  onContextMenu?: (event: React.MouseEvent<HTMLDivElement>, node: AlgorithmNodeV4) => void;
}

function NodeCard({
  node, surfaceId, x, y,
  isSelected, isAncestorPath = false, isNextDecision = false,
  hasCheckpoint = false,
  mode, isLabelRevealed, modeOpacity, modeFilter,
  onClick, onContextMenu,
}: NodeCardProps) {
  const color    = nodeColor(node.nodeType);
  const isTrap   = node.nodeType === "trap" || node.memoryRole === "trap";
  const pill     = node.memoryRole ? MEMORY_ROLE_PILLS[node.memoryRole] : null;
  const Icon     = NODE_ICONS[node.nodeType] ?? AlertCircle;
  const showTP   = mode !== "recall" && mode !== "exam";
  const label    = mode === "recall" && !isLabelRevealed ? "؟" : node.label;

  // Box shadow per state
  let shadow = "0 1px 3px rgba(15,23,42,0.08)";
  if (isSelected) shadow = `0 0 0 2px ${color}, 0 10px 24px rgba(15,23,42,0.14)`;
  else if (isTrap) shadow = "0 0 0 2px rgba(244,63,94,0.18), 0 8px 20px rgba(15,23,42,0.10)";
  else if (isNextDecision) shadow = "0 0 0 2px #34D399, 0 2px 10px rgba(52,211,153,0.20)";
  else if (isAncestorPath) shadow = "0 0 0 1px rgba(15,118,110,0.45), 0 1px 4px rgba(15,23,42,0.08)";

  const positionStyle: React.CSSProperties = x !== undefined && y !== undefined
    ? { position: "absolute", left: x, top: y, width: NODE_W, zIndex: 2 }
    : {};

  return (
    <div
      role="button"
      tabIndex={0}
      dir="rtl"
      lang="fa"
      aria-current={isSelected ? "true" : undefined}
      data-surface-id={surfaceId}
      data-node-id={node.nodeId}
      data-selected={isSelected ? "true" : undefined}
      data-trap={isTrap ? "true" : undefined}
      onClick={() => onClick(node.nodeId)}
      onContextMenu={(event) => onContextMenu?.(event, node)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(node.nodeId); }}
      style={{
        ...positionStyle,
        borderRadius: 8,
        padding: "10px 12px",
        minWidth: 180,
        maxWidth: 240,
        background: "white",
        border: `1px solid #E2E8F0`,
        borderRight: `3px solid ${color}`,
        boxShadow: shadow,
        opacity: modeOpacity,
        filter: modeFilter,
        transition: "box-shadow 180ms ease, transform 120ms ease, opacity 180ms ease",
        cursor: "pointer",
        transform: isSelected ? "translateY(-2px)" : undefined,
      }}
    >
      {/* Top row: memory role pill + icon */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, minHeight: 20 }}>
        {pill ? (
          <span style={{
            borderRadius: 999, padding: "2px 8px", fontSize: 10, fontWeight: 600,
            letterSpacing: 0, background: pill.bg, color: pill.text,
          }}>
            {pill.label}
          </span>
        ) : <span />}
        <Icon size={14} color={color} strokeWidth={2} />
      </div>

      {/* Label */}
      <p style={{ fontSize: 15, fontWeight: 500, color: "#0F172A", margin: 0, lineHeight: 1.4 }}>
        {label}
      </p>

      {/* testablePoint — clamped 2 lines, hidden in recall/exam */}
      {showTP && node.testablePoint && (
        <p style={{
          fontSize: 13, color: "#64748B", marginTop: 4, margin: "4px 0 0 0",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {node.testablePoint}
        </p>
      )}

      {/* Checkpoint marker */}
      {hasCheckpoint && (
        <span style={{
          display: "inline-block", marginTop: 4, fontSize: 9, fontWeight: 700,
          border: "1px solid #6EE7B7", borderRadius: 4, padding: "1px 5px",
          background: "#ECFDF5", color: "#065F46",
        }}>
          ✓ چک‌پوینت
        </span>
      )}
    </div>
  );
}

function NodeContextMenu({
  node,
  surface,
  x,
  y,
  onClose,
}: {
  node: AlgorithmNodeV4;
  surface: AlgorithmSurface;
  x: number;
  y: number;
  onClose: () => void;
}) {
  const thresholds = (surface.thresholds ?? []).filter((item) => {
    const linked = (item as Record<string, unknown>).linkedNodeIds;
    return Array.isArray(linked) ? linked.includes(node.nodeId) : node.nodeType === "threshold";
  });
  const traps = (surface.boardTraps ?? []).filter((item) => {
    const linked = (item as Record<string, unknown>).linkedNodeIds;
    return Array.isArray(linked)
      ? linked.includes(node.nodeId)
      : node.nodeType === "trap" || node.memoryRole === "trap";
  });

  return (
    <div
      role="dialog"
      dir="rtl"
      lang="fa"
      className="fixed z-[80] w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
      style={{
        left: Math.max(16, x - 340),
        top: Math.max(16, y),
      }}
    >
      <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-6 text-slate-950">{node.label}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {NODE_TYPE_ROLE_LABELS[node.nodeType] ?? node.nodeType}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-50 hover:text-slate-700"
          aria-label="بستن"
        >
          ×
        </button>
      </div>
      <div className="max-h-[260px] overflow-auto px-4 py-3 text-sm leading-7 text-slate-700">
        {node.testablePoint && (
          <p className="border-r-2 border-teal-600 bg-teal-50/70 px-3 py-2 text-teal-950">
            {node.testablePoint}
          </p>
        )}
        {node.detail && <p className="mt-3">{node.detail}</p>}
        {(thresholds.length > 0 || traps.length > 0) && (
          <div className="mt-3 space-y-2 text-xs">
            {thresholds.map((item) => (
              <p key={item.id} className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">
                {readString(item, ["variable", "metric", "label", "title"]) ?? "آستانه"}: {readString(item, ["value", "threshold"]) ?? ""}
              </p>
            ))}
            {traps.map((item) => (
              <p key={item.id} className="rounded-md bg-rose-50 px-3 py-2 text-rose-900">
                {readString(item, ["trapTitle"]) ?? "دام بوردی"}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Node mode visibility ───────────────────────────────────────────────────────

function getNodeModeOpacity(
  mode: OutlinerMode,
  node: AlgorithmNodeV4,
  isSelected: boolean,
  isOutgoing: boolean,
  isAncestorPath = false,
): number {
  if (mode === "free" || mode === "recall" || mode === "exam") return 1;
  if (mode === "stepwise") {
    if (isSelected || isOutgoing) return 1;
    if (isAncestorPath) return 0.35;
    return 0.08;
  }
  if (mode === "traps") {
    const isTrap = node.nodeType === "trap" || node.memoryRole === "trap";
    return isTrap ? 1 : 0.15;
  }
  return 1;
}

function getNodeModeFilter(
  mode: OutlinerMode,
  node: AlgorithmNodeV4,
  isSelected: boolean,
  isOutgoing: boolean,
): string {
  if (mode === "traps") {
    const isTrap = node.nodeType === "trap" || node.memoryRole === "trap";
    if (!isTrap) return "grayscale(1)";
  }
  return "none";
}

// ── Edge condition label ───────────────────────────────────────────────────────

function EdgeConditionLabel({
  label, x, y, edgeType,
}: { label: string; x: number; y: number; edgeType?: string }) {
  const es = edgeStyle(edgeType);
  return (
    <div
      dir="rtl"
      style={{
        position: "absolute", left: x, top: y,
        transform: "translate(-50%,-50%)", zIndex: 3, pointerEvents: "none",
      }}
    >
      <span style={{
        display: "inline-block",
        background: "white",
        border: `1px solid ${es.color}`,
        borderRadius: 999,
        padding: "2px 8px",
        fontSize: 11,
        color: es.color,
        fontWeight: 500,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        maxWidth: 160,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {label}
      </span>
    </div>
  );
}

// ── Surface header (legacy renderers) ─────────────────────────────────────────

function SurfaceHeader({ surface }: { surface: AlgorithmSurface }) {
  const shape = surface.algorithmShape ?? surface.surfaceType ?? "";
  const shapeLabel: Record<string, string> = {
    dag: "الگوریتم", chain: "زنجیره", tree: "درخت",
    matrix: "ماتریس", trap: "تله", card_grid: "کارت‌ها",
  };
  const label = shapeLabel[shape.toLowerCase()] ?? shape;
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      {surface.title && (
        <h2 dir="rtl" lang="fa" className="text-[15px] font-bold leading-tight text-foreground">{surface.title}</h2>
      )}
      {label && (
        <span className="shrink-0 rounded-full border border-border/50 bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {label}
        </span>
      )}
    </div>
  );
}

function SurfaceFrame({ surface, children }: { surface: AlgorithmSurface; children: React.ReactNode }) {
  return (
    <section className="h-full min-h-0 w-full px-3 py-3 lg:px-5 lg:py-4" data-surface-id={surface.id}>
      {children}
    </section>
  );
}

// ── Gates banner ──────────────────────────────────────────────────────────────

function GateBanner({ surface }: { surface: AlgorithmSurface }) {
  const gates = surface.gates ?? [];
  if (gates.length === 0) return null;
  return (
    <div className="mb-3 space-y-1.5">
      {gates.map((gate) => (
        <div key={gate.id} className="flex items-start gap-3 rounded-lg border border-amber-400/40 bg-amber-50/80 dark:bg-amber-950/50 px-3 py-2 text-sm">
          <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
          <div className="min-w-0 flex-1" dir="rtl" lang="fa">
            <p className="text-[12px] font-semibold text-amber-700 dark:text-amber-400">{gate.title ?? "Entry gate"}</p>
            {gate.entryCondition && <p className="mt-0.5 text-[11px] text-muted-foreground">{gate.entryCondition}</p>}
            <div className="mt-1.5 flex gap-3 text-[11px]">
              {gate.actionIfPass && <span className="text-emerald-600 dark:text-emerald-400">✓ {gate.actionIfPass}</span>}
              {gate.actionIfFail && <span className="text-rose-600 dark:text-rose-400">✗ {gate.actionIfFail}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Thresholds ────────────────────────────────────────────────────────────────

function ThresholdSection({ surface }: { surface: AlgorithmSurface }) {
  const thresholds = surface.thresholds ?? [];
  if (thresholds.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">آستانه‌های کلیدی</p>
      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {thresholds.map((t) => (
          <div key={t.id} dir="rtl" lang="fa" className="flex items-center gap-2.5 rounded-lg border border-amber-400/30 bg-amber-50/70 dark:bg-amber-950/40 px-3 py-2">
            <span className="text-base font-black text-amber-600 dark:text-amber-400 tabular-nums shrink-0">{t.value}</span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-foreground truncate">{t.variable}</p>
              {t.conditionText && <p className="text-[10px] leading-4 text-muted-foreground line-clamp-1">{t.conditionText}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Mini-map ──────────────────────────────────────────────────────────────────

function MiniMap({
  nodes, canvasWidth, canvasHeight, selectedNodeId,
}: {
  nodes: Array<{ node: AlgorithmNodeV4; x: number; y: number }>;
  canvasWidth: number;
  canvasHeight: number;
  selectedNodeId: string | null;
}) {
  const W = 120, H = 80;
  const scaleX = W / (canvasWidth || 1);
  const scaleY = H / (canvasHeight || 1);

  return (
    <div style={{
      position: "absolute", bottom: 52, right: 12, zIndex: 10,
      width: W, height: H,
      background: "rgba(255,255,255,0.92)",
      border: "1px solid #D7E0E5",
      borderRadius: 8,
      boxShadow: "0 8px 24px rgba(15,23,42,0.10)",
      overflow: "hidden",
      pointerEvents: "none",
    }}>
      <svg width={W} height={H}>
        {nodes.map((ln) => {
          const cx = (ln.x + NODE_W / 2) * scaleX;
          const cy = (ln.y + NODE_H / 2) * scaleY;
          const color = nodeColor(ln.node.nodeType);
          const r = ln.node.nodeId === selectedNodeId ? 4 : 2.5;
          return (
            <circle
              key={ln.node.nodeId}
              cx={cx} cy={cy} r={r}
              fill={color}
              opacity={ln.node.nodeId === selectedNodeId ? 1 : 0.6}
            />
          );
        })}
      </svg>
    </div>
  );
}

// ── Zoom pill ─────────────────────────────────────────────────────────────────

function ZoomPill({ zoom, onReset, onZoomIn, onZoomOut }: {
  zoom: number;
  onReset: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  return (
    <div style={{
      position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
      zIndex: 10, display: "flex", alignItems: "center", gap: 0,
      background: "rgba(255,255,255,0.94)", border: "1px solid #D7E0E5",
      borderRadius: 999, boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
      overflow: "hidden",
    }}>
      <button type="button" onClick={onZoomOut}
        style={{ padding: "6px 10px", fontSize: 14, cursor: "pointer", border: "none", background: "none", color: "#64748B" }}>
        −
      </button>
      <button type="button" onClick={onReset}
        style={{ padding: "6px 4px", fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none", background: "none", color: "#0F172A", minWidth: 44, textAlign: "center" }}>
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" onClick={onZoomIn}
        style={{ padding: "6px 10px", fontSize: 14, cursor: "pointer", border: "none", background: "none", color: "#64748B" }}>
        +
      </button>
    </div>
  );
}

// ── DagRenderer — the main connected-graph view ───────────────────────────────

export function DagRenderer({
  surface,
  onBlockClick,
}: {
  surface: AlgorithmSurface;
  onBlockClick?: (blockId: string) => void;
}) {
  const v4nodes = surface.nodes as unknown as AlgorithmNodeV4[];
  const v4edges = surface.edges as unknown as AlgorithmEdgeV4[];
  const layout  = useAlgorithmLayout(v4nodes, v4edges);

  // ── Store reads ──────────────────────────────────────────────────────────
  const selectedNodeId      = useOutlinerStore((s) => s.focusedNodeId);
  const storeSetSelectedId  = useOutlinerStore((s) => s.setSelectedNodeId);
  const activateFocusPath   = useOutlinerStore((s) => s.activateFocusPath);
  const mode                = useOutlinerStore((s) => s.mode);
  const revealedNodeLabels  = useOutlinerStore((s) => s.revealedNodeLabels);
  const revealNodeLabel     = useOutlinerStore((s) => s.revealNodeLabel);

  const [visitedPath, setVisitedPath] = useState<string[]>([]);
  const [useWebGL,    setUseWebGL]    = useState(true);
  const [zoom,        setZoom]        = useState(MIN_GRAPH_ZOOM);
  const [contextMenu, setContextMenu] = useState<{
    node: AlgorithmNodeV4;
    x: number;
    y: number;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const handleWebGLFallback = useCallback(() => setUseWebGL(false), []);

  const entryLayoutNode = useMemo(
    () =>
      layout.nodes.find((ln) => ln.node.nodeType === "entry") ??
      layout.nodes.find((ln) => !v4edges.some((edge) => edge.to === ln.node.nodeId)) ??
      layout.nodes[0] ??
      null,
    [layout.nodes, v4edges],
  );

  // ── Memos ────────────────────────────────────────────────────────────────
  const checkpointNodeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const cp of (surface.checkpoints ?? []) as Array<{ linkedNodeIds?: string[] }>) {
      for (const nid of cp.linkedNodeIds ?? []) {
        counts.set(nid, (counts.get(nid) ?? 0) + 1);
      }
    }
    return counts;
  }, [surface.checkpoints]);

  const checkpointedNodes = useMemo(
    () => new Set(checkpointNodeCounts.keys()),
    [checkpointNodeCounts],
  );

  const eduHeatMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const node of v4nodes) {
      const h = nodeEduHeat(node, checkpointNodeCounts.get(node.nodeId) ?? 0);
      if (h > 0.05) map.set(node.nodeId, h);
    }
    return map;
  }, [v4nodes, checkpointNodeCounts]);

  const ancestorPath = useMemo(
    () => selectedNodeId ? computeAncestorPath(v4edges, selectedNodeId) : new Set<string>(),
    [v4edges, selectedNodeId],
  );

  const nextDecisionNodes = useMemo(
    () => {
      if (!selectedNodeId) return new Set<string>();
      return new Set(v4edges.filter((e) => e.from === selectedNodeId).map((e) => e.to));
    },
    [v4edges, selectedNodeId],
  );

  const ancestorArr = useMemo(() => [...ancestorPath],      [ancestorPath]);
  const nextArr     = useMemo(() => [...nextDecisionNodes], [nextDecisionNodes]);

  // Trap node IDs for WebGL traps-mode dimming
  const trapNodeIds = useMemo(
    () => mode === "traps"
      ? v4nodes.filter((n) => n.nodeType === "trap" || n.memoryRole === "trap").map((n) => n.nodeId)
      : [],
    [mode, v4nodes],
  );

  // Non-passive Ctrl+wheel zoom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      setZoom((z) => Math.max(MIN_GRAPH_ZOOM, Math.min(2.0, z * factor)));
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const fitCanvas = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nextZoom = Math.max(
      MIN_GRAPH_ZOOM,
      Math.min(
        1.2,
        (el.clientWidth - 80) / Math.max(layout.canvasWidth, 1),
        (el.clientHeight - 80) / Math.max(layout.canvasHeight, 1),
      ),
    );
    setZoom(nextZoom);
    requestAnimationFrame(() => {
      const next = scrollRef.current;
      if (!next) return;
      const focus = entryLayoutNode;
      if (!focus) {
        next.scrollLeft = Math.max(0, (next.scrollWidth - next.clientWidth) / 2);
        next.scrollTop = 24;
        return;
      }
      const graphW = layout.canvasWidth * nextZoom;
      const displayW = Math.max(graphW, next.clientWidth);
      const focusX = displayW / 2 - graphW / 2 + (focus.x + NODE_W / 2) * nextZoom;
      const focusY = (focus.y + NODE_H / 2) * nextZoom;
      next.scrollLeft = Math.max(0, focusX - next.clientWidth / 2);
      next.scrollTop = Math.max(0, focusY - 120);
    });
  }, [entryLayoutNode, layout.canvasHeight, layout.canvasWidth]);

  useEffect(() => {
    fitCanvas();
  }, [fitCanvas, surface.id]);

  function handleCanvasPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-node-id],button,a,input,textarea,select,[role='button']")) return;
    const el = scrollRef.current;
    if (!el) return;
    panRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: el.scrollLeft,
      top: el.scrollTop,
    };
    el.setPointerCapture(event.pointerId);
    el.dataset.panning = "true";
  }

  function handleCanvasPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    const el = scrollRef.current;
    if (!pan || !el || pan.pointerId !== event.pointerId) return;
    el.scrollLeft = pan.left - (event.clientX - pan.x);
    el.scrollTop = pan.top - (event.clientY - pan.y);
  }

  function handleCanvasPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    const el = scrollRef.current;
    if (panRef.current?.pointerId === event.pointerId) panRef.current = null;
    if (el) {
      try { el.releasePointerCapture(event.pointerId); } catch { /* already released */ }
      delete el.dataset.panning;
    }
  }

  function handleSelectNode(nodeId: string) {
    if (selectedNodeId === nodeId) {
      storeSetSelectedId(null);
      return;
    }
    storeSetSelectedId(nodeId);
    setVisitedPath((prev) => prev.includes(nodeId) ? prev : [...prev, nodeId]);
    activateFocusPath(nodeId);
    if (mode === "recall") revealNodeLabel(nodeId);
  }

  function handleNodeContextMenu(event: React.MouseEvent<HTMLDivElement>, node: AlgorithmNodeV4) {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ node, x: event.clientX, y: event.clientY });
    storeSetSelectedId(node.nodeId);
  }

  const connectedIds = new Set<string>();
  if (selectedNodeId) {
    for (const edge of v4edges) {
      if (edge.from === selectedNodeId) connectedIds.add(edge.to);
      if (edge.to   === selectedNodeId) connectedIds.add(edge.from);
    }
  }

  const visitedSet = new Set(visitedPath);
  const lodMode    = zoom < LOD_THRESHOLD;

  return (
    <SurfaceFrame surface={surface}>
      <style>{`
        @keyframes outliner-node-enter {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        [data-panning="true"] { cursor: grabbing !important; }
      `}</style>
      {/* ── Canvas scroll container ── */}
      <div
        ref={scrollRef}
        className="h-full min-h-[520px] overflow-auto rounded-lg border border-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerEnd}
        onPointerCancel={handleCanvasPointerEnd}
        style={{
          backgroundColor: "var(--sp-canvas-bg, #FAFAFA)",
          backgroundImage: "radial-gradient(circle, var(--sp-canvas-dot, #E2E8F0) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          minHeight: "max(560px, calc(100vh - 210px))",
          position: "relative",
          cursor: "grab",
          touchAction: "none",
        }}
      >
        {contextMenu && (
          <>
            <button
              type="button"
              aria-label="بستن منوی گره"
              className="fixed inset-0 z-[70] cursor-default bg-transparent"
              onClick={() => setContextMenu(null)}
            />
            <NodeContextMenu
              node={contextMenu.node}
              surface={surface}
              x={contextMenu.x}
              y={contextMenu.y}
              onClose={() => setContextMenu(null)}
            />
          </>
        )}
        {/* Size proxy */}
        <div
          style={{
            width: layout.canvasWidth * zoom,
            height: layout.canvasHeight * zoom,
            minWidth: "100%",
            margin: "0 auto",
            position: "relative",
          }}
        >

          {/* Scaled content layer */}
          <div
            className="relative"
            style={{
              position: "absolute", top: 0, left: "50%",
              width: layout.canvasWidth, height: layout.canvasHeight,
              transform: `translateX(-50%) scale(${zoom})`, transformOrigin: "50% 0",
            }}
            data-surface-id={surface.id}
          >
            {/* ── GPU layer ── */}
            {useWebGL ? (
              <OutlinerWebGLCanvas
                layoutEdges={layout.edges}
                layoutNodes={layout.nodes}
                canvasWidth={layout.canvasWidth}
                canvasHeight={layout.canvasHeight}
                selectedNodeId={selectedNodeId}
                visitedPath={visitedPath}
                zoom={zoom}
                onFallback={handleWebGLFallback}
                ancestorPath={ancestorArr}
                nextNodeIds={nextArr}
                eduHeat={eduHeatMap}
                highlightNodeIds={trapNodeIds}
              />
            ) : (
              <AlgorithmEdgeLayer
                layoutEdges={layout.edges}
                surfaceId={surface.id}
                selectedNodeId={selectedNodeId}
                visitedPath={visitedPath}
                canvasWidth={layout.canvasWidth}
                canvasHeight={layout.canvasHeight}
              />
            )}

            {/* ── DOM node cards ── */}
            {!lodMode && layout.nodes.map((ln) => {
              const isSelected    = ln.node.nodeId === selectedNodeId;
              const isOutgoing    = nextDecisionNodes.has(ln.node.nodeId);
              const isAncPath     = ancestorPath.has(ln.node.nodeId) && !isSelected;
              const opacity       = getNodeModeOpacity(mode, ln.node, isSelected, isOutgoing, isAncPath);
              const filter        = getNodeModeFilter(mode, ln.node, isSelected, isOutgoing);
              const labelRevealed = revealedNodeLabels.has(ln.node.nodeId);

              return (
                <NodeCard
                  key={ln.node.nodeId}
                  node={ln.node}
                  surfaceId={surface.id}
                  x={ln.x}
                  y={ln.y}
                  isSelected={isSelected}
                  isInPath={visitedSet.has(ln.node.nodeId)}
                  isConnected={connectedIds.has(ln.node.nodeId)}
                  isAncestorPath={isAncPath}
                  isNextDecision={isOutgoing}
                  hasCheckpoint={checkpointedNodes.has(ln.node.nodeId)}
                  mode={mode}
                  isLabelRevealed={labelRevealed}
                  modeOpacity={opacity}
                  modeFilter={filter}
                  onClick={handleSelectNode}
                  onContextMenu={handleNodeContextMenu}
                />
              );
            })}

            {/* ── Edge condition labels ── */}
            {!lodMode && layout.edges
              .filter((le) => {
                if (!le.edge.condition) return false;
                return visitedSet.has(le.edge.from)
                  || selectedNodeId === le.edge.from
                  || selectedNodeId === le.edge.to;
              })
              .map((le) => (
                <EdgeConditionLabel
                  key={le.edge.edgeId}
                  label={le.edge.condition!}
                  x={(le.fromPos.x + le.toPos.x) / 2}
                  y={(le.fromPos.y + le.toPos.y) / 2}
                  edgeType={le.edge.edgeType}
                />
              ))}
          </div>
        </div>

        {/* Mini-map */}
        <MiniMap
          nodes={layout.nodes}
          canvasWidth={layout.canvasWidth}
          canvasHeight={layout.canvasHeight}
          selectedNodeId={selectedNodeId}
        />

        {/* Zoom pill */}
        <ZoomPill
          zoom={zoom}
          onReset={fitCanvas}
          onZoomIn={() => setZoom((z) => Math.min(2.0, z * 1.08))}
          onZoomOut={() => setZoom((z) => Math.max(MIN_GRAPH_ZOOM, z * 0.92))}
        />
      </div>

    </SurfaceFrame>
  );
}

// ── ChainRenderer — vertical numbered flow ────────────────────────────────────

export function ChainRenderer({
  surface,
  onBlockClick,
}: {
  surface: AlgorithmSurface;
  onBlockClick?: (blockId: string) => void;
}) {
  const v4nodes = surface.nodes as unknown as AlgorithmNodeV4[];
  const v4edges = surface.edges as unknown as AlgorithmEdgeV4[];
  const layout  = useAlgorithmLayout(v4nodes, v4edges);
  const ordered = [...layout.nodes].sort((a, b) => a.y - b.y);
  const mode    = useOutlinerStore((s) => s.mode);

  return (
    <SurfaceFrame surface={surface}>
      <ol className="space-y-1.5">
        {ordered.map((ln, index) => {
          const node  = ln.node;
          const color = nodeColor(node.nodeType);
          return (
            <li key={node.nodeId} className="flex gap-2.5">
              <div className="flex flex-col items-center">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold border border-primary/40 bg-primary/10 text-primary">
                  {index + 1}
                </div>
                {index < ordered.length - 1 && (
                  <div className="mt-1 min-h-3 flex-1 border-l border-dashed border-border/50" />
                )}
              </div>
              <div
                dir="rtl" lang="fa" data-node-id={node.nodeId}
                className="mb-0.5 min-w-0 flex-1 overflow-hidden rounded-lg border bg-white shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
                style={{ borderRight: `3px solid ${color}` }}
              >
                <div className="px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color }}>
                    {NODE_TYPE_ROLE_LABELS[node.nodeType] ?? node.nodeType}
                  </p>
                  <p className="mt-0.5 text-[13px] font-semibold text-foreground">{node.label}</p>
                  {node.detail && <p className="mt-1 text-[11px] leading-relaxed text-foreground/75">{node.detail}</p>}
                  {mode !== "recall" && mode !== "exam" && node.testablePoint && (
                    <p className="mt-1 text-[10px] font-medium" style={{ color: "#92400E" }}>
                      {node.testablePoint}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </SurfaceFrame>
  );
}

// ── CardGridRenderer — 2-col compact cards ────────────────────────────────────

export function CardGridRenderer({
  surface,
  onBlockClick,
}: {
  surface: AlgorithmSurface;
  onBlockClick?: (blockId: string) => void;
}) {
  const mode = useOutlinerStore((s) => s.mode);

  return (
    <SurfaceFrame surface={surface}>
      <div className="grid gap-2 sm:grid-cols-2">
        {(surface.nodes ?? []).map((node) => {
          const v4    = node as unknown as AlgorithmNodeV4;
          const color = nodeColor(v4.nodeType);
          const pill  = v4.memoryRole ? MEMORY_ROLE_PILLS[v4.memoryRole] : null;
          return (
            <div
              key={node.id}
              dir="rtl" lang="fa" data-node-id={node.id}
              className="overflow-hidden rounded-lg border bg-white text-right shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
              style={{ borderRight: `3px solid ${color}` }}
            >
              <div className="px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  {pill ? (
                    <span style={{ borderRadius: 999, padding: "2px 7px", fontSize: 9, fontWeight: 700, background: pill.bg, color: pill.text }}>
                      {pill.label}
                    </span>
                  ) : <span />}
                  <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color }}>
                    {NODE_TYPE_ROLE_LABELS[v4.nodeType] ?? v4.nodeType}
                  </span>
                </div>
                <p className="mt-0.5 text-[13px] font-semibold text-foreground">{v4.label}</p>
                {v4.detail && <p className="mt-1 text-[11px] leading-relaxed text-foreground/75 line-clamp-3">{v4.detail}</p>}
                {mode !== "recall" && mode !== "exam" && v4.testablePoint && (
                  <p className="mt-1 text-[10px] font-medium" style={{ color: "#92400E" }}>{v4.testablePoint}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </SurfaceFrame>
  );
}

// ── TrapSurfaceRenderer ───────────────────────────────────────────────────────

function TrapSurfaceRenderer({
  surface,
  onBlockClick,
}: {
  surface: AlgorithmSurface;
  onBlockClick?: (blockId: string) => void;
}) {
  return (
    <SurfaceFrame surface={surface}>
      <div className="space-y-3">
        {(surface.boardTraps ?? []).map((trap) => (
          <article key={trap.id} className="overflow-hidden rounded-xl border border-rose-400/40">
            <div className="border-b border-rose-400/30 bg-rose-50 dark:bg-rose-950/50 px-4 py-2.5">
              <p className="text-[12px] font-bold text-rose-700 dark:text-rose-400">
                ⚠ {readString(trap, ["trapTitle"]) ?? "Board trap"}
              </p>
            </div>
            <div className="grid gap-0 sm:grid-cols-2">
              {trap.wrongPath && (
                <div className="border-b border-border/40 sm:border-b-0 sm:border-l p-3">
                  <p className="mb-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wide">✗ مسیر اشتباه</p>
                  <p className="text-[12px] leading-5 text-foreground/75" dir="rtl" lang="fa">{trap.wrongPath}</p>
                </div>
              )}
              {trap.correctPath && (
                <div className="p-3">
                  <p className="mb-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">✓ مسیر صحیح</p>
                  <p className="text-[12px] leading-5 text-foreground/75" dir="rtl" lang="fa">{trap.correctPath}</p>
                </div>
              )}
            </div>
            {trap.whyItMatters && (
              <div className="border-t border-border/40 bg-card px-4 py-2">
                <p className="text-[11px] italic text-foreground/70" dir="rtl" lang="fa">{trap.whyItMatters}</p>
              </div>
            )}
          </article>
        ))}
      </div>
      {(surface.nodes ?? []).length > 0 && (
        <div className="mt-5">
          <DagRenderer surface={{ ...surface, boardTraps: [] }} onBlockClick={onBlockClick} />
        </div>
      )}
    </SurfaceFrame>
  );
}

// ── MatrixSurfaceRenderer ─────────────────────────────────────────────────────

function MatrixSurfaceRenderer({
  surface,
}: {
  surface: AlgorithmSurface;
  onBlockClick?: (blockId: string) => void;
}) {
  return (
    <SurfaceFrame surface={surface}>
      {(surface.matrices ?? []).map((matrix) => (
        <div key={matrix.id} className="mb-4 overflow-hidden rounded-xl border border-border/50 shadow-sm">
          <div className="border-b border-border/60 bg-card px-4 py-2.5 text-[13px] font-bold" dir="rtl" lang="fa">{matrix.title}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border/40 bg-card text-[10px] font-bold uppercase tracking-wide text-foreground/70">
                  <th className="px-3 py-2 text-right">شرط</th>
                  <th className="px-3 py-2 text-right">تصمیم</th>
                  <th className="px-3 py-2 text-right">دلیل</th>
                  <th className="px-3 py-2 text-right">تله</th>
                </tr>
              </thead>
              <tbody>
                {(matrix.rows ?? []).map((row, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: matrix rows have no id
                  <tr key={i} className="border-b border-border/20 hover:bg-muted/20">
                    <td className="px-3 py-2 text-foreground/75" dir="rtl">{row.condition ?? "—"}</td>
                    <td className="px-3 py-2 font-semibold text-foreground" dir="rtl">{row.decision ?? "—"}</td>
                    <td className="px-3 py-2 text-foreground/75" dir="rtl">{row.reason ?? "—"}</td>
                    <td className="px-3 py-2 text-rose-600 dark:text-rose-400" dir="rtl">{row.trap ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </SurfaceFrame>
  );
}

// ── renderSurface dispatcher ──────────────────────────────────────────────────

export function renderSurface(
  surface?: AlgorithmSurface,
  onBlockClick?: (blockId: string) => void,
): React.ReactNode | null {
  if (!surface) return null;
  if ((surface.nodes ?? []).length > 0) return null;
  const shape = `${surface.algorithmShape ?? ""} ${surface.surfaceType ?? ""}`.toLowerCase();

  if (shape.includes("trap") || (surface.boardTraps?.length ?? 0) > 0)
    return <TrapSurfaceRenderer surface={surface} onBlockClick={onBlockClick} />;
  if (shape.includes("matrix") || (surface.matrices?.length ?? 0) > 0)
    return <MatrixSurfaceRenderer surface={surface} onBlockClick={onBlockClick} />;

  return null;
}

// ── Re-export nodeType role labels for use in LearningPanel ──────────────────
export { NODE_TYPE_ROLE_LABELS, NODE_COLORS, MEMORY_ROLE_PILLS, EDGE_STYLES, DEFAULT_EDGE_STYLE };
export type { EdgeStyle };
