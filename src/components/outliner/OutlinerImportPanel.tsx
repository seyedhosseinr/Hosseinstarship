"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Upload, Trash2, CheckCircle2, AlertTriangle, FileJson, Archive, RefreshCw } from "lucide-react";
import { importOutlinerFiles, type OutlinerImportResult } from "@/lib/outliner/algorithm-ir-import";
import { deleteOutlinerSegmentsLocal, listOutlinerSegmentsLocal } from "@/lib/local-first/outliner-local";
import type { OutlinerAlgorithmSegmentRow } from "@/lib/local-first/idb";

export function OutlinerImportPanel() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OutlinerImportResult | null>(null);
  const [segments, setSegments] = useState<OutlinerAlgorithmSegmentRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try { setSegments(await listOutlinerSegmentsLocal()); }
    catch (err) { setError(err instanceof Error ? err.message : "خطا در خواندن لیست Outliner"); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function handleFiles(files: FileList | File[]) {
    setBusy(true); setError(null);
    try {
      const next = await importOutlinerFiles(Array.from(files));
      setResult(next);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ایمپورت انجام نشد.");
    } finally { setBusy(false); }
  }

  async function deleteSelected(ids: string[]) {
    if (ids.length === 0) return;
    setBusy(true);
    try {
      await deleteOutlinerSegmentsLocal(ids);
      setSelected(new Set());
      await refresh();
    } finally { setBusy(false); }
  }

  const chapters = new Set(segments.map((item) => item.chapterNo ?? "?")).size;

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 p-4 text-slate-950 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-teal-700">Outliner - الگوریتم‌های تصویری</p>
              <h1 className="mt-2 text-2xl font-black">ایمپورت Algorithm IR</h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">ایمپورت فایل‌های Algorithm IR برای نمایش الگوریتم‌های Outliner. فرمت‌های قابل قبول: JSON و ZIP. مدیا فعلاً پشتیبانی نمی‌شود و اجباری نیست.</p>
            </div>
            <Link href="/outliner" className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">باز کردن Outliner</Link>
          </div>
        </header>

        <label
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); void handleFiles(event.dataTransfer.files); }}
          className="flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-teal-300 bg-white p-8 text-center shadow-sm transition hover:border-teal-500 hover:bg-teal-50/40"
        >
          <input type="file" accept=".json,.zip" multiple className="hidden" onChange={(event) => event.target.files && void handleFiles(event.target.files)} />
          <Upload className="h-10 w-10 text-teal-700" />
          <div className="mt-4 text-lg font-black">فایل‌های JSON یا ZIP را اینجا رها کنید</div>
          <div className="mt-2 flex gap-2 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><FileJson className="h-3 w-3" /> JSON</span><span className="inline-flex items-center gap-1"><Archive className="h-3 w-3" /> ZIP</span></div>
          {busy && <div className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-teal-700"><RefreshCw className="h-4 w-4 animate-spin" /> در حال ایمپورت...</div>}
        </label>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {result && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">ایمپورت Algorithm IR با موفقیت انجام شد.</h2>
            <div className="mt-3 grid gap-3 text-sm md:grid-cols-5">
              <Metric label="فایل اسکن شده" value={result.totalFilesScanned} />
              <Metric label="JSON معتبر" value={result.validJsonFound} />
              <Metric label="ایمپورت شده" value={result.imported} />
              <Metric label="رد شده" value={result.skipped} />
              <Metric label="چپترها" value={chapters} />
            </div>
            {[...result.warnings, ...(result.duplicates.length ? [`segmentId تکراری: ${result.duplicates.join(", ")}`] : [])].map((warning) => <p key={warning} className="mt-3 text-sm text-amber-700"><AlertTriangle className="ml-1 inline h-4 w-4" />{warning}</p>)}
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3 text-right">segmentId</th><th className="p-3 text-right">عنوان</th><th className="p-3">status</th><th className="p-3">surfaces</th><th className="p-3">coverage</th><th className="p-3 text-right">warnings/errors</th></tr></thead>
                <tbody>{result.rows.map((row) => <tr key={`${row.sourceFileName}-${row.segmentId}`} className="border-t border-slate-100"><td className="p-3 ltr text-left">{row.segmentId}</td><td className="p-3">{row.title ?? "Clinical algorithm"}</td><td className="p-3 text-center">{row.status}</td><td className="p-3 text-center">{row.surfaces}</td><td className="p-3 text-center">{row.coverage}</td><td className="p-3 text-xs text-slate-600">{[...row.warnings, ...row.errors].join("؛ ")}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-black">فایل‌های ایمپورت‌شده</h2>
            <div className="flex gap-2"><button className="rounded-xl border px-3 py-2 text-xs font-bold" onClick={() => setSelected(new Set(segments.map((item) => item.segmentId)))}>انتخاب همه</button><button className="rounded-xl border px-3 py-2 text-xs font-bold" onClick={() => void deleteSelected(Array.from(selected))}>حذف انتخاب‌شده</button><button className="rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700" onClick={() => void deleteSelected(segments.map((item) => item.segmentId))}>حذف همه</button></div>
          </div>
          <p className="mt-2 text-sm text-slate-500">{segments.length} سگمنت از {chapters} چپتر ایمپورت شده است.</p>
          <div className="mt-4 grid gap-2">
            {segments.map((item) => <label key={item.segmentId} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3"><span><input className="ml-2" type="checkbox" checked={selected.has(item.segmentId)} onChange={() => setSelected((prev) => { const next = new Set(prev); next.has(item.segmentId) ? next.delete(item.segmentId) : next.add(item.segmentId); return next; })} /><span className="font-bold">{item.title ?? item.segmentId}</span><span className="mr-2 text-xs text-slate-500">Chapter {item.chapterNo ?? "?"}</span></span><span className="flex items-center gap-2 text-xs text-slate-500"><CheckCircle2 className="h-4 w-4 text-teal-600" />{item.surfaceCount} surfaces<button type="button" onClick={(event) => { event.preventDefault(); void deleteSelected([item.segmentId]); }} className="rounded-lg p-2 text-red-600"><Trash2 className="h-4 w-4" /></button></span></label>)}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-slate-50 p-3 text-center"><div className="text-2xl font-black text-teal-700">{value}</div><div className="text-xs text-slate-500">{label}</div></div>;
}
