"use client";

import type React from "react";
import type { AlgorithmSurface } from "@/types/algorithm-ir";
import { NodeCard } from "@/components/outliner/NodeCard";

function SurfaceFrame({ surface, children }: { surface: AlgorithmSurface; children: React.ReactNode }) {
  return <section className="mx-auto max-w-6xl p-4" data-surface-id={surface.id}>{children}</section>;
}

export function DagRenderer({ surface, onBlockClick }: { surface: AlgorithmSurface; onBlockClick?: (blockId: string) => void }) {
  return (
    <SurfaceFrame surface={surface}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(surface.nodes ?? []).map((node) => <NodeCard key={node.id} node={node} onBlockClick={onBlockClick} />)}
      </div>
    </SurfaceFrame>
  );
}

export function ChainRenderer(props: { surface: AlgorithmSurface; onBlockClick?: (blockId: string) => void }) {
  return <DagRenderer {...props} />;
}

export function CardGridRenderer(props: { surface: AlgorithmSurface; onBlockClick?: (blockId: string) => void }) {
  return <DagRenderer {...props} />;
}

export function renderSurface(_surface?: AlgorithmSurface, _onBlockClick?: (blockId: string) => void): React.ReactNode | null {
  return null;
}


