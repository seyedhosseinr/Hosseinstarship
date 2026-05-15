"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { AlgorithmThresholds } from "./AlgorithmThresholds";
import { AlgorithmGates } from "./AlgorithmGates";
import { AlgorithmMatrix } from "./AlgorithmMatrix";
import { AlgorithmTraps } from "./AlgorithmTraps";
import { AlgorithmCheckpoints } from "./AlgorithmCheckpoints";
import type { AlgorithmSurfaceV4 } from "@/types/algorithm-ir-v4";

type TabKey = "nodes" | "thresholds" | "gates" | "matrix" | "traps" | "checkpoints";

const TAB_LABELS: Record<TabKey, string> = {
  nodes: "گره‌ها",
  thresholds: "آستانه‌ها",
  gates: "دروازه‌ها",
  matrix: "ماتریس",
  traps: "تله‌ها",
  checkpoints: "نکات بوردی",
};

interface AlgorithmDetailsPanelProps {
  surface: AlgorithmSurfaceV4;
}

export function AlgorithmDetailsPanel({ surface }: AlgorithmDetailsPanelProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("nodes");

  // Compute available tabs
  const availableTabs: TabKey[] = [];
  if (surface.nodes.length > 0) availableTabs.push("nodes");
  if (surface.thresholds && surface.thresholds.length > 0) availableTabs.push("thresholds");
  if (surface.gates && surface.gates.length > 0) availableTabs.push("gates");
  if (surface.matrices && surface.matrices.length > 0) availableTabs.push("matrix");
  if (surface.boardTraps && surface.boardTraps.length > 0) availableTabs.push("traps");
  if (surface.checkpoints && surface.checkpoints.length > 0) availableTabs.push("checkpoints");

  const hasContent = availableTabs.length > 0;

  // Ensure activeTab is available
  const safeTab = availableTabs.includes(activeTab)
    ? activeTab
    : (availableTabs[0] ?? "nodes");

  if (!hasContent) {
    return (
      <div
        dir="rtl"
        lang="fa"
        className="px-4 py-3 text-sm text-slate-500"
      >
        جزئیات بیشتری برای این الگوریتم ثبت نشده است
      </div>
    );
  }

  return (
    <div dir="rtl" lang="fa" className="border-t border-slate-700/40">
      {/* Toggle */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800/40 transition-colors"
      >
        <span>جزئیات بالینی</span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-500" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4">
          {/* Tabs */}
          <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-700/40 pb-2">
            {availableTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  safeTab === tab
                    ? "bg-indigo-600/30 text-indigo-200"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/40"
                }`}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div>
            {safeTab === "nodes" && (
              <NodesList nodes={surface.nodes} surfaceId={surface.surfaceId} />
            )}
            {safeTab === "thresholds" && surface.thresholds && (
              <AlgorithmThresholds thresholds={surface.thresholds} />
            )}
            {safeTab === "gates" && surface.gates && (
              <AlgorithmGates gates={surface.gates} />
            )}
            {safeTab === "matrix" && surface.matrices && (
              <AlgorithmMatrix matrices={surface.matrices} />
            )}
            {safeTab === "traps" && surface.boardTraps && (
              <AlgorithmTraps traps={surface.boardTraps} />
            )}
            {safeTab === "checkpoints" && surface.checkpoints && (
              <AlgorithmCheckpoints checkpoints={surface.checkpoints} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NodesList({
  nodes,
  surfaceId,
}: {
  nodes: AlgorithmSurfaceV4["nodes"];
  surfaceId: string;
}) {
  return (
    <div className="space-y-2">
      {nodes.map((node) => (
        <div
          key={node.nodeId}
          data-surface-id={surfaceId}
          data-node-id={node.nodeId}
          className="rounded-lg border border-slate-700/40 bg-slate-800/40 p-3 text-sm"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[10px] text-slate-400">
              {node.nodeType}
            </span>
            {node.memoryRole && (
              <span className="text-[10px] text-amber-400">{node.memoryRole}</span>
            )}
          </div>
          <p className="font-medium text-slate-200">{node.label}</p>
          {node.detail && <p className="mt-1 text-xs text-slate-400">{node.detail}</p>}
          {node.linkedBlockIds && node.linkedBlockIds.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
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
        </div>
      ))}
    </div>
  );
}
