"use client";

import type { DecisionMatrixV4 } from "@/types/algorithm-ir-v4";

interface AlgorithmMatrixProps {
  matrices: DecisionMatrixV4[];
}

export function AlgorithmMatrix({ matrices }: AlgorithmMatrixProps) {
  if (matrices.length === 0) return null;

  return (
    <div className="space-y-5">
      {matrices.map((m, mi) => (
        <div key={m.matrixId ?? mi} className="space-y-2">
          <h4 className="font-semibold text-slate-100">{m.title}</h4>
          <div className="overflow-x-auto rounded-xl border border-slate-700/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/80">
                  <th className="p-3 text-right font-semibold text-slate-300">شرط</th>
                  <th className="p-3 text-right font-semibold text-slate-300">تصمیم</th>
                  <th className="p-3 text-right font-semibold text-slate-300">دلیل</th>
                  <th className="p-3 text-right font-semibold text-slate-300">دام</th>
                </tr>
              </thead>
              <tbody>
                {m.rows.map((row, ri) => (
                  <tr
                    key={ri}
                    className="border-b border-slate-700/30 last:border-0 hover:bg-slate-700/20"
                  >
                    <td className="p-3 text-slate-200">{row.condition ?? "—"}</td>
                    <td className="p-3 text-slate-200">{row.decision ?? "—"}</td>
                    <td className="p-3 text-slate-300">{row.reason ?? "—"}</td>
                    <td
                      className={
                        row.trap
                          ? "p-3 font-medium text-rose-300 bg-rose-950/20"
                          : "p-3 text-slate-500"
                      }
                    >
                      {row.trap || "—"}
                      {row.linkedBlockIds && row.linkedBlockIds.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {row.linkedBlockIds.map((id) => (
                            <span
                              key={id}
                              data-linked-block-id={id}
                              className="rounded border border-slate-600/40 px-1 py-0.5 text-[9px] text-slate-500"
                            >
                              {id}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
