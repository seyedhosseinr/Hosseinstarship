"use client";

import { cn } from "@/lib/utils";

export interface ScoreRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

function scoreColor(pct: number): string {
  if (pct >= 80) return "var(--lib-correct)";
  if (pct >= 50) return "var(--lib-marked)";
  return "var(--lib-incorrect)";
}

export function ScoreRing({
  percentage,
  size = 130,
  strokeWidth = 12,
  className,
}: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const color = scoreColor(percentage);

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--lib-border)"
          strokeWidth={strokeWidth}
        />
        {/* Fill */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[28px] font-extrabold" style={{ color }}>
          {percentage}%
        </span>
        <span className="text-[10px] text-lib-text-muted">Correct</span>
      </div>
    </div>
  );
}
