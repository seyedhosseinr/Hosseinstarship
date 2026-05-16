"use client";

import type { AlgorithmRecord } from "@/types/algorithm-ir";
import { nodeDisplayTitle } from "@/components/outliner/navigation-labels";

export function NodeCard({ node, onBlockClick }: { node: AlgorithmRecord; onBlockClick?: (blockId: string) => void }) {
  const id = String(node.id ?? node.nodeId ?? "node");
  const linked = Array.isArray(node.linkedBlockIds) ? node.linkedBlockIds.filter((item): item is string => typeof item === "string") : [];
  const detail = typeof node.detail === "string" ? node.detail : typeof node.description === "string" ? node.description : null;

  return (
    <article
      data-node-id={id}
      className="rounded-md border border-border/70 bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <h3 className="text-sm font-bold text-foreground">{nodeDisplayTitle(node) ?? "Clinical step"}</h3>
      {detail && <p className="mt-2 text-xs leading-6 text-muted-foreground">{detail}</p>}
      {linked.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {linked.slice(0, 3).map((blockId, index) => (
            <button
              key={blockId}
              type="button"
              title="منبع هنوز وارد نشده"
              onClick={() => onBlockClick?.(blockId)}
              className="min-h-10 rounded-md border border-border/70 px-2 text-[10px] text-muted-foreground hover:bg-background"
            >
              Source {index + 1}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}
