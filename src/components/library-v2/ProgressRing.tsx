"use client";

import { cn } from "@/lib/utils";

/**
 * SVG arc progress indicator. 36px diameter.
 * Shows section-weighted progress as a stroke-dashoffset arc.
 * Center text: current / total sections.
 */
interface ProgressRingProps {
  /** 0–100 */
  progress: number;
  /** e.g. "4/12" */
  label?: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function ProgressRing({
  progress,
  label,
  size = 36,
  strokeWidth = 3,
  className,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--lib-border)"
          strokeWidth={strokeWidth}
        />
        {/* Arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--lib-accent)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-lib-spring ease-lib-spring"
        />
      </svg>
      {label && (
        <span
          className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold tabular-nums text-lib-text-secondary"
        >
          {label}
        </span>
      )}
    </div>
  );
}
