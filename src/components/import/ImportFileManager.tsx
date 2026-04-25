"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, FileDown, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { submitImportBatch } from "@/app/import/actions";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  bulkDeleteImportBatchesAction,
  deleteImportBatchAction,
  getImportBatchDetailsAction,
  getImportHistoryAction,
  type ImportBatchDetails,
  type ImportSummary,
} from "@/lib/actions/import-actions";
import type { ImportActionState, ImportHistoryEntry } from "@/lib/import-light/types";
import { colorLight, colorDark } from "@/lib/theme/tokens";

const IFM_STYLES = `
[data-import-fm] {
${Object.entries(colorLight).map(([k, v]) => `  --ifm-${k}: ${v};`).join("\n")}
}
.dark [data-import-fm] {
${Object.entries(colorDark).map(([k, v]) => `  --ifm-${k}: ${v};`).join("\n")}
}
`;
const C = Object.fromEntries(
  Object.keys(colorLight).map((k) => [k, `var(--ifm-${k})`]),
) as Record<keyof typeof colorLight, string>;

import { ImportHistoryTable } from "./ImportHistoryTable";
import { ImportUploadPanel } from "./ImportUploadPanel";

function toImportSummary(entry: ImportHistoryEntry): ImportSummary {
  return {
    id: entry.id,
    fileName: entry.fileName,
    sourceName: entry.sourceName,
    sourceType: entry.sourceType,
    contentType: entry.contentType,
    fileType: entry.fileType,
    sourceVersion: entry.sourceVersion,
    schemaVersion: entry.schemaVersion,
    inputPath: entry.inputPath,
    status: entry.status,
    startedAt: entry.startedAt,
    completedAt: entry.completedAt,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    itemCount: entry.itemCount,
    chunkCount: entry.chunkCount,
    noteDocumentCount: entry.noteDocumentCount,
    questionCount: entry.questionCount,
    flashcardCount: entry.flashcardCount,
    examLinkedQuestionCount: entry.examLinkedQuestionCount,
    errorMessage: entry.errorMessage,
  };
}

function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: ImportSummary[]) {
  const headers = [
    "id",
    "sourceName",
    "contentType",
    "fileType",
    "status",
    "itemCount",
    "chunkCount",
    "noteDocumentCount",
    "questionCount",
    "flashcardCount",
    "examLinkedQuestionCount",
    "inputPath",
    "createdAt",
    "completedAt",
  ];
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

  return [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.id,
        row.sourceName ?? row.fileName ?? "",
        row.contentType ?? "",
        row.fileType ?? "",
        row.status ?? "",
        row.itemCount,
        row.chunkCount,
        row.noteDocumentCount,
        row.questionCount,
        row.flashcardCount,
        row.examLinkedQuestionCount,
        row.inputPath ?? "",
        row.createdAt ?? "",
        row.completedAt ?? "",
      ]
        .map(escape)
        .join(","),
    ),
  ].join("\n");
}

type ImportFileManagerProps = {
  initialState: ImportActionState;
};

export function ImportFileManager({ initialState }: ImportFileManagerProps) {
  const [state, formAction] = useActionState(submitImportBatch, initialState);
  const [imports, setImports] = useState<ImportSummary[]>(() => initialState.history.map(toImportSummary));
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [contentFilter, setContentFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<ImportSummary | null>(null);
  const [deleteDetails, setDeleteDetails] = useState<ImportBatchDetails | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(initialState.snapshotError);
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isLoadingDetails, startDetailsTransition] = useTransition();

  useEffect(() => {
    setImports(state.history.map(toImportSummary));
    setSnapshotError(state.snapshotError);
  }, [state.history, state.snapshotError]);

  useEffect(() => {
    setSelectedIds((previous) => {
      const validIds = new Set(imports.map((item) => item.id));
      return new Set(Array.from(previous).filter((id) => validIds.has(id)));
    });
  }, [imports]);

  useEffect(() => {
    if (!deleteTarget) {
      setDeleteDetails(null);
      return;
    }

    let cancelled = false;
    startDetailsTransition(async () => {
      const result = await getImportBatchDetailsAction(deleteTarget.id);
      if (cancelled) return;

      if (result.success) {
        setDeleteDetails(result.data);
      } else {
        setDeleteDetails(null);
        toast.error(result.error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [deleteTarget]);

  const filteredImports = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return imports.filter((row) => {
      const matchesQuery =
        !query ||
        [
          row.sourceName,
          row.fileName,
          row.inputPath,
          row.sourceType,
          row.schemaVersion,
          row.status,
          row.contentType,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));

      const matchesStatus = statusFilter === "all" || (row.status ?? "pending") === statusFilter;
      const matchesContent = contentFilter === "all" || (row.contentType ?? "batch") === contentFilter;

      return matchesQuery && matchesStatus && matchesContent;
    });
  }, [contentFilter, imports, searchTerm, statusFilter]);

  const totalImports = imports.length;
  const totalItems = imports.reduce((sum, row) => sum + (row.itemCount ?? 0), 0);

  function toggleSelect(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (filteredImports.length === 0) return;
    const everySelected = filteredImports.every((row) => selectedIds.has(row.id));
    setSelectedIds(everySelected ? new Set() : new Set(filteredImports.map((row) => row.id)));
  }

  function refreshHistory() {
    startRefreshTransition(async () => {
      const result = await getImportHistoryAction(24);
      if (result.success) {
        setImports(result.data);
        setSnapshotError(null);
      } else {
        setSnapshotError(result.error);
        toast.error(result.error);
      }
    });
  }

  function handleExport() {
    const rows =
      selectedIds.size > 0
        ? filteredImports.filter((row) => selectedIds.has(row.id))
        : filteredImports;

    if (rows.length === 0) {
      toast.error("There is nothing to export.");
      return;
    }

    downloadTextFile("import-history.csv", toCsv(rows), "text/csv;charset=utf-8");
    toast.success(`Exported ${rows.length} import rows.`);
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;

    startDeleteTransition(async () => {
      const result = await deleteImportBatchAction(deleteTarget.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setDeleteTarget(null);
      setDeleteDetails(null);
      toast.success(
        result.data.fullyPurged
          ? "Import batch deleted."
          : "Import batch cleaned up. Exam-linked questions were preserved.",
      );
      refreshHistory();
    });
  }

  function handleBulkDeleteConfirm() {
    const ids = filteredImports.filter((row) => selectedIds.has(row.id)).map((row) => row.id);
    if (ids.length === 0) return;

    startDeleteTransition(async () => {
      const result = await bulkDeleteImportBatchesAction(ids);
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setBulkDeleteOpen(false);
      setSelectedIds(new Set());
      const preserved = result.data.reduce((sum, entry) => sum + entry.skipped.examLinkedQuestions, 0);
      toast.success(
        preserved > 0
          ? `Deleted ${result.data.length} import batches. ${preserved} exam-linked questions were preserved.`
          : `Deleted ${result.data.length} import batches.`,
      );
      refreshHistory();
    });
  }

  return (
    <div data-import-fm className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6">
      <style dangerouslySetInnerHTML={{ __html: IFM_STYLES }} />
      <PageHeader
        title="Import Workspace"
        description="The richer file-manager style import workspace is running on the shared PGlite + OPFS runtime with real history, real cleanup, and broader structured upload coverage."
        badge="IMPORT"
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Import" }]}
        actions={
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-info/20 bg-info/10 px-3 py-1 text-xs font-semibold text-info">
              {state.runtime}
            </div>
            <div className="rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-semibold text-muted-foreground">
              Shared runtime
            </div>
          </div>
        }
      />

      {snapshotError ? (
        <section className="rounded-[1.5rem] border border-warning/20 bg-warning/10 px-5 py-4 text-sm text-warning-foreground shadow-[0_12px_32px_hsl(var(--warning)/0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-warning">
            Workspace loaded with degraded data
          </p>
          <p className="mt-2 leading-6">{snapshotError}</p>
          <p className="mt-2 text-xs text-warning">
            The workspace stays mounted with empty-state history and truthful error details instead of crashing.
          </p>
        </section>
      ) : null}

      <ImportUploadPanel state={state} formAction={formAction} onImportMutation={refreshHistory} />

      <section
        className="rounded-[2rem] border bg-card/70 px-5 py-4 shadow-[0_16px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl"
        style={{ borderColor: C.border }}
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid flex-1 gap-3 md:grid-cols-[minmax(0,1.4fr)_180px_180px]">
            <div className="relative min-w-0">
              <Search
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: C.textMuted }}
              />
              <Input
                inputSize="sm"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search import history, source, format, path, or status..."
                className="border-border bg-card/90 pr-9"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground/80"
            >
              <option value="all">All statuses</option>
              <option value="completed">Completed</option>
              <option value="running">Running</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>

            <select
              value={contentFilter}
              onChange={(event) => setContentFilter(event.target.value)}
              className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground/80"
            >
              <option value="all">All artifact types</option>
              <option value="batch">Batch runs</option>
              <option value="notes">Notes</option>
              <option value="questions">MCQs</option>
              <option value="flashcards">Flashcards</option>
              <option value="yield">Yield cards</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/80 px-3 py-1">
              {totalImports.toLocaleString()} runs
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/80 px-3 py-1">
              {totalItems.toLocaleString()} items
            </span>
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handleExport}>
              <FileDown className="h-3.5 w-3.5" />
              Export visible
            </Button>
            {selectedIds.size > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setBulkDeleteOpen(true)}
                className="gap-2"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete selected ({selectedIds.size})
              </Button>
            ) : null}
            {isRefreshing ? <span>Refreshing history...</span> : null}
          </div>
        </div>
      </section>

      <ImportHistoryTable
        imports={filteredImports}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleAll={toggleAll}
        onDeleteRequest={setDeleteTarget}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete import batch</DialogTitle>
            <DialogDescription>
              Cleanup is now runtime-backed. Exam-linked questions are preserved by detaching them from the import.
            </DialogDescription>
          </DialogHeader>

          {deleteTarget ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-border bg-muted px-4 py-3 text-sm text-foreground/80">
                <p className="font-medium text-foreground">
                  {deleteTarget.sourceName ?? deleteTarget.fileName ?? "Selected import"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {deleteTarget.contentType ?? "batch"} • {deleteTarget.fileType ?? "runtime"} •{" "}
                  {(deleteTarget.itemCount ?? 0).toLocaleString()} items
                </p>
              </div>

              {isLoadingDetails ? (
                <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                  Loading dependency details...
                </div>
              ) : deleteDetails ? (
                <div className="rounded-2xl border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <p>Chunks: {deleteDetails.import.chunkCount}</p>
                    <p>Note docs: {deleteDetails.import.noteDocumentCount}</p>
                    <p>Questions: {deleteDetails.import.questionCount}</p>
                    <p>Flashcards: {deleteDetails.import.flashcardCount}</p>
                    <p>Attempted questions: {deleteDetails.attemptedQuestionCount}</p>
                    <p>Reviewed flashcards: {deleteDetails.reviewedFlashcardCount}</p>
                  </div>
                  {deleteDetails.import.examLinkedQuestionCount > 0 ? (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-warning/30 dark:border-warning/20 bg-card/70 px-3 py-2 text-xs text-warning dark:text-warning">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        {deleteDetails.import.examLinkedQuestionCount} exam-linked questions will be preserved and detached
                        from this import instead of being deleted.
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} loading={isDeleting}>
              Delete import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteOpen} onOpenChange={(open) => !open && setBulkDeleteOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete selected imports</DialogTitle>
            <DialogDescription>
              This removes imported rows and preserves any exam-linked questions automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-border bg-muted px-4 py-3 text-sm text-foreground/80">
            {selectedIds.size.toLocaleString()} selected import rows will be cleaned up.
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkDeleteConfirm} loading={isDeleting}>
              Delete selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
