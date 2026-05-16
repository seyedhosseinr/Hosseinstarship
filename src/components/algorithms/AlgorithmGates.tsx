"use client";

import type { GateV4 } from "@/types/algorithm-ir-v4";

interface AlgorithmGatesProps {
  gates: GateV4[];
}

export function AlgorithmGates({ gates }: AlgorithmGatesProps) {
  if (gates.length === 0) return null;

  return (
    <div className="space-y-4">
      {gates.map((g, i) => (
        <div
          key={g.gateId ?? i}
          className="rounded-xl border border-slate-600/40 bg-slate-800/50 p-4 space-y-3"
        >
          <h4 className="font-semibold text-slate-100">{g.title}</h4>

          {g.entryCondition && (
            <div className="rounded-lg border border-indigo-500/30 bg-indigo-950/30 px-3 py-2 text-sm text-indigo-200">
              {g.entryCondition}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {g.includeCriteria && g.includeCriteria.length > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold text-green-400">معیار ورود</p>
                <ul className="space-y-1">
                  {g.includeCriteria.map((c, j) => (
                    <li key={j} className="flex items-start gap-1.5 text-sm text-slate-300">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {g.excludeCriteria && g.excludeCriteria.length > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold text-red-400">معیار خروج</p>
                <ul className="space-y-1">
                  {g.excludeCriteria.map((c, j) => (
                    <li key={j} className="flex items-start gap-1.5 text-sm text-slate-300">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {g.actionIfPass && (
            <div className="rounded-lg border border-green-500/30 bg-green-950/20 p-2 text-sm text-green-200">
              ✓ {g.actionIfPass}
            </div>
          )}

          {g.actionIfFail && (
            <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-2 text-sm text-red-200">
              ✗ {g.actionIfFail}
            </div>
          )}

          {g.exceptions && g.exceptions.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-2">
              <p className="mb-1 text-[11px] font-semibold text-amber-400">استثناء</p>
              {g.exceptions.map((ex, j) => (
                <p key={j} className="text-sm text-slate-300">{ex}</p>
              ))}
            </div>
          )}

          {g.linkedBlockIds && g.linkedBlockIds.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {g.linkedBlockIds.map((id) => (
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
