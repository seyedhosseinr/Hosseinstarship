"use client";

import { cn } from "@/lib/utils";

export interface FilterChipProps {
  label: string;
  count?: number;
  active?: boolean;
  onClick: () => void;
  className?: string;
}

export function FilterChip({ label, count, active, onClick, className }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5",
        "text-xs font-medium transition-all duration-lib-fade ease-lib-fade",
        "cursor-pointer select-none [-webkit-tap-highlight-color:transparent]",
        "border",
        active
          ? "border-lib-accent bg-lib-accent/10 text-lib-accent"
          : "border-lib-border bg-lib-surface text-lib-text-secondary hover:bg-lib-hover",
        className,
      )}
    >
      {label}
      {count !== undefined && (
        <span
          className={cn(
            "rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums",
            active ? "bg-lib-accent/20" : "bg-lib-hover",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
