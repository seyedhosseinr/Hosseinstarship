"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import {
  Activity, AlertCircle, AlertOctagon, AlertTriangle, ArrowRightCircle,
  BookOpen, CheckCircle2, ClipboardList, Cog, Eye, FlaskConical, HelpCircle,
  Layers, PlayCircle, RefreshCw, Square, TrendingUp, Users, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useAlgorithmLayout,
  NODE_W,
  NODE_H,
  type LayoutEdge,
  type LayoutNode,
} from "@/components/algorithms/useAlgorithmLayout";
import { AlgorithmEdgeLayer } from "@/components/algorithms/AlgorithmEdgeLayer";
import { OutlinerWebGLCanvas, LOD_THRESHOLD } from "@/components/outliner/OutlinerWebGLCanvas";
import type { AlgorithmNodeV4, AlgorithmEdgeV4 } from "@/types/algorithm-ir-v4";
import type { AlgorithmRecord, AlgorithmSurface } from "@/types/algorithm-ir";
import {
  getSurfaceObjectGroups,
  getSurfaceRendererKey,
  linkedBlockIds,
  objectId,
  readString,
  recordArray,
  titleOf,
  type SurfaceRendererKey,
} from "@/components/outliner/surface-families";
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

type RevealEvent =
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string };

function buildGraphRevealSequence(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  entryNodeId?: string,
): RevealEvent[] {
  const sequence: RevealEvent[] = [];
  if (nodes.length === 0) return sequence;

  const nodeIds = new Set(nodes.map((ln) => ln.node.nodeId));
  const incoming = new Set(edges.map((le) => le.edge.to));
  const rootId =
    entryNodeId ??
    nodes.find((ln) => ln.node.nodeType === "entry")?.node.nodeId ??
    nodes.find((ln) => !incoming.has(ln.node.nodeId))?.node.nodeId ??
    nodes[0]?.node.nodeId;
  if (!rootId) return sequence;

  const nodeById = new Map(nodes.map((ln) => [ln.node.nodeId, ln]));
  const outgoing = new Map<string, LayoutEdge[]>();
  for (const edge of edges) {
    if (!nodeIds.has(edge.edge.from) || !nodeIds.has(edge.edge.to)) continue;
    const list = outgoing.get(edge.edge.from) ?? [];
    list.push(edge);
    outgoing.set(edge.edge.from, list);
  }
  for (const list of outgoing.values()) {
    list.sort((a, b) => (a.toPos.x - b.toPos.x) || (a.toPos.y - b.toPos.y));
  }

  const seenNodes = new Set<string>();
  const seenEdges = new Set<string>();
  const queue: string[] = [rootId];
  seenNodes.add(rootId);
  sequence.push({ kind: "node", id: rootId });

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    for (const edge of outgoing.get(nodeId) ?? []) {
      if (!seenEdges.has(edge.edge.edgeId)) {
        seenEdges.add(edge.edge.edgeId);
        sequence.push({ kind: "edge", id: edge.edge.edgeId });
      }
      if (!seenNodes.has(edge.edge.to)) {
        seenNodes.add(edge.edge.to);
        sequence.push({ kind: "node", id: edge.edge.to });
        queue.push(edge.edge.to);
      }
    }
  }

  const leftovers = nodes
    .filter((ln) => !seenNodes.has(ln.node.nodeId))
    .sort((a, b) => (a.y - b.y) || (a.x - b.x));
  for (const node of leftovers) {
    seenNodes.add(node.node.nodeId);
    sequence.push({ kind: "node", id: node.node.nodeId });
    for (const edge of outgoing.get(node.node.nodeId) ?? []) {
      if (seenEdges.has(edge.edge.edgeId)) continue;
      seenEdges.add(edge.edge.edgeId);
      sequence.push({ kind: "edge", id: edge.edge.edgeId });
      if (!seenNodes.has(edge.edge.to) && nodeById.has(edge.edge.to)) {
        seenNodes.add(edge.edge.to);
        sequence.push({ kind: "node", id: edge.edge.to });
      }
    }
  }

  return sequence;
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
  enterIndex?: number;
  onClick: (nodeId: string) => void;
  onBlockClick?: (blockId: string) => void;
  onContextMenu?: (event: React.MouseEvent<HTMLDivElement>, node: AlgorithmNodeV4) => void;
}

function NodeCard({
  node, surfaceId, x, y,
  isSelected, isAncestorPath = false, isNextDecision = false,
  hasCheckpoint = false,
  mode, isLabelRevealed, modeOpacity, modeFilter,
  enterIndex = 0, onClick, onBlockClick, onContextMenu,
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
  const nodeStyleVars = {
    "--node-mode-opacity": modeOpacity,
    "--node-mode-filter": modeFilter,
    "--node-selected-transform": isSelected ? "translateY(-2px)" : "translateY(0)",
  } as React.CSSProperties;

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
        ...nodeStyleVars,
        borderRadius: 8,
        padding: "10px 12px",
        minWidth: 180,
        maxWidth: 240,
        background: "white",
        border: `1px solid #E2E8F0`,
        borderRight: `3px solid ${color}`,
        boxShadow: shadow,
        opacity: "var(--node-mode-opacity)",
        filter: "var(--node-mode-filter)",
        transition: "box-shadow 180ms ease, transform 120ms ease, opacity 180ms ease",
        animation: "outliner-node-enter 560ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
        animationDelay: `${Math.min(420, enterIndex * 34)}ms`,
        cursor: "pointer",
        transform: "var(--node-selected-transform)",
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
      <SourceChips item={node} onBlockClick={onBlockClick} compact />
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
    <section
      className="h-full min-h-0 w-full px-3 py-3 lg:px-5 lg:py-4"
      data-surface-id={surface.id}
      data-surface-type={surface.surfaceType}
      data-algorithm-shape={surface.algorithmShape}
      dir="rtl"
      lang="fa"
    >
      {children}
    </section>
  );
}

function SourceChips({
  item,
  onBlockClick,
  compact = false,
}: {
  item: unknown;
  onBlockClick?: (blockId: string) => void;
  compact?: boolean;
}) {
  const blocks = linkedBlockIds(item);
  if (blocks.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {blocks.map((blockId, index) => (
        <button
          key={`${blockId}-${index}`}
          type="button"
          data-linked-block-id={blockId}
          onClick={() => onBlockClick?.(blockId)}
          className={cn(
            "rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-teal-300 hover:text-teal-700",
            compact ? "min-h-6 px-2 text-[10px]" : "min-h-7 px-2.5 text-[11px]",
          )}
        >
          Source {index + 1}
        </button>
      ))}
    </div>
  );
}

function RecordLine({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: unknown;
  tone?: "slate" | "emerald" | "rose" | "amber" | "teal";
}) {
  if (typeof value !== "string" || !value.trim()) return null;
  const colors: Record<typeof tone, string> = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    teal: "border-teal-200 bg-teal-50 text-teal-900",
  };
  return (
    <div className={cn("rounded-lg border px-3 py-2", colors[tone])}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-0.5 text-[12px] leading-6">{value}</p>
    </div>
  );
}

function RelatedObjectsPanel({
  surface,
  onBlockClick,
}: {
  surface: AlgorithmSurface;
  onBlockClick?: (blockId: string) => void;
}) {
  const groups = getSurfaceObjectGroups(surface);
  const hasContext =
    groups.nodes + groups.thresholds + groups.gates + groups.boardTraps + groups.checkpoints + groups.followUpRules + groups.complicationRules + groups.mediaLinks > 0;
  if (!hasContext) return null;
  return (
    <div className="mt-5 rounded-lg border border-slate-200 bg-white/80 p-3 shadow-sm">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Clinical context</p>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {(surface.nodes ?? []).slice(0, 8).map((node) => (
          <div key={node.nodeId} data-node-id={node.nodeId} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-[12px] font-semibold text-slate-900">{node.label}</p>
            {node.testablePoint && <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-600">{node.testablePoint}</p>}
            <SourceChips item={node} onBlockClick={onBlockClick} compact />
          </div>
        ))}
        {[...(surface.thresholds ?? []), ...(surface.gates ?? []), ...(surface.boardTraps ?? []), ...(surface.checkpoints ?? [])].slice(0, 12).map((item, index) => (
          <div key={objectId(item, `context-${index + 1}`)} className="rounded-lg border border-slate-100 bg-white px-3 py-2">
            <p className="text-[12px] font-semibold text-slate-900">{titleOf(item, `Item ${index + 1}`)}</p>
            <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-600">
              {readString(item, ["conditionText", "entryCondition", "wrongPath", "prompt", "decisionImpact", "whyItMatters"]) ?? ""}
            </p>
            <SourceChips item={item} onBlockClick={onBlockClick} compact />
          </div>
        ))}
      </div>
    </div>
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
  const [revealCursor, setRevealCursor] = useState(0);
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

  const revealSequence = useMemo(
    () => buildGraphRevealSequence(layout.nodes, layout.edges, entryLayoutNode?.node.nodeId),
    [entryLayoutNode?.node.nodeId, layout.edges, layout.nodes],
  );

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setRevealCursor(revealSequence.length);
      return;
    }

    setRevealCursor(0);
    const timers = revealSequence.map((_, index) =>
      window.setTimeout(() => {
        setRevealCursor(index + 1);
      }, 140 + index * 280),
    );
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [revealSequence, surface.id]);

  const visibleGraph = useMemo(() => {
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();
    for (const event of revealSequence.slice(0, revealCursor)) {
      if (event.kind === "node") nodeIds.add(event.id);
      else edgeIds.add(event.id);
    }
    return {
      nodeIds,
      edgeIds,
      nodes: layout.nodes.filter((ln) => nodeIds.has(ln.node.nodeId)),
      edges: layout.edges.filter((le) => edgeIds.has(le.edge.edgeId)),
    };
  }, [layout.edges, layout.nodes, revealCursor, revealSequence]);

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
          from {
            opacity: 0;
            filter: blur(5px) saturate(0.94);
            transform: translateY(14px) scale(0.965);
          }
          to {
            opacity: var(--node-mode-opacity, 1);
            filter: var(--node-mode-filter, none);
            transform: var(--node-selected-transform, translateY(0));
          }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-node-id] {
            animation: none !important;
          }
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
                layoutEdges={visibleGraph.edges}
                layoutNodes={visibleGraph.nodes}
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
                layoutEdges={visibleGraph.edges}
                surfaceId={surface.id}
                selectedNodeId={selectedNodeId}
                visitedPath={visitedPath}
                canvasWidth={layout.canvasWidth}
                canvasHeight={layout.canvasHeight}
              />
            )}

            {/* ── DOM node cards ── */}
            {!lodMode && visibleGraph.nodes.map((ln) => {
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
                  enterIndex={0}
                  onClick={handleSelectNode}
                  onBlockClick={onBlockClick}
                  onContextMenu={handleNodeContextMenu}
                />
              );
            })}

            {/* ── Edge condition labels ── */}
            {!lodMode && visibleGraph.edges
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
                  <SourceChips item={node} onBlockClick={onBlockClick} compact />
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
              dir="rtl" lang="fa" data-node-id={v4.nodeId}
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
                <SourceChips item={v4} onBlockClick={onBlockClick} compact />
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

export function DecisionTreeRenderer(props: { surface: AlgorithmSurface; onBlockClick?: (blockId: string) => void }) {
  return <DagRenderer {...props} />;
}

export function BranchingPathwayRenderer({
  surface,
  onBlockClick,
}: {
  surface: AlgorithmSurface;
  onBlockClick?: (blockId: string) => void;
}) {
  const branchEdges = (surface.edges ?? []).filter((edge) =>
    ["yes_no", "threshold_split", "risk_split", "classification_branch", "exception_branch", "failure_branch"].includes(`${edge.edgeType ?? ""}`) || Boolean(edge.condition),
  );
  return (
    <SurfaceFrame surface={surface}>
      {branchEdges.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {branchEdges.slice(0, 10).map((edge) => (
            <span key={edge.edgeId} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">
              {edge.condition ?? edge.edgeType ?? "branch"}
            </span>
          ))}
        </div>
      )}
      <DagRenderer surface={surface} onBlockClick={onBlockClick} />
    </SurfaceFrame>
  );
}

export function LinearPathwayRenderer(props: { surface: AlgorithmSurface; onBlockClick?: (blockId: string) => void }) {
  return <ChainRenderer {...props} />;
}

export function MatrixRenderer({
  surface,
  onBlockClick,
}: {
  surface: AlgorithmSurface;
  onBlockClick?: (blockId: string) => void;
}) {
  return (
    <SurfaceFrame surface={surface}>
      {(surface.matrices ?? []).map((matrix) => (
        <div key={matrix.id} className="mb-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px] font-bold text-slate-950" dir="rtl" lang="fa">
            {matrix.title}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 bg-white text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 text-right">Condition</th>
                  <th className="px-3 py-2 text-right">Decision</th>
                  <th className="px-3 py-2 text-right">Reason</th>
                  <th className="px-3 py-2 text-right">Trap</th>
                  <th className="px-3 py-2 text-right">Source</th>
                </tr>
              </thead>
              <tbody>
                {(matrix.rows ?? []).map((row, i) => (
                  <tr key={`${matrix.id ?? "matrix"}-${i}`} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-700" dir="rtl">{row.condition ?? "-"}</td>
                    <td className="px-3 py-2 font-semibold text-slate-950" dir="rtl">{row.decision ?? "-"}</td>
                    <td className="px-3 py-2 text-slate-700" dir="rtl">{row.reason ?? "-"}</td>
                    <td className="px-3 py-2 text-rose-700" dir="rtl">{row.trap ?? "-"}</td>
                    <td className="px-3 py-2"><SourceChips item={row} onBlockClick={onBlockClick} compact /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <RelatedObjectsPanel surface={{ ...surface, matrices: [] }} onBlockClick={onBlockClick} />
    </SurfaceFrame>
  );
}

export function LadderRenderer({
  surface,
  onBlockClick,
}: {
  surface: AlgorithmSurface;
  onBlockClick?: (blockId: string) => void;
}) {
  const thresholdNodes = (surface.nodes ?? []).filter((node) => ["threshold", "risk_group", "classification"].includes(`${node.nodeType ?? ""}`));
  const steps: AlgorithmRecord[] = [...(surface.thresholds ?? []), ...thresholdNodes];
  return (
    <SurfaceFrame surface={surface}>
      <div className="relative mx-auto max-w-4xl space-y-3 before:absolute before:right-[15px] before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-amber-200">
        {steps.map((step, index) => (
          <article key={objectId(step, `ladder-${index + 1}`)} data-node-id={typeof step.nodeId === "string" ? step.nodeId : undefined} className="relative mr-10 rounded-lg border border-amber-200 bg-white p-4 shadow-sm">
            <span className="absolute -right-10 top-4 grid h-8 w-8 place-items-center rounded-full border border-amber-300 bg-amber-50 text-[11px] font-black text-amber-700">{index + 1}</span>
            <p className="text-[14px] font-bold text-slate-950">{readString(step, ["variable", "label", "title"]) ?? `Step ${index + 1}`}</p>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              <RecordLine label="Value" value={readString(step, ["value", "threshold"])} tone="amber" />
              <RecordLine label="Condition" value={readString(step, ["conditionText", "condition", "detail"])} />
              <RecordLine label="Decision impact" value={readString(step, ["decisionImpact", "impact", "testablePoint"])} tone="teal" />
            </div>
            <SourceChips item={step} onBlockClick={onBlockClick} />
          </article>
        ))}
      </div>
      <RelatedObjectsPanel surface={{ ...surface, thresholds: [], nodes: (surface.nodes ?? []).filter((node) => !thresholdNodes.includes(node)) }} onBlockClick={onBlockClick} />
    </SurfaceFrame>
  );
}

export function TimelineRenderer({ surface, onBlockClick }: { surface: AlgorithmSurface; onBlockClick?: (blockId: string) => void }) {
  const items: AlgorithmRecord[] = [...recordArray(surface.followUpRules), ...(surface.nodes ?? []).filter((node) => node.nodeType === "follow_up")];
  return (
    <SurfaceFrame surface={surface}>
      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((item, index) => (
          <article key={objectId(item, `timeline-${index + 1}`)} data-node-id={typeof item.nodeId === "string" ? item.nodeId : undefined} className="rounded-lg border border-teal-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-teal-600">Follow-up {index + 1}</p>
            <p className="mt-1 text-[14px] font-bold text-slate-950">{readString(item, ["startPoint", "label", "title"]) ?? "Timeline item"}</p>
            <div className="mt-3 grid gap-2">
              <RecordLine label="Interval" value={readString(item, ["interval"])} tone="teal" />
              <RecordLine label="Monitor" value={readString(item, ["monitor", "detail"])} />
              <RecordLine label="Trigger" value={readString(item, ["trigger"])} tone="amber" />
              <RecordLine label="Action if triggered" value={readString(item, ["actionIfTriggered", "testablePoint"])} tone="emerald" />
            </div>
            <SourceChips item={item} onBlockClick={onBlockClick} />
          </article>
        ))}
      </div>
      <RelatedObjectsPanel surface={{ ...surface, followUpRules: [], nodes: (surface.nodes ?? []).filter((node) => node.nodeType !== "follow_up") }} onBlockClick={onBlockClick} />
    </SurfaceFrame>
  );
}

export function ContrastMapRenderer({ surface, onBlockClick }: { surface: AlgorithmSurface; onBlockClick?: (blockId: string) => void }) {
  return (
    <SurfaceFrame surface={surface}>
      <div className="space-y-3">
        {(surface.boardTraps ?? []).map((trap, index) => (
          <article key={objectId(trap, `trap-${index + 1}`)} className="overflow-hidden rounded-lg border border-rose-200 bg-white shadow-sm">
            <div className="border-b border-rose-100 bg-rose-50 px-4 py-2.5">
              <p className="text-[13px] font-bold text-rose-700">{readString(trap, ["trapTitle"]) ?? "Board trap"}</p>
            </div>
            <div className="grid gap-0 md:grid-cols-3">
              <div className="border-b border-slate-100 p-3 md:border-b-0 md:border-l"><RecordLine label="Wrong path" value={trap.wrongPath} tone="rose" /></div>
              <div className="border-b border-slate-100 p-3 md:border-b-0 md:border-l"><RecordLine label="Correct path" value={trap.correctPath} tone="emerald" /></div>
              <div className="p-3">
                <RecordLine label="Why it matters" value={trap.whyItMatters} tone="amber" />
                <SourceChips item={trap} onBlockClick={onBlockClick} />
              </div>
            </div>
          </article>
        ))}
      </div>
      {(surface.nodes ?? []).length > 0 && (
        <div className="mt-5">
          <ChainRenderer surface={{ ...surface, boardTraps: [] }} onBlockClick={onBlockClick} />
        </div>
      )}
    </SurfaceFrame>
  );
}

export function ClusterRenderer({ surface, onBlockClick }: { surface: AlgorithmSurface; onBlockClick?: (blockId: string) => void }) {
  const cards = [
    ...(surface.checkpoints ?? []),
    ...(surface.nodes ?? []).filter((node) => ["concept", "mechanism", "clinical_effect"].includes(node.nodeType)),
    ...recordArray(surface.mediaLinks),
    ...(surface.boardTraps ?? []),
  ];
  return (
    <SurfaceFrame surface={surface}>
      <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.3fr)]">
        <div className="grid place-items-center rounded-lg border border-teal-200 bg-teal-50 p-6 text-center">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700">Core concept</p>
            <p className="mt-2 text-[18px] font-black leading-8 text-slate-950">{surface.title}</p>
            {surface.memoryAnchor && <p className="mt-2 text-[12px] leading-6 text-teal-900">{surface.memoryAnchor}</p>}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {cards.map((card, index) => (
            <article key={objectId(card, `cluster-${index + 1}`)} data-node-id={typeof card.nodeId === "string" ? card.nodeId : undefined} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-[13px] font-bold text-slate-950">{titleOf(card, `Memory card ${index + 1}`)}</p>
              <p className="mt-1 line-clamp-3 text-[12px] leading-6 text-slate-600">{readString(card, ["detail", "answer", "whyItMatters", "testablePoint", "caption", "wrongPath"]) ?? ""}</p>
              <SourceChips item={card} onBlockClick={onBlockClick} compact />
            </article>
          ))}
        </div>
      </div>
    </SurfaceFrame>
  );
}

export function GateRenderer({ surface, onBlockClick }: { surface: AlgorithmSurface; onBlockClick?: (blockId: string) => void }) {
  return (
    <SurfaceFrame surface={surface}>
      <div className="grid gap-3 lg:grid-cols-2">
        {(surface.gates ?? []).map((gate, index) => (
          <article key={objectId(gate, `gate-${index + 1}`)} className="rounded-lg border border-amber-200 bg-white p-4 shadow-sm">
            <p className="text-[14px] font-bold text-slate-950">{gate.title ?? `Gate ${index + 1}`}</p>
            <RecordLine label="Entry condition" value={gate.entryCondition} tone="amber" />
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {(gate.includeCriteria ?? []).length > 0 && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Include</p>
                  {(gate.includeCriteria ?? []).map((item) => <p key={item} className="mt-1 text-[12px] leading-5 text-emerald-900">{item}</p>)}
                </div>
              )}
              {(gate.excludeCriteria ?? []).length > 0 && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-rose-700">Exclude</p>
                  {(gate.excludeCriteria ?? []).map((item) => <p key={item} className="mt-1 text-[12px] leading-5 text-rose-900">{item}</p>)}
                </div>
              )}
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <RecordLine label="Pass" value={gate.actionIfPass} tone="emerald" />
              <RecordLine label="Fail" value={gate.actionIfFail} tone="rose" />
            </div>
            {(gate.exceptions ?? []).length > 0 && (
              <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-orange-700">Exceptions</p>
                {(gate.exceptions ?? []).map((item) => <p key={item} className="mt-1 text-[12px] leading-5 text-orange-900">{item}</p>)}
              </div>
            )}
            <SourceChips item={gate} onBlockClick={onBlockClick} />
          </article>
        ))}
      </div>
      <RelatedObjectsPanel surface={{ ...surface, gates: [] }} onBlockClick={onBlockClick} />
    </SurfaceFrame>
  );
}

export function ComplicationEscalationRenderer({ surface, onBlockClick }: { surface: AlgorithmSurface; onBlockClick?: (blockId: string) => void }) {
  const items: AlgorithmRecord[] = [...recordArray(surface.complicationRules), ...(surface.nodes ?? []).filter((node) => ["complication", "escalation", "action"].includes(node.nodeType))];
  return (
    <SurfaceFrame surface={surface}>
      <div className="space-y-3">
        {items.map((item, index) => (
          <article key={objectId(item, `complication-${index + 1}`)} data-node-id={typeof item.nodeId === "string" ? item.nodeId : undefined} className="rounded-lg border border-rose-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-rose-600">Escalation path {index + 1}</p>
            <p className="mt-1 text-[14px] font-bold text-slate-950">{readString(item, ["label", "title", "recognition"]) ?? "Complication rule"}</p>
            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <RecordLine label="Recognition" value={readString(item, ["recognition", "detail"])} />
              <RecordLine label="Severity" value={readString(item, ["severity"])} tone="amber" />
              <RecordLine label="Immediate action" value={readString(item, ["immediateAction", "testablePoint"])} tone="rose" />
              <RecordLine label="Escalation" value={readString(item, ["escalationPath", "actionIfTriggered"])} tone="rose" />
            </div>
            <SourceChips item={item} onBlockClick={onBlockClick} />
          </article>
        ))}
      </div>
      <RelatedObjectsPanel surface={{ ...surface, complicationRules: [], nodes: (surface.nodes ?? []).filter((node) => !["complication", "escalation", "action"].includes(node.nodeType)) }} onBlockClick={onBlockClick} />
    </SurfaceFrame>
  );
}

export function MediaRecognitionRenderer({ surface, onBlockClick }: { surface: AlgorithmSurface; onBlockClick?: (blockId: string) => void }) {
  const media = [...recordArray(surface.mediaLinks), ...recordArray(surface.mediaRefs)];
  return (
    <SurfaceFrame surface={surface}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {media.map((item, index) => (
          <article key={objectId(item, `media-${index + 1}`)} className="rounded-lg border border-sky-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-sky-600">{readString(item, ["type"]) ?? "Media anchor"}</p>
            <p className="mt-1 text-[14px] font-bold text-slate-950">{readString(item, ["title", "label"]) ?? `Media ${index + 1}`}</p>
            <p className="mt-2 min-h-12 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-[12px] leading-6 text-sky-900">
              {readString(item, ["caption", "detail", "uri"]) ?? "Image/table asset is not available in this viewer yet."}
            </p>
            <SourceChips item={item} onBlockClick={onBlockClick} />
          </article>
        ))}
      </div>
      <RelatedObjectsPanel surface={{ ...surface, mediaLinks: [], mediaRefs: [] }} onBlockClick={onBlockClick} />
    </SurfaceFrame>
  );
}

export function CombinedSurfaceRenderer({ surface, onBlockClick }: { surface: AlgorithmSurface; onBlockClick?: (blockId: string) => void }) {
  const groups = getSurfaceObjectGroups(surface);
  const sections: Array<{ key: string; label: string; show: boolean; node: React.ReactNode }> = [
    { key: "pathway", label: "Pathway", show: groups.nodes > 0, node: groups.edges > 0 ? <DagRenderer surface={surface} onBlockClick={onBlockClick} /> : <ChainRenderer surface={surface} onBlockClick={onBlockClick} /> },
    { key: "matrix", label: "Matrix", show: groups.matrices > 0, node: <MatrixRenderer surface={surface} onBlockClick={onBlockClick} /> },
    { key: "gates", label: "Gates", show: groups.gates > 0, node: <GateRenderer surface={surface} onBlockClick={onBlockClick} /> },
    { key: "thresholds", label: "Thresholds", show: groups.thresholds > 0, node: <LadderRenderer surface={surface} onBlockClick={onBlockClick} /> },
    { key: "traps", label: "Traps", show: groups.boardTraps > 0, node: <ContrastMapRenderer surface={surface} onBlockClick={onBlockClick} /> },
    { key: "follow-up", label: "Follow-up", show: groups.followUpRules > 0, node: <TimelineRenderer surface={surface} onBlockClick={onBlockClick} /> },
    { key: "complications", label: "Complications", show: groups.complicationRules > 0, node: <ComplicationEscalationRenderer surface={surface} onBlockClick={onBlockClick} /> },
    { key: "checkpoints", label: "Checkpoints", show: groups.checkpoints > 0, node: <ClusterRenderer surface={surface} onBlockClick={onBlockClick} /> },
    { key: "media", label: "Media", show: groups.mediaLinks > 0, node: <MediaRecognitionRenderer surface={surface} onBlockClick={onBlockClick} /> },
  ].filter((section) => section.show);
  const [active, setActive] = useState(sections[0]?.key ?? "pathway");
  const activeSection = sections.find((section) => section.key === active) ?? sections[0];
  return (
    <SurfaceFrame surface={surface}>
      <div className="mb-3 flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1">
        {sections.map((section) => (
          <button key={section.key} type="button" onClick={() => setActive(section.key)} className={cn("min-h-8 shrink-0 rounded-md px-3 text-[11px] font-semibold transition", activeSection?.key === section.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50")}>
            {section.label}
          </button>
        ))}
      </div>
      {activeSection?.node ?? <CardGridRenderer surface={surface} onBlockClick={onBlockClick} />}
    </SurfaceFrame>
  );
}

export const SurfaceRendererRegistry: Record<SurfaceRendererKey, React.FC<{
  surface: AlgorithmSurface;
  onBlockClick?: (blockId: string) => void;
}>> = {
  decision_tree: DecisionTreeRenderer,
  branching_pathway: BranchingPathwayRenderer,
  linear_pathway: LinearPathwayRenderer,
  matrix: MatrixRenderer,
  ladder: LadderRenderer,
  timeline: TimelineRenderer,
  contrast_map: ContrastMapRenderer,
  chain: ChainRenderer,
  cluster: ClusterRenderer,
  combined: CombinedSurfaceRenderer,
  trap_map: ContrastMapRenderer,
  gate: GateRenderer,
  follow_up: TimelineRenderer,
  complication_escalation: ComplicationEscalationRenderer,
  media_recognition: MediaRecognitionRenderer,
  generic_graph: DagRenderer,
  card_grid: CardGridRenderer,
};

// ── renderSurface dispatcher ──────────────────────────────────────────────────

export function renderSurface(
  surface?: AlgorithmSurface,
  onBlockClick?: (blockId: string) => void,
): React.ReactNode | null {
  if (!surface) return null;
  const key = getSurfaceRendererKey(surface);
  const Renderer = SurfaceRendererRegistry[key] ?? CardGridRenderer;
  return <Renderer surface={surface} onBlockClick={onBlockClick} />;
}

export const renderAlgorithmSurface = renderSurface;

// ── Re-export nodeType role labels for use in LearningPanel ──────────────────
export { NODE_TYPE_ROLE_LABELS, NODE_COLORS, MEMORY_ROLE_PILLS, EDGE_STYLES, DEFAULT_EDGE_STYLE };
export type { EdgeStyle };
