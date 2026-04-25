"use client";

/**
 * FrameAlgorithmGraph — v4 (Persian-dominant polish)
 *
 * Primary renderer for `interactive_algorithm` blocks.
 *
 * Source of truth: `display.interactiveData` (steps + option edges).
 * Output: a custom React+SVG decision graph with real interactive
 * state, styled to feel like a polished medical-study interaction.
 *
 * Layout: deterministic BFS-rank layout (top-down). No graph lib.
 * Nodes use <foreignObject> so bodies are regular Tailwind divs.
 *
 * Anchoring: PRESENTATIONAL only. Does NOT become the canonical
 * anchor surface — SVG node text is for display, not selection
 * offset routing. The canonical prose backbone lives in
 * `frame.content` / `frame.body` and is rendered by
 * FrameCardV2 → CanonicalContentSurface.
 *
 * v4 changes (Persian reading polish):
 * ──────────────────────────────────
 * • `text-left` → `text-start` on the option buttons so button
 *   body text aligns to the reading start (right in RTL contexts).
 * • Leading in step text nodes, companion panel, explanation, and
 *   final message tuned for Persian: 1.85–1.95 baseline. Latin
 *   medical terms embedded in Persian runs need the same breathing
 *   room as the surrounding Persian text.
 * • Strong/em/code handled via parent arbitrary selectors so bold
 *   medical terms inside step text actually read as visibly bold.
 * • Graph VIEWPORT stays `dir="ltr"` — node positions are computed
 *   LTR by the layout algorithm; the graph flows top-to-bottom with
 *   LTR sibling ordering. This is an intentional design choice, not
 *   a bidi bug.
 * • English-only UI affordances (Back, Restart, Path, Choose,
 *   Conclusion, Decision graph) keep their existing treatment.
 */

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleDot,
  GitBranch,
  RotateCcw,
  Sparkles,
  Undo2,
} from "lucide-react";
import type {
  InteractiveAlgorithmData,
  InteractiveAlgorithmStep,
} from "@/lib/contract/note-viewer.types";
import { cn } from "@/lib/utils";
import { renderInlineRich } from "./inlineRich";

const NODE_W = 236;
const NODE_H = 116;
const RANK_GAP_Y = 152;
const SIBLING_GAP_X = 56;
const PADDING = 36;

interface PlacedNode {
  step: InteractiveAlgorithmStep;
  x: number;
  y: number;
  rank: number;
}

interface PlacedEdge {
  fromId: string;
  toId: string;
  label: string;
  d: string;
  midX: number;
  midY: number;
}

interface Layout {
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  width: number;
  height: number;
  positions: Map<string, { x: number; y: number }>;
  outDegree: Map<string, number>;
}

function computeLayout(data: InteractiveAlgorithmData): Layout {
  const stepMap = new Map(data.steps.map((s) => [s.stepId, s]));
  const ranks = new Map<string, number>();
  const queue: Array<{ id: string; rank: number }> = [];

  if (stepMap.has(data.initialStepId)) {
    queue.push({ id: data.initialStepId, rank: 0 });
    ranks.set(data.initialStepId, 0);
  }
  while (queue.length) {
    const { id, rank } = queue.shift()!;
    const step = stepMap.get(id);
    if (!step?.options) continue;
    for (const opt of step.options) {
      if (!stepMap.has(opt.nextStepId)) continue;
      if (ranks.has(opt.nextStepId)) continue;
      ranks.set(opt.nextStepId, rank + 1);
      queue.push({ id: opt.nextStepId, rank: rank + 1 });
    }
  }

  let maxRank = ranks.size ? Math.max(...ranks.values()) : 0;
  const orphans: string[] = [];
  for (const s of data.steps) {
    if (!ranks.has(s.stepId)) orphans.push(s.stepId);
  }
  if (orphans.length) {
    maxRank += 1;
    for (const id of orphans) ranks.set(id, maxRank);
  }

  const byRank = new Map<number, string[]>();
  const insertionOrder = new Map<string, number>();
  data.steps.forEach((s, i) => insertionOrder.set(s.stepId, i));
  for (const [id, r] of ranks) {
    if (!byRank.has(r)) byRank.set(r, []);
    byRank.get(r)!.push(id);
  }
  for (const arr of byRank.values()) {
    arr.sort((a, b) => (insertionOrder.get(a) ?? 0) - (insertionOrder.get(b) ?? 0));
  }

  let maxRowWidth = NODE_W;
  for (const ids of byRank.values()) {
    const w = ids.length * NODE_W + (ids.length - 1) * SIBLING_GAP_X;
    if (w > maxRowWidth) maxRowWidth = w;
  }

  const positions = new Map<string, { x: number; y: number }>();
  const nodes: PlacedNode[] = [];

  const ranksOrdered = [...byRank.keys()].sort((a, b) => a - b);
  for (const r of ranksOrdered) {
    const ids = byRank.get(r)!;
    const rowWidth = ids.length * NODE_W + (ids.length - 1) * SIBLING_GAP_X;
    const startX = PADDING + (maxRowWidth - rowWidth) / 2;
    const y = PADDING + r * RANK_GAP_Y;
    ids.forEach((id, i) => {
      const x = startX + i * (NODE_W + SIBLING_GAP_X);
      positions.set(id, { x, y });
      nodes.push({ step: stepMap.get(id)!, x, y, rank: r });
    });
  }

  const outDegree = new Map<string, number>();
  for (const s of data.steps) {
    outDegree.set(s.stepId, s.options?.length ?? 0);
  }

  const edges: PlacedEdge[] = [];
  for (const step of data.steps) {
    if (!step.options) continue;
    const from = positions.get(step.stepId);
    if (!from) continue;
    for (const opt of step.options) {
      const to = positions.get(opt.nextStepId);
      if (!to) continue;
      const x1 = from.x + NODE_W / 2;
      const y1 = from.y + NODE_H;
      const x2 = to.x + NODE_W / 2;
      const y2 = to.y - 6;
      const dy = Math.max(28, (y2 - y1) * 0.55);
      const c1y = y1 + dy;
      const c2y = y2 - dy;
      const d = `M ${x1} ${y1} C ${x1} ${c1y}, ${x2} ${c2y}, ${x2} ${y2}`;
      edges.push({
        fromId: step.stepId,
        toId: opt.nextStepId,
        label: opt.label,
        d,
        midX: (x1 + x2) / 2,
        midY: (y1 + y2) / 2,
      });
    }
  }

  return {
    nodes,
    edges,
    width: maxRowWidth + PADDING * 2,
    height:
      PADDING * 2 +
      (ranksOrdered.length
        ? ranksOrdered[ranksOrdered.length - 1] * RANK_GAP_Y + NODE_H
        : NODE_H),
    positions,
    outDegree,
  };
}

/* ─── Node visual treatment by type ─── */

interface Tone {
  card: string;
  ring: string;
  chip: string;
  accent: string;
  badge: string;
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
}

const NODE_TONE: Record<InteractiveAlgorithmStep["type"], Tone> = {
  question: {
    card: "bg-gradient-to-br from-blue-50/95 to-blue-50/70 dark:from-blue-950/40 dark:to-blue-950/20 border-blue-200/80 dark:border-blue-800/70",
    ring: "ring-blue-400/80 dark:ring-blue-400/70",
    chip: "bg-blue-100/90 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300",
    accent: "text-blue-600 dark:text-blue-400",
    badge: "bg-blue-500 text-white",
    Icon: CircleDot,
    label: "Decision",
  },
  action: {
    card: "bg-gradient-to-br from-teal-50/95 to-teal-50/70 dark:from-teal-950/40 dark:to-teal-950/20 border-teal-200/80 dark:border-teal-800/70",
    ring: "ring-teal-400/80 dark:ring-teal-400/70",
    chip: "bg-teal-100/90 text-teal-700 dark:bg-teal-900/60 dark:text-teal-300",
    accent: "text-teal-600 dark:text-teal-400",
    badge: "bg-teal-500 text-white",
    Icon: ArrowRight,
    label: "Action",
  },
  result: {
    card: "bg-gradient-to-br from-emerald-50/95 to-emerald-100/70 dark:from-emerald-950/45 dark:to-emerald-950/25 border-emerald-300/90 dark:border-emerald-700/80",
    ring: "ring-emerald-500/80 dark:ring-emerald-400/80",
    chip: "bg-emerald-100/90 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
    accent: "text-emerald-600 dark:text-emerald-400",
    badge: "bg-emerald-500 text-white",
    Icon: CheckCircle2,
    label: "Outcome",
  },
};

interface FrameAlgorithmGraphProps {
  data: InteractiveAlgorithmData;
}

export function FrameAlgorithmGraph({ data }: FrameAlgorithmGraphProps) {
  const [currentStepId, setCurrentStepId] = useState(data.initialStepId);
  const [history, setHistory] = useState<string[]>([]);
  const reactId = useId();
  const safeId = `alg-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const stepMap = useMemo(
    () => new Map(data.steps.map((s) => [s.stepId, s])),
    [data],
  );
  const layout = useMemo(() => computeLayout(data), [data]);

  const currentStep = stepMap.get(currentStepId);
  const visited = useMemo(
    () => new Set<string>([...history, currentStepId]),
    [history, currentStepId],
  );
  const traversedEdges = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < history.length; i++) {
      const from = history[i];
      const to = i + 1 < history.length ? history[i + 1] : currentStepId;
      set.add(`${from}→${to}`);
    }
    return set;
  }, [history, currentStepId]);

  const goToStep = useCallback(
    (nextId: string) => {
      if (!stepMap.has(nextId)) return;
      setHistory((prev) => [...prev, currentStepId]);
      setCurrentStepId(nextId);
    },
    [currentStepId, stepMap],
  );

  const goBack = useCallback(() => {
    setHistory((prev) => {
      if (!prev.length) return prev;
      const next = prev.slice(0, -1);
      setCurrentStepId(prev[prev.length - 1]);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setHistory([]);
    setCurrentStepId(data.initialStepId);
  }, [data.initialStepId]);

  // Auto-center the active node in the inner viewport on change.
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const pos = layout.positions.get(currentStepId);
    if (!pos) return;
    const visibleW = scroller.clientWidth;
    const target = Math.max(0, pos.x + NODE_W / 2 - visibleW / 2);
    if (typeof scroller.scrollTo === "function") {
      scroller.scrollTo({ left: target, behavior: "smooth" });
    } else {
      scroller.scrollLeft = target;
    }
  }, [currentStepId, layout]);

  if (!currentStep) {
    return (
      <div
        data-algorithm-graph="error"
        className="mt-4 rounded-lib-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
      >
        Step not found: {currentStepId}
      </div>
    );
  }

  const isTerminal = currentStep.type === "result" || !currentStep.options?.length;
  const tone = NODE_TONE[currentStep.type] ?? NODE_TONE.question;
  const totalSteps = data.steps.length;
  const visitedCount = visited.size;
  const arrowActiveId = `${safeId}-arrow-active`;
  const arrowAvailableId = `${safeId}-arrow-available`;
  const arrowIdleId = `${safeId}-arrow-idle`;
  const dropShadowId = `${safeId}-drop-shadow`;

  /* Inline tone shared by all step-text surfaces inside this graph.
     Extracted so every Persian/Latin medical run renders consistently. */
  const STEP_INLINE_TONE = cn(
    "[&_strong]:font-[720] [&_strong]:text-inherit",
    "[&_em]:italic",
    "[&_code]:rounded-[4px] [&_code]:border [&_code]:border-lib-border/40",
    "[&_code]:bg-lib-hover/60 [&_code]:px-1 [&_code]:py-[1px]",
    "[&_code]:font-mono [&_code]:text-[0.9em]",
  );

  return (
    <div
      data-algorithm-graph="svg"
      className="mt-4 overflow-hidden rounded-lib-lg border border-lib-border/70 bg-lib-surface/95 shadow-[0_1px_0_color-mix(in_oklab,hsl(var(--foreground))_3%,transparent),0_8px_24px_-16px_color-mix(in_oklab,hsl(var(--foreground))_18%,transparent)]"
    >
      {/* ── Header — English-only UI chrome, dir=ltr ──────── */}
      <header
        dir="ltr"
        className="flex items-center justify-between gap-3 border-b border-lib-border/60 bg-lib-hover/30 px-4 py-2.5"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-lib-surface/90 ring-1 ring-inset ring-lib-border/60">
            <GitBranch className="h-3.5 w-3.5 text-lib-text-secondary" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] font-[700] uppercase tracking-[0.16em] text-lib-text">
              Decision graph
            </span>
            <span className="text-[10px] text-lib-text-muted tabular-nums">
              Step {history.length + 1}
              <span className="mx-1.5 text-lib-text-muted/40">·</span>
              {visitedCount} of {totalSteps} visited
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={goBack}
            disabled={history.length === 0}
            aria-label="Step back"
            className="inline-flex items-center gap-1.5 rounded-full border border-lib-border/70 bg-lib-surface px-3 py-1 text-[11px] font-[600] text-lib-text-secondary transition hover:border-lib-border hover:bg-lib-hover/70 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Undo2 className="h-3 w-3" />
            Back
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={history.length === 0}
            aria-label="Restart algorithm"
            className="inline-flex items-center gap-1.5 rounded-full border border-lib-border/70 bg-lib-surface px-3 py-1 text-[11px] font-[600] text-lib-text-secondary transition hover:border-lib-border hover:bg-lib-hover/70 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw className="h-3 w-3" />
            Restart
          </button>
        </div>
      </header>

      {/* ── Graph viewport — always LTR (layout is LTR by design) ─── */}
      <div
        ref={scrollerRef}
        dir="ltr"
        data-algorithm-viewport="true"
        className="overflow-x-auto bg-[radial-gradient(circle_at_top,color-mix(in_oklab,hsl(var(--foreground))_3%,transparent),transparent_70%)] px-2 py-4"
      >
        <svg
          role="img"
          aria-label="Interactive decision flowchart"
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width={layout.width}
          height={layout.height}
          className="block max-w-full"
        >
          <defs>
            <marker
              id={arrowActiveId}
              viewBox="0 0 12 12"
              refX="10"
              refY="6"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 1 1 L 11 6 L 1 11 z" fill="rgb(13 148 136)" />
            </marker>
            <marker
              id={arrowAvailableId}
              viewBox="0 0 12 12"
              refX="10"
              refY="6"
              markerWidth="6.5"
              markerHeight="6.5"
              orient="auto-start-reverse"
            >
              <path d="M 1 1 L 11 6 L 1 11 z" fill="rgb(59 130 246)" />
            </marker>
            <marker
              id={arrowIdleId}
              viewBox="0 0 12 12"
              refX="10"
              refY="6"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 1 1 L 11 6 L 1 11 z" fill="currentColor" opacity="0.45" />
            </marker>
            <filter id={dropShadowId} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="0.6" floodOpacity="0.18" />
            </filter>
          </defs>

          {/* Edges */}
          <g className="text-lib-text-muted">
            {layout.edges.map((edge) => {
              const isTraversed = traversedEdges.has(`${edge.fromId}→${edge.toId}`);
              const isFromCurrent = edge.fromId === currentStepId;
              const isLive = isTraversed || isFromCurrent;
              const showLabel =
                (layout.outDegree.get(edge.fromId) ?? 0) > 1 && edge.label?.trim();
              const stroke = isTraversed
                ? "rgb(13 148 136)"
                : isFromCurrent
                  ? "rgb(59 130 246)"
                  : "currentColor";
              const marker = isTraversed
                ? `url(#${arrowActiveId})`
                : isFromCurrent
                  ? `url(#${arrowAvailableId})`
                  : `url(#${arrowIdleId})`;
              return (
                <g
                  key={`${edge.fromId}-${edge.toId}-${edge.label}`}
                  data-edge-from={edge.fromId}
                  data-edge-to={edge.toId}
                  data-edge-state={
                    isTraversed ? "traversed" : isFromCurrent ? "available" : "idle"
                  }
                >
                  <path
                    d={edge.d}
                    fill="none"
                    stroke={stroke}
                    strokeOpacity={isLive ? 0.95 : 0.32}
                    strokeWidth={isTraversed ? 2.4 : isFromCurrent ? 1.9 : 1.25}
                    strokeDasharray={isFromCurrent && !isTraversed ? "6 4" : undefined}
                    strokeLinecap="round"
                    markerEnd={marker}
                  />
                  {showLabel && (
                    <g
                      transform={`translate(${edge.midX} ${edge.midY})`}
                      className={isFromCurrent ? "cursor-pointer" : undefined}
                      onClick={isFromCurrent ? () => goToStep(edge.toId) : undefined}
                    >
                      <EdgeLabel
                        text={edge.label}
                        live={isLive}
                        traversed={isTraversed}
                        filterId={dropShadowId}
                      />
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {/* Nodes */}
          {layout.nodes.map(({ step, x, y }) => {
            const t = NODE_TONE[step.type] ?? NODE_TONE.question;
            const isCurrent = step.stepId === currentStepId;
            const isVisited = visited.has(step.stepId);
            const isResult = step.type === "result";
            const isInitial = step.stepId === data.initialStepId;
            return (
              <foreignObject
                key={step.stepId}
                x={x}
                y={y}
                width={NODE_W}
                height={NODE_H}
                style={{ overflow: "visible" }}
              >
                <div
                  data-step-id={step.stepId}
                  data-step-type={step.type}
                  data-step-state={isCurrent ? "current" : isVisited ? "visited" : "idle"}
                  className={cn(
                    "group relative flex h-full w-full cursor-pointer flex-col gap-1.5 rounded-2xl border px-3.5 py-2.5 text-left transition-all duration-200",
                    t.card,
                    "shadow-[0_1px_0_color-mix(in_oklab,hsl(var(--foreground))_4%,transparent)]",
                    isResult && "ring-1 ring-inset ring-emerald-200/60 dark:ring-emerald-800/40",
                    isCurrent &&
                      cn(
                        "ring-2 ring-offset-2 ring-offset-lib-surface scale-[1.025]",
                        "shadow-[0_8px_22px_-10px_color-mix(in_oklab,hsl(var(--foreground))_30%,transparent)]",
                        t.ring,
                      ),
                    !isCurrent && isVisited && "opacity-95",
                    !isCurrent && !isVisited && "opacity-55 hover:opacity-90",
                  )}
                  onClick={() => {
                    if (step.stepId === currentStepId) return;
                    setHistory((prev) => [...prev, currentStepId]);
                    setCurrentStepId(step.stepId);
                  }}
                  role="button"
                  tabIndex={-1}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      dir="ltr"
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[9px] font-[700] uppercase tracking-[0.14em]",
                        t.chip,
                      )}
                    >
                      <t.Icon className="h-2.5 w-2.5" />
                      {t.label}
                    </span>
                    <div className="flex items-center gap-1">
                      {isInitial && !isCurrent && (
                        <span
                          dir="ltr"
                          className="text-[8.5px] font-[700] uppercase tracking-[0.14em] text-lib-text-muted/70"
                        >
                          start
                        </span>
                      )}
                      {isVisited && !isCurrent && (
                        <span
                          aria-label="visited"
                          className={cn(
                            "inline-flex h-3.5 w-3.5 items-center justify-center rounded-full",
                            t.badge,
                          )}
                        >
                          <CheckCircle2 className="h-2.5 w-2.5" />
                        </span>
                      )}
                      {isCurrent && (
                        <span
                          dir="ltr"
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full bg-lib-surface/90 px-1.5 py-[1px] text-[8.5px] font-[700] uppercase tracking-[0.14em]",
                            t.accent,
                          )}
                        >
                          <Sparkles className="h-2.5 w-2.5" />
                          here
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Step text — Persian-dominant; inherits page RTL
                      from the outer reader container. Leading bumped
                      to 1.7 so Persian diacritics don't collide. */}
                  <div className="relative flex-1 min-h-0">
                    <p
                      className={cn(
                        "line-clamp-3 text-[12.5px] font-[500] leading-[1.7] text-lib-text",
                        STEP_INLINE_TONE,
                      )}
                      style={{ textAlign: "start" }}
                    >
                      {renderInlineRich(step.text)}
                    </p>
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-[color-mix(in_oklab,hsl(var(--background))_85%,transparent)] to-transparent"
                    />
                  </div>
                </div>
              </foreignObject>
            );
          })}
        </svg>
      </div>

      {/* ── Active step companion panel ─────────────────── */}
      <section
        data-algorithm-active-step={currentStep.stepId}
        className={cn(
          "border-t border-lib-border/60 px-5 py-4",
          isTerminal
            ? "bg-gradient-to-br from-emerald-50/60 via-lib-surface to-lib-surface dark:from-emerald-950/20 dark:via-lib-surface dark:to-lib-surface"
            : "bg-lib-surface",
        )}
      >
        <div className="mb-2 flex items-center gap-2">
          <span
            dir="ltr"
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-[700] uppercase tracking-[0.16em]",
              tone.chip,
            )}
          >
            <tone.Icon className="h-3 w-3" />
            {tone.label}
          </span>
          {history.length > 0 && (
            <span
              dir="ltr"
              className="text-[10px] uppercase tracking-[0.12em] text-lib-text-muted tabular-nums"
            >
              Path · {history.length + 1} step{history.length === 0 ? "" : "s"}
            </span>
          )}
        </div>

        {/* Step narrative — Persian-dominant reading surface */}
        <p
          className={cn(
            "text-[15.5px] font-[500] leading-[1.72] text-lib-text",
            "[&_strong]:font-[720] [&_strong]:text-lib-text",
            "[&_em]:italic",
            "[&_code]:rounded-[4px] [&_code]:border [&_code]:border-lib-border/40",
            "[&_code]:bg-lib-hover/60 [&_code]:px-1.5 [&_code]:py-[1px]",
            "[&_code]:font-mono [&_code]:text-[0.9em] [&_code]:text-lib-text",
          )}
          style={{
            textAlign: "start",
            overflowWrap: "break-word",
          }}
        >
          {renderInlineRich(currentStep.text)}
        </p>
        {currentStep.explanation && (
          <p
            className={cn(
              "mt-2 text-[13.5px] leading-[1.65] text-lib-text-secondary",
              "[&_strong]:font-[720] [&_strong]:text-lib-text/95",
              "[&_em]:italic",
              "[&_code]:rounded-[4px] [&_code]:border [&_code]:border-lib-border/40",
              "[&_code]:bg-lib-hover/60 [&_code]:px-1 [&_code]:py-[1px]",
              "[&_code]:font-mono [&_code]:text-[0.9em]",
            )}
            style={{
              textAlign: "start",
              overflowWrap: "break-word",
            }}
          >
            {renderInlineRich(currentStep.explanation)}
          </p>
        )}

        {isTerminal && currentStep.finalMessage && (
          <div
            data-algorithm-terminal="true"
            className="mt-3.5 overflow-hidden rounded-xl border border-emerald-300/80 bg-emerald-50/80 ring-1 ring-inset ring-emerald-200/60 dark:border-emerald-700/80 dark:bg-emerald-950/30 dark:ring-emerald-800/50"
          >
            <div
              dir="ltr"
              className="flex items-center gap-2 border-b border-emerald-200/70 bg-emerald-100/60 px-3.5 py-1.5 text-[10px] font-[700] uppercase tracking-[0.16em] text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-900/30 dark:text-emerald-300"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Conclusion
            </div>
            <p
              className={cn(
                "px-3.5 py-3 text-[14.5px] font-[600] leading-[1.72]",
                "text-emerald-900 dark:text-emerald-100",
                "[&_strong]:font-[720]",
                "[&_em]:italic",
              )}
              style={{
                textAlign: "start",
                overflowWrap: "break-word",
              }}
            >
              {renderInlineRich(currentStep.finalMessage)}
            </p>
          </div>
        )}

        {!isTerminal && currentStep.options && currentStep.options.length > 0 && (
          <div className="mt-3.5">
            <div
              dir="ltr"
              className="mb-1.5 text-[10px] font-[700] uppercase tracking-[0.16em] text-lib-text-muted"
            >
              Choose
            </div>
            <div className="grid gap-1.5">
              {currentStep.options.map((opt, i) => (
                <button
                  key={`${opt.nextStepId}-${i}`}
                  type="button"
                  onClick={() => goToStep(opt.nextStepId)}
                  data-option-target={opt.nextStepId}
                  data-option-index={i + 1}
                  className={cn(
                    "group flex w-full items-start gap-3 rounded-xl border border-lib-border/70 bg-lib-surface px-3.5 py-2.5 text-[13.5px] text-lib-text/90 transition",
                    // ⬇️ `text-start` instead of `text-left` so button
                    //    body aligns to the reading start (right in RTL).
                    "text-start",
                    "hover:border-teal-300 hover:bg-teal-50/50 hover:shadow-sm dark:hover:border-teal-700 dark:hover:bg-teal-950/30",
                  )}
                >
                  <span
                    aria-hidden="true"
                    dir="ltr"
                    className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-lib-border/70 bg-lib-hover/60 text-[10px] font-[700] tabular-nums text-lib-text-muted transition group-hover:border-teal-400 group-hover:bg-teal-100 group-hover:text-teal-700 dark:group-hover:border-teal-700 dark:group-hover:bg-teal-900/60 dark:group-hover:text-teal-300"
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 leading-[1.75]">
                    <span
                      className={cn(
                        "block font-[600] text-lib-text",
                        "[&_strong]:font-[720] [&_em]:italic",
                      )}
                    >
                      {renderInlineRich(opt.label)}
                    </span>
                    {opt.explanation && (
                      <span
                        className={cn(
                          "mt-0.5 block text-[12.5px] leading-[1.78] text-lib-text-muted",
                          "[&_strong]:font-[700] [&_em]:italic",
                        )}
                      >
                        {renderInlineRich(opt.explanation)}
                      </span>
                    )}
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="mt-1 h-3.5 w-3.5 shrink-0 text-lib-text-muted transition group-hover:translate-x-0.5 group-hover:text-teal-600 dark:group-hover:text-teal-400 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/* ─── EdgeLabel — SVG pill rendered at midpoint of an edge.
       Width estimated from char count; deterministic, SSR-stable. */
function EdgeLabel({
  text,
  live,
  traversed,
  filterId,
}: {
  text: string;
  live: boolean;
  traversed: boolean;
  filterId: string;
}) {
  const trimmed = text.length > 26 ? `${text.slice(0, 25)}…` : text;
  const w = Math.max(36, trimmed.length * 6.4 + 18);
  const h = 20;
  const stroke = traversed
    ? "rgb(13 148 136)"
    : live
      ? "rgb(59 130 246)"
      : "currentColor";
  const fillClass = traversed
    ? "fill-teal-50 dark:fill-teal-950"
    : live
      ? "fill-blue-50 dark:fill-blue-950"
      : "fill-[var(--lib-surface,white)] dark:fill-[#1a1a1a]";
  const textClass = traversed
    ? "fill-teal-700 dark:fill-teal-300"
    : live
      ? "fill-blue-700 dark:fill-blue-300"
      : "fill-current text-lib-text-muted";
  return (
    <g filter={`url(#${filterId})`}>
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={10}
        ry={10}
        className={fillClass}
        stroke={stroke}
        strokeOpacity={live ? 0.85 : 0.45}
        strokeWidth={1}
      />
      <text
        x={0}
        y={1}
        textAnchor="middle"
        dominantBaseline="middle"
        className={cn("select-none font-[700] tracking-wide", textClass)}
        style={{ fontSize: 10.5 }}
      >
        {trimmed}
      </text>
    </g>
  );
}