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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Types & State
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

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
    label: "Ø³ÙˆØ§Ù„Ø§Øª (MCQ)",
    icon: HelpCircle,
    color: "hsl(var(--primary))",
    colorBg: "hsl(var(--primary) / 0.06)",
    gradient: "linear-gradient(135deg, hsl(var(--primary) / 0.08), hsl(var(--primary) / 0.02))",
    accept: ".json",
    hint: 'ÙØ§ÛŒÙ„ JSON Ø¨Ø§ Ø³Ø§Ø®ØªØ§Ø± { "questions": [...] }',
    formats: "JSON",
  },
  {
    key: "flashcards",
    label: "ÙÙ„Ø´â€ŒÚ©Ø§Ø±Øªâ€ŒÙ‡Ø§",
    icon: Layers,
    color: "hsl(var(--info))",
    colorBg: "hsl(var(--info) / 0.06)",
    gradient: "linear-gradient(135deg, hsl(var(--info) / 0.08), hsl(var(--info) / 0.02))",
    accept: ".json",
    hint: 'ÙØ§ÛŒÙ„ JSON Ø¨Ø§ Ø³Ø§Ø®ØªØ§Ø± { "flashcards": [...] }',
    formats: "JSON",
  },
  {
    key: "notes",
    label: "Ø¬Ø²ÙˆØ§Øª",
    icon: BookOpen,
    color: "hsl(var(--success))",
    colorBg: "hsl(var(--success) / 0.06)",
    gradient: "linear-gradient(135deg, hsl(var(--success) / 0.08), hsl(var(--success) / 0.02))",
    accept: ".html,.htm,.json",
    hint: "NOTE v7.5 JSON (Ø¨Ù„ÙˆÚ©â€ŒÙ…Ø­ÙˆØ±) ÛŒØ§ HTML Ù…Ø¹Ù†Ø§ÛŒÛŒ (<section>, <h2>, ...)",
    formats: "HTML / JSON v7.5",
  },
  {
    key: "yield",
    label: "Ú©Ø§Ø±Øªâ€ŒÙ‡Ø§ÛŒ Yield",
    icon: Zap,
    color: "hsl(var(--warning))",
    colorBg: "hsl(var(--warning) / 0.06)",
    gradient: "linear-gradient(135deg, hsl(var(--warning) / 0.08), hsl(var(--warning) / 0.02))",
    accept: ".json",
    hint: 'YIELD v2.0 (annotations) ÛŒØ§ v1.0 ({ "cards": [...] })',
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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Props
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

interface Props {
  stats: ContentStats;
  history: ImportHistoryEntry[];
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Helpers
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Main Component
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

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
          patch: { status: "error", errorMsg: "Ø®Ø·Ø§ Ø¯Ø± Ø®ÙˆØ§Ù†Ø¯Ù† ÙØ§ÛŒÙ„" },
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
          patch: { status: "error", errorMsg: err instanceof Error ? err.message : "Ø®Ø·Ø§ÛŒ Ù†Ø§Ø´Ù†Ø§Ø®ØªÙ‡" },
        });
      }
    }

    setIsUploading(false);
    if (successCount > 0) {
      toast.success(`${totalInserted} Ù…ÙˆØ±Ø¯ Ø§Ø² ${successCount} ÙØ§ÛŒÙ„ ÙˆØ§Ø±Ø¯ Ø´Ø¯`);
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
          const parts = [`${importIds.length - failed} ÙˆØ§Ø±Ø¯Ø§Øª Ø­Ø°Ù Ø´Ø¯`];
          if (totalQuestions > 0) parts.push(`${totalQuestions} Ø³ÙˆØ§Ù„`);
          if (totalExamLinks > 0) parts.push(`${totalExamLinks} Ù„ÛŒÙ†Ú© Ø¢Ø²Ù…ÙˆÙ†`);
          toast.success(parts.join(" Â· "));
        } else {
          toast.error("Ø®Ø·Ø§ Ø¯Ø± Ø­Ø°Ù");
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
          toast.success(`${detached} ÙˆØ§Ø±Ø¯Ø§Øª Ø¬Ø¯Ø§ Ø´Ø¯ â€” Ø³ÙˆØ§Ù„Ø§Øª Ø¢Ø²Ù…ÙˆÙ†ÛŒ Ø¯Ø± QBank Ø¨Ø§Ù‚ÛŒ Ù…Ø§Ù†Ø¯Ù†Ø¯`);
        } else {
          toast.error("Ø®Ø·Ø§ Ø¯Ø± Ø¬Ø¯Ø§Ø³Ø§Ø²ÛŒ");
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

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• Hero Header â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
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
              <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: 0, letterSpacing: "-0.02em" }}>Ù…Ø¯ÛŒØ±ÛŒØª Ù…Ø­ØªÙˆØ§</h1>
              <p style={{ fontSize: 13, color: C.textMuted, margin: "2px 0 0", lineHeight: 1.5 }}>ÙˆØ§Ø±Ø¯ Ú©Ø±Ø¯Ù†ØŒ Ø§Ø¹ØªØ¨Ø§Ø±Ø³Ù†Ø¬ÛŒ Ùˆ Ù…Ø¯ÛŒØ±ÛŒØª Ø¬Ø²ÙˆØ§ØªØŒ Ø³ÙˆØ§Ù„Ø§Øª Ùˆ ÙÙ„Ø´â€ŒÚ©Ø§Ø±Øªâ€ŒÙ‡Ø§</p>
            </div>
            <div style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, boxShadow: `0 2px 8px ${C.text}06` }}>
                <Sparkles size={14} color={C.accent} />
                <span style={{ fontSize: 18, fontWeight: 800, color: C.text, fontVariantNumeric: "tabular-nums" }}>{totalStats.toLocaleString("fa-IR")}</span>
                <span style={{ fontSize: 11, color: C.textMuted }}>Ù…ÙˆØ±Ø¯ Ú©Ù„</span>
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
                      <span>Ø¢Ø®Ø±ÛŒÙ†: {new Date(s.lastImportedAt).toLocaleDateString("fa-IR")}</span>
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
                  ? `QBank Ø´Ø§Ù…Ù„ ${orphanStats.orphanQuestions} Ø³ÙˆØ§Ù„ Ø¨Ø¯ÙˆÙ† Ù¾ÛŒÙˆÙ†Ø¯ Ø¨Ù‡ ÙˆØ§Ø±Ø¯Ø§Øª Ø§Ø³Øª`
                  : `QBank: ${totalQBankQuestions} Ø³ÙˆØ§Ù„`}
              </span>
              <span style={{ fontSize: 11, color: C.textMuted }}>
                {orphanStats.linkedQuestions} Ù¾ÛŒÙˆÙ†Ø¯ Â· {orphanStats.examLinkedTotal} Ù„ÛŒÙ†Ú© Ø¢Ø²Ù…ÙˆÙ†
              </span>
            </div>
          )}
        </div>
      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• Body â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "28px 32px 48px" }}>

        {/* â”€â”€ Category Sections â”€â”€ */}
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

        <Link
          href="/import/outliner"
          style={{
            background: C.surface,
            borderRadius: 18,
            border: `1px solid ${C.border}`,
            overflow: "hidden",
            marginBottom: 14,
            boxShadow: `0 2px 8px ${C.text}04`,
            padding: "16px 22px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            textDecoration: "none",
          }}
        >
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, rgba(15,118,110,0.15), rgba(15,118,110,0.06))", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Upload size={16} color="#0f766e" />
          </div>
          <div style={{ flex: 1, textAlign: "right" }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Outliner — الگوریتم‌های تصویری</span>
            <span style={{ fontSize: 11, color: C.textMuted, display: "block", marginTop: 1 }}>
              ایمپورت فایل‌های Algorithm IR برای نمایش الگوریتم‌های Outliner
            </span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", color: C.textMuted, fontSize: 11 }}>
            <span style={{ border: `1px solid ${C.border}`, borderRadius: 999, padding: "4px 8px" }}>.json</span>
            <span style={{ border: `1px solid ${C.border}`, borderRadius: 999, padding: "4px 8px" }}>.zip</span>
            <ArrowUpRight size={14} />
          </div>
        </Link>
        {/* â”€â”€ Edge Import â”€â”€ */}
        <div style={{ background: C.surface, borderRadius: 18, border: `1px solid ${showEdgeImport ? C.accentBorder : C.border}`, overflow: "hidden", marginBottom: 14, boxShadow: showEdgeImport ? `0 8px 32px ${C.accent}10` : `0 2px 8px ${C.text}04`, transition: "border-color 0.3s, box-shadow 0.3s" }}>
          <button onClick={() => setShowEdgeImport((v) => !v)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "16px 22px", display: "flex", alignItems: "center", gap: 12, textAlign: "right" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${C.accent}15, ${C.accent}08)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Zap size={16} color={C.accent} />
            </div>
            <div style={{ flex: 1, textAlign: "right" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>ÙˆØ§Ø±Ø¯Ø§Øª Ø³Ø±ÛŒØ¹ Edge (V3)</span>
              <span style={{ fontSize: 11, color: C.textMuted, display: "block", marginTop: 1 }}>Ø§Ø³ØªØ±ÛŒÙ… ÙØ§ÛŒÙ„â€ŒÙ‡Ø§ÛŒ Ø¨Ø²Ø±Ú¯ Ø¨Ø§ Ù…ÙˆØªÙˆØ± WASM Ù…Ø³ØªÙ‚ÛŒÙ… Ø¨Ù‡ OPFS Ù…Ø±ÙˆØ±Ú¯Ø±</span>
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

        {/* â”€â”€ Media / Chapter Images â”€â”€ */}
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
              <span style={{ fontSize: 15, fontWeight: 700, color: C.text, display: "block" }}>ØªØµØ§ÙˆÛŒØ± ÙØµÙ„ / Ø±Ø³Ø§Ù†Ù‡</span>
              <span style={{ fontSize: 11, color: C.textMuted, display: "block", marginTop: 2 }}>
                ÙˆØ§Ø±Ø¯ Ú©Ø±Ø¯Ù† ØªØµØ§ÙˆÛŒØ± Ùˆ Ø¨Ø§Ù†Ø¯Ù„ Ø±Ø³Ø§Ù†Ù‡â€ŒØ§ÛŒ ÙØµÙ„â€ŒÙ‡Ø§ÛŒ Campbell Â· Ù…Ø¯ÛŒØ±ÛŒØª Ø±Ø¬ÛŒØ³ØªØ±ÛŒ Ø±Ø³Ø§Ù†Ù‡ Ù…ÙˆØ±Ø¯ Ø§Ø³ØªÙØ§Ø¯Ù‡ Ø¯Ø± Reader
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

        {/* â”€â”€ Import History â”€â”€ */}
        <div style={{ background: C.surface, borderRadius: 18, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: `0 4px 20px ${C.text}04` }}>
          <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}`, background: `linear-gradient(180deg, ${C.surface}, ${C.surfaceSubtle})` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${C.accent}12, ${C.accent}06)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Clock size={15} color={C.accent} />
                </div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>ØªØ§Ø±ÛŒØ®Ú†Ù‡ ÙˆØ§Ø±Ø¯Ø§Øª</h2>
                <span style={{ fontSize: 11, color: C.textMuted, background: C.surfaceSubtle, border: `1px solid ${C.border}`, borderRadius: 8, padding: "3px 10px", fontVariantNumeric: "tabular-nums" }}>
                  {filteredHistory.length}/{history.length}
                </span>
                {selectedHistoryIds.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => openDeleteDialog([...selectedHistoryIds], `${selectedHistoryIds.size} ÙˆØ§Ø±Ø¯Ø§Øª Ø§Ù†ØªØ®Ø§Ø¨ Ø´Ø¯Ù‡`)}
                    style={{ gap: 4 }}
                  >
                    <Trash2 size={12} /> Ø­Ø°Ù {selectedHistoryIds.size} ÙˆØ§Ø±Ø¯Ø§Øª Ùˆ Ù…Ø­ØªÙˆØ§
                  </Button>
                )}
              </div>
              <button onClick={refreshHistory} style={{ background: C.surfaceSubtle, border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer", color: C.textMuted, display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 14px", fontWeight: 500 }}>
                <RefreshCw size={12} /> Ø¨Ø±ÙˆØ²Ø±Ø³Ø§Ù†ÛŒ
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
                  placeholder="Ø¬Ø³ØªØ¬ÙˆÛŒ Ù†Ø§Ù… ÙØ§ÛŒÙ„ØŒ Ù†ÙˆØ¹ØŒ ÙØµÙ„..."
                  style={{ width: "100%", height: 38, paddingRight: 14, paddingLeft: 36, borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 13, outline: "none", background: C.surface, color: C.text, transition: "border-color 0.2s, box-shadow 0.2s" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.boxShadow = `0 0 0 3px ${C.accent}15`; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = "none"; }}
                />
              </div>
              <select value={historyStatusFilter} onChange={(e) => setHistoryStatusFilter(e.target.value)} style={{ height: 38, borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 13, padding: "0 12px", background: C.surface, color: C.text }}>
                <option value="all">Ù‡Ù…Ù‡ ÙˆØ¶Ø¹ÛŒØªâ€ŒÙ‡Ø§</option>
                <option value="completed">Ù…ÙˆÙÙ‚</option>
                <option value="running">Ø¯Ø± Ø­Ø§Ù„ Ø§Ø¬Ø±Ø§</option>
                <option value="failed">Ù†Ø§Ù…ÙˆÙÙ‚</option>
                <option value="pending">Ø¯Ø± Ø§Ù†ØªØ¸Ø§Ø±</option>
              </select>
              <select value={historyTypeFilter} onChange={(e) => setHistoryTypeFilter(e.target.value)} style={{ height: 38, borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 13, padding: "0 12px", background: C.surface, color: C.text }}>
                <option value="all">Ù‡Ù…Ù‡ Ø§Ù†ÙˆØ§Ø¹</option>
                <option value="notes">Ø¬Ø²ÙˆØ§Øª</option>
                <option value="questions">Ø³ÙˆØ§Ù„Ø§Øª</option>
                <option value="flashcards">ÙÙ„Ø´â€ŒÚ©Ø§Ø±Øª</option>
                <option value="yield">Yield</option>
                <option value="batch">Ø¯Ø³ØªÙ‡â€ŒØ§ÛŒ</option>
              </select>
              {filteredHistory.length > 0 && (
                <button onClick={toggleAllHistory} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "0 14px", height: 38, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textMuted, fontWeight: 500 }}>
                  {filteredHistory.every((imp) => selectedHistoryIds.has(imp.id))
                    ? <><CheckSquare size={13} /> Ù„ØºÙˆ Ø§Ù†ØªØ®Ø§Ø¨ Ù‡Ù…Ù‡</>
                    : <><Square size={13} /> Ø§Ù†ØªØ®Ø§Ø¨ Ù‡Ù…Ù‡</>}
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
              {history.length === 0 ? "Ù‡Ù†ÙˆØ² Ù…Ø­ØªÙˆØ§ÛŒÛŒ ÙˆØ§Ø±Ø¯ Ù†Ø´Ø¯Ù‡ Ø§Ø³Øª" : "Ù†ØªÛŒØ¬Ù‡â€ŒØ§ÛŒ ÛŒØ§ÙØª Ù†Ø´Ø¯"}
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

        {/* â”€â”€ QBank Purge Panel â”€â”€ */}
        <div style={{ marginTop: 14, background: C.surface, borderRadius: 18, border: `1px solid ${C.border}`, padding: "18px 22px", boxShadow: `0 2px 8px ${C.text}04` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <ShieldAlert size={16} color="hsl(var(--danger))" />
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Ø¹Ù…Ù„ÛŒØ§Øª Ù¾Ø§Ú©â€ŒØ³Ø§Ø²ÛŒ QBank</span>
            {orphanStats && (
              <span style={{ fontSize: 11, color: C.textMuted }}>
                Ú©Ù„ Ø³ÙˆØ§Ù„Ø§Øª: {orphanStats.totalQuestions} Â· Ø¨Ø¯ÙˆÙ† ÙˆØ§Ø±Ø¯Ø§Øª: {orphanStats.orphanQuestions}
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
              Ù¾Ø§Ú© Ú©Ø±Ø¯Ù† Ø³ÙˆØ§Ù„Ø§Øª Ø¨Ø¯ÙˆÙ† ÙˆØ§Ø±Ø¯Ø§Øª ({orphanStats?.orphanQuestions ?? 0})
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isPurging || !orphanStats || orphanStats.totalQuestions === 0}
              onClick={() => setPurgeAllConfirm(true)}
              style={{ gap: 6 }}
            >
              <Trash2 size={13} />
              Ù¾Ø§Ú© Ú©Ø±Ø¯Ù† Ù‡Ù…Ù‡ Ø³ÙˆØ§Ù„Ø§Øª QBank ({orphanStats?.totalQuestions ?? 0})
            </Button>
          </div>
          <p style={{ fontSize: 11, color: C.textMuted, marginTop: 10, marginBottom: 0 }}>
            Ø§ÛŒÙ† Ø¹Ù…Ù„ÛŒØ§Øªâ€ŒÙ‡Ø§ Ù…Ø³ØªÙ‚Ù„ Ø§Ø² ØªØ§Ø±ÛŒØ®Ú†Ù‡ ÙˆØ§Ø±Ø¯Ø§Øª Ù‡Ø³ØªÙ†Ø¯ Ùˆ Ø­ØªÛŒ Ø§Ú¯Ø± ØªØ§Ø±ÛŒØ®Ú†Ù‡ Ø®Ø§Ù„ÛŒ Ø¨Ø§Ø´Ø¯ Ú©Ø§Ø± Ù…ÛŒâ€ŒÚ©Ù†Ù†Ø¯.
          </p>
        </div>
      </div>

      {/* â”€â”€ Delete Confirmation Dialog â”€â”€ */}
      <Dialog open={!!state.deleteTarget} onOpenChange={(open) => { if (!open) dispatch({ type: "SET_DELETE", target: null }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ color: "hsl(var(--danger))" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Trash2 size={18} /> Ø­Ø°Ù ÙˆØ§Ø±Ø¯Ø§Øª Ùˆ Ù…Ø­ØªÙˆØ§ÛŒ ÙˆØ§Ø±Ø¯ Ø´Ø¯Ù‡
              </span>
            </DialogTitle>
            <DialogDescription>
              Ø¯Ø± Ø­Ø§Ù„ Ø­Ø°Ù: {state.deleteTarget?.label}
            </DialogDescription>
          </DialogHeader>

          {/* Rich delete body â€” lives outside DialogDescription (which is a <p>) */}
          <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            {state.deleteTarget && (
              <div style={{ background: "hsl(var(--danger) / 0.05)", border: "1px solid hsl(var(--danger) / 0.15)", borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "hsl(var(--foreground))", display: "flex", flexDirection: "column", gap: 4 }}>
                  {state.deleteTarget.counts.questions > 0 && <span>â€¢ {state.deleteTarget.counts.questions} Ø³ÙˆØ§Ù„ MCQ</span>}
                  {state.deleteTarget.counts.examLinkedQuestions > 0 && (
                    <span style={{ color: "hsl(var(--warning))", fontWeight: 600 }}>
                      â€¢ {state.deleteTarget.counts.examLinkedQuestions} Ø³ÙˆØ§Ù„ Ù…Ø±ØªØ¨Ø· Ø¨Ø§ Ø¢Ø²Ù…ÙˆÙ†
                    </span>
                  )}
                  {state.deleteTarget.counts.flashcards > 0 && <span>â€¢ {state.deleteTarget.counts.flashcards} ÙÙ„Ø´â€ŒÚ©Ø§Ø±Øª</span>}
                  {state.deleteTarget.counts.chunks > 0 && <span>â€¢ {state.deleteTarget.counts.chunks} Ø¨Ø®Ø´ Ø¬Ø²ÙˆÙ‡</span>}
                  {state.deleteTarget.counts.noteDocuments > 0 && <span>â€¢ {state.deleteTarget.counts.noteDocuments} Ø³Ù†Ø¯ Ø¬Ø²ÙˆÙ‡</span>}
                </div>
              </div>
            )}

            {/* Mode selector */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "10px 12px", borderRadius: 10, border: `2px solid ${state.deleteMode === "hard" ? "hsl(var(--danger))" : C.border}`, background: state.deleteMode === "hard" ? "hsl(var(--danger) / 0.05)" : "transparent" }}>
                <input type="radio" name="deleteMode" value="hard" checked={state.deleteMode === "hard"} onChange={() => dispatch({ type: "SET_DELETE_MODE", mode: "hard" })} style={{ marginTop: 2, accentColor: "hsl(var(--danger))" }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "hsl(var(--danger))" }}>Ø­Ø°Ù ÙˆØ§Ø±Ø¯Ø§Øª Ùˆ ØªÙ…Ø§Ù… Ù…Ø­ØªÙˆØ§ÛŒ ÙˆØ§Ø±Ø¯ Ø´Ø¯Ù‡</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>Ø³ÙˆØ§Ù„Ø§Øª Ø¢Ø²Ù…ÙˆÙ†ÛŒ Ù‡Ù… Ø§Ø² QBank Ùˆ Ø¢Ø²Ù…ÙˆÙ†â€ŒÙ‡Ø§ Ø­Ø°Ù Ù…ÛŒâ€ŒØ´ÙˆÙ†Ø¯. Ø¨Ø±Ú¯Ø´Øªâ€ŒÙ¾Ø°ÛŒØ± Ù†ÛŒØ³Øª.</div>
                </div>
              </label>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "10px 12px", borderRadius: 10, border: `2px solid ${state.deleteMode === "detach" ? "hsl(var(--warning))" : C.border}`, background: state.deleteMode === "detach" ? "hsl(var(--warning) / 0.05)" : "transparent" }}>
                <input type="radio" name="deleteMode" value="detach" checked={state.deleteMode === "detach"} onChange={() => dispatch({ type: "SET_DELETE_MODE", mode: "detach" })} style={{ marginTop: 2, accentColor: "hsl(var(--warning))" }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "hsl(var(--warning))" }}>Ù†Ú¯Ù‡ Ø¯Ø§Ø´ØªÙ† ØªØ§Ø±ÛŒØ®Ú†Ù‡ Ø¢Ø²Ù…ÙˆÙ† / ÙÙ‚Ø· Ø¬Ø¯Ø§Ø³Ø§Ø²ÛŒ</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>Ø³ÙˆØ§Ù„Ø§ØªÛŒ Ú©Ù‡ Ø¯Ø± Ø¢Ø²Ù…ÙˆÙ† Ø§Ø³ØªÙØ§Ø¯Ù‡ Ø´Ø¯Ù‡â€ŒØ§Ù†Ø¯ Ø¯Ø± QBank Ø¨Ø§Ù‚ÛŒ Ù…ÛŒâ€ŒÙ…Ø§Ù†Ù†Ø¯. Ø³ÙˆØ§Ù„Ø§Øª Ø¨Ø¯ÙˆÙ† Ø¢Ø²Ù…ÙˆÙ† Ø­Ø°Ù Ù…ÛŒâ€ŒØ´ÙˆÙ†Ø¯.</div>
                </div>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => dispatch({ type: "SET_DELETE", target: null })}>Ø§Ù†ØµØ±Ø§Ù</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              style={state.deleteMode === "detach" ? { background: "hsl(var(--warning))", borderColor: "hsl(var(--warning))" } : undefined}
            >
              {isDeleting
                ? "Ø¯Ø± Ø­Ø§Ù„ Ø­Ø°Ù..."
                : state.deleteMode === "hard"
                  ? "Ø­Ø°Ù Ú©Ø§Ù…Ù„ ÙˆØ§Ø±Ø¯Ø§Øª Ùˆ Ù…Ø­ØªÙˆØ§"
                  : "Ø¬Ø¯Ø§Ø³Ø§Ø²ÛŒ ÙˆØ§Ø±Ø¯Ø§Øª (Ù†Ú¯Ù‡ Ø¯Ø§Ø´ØªÙ† Ø¢Ø²Ù…ÙˆÙ†)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* â”€â”€ Purge Orphan Confirm â”€â”€ */}
      <Dialog open={purgeOrphanConfirm} onOpenChange={setPurgeOrphanConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ù¾Ø§Ú© Ú©Ø±Ø¯Ù† Ø³ÙˆØ§Ù„Ø§Øª Ø¨Ø¯ÙˆÙ† ÙˆØ§Ø±Ø¯Ø§Øª</DialogTitle>
            <DialogDescription>
              {orphanStats?.orphanQuestions ?? 0} Ø³ÙˆØ§Ù„ Ø¨Ø¯ÙˆÙ† Ù¾ÛŒÙˆÙ†Ø¯ Ø¨Ù‡ ÙˆØ§Ø±Ø¯Ø§Øª Ø§Ø² QBank Ø­Ø°Ù Ø®ÙˆØ§Ù‡Ù†Ø¯ Ø´Ø¯.
              Ù„ÛŒÙ†Ú©â€ŒÙ‡Ø§ÛŒ Ø¢Ø²Ù…ÙˆÙ† Ø¢Ù†â€ŒÙ‡Ø§ Ù†ÛŒØ² Ù¾Ø§Ú© Ù…ÛŒâ€ŒØ´ÙˆÙ†Ø¯. Ø§ÛŒÙ† Ø¹Ù…Ù„ Ø¨Ø±Ú¯Ø´Øªâ€ŒÙ¾Ø°ÛŒØ± Ù†ÛŒØ³Øª.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurgeOrphanConfirm(false)}>Ø§Ù†ØµØ±Ø§Ù</Button>
            <Button
              variant="destructive"
              disabled={isPurging}
              onClick={() => {
                setPurgeOrphanConfirm(false);
                startPurgeTransition(async () => {
                  const r = await purgeOrphanQuestionsAction();
                  if (r.success) {
                    toast.success(`${r.data.deleted.questions} Ø³ÙˆØ§Ù„ Ø¨Ø¯ÙˆÙ† ÙˆØ§Ø±Ø¯Ø§Øª Ø­Ø°Ù Ø´Ø¯ Â· ${r.data.deleted.examSessionLinks} Ù„ÛŒÙ†Ú© Ø¢Ø²Ù…ÙˆÙ† Ù¾Ø§Ú© Ø´Ø¯`);
                    await refreshHistory();
                    router.refresh();
                  } else {
                    toast.error(`Ø®Ø·Ø§: ${r.error}`);
                  }
                });
              }}
            >
              {isPurging ? "Ø¯Ø± Ø­Ø§Ù„ Ù¾Ø§Ú©â€ŒØ³Ø§Ø²ÛŒ..." : "Ù¾Ø§Ú© Ú©Ø±Ø¯Ù† Ø³ÙˆØ§Ù„Ø§Øª Ø¨Ø¯ÙˆÙ† ÙˆØ§Ø±Ø¯Ø§Øª"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* â”€â”€ Purge All Confirm â”€â”€ */}
      <Dialog open={purgeAllConfirm} onOpenChange={setPurgeAllConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ color: "hsl(var(--danger))" }}>Ù¾Ø§Ú© Ú©Ø±Ø¯Ù† Ù‡Ù…Ù‡ Ø³ÙˆØ§Ù„Ø§Øª QBank</DialogTitle>
            <DialogDescription>
              <strong>Ù‡Ù…Ù‡ {orphanStats?.totalQuestions ?? 0} Ø³ÙˆØ§Ù„</strong> Ø§Ø² QBank Ø­Ø°Ù Ø®ÙˆØ§Ù‡Ù†Ø¯ Ø´Ø¯ØŒ
              Ø§Ø² Ø¬Ù…Ù„Ù‡ Ø³ÙˆØ§Ù„Ø§ØªÛŒ Ú©Ù‡ Ø¯Ø± Ø¢Ø²Ù…ÙˆÙ† Ø§Ø³ØªÙØ§Ø¯Ù‡ Ø´Ø¯Ù‡â€ŒØ§Ù†Ø¯.
              ØªÙ…Ø§Ù… Ù„ÛŒÙ†Ú©â€ŒÙ‡Ø§ÛŒ Ø¢Ø²Ù…ÙˆÙ† ({orphanStats?.examLinkedTotal ?? 0}) Ù†ÛŒØ² Ù¾Ø§Ú© Ù…ÛŒâ€ŒØ´ÙˆÙ†Ø¯.
              Ø§ÛŒÙ† Ø¹Ù…Ù„ Ú©Ø§Ù…Ù„Ø§Ù‹ Ø¨Ø±Ú¯Ø´Øªâ€ŒÙ¾Ø°ÛŒØ± Ù†ÛŒØ³Øª.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurgeAllConfirm(false)}>Ø§Ù†ØµØ±Ø§Ù</Button>
            <Button
              variant="destructive"
              disabled={isPurging}
              onClick={() => {
                setPurgeAllConfirm(false);
                startPurgeTransition(async () => {
                  const r = await purgeAllQuestionsAction();
                  if (r.success) {
                    toast.success(`${r.data.deleted.questions} Ø³ÙˆØ§Ù„ Ø§Ø² QBank Ù¾Ø§Ú© Ø´Ø¯ Â· ${r.data.deleted.examSessionLinks} Ù„ÛŒÙ†Ú© Ø¢Ø²Ù…ÙˆÙ† Ù¾Ø§Ú© Ø´Ø¯`);
                    await refreshHistory();
                    router.refresh();
                  } else {
                    toast.error(`Ø®Ø·Ø§: ${r.error}`);
                  }
                });
              }}
            >
              {isPurging ? "Ø¯Ø± Ø­Ø§Ù„ Ù¾Ø§Ú©â€ŒØ³Ø§Ø²ÛŒ..." : "Ù¾Ø§Ú© Ú©Ø±Ø¯Ù† Ù‡Ù…Ù‡ Ø³ÙˆØ§Ù„Ø§Øª QBank"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Category Section
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

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
            {invalidCount > 0 && <Badge variant="destructive" style={{ fontSize: 10 }}>{invalidCount} Ø®Ø·Ø§</Badge>}
            <Badge variant={invalidCount > 0 ? "warning" : "success"} style={{ fontSize: 10 }}>{files.length} ÙØ§ÛŒÙ„</Badge>
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
                <p style={{ fontSize: 14, color: C.text, fontWeight: 600, margin: "0 0 4px", position: "relative" }}>ÙØ§ÛŒÙ„â€ŒÙ‡Ø§ Ø±Ø§ Ø§ÛŒÙ†Ø¬Ø§ Ø±Ù‡Ø§ Ú©Ù†ÛŒØ¯ ÛŒØ§ Ú©Ù„ÛŒÚ© Ú©Ù†ÛŒØ¯</p>
                <p style={{ fontSize: 12, color: C.textMuted, margin: 0, position: "relative" }}>ÙØ±Ù…Øª Ù¾Ø´ØªÛŒØ¨Ø§Ù†ÛŒ: {cat.formats} &middot; {cat.accept}</p>
                <input ref={inputRef} type="file" accept={cat.accept} multiple style={{ display: "none" }} onChange={(e) => { const f = Array.from(e.target.files ?? []); if (f.length > 0) onFilesSelected(f); e.target.value = ""; }} />
              </div>

              {/* Validation summary */}
              {files.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "10px 14px", borderRadius: 12, background: C.surfaceSubtle, border: `1px solid ${C.border}`, fontSize: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: invalidCount > 0 ? C.danger : C.success, flexShrink: 0, animation: pendingCount > 0 ? "cm-pulse-ring 1.5s infinite" : "none" }} />
                  <span style={{ color: C.success, fontWeight: 600 }}>{validCount} Ù…Ø¹ØªØ¨Ø±</span>
                  {invalidCount > 0 && <span style={{ color: C.danger, fontWeight: 600 }}>{invalidCount} Ù†Ø§Ù…Ø¹ØªØ¨Ø±</span>}
                  {pendingCount > 0 && <span style={{ color: C.textMuted }}>{pendingCount} Ø¯Ø± Ø§Ù†ØªØ¸Ø§Ø±</span>}
                  {uploadedCount > 0 && <span style={{ color: C.accent, fontWeight: 600 }}>{uploadedCount} ÙˆØ§Ø±Ø¯ Ø´Ø¯Ù‡</span>}
                  <span style={{ marginRight: "auto" }} />
                  <button onClick={allSelected ? onDeselectAll : onSelectAll} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "4px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.textMuted, fontWeight: 500 }}>
                    {allSelected ? <><CheckSquare size={12} /> Ù„ØºÙˆ Ø§Ù†ØªØ®Ø§Ø¨</> : <><Square size={12} /> Ø§Ù†ØªØ®Ø§Ø¨ Ù‡Ù…Ù‡</>}
                  </button>
                  {selectedIds.size > 0 && (
                    <button onClick={onRemoveSelected} style={{ background: "none", border: `1px solid ${C.danger}40`, borderRadius: 8, padding: "4px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.danger, fontWeight: 500 }}>
                      <Trash2 size={11} /> Ø­Ø°Ù {selectedIds.size} ÙØ§ÛŒÙ„
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
                    {isUploading ? "Ø¯Ø± Ø­Ø§Ù„ ÙˆØ§Ø±Ø¯ Ú©Ø±Ø¯Ù†..." : `ÙˆØ§Ø±Ø¯ Ú©Ø±Ø¯Ù† ${validCount} ÙØ§ÛŒÙ„ Ù…Ø¹ØªØ¨Ø±`}
                  </Button>
                  <Button variant="outline" onClick={onClearFiles} disabled={isUploading} style={{ gap: 6 }}>
                    <X size={14} /> Ù¾Ø§Ú© Ú©Ø±Ø¯Ù† Ù‡Ù…Ù‡
                  </Button>
                  {invalidCount > 0 && (
                    <span style={{ fontSize: 12, color: C.danger, display: "flex", alignItems: "center", gap: 5 }}>
                      <AlertTriangle size={13} /> {invalidCount} ÙØ§ÛŒÙ„ Ù†Ø§Ù…Ø¹ØªØ¨Ø±
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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   File Row
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

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
    pending: "Ø¯Ø± Ø§Ù†ØªØ¸Ø§Ø±",
    validating: "Ø§Ø¹ØªØ¨Ø§Ø±Ø³Ù†Ø¬ÛŒ...",
    valid: v ? `${v.itemCount} Ù…ÙˆØ±Ø¯ Ù…Ø¹ØªØ¨Ø±` : "Ù…Ø¹ØªØ¨Ø±",
    invalid: "Ù†Ø§Ù…Ø¹ØªØ¨Ø±",
    uploading: "Ø¯Ø± Ø­Ø§Ù„ Ø§Ø±Ø³Ø§Ù„...",
    uploaded: "ÙˆØ§Ø±Ø¯ Ø´Ø¯",
    error: entry.errorMsg ?? "Ø®Ø·Ø§",
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
            {showErrors ? "Ø¨Ø³ØªÙ†" : `${v.errors.length} Ø®Ø·Ø§`}
          </button>
        )}
        <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex", alignItems: "center" }}>
          <X size={13} color={C.textMuted} />
        </button>
      </div>

      {/* Chapter / Segment row */}
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, fontSize: 11 }}>
        <span style={{ color: C.textMuted, flexShrink: 0, fontWeight: 500 }}>ÙØµÙ„:</span>
        <input type="number" min={0} max={244} placeholder="â€”" value={chapterNo ?? ""} onChange={(e) => onPatch({ manualChapter: e.target.value ? parseInt(e.target.value, 10) : null })} style={{ width: 58, padding: "4px 8px", borderRadius: 8, fontSize: 12, fontWeight: 700, textAlign: "center", color: "hsl(var(--primary))", background: "hsl(var(--primary) / 0.06)", border: "1px solid hsl(var(--primary) / 0.15)", outline: "none" }} />
        <span style={{ color: C.textMuted, flexShrink: 0, fontWeight: 500 }}>Ø¨Ø®Ø´:</span>
        <input type="number" min={0} max={99} placeholder="â€”" value={segmentIdx ?? ""} onChange={(e) => onPatch({ manualSegment: e.target.value ? parseInt(e.target.value, 10) : null })} style={{ width: 50, padding: "4px 8px", borderRadius: 8, fontSize: 12, fontWeight: 700, textAlign: "center", color: "hsl(var(--info))", background: "hsl(var(--info) / 0.06)", border: "1px solid hsl(var(--info) / 0.15)", outline: "none" }} />
        {autoMeta.chapterNo || autoMeta.segmentIdx != null ? (
          <span style={{ color: C.textMuted, fontSize: 10 }}>(Ø®ÙˆØ¯Ú©Ø§Ø±: {autoMeta.chapterNo ? `Ch.${autoMeta.chapterNo}` : ""}{autoMeta.segmentIdx != null ? ` Seg.${autoMeta.segmentIdx}` : ""})</span>
        ) : (
          <span style={{ color: C.warning, fontSize: 10, display: "flex", alignItems: "center", gap: 3 }}><AlertTriangle size={10} /> Ù„Ø·ÙØ§ ÙØµÙ„ Ùˆ Ø¨Ø®Ø´ Ø±Ø§ ÙˆØ§Ø±Ø¯ Ú©Ù†ÛŒØ¯</span>
        )}
      </div>

      {showErrors && v && v.errors.length > 0 && (
        <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 10, background: "hsl(var(--danger) / 0.04)", border: "1px solid hsl(var(--danger) / 0.1)", fontSize: 11, color: C.danger, lineHeight: 1.7 }}>
          {v.errors.slice(0, 10).map((e, i) => <div key={i}>&#x2022; {e.message}</div>)}
          {v.errors.length > 10 && <div style={{ opacity: 0.7 }}>... Ùˆ {v.errors.length - 10} Ø®Ø·Ø§ÛŒ Ø¯ÛŒÚ¯Ø±</div>}
        </div>
      )}
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   History Row
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

const CONTENT_TYPE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  notes: { label: "Ø¬Ø²ÙˆÙ‡", color: "hsl(var(--success))", bg: "hsl(var(--success) / 0.06)" },
  questions: { label: "MCQ", color: "hsl(var(--primary))", bg: "hsl(var(--primary) / 0.06)" },
  flashcards: { label: "ÙÙ„Ø´â€ŒÚ©Ø§Ø±Øª", color: "hsl(var(--info))", bg: "hsl(var(--info) / 0.06)" },
  yield: { label: "Yield", color: "hsl(var(--warning))", bg: "hsl(var(--warning) / 0.06)" },
  batch: { label: "Ø¯Ø³ØªÙ‡â€ŒØ§ÛŒ", color: "hsl(var(--muted-foreground))", bg: "hsl(var(--muted-foreground) / 0.06)" },
  mixed: { label: "ØªØ±Ú©ÛŒØ¨ÛŒ", color: "hsl(var(--muted-foreground))", bg: "hsl(var(--muted-foreground) / 0.06)" },
};

const STATUS_LABEL: Record<string, { label: string; dotColor: string }> = {
  completed: { label: "Ù…ÙˆÙÙ‚", dotColor: "hsl(var(--success))" },
  running: { label: "Ø¯Ø± Ø­Ø§Ù„ Ø§Ø¬Ø±Ø§", dotColor: "hsl(var(--primary))" },
  failed: { label: "Ù†Ø§Ù…ÙˆÙÙ‚", dotColor: "hsl(var(--danger))" },
  pending: { label: "Ø¯Ø± Ø§Ù†ØªØ¸Ø§Ø±", dotColor: "hsl(var(--muted-foreground))" },
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
    countChips.push({ label: `${imp.flashcardCount} Ú©Ø§Ø±Øª`, color: "hsl(var(--info))", bg: "hsl(var(--info) / 0.07)" });
  if (imp.noteDocumentCount > 0)
    countChips.push({ label: `${imp.noteDocumentCount} Ø³Ù†Ø¯`, color: "hsl(var(--success))", bg: "hsl(var(--success) / 0.07)" });
  if (imp.chunkCount > 0)
    countChips.push({ label: `${imp.chunkCount} Ø¨Ø®Ø´`, color: "hsl(var(--muted-foreground))", bg: "hsl(var(--muted-foreground) / 0.07)" });

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
            {imp.fileName ?? imp.sourceName ?? "â€”"}
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
              ÙØµÙ„ {chapterNo}
            </span>
          )}

          {/* Segment chip */}
          {segmentNo != null && (
            <span style={{ fontSize: 9, fontWeight: 700, color: "hsl(var(--info))", background: "hsl(var(--info) / 0.06)", borderRadius: 5, padding: "1px 7px", whiteSpace: "nowrap", flexShrink: 0 }}>
              Ø¨Ø®Ø´ {String(segmentNo).padStart(2, "0")}
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
            <span style={{ fontSize: 10, color: C.textMuted, fontVariantNumeric: "tabular-nums" }}>{imp.itemCount} Ù…ÙˆØ±Ø¯</span>
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
        <Badge variant="warning" style={{ fontSize: 10, flexShrink: 0 }}>{imp.examLinkedQuestionCount} Ø¢Ø²Ù…ÙˆÙ†ÛŒ</Badge>
      )}

      <button
        onClick={onDelete}
        style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer", padding: 7, display: "flex", alignItems: "center", justifyContent: "center", transition: "border-color 0.15s, background 0.15s", flexShrink: 0 }}
        title="Ø­Ø°Ù ÙˆØ§Ø±Ø¯Ø§Øª Ùˆ Ù…Ø­ØªÙˆØ§"
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.danger; e.currentTarget.style.background = `${C.danger}08`; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = "none"; }}
      >
        <Trash2 size={14} color={C.danger} />
      </button>
    </div>
  );
}

