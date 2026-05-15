"use client";

import { cn } from "@/lib/utils";
import {
  getSurfaceFamily,
  getSurfaceTypeLabel,
  FAMILY_LABELS,
  type AlgorithmSurfaceV4,
  type SurfaceFamily,
} from "@/types/algorithm-ir-v4";

interface AlgorithmSurfaceSelectorProps {
  surfaces: AlgorithmSurfaceV4[];
  selectedSurfaceId: string;
  onSelect: (surfaceId: string) => void;
  shortTitle: string;
}

export function AlgorithmSurfaceSelector({
  surfaces,
  selectedSurfaceId,
  onSelect,
  shortTitle,
}: AlgorithmSurfaceSelectorProps) {
  const shouldGroup = surfaces.length > 6;

  // Group by family
  const grouped = surfaces.reduce<Partial<Record<SurfaceFamily, AlgorithmSurfaceV4[]>>>(
    (acc, surface) => {
      const family = getSurfaceFamily(surface.surfaceType);
      if (!acc[family]) acc[family] = [];
      acc[family]!.push(surface);
      return acc;
    },
    {},
  );

  const families = Object.keys(grouped) as SurfaceFamily[];

  return (
    <aside
      dir="rtl"
      lang="fa"
      className="flex h-full flex-col border-l border-slate-700/50 bg-slate-900/80"
      style={{ width: 280, minWidth: 280 }}
    >
      {/* Header */}
      <div className="border-b border-slate-700/50 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          فهرست الگوریتم‌ها
        </p>
        <p className="mt-1 text-sm font-medium text-slate-300 leading-snug">
          {shortTitle}
        </p>
      </div>

      {/* Surface list */}
      <div className="flex-1 overflow-y-auto p-2">
        {shouldGroup ? (
          families.map((family) => (
            <div key={family} className="mb-3">
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {FAMILY_LABELS[family]}
              </p>
              {grouped[family]!.map((surface) => (
                <SurfaceItem
                  key={surface.surfaceId}
                  surface={surface}
                  isActive={surface.surfaceId === selectedSurfaceId}
                  onSelect={onSelect}
                />
              ))}
            </div>
          ))
        ) : (
          surfaces.map((surface) => (
            <SurfaceItem
              key={surface.surfaceId}
              surface={surface}
              isActive={surface.surfaceId === selectedSurfaceId}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </aside>
  );
}

function SurfaceItem({
  surface,
  isActive,
  onSelect,
}: {
  surface: AlgorithmSurfaceV4;
  isActive: boolean;
  onSelect: (surfaceId: string) => void;
}) {
  return (
    <button
      type="button"
      aria-current={isActive ? "true" : undefined}
      data-surface-id={surface.surfaceId}
      onClick={() => onSelect(surface.surfaceId)}
      className={cn(
        "w-full rounded-lg p-2.5 text-right transition-colors duration-150 hover:bg-slate-700/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
        isActive
          ? "border-r-2 border-indigo-500 bg-indigo-950/40 text-slate-100"
          : "text-slate-400 hover:text-slate-200",
      )}
    >
      <p className="text-sm font-medium leading-snug">{surface.title}</p>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <span className="rounded px-1.5 py-0.5 text-[10px] bg-slate-700/50 text-slate-400">
          {getSurfaceTypeLabel(surface.surfaceType)}
        </span>
        {surface.complexityLevel && (
          <span className="text-[10px] text-slate-500">{surface.complexityLevel}</span>
        )}
      </div>
    </button>
  );
}
