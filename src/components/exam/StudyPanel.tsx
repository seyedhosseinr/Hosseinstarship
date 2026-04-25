"use client";

import { useState } from "react";
import {
  X,
  BookOpen,
  FileText,
  Lightbulb,
  Layers,
  HelpCircle,
  Loader2,
  AlertTriangle,
  Star,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { ActiveQuestion } from "@/types/exam";
import {
  useQuestionNote,
  type QuestionNoteData,
  type QNSection,
  type QNFrame,
} from "@/hooks/useQuestionNote";

/* ═══════════════════════════════════════════════════════════════
   CSS-variable bridge for automatic dark mode
═══════════════════════════════════════════════════════════════ */
const STUDY_PANEL_STYLES = `
[data-study-panel] {
  --sp-bg: #ffffff;        --sp-border: #e2e8f0;
  --sp-text: #1e293b;      --sp-muted: #64748b;
  --sp-faint: #f8fafc;     --sp-accent: #0d9488;
  --sp-accentSoft: #f0fdfa;
  --sp-pearl: #fef9c3;     --sp-pearlBorder: #fde68a;
  --sp-trap: #fef2f2;      --sp-trapBorder: #fecaca;
  --sp-threshold: #eff6ff;  --sp-thresholdBorder: #bfdbfe;
  --sp-highYield: #f59e0b;
}
.dark [data-study-panel] {
  --sp-bg: #18181b;        --sp-border: #27272a;
  --sp-text: #f4f4f5;      --sp-muted: #a1a1aa;
  --sp-faint: #1c1c1f;     --sp-accent: #2dd4bf;
  --sp-accentSoft: #042f2e;
  --sp-pearl: #422006;     --sp-pearlBorder: #854d0e;
  --sp-trap: #450a0a;      --sp-trapBorder: #991b1b;
  --sp-threshold: #172554;  --sp-thresholdBorder: #1e40af;
  --sp-highYield: #f59e0b;
}
`;

const C = {
  bg: "var(--sp-bg)",
  border: "var(--sp-border)",
  text: "var(--sp-text)",
  muted: "var(--sp-muted)",
  faint: "var(--sp-faint)",
  accent: "var(--sp-accent)",
  accentSoft: "var(--sp-accentSoft)",
  pearl: "var(--sp-pearl)",
  pearlBorder: "var(--sp-pearlBorder)",
  trap: "var(--sp-trap)",
  trapBorder: "var(--sp-trapBorder)",
  threshold: "var(--sp-threshold)",
  thresholdBorder: "var(--sp-thresholdBorder)",
  highYield: "var(--sp-highYield)",
} as const;

/* ── Kind badge colors ─── */
const KIND_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  concept:              { bg: "#f0fdf4", color: "#16a34a", label: "Concept" },
  trap:                 { bg: "#fef2f2", color: "#dc2626", label: "Trap" },
  threshold:            { bg: "#eff6ff", color: "#2563eb", label: "Threshold" },
  high_yield:           { bg: "#fefce8", color: "#ca8a04", label: "High Yield" },
  clinical_decision:    { bg: "#f0fdfa", color: "#0d9488", label: "Clinical Decision" },
  indication:           { bg: "#faf5ff", color: "#7c3aed", label: "Indication" },
  differential:         { bg: "#fff7ed", color: "#ea580c", label: "Differential" },
  algorithm:            { bg: "#f0f9ff", color: "#0284c7", label: "Algorithm" },
  interactive_algorithm:{ bg: "#f0f9ff", color: "#0284c7", label: "Algorithm" },
  complication:         { bg: "#fef2f2", color: "#dc2626", label: "Complication" },
  follow_up:            { bg: "#f0fdf4", color: "#16a34a", label: "Follow-up" },
  core:                 { bg: "#f8fafc", color: "#64748b", label: "Core" },
  pearl:                { bg: "#fefce8", color: "#ca8a04", label: "Pearl" },
  warning:              { bg: "#fef2f2", color: "#dc2626", label: "Warning" },
  pitfall:              { bg: "#fef2f2", color: "#dc2626", label: "Pitfall" },
  keypoint:             { bg: "#eff6ff", color: "#2563eb", label: "Key Point" },
};

type TabId = "source-note" | "key-info" | "concept" | "related";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "source-note", label: "جزوه", icon: <FileText size={12} /> },
  { id: "key-info", label: "Key Info", icon: <Lightbulb size={12} /> },
  { id: "concept", label: "Concept", icon: <BookOpen size={12} /> },
  { id: "related", label: "Related", icon: <Layers size={12} /> },
];

interface StudyPanelProps {
  question: ActiveQuestion | null;
  onClose: () => void;
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
═══════════════════════════════════════════════════════════════ */

/** Simple inline-markdown → HTML (bold, italic) */
function parseMd(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

/* ── Empty state slot ─────────────────────────────────────── */
function EmptySlot({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        textAlign: "center",
      }}
    >
      <div style={{ color: "#cbd5e1", marginBottom: 10 }}>{icon}</div>
      <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, maxWidth: 220 }}>{message}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Source Note Tab — The main feature
═══════════════════════════════════════════════════════════════ */

function SourceNoteTab({ question }: { question: ActiveQuestion | null }) {
  const { note, isLoading, error } = useQuestionNote(question?.questionId ?? null);

  if (!question) {
    return <EmptySlot icon={<HelpCircle size={28} />} message="سوالی انتخاب نشده." />;
  }

  if (isLoading) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 24px",
          gap: 12,
        }}
      >
        <Loader2 size={24} color={C.accent} style={{ animation: "spin 1s linear infinite" }} />
        <p style={{ fontSize: 12, color: C.muted }}>در حال بارگذاری جزوه...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 24px",
          gap: 12,
        }}
      >
        <AlertTriangle size={24} color="#f59e0b" />
        <p style={{ fontSize: 12, color: C.muted }}>{error}</p>
      </div>
    );
  }

  if (!note) {
    return (
      <EmptySlot
        icon={<FileText size={28} />}
        message="جزوه‌ای برای این سوال لینک نشده. پس از import جزوه و سوال محتوا نمایش داده خواهد شد."
      />
    );
  }

  return <NoteContent note={note} />;
}

/* ── Full Note Renderer ──────────────────────────────────── */
function NoteContent({ note }: { note: QuestionNoteData }) {
  return (
    <div style={{ direction: "rtl", padding: "12px 0" }}>
      {/* Breadcrumb / Meta */}
      <div
        style={{
          padding: "0 16px 10px",
          borderBottom: `1px solid ${C.border}`,
          marginBottom: 12,
        }}
      >
        <p
          style={{
            fontSize: 11,
            color: C.accent,
            fontWeight: 600,
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          فصل {note.meta.chapterNo} &gt; بخش {note.meta.chunkIndex + 1}
        </p>
        <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: "2px 0 0" }}>
          {note.meta.chapterTitle}
        </p>
        {note.meta.pageRange && (
          <p style={{ fontSize: 10, color: C.muted, margin: "2px 0 0" }}>
            صفحات {note.meta.pageRange}
          </p>
        )}
      </div>

      {/* Sections */}
      {note.sections.map((section) => (
        <NoteSection key={section.id} section={section} />
      ))}
    </div>
  );
}

/* ── Section ─────────────────────────────────────────────── */
function NoteSection({ section }: { section: QNSection }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Section heading */}
      <button
        type="button"
        onClick={() => setCollapsed((p) => !p)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 16px",
          background: C.faint,
          border: "none",
          borderTop: `1px solid ${C.border}`,
          borderBottom: `1px solid ${C.border}`,
          cursor: "pointer",
          textAlign: "right",
        }}
      >
        {collapsed ? (
          <ChevronRight size={14} color={C.muted} />
        ) : (
          <ChevronDown size={14} color={C.muted} />
        )}
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: C.text,
            flex: 1,
          }}
        >
          {section.title}
        </span>
        <span style={{ fontSize: 10, color: C.muted }}>
          {section.frames.length} بلوک
        </span>
      </button>

      {/* Frames */}
      {!collapsed && (
        <div style={{ padding: "8px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {section.frames.map((frame) => (
            <NoteFrame key={frame.id} frame={frame} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Single Frame ────────────────────────────────────────── */
function NoteFrame({ frame }: { frame: QNFrame }) {
  const kindStyle = KIND_STYLE[frame.kind] ?? KIND_STYLE.core;

  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 8,
        border: `1px solid ${C.border}`,
        background: C.bg,
      }}
    >
      {/* Header: Kind badge + title + highYield star */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 6,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            padding: "2px 6px",
            borderRadius: 4,
            background: kindStyle.bg,
            color: kindStyle.color,
            flexShrink: 0,
          }}
        >
          {kindStyle.label}
        </span>

        {frame.highYield && (
          <Star size={12} color={C.highYield} fill={C.highYield} style={{ flexShrink: 0 }} />
        )}

        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: C.text,
            flex: 1,
            lineHeight: 1.4,
          }}
        >
          {frame.title}
        </span>
      </div>

      {/* Body / Content */}
      {(frame.content || frame.body) && (
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.75,
            color: "#334155",
            marginBottom: frame.listItems?.length || frame.tableData ? 8 : 0,
          }}
          dangerouslySetInnerHTML={{
            __html: parseMd(frame.content || frame.body),
          }}
        />
      )}

      {/* List Items */}
      {frame.listItems && frame.listItems.length > 0 && (
        <ul
          style={{
            margin: "6px 0",
            paddingRight: 18,
            paddingLeft: 0,
            listStyleType: "disc",
          }}
        >
          {frame.listItems.map((item, i) => (
            <li
              key={i}
              style={{
                fontSize: 12,
                lineHeight: 1.7,
                color: "#334155",
                marginBottom: 3,
              }}
              dangerouslySetInnerHTML={{ __html: parseMd(item) }}
            />
          ))}
        </ul>
      )}

      {/* Table Data */}
      {frame.tableData && frame.tableData.headers && (
        <div style={{ overflowX: "auto", marginTop: 6 }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 11,
              direction: "ltr",
            }}
          >
            <thead>
              <tr>
                {frame.tableData.headers.map((h, i) => (
                  <th
                    key={i}
                    style={{
                      padding: "5px 8px",
                      background: "#f1f5f9",
                      borderBottom: `2px solid ${C.border}`,
                      fontWeight: 700,
                      color: C.text,
                      textAlign: "left",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {frame.tableData.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => {
                    const cellText = typeof cell === "string" ? cell : cell.text;
                    const isBold = typeof cell === "object" && cell.bold;
                    return (
                      <td
                        key={ci}
                        style={{
                          padding: "4px 8px",
                          borderBottom: `1px solid ${C.border}`,
                          color: "#475569",
                          fontWeight: isBold ? 700 : 400,
                          verticalAlign: "top",
                        }}
                        dangerouslySetInnerHTML={{ __html: parseMd(cellText) }}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Clinical Pearl */}
      {frame.clinicalPearl && (
        <div
          style={{
            marginTop: 8,
            padding: "8px 10px",
            borderRadius: 6,
            background: C.pearl,
            border: `1px solid ${C.pearlBorder}`,
          }}
        >
          <p
            style={{
              fontSize: 11,
              lineHeight: 1.65,
              color: "#92400e",
              margin: 0,
            }}
          >
            <strong style={{ display: "inline", marginLeft: 4 }}>💎 Clinical Pearl:</strong>{" "}
            <span dangerouslySetInnerHTML={{ __html: parseMd(frame.clinicalPearl) }} />
          </p>
        </div>
      )}

      {/* Margin Note */}
      {frame.marginNote && (
        <div
          style={{
            marginTop: 6,
            padding: "6px 10px",
            borderRadius: 6,
            background: "#f8fafc",
            borderRight: `3px solid ${C.accent}`,
          }}
        >
          <p style={{ fontSize: 11, color: C.muted, margin: 0, lineHeight: 1.5 }}>
            {frame.marginNote}
          </p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Key Info Tab (kept from original)
═══════════════════════════════════════════════════════════════ */
function KeyInfoTab({ question }: { question: ActiveQuestion | null }) {
  if (!question)
    return <EmptySlot icon={<HelpCircle size={28} />} message="No question selected." />;

  const items: { label: string; value: string }[] = [];

  items.push({ label: "Question ID", value: question.questionId.slice(0, 12) + "\u2026" });

  if (question.timeSpentSeconds > 0) {
    const m = Math.floor(question.timeSpentSeconds / 60);
    const s = question.timeSpentSeconds % 60;
    items.push({ label: "Time Spent", value: m > 0 ? `${m}m ${s}s` : `${s}s` });
  }

  if (question.isSubmitted && question.outcome) {
    items.push({
      label: "Outcome",
      value: question.outcome === "correct" ? "Correct \u2713" : "Incorrect \u2717",
    });
  }

  if (question.isMarked) {
    items.push({ label: "Flagged", value: "Yes" });
  }

  return (
    <div style={{ padding: "16px 20px" }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: C.muted,
          marginBottom: 12,
        }}
      >
        Question Details
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item) => (
          <div
            key={item.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 12px",
              borderRadius: 8,
              background: C.faint,
            }}
          >
            <span style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>{item.label}</span>
            <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{item.value}</span>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 20,
          padding: "12px 14px",
          borderRadius: 8,
          border: `1px dashed ${C.border}`,
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
          Chapter and subject metadata will be available after linking questions to notes.
        </p>
      </div>
    </div>
  );
}

/* ── Concept tab ──────────────────────────────────────────── */
function ConceptTab() {
  return (
    <EmptySlot
      icon={<BookOpen size={28} />}
      message="Quick concept view is not yet connected. This will surface related study material once note linking is active."
    />
  );
}

/* ── Related tab ──────────────────────────────────────────── */
function RelatedTab() {
  return (
    <EmptySlot
      icon={<Layers size={28} />}
      message="Related flashcards and questions will appear here once the linking system is connected."
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   STUDY PANEL
═══════════════════════════════════════════════════════════════ */
export function StudyPanel({ question, onClose }: StudyPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("source-note");

  return (
    <div
      data-study-panel
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minWidth: 340,
        background: C.bg,
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: STUDY_PANEL_STYLES }} />
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: C.text,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <BookOpen size={14} color={C.accent} />
          Study Panel
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          <X size={14} color="#94a3b8" />
        </button>
      </div>

      {/* ── Tabs ── */}
      <div
        style={{
          display: "flex",
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0,
          overflowX: "auto",
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "8px 12px",
              whiteSpace: "nowrap",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              borderBottom:
                activeTab === tab.id
                  ? `2px solid ${C.accent}`
                  : "2px solid transparent",
              background: "transparent",
              fontSize: 11,
              fontWeight: 600,
              color: activeTab === tab.id ? C.accent : C.muted,
              cursor: "pointer",
              transition: "color 0.12s, border-color 0.12s",
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {activeTab === "source-note" && <SourceNoteTab question={question} />}
        {activeTab === "key-info" && <KeyInfoTab question={question} />}
        {activeTab === "concept" && <ConceptTab />}
        {activeTab === "related" && <RelatedTab />}
      </div>
    </div>
  );
}
