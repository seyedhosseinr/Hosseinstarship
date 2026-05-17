"use client";

import { useMemo } from "react";
import dagre from "@dagrejs/dagre";

import type { AlgorithmNodeV4, AlgorithmEdgeV4 } from "@/types/algorithm-ir-v4";

export const NODE_W = 260;
export const NODE_H = 120;

export interface LayoutNode {
  node: AlgorithmNodeV4;
  x: number;
  y: number;
}

export interface LayoutEdge {
  edge: AlgorithmEdgeV4;
  fromPos: { x: number; y: number };
  toPos: { x: number; y: number };
}

export interface AlgorithmLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  canvasWidth: number;
  canvasHeight: number;
}

function computePath(from: LayoutNode, to: LayoutNode): { fromPos: {x:number;y:number}; toPos: {x:number;y:number} } {
  // TB layout: connect bottom-center of from to top-center of to
  return {
    fromPos: { x: from.x + NODE_W / 2, y: from.y + NODE_H },
    toPos: { x: to.x + NODE_W / 2, y: to.y },
  };
}

export function useAlgorithmLayout(
  nodes: AlgorithmNodeV4[],
  edges: AlgorithmEdgeV4[],
): AlgorithmLayout {
  return useMemo(() => {
    if (nodes.length === 0) {
      return { nodes: [], edges: [], canvasWidth: 600, canvasHeight: 300 };
    }

    const graph = new dagre.graphlib.Graph();
    graph.setDefaultEdgeLabel(() => ({}));
    graph.setGraph({
      rankdir: "TB",
      nodesep: 56,
      ranksep: 88,
      marginx: 40,
      marginy: 40,
    });

    for (const node of nodes) {
      graph.setNode(node.nodeId, { width: NODE_W, height: NODE_H });
    }

    const nodeIds = new Set(nodes.map((n) => n.nodeId));
    for (const edge of edges) {
      if (nodeIds.has(edge.from) && nodeIds.has(edge.to)) {
        graph.setEdge(edge.from, edge.to);
      }
    }

    dagre.layout(graph);

    const positioned: LayoutNode[] = nodes.map((node) => {
      const p = graph.node(node.nodeId) as { x: number; y: number } | undefined;
      return {
        node,
        x: (p?.x ?? 0) - NODE_W / 2,
        y: (p?.y ?? 0) - NODE_H / 2,
      };
    });

    const byId = new Map(positioned.map((ln) => [ln.node.nodeId, ln]));

    const layoutEdges: LayoutEdge[] = edges
      .filter((e) => byId.has(e.from) && byId.has(e.to))
      .map((edge) => {
        const from = byId.get(edge.from)!;
        const to = byId.get(edge.to)!;
        const { fromPos, toPos } = computePath(from, to);
        return { edge, fromPos, toPos };
      });

    const maxX = Math.max(600, ...positioned.map((ln) => ln.x + NODE_W + 80));
    const maxY = Math.max(400, ...positioned.map((ln) => ln.y + NODE_H + 80));

    return {
      nodes: positioned,
      edges: layoutEdges,
      canvasWidth: maxX,
      canvasHeight: maxY,
    };
  }, [nodes, edges]);
}
