"use client";

import { useState } from "react";
import {
  X,
  FileText,
  Lightbulb,
  BookOpen,
  Layers,
  Loader2,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NoteContentView } from "./NoteContentView";
import type { ActiveQuestion } from "@/types/exam";
import { useQuestionNote } from "@/hooks/useQuestionNote";

type TabId = "source-note" | "key-info" | "concept" | "related";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "source-note", label: "جزوه", icon: <FileText size={12} /> },
  { id: "key-info", label: "Key Info", icon: <Lightbulb size={12} /> },
  { id: "concept", label: "Concept", icon: <BookOpen size={12} /> },
  { id: "related", label: "Related", icon: <Layers size={12} /> },
];

function EmptySlot({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
      <div className="mb-2.5 text-border">{icon}</div>
      <p className="max-w-[220px] text-xs leading-relaxed text-lib-text-muted">{message}</p>
    </div>
  );
}

function SourceNoteTab({ question }: { question: ActiveQuestion | null }) {
  const { note, anchors, isLoading, error } = useQuestionNote(question?.questionId ?? null);

  if (!question) {
    return <EmptySlot icon={<HelpCircle size={28} />} message="سوالی انتخاب نشده." />;
  }
  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12">
        <Loader2 size={24} className="animate-spin text-lib-accent" />
        <p className="text-xs text-lib-text-muted">در حال بارگذاری جزوه...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12">
        <AlertTriangle size={24} className="text-lib-marked" />
        <p className="text-xs text-lib-text-muted">{error}</p>
      </div>
    );
  }
  if (!note) {
    return <EmptySlot icon={<FileText size={28} />} message="جزوه‌ای برای این سوال لینک نشده." />;
  }
  return (
    <NoteContentView
      note={note}
      primaryAnchorFrameId={anchors?.primary ?? null}
      supportingAnchorFrameIds={anchors?.supporting ?? []}
    />
  );
}

export interface StudyPanelV2Props {
  question: ActiveQuestion | null;
  onClose: () => void;
  className?: string;
}

export function StudyPanelV2({ question, onClose, className }: StudyPanelV2Props) {
  const [activeTab, setActiveTab] = useState<TabId>("source-note");

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-lib-border px-4 py-2.5">
        <span className="text-[13px] font-bold text-lib-text">پنل مطالعه</span>
        <button
          onClick={onClose}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md bg-transparent text-lib-text-muted transition-colors hover:bg-lib-hover"
        >
          <X size={14} />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-lib-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2.5",
              "cursor-pointer text-[11px] font-medium transition-colors",
              activeTab === tab.id
                ? "border-lib-accent text-lib-accent"
                : "border-transparent text-lib-text-muted hover:text-lib-text-secondary",
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "source-note" && <SourceNoteTab question={question} />}
        {activeTab === "key-info" && (
          <EmptySlot icon={<Lightbulb size={28} />} message="Key Info هنوز پیاده‌سازی نشده." />
        )}
        {activeTab === "concept" && (
          <EmptySlot icon={<BookOpen size={28} />} message="Concept map هنوز پیاده‌سازی نشده." />
        )}
        {activeTab === "related" && (
          <EmptySlot icon={<Layers size={28} />} message="سوالات مرتبط هنوز پیاده‌سازی نشده." />
        )}
      </div>
    </div>
  );
}
