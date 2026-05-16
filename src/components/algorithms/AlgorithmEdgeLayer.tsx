"use client";

import { type AlgorithmEdgeV4 } from "@/types/algorithm-ir-v4";
import type { LayoutEdge } from "./useAlgorithmLayout";

// ─── Edge style mapping ───────────────────────────────────────────────────────

function getEdgeStyle(edgeType?: string, condition?: string): {
  stroke: string;
  strokeWidth: number;
  dashArray?: string;
} {
  const isRedFlag =
    edgeType === "escalation" ||
    (condition &&
      /تب|لرز|اورژانس|عفونی|red flag/i.test(condition));

  if (isRedFlag) {
    return { stroke: "#ef4444", strokeWidth: 2.5 };
  }
  switch (edgeType) {
    case "trap":
      return { stroke: "#fb7185", strokeWidth: 1.5, dashArray: "5 3" };
    case "exception_branch":
      return { stroke: "#f97316", strokeWidth: 1.5, dashArray: "4 3" };
    case "threshold_split":
      return { stroke: "#f59e0b", strokeWidth: 1.5 };
    default:
      return { stroke: "#475569", strokeWidth: 1.5 };
  }
}

function bezierPath(
  fx: number, fy: number,
  tx: number, ty: number,
): string {
  const dy = Math.abs(ty - fy);
  const cp = Math.max(40, dy / 2);
  return `M ${fx} ${fy} C ${fx} ${fy + cp}, ${tx} ${ty - cp}, ${tx} ${ty}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AlgorithmEdgeLayerProps {
  layoutEdges: LayoutEdge[];
  surfaceId: string;
  selectedNodeId: string | null;
  visitedPath: string[];
  canvasWidth: number;
  canvasHeight: number;
}

export function AlgorithmEdgeLayer({
  layoutEdges,
  surfaceId,
  selectedNodeId,
  visitedPath,
  canvasWidth,
  canvasHeight,
}: AlgorithmEdgeLayerProps) {
  const visitedSet = new Set(visitedPath);

  return (
    <svg
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: canvasWidth,
        height: canvasHeight,
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      <defs>
        {/* Normal arrowhead */}
        <marker
          id={`${surfaceId}-arrow`}
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L8,3 z" fill="#475569" />
        </marker>
        {/* Red arrowhead */}
        <marker
          id={`${surfaceId}-arrow-red`}
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L8,3 z" fill="#ef4444" />
        </marker>
        {/* Amber arrowhead */}
        <marker
          id={`${surfaceId}-arrow-amber`}
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L8,3 z" fill="#f59e0b" />
        </marker>
        {/* Rose arrowhead */}
        <marker
          id={`${surfaceId}-arrow-rose`}
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L8,3 z" fill="#fb7185" />
        </marker>
      </defs>

      {layoutEdges.map((le) => {
        const { edge, fromPos, toPos } = le;
        const edgeStyle = getEdgeStyle(edge.edgeType, edge.condition);
        const isTraversed =
          visitedSet.has(edge.from) && visitedSet.has(edge.to);
        const isActive =
          selectedNodeId === edge.from || selectedNodeId === edge.to;

        const opacity = isTraversed || isActive ? 1 : 0.35;

        let markerEnd = `url(#${surfaceId}-arrow)`;
        if (edge.edgeType === "escalation" ||
          (edge.condition && /تب|لرز|اورژانس/i.test(edge.condition))) {
          markerEnd = `url(#${surfaceId}-arrow-red)`;
        } else if (edge.edgeType === "threshold_split") {
          markerEnd = `url(#${surfaceId}-arrow-amber)`;
        } else if (edge.edgeType === "trap") {
          markerEnd = `url(#${surfaceId}-arrow-rose)`;
        }

        const d = bezierPath(fromPos.x, fromPos.y, toPos.x, toPos.y);
        const midX = (fromPos.x + toPos.x) / 2;
        const midY = (fromPos.y + toPos.y) / 2;

        return (
          <g
            key={edge.edgeId}
            data-surface-id={surfaceId}
            data-edge-id={edge.edgeId}
            style={{ opacity }}
          >
            <path
              d={d}
              fill="none"
              stroke={isTraversed ? "#6366f1" : edgeStyle.stroke}
              strokeWidth={isTraversed ? 2 : edgeStyle.strokeWidth}
              strokeDasharray={edgeStyle.dashArray}
              markerEnd={isTraversed ? `url(#${surfaceId}-arrow)` : markerEnd}
            />
            {/* Labels are rendered as HTML in AlgorithmCanvas to avoid SVG z-index issues */}
          </g>
        );
      })}
    </svg>
  );
}
