"use client";

import { getSurfaceTypeLabel, type AlgorithmSurfaceV4 } from "@/types/algorithm-ir-v4";

interface AlgorithmSurfaceHeaderProps {
  surface: AlgorithmSurfaceV4;
}

export function AlgorithmSurfaceHeader({ surface }: AlgorithmSurfaceHeaderProps) {
  return (
    <div dir="rtl" lang="fa" className="space-y-3 pb-4">
      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-indigo-500/40 bg-indigo-500/15 px-2.5 py-0.5 text-xs font-semibold text-indigo-300">
          {getSurfaceTypeLabel(surface.surfaceType)}
        </span>
        {surface.complexityLevel && (
          <span className="rounded-full border border-slate-600/40 px-2 py-0.5 text-xs text-slate-400">
            {surface.complexityLevel}
          </span>
        )}
        {surface.semanticRole && (
          <span className="rounded-full border border-slate-600/40 px-2 py-0.5 text-xs text-slate-400">
            {surface.semanticRole}
          </span>
        )}
      </div>

      {/* Surface title */}
      <h2 className="text-xl font-bold leading-snug text-slate-50">
        {surface.title}
      </h2>

      {/* Clinical question */}
      {surface.clinicalQuestion && (
        <p className="text-sm leading-relaxed text-slate-400">
          {surface.clinicalQuestion}
        </p>
      )}

      {/* Exam entry points */}
      {surface.examEntryPoints && surface.examEntryPoints.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-500">نقطه ورود:</span>
          {surface.examEntryPoints.map((ep) => (
            <span
              key={ep}
              className="rounded border border-slate-600/40 px-2 py-0.5 text-xs text-slate-300"
            >
              {ep}
            </span>
          ))}
        </div>
      )}

      {/* Memory anchor */}
      {surface.memoryAnchor && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2">
          <span className="text-[11px] font-semibold text-amber-400">لنگر حافظه  </span>
          <span className="text-sm text-amber-200">{surface.memoryAnchor}</span>
        </div>
      )}
    </div>
  );
}
