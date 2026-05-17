"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Upload,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Archive,
  RefreshCw,
  Image as ImageIcon,
  Table as TableIcon,
  FileImage,
} from "lucide-react";
import type { ImportSummary } from "@/lib/starship-media/importer";
import type { MediaAsset } from "@/lib/starship-media/types";

export function MediaBundleImporter() {
  const [chapterNumber, setChapterNumber] = useState<number | "">(164);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/import/media-bundle");
      const data = (await res.json()) as { ok: boolean; assets?: MediaAsset[] };
      if (data.ok && data.assets) setAssets(data.assets);
    } catch {
      // DB not ready — leave list empty
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function handleFile(file: File) {
    if (!Number.isInteger(chapterNumber) || (chapterNumber as number) <= 0) {
      setError("لطفاً شماره فصل معتبر وارد کنید.");
      return;
    }
    setBusy(true);
    setError(null);
    setSummary(null);
    try {
      const fd = new FormData();
      fd.append("chapterNumber", String(chapterNumber));
      fd.append("bundle", file);
      const res = await fetch("/api/import/media-bundle", { method: "POST", body: fd });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; summary?: ImportSummary } | null;
      if (!body?.summary) {
        setError(`خطای سرور: ${res.status}`);
      } else {
        setSummary(body.summary);
        await refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای شبکه یا آپلود");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelected(mediaIds: string[]) {
    if (mediaIds.length === 0) return;
    setBusy(true);
    try {
      await fetch("/api/import/media-bundle", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mediaIds }),
      });
      setSelected(new Set());
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const chapters = new Set(assets.map((a) => a.chapterNumber)).size;
  const highYield = assets.filter((a) => a.highYield).length;
  const figures = assets.filter((a) => a.kind === "figure").length;

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 p-4 text-slate-950 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">

        {/* Header */}
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-sky-700">Starship Media — مدیا رجیستری</p>
              <h1 className="mt-2 text-2xl font-black">ایمپورت باندل مدیا</h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
                آپلود فایل ZIP حاوی <code>manifest.json</code> و تصاویر برای پر کردن رجیستری مدیای فصل.
                ایمپورتر Edge/V3 دست‌نخورده باقی می‌ماند.
              </p>
            </div>
            <Link href="/import" className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">
              بازگشت به ایمپورت
            </Link>
          </div>
        </header>

        {/* Chapter number input */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="block">
            <span className="mb-2 block text-sm font-bold">شماره فصل (Chapter Number)</span>
            <input
              type="number"
              min={1}
              step={1}
              value={chapterNumber}
              onChange={(e) => setChapterNumber(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-40 rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-sky-400 focus:outline-none"
            />
          </label>
        </div>

        {/* Drop zone */}
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) void handleFile(f);
          }}
          className="flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-sky-300 bg-white p-8 text-center shadow-sm transition hover:border-sky-500 hover:bg-sky-50/40"
        >
          <input
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <Upload className="h-10 w-10 text-sky-700" />
          <div className="mt-4 text-lg font-black">فایل ZIP را اینجا رها کنید</div>
          <div className="mt-2 flex gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1"><Archive className="h-3 w-3" /> ZIP Bundle</span>
          </div>
          {busy && (
            <div className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-sky-700">
              <RefreshCw className="h-4 w-4 animate-spin" /> در حال پردازش...
            </div>
          )}
        </label>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertTriangle className="ml-1 inline h-4 w-4" />{error}
          </div>
        )}

        {/* Import result */}
        {summary && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            {summary.manifestError ? (
              <>
                <h2 className="text-lg font-black text-red-700">خطا در manifest</h2>
                <p className="mt-2 text-sm text-red-600">{summary.manifestError.message}</p>
              </>
            ) : (
              <>
                <h2 className="text-lg font-black">
                  {summary.ok ? "ایمپورت با موفقیت انجام شد." : "ایمپورت با مشکل انجام شد."}
                </h2>
                <div className="mt-3 grid gap-3 text-sm md:grid-cols-6">
                  <Metric label="دریافت‌شده" value={summary.receivedAssets} />
                  <Metric label="ایمپورت‌شده" value={summary.imported} />
                  <Metric label="درج جدید" value={summary.inserted} />
                  <Metric label="بروزرسانی" value={summary.updated} />
                  <Metric label="رد شده" value={summary.skipped} />
                  <Metric label="خطا" value={summary.failed} />
                </div>
              </>
            )}
          </section>
        )}

        {/* Assets list */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-black">فایل‌های ایمپورت‌شده</h2>
            <div className="flex gap-2">
              <button
                className="rounded-xl border px-3 py-2 text-xs font-bold"
                onClick={() => setSelected(new Set(assets.map((a) => a.mediaId)))}
              >
                انتخاب همه
              </button>
              <button
                className="rounded-xl border px-3 py-2 text-xs font-bold"
                onClick={() => void deleteSelected(Array.from(selected))}
              >
                حذف انتخاب‌شده
              </button>
              <button
                className="rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700"
                onClick={() => void deleteSelected(assets.map((a) => a.mediaId))}
              >
                حذف همه
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-3 grid gap-3 text-sm md:grid-cols-4">
            <Metric label="کل مدیا" value={assets.length} />
            <Metric label="فصل‌ها" value={chapters} />
            <Metric label="تصویر" value={figures} />
            <Metric label="High-Yield" value={highYield} />
          </div>

          <div className="mt-4 grid gap-2">
            {assets.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-10 text-slate-400">
                <FileImage className="h-10 w-10 opacity-40" />
                <p className="text-sm">هنوز هیچ مدیایی ایمپورت نشده است.</p>
              </div>
            )}
            {assets.map((item) => (
              <label
                key={item.mediaId}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3"
              >
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(item.mediaId)}
                    onChange={() =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        next.has(item.mediaId) ? next.delete(item.mediaId) : next.add(item.mediaId);
                        return next;
                      })
                    }
                  />
                  <span className="font-bold ltr text-sm">{item.mediaId}</span>
                  <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    فصل {item.chapterNumber}
                  </span>
                  {item.figureLabel && (
                    <span className="text-xs text-slate-400">{item.figureLabel}</span>
                  )}
                </span>
                <span className="flex items-center gap-2 text-xs text-slate-500">
                  {item.kind === "figure" ? (
                    <ImageIcon className="h-4 w-4 text-sky-600" />
                  ) : (
                    <TableIcon className="h-4 w-4 text-purple-600" />
                  )}
                  <span>{item.kind}</span>
                  {item.highYield && <CheckCircle2 className="h-4 w-4 text-teal-600" />}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); void deleteSelected([item.mediaId]); }}
                    className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              </label>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 text-center">
      <div className="text-2xl font-black text-sky-700">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
