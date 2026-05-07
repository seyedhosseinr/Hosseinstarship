"use client";

import { useReducer, useRef, useState, useMemo, useTransition, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Upload, Trash2, CheckCircle2, XCircle,
  BookOpen, HelpCircle, Layers, ChevronDown, Clock,
  AlertTriangle, FolderOpen, X, Plus, RefreshCw, Zap,
  Search, CheckSquare, Square, Sparkles, ArrowUpRight,
  ShieldAlert, ImageIcon,
} from "lucide-react";
import Link from "next/link";
import EdgeImportPanel from "./EdgeImportPanel";
import { toast } from "sonner";

import { importFileDirectly } from "@/app/import/actions";
import {
  deleteImportBatchAction,
  detachDeleteImportBatchAction,
  getImportHistoryAction,
  getQBankOrphanStatsAction,
  purgeOrphanQuestionsAction,
  purgeAllQuestionsAction,
} from "@/lib/actions/import-actions";
import type { QBankOrphanStats } from "@/lib/import-light/admin";
import {
  validateFileContent,
  type ContentType,
  type ValidationResult,
} from "@/lib/import-light/validation-schemas";
import type { ContentStats } from "@/lib/import-light/content-stats";
import type { ImportHistoryEntry } from "@/lib/import-light/types";
import { colorLight, colorDark } from "@/lib/theme/tokens";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const CM_STYLES = `
[data-content-mgr] {
${Object.entries(colorLight).map(([k, v]) => `  --cm-${k}: ${v};`).join("\n")}
}
.dark [data-content-mgr] {
${Object.entries(colorDark).map(([k, v]) => `  --cm-${k}: ${v};`).join("\n")}
}
@keyframes cm-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes cm-pulse-ring {
  0% { box-shadow: 0 0 0 0 var(--cm-accent, #0AA6B8)33; }
  70% { box-shadow: 0 0 0 6px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}
@keyframes cm-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
[data-content-mgr] .cm-stat-card {
  transition: transform 0.25s cubic-bezier(.4,0,.2,1), box-shadow 0.25s cubic-bezier(.4,0,.2,1);
}
[data-content-mgr] .cm-stat-card:hover {
  transform: translateY(-2px);
}
[data-content-mgr] .cm-cat-btn:hover .cm-cat-arrow {
  opacity: 1;
  transform: translateX(-4px);
}
[data-content-mgr] .cm-history-row:hover {
  background: var(--cm-surfaceSubtle);
}
[data-content-mgr] .cm-file-row {
  transition: background 0.15s, border-color 0.15s, transform 0.15s;
}
[data-content-mgr] .cm-file-row:hover {
  transform: translateX(2px);
}
[data-content-mgr] .cm-drop-zone {
  transition: border-color 0.2s, background 0.2s, transform 0.2s;
}
[data-content-mgr] .cm-drop-zone:hover {
  transform: scale(1.005);
}
`;
const C = Object.fromEntries(
  Object.keys(colorLight).map((k) => [k, `var(--cm-${k})`]),
) as Record<keyof typeof colorLight, string>;

/* ═══════════════════════════════════════════════════════════════
   Types & State
═══════════════════════════════════════════════════════════════ */

type FileEntry = {
  id: string;
  file: File;
  text: string | null;
  validation: ValidationResult | null;
  status: "pending" | "validating" | "valid" | "invalid" | "uploading" | "uploaded" | "error";
  errorMsg?: string;
  manualChapter?: number | null;
  manualSegment?: number | null;
};

type CategoryDef = {
  key: ContentType;
  label: string;
  icon: typeof FileText;
  color: string;
  colorBg: string;
  gradient: string;
  accept: string;
  hint: string;
  formats: string;
};

const CATEGORIES: CategoryDef[] = [
  {
    key: "questions",
    label: "سوالات (MCQ)",
    icon: HelpCircle,
    color: "hsl(var(--primary))",
    colorBg: "hsl(var(--primary) / 0.06)",
    gradient: "linear-gradient(135deg, hsl(var(--primary) / 0.08), hsl(var(--primary) / 0.02))",
    accept: ".json",
    hint: 'فایل JSON با ساختار { "questions": [...] }',
    formats: "JSON",
  },
  {
    key: "flashcards",
    label: "فلش‌کارت‌ها",
    icon: Layers,
    color: "hsl(var(--info))",
    colorBg: "hsl(var(--info) / 0.06)",
    gradient: "linear-gradient(135deg, hsl(var(--info) / 0.08), hsl(var(--info) / 0.02))",
    accept: ".json",
    hint: 'فایل JSON با ساختار { "flashcards": [...] }',
    formats: "JSON",
  },
  {
    key: "notes",
    label: "جزوات",
    icon: BookOpen,
    color: "hsl(var(--success))",
    colorBg: "hsl(var(--success) / 0.06)",
    gradient: "linear-gradient(135deg, hsl(var(--success) / 0.08), hsl(var(--success) / 0.02))",
    accept: ".html,.htm,.json",
    hint: "NOTE v7.5 JSON (بلوک‌محور) یا HTML معنایی (<section>, <h2>, ...)",
    formats: "HTML / JSON v7.5",
  },
  {
    key: "yield",
    label: "کارت‌های Yield",
    icon: Zap,
    color: "hsl(var(--warning))",
    colorBg: "hsl(var(--warning) / 0.06)",
    gradient: "linear-gradient(135deg, hsl(var(--warning) / 0.08), hsl(var(--warning) / 0.02))",
    accept: ".json",
    hint: 'YIELD v2.0 (annotations) یا v1.0 ({ "cards": [...] })',
    formats: "JSON v2.0 / v1.0",
  },
];

/** Mode for the delete confirmation dialog. */
type DeleteMode = "hard" | "detach";

type DeleteTarget = {
  importIds: string[];
  label: string;
  /** Aggregate counts shown in the confirmation dialog. */
  counts: {
    questions: number;
    flashcards: number;
    chunks: number;
    noteDocuments: number;
    examLinkedQuestions: number;
  };
};

type State = {
  activeCategory: ContentType | null;
  files: Record<ContentType, FileEntry[]>;
  selectedFileIds: Record<ContentType, Set<string>>;
  deleteTarget: DeleteTarget | null;
  deleteMode: DeleteMode;
};

type Action =
  | { type: "SELECT_CATEGORY"; key: ContentType | null }
  | { type: "ADD_FILES"; key: ContentType; entries: FileEntry[] }
  | { type: "REMOVE_FILE"; key: ContentType; id: string }
  | { type: "UPDATE_FILE"; key: ContentType; id: string; patch: Partial<FileEntry> }
  | { type: "CLEAR_FILES"; key: ContentType }
  | { type: "SET_DELETE"; target: DeleteTarget | null }
  | { type: "SET_DELETE_MODE"; mode: DeleteMode }
  | { type: "TOGGLE_FILE_SELECT"; key: ContentType; id: string }
  | { type: "SELECT_ALL_FILES"; key: ContentType }
  | { type: "DESELECT_ALL_FILES"; key: ContentType };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SELECT_CATEGORY":
      return { ...state, activeCategory: state.activeCategory === action.key ? null : action.key };
    case "ADD_FILES":
      return { ...state, files: { ...state.files, [action.key]: [...state.files[action.key], ...action.entries] } };
    case "REMOVE_FILE": {
      const nextSel = new Set(state.selectedFileIds[action.key]);
      nextSel.delete(action.id);
      return {
        ...state,
        files: { ...state.files, [action.key]: state.files[action.key].filter((f) => f.id !== action.id) },
        selectedFileIds: { ...state.selectedFileIds, [action.key]: nextSel },
      };
    }
    case "UPDATE_FILE": {
      const arr = state.files[action.key].map(f => f.id === action.id ? { ...f, ...action.patch } : f);
      return { ...state, files: { ...state.files, [action.key]: arr } };
    }
    case "CLEAR_FILES":
      return {
        ...state,
        files: { ...state.files, [action.key]: [] },
        selectedFileIds: { ...state.selectedFileIds, [action.key]: new Set<string>() },
      };
    case "SET_DELETE":
      return { ...state, deleteTarget: action.target, deleteMode: "hard" };
    case "SET_DELETE_MODE":
      return { ...state, deleteMode: action.mode };
    case "TOGGLE_FILE_SELECT": {
      const next = new Set(state.selectedFileIds[action.key]);
      if (next.has(action.id)) next.delete(action.id); else next.add(action.id);
      return { ...state, selectedFileIds: { ...state.selectedFileIds, [action.key]: next } };
    }
    case "SELECT_ALL_FILES":
      return { ...state, selectedFileIds: { ...state.selectedFileIds, [action.key]: new Set(state.files[action.key].map(f => f.id)) } };
    case "DESELECT_ALL_FILES":
      return { ...state, selectedFileIds: { ...state.selectedFileIds, [action.key]: new Set<string>() } };
    default:
      return state;
  }
}

const EMPTY_SET = new Set<string>();
const INIT: State = {
  activeCategory: null,
  files: { questions: [], flashcards: [], notes: [], yield: [] },
  selectedFileIds: { questions: EMPTY_SET, flashcards: EMPTY_SET, notes: EMPTY_SET, yield: EMPTY_SET },
  deleteTarget: null,
  deleteMode: "hard",
};

/* ═══════════════════════════════════════════════════════════════
   Props
═══════════════════════════════════════════════════════════════ */

interface Props {
  stats: ContentStats;
  history: ImportHistoryEntry[];
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
═══════════════════════════════════════════════════════════════ */

/** Aggregate counts for a list of history entries (for multi-select dialog). */
function aggregateCounts(entries: ImportHistoryEntry[], ids: string[]) {
  const set = new Set(ids);
  return entries
    .filter((e) => set.has(e.id))
    .reduce(
      (acc, e) => ({
        questions: acc.questions + e.questionCount,
        flashcards: acc.flashcards + e.flashcardCount,
        chunks: acc.chunks + e.chunkCount,
        noteDocuments: acc.noteDocuments + e.noteDocumentCount,
        examLinkedQuestions: acc.examLinkedQuestions + e.examLinkedQuestionCount,
      }),
      { questions: 0, flashcards: 0, chunks: 0, noteDocuments: 0, examLinkedQuestions: 0 },
    );
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
═══════════════════════════════════════════════════════════════ */

export default function ContentManager({ stats, history: initialHistory }: Props) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, INIT);
  const [history, setHistory] = useState(initialHistory);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isPurging, startPurgeTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());
  const [showEdgeImport, setShowEdgeImport] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");
  const [historyTypeFilter, setHistoryTypeFilter] = useState("all");
  const [orphanStats, setOrphanStats] = useState<QBankOrphanStats | null>(null);
  const [purgeAllConfirm, setPurgeAllConfirm] = useState(false);
  const [purgeOrphanConfirm, setPurgeOrphanConfirm] = useState(false);

  const filesRef = useRef(state.files);
  filesRef.current = state.files;

  // Load orphan stats on mount
  useEffect(() => {
    getQBankOrphanStatsAction().then((r) => {
      if (r.success) setOrphanStats(r.data);
    });
  }, []);

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return history.filter((imp) => {
      const matchesQuery = !q || [
        imp.fileName, imp.sourceName, imp.contentType, imp.sourceType,
        imp.schemaVersion, imp.id,
        imp.chapterNo != null ? `ch${imp.chapterNo}` : null,
        imp.segmentNo != null ? `seg${imp.segmentNo}` : null,
      ].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      const matchesStatus = historyStatusFilter === "all" || (imp.status ?? "pending") === historyStatusFilter;
      const matchesType = historyTypeFilter === "all" || (imp.contentType ?? "batch") === historyTypeFilter;
      return matchesQuery && matchesStatus && matchesType;
    });
  }, [history, historySearch, historyStatusFilter, historyTypeFilter]);

  const toggleAllHistory = useCallback(() => {
    if (filteredHistory.length === 0) return;
    const allSelected = filteredHistory.every((imp) => selectedHistoryIds.has(imp.id));
    setSelectedHistoryIds(allSelected ? new Set() : new Set(filteredHistory.map((imp) => imp.id)));
  }, [filteredHistory, selectedHistoryIds]);

  const refreshHistory = useCallback(async () => {
    try {
      const result = await getImportHistoryAction();
      if (result.success) setHistory(result.data as unknown as ImportHistoryEntry[]);
    } catch { /* ignore */ }
    // Refresh orphan stats too
    getQBankOrphanStatsAction().then((r) => { if (r.success) setOrphanStats(r.data); });
  }, []);

  const handleFilesSelected = useCallback(async (cat: ContentType, rawFiles: File[]) => {
    const entries: FileEntry[] = rawFiles.map((f) => ({
      id: Math.random().toString(36).substring(2, 9),
      file: f, text: null, validation: null, status: "pending" as const,
    }));
    dispatch({ type: "ADD_FILES", key: cat, entries });

    for (let i = 0; i < entries.length; i++) {
      const entryId = entries[i].id;
      dispatch({ type: "UPDATE_FILE", key: cat, id: entryId, patch: { status: "validating" } });
      try {
        const text = await rawFiles[i].text();
        const validation = validateFileContent(cat, text);
        dispatch({
          type: "UPDATE_FILE", key: cat, id: entryId,
          patch: { text, validation, status: validation.valid ? "valid" : "invalid" },
        });
      } catch {
        dispatch({
          type: "UPDATE_FILE", key: cat, id: entryId,
          patch: { status: "error", errorMsg: "خطا در خواندن فایل" },
        });
      }
    }
  }, []);

  const handleCommit = useCallback(async (cat: ContentType) => {
    const currentFiles = filesRef.current[cat];
    const validFiles = currentFiles.filter((f) => f.status === "valid");
    if (validFiles.length === 0) return;
    setIsUploading(true);

    let successCount = 0;
    let totalInserted = 0;

    for (let i = 0; i < currentFiles.length; i++) {
      const entry = currentFiles[i];
      if (entry.status !== "valid" || !entry.text) continue;
      dispatch({ type: "UPDATE_FILE", key: cat, id: entry.id, patch: { status: "uploading" } });

      try {
        let effectiveName = entry.file.name;
        const mc = entry.manualChapter;
        const ms = entry.manualSegment;
        if (mc != null || ms != null) {
          const base = entry.file.name.replace(/\.[^.]+$/, "");
          const ext = entry.file.name.includes(".") ? entry.file.name.slice(entry.file.name.lastIndexOf(".")) : "";
          const chPart = mc != null ? `_ch${mc}` : "";
          const segPart = ms != null ? `_seg${String(ms).padStart(3, "0")}` : "";
          effectiveName = `${base}${chPart}${segPart}${ext}`;
        }
        const result = await importFileDirectly(cat, effectiveName, entry.text);
        if (result.ok) {
          dispatch({ type: "UPDATE_FILE", key: cat, id: entry.id, patch: { status: "uploaded" } });
          successCount++;
          totalInserted += result.inserted;
        } else {
          dispatch({ type: "UPDATE_FILE", key: cat, id: entry.id, patch: { status: "error", errorMsg: result.message } });
        }
      } catch (err) {
        dispatch({
          type: "UPDATE_FILE", key: cat, id: entry.id,
          patch: { status: "error", errorMsg: err instanceof Error ? err.message : "خطای ناشناخته" },
        });
      }
    }

    setIsUploading(false);
    if (successCount > 0) {
      toast.success(`${totalInserted} مورد از ${successCount} فایل وارد شد`);
      await refreshHistory();
      router.refresh();
    }
  }, [refreshHistory, router]);

  /** Execute the confirmed delete (hard or detach mode). */
  const handleDelete = useCallback(() => {
    if (!state.deleteTarget) return;
    const { importIds, counts } = state.deleteTarget;
    const mode = state.deleteMode;

    startDeleteTransition(async () => {
      if (mode === "hard") {
        // Hard delete: all in one bulk call
        let totalQuestions = 0;
        let totalExamLinks = 0;
        let failed = 0;
        for (const id of importIds) {
          try {
            const r = await deleteImportBatchAction(id);
            if (r.success) {
              totalQuestions += r.data.deleted.questions;
              totalExamLinks += r.data.deleted.examSessionLinks;
            } else {
              failed++;
            }
          } catch { failed++; }
        }
        if (importIds.length > failed) {
          const parts = [`${importIds.length - failed} واردات حذف شد`];
          if (totalQuestions > 0) parts.push(`${totalQuestions} سوال`);
          if (totalExamLinks > 0) parts.push(`${totalExamLinks} لینک آزمون`);
          toast.success(parts.join(" · "));
        } else {
          toast.error("خطا در حذف");
        }
      } else {
        // Detach mode
        let detached = 0;
        let failed = 0;
        for (const id of importIds) {
          try {
            const r = await detachDeleteImportBatchAction(id);
            if (r.success) detached++;
            else failed++;
          } catch { failed++; }
        }
        if (detached > 0) {
          toast.success(`${detached} واردات جدا شد — سوالات آزمونی در QBank باقی ماندند`);
        } else {
          toast.error("خطا در جداسازی");
        }
      }

      void counts; // suppress unused warning
      setSelectedHistoryIds(new Set());
      await refreshHistory();
      router.refresh();
      dispatch({ type: "SET_DELETE", target: null });
    });
  }, [state.deleteTarget, state.deleteMode, refreshHistory, router]);

  const toggleHistorySelection = useCallback((id: string) => {
    setSelectedHistoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const openDeleteDialog = useCallback((ids: string[], label: string) => {
    const counts = aggregateCounts(history, ids);
    dispatch({ type: "SET_DELETE", target: { importIds: ids, label, counts } });
  }, [history]);

  const totalStats = CATEGORIES.reduce((s, c) => s + stats[c.key].total, 0);

  const hasOrphans = (orphanStats?.orphanQuestions ?? 0) > 0;
  const totalQBankQuestions = orphanStats?.totalQuestions ?? 0;

  return (
    <div data-content-mgr style={{ minHeight: "100vh", background: C.bg, fontFamily: "inherit" }} dir="rtl">
      <style dangerouslySetInnerHTML={{ __html: CM_STYLES }} />

      {/* ══════════════════ Hero Header ══════════════════ */}
      <div style={{
        background: `linear-gradient(160deg, ${C.surface} 0%, ${C.accentSoft} 50%, ${C.surface} 100%)`,
        borderBottom: `1px solid ${C.border}`,
        padding: "36px 32px 28px",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -60, left: -40, width: 200, height: 200, borderRadius: "50%", background: `${C.accent}08`, filter: "blur(60px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -40, right: 80, width: 160, height: 160, borderRadius: "50%", background: `${C.accent}06`, filter: "blur(50px)", pointerEvents: "none" }} />

        <div style={{ maxWidth: 1140, margin: "0 auto", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${C.accent}18, ${C.accent}08)`, border: `1px solid ${C.accent}20`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 8px 24px ${C.accent}12` }}>
              <FolderOpen size={22} color={C.accent} />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: 0, letterSpacing: "-0.02em" }}>مدیریت محتوا</h1>
              <p style={{ fontSize: 13, color: C.textMuted, margin: "2px 0 0", lineHeight: 1.5 }}>وارد کردن، اعتبارسنجی و مدیریت جزوات، سوالات و فلش‌کارت‌ها</p>
            </div>
            <div style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, boxShadow: `0 2px 8px ${C.text}06` }}>
                <Sparkles size={14} color={C.accent} />
                <span style={{ fontSize: 18, fontWeight: 800, color: C.text, fontVariantNumeric: "tabular-nums" }}>{totalStats.toLocaleString("fa-IR")}</span>
                <span style={{ fontSize: 11, color: C.textMuted }}>مورد کل</span>
              </div>
            </div>
          </div>

          {/* Stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginTop: 24 }}>
            {CATEGORIES.map((cat) => {
              const s = stats[cat.key];
              return (
                <div key={cat.key} className="cm-stat-card" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10, position: "relative", overflow: "hidden", boxShadow: `0 4px 16px ${C.text}04` }}>
                  <div style={{ position: "absolute", top: 0, right: 0, left: 0, height: 3, background: `linear-gradient(90deg, ${cat.color}, transparent)`, opacity: 0.6 }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: cat.colorBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <cat.icon size={18} color={cat.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color: cat.color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{s.total.toLocaleString("fa-IR")}</div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>{cat.label}</div>
                    </div>
                  </div>
                  {s.lastImportedAt && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, background: C.surfaceSubtle, fontSize: 10, color: C.textMuted }}>
                      <Clock size={10} />
                      <span>آخرین: {new Date(s.lastImportedAt).toLocaleDateString("fa-IR")}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Orphan warning */}
          {orphanStats && (hasOrphans || totalQBankQuestions > 0) && (
            <div style={{ marginTop: 16, padding: "12px 18px", borderRadius: 14, background: hasOrphans ? "hsl(var(--warning) / 0.08)" : C.surfaceSubtle, border: `1px solid ${hasOrphans ? "hsl(var(--warning) / 0.25)" : C.border}`, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <ShieldAlert size={16} color={hasOrphans ? "hsl(var(--warning))" : C.textMuted} />
              <span style={{ fontSize: 13, color: hasOrphans ? "hsl(var(--warning))" : C.textMuted, fontWeight: 600, flex: 1 }}>
                {hasOrphans
                  ? `QBank شامل ${orphanStats.orphanQuestions} سوال بدون پیوند به واردات است`
                  : `QBank: ${totalQBankQuestions} سوال`}
              </span>
              <span style={{ fontSize: 11, color: C.textMuted }}>
                {orphanStats.linkedQuestions} پیوند · {orphanStats.examLinkedTotal} لینک آزمون
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════ Body ══════════════════ */}
      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "28px 32px 48px" }}>

        {/* ── Category Sections ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
          {CATEGORIES.map((cat) => (
            <CategorySection
              key={cat.key}
              cat={cat}
              isActive={state.activeCategory === cat.key}
              files={state.files[cat.key]}
              isUploading={isUploading}
              selectedIds={state.selectedFileIds[cat.key]}
              onToggle={() => dispatch({ type: "SELECT_CATEGORY", key: cat.key })}
              onFilesSelected={(files) => handleFilesSelected(cat.key, files)}
              onRemoveFile={(id) => dispatch({ type: "REMOVE_FILE", key: cat.key, id })}
              onClearFiles={() => dispatch({ type: "CLEAR_FILES", key: cat.key })}
              onCommit={() => handleCommit(cat.key)}
              onPatchFile={(id, patch) => dispatch({ type: "UPDATE_FILE", key: cat.key, id, patch })}
              onSelectAll={() => dispatch({ type: "SELECT_ALL_FILES", key: cat.key })}
              onDeselectAll={() => dispatch({ type: "DESELECT_ALL_FILES", key: cat.key })}
              onToggleSelect={(id) => dispatch({ type: "TOGGLE_FILE_SELECT", key: cat.key, id })}
              onRemoveSelected={() => {
                for (const id of state.selectedFileIds[cat.key]) {
                  dispatch({ type: "REMOVE_FILE", key: cat.key, id });
                }
              }}
            />
          ))}
        </div>

        {/* ── Edge Import ── */}
        <div style={{ background: C.surface, borderRadius: 18, border: `1px solid ${showEdgeImport ? C.accentBorder : C.border}`, overflow: "hidden", marginBottom: 14, boxShadow: showEdgeImport ? `0 8px 32px ${C.accent}10` : `0 2px 8px ${C.text}04`, transition: "border-color 0.3s, box-shadow 0.3s" }}>
          <button onClick={() => setShowEdgeImport((v) => !v)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "16px 22px", display: "flex", alignItems: "center", gap: 12, textAlign: "right" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${C.accent}15, ${C.accent}08)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Zap size={16} color={C.accent} />
            </div>
            <div style={{ flex: 1, textAlign: "right" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>واردات سریع Edge (V3)</span>
              <span style={{ fontSize: 11, color: C.textMuted, display: "block", marginTop: 1 }}>استریم فایل‌های بزرگ با موتور WASM مستقیم به OPFS مرورگر</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {(["WASM", "OPFS"] as const).map((label) => (
                <span key={label} style={{ fontSize: 10, color: C.accent, fontWeight: 700, border: `1px solid ${C.accentBorder}`, borderRadius: 8, padding: "3px 10px", background: C.accentSoft, letterSpacing: "0.05em" }}>{label}</span>
              ))}
            </div>
            <ChevronDown size={16} color={C.textMuted} style={{ transform: showEdgeImport ? "rotate(180deg)" : "none", transition: "transform 0.25s ease" }} />
          </button>
          <AnimatePresence initial={false}>
            {showEdgeImport && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: "easeOut" }} style={{ overflow: "hidden" }}>
                <div style={{ padding: "0 24px 24px", borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
                  <EdgeImportPanel onImportComplete={() => { refreshHistory(); router.refresh(); }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Media / Chapter Images ── */}
        <Link
          href="/import/media"
          style={{ display: "block", textDecoration: "none", marginBottom: 14 }}
        >
          <div style={{ background: C.surface, borderRadius: 18, border: `1px solid ${C.border}`, padding: "16px 22px", display: "flex", alignItems: "center", gap: 14, boxShadow: `0 2px 8px ${C.text}04`, cursor: "pointer", transition: "border-color 0.25s, box-shadow 0.25s" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "hsl(var(--info) / 0.5)"; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 6px 24px hsl(var(--info) / 0.1)`; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = C.border; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 2px 8px ${C.text}04`; }}
          >
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "hsl(var(--info) / 0.08)", border: "1px solid hsl(var(--info) / 0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <ImageIcon size={20} color="hsl(var(--info))" />
            </div>
            <div style={{ flex: 1, textAlign: "right" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: C.text, display: "block" }}>تصاویر فصل / رسانه</span>
              <span style={{ fontSize: 11, color: C.textMuted, display: "block", marginTop: 2 }}>
                وارد کردن تصاویر و باندل رسانه‌ای فصل‌های Campbell · مدیریت رجیستری رسانه مورد استفاده در Reader
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, color: "hsl(var(--info))", fontWeight: 700, border: "1px solid hsl(var(--info) / 0.3)", borderRadius: 8, padding: "3px 10px", background: "hsl(var(--info) / 0.06)", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                Media Registry
              </span>
              <ArrowUpRight size={16} color="hsl(var(--info))" style={{ opacity: 0.7 }} />
            </div>
          </div>
        </Link>

        {/* ── Import History ── */}
        <div style={{ background: C.surface, borderRadius: 18, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: `0 4px 20px ${C.text}04` }}>
          <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}`, background: `linear-gradient(180deg, ${C.surface}, ${C.surfaceSubtle})` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${C.accent}12, ${C.accent}06)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Clock size={15} color={C.accent} />
                </div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>تاریخچه واردات</h2>
                <span style={{ fontSize: 11, color: C.textMuted, background: C.surfaceSubtle, border: `1px solid ${C.border}`, borderRadius: 8, padding: "3px 10px", fontVariantNumeric: "tabular-nums" }}>
                  {filteredHistory.length}/{history.length}
                </span>
                {selectedHistoryIds.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => openDeleteDialog([...selectedHistoryIds], `${selectedHistoryIds.size} واردات انتخاب شده`)}
                    style={{ gap: 4 }}
                  >
                    <Trash2 size={12} /> حذف {selectedHistoryIds.size} واردات و محتوا
                  </Button>
                )}
              </div>
              <button onClick={refreshHistory} style={{ background: C.surfaceSubtle, border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer", color: C.textMuted, display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 14px", fontWeight: 500 }}>
                <RefreshCw size={12} /> بروزرسانی
              </button>
            </div>

            {/* Search + filters */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ position: "relative", flex: "1 1 220px", minWidth: 160 }}>
                <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textMuted, pointerEvents: "none" }} />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="جستجوی نام فایل، نوع، فصل..."
                  style={{ width: "100%", height: 38, paddingRight: 14, paddingLeft: 36, borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 13, outline: "none", background: C.surface, color: C.text, transition: "border-color 0.2s, box-shadow 0.2s" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.boxShadow = `0 0 0 3px ${C.accent}15`; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = "none"; }}
                />
              </div>
              <select value={historyStatusFilter} onChange={(e) => setHistoryStatusFilter(e.target.value)} style={{ height: 38, borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 13, padding: "0 12px", background: C.surface, color: C.text }}>
                <option value="all">همه وضعیت‌ها</option>
                <option value="completed">موفق</option>
                <option value="running">در حال اجرا</option>
                <option value="failed">ناموفق</option>
                <option value="pending">در انتظار</option>
              </select>
              <select value={historyTypeFilter} onChange={(e) => setHistoryTypeFilter(e.target.value)} style={{ height: 38, borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 13, padding: "0 12px", background: C.surface, color: C.text }}>
                <option value="all">همه انواع</option>
                <option value="notes">جزوات</option>
                <option value="questions">سوالات</option>
                <option value="flashcards">فلش‌کارت</option>
                <option value="yield">Yield</option>
                <option value="batch">دسته‌ای</option>
              </select>
              {filteredHistory.length > 0 && (
                <button onClick={toggleAllHistory} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "0 14px", height: 38, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textMuted, fontWeight: 500 }}>
                  {filteredHistory.every((imp) => selectedHistoryIds.has(imp.id))
                    ? <><CheckSquare size={13} /> لغو انتخاب همه</>
                    : <><Square size={13} /> انتخاب همه</>}
                </button>
              )}
            </div>
          </div>

          {/* History list */}
          {filteredHistory.length === 0 ? (
            <div style={{ padding: "48px 20px", textAlign: "center", color: C.textMuted, fontSize: 14 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: C.surfaceSubtle, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                <FolderOpen size={24} color={C.textMuted} style={{ opacity: 0.5 }} />
              </div>
              {history.length === 0 ? "هنوز محتوایی وارد نشده است" : "نتیجه‌ای یافت نشد"}
            </div>
          ) : (
            <div style={{ maxHeight: 520, overflowY: "auto" }}>
              {filteredHistory.map((imp, idx) => (
                <HistoryRow
                  key={imp.id}
                  imp={imp}
                  isSelected={selectedHistoryIds.has(imp.id)}
                  isLast={idx === filteredHistory.length - 1}
                  onToggleSelect={() => toggleHistorySelection(imp.id)}
                  onDelete={() => openDeleteDialog([imp.id], imp.fileName ?? imp.sourceName ?? imp.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── QBank Purge Panel ── */}
        <div style={{ marginTop: 14, background: C.surface, borderRadius: 18, border: `1px solid ${C.border}`, padding: "18px 22px", boxShadow: `0 2px 8px ${C.text}04` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <ShieldAlert size={16} color="hsl(var(--danger))" />
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>عملیات پاک‌سازی QBank</span>
            {orphanStats && (
              <span style={{ fontSize: 11, color: C.textMuted }}>
                کل سوالات: {orphanStats.totalQuestions} · بدون واردات: {orphanStats.orphanQuestions}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button
              variant="outline"
              size="sm"
              disabled={isPurging || !orphanStats || orphanStats.orphanQuestions === 0}
              onClick={() => setPurgeOrphanConfirm(true)}
              style={{ gap: 6, borderColor: "hsl(var(--warning) / 0.4)", color: "hsl(var(--warning))" }}
            >
              <Trash2 size={13} />
              پاک کردن سوالات بدون واردات ({orphanStats?.orphanQuestions ?? 0})
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isPurging || !orphanStats || orphanStats.totalQuestions === 0}
              onClick={() => setPurgeAllConfirm(true)}
              style={{ gap: 6 }}
            >
              <Trash2 size={13} />
              پاک کردن همه سوالات QBank ({orphanStats?.totalQuestions ?? 0})
            </Button>
          </div>
          <p style={{ fontSize: 11, color: C.textMuted, marginTop: 10, marginBottom: 0 }}>
            این عملیات‌ها مستقل از تاریخچه واردات هستند و حتی اگر تاریخچه خالی باشد کار می‌کنند.
          </p>
        </div>
      </div>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={!!state.deleteTarget} onOpenChange={(open) => { if (!open) dispatch({ type: "SET_DELETE", target: null }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ color: "hsl(var(--danger))" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Trash2 size={18} /> حذف واردات و محتوای وارد شده
              </span>
            </DialogTitle>
            <DialogDescription>
              در حال حذف: {state.deleteTarget?.label}
            </DialogDescription>
          </DialogHeader>

          {/* Rich delete body — lives outside DialogDescription (which is a <p>) */}
          <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            {state.deleteTarget && (
              <div style={{ background: "hsl(var(--danger) / 0.05)", border: "1px solid hsl(var(--danger) / 0.15)", borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "hsl(var(--foreground))", display: "flex", flexDirection: "column", gap: 4 }}>
                  {state.deleteTarget.counts.questions > 0 && <span>• {state.deleteTarget.counts.questions} سوال MCQ</span>}
                  {state.deleteTarget.counts.examLinkedQuestions > 0 && (
                    <span style={{ color: "hsl(var(--warning))", fontWeight: 600 }}>
                      • {state.deleteTarget.counts.examLinkedQuestions} سوال مرتبط با آزمون
                    </span>
                  )}
                  {state.deleteTarget.counts.flashcards > 0 && <span>• {state.deleteTarget.counts.flashcards} فلش‌کارت</span>}
                  {state.deleteTarget.counts.chunks > 0 && <span>• {state.deleteTarget.counts.chunks} بخش جزوه</span>}
                  {state.deleteTarget.counts.noteDocuments > 0 && <span>• {state.deleteTarget.counts.noteDocuments} سند جزوه</span>}
                </div>
              </div>
            )}

            {/* Mode selector */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "10px 12px", borderRadius: 10, border: `2px solid ${state.deleteMode === "hard" ? "hsl(var(--danger))" : C.border}`, background: state.deleteMode === "hard" ? "hsl(var(--danger) / 0.05)" : "transparent" }}>
                <input type="radio" name="deleteMode" value="hard" checked={state.deleteMode === "hard"} onChange={() => dispatch({ type: "SET_DELETE_MODE", mode: "hard" })} style={{ marginTop: 2, accentColor: "hsl(var(--danger))" }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "hsl(var(--danger))" }}>حذف واردات و تمام محتوای وارد شده</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>سوالات آزمونی هم از QBank و آزمون‌ها حذف می‌شوند. برگشت‌پذیر نیست.</div>
                </div>
              </label>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "10px 12px", borderRadius: 10, border: `2px solid ${state.deleteMode === "detach" ? "hsl(var(--warning))" : C.border}`, background: state.deleteMode === "detach" ? "hsl(var(--warning) / 0.05)" : "transparent" }}>
                <input type="radio" name="deleteMode" value="detach" checked={state.deleteMode === "detach"} onChange={() => dispatch({ type: "SET_DELETE_MODE", mode: "detach" })} style={{ marginTop: 2, accentColor: "hsl(var(--warning))" }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "hsl(var(--warning))" }}>نگه داشتن تاریخچه آزمون / فقط جداسازی</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>سوالاتی که در آزمون استفاده شده‌اند در QBank باقی می‌مانند. سوالات بدون آزمون حذف می‌شوند.</div>
                </div>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => dispatch({ type: "SET_DELETE", target: null })}>انصراف</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              style={state.deleteMode === "detach" ? { background: "hsl(var(--warning))", borderColor: "hsl(var(--warning))" } : undefined}
            >
              {isDeleting
                ? "در حال حذف..."
                : state.deleteMode === "hard"
                  ? "حذف کامل واردات و محتوا"
                  : "جداسازی واردات (نگه داشتن آزمون)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Purge Orphan Confirm ── */}
      <Dialog open={purgeOrphanConfirm} onOpenChange={setPurgeOrphanConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>پاک کردن سوالات بدون واردات</DialogTitle>
            <DialogDescription>
              {orphanStats?.orphanQuestions ?? 0} سوال بدون پیوند به واردات از QBank حذف خواهند شد.
              لینک‌های آزمون آن‌ها نیز پاک می‌شوند. این عمل برگشت‌پذیر نیست.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurgeOrphanConfirm(false)}>انصراف</Button>
            <Button
              variant="destructive"
              disabled={isPurging}
              onClick={() => {
                setPurgeOrphanConfirm(false);
                startPurgeTransition(async () => {
                  const r = await purgeOrphanQuestionsAction();
                  if (r.success) {
                    toast.success(`${r.data.deleted.questions} سوال بدون واردات حذف شد · ${r.data.deleted.examSessionLinks} لینک آزمون پاک شد`);
                    await refreshHistory();
                    router.refresh();
                  } else {
                    toast.error(`خطا: ${r.error}`);
                  }
                });
              }}
            >
              {isPurging ? "در حال پاک‌سازی..." : "پاک کردن سوالات بدون واردات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Purge All Confirm ── */}
      <Dialog open={purgeAllConfirm} onOpenChange={setPurgeAllConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ color: "hsl(var(--danger))" }}>پاک کردن همه سوالات QBank</DialogTitle>
            <DialogDescription>
              <strong>همه {orphanStats?.totalQuestions ?? 0} سوال</strong> از QBank حذف خواهند شد،
              از جمله سوالاتی که در آزمون استفاده شده‌اند.
              تمام لینک‌های آزمون ({orphanStats?.examLinkedTotal ?? 0}) نیز پاک می‌شوند.
              این عمل کاملاً برگشت‌پذیر نیست.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurgeAllConfirm(false)}>انصراف</Button>
            <Button
              variant="destructive"
              disabled={isPurging}
              onClick={() => {
                setPurgeAllConfirm(false);
                startPurgeTransition(async () => {
                  const r = await purgeAllQuestionsAction();
                  if (r.success) {
                    toast.success(`${r.data.deleted.questions} سوال از QBank پاک شد · ${r.data.deleted.examSessionLinks} لینک آزمون پاک شد`);
                    await refreshHistory();
                    router.refresh();
                  } else {
                    toast.error(`خطا: ${r.error}`);
                  }
                });
              }}
            >
              {isPurging ? "در حال پاک‌سازی..." : "پاک کردن همه سوالات QBank"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Category Section
═══════════════════════════════════════════════════════════════ */

function CategorySection({
  cat, isActive, files, isUploading, selectedIds,
  onToggle, onFilesSelected, onRemoveFile, onClearFiles, onCommit, onPatchFile,
  onSelectAll, onDeselectAll, onToggleSelect, onRemoveSelected,
}: {
  cat: CategoryDef;
  isActive: boolean;
  files: FileEntry[];
  isUploading: boolean;
  selectedIds: Set<string>;
  onToggle: () => void;
  onFilesSelected: (files: File[]) => void;
  onRemoveFile: (id: string) => void;
  onClearFiles: () => void;
  onCommit: () => void;
  onPatchFile: (id: string, patch: Partial<FileEntry>) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onToggleSelect: (id: string) => void;
  onRemoveSelected: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const validCount = files.filter((f) => f.status === "valid" || f.status === "uploaded").length;
  const invalidCount = files.filter((f) => f.status === "invalid" || f.status === "error").length;
  const uploadedCount = files.filter((f) => f.status === "uploaded").length;
  const pendingCount = files.filter((f) => f.status === "validating" || f.status === "pending").length;
  const allSelected = files.length > 0 && files.every((f) => selectedIds.has(f.id));

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length > 0) onFilesSelected(dropped);
  };

  return (
    <div style={{ background: C.surface, borderRadius: 18, border: `1px solid ${isActive ? cat.color + "44" : C.border}`, overflow: "hidden", transition: "border-color 0.3s, box-shadow 0.3s", boxShadow: isActive ? `0 8px 32px ${cat.color}12` : `0 2px 8px ${C.text}04` }}>
      <button onClick={onToggle} className="cm-cat-btn" style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "18px 22px", background: isActive ? cat.gradient : "none", border: "none", cursor: "pointer", textAlign: "right", transition: "background 0.3s" }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: cat.colorBg, border: `1px solid ${cat.color}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "transform 0.2s" }}>
          <cat.icon size={20} color={cat.color} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{cat.label}</span>
            <span style={{ fontSize: 10, color: C.textMuted, background: C.surfaceSubtle, border: `1px solid ${C.border}`, borderRadius: 6, padding: "2px 8px", fontWeight: 500 }}>{cat.formats}</span>
          </div>
          <span style={{ fontSize: 11, color: C.textMuted, marginTop: 2, display: "block" }}>{cat.hint}</span>
        </div>
        {files.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {invalidCount > 0 && <Badge variant="destructive" style={{ fontSize: 10 }}>{invalidCount} خطا</Badge>}
            <Badge variant={invalidCount > 0 ? "warning" : "success"} style={{ fontSize: 10 }}>{files.length} فایل</Badge>
          </div>
        )}
        <ArrowUpRight className="cm-cat-arrow" size={16} color={cat.color} style={{ opacity: 0, transition: "opacity 0.2s, transform 0.2s", transform: "translateX(0)" }} />
        <motion.div animate={{ rotate: isActive ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} color={C.textMuted} />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isActive && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: "easeOut" }} style={{ overflow: "hidden" }}>
            <div style={{ padding: "0 22px 22px", borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
              {/* Drop zone */}
              <div className="cm-drop-zone" onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)} onDrop={handleDrop} onClick={() => inputRef.current?.click()} style={{ border: `2px dashed ${isDragOver ? cat.color : C.border}`, borderRadius: 16, padding: "32px 20px", textAlign: "center", cursor: "pointer", background: isDragOver ? `linear-gradient(135deg, ${cat.colorBg}, ${C.surface})` : C.surfaceSubtle, marginBottom: 18, position: "relative", overflow: "hidden" }}>
                {isDragOver && (
                  <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, transparent, ${cat.color}08, transparent)`, backgroundSize: "200% 100%", animation: "cm-shimmer 1.5s infinite", pointerEvents: "none" }} />
                )}
                <div style={{ width: 48, height: 48, borderRadius: 14, margin: "0 auto 12px", background: isDragOver ? cat.colorBg : C.bg, border: `1px solid ${isDragOver ? cat.color + "30" : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>
                  <Upload size={22} color={isDragOver ? cat.color : C.textMuted} style={{ transition: "color 0.2s" }} />
                </div>
                <p style={{ fontSize: 14, color: C.text, fontWeight: 600, margin: "0 0 4px", position: "relative" }}>فایل‌ها را اینجا رها کنید یا کلیک کنید</p>
                <p style={{ fontSize: 12, color: C.textMuted, margin: 0, position: "relative" }}>فرمت پشتیبانی: {cat.formats} &middot; {cat.accept}</p>
                <input ref={inputRef} type="file" accept={cat.accept} multiple style={{ display: "none" }} onChange={(e) => { const f = Array.from(e.target.files ?? []); if (f.length > 0) onFilesSelected(f); e.target.value = ""; }} />
              </div>

              {/* Validation summary */}
              {files.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "10px 14px", borderRadius: 12, background: C.surfaceSubtle, border: `1px solid ${C.border}`, fontSize: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: invalidCount > 0 ? C.danger : C.success, flexShrink: 0, animation: pendingCount > 0 ? "cm-pulse-ring 1.5s infinite" : "none" }} />
                  <span style={{ color: C.success, fontWeight: 600 }}>{validCount} معتبر</span>
                  {invalidCount > 0 && <span style={{ color: C.danger, fontWeight: 600 }}>{invalidCount} نامعتبر</span>}
                  {pendingCount > 0 && <span style={{ color: C.textMuted }}>{pendingCount} در انتظار</span>}
                  {uploadedCount > 0 && <span style={{ color: C.accent, fontWeight: 600 }}>{uploadedCount} وارد شده</span>}
                  <span style={{ marginRight: "auto" }} />
                  <button onClick={allSelected ? onDeselectAll : onSelectAll} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "4px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.textMuted, fontWeight: 500 }}>
                    {allSelected ? <><CheckSquare size={12} /> لغو انتخاب</> : <><Square size={12} /> انتخاب همه</>}
                  </button>
                  {selectedIds.size > 0 && (
                    <button onClick={onRemoveSelected} style={{ background: "none", border: `1px solid ${C.danger}40`, borderRadius: 8, padding: "4px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.danger, fontWeight: 500 }}>
                      <Trash2 size={11} /> حذف {selectedIds.size} فایل
                    </button>
                  )}
                </div>
              )}

              {/* File list */}
              {files.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                  {files.map((entry) => (
                    <FileRow key={entry.id} entry={entry} catKey={cat.key} catColor={cat.color} isSelected={selectedIds.has(entry.id)} onToggleSelect={() => onToggleSelect(entry.id)} onRemove={() => onRemoveFile(entry.id)} onPatch={(patch) => onPatchFile(entry.id, patch)} />
                  ))}
                </div>
              )}

              {/* Action bar */}
              {files.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "14px 16px", borderRadius: 14, background: `linear-gradient(135deg, ${cat.colorBg}, ${C.surfaceSubtle})`, border: `1px solid ${cat.color}15` }}>
                  <Button onClick={onCommit} disabled={validCount === 0 || isUploading || uploadedCount === validCount} style={{ background: cat.color, borderColor: cat.color, gap: 6 }}>
                    <Plus size={14} />
                    {isUploading ? "در حال وارد کردن..." : `وارد کردن ${validCount} فایل معتبر`}
                  </Button>
                  <Button variant="outline" onClick={onClearFiles} disabled={isUploading} style={{ gap: 6 }}>
                    <X size={14} /> پاک کردن همه
                  </Button>
                  {invalidCount > 0 && (
                    <span style={{ fontSize: 12, color: C.danger, display: "flex", alignItems: "center", gap: 5 }}>
                      <AlertTriangle size={13} /> {invalidCount} فایل نامعتبر
                    </span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   File Row
═══════════════════════════════════════════════════════════════ */

function parseFileMeta(name: string): { chapterNo: number | null; segmentIdx: number | null } {
  const base = name.replace(/\.[^.]+$/, "");
  let chapterNo: number | null = null;
  let segmentIdx: number | null = null;

  const chSegMatch = base.match(/^(?:ch(?:apter)?[_-]?)?(\d{1,3})[_-](\d{1,3})(?=[_-]|$)/i);
  if (chSegMatch) {
    const chN = parseInt(chSegMatch[1], 10);
    const segN = parseInt(chSegMatch[2], 10);
    if (chN > 0 && chN <= 244) chapterNo = chN;
    if (segN >= 0 && segN <= 999) segmentIdx = segN;
  }
  if (chapterNo == null) {
    const chMatch = base.match(/(?:ch(?:apter)?[_-]?)(\d{1,3})/i);
    const trailMatch = base.match(/[_-](\d{1,3})(?:[_-]|$)/);
    const leadMatch = base.match(/^(\d{1,3})[_-]/);
    const chStr = chMatch?.[1] ?? trailMatch?.[1] ?? leadMatch?.[1];
    if (chStr) { const n = parseInt(chStr, 10); if (n > 0 && n <= 244) chapterNo = n; }
  }
  if (segmentIdx == null) {
    const segMatch = base.match(/seg[_-]?(\d{1,3})/i);
    if (segMatch) segmentIdx = parseInt(segMatch[1], 10);
  }
  return { chapterNo, segmentIdx };
}

const DETECTED_KIND_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  note_v7_5: { label: "NOTE v7.5", color: "hsl(var(--success))", bg: "hsl(var(--success) / 0.06)" },
  yield_v2: { label: "YIELD v2.0", color: "hsl(var(--warning))", bg: "hsl(var(--warning) / 0.06)" },
  yield_v1: { label: "YIELD v1.0", color: "hsl(var(--warning))", bg: "hsl(var(--warning) / 0.08)" },
  questions: { label: "MCQ", color: "hsl(var(--primary))", bg: "hsl(var(--primary) / 0.06)" },
  flashcards: { label: "Flashcard", color: "hsl(var(--info))", bg: "hsl(var(--info) / 0.06)" },
  unknown: { label: "Legacy", color: "hsl(var(--muted-foreground))", bg: "hsl(var(--muted-foreground) / 0.06)" },
};

function FileRow({ entry, catKey, catColor, isSelected, onToggleSelect, onRemove, onPatch }: {
  entry: FileEntry;
  catKey: ContentType;
  catColor: string;
  isSelected: boolean;
  onToggleSelect: () => void;
  onRemove: () => void;
  onPatch: (patch: Partial<FileEntry>) => void;
}) {
  const [showErrors, setShowErrors] = useState(false);
  if (!entry || !entry.file) return null;

  const v = entry.validation;
  const autoMeta = parseFileMeta(entry.file.name);
  const chapterNo = entry.manualChapter !== undefined ? entry.manualChapter : autoMeta.chapterNo;
  const segmentIdx = entry.manualSegment !== undefined ? entry.manualSegment : autoMeta.segmentIdx;
  const detectedKind = v?.detectedKind;
  const schemaVersion = v?.schemaVersion;
  const kindStyle = detectedKind ? DETECTED_KIND_LABELS[detectedKind] ?? DETECTED_KIND_LABELS.unknown : null;

  const statusIcon = {
    pending: <Clock size={14} color={C.textMuted} />,
    validating: <RefreshCw size={14} color={C.accent} style={{ animation: "spin 1s linear infinite" }} />,
    valid: <CheckCircle2 size={14} color={C.success} />,
    invalid: <XCircle size={14} color={C.danger} />,
    uploading: <RefreshCw size={14} color={C.accent} style={{ animation: "spin 1s linear infinite" }} />,
    uploaded: <CheckCircle2 size={14} color={C.success} />,
    error: <XCircle size={14} color={C.danger} />,
  }[entry.status];

  const statusLabel = {
    pending: "در انتظار",
    validating: "اعتبارسنجی...",
    valid: v ? `${v.itemCount} مورد معتبر` : "معتبر",
    invalid: "نامعتبر",
    uploading: "در حال ارسال...",
    uploaded: "وارد شد",
    error: entry.errorMsg ?? "خطا",
  }[entry.status];

  return (
    <div className="cm-file-row" style={{ background: isSelected ? "hsl(var(--info) / 0.05)" : C.surfaceSubtle, borderRadius: 12, padding: "10px 14px", border: isSelected ? `1px solid hsl(var(--info) / 0.2)` : `1px solid ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input type="checkbox" checked={isSelected} onChange={onToggleSelect} style={{ width: 15, height: 15, cursor: "pointer", flexShrink: 0, accentColor: C.accent, borderRadius: 4 }} />
        <div style={{ width: 30, height: 30, borderRadius: 8, background: entry.status === "uploaded" ? `${C.success}10` : entry.status === "error" || entry.status === "invalid" ? `${C.danger}10` : C.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <FileText size={14} color={entry.status === "uploaded" ? C.success : entry.status === "error" || entry.status === "invalid" ? C.danger : C.textMuted} />
        </div>
        <span style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.file.name}</span>

        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          {kindStyle && <span style={{ fontSize: 9, fontWeight: 700, color: kindStyle.color, background: kindStyle.bg, borderRadius: 6, padding: "2px 8px", whiteSpace: "nowrap" }}>{kindStyle.label}</span>}
          {schemaVersion && schemaVersion !== "legacy" && schemaVersion !== "html" && <span style={{ fontSize: 9, fontWeight: 600, color: C.textSoft, background: C.surfaceSubtle, border: `1px solid ${C.border}`, borderRadius: 6, padding: "2px 7px", whiteSpace: "nowrap" }}>v{schemaVersion}</span>}
          <span style={{ fontSize: 10, color: C.textMuted, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{(entry.file.size / 1024).toFixed(1)} KB</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          {statusIcon}
          <span style={{ fontSize: 11, whiteSpace: "nowrap", fontWeight: 500, color: entry.status === "valid" || entry.status === "uploaded" ? C.success : entry.status === "invalid" || entry.status === "error" ? C.danger : C.textMuted }}>{statusLabel}</span>
        </div>

        {v && v.errors.length > 0 && (
          <button onClick={() => setShowErrors(!showErrors)} style={{ background: `${C.danger}08`, border: `1px solid ${C.danger}20`, borderRadius: 6, cursor: "pointer", fontSize: 10, color: C.danger, padding: "2px 8px", whiteSpace: "nowrap", fontWeight: 500 }}>
            {showErrors ? "بستن" : `${v.errors.length} خطا`}
          </button>
        )}
        <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex", alignItems: "center" }}>
          <X size={13} color={C.textMuted} />
        </button>
      </div>

      {/* Chapter / Segment row */}
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, fontSize: 11 }}>
        <span style={{ color: C.textMuted, flexShrink: 0, fontWeight: 500 }}>فصل:</span>
        <input type="number" min={0} max={244} placeholder="—" value={chapterNo ?? ""} onChange={(e) => onPatch({ manualChapter: e.target.value ? parseInt(e.target.value, 10) : null })} style={{ width: 58, padding: "4px 8px", borderRadius: 8, fontSize: 12, fontWeight: 700, textAlign: "center", color: "hsl(var(--primary))", background: "hsl(var(--primary) / 0.06)", border: "1px solid hsl(var(--primary) / 0.15)", outline: "none" }} />
        <span style={{ color: C.textMuted, flexShrink: 0, fontWeight: 500 }}>بخش:</span>
        <input type="number" min={0} max={99} placeholder="—" value={segmentIdx ?? ""} onChange={(e) => onPatch({ manualSegment: e.target.value ? parseInt(e.target.value, 10) : null })} style={{ width: 50, padding: "4px 8px", borderRadius: 8, fontSize: 12, fontWeight: 700, textAlign: "center", color: "hsl(var(--info))", background: "hsl(var(--info) / 0.06)", border: "1px solid hsl(var(--info) / 0.15)", outline: "none" }} />
        {autoMeta.chapterNo || autoMeta.segmentIdx != null ? (
          <span style={{ color: C.textMuted, fontSize: 10 }}>(خودکار: {autoMeta.chapterNo ? `Ch.${autoMeta.chapterNo}` : ""}{autoMeta.segmentIdx != null ? ` Seg.${autoMeta.segmentIdx}` : ""})</span>
        ) : (
          <span style={{ color: C.warning, fontSize: 10, display: "flex", alignItems: "center", gap: 3 }}><AlertTriangle size={10} /> لطفا فصل و بخش را وارد کنید</span>
        )}
      </div>

      {showErrors && v && v.errors.length > 0 && (
        <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 10, background: "hsl(var(--danger) / 0.04)", border: "1px solid hsl(var(--danger) / 0.1)", fontSize: 11, color: C.danger, lineHeight: 1.7 }}>
          {v.errors.slice(0, 10).map((e, i) => <div key={i}>&#x2022; {e.message}</div>)}
          {v.errors.length > 10 && <div style={{ opacity: 0.7 }}>... و {v.errors.length - 10} خطای دیگر</div>}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   History Row
═══════════════════════════════════════════════════════════════ */

const CONTENT_TYPE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  notes: { label: "جزوه", color: "hsl(var(--success))", bg: "hsl(var(--success) / 0.06)" },
  questions: { label: "MCQ", color: "hsl(var(--primary))", bg: "hsl(var(--primary) / 0.06)" },
  flashcards: { label: "فلش‌کارت", color: "hsl(var(--info))", bg: "hsl(var(--info) / 0.06)" },
  yield: { label: "Yield", color: "hsl(var(--warning))", bg: "hsl(var(--warning) / 0.06)" },
  batch: { label: "دسته‌ای", color: "hsl(var(--muted-foreground))", bg: "hsl(var(--muted-foreground) / 0.06)" },
  mixed: { label: "ترکیبی", color: "hsl(var(--muted-foreground))", bg: "hsl(var(--muted-foreground) / 0.06)" },
};

const STATUS_LABEL: Record<string, { label: string; dotColor: string }> = {
  completed: { label: "موفق", dotColor: "hsl(var(--success))" },
  running: { label: "در حال اجرا", dotColor: "hsl(var(--primary))" },
  failed: { label: "ناموفق", dotColor: "hsl(var(--danger))" },
  pending: { label: "در انتظار", dotColor: "hsl(var(--muted-foreground))" },
};

function HistoryRow({ imp, isSelected, isLast, onToggleSelect, onDelete }: {
  imp: ImportHistoryEntry;
  isSelected: boolean;
  isLast: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
}) {
  const typeBadge = CONTENT_TYPE_BADGE[imp.contentType ?? "mixed"] ?? CONTENT_TYPE_BADGE.mixed;
  const statusInfo = STATUS_LABEL[imp.status ?? "pending"] ?? STATUS_LABEL.pending;

  // Prefer server-derived chapter/segment; fall back to client filename parse
  const clientMeta = parseFileMeta(imp.fileName ?? imp.sourceName ?? "");
  const chapterNo = imp.chapterNo ?? clientMeta.chapterNo;
  const segmentNo = imp.segmentNo ?? clientMeta.segmentIdx;

  // Build count chips
  const countChips: { label: string; color: string; bg: string }[] = [];
  if (imp.questionCount > 0)
    countChips.push({ label: `${imp.questionCount} MCQ`, color: "hsl(var(--primary))", bg: "hsl(var(--primary) / 0.07)" });
  if (imp.flashcardCount > 0)
    countChips.push({ label: `${imp.flashcardCount} کارت`, color: "hsl(var(--info))", bg: "hsl(var(--info) / 0.07)" });
  if (imp.noteDocumentCount > 0)
    countChips.push({ label: `${imp.noteDocumentCount} سند`, color: "hsl(var(--success))", bg: "hsl(var(--success) / 0.07)" });
  if (imp.chunkCount > 0)
    countChips.push({ label: `${imp.chunkCount} بخش`, color: "hsl(var(--muted-foreground))", bg: "hsl(var(--muted-foreground) / 0.07)" });

  return (
    <div
      className="cm-history-row"
      style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 22px", borderBottom: isLast ? "none" : `1px solid ${C.border}`, fontSize: 13, background: isSelected ? "hsl(var(--info) / 0.04)" : "transparent", transition: "background 0.15s", cursor: "default" }}
    >
      <input type="checkbox" checked={isSelected} onChange={onToggleSelect} style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0, accentColor: C.accent }} />

      <div style={{ width: 10, height: 10, borderRadius: "50%", background: statusInfo.dotColor, flexShrink: 0, boxShadow: `0 0 6px ${statusInfo.dotColor}40` }} title={statusInfo.label} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Title row */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
            {imp.fileName ?? imp.sourceName ?? "—"}
          </span>

          {/* Content type badge */}
          <span style={{ fontSize: 9, fontWeight: 700, color: typeBadge.color, background: typeBadge.bg, borderRadius: 6, padding: "2px 8px", whiteSpace: "nowrap", flexShrink: 0 }}>
            {typeBadge.label}
          </span>

          {/* Schema version */}
          {imp.schemaVersion && imp.schemaVersion !== "dna-v3.1" && (
            <span style={{ fontSize: 9, fontWeight: 600, color: C.textSoft, background: C.surfaceSubtle, border: `1px solid ${C.border}`, borderRadius: 6, padding: "2px 7px", whiteSpace: "nowrap", flexShrink: 0 }}>
              {imp.schemaVersion}
            </span>
          )}

          {/* Chapter chip */}
          {chapterNo != null && (
            <span style={{ fontSize: 9, fontWeight: 700, color: "hsl(var(--primary))", background: "hsl(var(--primary) / 0.06)", borderRadius: 5, padding: "1px 7px", whiteSpace: "nowrap", flexShrink: 0 }}>
              فصل {chapterNo}
            </span>
          )}

          {/* Segment chip */}
          {segmentNo != null && (
            <span style={{ fontSize: 9, fontWeight: 700, color: "hsl(var(--info))", background: "hsl(var(--info) / 0.06)", borderRadius: 5, padding: "1px 7px", whiteSpace: "nowrap", flexShrink: 0 }}>
              بخش {String(segmentNo).padStart(2, "0")}
            </span>
          )}
        </div>

        {/* Count chips + date row */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
          {countChips.map((chip) => (
            <span key={chip.label} style={{ fontSize: 10, fontWeight: 600, color: chip.color, background: chip.bg, borderRadius: 6, padding: "1px 7px", whiteSpace: "nowrap" }}>
              {chip.label}
            </span>
          ))}
          {countChips.length === 0 && imp.itemCount > 0 && (
            <span style={{ fontSize: 10, color: C.textMuted, fontVariantNumeric: "tabular-nums" }}>{imp.itemCount} مورد</span>
          )}
          {imp.createdAt ? (
            <span style={{ fontSize: 10, color: C.textMuted, display: "flex", alignItems: "center", gap: 3, marginRight: "auto" }}>
              <Clock size={9} />
              {new Date(imp.createdAt).toLocaleDateString("fa-IR")}
            </span>
          ) : null}
          {imp.status === "failed" && imp.errorMessage && (
            <span style={{ color: C.danger, fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }} title={imp.errorMessage}>
              {imp.errorMessage}
            </span>
          )}
        </div>
      </div>

      {(imp.examLinkedQuestionCount ?? 0) > 0 && (
        <Badge variant="warning" style={{ fontSize: 10, flexShrink: 0 }}>{imp.examLinkedQuestionCount} آزمونی</Badge>
      )}

      <button
        onClick={onDelete}
        style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer", padding: 7, display: "flex", alignItems: "center", justifyContent: "center", transition: "border-color 0.15s, background 0.15s", flexShrink: 0 }}
        title="حذف واردات و محتوا"
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.danger; e.currentTarget.style.background = `${C.danger}08`; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = "none"; }}
      >
        <Trash2 size={14} color={C.danger} />
      </button>
    </div>
  );
}
