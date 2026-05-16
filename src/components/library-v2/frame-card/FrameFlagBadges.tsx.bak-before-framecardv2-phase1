import React from "react";
import type { FrameViewModel } from "@/lib/contract/note-viewer.types";

export function FrameFlagBadges({ frame }: { frame: FrameViewModel }) {
  const badges: string[] = [];

  if (frame.v8Flags?.highYield ?? frame.highYield) badges.push("High-yield");
  if (frame.v8Flags?.decisionChanging) badges.push("Decision changing");
  if (frame.v8Flags?.examRelevant) badges.push("Exam relevant");

  if (!badges.length) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {badges.map((badge) => (
        <span
          key={badge}
          dir="ltr"
          className="inline-flex items-center rounded-[999px] border border-lib-border/50 bg-lib-surface/60 px-2 py-[2px] text-[10px] font-[650] tracking-[0.015em] text-lib-text-muted"
        >
          {badge}
        </span>
      ))}
    </div>
  );
}
