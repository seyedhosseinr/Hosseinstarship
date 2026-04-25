"use client";

import { cn } from "@/lib/utils";

export interface BreakdownSegment {
  label: string;
  value: number;
  color: string;
}

export interface BreakdownBarProps {
  segments: BreakdownSegment[];
  total: number;
  height?: number;
  showLegend?: boolean;
  className?: string;
}

export function BreakdownBar({
  segments,
  total,
  height = 14,
  showLegend = true,
  className,
}: BreakdownBarProps) {
  return (
    <div className={cn("w-full", className)}>
      <div
        className="flex overflow-hidden rounded-full bg-lib-hover"
        style={{ height }}
      >
        {segments.map((seg, i) => (
          <div
            key={i}
            className="transition-[width] duration-500 ease-out"
            style={{
              width: total > 0 ? `${(seg.value / total) * 100}%` : "0%",
              background: seg.color,
            }}
          />
        ))}
      </div>
      {showLegend && (
        <div className="mt-2 flex flex-wrap gap-4 text-xs">
          {segments.map((seg, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: seg.color }}
              />
              <span className="text-lib-text-secondary">
                {seg.label}:{" "}
                <b style={{ color: seg.color }}>{seg.value}</b>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
