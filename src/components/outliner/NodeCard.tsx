"use client";

import type { AlgorithmRecord } from "@/types/algorithm-ir";
import { nodeDisplayTitle } from "@/components/outliner/navigation-labels";

// ── Node type display config ───────────────────────────────────────────────────

interface NodeTypeCfg {
  label: string;
  chipClass: string;   // badge classes
  borderClass: string; // article border
}

const NODE_TYPE_CFG: Record<string, NodeTypeCfg> = {
  entry:          { label: "ورود",         chipClass: "bg-emerald-400/15 text-emerald-400 border-emerald-400/40", borderClass: "border-emerald-400/50" },
  endpoint:       { label: "پایان",        chipClass: "bg-rose-400/15    text-rose-400    border-rose-400/40",    borderClass: "border-rose-400/50" },
  question:       { label: "سؤال",         chipClass: "bg-sky-400/15     text-sky-400     border-sky-400/40",     borderClass: "border-sky-400/50" },
  finding:        { label: "یافته",        chipClass: "bg-violet-400/15  text-violet-400  border-violet-400/40",  borderClass: "border-violet-400/50" },
  treatment:      { label: "درمان",        chipClass: "bg-teal-400/15    text-teal-400    border-teal-400/40",    borderClass: "border-teal-400/50" },
  test:           { label: "آزمایش",       chipClass: "bg-blue-400/15    text-blue-400    border-blue-400/40",    borderClass: "border-blue-400/50" },
  threshold:      { label: "آستانه",       chipClass: "bg-amber-400/15   text-amber-400   border-amber-400/40",   borderClass: "border-amber-400/40" },
  escalation:     { label: "اورژانس",      chipClass: "bg-red-500/15     text-red-400     border-red-400/40",     borderClass: "border-red-500/60" },
  trap:           { label: "تله",          chipClass: "bg-rose-500/15    text-rose-400    border-rose-400/40",    borderClass: "border-rose-500/60" },
  exception:      { label: "استثناء",      chipClass: "bg-gray-400/15    text-gray-400    border-gray-400/40",    borderClass: "border-gray-400/50" },
  mechanism:      { label: "مکانیسم",      chipClass: "bg-purple-400/15  text-purple-400  border-purple-400/40",  borderClass: "border-purple-400/50" },
  clinical_effect:{ label: "اثر",          chipClass: "bg-cyan-400/15    text-cyan-400    border-cyan-400/40",    borderClass: "border-cyan-400/50" },
  classification: { label: "طبقه‌بندی",    chipClass: "bg-indigo-400/15  text-indigo-400  border-indigo-400/40",  borderClass: "border-indigo-400/50" },
};

function getNodeCfg(nodeType: string): NodeTypeCfg {
  return NODE_TYPE_CFG[nodeType] ?? {
    label: nodeType,
    chipClass: "bg-muted/30 text-muted-foreground border-border/40",
    borderClass: "border-border/70",
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NodeCard({
  node,
  onBlockClick,
}: {
  node: AlgorithmRecord;
  onBlockClick?: (blockId: string) => void;
}) {
  const id          = String(node.id ?? node.nodeId ?? "node");
  const nodeType    = typeof node.nodeType === "string" ? node.nodeType : "";
  const cfg         = getNodeCfg(nodeType);
  const title       = nodeDisplayTitle(node) ?? "Clinical step";
  const detail      = typeof node.detail       === "string" ? node.detail       : typeof node.description   === "string" ? node.description   : null;
  const testable    = typeof node.testablePoint === "string" ? node.testablePoint : null;
  const memoryRole  = typeof node.memoryRole    === "string" ? node.memoryRole    : null;
  const sourceSupport = typeof node.sourceSupport === "string" ? node.sourceSupport : null;
  const linked      = Array.isArray(node.linkedBlockIds)
    ? node.linkedBlockIds.filter((item): item is string => typeof item === "string")
    : [];

  return (
    <article
      data-node-id={id}
      className={`rounded-md border ${cfg.borderClass} bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md`}
    >
      {/* Header row: title + type badge */}
      <div className="mb-2 flex items-start gap-2">
        <h3 className="flex-1 text-sm font-bold leading-5 text-foreground">{title}</h3>
        {nodeType && (
          <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${cfg.chipClass}`}>
            {cfg.label}
          </span>
        )}
      </div>

      {/* Clinical detail */}
      {detail && (
        <p className="mt-1 text-xs leading-6 text-muted-foreground">{detail}</p>
      )}

      {/* Testable board point */}
      {testable && (
        <div className="mt-2 rounded border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-xs text-amber-400">
          📋 {testable}
        </div>
      )}

      {/* Trap / memory-role indicator */}
      {memoryRole === "trap" && (
        <div className="mt-2 rounded border border-rose-400/30 bg-rose-400/10 px-2 py-1 text-xs text-rose-400">
          ⚠ نقطه تله‌دار
        </div>
      )}

      {/* Source support excerpt */}
      {sourceSupport && (
        <p className="mt-2 text-[11px] italic text-muted-foreground/70 line-clamp-2">{sourceSupport}</p>
      )}

      {/* Linked block chips */}
      {linked.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {linked.slice(0, 4).map((blockId, index) => (
            <button
              key={blockId}
              type="button"
              title="منبع هنوز وارد نشده"
              onClick={() => onBlockClick?.(blockId)}
              className="min-h-8 rounded border border-border/60 px-2 text-[10px] text-muted-foreground hover:bg-background hover:text-foreground"
            >
              منبع {index + 1}
            </button>
          ))}
          {linked.length > 4 && (
            <span className="rounded border border-border/40 px-2 py-0.5 text-[10px] text-muted-foreground">
              +{linked.length - 4}
            </span>
          )}
        </div>
      )}
    </article>
  );
}
