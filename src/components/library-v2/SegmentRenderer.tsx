"use client";

import type { CSSProperties } from "react";
import type {
  FrameViewModel,
  SectionViewModel,
} from "@/lib/contract/note-viewer.types";
import type { ReaderAnnotation } from "@/hooks/useReaderAnnotations";
import { renderInlineRich } from "@/components/note-viewer/inlineRich";
import { FrameCardV2 } from "./FrameCardV2";
import { SectionHeader } from "./SectionHeader";
import { SectionNoteEditor } from "@/components/note-viewer/SectionNoteEditor";

/** Optional context that enables the inline section-level note affordance. */
interface NoteContext {
  docId: string;
  chapterNo: number | null;
}

interface SegmentRendererProps {
  sections: SectionViewModel[];
  initialFrameId?: string | null;
  annotationsByFrameId?: Map<string, ReaderAnnotation[]>;
  annotationCountByFrameId?: Map<string, number>;
  highlightsVisible?: boolean;
  showHighYieldMarker?: boolean;
  keyExamFrameIds?: Set<string>;
  missedFrameIds?: Set<string>;
  showKeyExam?: boolean;
  showMissedQuestions?: boolean;
  /**
   * When provided, renders an inline "یادداشت مطالعاتی…" affordance below
   * each section. Notes are stored via the same user-notes CRUD layer and
   * share the same docId as the overview side-panel — no duplication.
   */
  noteContext?: NoteContext;
}

type ReaderCSS = CSSProperties & {
  textWrap?: "balance" | "pretty" | "wrap" | "nowrap";
  unicodeBidi?:
    | "normal"
    | "embed"
    | "isolate"
    | "bidi-override"
    | "isolate-override"
    | "plaintext";
};

const CLOSING_KEYPOINT_BODY_STYLE: ReaderCSS = {
  textAlign: "start",
  textWrap: "pretty",
  overflowWrap: "break-word",
  wordBreak: "normal",
  lineBreak: "auto",
};

function normaliseForCompare(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/\*\*|`|~~|_/g, "")
    .replace(/^key\s*takeaway\s*[—–-]?\s*/i, "")
    .replace(/^\s*[—–-]+\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isNearDuplicate(a: string | null | undefined, b: string | null | undefined): boolean {
  const aa = normaliseForCompare(a);
  const bb = normaliseForCompare(b);
  if (!aa || !bb) return false;
  if (aa === bb) return true;
  if (aa.length >= 18 && bb.includes(aa)) return true;
  if (bb.length >= 18 && aa.includes(bb)) return true;
  return false;
}

function frameAlreadyCoversClosingKeypoint(
  frame: FrameViewModel,
  closingKeypoint: string,
): boolean {
  return [
    frame.title,
    frame.summary,
    frame.content,
    frame.body,
    frame.marginNote,
  ].some((candidate) => isNearDuplicate(candidate, closingKeypoint));
}

function shouldRenderClosingKeypoint(section: SectionViewModel): boolean {
  if (!section.closingKeypoint) return false;
  return !section.frames.some((frame) =>
    frameAlreadyCoversClosingKeypoint(frame, section.closingKeypoint!),
  );
}

export function SegmentRenderer({
  sections,
  initialFrameId,
  annotationsByFrameId,
  annotationCountByFrameId,
  highlightsVisible,
  showHighYieldMarker,
  keyExamFrameIds,
  missedFrameIds,
  showKeyExam,
  showMissedQuestions,
  noteContext,
}: SegmentRendererProps) {
  return (
    <>
      {sections.map((section, si) => {
        const renderClosingKeypoint = shouldRenderClosingKeypoint(section);

        return (
          <section
            key={section.id}
            id={section.id}
            data-section-id={section.id}
            className="scroll-mt-24"
          >
            <SectionHeader title={section.title} hook={section.hook} index={si + 1} />

            <div className="space-y-1.5">
              {section.frames.map((frame) => (
                <FrameCardV2
                  key={frame.id}
                  frame={frame}
                  isHighlighted={
                    initialFrameId !== undefined ? frame.id === initialFrameId : undefined
                  }
                  annotationCount={annotationCountByFrameId?.get(frame.id) ?? 0}
                  annotations={annotationsByFrameId?.get(frame.id)}
                  highlightsVisible={highlightsVisible}
                  showHighYieldMarker={showHighYieldMarker}
                  isKeyExamFrame={
                    showKeyExam === undefined
                      ? undefined
                      : showKeyExam && !!keyExamFrameIds?.has(frame.id)
                  }
                  isMissedFrame={
                    showMissedQuestions === undefined
                      ? undefined
                      : showMissedQuestions && !!missedFrameIds?.has(frame.id)
                  }
                />
              ))}
            </div>

            {noteContext && (
              <SectionNoteEditor
                docId={noteContext.docId}
                sectionId={section.id}
                chapterNo={noteContext.chapterNo}
              />
            )}

            {renderClosingKeypoint && section.closingKeypoint && (
              <section
                dir="rtl"
                data-section-closing-keypoint
                className={[
                  "mt-4 rounded-[8px] border-s-[3px]",
                  "border-y border-e border-black/[0.04] dark:border-white/[0.04]",
                  "border-s-[rgb(52,125,62)] dark:border-s-emerald-400/80",
                  "bg-[rgba(209,232,210,0.28)] dark:bg-[rgba(45,78,48,0.22)]",
                  "px-4 py-3.5",
                ].join(" ")}
              >
                <div className="mb-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <span
                    dir="ltr"
                    className={[
                      "inline-flex items-center rounded-[4px] px-[6px] py-[1px]",
                      "border border-lib-border/50 bg-lib-surface/75 dark:bg-lib-surface/30",
                      "text-[9.5px] font-[700] leading-[1.6] tracking-[0.08em] uppercase",
                      "text-[rgb(44,105,52)] dark:text-emerald-300",
                    ].join(" ")}
                  >
                    Key takeaway
                  </span>
                </div>

                <div
                  className={[
                    "text-[14.5px] leading-[1.85] text-lib-text",
                    "[&_strong]:font-[720] [&_strong]:text-lib-text/95",
                    "[&_em]:italic",
                    "[&_code]:rounded-[4px] [&_code]:border [&_code]:border-lib-border/40",
                    "[&_code]:bg-lib-hover/60 [&_code]:px-1 [&_code]:py-[1px]",
                    "[&_code]:font-mono [&_code]:text-[0.9em]",
                  ].join(" ")}
                  style={CLOSING_KEYPOINT_BODY_STYLE}
                >
                  {renderInlineRich(section.closingKeypoint)}
                </div>
              </section>
            )}
          </section>
        );
      })}
    </>
  );
}