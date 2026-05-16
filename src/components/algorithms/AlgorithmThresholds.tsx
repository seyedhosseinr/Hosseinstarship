"use client";

import type { ThresholdV4 } from "@/types/algorithm-ir-v4";

interface AlgorithmThresholdsProps {
  thresholds: ThresholdV4[];
}

export function AlgorithmThresholds({ thresholds }: AlgorithmThresholdsProps) {
  if (thresholds.length === 0) return null;

  return (
    <div className="space-y-3">
      {thresholds.map((t, i) => (
        <div
          key={t.thresholdId ?? i}
          className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 space-y-2"
        >
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-amber-300">{t.variable}</span>
            <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-sm font-semibold text-amber-200">
              {t.value}
            </span>
          </div>

          {t.conditionText && (
            <p className="text-sm text-slate-300">{t.conditionText}</p>
          )}

          {t.decisionImpact && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-900/20 p-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-400">
                تأثیر تصمیم
              </p>
              <p className="text-sm text-slate-200">{t.decisionImpact}</p>
            </div>
          )}

          {t.memoryAnchor && (
            <p className="text-sm italic text-amber-400/80">
              لنگر حافظه: {t.memoryAnchor}
            </p>
          )}

          {t.linkedBlockIds && t.linkedBlockIds.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {t.linkedBlockIds.map((id) => (
                <span
                  key={id}
                  data-linked-block-id={id}
                  className="rounded border border-slate-600/40 px-1.5 py-0.5 text-[9px] text-slate-500"
                >
                  {id}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
