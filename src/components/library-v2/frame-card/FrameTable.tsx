import React from "react";
import { cn } from "@/lib/utils";
import type { FrameViewModel } from "@/lib/contract/note-viewer.types";
import { FrameBody } from "@/components/note-viewer/FrameBody";

export function FrameTable({
  tableData,
  onMediaRefClick,
}: {
  tableData: FrameViewModel["tableData"];
  onMediaRefClick?: (label: string) => void;
}) {
  if (!tableData) return null;

  const rows = tableData.rows as Array<Array<string | { text: string; bold?: boolean }>>;

  return (
    <div className="my-3 -mx-1 overflow-x-auto">
      <table className="w-full border-collapse text-[14.25px]">
        <thead>
          <tr>
            {tableData.headers.map((header, index) => (
              <th
                key={index}
                className={cn(
                  "border-b-[1.5px] border-lib-border/80 px-3.5 py-2 align-bottom",
                  "font-[740] leading-[1.65] text-lib-text",
                  "[&_strong]:font-[820] [&_em]:[font-style:oblique_12deg]",
                )}
                style={{ textAlign: "start" }}
              >
                <FrameBody body={header} compact onMediaRefClick={onMediaRefClick} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-b border-lib-border/25 last:border-b-0 hover:bg-lib-hover/18"
            >
              {row.map((cell, cellIndex) => {
                const value = typeof cell === "string" ? cell : cell.text;
                const bold = typeof cell === "string" ? false : Boolean(cell.bold);

                return (
                  <td
                    key={cellIndex}
                    className={cn(
                      "px-3.5 py-2.5 align-top leading-[1.65] text-lib-text/90",
                      bold && "font-[720] text-lib-text",
                      "[&_strong]:font-[800] [&_em]:[font-style:oblique_12deg]",
                    )}
                    style={{ textAlign: "start" }}
                  >
                    <FrameBody body={value} compact onMediaRefClick={onMediaRefClick} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
