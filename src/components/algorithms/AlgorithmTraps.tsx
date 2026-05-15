"use client";

import type { BoardTrapV4 } from "@/types/algorithm-ir-v4";

interface AlgorithmTrapsProps {
  traps: BoardTrapV4[];
}

export function AlgorithmTraps({ traps }: AlgorithmTrapsProps) {
  if (traps.length === 0) return null;

  return (
    <div className="space-y-4">
      {traps.map((trap, i) => (
        <div
          key={trap.trapId ?? i}
          className="rounded-xl border border-rose-500/30 bg-rose-950/15 p-4 space-y-3"
        >
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
              تله بوردی
            </span>
            <h4 className="font-semibold text-rose-200">{trap.trapTitle}</h4>
          </div>

          {trap.wrongPath && (
            <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-3">
              <p className="mb-1 text-[11px] font-semibold text-red-400">مسیر اشتباه</p>
              <p className="text-sm text-red-200">{trap.wrongPath}</p>
            </div>
          )}

          {trap.correctPath && (
            <div className="rounded-lg border border-green-500/30 bg-green-950/20 p-3">
              <p className="mb-1 text-[11px] font-semibold text-green-400">مسیر صحیح</p>
              <p className="text-sm text-green-200">{trap.correctPath}</p>
            </div>
          )}

          {trap.whyItMatters && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-950/15 px-3 py-2">
              <p className="mb-1 text-[11px] font-semibold text-amber-400">چرا مهم است</p>
              <p className="text-sm text-slate-300">{trap.whyItMatters}</p>
            </div>
          )}

          {(trap.linkedBlockIds?.length || trap.linkedNodeIds?.length) ? (
            <div className="flex flex-wrap gap-1">
              {trap.linkedBlockIds?.map((id) => (
                <span
                  key={id}
                  data-linked-block-id={id}
                  className="rounded border border-slate-600/40 px-1.5 py-0.5 text-[9px] text-slate-500"
                >
                  {id}
                </span>
              ))}
              {trap.linkedNodeIds?.map((id) => (
                <span
                  key={id}
                  className="rounded border border-rose-600/30 px-1.5 py-0.5 text-[9px] text-rose-500"
                >
                  {id}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
