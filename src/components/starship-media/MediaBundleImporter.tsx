"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileArchive,
  Image as ImageIcon,
  Loader2,
  Upload,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  ImportSummary,
  ImportManifestErrorCode,
} from "@/lib/starship-media/importer";

const MANIFEST_ERROR_LABEL: Record<ImportManifestErrorCode, string> = {
  "missing-manifest": "Bundle is missing manifest.json",
  "manifest-not-json": "manifest.json is not valid JSON",
  "not-an-object": "manifest.json must be a JSON object",
  "missing-chapter-number": "manifest.chapterNumber is missing or not an integer",
  "chapter-mismatch": "manifest.chapterNumber doesn't match the chapter you selected",
  "missing-assets": "manifest.assets field is missing",
  "assets-not-array": "manifest.assets must be an array",
  "empty-assets": "manifest.assets is empty — nothing to import",
  "zip-error": "Bundle could not be unzipped",
};

const REJECT_REASON_LABEL: Record<string, string> = {
  "duplicate-media-id": "duplicate mediaId",
  "invalid-kind": "invalid kind",
  "invalid-filename": "invalid filename",
  "invalid-media-id": "invalid mediaId",
  "missing-required-field": "missing required field",
};

/**
 * Phase 3 — Chapter Media Bundle Importer panel.
 *
 * Standalone UI: chapter number input + ZIP file picker + submit. Sends
 * a multipart POST to `/api/import/media-bundle` and renders the
 * structured `ImportSummary` returned. Intentionally separate from
 * EdgeImportPanel — the Edge/V3 importer is untouched.
 *
 * Validation happens server-side; the UI only does shape checks
 * (chapter is a positive integer, file is selected) before sending.
 */
export function MediaBundleImporter() {
  const [chapterNumber, setChapterNumber] = useState<number | "">(164);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = useMemo(
    () => !submitting && Number.isInteger(chapterNumber) && (chapterNumber as number) > 0 && !!file,
    [chapterNumber, file, submitting],
  );

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.files?.[0] ?? null;
    setFile(next);
    setSummary(null);
    setError(null);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file || !Number.isInteger(chapterNumber)) return;
    setSubmitting(true);
    setError(null);
    setSummary(null);

    try {
      const fd = new FormData();
      fd.append("chapterNumber", String(chapterNumber));
      fd.append("bundle", file);
      const res = await fetch("/api/import/media-bundle", {
        method: "POST",
        body: fd,
      });
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        summary?: ImportSummary;
      } | null;
      if (!body?.summary) {
        setError(`Server returned ${res.status} with no summary.`);
      } else {
        setSummary(body.summary);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network or upload error");
    } finally {
      setSubmitting(false);
    }
  }, [chapterNumber, file]);

  return (
    <section
      data-panel="media-bundle-importer"
      className={cn(
        "rounded-2xl border border-lib-border bg-lib-surface p-6 shadow-sm",
        "max-w-3xl mx-auto",
      )}
    >
      <header className="mb-5 flex items-start gap-3">
        <div
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-300"
        >
          <FileArchive className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-lib-text">
            Chapter Media Importer
          </h1>
          <p className="mt-1 text-sm text-lib-text-muted">
            Upload a prepared <code>manifest.json</code> + image bundle (ZIP) to
            populate the chapter&rsquo;s media registry. Uses the legacy import
            path — Edge / V3 importer is untouched.
          </p>
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
        data-testid="media-bundle-form"
      >
        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-lib-text-muted">
              Chapter number
            </span>
            <input
              type="number"
              min={1}
              step={1}
              value={chapterNumber}
              onChange={(e) => {
                const v = e.target.value;
                setChapterNumber(v === "" ? "" : Number(v));
                setSummary(null);
                setError(null);
              }}
              className={cn(
                "w-full rounded-md border border-lib-border bg-lib-surface px-3 py-2",
                "text-sm tabular-nums text-lib-text",
                "focus:border-lib-accent focus:outline-none focus:ring-2 focus:ring-lib-accent/30",
              )}
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-lib-text-muted">
              Bundle ZIP
            </span>
            <div
              className={cn(
                "flex items-center gap-3 rounded-md border border-dashed border-lib-border",
                "bg-lib-hover/40 px-3 py-2",
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,application/zip"
                onChange={handleFileChange}
                className="block w-full text-sm text-lib-text"
                required
                data-testid="bundle-file"
              />
            </div>
            {file && (
              <span className="mt-1 block text-[11px] text-lib-text-muted">
                {file.name} · {(file.size / 1024).toFixed(1)} KB
              </span>
            )}
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            data-testid="media-bundle-submit"
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium",
              "bg-lib-accent text-white shadow-sm transition-colors",
              "hover:bg-lib-accent/90",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {submitting ? "Importing…" : "Import bundle"}
          </button>
          <span className="text-[11px] text-lib-text-muted">
            Files write to <code>public/media/campbell/&lt;chapter&gt;/</code>.
          </span>
        </div>
      </form>

      {error && (
        <div
          role="alert"
          className={cn(
            "mt-5 flex items-start gap-2 rounded-md border border-rose-500/40",
            "bg-rose-500/[0.07] px-3 py-2 text-sm text-rose-700 dark:text-rose-300",
          )}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {summary && <SummaryCard summary={summary} />}
    </section>
  );
}

function SummaryCard({ summary }: { summary: ImportSummary }) {
  if (summary.manifestError) {
    const code = summary.manifestError.error;
    return (
      <div
        role="alert"
        data-testid="summary-manifest-error"
        className={cn(
          "mt-5 rounded-md border border-rose-500/40 bg-rose-500/[0.06] p-4",
          "text-sm text-rose-800 dark:text-rose-200",
        )}
      >
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          {MANIFEST_ERROR_LABEL[code]}
        </div>
        <p className="mt-1 text-xs leading-relaxed">{summary.manifestError.message}</p>
        {summary.manifestError.manifestChapterNumber !== undefined && (
          <p className="mt-1 text-[11px] opacity-80">
            Manifest reported chapterNumber ={" "}
            <code>{summary.manifestError.manifestChapterNumber}</code>.
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      data-testid="summary-success"
      className={cn(
        "mt-5 rounded-md border border-lib-border bg-lib-hover/30 p-4",
      )}
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-lib-text">
        {summary.ok ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        )}
        {summary.ok ? "Import complete" : "Import finished with issues"}
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12.5px] tabular-nums text-lib-text">
        <Stat label="Received" value={summary.receivedAssets} />
        <Stat
          label="Imported"
          value={summary.imported}
          accent={summary.imported > 0 ? "emerald" : undefined}
        />
        <Stat label="Inserted" value={summary.inserted} />
        <Stat label="Updated" value={summary.updated} />
        <Stat
          label="Skipped"
          value={summary.skipped}
          accent={summary.skipped > 0 ? "amber" : undefined}
        />
        <Stat
          label="Failed"
          value={summary.failed}
          accent={summary.failed > 0 ? "rose" : undefined}
        />
      </dl>

      {summary.importedMediaIds.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[12px] font-semibold text-lib-text-muted">
            Imported mediaIds ({summary.importedMediaIds.length})
          </summary>
          <ul
            className="mt-2 list-disc pl-5 text-[11.5px] text-lib-text"
            data-testid="summary-imported-list"
          >
            {summary.importedMediaIds.map((id) => (
              <li key={id} className="font-mono">
                <ImageIcon className="me-1 inline h-3 w-3" aria-hidden="true" />
                {id}
              </li>
            ))}
          </ul>
        </details>
      )}

      {summary.rejected.length > 0 && (
        <details className="mt-3" open>
          <summary className="cursor-pointer text-[12px] font-semibold text-amber-700 dark:text-amber-300">
            Skipped entries ({summary.rejected.length})
          </summary>
          <ul className="mt-2 space-y-0.5 text-[11.5px]">
            {summary.rejected.map((r, i) => (
              <li
                key={`${r.index}-${i}`}
                className="rounded bg-amber-500/[0.06] px-2 py-1"
              >
                <code className="font-mono">{r.mediaId ?? `(index ${r.index})`}</code>{" "}
                — {REJECT_REASON_LABEL[r.reason] ?? r.reason}
                <span className="block text-[10.5px] opacity-80">{r.detail}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {summary.missingFiles.length > 0 && (
        <details className="mt-3" open>
          <summary className="cursor-pointer text-[12px] font-semibold text-amber-700 dark:text-amber-300">
            Missing files ({summary.missingFiles.length})
          </summary>
          <ul className="mt-2 space-y-0.5 text-[11.5px]">
            {summary.missingFiles.map((m) => (
              <li key={m.mediaId} className="font-mono">
                {m.mediaId} → {m.filename}
              </li>
            ))}
          </ul>
        </details>
      )}

      {summary.writeFailures.length > 0 && (
        <details className="mt-3" open>
          <summary className="cursor-pointer text-[12px] font-semibold text-rose-700 dark:text-rose-300">
            Write failures ({summary.writeFailures.length})
          </summary>
          <ul className="mt-2 space-y-0.5 text-[11.5px]">
            {summary.writeFailures.map((w) => (
              <li key={w.mediaId} className="font-mono">
                {w.mediaId} ({w.filename}) — {w.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "emerald" | "amber" | "rose";
}) {
  return (
    <>
      <dt className="font-semibold uppercase tracking-[0.08em] text-lib-text-muted/85 text-[10.5px]">
        {label}
      </dt>
      <dd
        className={cn(
          "font-mono",
          accent === "emerald" && "text-emerald-700 dark:text-emerald-300",
          accent === "amber" && "text-amber-700 dark:text-amber-300",
          accent === "rose" && "text-rose-700 dark:text-rose-300",
        )}
      >
        {value}
      </dd>
    </>
  );
}
