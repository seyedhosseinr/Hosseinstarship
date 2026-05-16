"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { cn } from "@/lib/utils";
import { useAlgorithmLayout, NODE_W, NODE_H } from "@/components/algorithms/useAlgorithmLayout";
import { AlgorithmEdgeLayer } from "@/components/algorithms/AlgorithmEdgeLayer";
import { OutlinerWebGLCanvas, LOD_THRESHOLD } from "@/components/outliner/OutlinerWebGLCanvas";
import { getNodeTypeLabel, type AlgorithmNodeV4, type AlgorithmEdgeV4 } from "@/types/algorithm-ir-v4";
import type { AlgorithmSurface } from "@/types/algorithm-ir";
import { readString } from "@/components/outliner/surface-families";
import { useOutlinerStore } from "@/components/outliner/outliner-store";

// ── Clinical Cognition Layer — learning helpers ───────────────────────────────

// F1: BFS backwards through edges to find every ancestor of targetNodeId
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

// F6: educational heat 0-1 for a node from its metadata — no fake importance
function nodeEduHeat(node: AlgorithmNodeV4, cpCount: number): number {
  let h = 0;
  if (node.nodeType === "trap" || node.memoryRole === "trap") h += 0.40;
  else if (node.nodeType === "escalation")                    h += 0.30;
  else if (node.nodeType === "threshold")                     h += 0.20;
  else if (node.nodeType === "question" || node.nodeType === "test") h += 0.14;
  if (node.testablePoint)                                     h += 0.25;
  if ((node.linkedBlockIds ?? []).length > 0)                 h += 0.10;
  if (cpCount > 0)                                            h += 0.15;
  // Return 0 (neutral) when no meaningful metadata exists — no invented importance
  return h > 0 ? Math.min(1.0, h) : 0;
}

// ── Node type styles — Apple-HIG palette ─────────────────────────────────────

interface NodeStyle {
  stripe: string;   // top accent strip bg class
  card:   string;   // border + bg
  badge:  string;   // type label text color
  glow?:  string;   // optional shadow for urgent types
}

const NODE_STYLES: Record<string, NodeStyle> = {
  entry:          { stripe: "bg-blue-500",    card: "bg-blue-50/98 dark:bg-blue-950/90 border-blue-300/70 dark:border-blue-600/70",       badge: "text-blue-700 dark:text-blue-300" },
  question:       { stripe: "bg-violet-500",  card: "bg-violet-50/98 dark:bg-violet-950/90 border-violet-300/70 dark:border-violet-600/70", badge: "text-violet-700 dark:text-violet-300" },
  test:           { stripe: "bg-sky-500",     card: "bg-sky-50/98 dark:bg-sky-950/90 border-sky-300/70 dark:border-sky-600/70",           badge: "text-sky-700 dark:text-sky-300" },
  finding:        { stripe: "bg-slate-500",   card: "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600",                 badge: "text-slate-700 dark:text-slate-300" },
  threshold:      { stripe: "bg-amber-500",   card: "bg-amber-50/98 dark:bg-amber-950/90 border-amber-300/75 dark:border-amber-600/70",   badge: "text-amber-700 dark:text-amber-300" },
  treatment:      { stripe: "bg-green-500",   card: "bg-green-50/98 dark:bg-green-950/90 border-green-300/70 dark:border-green-600/70",   badge: "text-green-700 dark:text-green-300" },
  escalation:     { stripe: "bg-red-500",     card: "bg-red-50/98 dark:bg-red-950/90 border-red-300/80 dark:border-red-600/75",           badge: "text-red-700 dark:text-red-300", glow: "shadow-[0_0_0_1px_rgba(239,68,68,0.12)]" },
  endpoint:       { stripe: "bg-slate-600",   card: "bg-slate-50/98 dark:bg-slate-900 border-slate-300 dark:border-slate-600",           badge: "text-slate-700 dark:text-slate-300" },
  trap:           { stripe: "bg-rose-500",    card: "bg-rose-50/98 dark:bg-rose-950/90 border-rose-300/80 dark:border-rose-600/75",       badge: "text-rose-700 dark:text-rose-300", glow: "shadow-[0_0_0_1px_rgba(244,63,94,0.12)]" },
  exception:      { stripe: "bg-orange-500",  card: "bg-orange-50/98 dark:bg-orange-950/90 border-orange-300/75 dark:border-orange-600/70", badge: "text-orange-700 dark:text-orange-300" },
  mechanism:      { stripe: "bg-purple-500",  card: "bg-purple-50/98 dark:bg-purple-950/90 border-purple-300/70 dark:border-purple-600/70", badge: "text-purple-700 dark:text-purple-300" },
  clinical_effect:{ stripe: "bg-teal-500",    card: "bg-teal-50/98 dark:bg-teal-950/90 border-teal-300/70 dark:border-teal-600/70",       badge: "text-teal-700 dark:text-teal-300" },
  classification: { stripe: "bg-indigo-500",  card: "bg-indigo-50/98 dark:bg-indigo-950/90 border-indigo-300/70 dark:border-indigo-600/70", badge: "text-indigo-700 dark:text-indigo-300" },
};

const DEFAULT_STYLE: NodeStyle = {
  stripe: "bg-border",
  card:   "bg-card border-border/70",
  badge:  "text-foreground/70",
};

function getNodeStyle(nodeType: string): NodeStyle {
  return NODE_STYLES[nodeType] ?? DEFAULT_STYLE;
}

// ── DAG node card — compact Apple-style ───────────────────────────────────────

interface OutlinerDagNodeCardProps {
  node: AlgorithmNodeV4;
  surfaceId: string;
  x: number;
  y: number;
  isSelected: boolean;
  isConnected: boolean;
  isInPath: boolean;
  // Clinical Cognition Layer props — all optional so existing code paths are safe
  isAncestorPath?: boolean;  // F1: node is on clinical path from root to selected
  isNextDecision?: boolean;  // F2: node is the next step to decide from selected
  hasEvidence?: boolean;     // F4: node has source/ref anchors
  hasCheckpoint?: boolean;   // F5: node is linked to a checkpoint/flashcard
  onClick: (nodeId: string) => void;
  onBlockClick?: (blockId: string) => void;
}

function OutlinerDagNodeCard({
  node, surfaceId, x, y,
  isSelected, isConnected, isInPath,
  isAncestorPath = false, isNextDecision = false,
  hasEvidence = false, hasCheckpoint = false,
  onClick, onBlockClick,
}: OutlinerDagNodeCardProps) {
  const style   = getNodeStyle(node.nodeType);
  const isTrap  = node.nodeType === "trap" || node.memoryRole === "trap";
  const notDim  = isSelected || isConnected || isInPath || isAncestorPath || isNextDecision;

  return (
    <div
      role="button"
      tabIndex={0}
      dir="rtl"
      lang="fa"
      aria-current={isSelected ? "true" : undefined}
      data-surface-id={surfaceId}
      data-node-id={node.nodeId}
      onClick={() => onClick(node.nodeId)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(node.nodeId); }}
      style={{ position: "absolute", left: x, top: y, width: NODE_W, minHeight: NODE_H, zIndex: 2 }}
      className={cn(
        "overflow-hidden rounded-lg border cursor-pointer",
        "transition-all duration-150 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        "shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.06)]",
        style.card,
        style.glow,
        // F0: selected node — primary ring, lifted
        isSelected && "ring-2 ring-offset-2 ring-primary border-primary/80 shadow-[0_4px_16px_rgba(15,23,42,0.14)] scale-[1.02] z-30",
        // F2: next-decision — emerald ring signals "decide here next"
        !isSelected && isNextDecision && "ring-2 ring-emerald-500/70 border-emerald-500/70 shadow-[0_2px_10px_rgba(52,211,153,0.16)] z-20",
        // F1: ancestor path — subtle primary ring traces the clinical route
        !isSelected && !isNextDecision && isAncestorPath && "ring-1 ring-blue-500/45 border-blue-400/60 bg-blue-50/95 dark:bg-blue-950/90",
        // Study Clarity Mode: unrelated branches recede without blurring or washing out text.
        !notDim && "opacity-85",
      )}
    >
      {/* ── Colored top stripe — F3: trap nodes pulse to signal board risk ── */}
      <div className={cn("h-[3px] w-full shrink-0", style.stripe, isTrap && "animate-pulse")} />

      {/* ── Card body ── */}
      <div className="px-2.5 pb-2 pt-1.5">
        {/* Type badge + learning markers row */}
        <div className="mb-0.5 flex items-center gap-1 flex-wrap">
          <span className={cn("text-[10px] font-bold uppercase tracking-wide shrink-0", style.badge)}>
            {getNodeTypeLabel(node.nodeType)}
          </span>
          {/* F3: trap/warning signal — pulsing indicator */}
          {isTrap && (
            <span className="animate-pulse text-[9px] font-bold text-rose-700 dark:text-rose-300 shrink-0">دام</span>
          )}
          {/* F4: evidence/source pulse — sky dot for source-anchored nodes */}
          {hasEvidence && (
            <span
              title="source evidence"
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400"
            />
          )}
          {/* F5: MCQ/flashcard link marker */}
          {hasCheckpoint && (
            <span className="shrink-0 rounded border border-emerald-400/45 bg-emerald-50/80 px-1 text-[8px] font-bold leading-4 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
              ✓
            </span>
          )}
          {/* F2: "next" badge on the target node (supplement to ring) */}
          {isNextDecision && !isSelected && (
            <span className="shrink-0 rounded bg-emerald-600 px-1 text-[8px] font-bold leading-4 text-white">
              بعدی
            </span>
          )}
        </div>

        {/* Label */}
        <p className="text-[13px] font-semibold leading-snug text-foreground">{node.label}</p>

        {/* Detail — 2 lines max */}
        {node.detail && (
          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-foreground/75">
            {node.detail}
          </p>
        )}

        {/* Testable point */}
        {node.testablePoint && (
          <p className="mt-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 line-clamp-1">
            نکته بوردی: {node.testablePoint}
          </p>
        )}

        {/* Source chips */}
        {(node.linkedBlockIds ?? []).length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {(node.linkedBlockIds ?? []).slice(0, 3).map((blockId, idx) => (
              <span
                key={blockId}
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onBlockClick?.(blockId); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onBlockClick?.(blockId); } }}
                className="cursor-pointer rounded border border-sky-400/50 bg-sky-50 px-1.5 py-0.5 text-[9px] font-semibold text-sky-700 hover:border-sky-500 dark:bg-sky-950/70 dark:text-sky-300"
              >
                ref {idx + 1}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Surface header ────────────────────────────────────────────────────────────

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

// ── Shared frame ──────────────────────────────────────────────────────────────

function SurfaceFrame({ surface, children }: { surface: AlgorithmSurface; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-6xl p-3" data-surface-id={surface.id}>
      <SurfaceHeader surface={surface} />
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
              {gate.actionIfFail  && <span className="text-rose-600 dark:text-rose-400">✗ {gate.actionIfFail}</span>}
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

// ── Selected node inspector panel ─────────────────────────────────────────────

function learningRoleLabel(node: AlgorithmNodeV4): string {
  if (node.nodeType === "entry") return "ورود";
  if (node.nodeType === "trap" || node.memoryRole === "trap") return "دام";
  if (node.nodeType === "treatment" || node.nodeType === "escalation") return "اقدام";
  if (node.nodeType === "endpoint") return "پایان";
  return "تصمیم";
}

function selectedTrapSummary(surface: AlgorithmSurface, node: AlgorithmNodeV4): string {
  const direct = (surface.boardTraps ?? []).find((trap) => (trap.linkedNodeIds ?? []).includes(node.nodeId));
  if (direct) return readString(direct, ["trapTitle", "wrongPath", "whyItMatters"]) ?? "دام ثبت شده برای این گره";
  if (node.nodeType === "trap" || node.memoryRole === "trap") return node.testablePoint ?? node.detail ?? node.label;
  return "ثبت نشده";
}

function SelectedNodePanel({
  surface,
  node,
  nextNodes,
  checkpointCount,
  onBlockClick,
}: {
  surface: AlgorithmSurface;
  node: AlgorithmNodeV4 | undefined;
  nextNodes: AlgorithmNodeV4[];
  checkpointCount: number;
  onBlockClick?: (blockId: string) => void;
}) {
  if (!node) {
    return (
      <div className="mt-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm" dir="rtl" lang="fa">
        <p className="text-[13px] font-semibold leading-7 text-foreground">
          برای شروع، یک کارت الگوریتم را انتخاب کنید تا مسیر بالینی، تصمیم بعدی و دام‌های بوردی نمایش داده شود.
        </p>
      </div>
    );
  }

  const style = getNodeStyle(node.nodeType);
  const nextDecision = nextNodes.length > 0
    ? nextNodes.map((next) => next.label).join(" / ")
    : "تصمیم بعدی مستقیم ثبت نشده";
  const hasSource = (node.linkedBlockIds ?? []).length > 0 || !!node.sourceSupport;
  const hasCheckpoint = checkpointCount > 0;

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-primary/40 bg-card shadow-sm">
      <div className={cn("h-[3px] w-full", style.stripe)} />
      <div className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]" dir="rtl" lang="fa">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-primary">پنل یادگیری گره انتخاب‌شده</p>
          <p className="text-[15px] font-bold leading-7 text-foreground">{node.label}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <LearningPill label="نقش آموزشی" value={learningRoleLabel(node)} />
            <LearningPill label="منبع/ref" value={hasSource ? "دارد" : "ندارد"} tone={hasSource ? "source" : "neutral"} />
            <LearningPill label="checkpoint/MCQ/flashcard" value={hasCheckpoint ? `${checkpointCount}` : "ندارد"} tone={hasCheckpoint ? "review" : "neutral"} />
          </div>
        </div>

        <div className="grid gap-2 text-[12px] leading-6">
          <LearningFact label="چرا مهم است؟" value={node.testablePoint ?? node.detail ?? node.sourceSupport ?? "نکته جداگانه‌ای ثبت نشده"} />
          <LearningFact label="تصمیم بعدی چیست؟" value={nextDecision} tone="next" />
          <LearningFact label="دام امتحانی مرتبط چیست؟" value={selectedTrapSummary(surface, node)} tone="trap" />
        </div>

        {node.sourceSupport && (
          <p className="md:col-span-2 text-[11px] leading-6 text-foreground/70">{node.sourceSupport}</p>
        )}
        {(node.linkedBlockIds ?? []).length > 0 && (
          <div className="md:col-span-2 flex flex-wrap gap-1.5">
            {(node.linkedBlockIds ?? []).map((blockId, idx) => (
              <button
                key={blockId}
                type="button"
                onClick={() => onBlockClick?.(blockId)}
                className="min-h-7 rounded-md border border-sky-400/50 bg-sky-50 px-2 text-[10px] font-semibold text-sky-700 hover:border-sky-500 dark:bg-sky-950/70 dark:text-sky-300"
              >
                منبع {idx + 1}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LearningPill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "source" | "review";
}) {
  return (
    <span className={cn(
      "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
      tone === "source" ? "border-sky-400/60 bg-sky-50 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300" :
      tone === "review" ? "border-amber-400/60 bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300" :
      "border-border/70 bg-background text-foreground/75",
    )}>
      {label}: {value}
    </span>
  );
}

function LearningFact({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "next" | "trap";
}) {
  return (
    <div className={cn(
      "rounded-lg border px-3 py-2",
      tone === "next" ? "border-emerald-400/50 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-100" :
      tone === "trap" ? "border-rose-400/50 bg-rose-50 text-rose-900 dark:bg-rose-950/70 dark:text-rose-100" :
      "border-border/60 bg-background text-foreground",
    )}>
      <span className="font-bold">{label} </span>
      <span>{value}</span>
    </div>
  );
}

// ── Edge condition label ───────────────────────────────────────────────────────

function EdgeConditionLabel({ label, x, y }: { label: string; x: number; y: number }) {
  return (
    <div
      dir="rtl"
      style={{ position: "absolute", left: x, top: y, transform: "translate(-50%,-50%)", zIndex: 25, pointerEvents: "none" }}
    >
      <span className="inline-block rounded-full border border-border/80 bg-background px-2 py-0.5 text-[10px] font-semibold text-foreground whitespace-nowrap shadow-sm">
        {label}
      </span>
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

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [visitedPath,    setVisitedPath]    = useState<string[]>([]);
  const [useWebGL,       setUseWebGL]       = useState(true);
  const [zoom,           setZoom]           = useState(1.0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const activateFocusPath = useOutlinerStore((s) => s.activateFocusPath);
  const handleWebGLFallback = useCallback(() => setUseWebGL(false), []);

  // ── Clinical Cognition Layer — memos ──────────────────────────────────────
  // F5: how many checkpoints link to each node (for MCQ/flashcard marker)
  const checkpointNodeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const cp of (surface.checkpoints ?? []) as Array<{ linkedNodeIds?: string[] }>) {
      for (const nid of cp.linkedNodeIds ?? []) {
        counts.set(nid, (counts.get(nid) ?? 0) + 1);
      }
    }
    return counts;
  }, [surface.checkpoints]);

  // F5: set of nodeIds with linked checkpoints
  const checkpointedNodes = useMemo(
    () => new Set(checkpointNodeCounts.keys()),
    [checkpointNodeCounts],
  );

  // F6: educational heat per nodeId — only when metadata justifies it
  const eduHeatMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const node of v4nodes) {
      const h = nodeEduHeat(node, checkpointNodeCounts.get(node.nodeId) ?? 0);
      if (h > 0.05) map.set(node.nodeId, h);
    }
    return map;
  }, [v4nodes, checkpointNodeCounts]);

  // F1: ancestor path — all node IDs from root to selected (BFS backwards)
  const ancestorPath = useMemo(
    () => selectedNodeId ? computeAncestorPath(v4edges, selectedNodeId) : new Set<string>(),
    [v4edges, selectedNodeId],
  );

  // F2: outgoing neighbors of selected node (next decisions)
  const nextDecisionNodes = useMemo(
    () => {
      if (!selectedNodeId) return new Set<string>();
      return new Set(v4edges.filter((e) => e.from === selectedNodeId).map((e) => e.to));
    },
    [v4edges, selectedNodeId],
  );

  // Stable arrays for WebGL props (avoid identity churn)
  const ancestorArr = useMemo(() => [...ancestorPath],      [ancestorPath]);
  const nextArr     = useMemo(() => [...nextDecisionNodes], [nextDecisionNodes]);
  // ─────────────────────────────────────────────────────────────────────────

  // Non-passive Ctrl+wheel zoom (prevents browser from intercepting)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      setZoom((z) => Math.max(0.25, Math.min(2.0, z * factor)));
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function handleSelectNode(nodeId: string) {
    if (selectedNodeId === nodeId) { setSelectedNodeId(null); return; }
    setSelectedNodeId(nodeId);
    setVisitedPath((prev) => prev.includes(nodeId) ? prev : [...prev, nodeId]);
    activateFocusPath(nodeId);
  }

  const connectedIds = new Set<string>();
  if (selectedNodeId) {
    for (const edge of v4edges) {
      if (edge.from === selectedNodeId) connectedIds.add(edge.to);
      if (edge.to   === selectedNodeId) connectedIds.add(edge.from);
    }
  }

  const selectedNode = v4nodes.find((n) => n.nodeId === selectedNodeId);
  const selectedNextNodes = selectedNodeId
    ? v4nodes.filter((node) => nextDecisionNodes.has(node.nodeId))
    : [];
  const selectedCheckpointCount = selectedNodeId ? checkpointNodeCounts.get(selectedNodeId) ?? 0 : 0;
  const visitedSet   = new Set(visitedPath);
  const lodMode      = zoom < LOD_THRESHOLD; // DOM cards hidden, WebGL quads take over

  return (
    <SurfaceFrame surface={surface}>
      <GateBanner surface={surface} />

      {/* ── Zoom hint ── */}
      {zoom !== 1.0 && (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted-foreground">Ctrl+scroll to zoom</span>
          <button
            type="button"
            onClick={() => setZoom(1.0)}
            className="rounded-full border border-border/50 bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
          >
            {Math.round(zoom * 100)}% · reset
          </button>
        </div>
      )}

      {/* ── Canvas scroll container ── */}
      <div
        ref={scrollRef}
        className="overflow-auto rounded-xl border border-border/30 shadow-inner"
        style={{ background: "var(--outliner-canvas-bg, #f6f7f9)", minHeight: "clamp(360px, 58vh, 680px)" }}
      >
        {/* Size proxy: tells the scroll container how big the zoomed content is */}
        <div style={{ width: layout.canvasWidth * zoom, height: layout.canvasHeight * zoom, position: "relative" }}>

          {/* Scaled content layer */}
          <div
            className="relative"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: layout.canvasWidth,
              height: layout.canvasHeight,
              transform: `scale(${zoom})`,
              transformOrigin: "0 0",
              backgroundImage: "radial-gradient(circle, var(--outliner-dot-color) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
            data-surface-id={surface.id}
          >
            {/* ── GPU layer — WebGL2 canvas (heatmap + edges + particles + LOD + DOF) ── */}
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

            {/* ── DOM node cards (hidden in LOD mode — WebGL quads take over) ── */}
            {!lodMode && layout.nodes.map((ln) => (
              <OutlinerDagNodeCard
                key={ln.node.nodeId}
                node={ln.node}
                surfaceId={surface.id}
                x={ln.x}
                y={ln.y}
                isSelected={ln.node.nodeId === selectedNodeId}
                isInPath={visitedSet.has(ln.node.nodeId)}
                isConnected={connectedIds.has(ln.node.nodeId)}
                isAncestorPath={ancestorPath.has(ln.node.nodeId) && ln.node.nodeId !== selectedNodeId}
                isNextDecision={nextDecisionNodes.has(ln.node.nodeId)}
                hasEvidence={(ln.node.linkedBlockIds ?? []).length > 0 || !!ln.node.sourceSupport}
                hasCheckpoint={checkpointedNodes.has(ln.node.nodeId)}
                onClick={handleSelectNode}
                onBlockClick={onBlockClick}
              />
            ))}

            {/* ── Edge condition labels (shown when edge is traversed or active) ── */}
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
                />
              ))}
          </div>
        </div>
      </div>

      <SelectedNodePanel
        surface={surface}
        node={selectedNode}
        nextNodes={selectedNextNodes}
        checkpointCount={selectedCheckpointCount}
        onBlockClick={onBlockClick}
      />
      <ThresholdSection surface={surface} />
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

  return (
    <SurfaceFrame surface={surface}>
      <ol className="space-y-1.5">
        {ordered.map((ln, index) => {
          const node  = ln.node;
          const style = getNodeStyle(node.nodeType);
          return (
            <li key={node.nodeId} className="flex gap-2.5">
              {/* Step number column */}
              <div className="flex flex-col items-center">
                <div className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  "border border-primary/40 bg-primary/10 text-primary",
                )}>
                  {index + 1}
                </div>
                {index < ordered.length - 1 && (
                  <div className="mt-1 min-h-3 flex-1 border-l border-dashed border-border/50" />
                )}
              </div>

              {/* Card */}
              <div
                dir="rtl"
                lang="fa"
                data-node-id={node.nodeId}
                className={cn("min-w-0 flex-1 overflow-hidden rounded-lg border mb-0.5", style.card,
                  "shadow-[0_1px_3px_rgba(0,0,0,0.07)]"
                )}
              >
                <div className={cn("h-[3px] w-full", style.stripe)} />
                <div className="px-3 py-2">
                  <span className={cn("text-[10px] font-bold uppercase tracking-wide", style.badge)}>
                    {getNodeTypeLabel(node.nodeType)}
                  </span>
                  <p className="mt-0.5 text-[13px] font-semibold text-foreground">{node.label}</p>
                  {node.detail && <p className="mt-1 text-[11px] leading-relaxed text-foreground/75">{node.detail}</p>}
                  {node.testablePoint && (
                    <p className="mt-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                      📋 {node.testablePoint}
                    </p>
                  )}
                  {(node.linkedBlockIds ?? []).length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {(node.linkedBlockIds ?? []).map((blockId, idx) => (
                        <button
                          key={blockId}
                          type="button"
                          onClick={() => onBlockClick?.(blockId)}
                          className="min-h-6 rounded border border-border/50 px-1.5 text-[9px] text-muted-foreground hover:bg-background"
                        >
                          منبع {idx + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <ThresholdSection surface={surface} />
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
  return (
    <SurfaceFrame surface={surface}>
      <GateBanner surface={surface} />
      <div className="grid gap-2 sm:grid-cols-2">
        {(surface.nodes ?? []).map((node) => {
          const v4    = node as unknown as AlgorithmNodeV4;
          const style = getNodeStyle(v4.nodeType);
          return (
            <div
              key={node.id}
              dir="rtl"
              lang="fa"
              data-node-id={node.id}
              className={cn(
                "overflow-hidden rounded-lg border text-right",
                "shadow-[0_1px_3px_rgba(0,0,0,0.07)]",
                style.card,
              )}
            >
              <div className={cn("h-[3px] w-full", style.stripe)} />
              <div className="px-3 py-2">
                <span className={cn("text-[10px] font-bold uppercase tracking-wide", style.badge)}>
                  {getNodeTypeLabel(v4.nodeType)}
                </span>
                <p className="mt-0.5 text-[13px] font-semibold text-foreground">{v4.label}</p>
                {v4.detail && <p className="mt-1 text-[11px] leading-relaxed text-foreground/75 line-clamp-3">{v4.detail}</p>}
                {v4.testablePoint && (
                  <p className="mt-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                    📋 {v4.testablePoint}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <ThresholdSection surface={surface} />
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
            {/* Trap header */}
            <div className="border-b border-rose-400/30 bg-rose-50 dark:bg-rose-950/50 px-4 py-2.5">
              <p className="text-[12px] font-bold text-rose-700 dark:text-rose-400">
                ⚠ {readString(trap, ["trapTitle"]) ?? "Board trap"}
              </p>
            </div>
            {/* Wrong / correct */}
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
  const shape = `${surface.algorithmShape ?? ""} ${surface.surfaceType ?? ""}`.toLowerCase();

  if (shape.includes("trap") || (surface.boardTraps?.length ?? 0) > 0)
    return <TrapSurfaceRenderer surface={surface} onBlockClick={onBlockClick} />;
  if (shape.includes("matrix") || (surface.matrices?.length ?? 0) > 0)
    return <MatrixSurfaceRenderer surface={surface} onBlockClick={onBlockClick} />;

  return null;
}
