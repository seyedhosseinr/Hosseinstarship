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

  // Find nodes connected to selected
  const connectedNodeIds = new Set<string>();
  if (selectedNodeId) {
    for (const edge of surface.edges) {
      if (edge.from === selectedNodeId) connectedNodeIds.add(edge.to);
      if (edge.to === selectedNodeId) connectedNodeIds.add(edge.from);
    }
  }

  if (surface.edges.length === 0) {
    // No edges: render in a simple vertical list
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

  return (
    <div
      className="relative overflow-auto"
      style={{ maxHeight: "calc(100vh - 220px)" }}
      data-surface-id={surface.surfaceId}
    >
      <div
        style={{
          position: "relative",
          width: layout.canvasWidth,
          height: layout.canvasHeight,
        }}
      >
        {/* SVG edge layer behind nodes */}
        <AlgorithmEdgeLayer
          layoutEdges={layout.edges}
          surfaceId={surface.surfaceId}
          selectedNodeId={selectedNodeId}
          visitedPath={visitedPath}
          canvasWidth={layout.canvasWidth}
          canvasHeight={layout.canvasHeight}
        />

        {/* Node cards */}
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
      </div>
    </div>
  );
}
