"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Upload,
  FileJson,
  Trash2,
  FolderUp,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ClipboardList,
  StickyNote,
  HelpCircle,
  Sparkles,
  Database,
  FileWarning,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { importApi } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────

type TabType = "flashcards" | "notes" | "questions";

interface StagedFile {
  id: string;
  file: File;
  sizeLabel: string;
  itemCount: number | null; // parsed item count preview
}

interface ImportStatus {
  state: "idle" | "parsing" | "uploading" | "success" | "error";
  message?: string;
  detail?: string;
}

interface ImportStats {
  total: number;
  imported: number;
  skipped: number;
  errors: number;
}

// ─── Constants ───────────────────────────────────────────────

const TABS: {
  key: TabType;
  label: string;
  fa: string;
  icon: React.ElementType;
  gradient: string;
  glow: string;
}[] = [
  {
    key: "flashcards",
    label: "Flashcards",
    fa: "فلش‌کارت",
    icon: ClipboardList,
    gradient: "from-violet-500 to-purple-600",
    glow: "shadow-violet-500/20",
  },
  {
    key: "notes",
    label: "Notes",
    fa: "جزوه‌ها",
    icon: StickyNote,
    gradient: "from-sky-500 to-cyan-600",
    glow: "shadow-sky-500/20",
  },
  {
    key: "questions",
    label: "Questions",
    fa: "بانک سوالات",
    icon: HelpCircle,
    gradient: "from-emerald-500 to-teal-600",
    glow: "shadow-emerald-500/20",
  },
];

// ─── Helpers ─────────────────────────────────────────────────

function fmtBytes(b: number) {
  if (b === 0) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / 1024 ** i).toFixed(1)} ${u[i]}`;
}

async function readJsonArray(
  file: File,
  type: TabType
): Promise<any[]> {
  const buf = await file.arrayBuffer();
  const text = new TextDecoder("utf-8").decode(buf);
  const parsed = JSON.parse(text);

  if (Array.isArray(parsed)) return parsed;

  // Try common wrapper keys
  const keys: Record<TabType, string[]> = {
    flashcards: ["flashcards", "data", "cards", "items"],
    notes: ["notebooks", "notes", "data", "items"],
    questions: ["questions", "data", "items", "quiz"],
  };

  for (const k of keys[type]) {
    if (Array.isArray((parsed as any)[k])) return (parsed as any)[k];
  }

  // Single object → wrap
  if (typeof parsed === "object" && parsed !== null) return [parsed];

  throw new Error("Unrecognized JSON structure");
}

async function peekItemCount(
  file: File,
  type: TabType
): Promise<number> {
  try {
    const arr = await readJsonArray(file, type);
    return arr.length;
  } catch {
    return -1;
  }
}

// ─── Sub-components ──────────────────────────────────────────

function TabButton({
  tab,
  active,
  count,
  onClick,
}: {
  tab: (typeof TABS)[number];
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  const Icon = tab.icon;
  return (
    <button
      onClick={onClick}
      className={[
        "relative flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold",
        "border transition-all duration-300 select-none",
        active
          ? `bg-gradient-to-r ${tab.gradient} text-white border-transparent shadow-lg ${tab.glow}`
          : "bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white/80 hover:bg-white/[0.07] hover:border-white/[0.12]",
      ].join(" ")}
    >
      <Icon className="h-4 w-4" />
      <span>{tab.label}</span>
      <span className="text-[11px] opacity-70 font-normal hidden sm:inline">
        {tab.fa}
      </span>
      {count > 0 && (
        <span
          className={[
            "absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1.5",
            "rounded-full text-[10px] font-bold flex items-center justify-center",
            "ring-2 ring-[#0a0c14]",
            active
              ? "bg-white text-gray-900"
              : "bg-white/20 text-white",
          ].join(" ")}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function DropZone({
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
  tab,
}: {
  isDragging: boolean;
  onDragOver: React.DragEventHandler;
  onDragLeave: React.DragEventHandler;
  onDrop: React.DragEventHandler;
  onClick: () => void;
  tab: (typeof TABS)[number];
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={[
        "relative group cursor-pointer select-none",
        "rounded-2xl border-2 border-dashed transition-all duration-300 overflow-hidden",
        "px-6 py-14 flex flex-col items-center justify-center gap-5",
        isDragging
          ? "border-white/50 bg-white/[0.06] scale-[1.005]"
          : "border-white/[0.12] hover:border-white/[0.22] hover:bg-white/[0.03]",
      ].join(" ")}
    >
      {/* Gradient backdrop on drag */}
      <div
        className={[
          "absolute inset-0 rounded-2xl transition-opacity duration-300",
          `bg-gradient-to-br ${tab.gradient}`,
          isDragging ? "opacity-[0.06]" : "opacity-0",
        ].join(" ")}
      />

      {/* Icon */}
      <div
        className={[
          "relative z-10 h-16 w-16 rounded-2xl flex items-center justify-center",
          "transition-all duration-300",
          isDragging
            ? `bg-gradient-to-br ${tab.gradient} shadow-xl ${tab.glow} scale-110`
            : "bg-white/[0.06] group-hover:bg-white/[0.09]",
        ].join(" ")}
      >
        <Upload
          className={[
            "h-7 w-7 transition-colors duration-200",
            isDragging ? "text-white" : "text-white/40",
          ].join(" ")}
        />
      </div>

      {/* Text */}
      <div className="relative z-10 text-center space-y-1.5">
        <p className="font-semibold text-white/85">
          {isDragging ? "رها کنید..." : "فایل‌های JSON را بکشید و رها کنید"}
        </p>
        <p className="text-xs text-white/35">
          یا کلیک کنید برای انتخاب • تب فعال:{" "}
          <span className="text-white/55 font-medium">{tab.fa}</span>
        </p>
      </div>

      {/* CTA pill */}
      <div
        className={[
          "relative z-10 px-5 py-2 rounded-full text-xs font-semibold border transition-all duration-200",
          isDragging
            ? "bg-white text-gray-900 border-transparent shadow-lg"
            : "bg-white/[0.06] text-white/60 border-white/[0.08] group-hover:bg-white/[0.1] group-hover:text-white/75",
        ].join(" ")}
      >
        انتخاب فایل
      </div>
    </div>
  );
}

function FileRow({
  sf,
  onRemove,
  disabled,
  tabGradient,
}: {
  sf: StagedFile;
  onRemove: () => void;
  disabled: boolean;
  tabGradient: string;
}) {
  return (
    <div
      className={[
        "group flex items-center gap-4 px-4 py-3",
        "rounded-xl border border-white/[0.06] bg-white/[0.03]",
        "hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-200",
      ].join(" ")}
    >
      {/* File icon */}
      <div
        className={[
          "h-10 w-10 shrink-0 rounded-xl flex items-center justify-center",
          `bg-gradient-to-br ${tabGradient} bg-opacity-15`,
        ].join(" ")}
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        <FileJson className="h-5 w-5 text-sky-400" />
      </div>

      {/* Meta */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white/85">
          {sf.file.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-white/30">{sf.sizeLabel}</span>
          {sf.itemCount !== null && sf.itemCount >= 0 && (
            <>
              <span className="text-white/15">•</span>
              <span className="text-[11px] text-white/40">
                {sf.itemCount} آیتم
              </span>
            </>
          )}
          {sf.itemCount === -1 && (
            <>
              <span className="text-white/15">•</span>
              <span className="text-[11px] text-red-400/70">
                خطا در خواندن
              </span>
            </>
          )}
        </div>
      </div>

      {/* Remove */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        disabled={disabled}
        title="حذف فایل"
        className={[
          "shrink-0 h-8 w-8 rounded-lg flex items-center justify-center",
          "transition-all duration-200",
          "text-white/15 hover:text-red-400 hover:bg-red-500/10",
          "disabled:opacity-20 disabled:cursor-not-allowed",
          "sm:opacity-0 sm:group-hover:opacity-100",
        ].join(" ")}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function StatusBanner({ status }: { status: ImportStatus }) {
  if (status.state === "idle") return null;

  const config = {
    parsing: {
      icon: Loader2,
      wrap: "text-sky-400 bg-sky-500/[0.07] border-sky-500/[0.15]",
      spin: true,
    },
    uploading: {
      icon: Database,
      wrap: "text-violet-400 bg-violet-500/[0.07] border-violet-500/[0.15]",
      spin: true,
    },
    success: {
      icon: CheckCircle2,
      wrap: "text-emerald-400 bg-emerald-500/[0.07] border-emerald-500/[0.15]",
      spin: false,
    },
    error: {
      icon: AlertCircle,
      wrap: "text-red-400 bg-red-500/[0.07] border-red-500/[0.15]",
      spin: false,
    },
  } as const;

  const c = config[status.state];
  if (!c) return null;
  const Icon = c.icon;

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border text-sm ${c.wrap}`}
    >
      <Icon
        className={`h-4 w-4 mt-0.5 shrink-0 ${c.spin ? "animate-spin" : ""}`}
      />
      <div className="min-w-0">
        <p className="leading-snug font-medium">{status.message}</p>
        {status.detail && (
          <p className="text-xs mt-1 opacity-70 leading-relaxed">
            {status.detail}
          </p>
        )}
      </div>
    </div>
  );
}

function StatsRow({ stats }: { stats: ImportStats | null }) {
  if (!stats) return null;
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      <span className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/50">
        کل: <span className="text-white/80 font-semibold">{stats.total}</span>
      </span>
      <span className="px-3 py-1.5 rounded-lg bg-emerald-500/[0.07] border border-emerald-500/[0.12] text-emerald-400">
        وارد شده:{" "}
        <span className="font-semibold">{stats.imported}</span>
      </span>
      {stats.skipped > 0 && (
        <span className="px-3 py-1.5 rounded-lg bg-amber-500/[0.07] border border-amber-500/[0.12] text-amber-400">
          تکراری:{" "}
          <span className="font-semibold">{stats.skipped}</span>
        </span>
      )}
      {stats.errors > 0 && (
        <span className="px-3 py-1.5 rounded-lg bg-red-500/[0.07] border border-red-500/[0.12] text-red-400">
          خطا:{" "}
          <span className="font-semibold">{stats.errors}</span>
        </span>
      )}
    </div>
  );
}

// ─── Page Component ──────────────────────────────────────────

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<TabType>("flashcards");
  const [isDragging, setIsDragging] = useState(false);
  const [staged, setStaged] = useState<Record<TabType, StagedFile[]>>({
    notes: [],
    flashcards: [],
    questions: [],
  });
  const [status, setStatus] = useState<ImportStatus>({ state: "idle" });
  const [lastStats, setLastStats] = useState<ImportStats | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const tab = TABS.find((t) => t.key === activeTab)!;
  const files = useMemo(() => staged[activeTab], [staged, activeTab]);

  // ── File staging ───────────────────────────────────────────

  const stageFiles = useCallback(
    async (incoming: FileList | File[]) => {
      const list = Array.from(incoming).filter((f) =>
        f.name.toLowerCase().endsWith(".json")
      );
      if (list.length === 0) {
        toast.error("فقط فایل‌های JSON پشتیبانی می‌شوند");
        return;
      }

      const newFiles: StagedFile[] = await Promise.all(
        list.map(async (file) => {
          const count = await peekItemCount(file, activeTab);
          return {
            id: `${file.name}-${file.size}-${Date.now()}-${crypto.randomUUID()}`,
            file,
            sizeLabel: fmtBytes(file.size),
            itemCount: count,
          };
        })
      );

      setStaged((prev) => ({
        ...prev,
        [activeTab]: [...prev[activeTab], ...newFiles],
      }));

      toast.success(`${newFiles.length} فایل اضافه شد`);
    },
    [activeTab]
  );

  const removeFile = useCallback(
    (id: string) => {
      setStaged((prev) => ({
        ...prev,
        [activeTab]: prev[activeTab].filter((f) => f.id !== id),
      }));
    },
    [activeTab]
  );

  const clearTab = useCallback(() => {
    setStaged((prev) => ({ ...prev, [activeTab]: [] }));
  }, [activeTab]);

  // ── Drag & Drop ────────────────────────────────────────────

  const onDragOver: React.DragEventHandler = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave: React.DragEventHandler = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const onDrop: React.DragEventHandler = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) stageFiles(e.dataTransfer.files);
  };

  // ── File input ─────────────────────────────────────────────

  const openFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      stageFiles(e.target.files);
      e.target.value = "";
    }
  };

  // ── Import handler ─────────────────────────────────────────

  const handleImport = async () => {
    if (files.length === 0) return;

    setStatus({ state: "parsing", message: "در حال خواندن فایل‌ها..." });
    setLastStats(null);

    try {
      // 1. Parse all files
      const merged: any[] = [];
      const badFiles: string[] = [];

      for (const sf of files) {
        try {
          const rows = await readJsonArray(sf.file, activeTab);
          merged.push(...rows);
        } catch {
          badFiles.push(sf.file.name);
        }
      }

      if (badFiles.length > 0) {
        toast.warning(`${badFiles.length} فایل قابل خواندن نبود: ${badFiles.join(", ")}`);
      }

      if (merged.length === 0) {
        setStatus({
          state: "error",
          message: "داده‌ای برای ایمپورت یافت نشد",
          detail:
            "فایل‌ها خالی هستند یا ساختار JSON آن‌ها قابل تشخیص نیست.",
        });
        return;
      }

      // 2. Send to backend
      setStatus({
        state: "uploading",
        message: `ارسال ${merged.length.toLocaleString("fa-IR")} آیتم به سرور...`,
      });

      const res = await importApi.import(activeTab, merged);

      // 3. Show result
      const stats: ImportStats = {
        total: res.total ?? merged.length,
        imported: res.imported ?? 0,
        skipped: res.skipped ?? 0,
        errors: res.errors?.length ?? 0,
      };
      setLastStats(stats);

      if (stats.imported > 0) {
        setStatus({
          state: "success",
          message: res.message || `${stats.imported} آیتم با موفقیت وارد شد`,
        });
        toast.success(`${stats.imported} آیتم ایمپورت شد`);
      } else {
        setStatus({
          state: "error",
          message: "هیچ آیتمی وارد نشد",
          detail: res.errors?.map((e: any) => `ردیف ${e.index}: ${e.message}`).join(" | "),
        });
      }

      // Show individual errors as toasts (max 3)
      if (res.errors?.length) {
        res.errors.slice(0, 3).forEach((e: any) =>
          toast.error(`ردیف ${e.index}: ${e.message}`)
        );
      }

      // Clear staging on success
      if (stats.imported > 0) {
        setStaged((prev) => ({ ...prev, [activeTab]: [] }));
      }
    } catch (e: any) {
      const msg = e?.message ?? "خطای ناشناخته";
      setStatus({
        state: "error",
        message: "ایمپورت با خطا مواجه شد",
        detail: msg,
      });
      toast.error(msg);
    }
  };

  const isBusy =
    status.state === "parsing" || status.state === "uploading";

  const totalPreviewItems = files.reduce(
    (sum, f) => sum + (f.itemCount && f.itemCount > 0 ? f.itemCount : 0),
    0
  );

  // ── Render ─────────────────────────────────────────────────

  return (
    <div dir="rtl" className="min-h-screen bg-[#080a12] text-white">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".json,application/json"
        className="hidden"
        onChange={onFileInputChange}
      />

      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-48 -right-48 h-[600px] w-[600px] rounded-full bg-violet-600/[0.04] blur-[120px]" />
        <div className="absolute -bottom-48 -left-48 h-[600px] w-[600px] rounded-full bg-cyan-600/[0.04] blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[400px] rounded-full bg-emerald-600/[0.02] blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-10 space-y-8">
        {/* ── Header ── */}
        <header className="space-y-1">
          <div className="flex items-center gap-3.5">
            <div
              className={`h-11 w-11 rounded-xl bg-gradient-to-br ${tab.gradient} flex items-center justify-center shadow-lg ${tab.glow}`}
            >
              <FolderUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                مدیریت فایل و ایمپورت
                <Sparkles className="h-5 w-5 text-amber-400/60" />
              </h1>
              <p className="text-sm text-white/35 mt-0.5">
                فایل‌ها را مرحله‌بندی و سپس به دیتابیس وارد کنید
              </p>
            </div>
          </div>
        </header>

        {/* ── Tabs ── */}
        <nav className="flex gap-2 flex-wrap">
          {TABS.map((t) => (
            <TabButton
              key={t.key}
              tab={t}
              active={t.key === activeTab}
              count={staged[t.key].length}
              onClick={() => {
                setActiveTab(t.key);
                setStatus({ state: "idle" });
                setLastStats(null);
              }}
            />
          ))}
        </nav>

        {/* ── Drop Zone ── */}
        <DropZone
          tab={tab}
          isDragging={isDragging}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={openFilePicker}
        />

        {/* ── Status ── */}
        <StatusBanner status={status} />
        <StatsRow stats={lastStats} />

        {/* ── Staged Files Panel ── */}
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-md overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <FileJson className="h-4 w-4 text-white/30" />
              <span className="text-sm font-semibold text-white/75">
                فایل‌های آماده
              </span>
              <span className="text-[11px] text-white/25 font-mono">
                ({files.length})
              </span>
              {totalPreviewItems > 0 && (
                <span className="text-[11px] text-white/25">
                  — {totalPreviewItems.toLocaleString("fa-IR")} آیتم
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {files.length > 0 && (
                <button
                  onClick={clearTab}
                  disabled={isBusy}
                  className={[
                    "px-3 py-1.5 rounded-lg text-xs transition-all duration-200",
                    "text-white/30 hover:text-white/60 hover:bg-white/[0.05]",
                    "border border-transparent hover:border-white/[0.08]",
                    "disabled:opacity-20 disabled:cursor-not-allowed",
                  ].join(" ")}
                >
                  پاک کردن
                </button>
              )}

              <button
                onClick={handleImport}
                disabled={files.length === 0 || isBusy}
                className={[
                  "inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold",
                  "transition-all duration-200 border",
                  files.length > 0 && !isBusy
                    ? `bg-gradient-to-r ${tab.gradient} text-white border-transparent shadow-lg ${tab.glow} hover:opacity-90 active:scale-[0.97]`
                    : "bg-white/[0.03] text-white/20 border-white/[0.06] cursor-not-allowed",
                ].join(" ")}
              >
                {isBusy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    در حال پردازش...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4" />
                    ایمپورت به دیتابیس
                  </>
                )}
              </button>
            </div>
          </div>

          {/* File list */}
          <div className="p-3 space-y-1.5 min-h-[130px]">
            {files.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-28 gap-3 text-white/15">
                <FileWarning className="h-8 w-8" />
                <p className="text-xs">هنوز فایلی اضافه نشده است</p>
              </div>
            ) : (
              files.map((sf) => (
                <FileRow
                  key={sf.id}
                  sf={sf}
                  disabled={isBusy}
                  tabGradient={tab.gradient}
                  onRemove={() => removeFile(sf.id)}
                />
              ))
            )}
          </div>
        </section>

        {/* ── Footer hint ── */}
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-500/[0.03] border border-amber-500/[0.1] text-amber-400/60 text-xs">
          <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <p>
            اگر خطای ۴۰۴ دریافت کردید، مسیر{" "}
            <code className="font-mono bg-white/[0.06] px-1.5 py-0.5 rounded text-[11px]">
              src/app/api/import/[type]/route.ts
            </code>{" "}
            را بررسی کنید.
          </p>
        </div>
      </div>
    </div>
  );
}