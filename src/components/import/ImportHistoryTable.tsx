"use client";

import { AlertTriangle, Clock3, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { ImportSummary } from "@/lib/actions/import-actions";
import { cn } from "@/lib/utils";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatDate(value: number | null | undefined) {
  if (!value) return "Pending";
  return dateFmt.format(new Date(value));
}

function getStatusVariant(status: string | undefined) {
  switch ((status ?? "").toLowerCase()) {
    case "completed":
      return { label: "Completed", variant: "success" as const };
    case "failed":
      return { label: "Failed", variant: "destructive" as const };
    case "running":
      return { label: "Running", variant: "warning" as const };
    default:
      return { label: status ?? "Pending", variant: "secondary" as const };
  }
}

type ImportHistoryTableProps = {
  imports: ImportSummary[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  onDeleteRequest: (item: ImportSummary) => void;
};

export function ImportHistoryTable({
  imports,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  onDeleteRequest,
}: ImportHistoryTableProps) {
  const allSelected = imports.length > 0 && imports.every((row) => selectedIds.has(row.id));

  if (imports.length === 0) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-border bg-card/70 px-6 py-12 text-center text-sm text-muted-foreground">
        No import history matched the current filters.
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-[1.75rem] border border-border/40 bg-card/70 shadow-[0_16px_60px_hsl(var(--foreground)/0.06)] backdrop-blur-xl"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b border-border/40 bg-muted/50">

              <th className="w-10 px-4 py-3 text-center">
                <Checkbox checked={allSelected} onCheckedChange={onToggleAll} />
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Source
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Input path
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Started
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Items
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Status
              </th>
              <th className="w-16 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Admin
              </th>
            </tr>
          </thead>

          <tbody>
            {imports.map((row) => {
              const selected = selectedIds.has(row.id);
              const status = getStatusVariant(row.status);

              return (
                <tr
                  key={row.id}
                  className={cn("border-b border-border/40 transition-colors last:border-b-0", selected && "bg-info/5 dark:bg-info/5")}
                >
                  <td className="px-4 py-4 text-center align-top">
                    <Checkbox checked={selected} onCheckedChange={() => onToggleSelect(row.id)} />
                  </td>

                  <td className="px-4 py-4 align-top">
                    <div className="space-y-1">
                      <div className="font-semibold text-foreground">
                        {row.sourceName ?? row.fileName ?? "Unnamed import"}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{row.sourceType ?? "batch"}</span>
                        {row.contentType ? <span>- {row.contentType}</span> : null}
                        {row.fileType ? <span>- {row.fileType}</span> : null}
                        {row.sourceVersion ? <span>- {row.sourceVersion}</span> : null}
                        {row.schemaVersion ? <span>- {row.schemaVersion}</span> : null}
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <div className="max-w-[260px] truncate text-xs text-muted-foreground">
                      <code>{row.inputPath ?? "No input path recorded"}</code>
                    </div>
                    {row.completedAt ? (
                      <div className="mt-2 text-xs text-muted-foreground/60">Completed {formatDate(row.completedAt)}</div>
                    ) : null}
                  </td>

                  <td className="px-4 py-4 align-top">
                    <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5 text-muted-foreground/60" />
                      {formatDate(row.startedAt ?? row.createdAt)}
                    </div>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <div className="text-sm font-semibold text-foreground">{(row.itemCount ?? 0).toLocaleString()}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {row.noteDocumentCount > 0 ? `${row.noteDocumentCount} notes • ` : ""}
                      {row.questionCount > 0 ? `${row.questionCount} MCQs • ` : ""}
                      {row.flashcardCount > 0 ? `${row.flashcardCount} flashcards • ` : ""}
                      {row.chunkCount > 0 ? `${row.chunkCount} chunks` : "Persisted counts"}
                    </div>
                  </td>

                  <td className="px-4 py-4 align-top">
                    <Badge variant={status.variant}>{status.label}</Badge>
                    {row.examLinkedQuestionCount && row.examLinkedQuestionCount > 0 ? (
                      <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-warning/20 bg-warning/10 px-3 py-1 text-[11px] text-warning dark:border-warning/20 dark:bg-warning/10 dark:text-warning">
                        <AlertTriangle className="h-3 w-3" />
                        Exam-linked items preserved
                      </div>
                    ) : null}
                  </td>

                  <td className="px-4 py-4 text-center align-top">
                    <button
                      type="button"
                      onClick={() => onDeleteRequest(row)}
                      className="rounded-xl border border-border/40 bg-card p-2 text-muted-foreground/60 transition hover:border-border hover:text-muted-foreground"
                      title="Delete import batch"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
