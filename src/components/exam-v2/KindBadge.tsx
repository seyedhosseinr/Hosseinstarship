"use client";

import { cn } from "@/lib/utils";

const KIND_LABELS: Record<string, string> = {
  core: "Core",
  pearl: "Pearl",
  warning: "Warning",
  pitfall: "Pitfall",
  keypoint: "Key Point",
  concept: "Concept",
  trap: "Trap",
  threshold: "Threshold",
  indication: "Indication",
  differential: "DDx",
  algorithm: "Algorithm",
  clinical_decision: "Clinical Decision",
  complication: "Complication",
  follow_up: "Follow-up",
  high_yield: "High Yield",
  interactive_algorithm: "Interactive",
};

export interface KindBadgeProps {
  kind: string;
  className?: string;
}

export function KindBadge({ kind, className }: KindBadgeProps) {
  const cssVar = `var(--lib-kind-${kind})`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold",
        className,
      )}
      style={{
        color: cssVar,
        background: `color-mix(in srgb, ${cssVar} 12%, transparent)`,
        borderLeft: `2px solid ${cssVar}`,
      }}
    >
      {KIND_LABELS[kind] ?? kind}
    </span>
  );
}
