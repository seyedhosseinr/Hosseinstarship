"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { KindBadge } from "./KindBadge";
import { renderInlineRich } from "@/components/note-viewer/inlineRich";
import type { QuestionNoteData, QNSection, QNFrame } from "@/hooks/useQuestionNote";

/* ── Section ── */
function NoteSection({
  section,
  primaryAnchorFrameId,
  supportingAnchorFrameIds,
}: {
  section: QNSection;
  primaryAnchorFrameId: string | null;
  supportingAnchorFrameIds: Set<string>;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setCollapsed((p) => !p)}
        className={cn(
          "flex w-full items-center gap-1.5 border-y border-lib-border bg-lib-hover px-4 py-2",
          "cursor-pointer text-start",
        )}
      >
        {collapsed ? <ChevronRight size={14} className="text-lib-text-muted" /> : <ChevronDown size={14} className="text-lib-text-muted" />}
        <span className="flex-1 text-xs font-bold text-lib-text">{section.title}</span>
        <span className="text-[10px] text-lib-text-muted">{section.frames.length} بلوک</span>
      </button>
      {!collapsed && (
        <div className="flex flex-col gap-2.5 px-4 py-2">
          {section.frames.map((frame) => (
            <NoteFrame
              key={frame.id}
              frame={frame}
              isPrimary={frame.id === primaryAnchorFrameId}
              isSupporting={supportingAnchorFrameIds.has(frame.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Frame ── */
function NoteFrame({
  frame,
  isPrimary,
  isSupporting,
}: {
  frame: QNFrame;
  isPrimary: boolean;
  isSupporting: boolean;
}) {
  return (
    <div
      id={frame.id}
      data-frame-id={frame.id}
      className={cn(
        "rounded-lib-sm border border-lib-border bg-lib-bg p-3 scroll-mt-24 transition-[box-shadow,background-color] duration-200",
        isPrimary && "ring-2 ring-lib-accent ring-offset-2 bg-lib-accent-soft/30",
        !isPrimary && isSupporting && "ring-1 ring-lib-accent/40",
      )}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <KindBadge kind={frame.kind} />
        {frame.highYield && <Star size={12} className="shrink-0 fill-lib-marked text-lib-marked" />}
        <span className="flex-1 text-xs font-semibold leading-snug text-lib-text">
          {renderInlineRich(frame.title)}
        </span>
      </div>
      {(frame.content || frame.body) && (
        <div
          className="whitespace-pre-wrap text-[12.5px] leading-[1.85] text-lib-text-secondary"
          dir="rtl"
          style={{
            textAlign: "justify",
            textJustify: "inter-word" as React.CSSProperties["textJustify"],
            overflowWrap: "anywhere",
            unicodeBidi: "plaintext",
          }}
        >
          {renderInlineRich(frame.content || frame.body)}
        </div>
      )}
      {frame.listItems && frame.listItems.length > 0 && (
        <ul className="mt-1 list-inside list-disc text-[12px] leading-relaxed text-lib-text-secondary">
          {frame.listItems.map((item, i) => (
            <li key={i}>{renderInlineRich(item)}</li>
          ))}
        </ul>
      )}
      {frame.clinicalPearl && (
        <div className="mt-2 rounded-md border border-lib-marked-bg bg-lib-marked-bg p-2 text-[11px] text-lib-marked">
          💡 {renderInlineRich(frame.clinicalPearl)}
        </div>
      )}
    </div>
  );
}

/* ── Main ── */
export interface NoteContentViewProps {
  note: QuestionNoteData;
  primaryAnchorFrameId?: string | null;
  supportingAnchorFrameIds?: string[];
  className?: string;
}

export function NoteContentView({
  note,
  primaryAnchorFrameId,
  supportingAnchorFrameIds,
  className,
}: NoteContentViewProps) {
  const primary = primaryAnchorFrameId ?? null;
  const supportingSet = useMemo(
    () => new Set(supportingAnchorFrameIds ?? []),
    [supportingAnchorFrameIds],
  );

  useEffect(() => {
    if (!primary) return;
    const raf = requestAnimationFrame(() => {
      document
        .getElementById(primary)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(raf);
  }, [primary, note]);

  return (
    <div dir="rtl" className={cn("py-3", className)}>
      {/* Breadcrumb / Meta */}
      <div className="mb-3 border-b border-lib-border px-4 pb-2.5">
        <p className="text-[11px] font-semibold leading-snug text-lib-accent">
          فصل {note.meta.chapterNo} &gt; بخش {note.meta.chunkIndex + 1}
        </p>
        <p className="mt-0.5 text-[13px] font-bold text-lib-text">{note.meta.chapterTitle}</p>
        {note.meta.pageRange && (
          <p className="mt-0.5 text-[10px] text-lib-text-muted">صفحات {note.meta.pageRange}</p>
        )}
      </div>
      {note.sections.map((s) => (
        <NoteSection
          key={s.id}
          section={s}
          primaryAnchorFrameId={primary}
          supportingAnchorFrameIds={supportingSet}
        />
      ))}
    </div>
  );
}
