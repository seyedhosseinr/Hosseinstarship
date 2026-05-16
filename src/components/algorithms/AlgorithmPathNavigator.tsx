"use client";

import { ChevronRight, ChevronLeft, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AlgorithmSurfaceV4, AlgorithmEdgeV4 } from "@/types/algorithm-ir-v4";

interface AlgorithmPathNavigatorProps {
  surface: AlgorithmSurfaceV4;
  selectedNodeId: string | null;
  visitedPath: string[];
  onSelectNode: (nodeId: string) => void;
  onReset: () => void;
  onBack: () => void;
}

function getOutgoingEdges(surface: AlgorithmSurfaceV4, nodeId: string): AlgorithmEdgeV4[] {
  return surface.edges.filter((e) => e.from === nodeId);
}

function isYesNo(condition?: string): "yes" | "no" | null {
  if (!condition) return null;
  if (/^بله/.test(condition)) return "yes";
  if (/^خیر/.test(condition)) return "no";
  return null;
}

export function AlgorithmPathNavigator({
  surface,
  selectedNodeId,
  visitedPath,
  onSelectNode,
  onReset,
  onBack,
}: AlgorithmPathNavigatorProps) {
  const currentNode = surface.nodes.find((n) => n.nodeId === selectedNodeId);
  const outgoing = selectedNodeId ? getOutgoingEdges(surface, selectedNodeId) : [];
  const stepIndex = selectedNodeId ? visitedPath.indexOf(selectedNodeId) : -1;

  const canGoBack = visitedPath.length > 1;
  const isEndpoint = outgoing.length === 0;

  return (
    <div dir="rtl" lang="fa" className="border-b border-slate-700/40 bg-slate-900/60 px-4 py-2.5">
      <div className="flex items-center gap-3">
        {/* Back / reset */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onBack}
            disabled={!canGoBack}
            title="مرحله قبل"
            className={cn(
              "flex h-8 min-w-[44px] items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs transition-colors",
              canGoBack
                ? "bg-slate-700/50 text-slate-200 hover:bg-slate-600/60"
                : "cursor-not-allowed opacity-30 bg-slate-800/30 text-slate-500",
            )}
          >
            <ChevronRight className="h-3.5 w-3.5" />
            مرحله قبل
          </button>

          <button
            type="button"
            onClick={onReset}
            title="شروع دوباره"
            className="flex h-8 min-w-[44px] items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs bg-slate-700/40 text-slate-400 hover:bg-slate-600/50 transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            شروع دوباره
          </button>
        </div>

        {/* Step indicator */}
        {currentNode && (
          <div className="flex-1 flex items-center gap-2 overflow-hidden">
            <span className="shrink-0 rounded bg-indigo-900/50 px-1.5 py-0.5 text-[10px] font-mono text-indigo-300">
              گام {stepIndex + 1} از {surface.nodes.length}
            </span>
            <span className="truncate text-xs text-slate-300">{currentNode.label}</span>
          </div>
        )}

        {/* Next step / branch choices */}
        {!isEndpoint && outgoing.length === 1 && (
          <button
            type="button"
            onClick={() => onSelectNode(outgoing[0].to)}
            className="flex h-8 min-w-[44px] items-center justify-center gap-1.5 rounded-lg px-3 text-xs bg-indigo-600/30 text-indigo-200 hover:bg-indigo-500/40 transition-colors"
          >
            مرحله بعد
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        )}

        {!isEndpoint && outgoing.length > 1 && (
          <div className="flex items-center gap-1.5">
            {outgoing.map((edge) => {
              const yesNo = isYesNo(edge.condition);
              const isEscalation = edge.edgeType === "escalation" ||
                (edge.condition && /تب|لرز|اورژانس/i.test(edge.condition));
              return (
                <button
                  key={edge.edgeId}
                  type="button"
                  onClick={() => onSelectNode(edge.to)}
                  className={cn(
                    "h-8 min-w-[44px] rounded-lg px-2.5 text-xs font-medium transition-colors",
                    isEscalation
                      ? "bg-red-900/40 text-red-200 hover:bg-red-800/50"
                      : yesNo === "yes"
                      ? "bg-green-900/40 text-green-200 hover:bg-green-800/50"
                      : yesNo === "no"
                      ? "bg-slate-700/50 text-slate-300 hover:bg-slate-600/60"
                      : "bg-indigo-900/30 text-indigo-200 hover:bg-indigo-800/40",
                  )}
                >
                  {edge.condition ?? "بعدی"}
                </button>
              );
            })}
          </div>
        )}

        {isEndpoint && (
          <span className="rounded-full border border-slate-600/40 px-2.5 py-0.5 text-[11px] text-slate-500">
            پایان این مسیر
          </span>
        )}
      </div>
    </div>
  );
}
