"use client";

import { cn } from "@/lib/utils";
import { getNodeTypeLabel, type AlgorithmNodeV4 } from "@/types/algorithm-ir-v4";
import { NODE_W, NODE_H } from "./useAlgorithmLayout";

// ─── Node type visual styles ───────────────────────────────────────────────────

const NODE_STYLES: Record<string, { card: string; badge: string }> = {
  entry: {
    card: "border-indigo-500/60 bg-indigo-950/60 ring-1 ring-indigo-500/30",
    badge: "bg-indigo-500/20 text-indigo-300",
  },
  question: {
    card: "border-purple-500/60 bg-purple-950/50",
    badge: "bg-purple-500/20 text-purple-300",
  },
  test: {
    card: "border-dashed border-sky-500/50 bg-sky-950/40",
    badge: "bg-sky-500/20 text-sky-300",
  },
  finding: {
    card: "border-slate-500/40 bg-slate-800/60",
    badge: "bg-slate-500/20 text-slate-300",
  },
  threshold: {
    card: "border-r-2 border-amber-500/70 bg-amber-950/40 border-l-0 border-t border-b",
    badge: "bg-amber-500/20 text-amber-300",
  },
  treatment: {
    card: "border-r-2 border-green-500/70 bg-green-950/40",
    badge: "bg-green-500/20 text-green-300",
  },
  escalation: {
    card: "border-red-500/80 bg-red-950/60 ring-1 ring-red-500/40",
    badge: "bg-red-500/20 text-red-300",
  },
  endpoint: {
    card: "border-slate-600/50 bg-slate-900/80",
    badge: "bg-slate-600/20 text-slate-400",
  },
  trap: {
    card: "border-rose-500/70 bg-rose-950/50",
    badge: "bg-rose-500/20 text-rose-300",
  },
  exception: {
    card: "border-orange-500/60 bg-orange-950/40",
    badge: "bg-orange-500/20 text-orange-300",
  },
  mechanism: {
    card: "border-violet-500/50 bg-violet-950/40",
    badge: "bg-violet-500/20 text-violet-300",
  },
  clinical_effect: {
    card: "border-teal-500/50 bg-teal-950/40",
    badge: "bg-teal-500/20 text-teal-300",
  },
  classification: {
    card: "border-indigo-500/40 bg-slate-800/60",
    badge: "bg-indigo-500/20 text-indigo-300",
  },
};

const DEFAULT_STYLE = {
  card: "border-slate-600/40 bg-slate-800/50",
  badge: "bg-slate-500/20 text-slate-300",
};

function getNodeStyle(nodeType: string) {
  return NODE_STYLES[nodeType] ?? DEFAULT_STYLE;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AlgorithmNodeCardProps {
  node: AlgorithmNodeV4;
  surfaceId: string;
  x: number;
  y: number;
  isSelected: boolean;
  isInPath: boolean;
  isConnected: boolean;
  onClick: (nodeId: string) => void;
}

export function AlgorithmNodeCard({
  node,
  surfaceId,
  x,
  y,
  isSelected,
  isInPath,
  isConnected,
  onClick,
}: AlgorithmNodeCardProps) {
  const style = getNodeStyle(node.nodeType);
  const isEscalation = node.nodeType === "escalation";

  return (
    <button
      type="button"
      dir="rtl"
      lang="fa"
      aria-current={isSelected ? "true" : undefined}
      data-surface-id={surfaceId}
      data-node-id={node.nodeId}
      onClick={() => onClick(node.nodeId)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(node.nodeId);
        }
      }}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: NODE_W,
        minHeight: NODE_H,
      }}
      className={cn(
        "rounded-xl border p-3 text-right transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
        style.card,
        isSelected && "ring-2 ring-indigo-400 scale-[1.02]",
        isInPath && !isSelected && "opacity-100",
        !isInPath && !isSelected && !isConnected && "opacity-60",
        isEscalation && "shadow-[0_0_12px_2px_rgba(239,68,68,0.25)]",
      )}
    >
      {/* Badge row */}
      <div className="mb-1.5 flex items-center gap-1.5 flex-wrap">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
            style.badge,
          )}
        >
          {getNodeTypeLabel(node.nodeType)}
        </span>
        {node.memoryRole && (
          <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">
            {node.memoryRole}
          </span>
        )}
      </div>

      {/* Label */}
      <p className="text-sm font-semibold leading-snug text-slate-100">
        {node.label}
      </p>

      {/* Detail */}
      {node.detail && (
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400 line-clamp-2">
          {node.detail}
        </p>
      )}

      {/* Testable point */}
      {node.testablePoint && (
        <p className="mt-1.5 rounded bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-300">
          {node.testablePoint}
        </p>
      )}

      {/* Linked block chips */}
      {node.linkedBlockIds && node.linkedBlockIds.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {node.linkedBlockIds.map((blockId) => (
            <span
              key={blockId}
              data-linked-block-id={blockId}
              className="rounded border border-slate-600/40 px-1.5 py-0.5 text-[9px] text-slate-500"
            >
              {blockId}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
