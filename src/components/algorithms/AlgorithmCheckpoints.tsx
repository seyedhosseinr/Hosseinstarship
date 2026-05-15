"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { CheckpointV4 } from "@/types/algorithm-ir-v4";

interface CheckpointCardProps {
  checkpoint: CheckpointV4;
}

function CheckpointCard({ checkpoint }: CheckpointCardProps) {
  const [flipped, setFlipped] = useState(false);

  return (
    <button
      type="button"
      aria-expanded={flipped}
      onClick={() => setFlipped((f) => !f)}
      onKeyDown={(e) => {
        if (e.key === " ") { e.preventDefault(); setFlipped((f) => !f); }
      }}
      className={cn(
        "w-full rounded-xl border p-4 text-right transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
        flipped
          ? "border-indigo-500/40 bg-indigo-950/30"
          : "border-slate-600/40 bg-slate-800/40 hover:bg-slate-700/40",
      )}
    >
      {checkpoint.checkpointType && (
        <span className="mb-2 inline-block rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
          {checkpoint.checkpointType}
        </span>
      )}

      {!flipped ? (
        <>
          <p className="text-[11px] font-semibold text-slate-400 mb-1">پرسش</p>
          <p className="text-sm font-medium text-slate-100">{checkpoint.prompt}</p>
          <p className="mt-2 text-[11px] text-slate-500">کلیک کنید تا پاسخ ببینید ↩</p>
        </>
      ) : (
        <>
          <p className="text-[11px] font-semibold text-green-400 mb-1">پاسخ</p>
          <p className="text-sm text-slate-100">{checkpoint.answer}</p>
          {checkpoint.whyItMatters && (
            <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-950/15 p-2">
              <p className="text-[11px] font-semibold text-amber-400 mb-0.5">چرا مهم است</p>
              <p className="text-xs text-slate-300">{checkpoint.whyItMatters}</p>
            </div>
          )}
        </>
      )}

      {(checkpoint.linkedBlockIds?.length || checkpoint.linkedNodeIds?.length) ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {checkpoint.linkedBlockIds?.map((id) => (
            <span
              key={id}
              data-linked-block-id={id}
              className="rounded border border-slate-600/40 px-1.5 py-0.5 text-[9px] text-slate-500"
            >
              {id}
            </span>
          ))}
        </div>
      ) : null}
    </button>
  );
}

interface AlgorithmCheckpointsProps {
  checkpoints: CheckpointV4[];
}

export function AlgorithmCheckpoints({ checkpoints }: AlgorithmCheckpointsProps) {
  if (checkpoints.length === 0) return null;

  return (
    <div className="space-y-3">
      {checkpoints.map((cp, i) => (
        <CheckpointCard key={cp.checkpointId ?? i} checkpoint={cp} />
      ))}
    </div>
  );
}
