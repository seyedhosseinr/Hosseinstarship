"use client";

/**
 * EdgeImportPanel
 * ────────────────
 * Integrated edge import path inside ContentManager.
 * Renders directly inside the parent section — no outer wrapper.
 *
 * Visual language: matches ContentManager inline-style tokens (colorLight).
 * Layout: RTL Persian throughout.
 * Progress: rAF-driven via useEdgeImport — zero extra renders per frame.
 *
 * States exposed:
 *   idle (no file)   → drop zone
 *   idle (file set)  → file row + action buttons
 *   initializing     → "آماده‌سازی" (worker + WASM/DB init, before first byte)
 *   streaming        → "خواندن فایل" (bytes arriving, accumulating first batch)
 *   parsing          → "تجزیهٔ رکوردها" (records parsing, no batch committed yet)
 *   writing          → "نوشتن در OPFS" (batches committing to browser storage)
 *   complete         → success summary
 *   error            → error card with message
 *   aborted          → auto-resets to idle
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload, FileJson, CheckCircle2, XCircle, X, AlertTriangle,
} from "lucide-react";

import { colorLight, colorDark } from "@/lib/theme/tokens";

const EIP_STYLES = `
[data-edge-import] {
${Object.entries(colorLight).map(([k, v]) => `  --eip-${k}: ${v};`).join("\n")}
}
.dark [data-edge-import] {
${Object.entries(colorDark).map(([k, v]) => `  --eip-${k}: ${v};`).join("\n")}
}
`;
const C = Object.fromEntries(
  Object.keys(colorLight).map((k) => [k, `var(--eip-${k})`]),
) as Record<keyof typeof colorLight, string>;
import { generateId, formatNumber } from "@/lib/utils";
import { getOrCreateOriginId } from "@/db/pglite-browser";
import { useEdgeImport } from "@/workers/use-edge-import";
import type { InitStreamPayload } from "@/workers/use-edge-import";
import { pushLocalToServer } from "@/lib/sync/sync-client";

// ── Status label (Persian, RTL) ───────────────────────────────────────────────
// Maps worker phase + progress data to a human-readable status line.
// Distinguishes streaming → parsing → writing without adding worker messages.

function statusLabel(
  phase: string,
  recordsParsed: number,
  batchesCommitted: number,
): string {
  if (phase === "initializing")                              return "آماده‌سازی پارسر و حافظهٔ مرورگر...";
  if (phase === "streaming" && batchesCommitted === 0 && recordsParsed === 0)
                                                            return "خواندن فایل از حافظه...";
  if (phase === "streaming" && batchesCommitted === 0)      return "تجزیهٔ رکوردها...";
  if (phase === "streaming")                                return "نوشتن در OPFS...";
  return "";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(b: number): string {
  if (b < 1024)      return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(1)} MB`;
}

function fmtMs(ms: number): string {
  if (ms < 1000)   return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} ثانیه`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m} دقیقه و ${s} ثانیه`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EdgeImportPanel({
  onImportComplete,
}: {
  onImportComplete?: () => void;
}) {
  const [file,        setFile]        = useState<File | null>(null);
  const [isDragOver,  setIsDragOver]  = useState(false);
  const [syncStatus,  setSyncStatus]  = useState<"idle" | "syncing" | "synced" | "sync-failed">("idle");
  const inputRef                      = useRef<HTMLInputElement>(null);

  // Trigger OPFS → server sync after import completes. Tracks result visibly so
  // the user knows if data reached the server. Does NOT block the complete state.
  const handleImportComplete = useCallback(() => {
    onImportComplete?.();
    setSyncStatus("syncing");
    pushLocalToServer()
      .then((result) => setSyncStatus(result.ok ? "synced" : "sync-failed"))
      .catch(() => setSyncStatus("sync-failed"));
  }, [onImportComplete]);

  const { phase, progress: p, summary, error, start, abort, reset: resetWorker } =
    useEdgeImport(handleImportComplete);

  // Aborted → silently return to idle so the user can start again.
  useEffect(() => {
    if (phase === "aborted") { resetWorker(); setFile(null); }
  }, [phase, resetWorker]);

  // ── Derived state flags ────────────────────────────────────────────────────
  const isActive   = phase === "initializing" || phase === "streaming";
  const showDrop   = phase === "idle" && file === null;
  const showPicked = phase === "idle" && file !== null;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const pickFile = useCallback((f: File) => setFile(f), []);

  const onDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true);  }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }, []);
  const onDrop      = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
    const f = e.dataTransfer.files[0]; if (f) pickFile(f);
  }, [pickFile]);

  const startImport = useCallback(() => {
    if (!file) return;
    const payload: InitStreamPayload = {
      importId:     generateId(),
      fileName:     file.name,
      fileSizeBytes: file.size,
      originId:     getOrCreateOriginId(),
      flushSize:    500,
    };
    start(file, payload);
  }, [file, start]);

  const handleReset = useCallback(() => { resetWorker(); setFile(null); setIsDragOver(false); setSyncStatus("idle"); }, [resetWorker]);

  const label = statusLabel(phase, p.recordsParsed, p.batchesCommitted);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div data-edge-import dir="rtl">
      <style dangerouslySetInnerHTML={{ __html: EIP_STYLES }} />

      {/* ╌╌ Idle: drop zone ╌╌ */}
      {showDrop && (
        <div
          role="button"
          tabIndex={0}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          style={{
            border:     `2px dashed ${isDragOver ? C.accent : C.border}`,
            borderRadius: 12,
            background:  isDragOver ? C.accentSoft : C.bg,
            padding:    "32px 24px",
            display:    "flex",
            flexDirection: "column",
            alignItems: "center",
            cursor:     "pointer",
            transition: "border-color .15s, background .15s",
            userSelect: "none",
            outline:    "none",
          }}
        >
          <Upload size={28} color={isDragOver ? C.accent : C.textMuted}
            style={{ marginBottom: 10, transition: "color .15s" }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>
            فایل را بکشید یا کلیک کنید
          </span>
          <span style={{ fontSize: 12, color: C.textMuted }}>
            JSONL · JSON Array · حداکثر ۵۰۰ مگابایت
          </span>
          <input
            ref={inputRef}
            type="file"
            accept=".json,.jsonl,.ndjson"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickFile(f);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {/* ╌╌ Idle: file selected ╌╌ */}
      {showPicked && file && (
        <>
          <div style={{
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            background: C.surface,
            padding: "11px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 10,
          }}>
            <FileJson size={18} color={C.accent} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {file.name}
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>
                {fmtBytes(file.size)}
              </div>
            </div>
            <button
              onClick={handleReset}
              aria-label="حذف فایل"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: C.textMuted, display: "flex", alignItems: "center" }}
            >
              <X size={14} />
            </button>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={startImport}
              style={{
                background: C.accent, color: "#fff",
                border: "none", borderRadius: 10,
                padding: "9px 22px", fontSize: 13, fontWeight: 600,
                cursor: "pointer",
              }}
            >
              شروع واردات
            </button>
            <button
              onClick={handleReset}
              style={{
                background: "none", color: C.textMuted,
                border: `1px solid ${C.border}`, borderRadius: 10,
                padding: "9px 16px", fontSize: 13,
                cursor: "pointer",
              }}
            >
              انصراف
            </button>
          </div>
        </>
      )}

      {/* ╌╌ Active: initializing / streaming / parsing / writing ╌╌ */}
      {isActive && (
        <div style={{
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          background: C.surface,
          padding: "16px 18px",
        }}>
          {/* Status row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Spinner — uses Tailwind's globally-defined @keyframes spin */}
              <span style={{
                display: "inline-block", width: 14, height: 14,
                border: `2px solid ${C.accentBorder}`,
                borderTopColor: C.accent,
                borderRadius: "50%",
                animation: "spin 0.75s linear infinite",
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{label}</span>
            </div>
            <button
              onClick={() => abort()}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: C.danger, padding: 0 }}
            >
              لغو
            </button>
          </div>

          {/* Progress track */}
          <div style={{ height: 5, background: C.bg, borderRadius: 999, marginBottom: 12, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${p.percent}%`,
              background: C.accent,
              borderRadius: 999,
              transition: "width 0.08s linear",
            }} />
          </div>

          {/* Stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 7 }}>
            <Chip label="پردازش‌شده"   value={fmtBytes(p.bytesProcessed)} />
            <Chip label="رکورد خوانده" value={formatNumber(p.recordsParsed)} />
            <Chip label="نوشته‌شده"    value={formatNumber(p.recordsWritten)} />
            <Chip label="دسته‌ها"       value={String(p.batchesCommitted)} />
          </div>

          {/* Percent + filename */}
          {file && (
            <div style={{ marginTop: 9, fontSize: 11, color: C.textMuted, textAlign: "center" }}>
              {p.percent}٪ — {file.name}
            </div>
          )}
        </div>
      )}

      {/* ╌╌ Complete ╌╌ */}
      {phase === "complete" && summary && (
        <div style={{
          border: "1px solid hsl(var(--success) / 0.25)",
          borderRadius: 12,
          background: "hsl(var(--success) / 0.06)",
          padding: "16px 18px",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <CheckCircle2 size={20} color={C.success} style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                واردات با موفقیت انجام شد
              </div>
              <div style={{ fontSize: 12, color: C.success }}>
                {formatNumber(summary.totalRecordsWritten)} رکورد
                {" · "}{fmtMs(summary.durationMs)}
                {" · "}<span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: summary.parserBackend === "wasm" ? C.success : C.warning }} />
                  <span style={{ fontFamily: "monospace", fontSize: 11 }}>موتور: {summary.parserBackend === "wasm" ? "WASM" : "JS"}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Counts */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <CountCard label="سوالات"      count={summary.questionsInserted}  color="hsl(var(--primary))" bg="hsl(var(--primary) / 0.06)" />
            <CountCard label="فلش‌کارت‌ها" count={summary.flashcardsInserted} color="hsl(var(--info))" bg="hsl(var(--info) / 0.06)" />
          </div>

          {/* Parse error warning */}
          {summary.parseErrors > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 7,
              border: `1px solid hsl(var(--warning) / 0.3)`, borderRadius: 8,
              background: "hsl(var(--warning) / 0.06)", padding: "7px 11px",
              marginBottom: 12,
            }}>
              <AlertTriangle size={13} color={C.warning} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: C.warning }}>
                {formatNumber(summary.parseErrors)} خط غیرقابل تجزیه
              </span>
            </div>
          )}

          {/* Sync status — secondary indicator, does not block the complete state */}
          {syncStatus === "syncing" && (
            <div style={{ marginTop: 8, marginBottom: 4, fontSize: 11, color: C.textMuted, display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent, flexShrink: 0 }} />
              در حال سینک با سرور...
            </div>
          )}
          {syncStatus === "synced" && (
            <div style={{ marginTop: 8, marginBottom: 4, fontSize: 11, color: C.success }}>
              ✓ سینک با سرور انجام شد
            </div>
          )}
          {syncStatus === "sync-failed" && (
            <div style={{ marginTop: 8, marginBottom: 4, fontSize: 11, color: C.warning }}>
              سینک با سرور انجام نشد. در اتصال بعدی تلاش می‌شود.
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={handleReset}
              style={{
                background: "none", border: `1px solid ${C.border}`,
                borderRadius: 10, padding: "7px 18px",
                fontSize: 13, cursor: "pointer", color: C.textSoft,
              }}
            >
              واردات جدید
            </button>
            <span style={{ fontSize: 10, color: C.textMuted, fontFamily: "monospace" }}>
              {summary.importId.slice(0, 8)}
            </span>
          </div>
        </div>
      )}

      {/* ╌╌ Error ╌╌ */}
      {phase === "error" && (
        <div style={{
          border: `1px solid hsl(var(--danger) / 0.25)`,
          borderRadius: 12,
          background: "hsl(var(--danger) / 0.06)",
          padding: "16px 18px",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
            <XCircle size={18} color={C.danger} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.danger, marginBottom: 4 }}>
                خطا در واردات
              </div>
              <div style={{
                fontSize: 12, color: C.danger,
                fontFamily: "monospace", lineHeight: 1.55,
                wordBreak: "break-all",
              }}>
                {error}
              </div>
            </div>
          </div>
          <button
            onClick={handleReset}
            style={{
              background: "none", border: `1px solid hsl(var(--danger) / 0.25)`,
              borderRadius: 10, padding: "7px 18px",
              fontSize: 13, cursor: "pointer", color: C.danger,
            }}
          >
            تلاش مجدد
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
// Kept file-private — not exported, not reused outside this panel.

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: C.bg, border: `1px solid ${C.border}`,
      borderRadius: 8, padding: "7px 8px", textAlign: "center",
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function CountCard({ label, count, color, bg }: {
  label: string; count: number; color: string; bg: string;
}) {
  return (
    <div style={{ background: bg, border: `1px solid ${color}22`, borderRadius: 10, padding: "11px 14px" }}>
      <div style={{ fontSize: 21, fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>
        {formatNumber(count)}
      </div>
      <div style={{ fontSize: 11, color: `${color}AA`, marginTop: 2 }}>{label}</div>
    </div>
  );
}
