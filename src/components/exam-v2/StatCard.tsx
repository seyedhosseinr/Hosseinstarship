"use client";

import { cn } from "@/lib/utils";

export interface StatCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  color?: string;
  className?: string;
}

export function StatCard({ icon, value, label, color, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lib-sm border border-lib-border bg-lib-surface p-4 text-center",
        className,
      )}
    >
      <div className="mb-1.5 flex justify-center" style={color ? { color } : undefined}>
        {icon}
      </div>
      <div className="text-[22px] font-bold text-lib-text">{value}</div>
      <div className="mt-0.5 text-[11px] text-lib-text-muted">{label}</div>
    </div>
  );
}
