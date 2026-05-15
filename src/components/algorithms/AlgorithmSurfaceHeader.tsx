"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { getSurfaceTypeLabel, type AlgorithmSurfaceV4 } from "@/types/algorithm-ir-v4";

interface AlgorithmSurfaceHeaderProps {
  surface: AlgorithmSurfaceV4;
}

export function AlgorithmSurfaceHeader({ surface }: AlgorithmSurfaceHeaderProps) {
  const [expanded, setExpanded] = useState(false);

  const hasExtra =
    surface.clinicalQuestion ||
    (surface.examEntryPoints && surface.examEntryPoints.length > 0) ||
    surface.memoryAnchor ||
    surface.complexityLevel ||
    surface.semanticRole;

  return (
    <div dir="rtl" lang="fa">
      {/* Compact single-line row */}
      <div className="flex items-center gap-2">
        <span className="shrink-0 rounded-full border border-indigo-500/40 bg-indigo-500/15 px-2 py-0.5 text-[11px] font-semibold text-indigo-300">
          {getSurfaceTypeLabel(surface.surfaceType)}
        </span>
        <h2 className="flex-1 truncate text-sm font-bold text-slate-100">
          {surface.title}
        </h2>
        {hasExtra && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            className="shrink-0 flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200 hover:bg-slate-700/40 transition-colors"
          >
            {expanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            جزئیات
          </button>
        )}
      </div>

      {/* Expandable details */}
      {expanded && (
        <div className="mt-2.5 space-y-2 pb-1">
          {surface.clinicalQuestion && (
            <p className="text-xs leading-relaxed text-slate-400">
              {surface.clinicalQuestion}
            </p>
          )}
          {surface.examEntryPoints && surface.examEntryPoints.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-slate-500">نقطه ورود:</span>
              {surface.examEntryPoints.map((ep) => (
                <span
                  key={ep}
                  className="rounded border border-slate-600/40 px-1.5 py-0.5 text-[11px] text-slate-300"
                >
                  {ep}
                </span>
              ))}
            </div>
          )}
          {surface.memoryAnchor && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-1.5">
              <span className="text-[10px] font-semibold text-amber-400">لنگر حافظه  </span>
              <span className="text-xs text-amber-200">{surface.memoryAnchor}</span>
            </div>
          )}
          {(surface.complexityLevel || surface.semanticRole) && (
            <div className="flex flex-wrap gap-1.5">
              {surface.complexityLevel && (
                <span className="rounded-full border border-slate-600/40 px-2 py-0.5 text-[10px] text-slate-400">
                  {surface.complexityLevel}
                </span>
              )}
              {surface.semanticRole && (
                <span className="rounded-full border border-slate-600/40 px-2 py-0.5 text-[10px] text-slate-400">
                  {surface.semanticRole}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
