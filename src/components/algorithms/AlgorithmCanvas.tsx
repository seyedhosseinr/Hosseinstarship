"use client";

import { useAlgorithmLayout } from "./useAlgorithmLayout";
import { AlgorithmNodeCard } from "./AlgorithmNodeCard";
import { AlgorithmEdgeLayer } from "./AlgorithmEdgeLayer";
import type { AlgorithmSurfaceV4 } from "@/types/algorithm-ir-v4";

interface AlgorithmCanvasProps {
  surface: AlgorithmSurfaceV4;
  selectedNodeId: string | null;
  visitedPath: string[];
  onSelectNode: (nodeId: string) => void;
}

export function AlgorithmCanvas({
  surface,
  selectedNodeId,
  visitedPath,
  onSelectNode,
}: AlgorithmCanvasProps) {
  const layout = useAlgorithmLayout(surface.nodes, surface.edges);
  const visitedSet = new Set(visitedPath);

  if (surface.nodes.length === 0) {
    return (
      <div
        dir="rtl"
        lang="fa"
        className="flex min-h-[300px] items-center justify-center text-sm text-slate-500"
      >
        نمودار در دسترس نیست
      </div>
    );
  }

  const connectedNodeIds = new Set<string>();
  if (selectedNodeId) {
    for (const edge of surface.edges) {
      if (edge.from === selectedNodeId) connectedNodeIds.add(edge.to);
      if (edge.to === selectedNodeId) connectedNodeIds.add(edge.from);
    }
  }

  if (surface.edges.length === 0) {
    return (
      <div
        dir="rtl"
        lang="fa"
        className="flex flex-col items-center gap-4 p-6"
        data-surface-id={surface.surfaceId}
      >
        <p className="text-xs text-slate-500">
          مسیر ارتباطی برای این الگوریتم ثبت نشده است
        </p>
        {layout.nodes.map((ln) => (
          <AlgorithmNodeCard
            key={ln.node.nodeId}
            node={ln.node}
            surfaceId={surface.surfaceId}
            x={0}
            y={0}
            isSelected={ln.node.nodeId === selectedNodeId}
            isInPath={visitedSet.has(ln.node.nodeId)}
            isConnected={connectedNodeIds.has(ln.node.nodeId)}
            onClick={onSelectNode}
          />
        ))}
      </div>
    );
  }

  // Compute which edges should show a label
  const activeEdgeLabels = layout.edges
    .filter((le) => {
      if (!le.edge.condition) return false;
      const traversed = visitedSet.has(le.edge.from) && visitedSet.has(le.edge.to);
      const active = selectedNodeId === le.edge.from || selectedNodeId === le.edge.to;
      return traversed || active;
    })
    .map((le) => {
      const midX = (le.fromPos.x + le.toPos.x) / 2;
      const midY = (le.fromPos.y + le.toPos.y) / 2;
      return { edgeId: le.edge.edgeId, condition: le.edge.condition!, midX, midY };
    });

  return (
    <div
      className="relative"
      style={{ width: layout.canvasWidth, height: layout.canvasHeight }}
      data-surface-id={surface.surfaceId}
    >
      {/* Layer 0: SVG bezier lines */}
      <AlgorithmEdgeLayer
        layoutEdges={layout.edges}
        surfaceId={surface.surfaceId}
        selectedNodeId={selectedNodeId}
        visitedPath={visitedPath}
        canvasWidth={layout.canvasWidth}
        canvasHeight={layout.canvasHeight}
      />

      {/* Layer 1: node cards */}
      {layout.nodes.map((ln) => (
        <AlgorithmNodeCard
          key={ln.node.nodeId}
          node={ln.node}
          surfaceId={surface.surfaceId}
          x={ln.x}
          y={ln.y}
          isSelected={ln.node.nodeId === selectedNodeId}
          isInPath={visitedSet.has(ln.node.nodeId)}
          isConnected={connectedNodeIds.has(ln.node.nodeId)}
          onClick={onSelectNode}
        />
      ))}

      {/* Layer 2: edge condition labels — on top of node cards */}
      {activeEdgeLabels.map(({ edgeId, condition, midX, midY }) => (
        <div
          key={edgeId}
          dir="rtl"
          style={{
            position: "absolute",
            left: midX,
            top: midY,
            transform: "translate(-50%, -50%)",
            zIndex: 30,
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              display: "inline-block",
              background: "rgba(15,17,23,0.92)",
              border: "1px solid rgba(99,102,241,0.45)",
              borderRadius: 6,
              padding: "2px 8px",
              fontSize: 11,
              color: "#94a3b8",
              whiteSpace: "nowrap",
              lineHeight: "1.5",
            }}
          >
            {condition}
          </span>
        </div>
      ))}
    </div>
  );
}
