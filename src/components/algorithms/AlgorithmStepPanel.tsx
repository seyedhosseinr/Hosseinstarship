"use client";

import { useState } from "react";
import { RotateCcw, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNodeTypeLabel, type AlgorithmSurfaceV4, type AlgorithmEdgeV4 } from "@/types/algorithm-ir-v4";

interface AlgorithmStepPanelProps {
  surface: AlgorithmSurfaceV4;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onReset: () => void;
}

function isEscalationEdge(edge: AlgorithmEdgeV4): boolean {
  return (
    edge.edgeType === "escalation" ||
    Boolean(edge.condition && /تب|لرز|اورژانس|عفونی/i.test(edge.condition))
  );
}

export function AlgorithmStepPanel({
  surface,
  selectedNodeId,
  onSelectNode,
  onReset,
}: AlgorithmStepPanelProps) {
  const [open, setOpen] = useState(false);

  const node = surface.nodes.find((n) => n.nodeId === selectedNodeId);
  const outgoing = selectedNodeId
    ? surface.edges.filter((e) => e.from === selectedNodeId)
    : [];
  const isEndpoint = outgoing.length === 0 && Boolean(node);

  return (
    <div dir="rtl" lang="fa" className="border-t border-slate-700/40">
      {/* Toggle bar — always visible */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-slate-800/40 transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        )}
        {node ? (
          <>
            <span className="shrink-0 rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] text-slate-400">
              {getNodeTypeLabel(node.nodeType)}
            </span>
            <span className="flex-1 truncate text-right text-slate-200 text-xs font-medium">
              {node.label}
            </span>
            {outgoing.length > 0 && (
              <span className="shrink-0 rounded-full bg-indigo-900/40 px-2 py-0.5 text-[10px] text-indigo-300">
                {outgoing.length} مسیر
              </span>
            )}
            {isEndpoint && (
              <span className="shrink-0 rounded-full border border-slate-600/40 px-2 py-0.5 text-[10px] text-slate-500">
                پایان
              </span>
            )}
          </>
        ) : (
          <span className="flex-1 text-right text-xs text-slate-500">
            یک گره را از نمودار انتخاب کنید
          </span>
        )}
      </button>

      {/* Expanded content */}
      {open && node && (
        <div className="px-4 pb-4 space-y-3">
          {/* Detail */}
          {node.detail && (
            <p className="text-sm leading-relaxed text-slate-300">{node.detail}</p>
          )}

          {/* Testable point */}
          {node.testablePoint && (
            <div className="rounded-lg bg-amber-950/30 border border-amber-500/25 px-3 py-2">
              <p className="text-sm font-medium text-amber-200">{node.testablePoint}</p>
            </div>
          )}

          {/* Memory role */}
          {node.memoryRole && (
            <span className="inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">
              {node.memoryRole}
            </span>
          )}

          {/* Linked block chips */}
          {node.linkedBlockIds && node.linkedBlockIds.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {node.linkedBlockIds.map((id) => (
                <span
                  key={id}
                  data-linked-block-id={id}
                  className="rounded border border-slate-600/40 px-1.5 py-0.5 text-[9px] text-slate-500"
                >
                  {id}
                </span>
              ))}
            </div>
          )}

          {/* Outgoing paths */}
          {outgoing.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-semibold text-slate-400">مسیرهای بعدی</p>
              <div className="space-y-1.5">
                {outgoing.map((edge) => {
                  const isRed = isEscalationEdge(edge);
                  const targetNode = surface.nodes.find((n) => n.nodeId === edge.to);
                  return (
                    <button
                      key={edge.edgeId}
                      type="button"
                      onClick={() => onSelectNode(edge.to)}
                      data-edge-id={edge.edgeId}
                      data-surface-id={surface.surfaceId}
                      className={cn(
                        "w-full rounded-lg border px-3 py-2 text-right text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
                        isRed
                          ? "border-red-500/40 bg-red-950/20 text-red-200 hover:bg-red-900/30"
                          : "border-slate-600/40 bg-slate-700/30 text-slate-200 hover:bg-slate-600/40",
                      )}
                    >
                      {edge.condition && (
                        <span className={cn("text-xs font-medium", isRed ? "text-red-300" : "text-indigo-300")}>
                          {edge.condition} →{" "}
                        </span>
                      )}
                      {targetNode?.label ?? edge.to}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Endpoint state */}
          {isEndpoint && (
            <div className="flex items-center justify-between rounded-lg border border-slate-600/30 bg-slate-800/50 px-3 py-2">
              <span className="text-sm text-slate-400">پایان این مسیر</span>
              <button
                type="button"
                onClick={onReset}
                className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300"
              >
                <RotateCcw className="h-3 w-3" />
                شروع دوباره
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
