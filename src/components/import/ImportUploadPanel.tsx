"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileJson,
  FolderSymlink,
  Loader2,
  Lock,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";

import { uploadImportFile, type UploadImportResult } from "@/app/import/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ImportActionState } from "@/lib/import-light/types";
import { cn } from "@/lib/utils";
import { isLocalFirstEnabled } from "@/lib/local-first/flag";
import { importFileOffline } from "@/lib/local-first/import-offline";

type ImportUploadPanelProps = {
  state: ImportActionState;
  formAction: (formData: FormData) => void;
  onImportMutation?: () => void;
};

type TabKey = "batch" | "upload" | "generate";
type ContentType = "notes" | "questions" | "flashcards" | "yield";

const TABS: Array<{
  key: TabKey;
  label: string;
  icon: typeof FolderSymlink;
  helper: string;
}> = [
  {
    key: "batch",
    label: "Batch directory",
    icon: FolderSymlink,
    helper: "Backfill + manifest import",
  },
  {
    key: "upload",
    label: "Structured upload",
    icon: Upload,
    helper: "Notes + MCQs + flashcards + yield",
  },
  {
    key: "generate",
    label: "Generation",
    icon: Wand2,
    helper: "Still gated",
  },
];

const CONTENT_TYPES: Array<{
  key: ContentType;
  label: string;
  helper: string;
  accept: string;
}> = [
  {
    key: "notes",
    label: "Notes",
    helper: "JSON or HTML",
    accept: ".json,.html,.htm",
  },
  {
    key: "questions",
    label: "MCQs",
    helper: "JSON or CSV",
    accept: ".json,.csv",
  },
  {
    key: "flashcards",
    label: "Flashcards",
    helper: "JSON or CSV",
    accept: ".json,.csv",
  },
  {
    key: "yield",
    label: "Yield cards",
    helper: "JSON",
    accept: ".json",
  },
];

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="min-w-40" loading={pending}>
      {pending ? "Running import..." : "Run batch import"}
    </Button>
  );
}

function ResultTile({
  label,
  inserted,
  updated,
}: {
  label: string;
  inserted: number;
  updated: number;
}) {
  return (
    <div className="rounded-2xl border border-success/20 dark:border-success/15 bg-card/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-success dark:text-success">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground dark:text-foreground">{inserted + updated}</p>
      <p className="mt-1 text-xs text-success dark:text-success">
        {inserted} inserted, {updated} updated
      </p>
    </div>
  );
}

function GatedPanel({
  icon: Icon,
  title,
  description,
  bullets,
}: {
  icon: typeof Upload;
  title: string;
  description: string;
  bullets: string[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <Card variant="glass" className="border-border/40 bg-card/70">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-warning/20 bg-warning/10 text-warning">
              <Icon className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                <Badge variant="warning">Gated</Badge>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{description}</p>
              <Button type="button" variant="outline" disabled className="mt-2">
                Unavailable on shared runtime
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card variant="glass" className="border-border/40 bg-card/65">
        <CardContent className="p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">What stays visible</p>
          <div className="mt-4 space-y-3">
            {bullets.map((bullet) => (
              <div
                key={bullet}
                className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/75 px-4 py-3 text-sm text-muted-foreground"
              >
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{bullet}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ImportUploadPanel({ state, formAction, onImportMutation }: ImportUploadPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("batch");
  const [batchDirectory, setBatchDirectory] = useState(state.batchDirectory);

  useEffect(() => {
    setBatchDirectory(state.batchDirectory);
  }, [state.batchDirectory]);

  const supportedTargets = useMemo(
    () => [
      "Chunks",
      "Note documents / sections / frames",
      "Questions and options",
      "Flashcards",
      "Import history",
    ],
    [],
  );

  return (
    <div className="space-y-5">
      <div className="rounded-[2rem] border border-border/40 bg-card/70 p-5 shadow-[0_18px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  active ? "" : "opacity-80 hover:opacity-100",
                )}
                style={{
                  color: active ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                  background: active ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.55)",
                  borderColor: active ? "hsl(var(--primary) / 0.35)" : "hsl(var(--border) / 0.95)",
                  boxShadow: active ? "0 10px 24px hsl(var(--primary) / 0.08)" : "none",
                }}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                <span className="text-[11px] text-muted-foreground">{tab.helper}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "batch" ? (
        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <Card variant="glass" className="border-border/40 bg-card/70 shadow-[0_18px_70px_rgba(15,23,42,0.08)]">
            <CardContent className="p-6">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-info/20 bg-info/10 text-info">
                  <FolderSymlink className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-foreground">Batch backfill</h3>
                    <Badge variant="success">Supported</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Directory ingest remains the fastest path for full-library backfill on the shared runtime.
                  </p>
                </div>
              </div>

              <form action={formAction} className="mt-6 space-y-5">
                <div className="space-y-2">
                  <label htmlFor="batchDirectory" className="text-sm font-medium text-foreground">
                    Workspace-relative batch directory
                  </label>
                  <Input
                    id="batchDirectory"
                    name="batchDirectory"
                    value={batchDirectory}
                    onChange={(event) => setBatchDirectory(event.target.value)}
                    placeholder="data/test-batch"
                    autoComplete="off"
                    className="border-border bg-card/90"
                  />
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Quick fill:</span>
                    <button
                      type="button"
                      onClick={() => setBatchDirectory("data/test-batch")}
                      className="rounded-full border border-border bg-card px-3 py-1 font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
                    >
                      data/test-batch
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      <Database className="h-3.5 w-3.5" />
                      Runtime
                    </div>
                    <p className="mt-2 text-lg font-semibold text-foreground">{state.runtime}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Shared Drizzle + pg-core path using async <code>await getDb()</code>
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      <FileJson className="h-3.5 w-3.5" />
                      Required artifacts
                    </div>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      <code>manifest.json</code>, <code>chunks.json</code>, <code>questions.json</code>,{" "}
                      <code>flashcards.json</code>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Backfill keeps the rich note/question/flashcard write path.</p>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-border/60 bg-muted/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Supported write targets</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {supportedTargets.map((target) => (
                      <span
                        key={target}
                        className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground/80"
                      >
                        {target}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <SubmitButton />
                  <div className="inline-flex items-center gap-2 rounded-full border border-info/20 bg-info/10 px-3 py-1 text-xs text-info">
                    <Sparkles className="h-3.5 w-3.5" />
                    Truthful history only, no fake dry-run rows
                  </div>
                </div>
              </form>

              {state.error ? (
                <div className="mt-5 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {state.error}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="space-y-5">
            {state.result ? (
              <Card variant="glass" className="border-success/20 dark:border-success/15 bg-success/10 dark:bg-success/5 shadow-[0_18px_70px_rgba(15,23,42,0.06)]">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-success/20 dark:border-success/15 bg-card text-success dark:text-success">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-success dark:text-success">
                        Latest successful run
                      </p>
                      <p className="text-lg font-semibold text-foreground dark:text-foreground">{state.message}</p>
                      <p className="text-sm text-success dark:text-success">
                        {state.result.sourceName} from <code>{state.result.batchDirectory}</code>
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <ResultTile
                      label="Chunks"
                      inserted={state.result.counts.chunks.inserted}
                      updated={state.result.counts.chunks.updated}
                    />
                    <ResultTile
                      label="Note docs"
                      inserted={state.result.counts.noteDocuments.inserted}
                      updated={state.result.counts.noteDocuments.updated}
                    />
                    <ResultTile
                      label="Questions"
                      inserted={state.result.counts.questions.inserted}
                      updated={state.result.counts.questions.updated}
                    />
                    <ResultTile
                      label="Flashcards"
                      inserted={state.result.counts.flashcards.inserted}
                      updated={state.result.counts.flashcards.updated}
                    />
                  </div>

                  <div className="mt-4 rounded-2xl border border-success/20 dark:border-success/15 bg-card/80 px-4 py-3 text-sm text-foreground dark:text-foreground">
                    Import id: <code>{state.result.importId}</code>
                    <span className="mx-2 text-success/30 dark:text-success/20">|</span>
                    Total items: {state.result.totalItems}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card variant="glass" className="border-border/40 bg-card/68 shadow-[0_18px_70px_rgba(15,23,42,0.06)]">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-muted text-muted-foreground">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Ready to run</p>
                      <p className="text-lg font-semibold text-foreground">Runtime-backed import workspace</p>
                      <p className="text-sm text-muted-foreground">
                        Batch import and structured upload now land in the same real note/question/flashcard tables.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card variant="glass" className="border-border/40 bg-card/68">
              <CardContent className="p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Capability boundaries</p>
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-border/60 bg-card/80 px-4 py-3 text-sm text-muted-foreground">
                    Batch directory import is live on both <code>DB_RUNTIME=postgres</code> and <code>DB_RUNTIME=pglite</code>.
                  </div>
                  <div className="rounded-2xl border border-info/20 bg-info/10 px-4 py-3 text-sm text-info">
                    Structured upload now supports note JSON/HTML, MCQ JSON/CSV, flashcard JSON/CSV, and yield card JSON.
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : activeTab === "upload" ? (
        <UploadPanel onImportMutation={onImportMutation} />
      ) : (
        <GatedPanel
          icon={Wand2}
          title="Content generation controls"
          description="Generation and broader orchestration are still intentionally out of scope for this runtime slice."
          bullets={[
            "No old generation pipeline was reactivated.",
            "No Prisma, SQLite, or client-db runtime path was restored.",
            "The supported import paths now write through the shared runtime only.",
          ]}
        />
      )}
    </div>
  );
}

function UploadPanel({ onImportMutation }: { onImportMutation?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [contentType, setContentType] = useState<ContentType>("notes");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [result, setResult] = useState<UploadImportResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeContentConfig = CONTENT_TYPES.find((item) => item.key === contentType)!;

  const handleSubmit = () => {
    if (selectedFiles.length === 0) return;

    startTransition(async () => {
      // Local-first path: store files in OPFS + Dexie manifest
      if (isLocalFirstEnabled()) {
        let successCount = 0;
        let failCount = 0;
        let totalInserted = 0;
        const fileResults: UploadImportResult["fileResults"] = [];
        for (const file of selectedFiles) {
          try {
            const offlineResult = await importFileOffline({ file, displayName: file.name });
            successCount++;
            totalInserted += offlineResult.deduped ? 0 : 1;
            fileResults.push({
              fileName: file.name,
              ok: true,
              message: offlineResult.deduped ? "Deduped (already imported)" : "Queued for sync",
              format: null,
              inserted: offlineResult.deduped ? 0 : 1,
              errors: [],
            });
          } catch (err) {
            failCount++;
            fileResults.push({
              fileName: file.name,
              ok: false,
              message: err instanceof Error ? err.message : "Offline import failed",
              format: null,
              inserted: 0,
              errors: [String(err)],
            });
          }
        }
        setResult({
          ok: successCount > 0,
          message: `${successCount} file(s) stored offline`,
          inserted: totalInserted,
          errors: [],
          fileResults,
          successfulFiles: successCount,
          failedFiles: failCount,
        });
        if (successCount > 0) onImportMutation?.();
        return;
      }

      // Standard server path
      const formData = new FormData();
      for (const file of selectedFiles) {
        formData.append("files", file);
      }
      formData.append("contentType", contentType);

      const response = await uploadImportFile(formData);
      setResult(response);
      if (response.successfulFiles > 0) {
        onImportMutation?.();
      }
    });
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <Card variant="glass" className="border-border/40 bg-card/70 shadow-[0_18px_70px_rgba(15,23,42,0.08)]">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-info/20 bg-info/10 text-info">
              <Upload className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-foreground">Structured browser upload</h3>
                <Badge variant="success">Active</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Restore richer import workflows directly from the browser without dropping back to JSON-only mode.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Artifact type</label>
              <div className="grid gap-2 md:grid-cols-3">
                {CONTENT_TYPES.map((type) => (
                  <button
                    key={type.key}
                    type="button"
                    onClick={() => {
                      setContentType(type.key);
                      setSelectedFiles([]);
                      setResult(null);
                      if (fileRef.current) {
                        fileRef.current.value = "";
                      }
                    }}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-left text-sm transition-colors",
                      contentType === type.key
                        ? "border-info/30 bg-info/10 text-info"
                        : "border-border bg-card text-muted-foreground hover:border-border",
                    )}
                  >
                    <p className="font-semibold">{type.label}</p>
                    <p className="mt-1 text-xs opacity-75">{type.helper}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Source files</label>
              <div
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-2xl border-2 border-dashed p-4 transition-colors",
                  selectedFiles.length > 0
                    ? "border-info/30 bg-info/5"
                    : "border-border bg-card/80 hover:border-border",
                )}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept={activeContentConfig.accept}
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    setSelectedFiles(Array.from(event.target.files ?? []));
                    setResult(null);
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  Choose files
                </Button>
                <span className="text-sm text-muted-foreground">
                  {selectedFiles.length > 0
                    ? `${selectedFiles.length} file(s) selected`
                    : `Accepted: ${activeContentConfig.accept}`}
                </span>
                {selectedFiles.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedFiles([]);
                      setResult(null);
                      if (fileRef.current) {
                        fileRef.current.value = "";
                      }
                    }}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
              {selectedFiles.length > 0 ? (
                <div className="space-y-2 rounded-[1.5rem] border border-border/60 bg-card/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Upload queue</p>
                  <div className="space-y-2">
                    {selectedFiles.map((file) => (
                      <div
                        key={`${file.name}-${file.size}-${file.lastModified}`}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/70 px-4 py-3 text-sm text-foreground/80"
                      >
                        <span className="truncate font-medium text-foreground">{file.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-[1.5rem] border border-border/60 bg-muted/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Supported formats</p>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                {contentType === "notes" ? (
                  <>
                    <p><code>.json</code>: array/object note payloads with title/body/html/sections.</p>
                    <p><code>.html</code>: note HTML, including raw semantic fragments such as <code>&lt;section&gt;...</code>.</p>
                  </>
                ) : contentType === "questions" ? (
                  <>
                    <p><code>.json</code>: MCQ payloads wrapped as <code>{`{ "questions": [...] }`}</code>.</p>
                    <p><code>.csv</code>: headers such as <code>text</code>, <code>optionA</code>...<code>optionD</code>, <code>answer</code>.</p>
                  </>
                ) : (
                  <>
                    <p><code>.json</code>: flashcard arrays with <code>front</code> and <code>back</code>.</p>
                    <p><code>.csv</code>: headers such as <code>front</code>, <code>back</code>, <code>deck</code>, <code>tags</code>.</p>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={handleSubmit} disabled={selectedFiles.length === 0 || isPending} className="min-w-40">
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing...
                  </span>
                ) : (
                  "Upload and import"
                )}
              </Button>
            </div>
          </div>

          {result && !result.ok ? (
            <div className="mt-5 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
              {result.message}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-5">
        {result ? (
          <Card
            variant="glass"
            className={cn(
              "shadow-[0_18px_70px_rgba(15,23,42,0.06)]",
              result.ok ? "border-success/20 dark:border-success/15 bg-success/10 dark:bg-success/5" : "border-danger/20 bg-danger/10",
            )}
          >
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-2xl border bg-card",
                    result.ok ? "border-success/20 dark:border-success/15 text-success dark:text-success" : "border-danger/20 text-danger",
                  )}
                >
                  {result.ok ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                </div>
                <div className="space-y-1">
                  <p className={cn("text-xs font-semibold uppercase tracking-[0.22em]", result.ok ? "text-success dark:text-success" : "text-danger")}>
                    Upload result
                  </p>
                  <p className={cn("text-lg font-semibold", result.ok ? "text-foreground dark:text-foreground" : "text-danger")}>
                    {result.message}
                  </p>
                  <p className={cn("text-sm", result.ok ? "text-success dark:text-success" : "text-danger")}>
                    {result.inserted} rows were written into the runtime-backed tables across {result.successfulFiles} successful file(s).
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {result.fileResults.map((fileResult) => (
                  <div
                    key={`${fileResult.fileName}-${fileResult.message}`}
                    className={cn(
                      "rounded-2xl border px-4 py-3",
                      fileResult.ok
                        ? "border-success/20 dark:border-success/15 bg-card/80"
                        : "border-danger/20 bg-danger/10",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">{fileResult.fileName}</p>
                        <p className={cn("text-xs", fileResult.ok ? "text-success dark:text-success" : "text-danger")}>
                          {fileResult.message}
                        </p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>{fileResult.format ? fileResult.format.toUpperCase() : "Unknown"}</p>
                        <p>{fileResult.inserted} inserted</p>
                      </div>
                    </div>
                    {fileResult.errors.length > 0 ? (
                      <div className="mt-3 space-y-1">
                        {fileResult.errors.slice(0, 5).map((error) => (
                          <p key={`${fileResult.fileName}-${error}`} className="text-xs text-warning">
                            {error}
                          </p>
                        ))}
                        {fileResult.errors.length > 5 ? (
                          <p className="text-xs text-warning">
                            {fileResult.errors.length - 5} more warning(s) were omitted.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card variant="glass" className="border-border/40 bg-card/68 shadow-[0_18px_70px_rgba(15,23,42,0.06)]">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-muted text-muted-foreground">
                  <FileJson className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Formats now accepted</p>
                  <p className="text-lg font-semibold text-foreground">Richer upload workflows restored</p>
                  <p className="text-sm text-muted-foreground">
                    Notes can come from JSON or HTML, and MCQs / flashcards can come from JSON or CSV.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card variant="glass" className="border-border/40 bg-card/68">
          <CardContent className="p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Current scope</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-border/60 bg-card/80 px-4 py-3 text-sm text-muted-foreground">
                Notes write through the primary chunk + note document tables, not a fallback JSON stash.
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/80 px-4 py-3 text-sm text-muted-foreground">
                MCQs and flashcards write through the shared runtime schema and appear in import history immediately.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
