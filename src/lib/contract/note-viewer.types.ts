import type { FrameKind, LinkRelationType } from "./types";
import type { BlockDisplayV8, BlockFlagsV8 } from "./note-v8.types";

export interface LinkedQuestionPreview {
  questionId: string;
  stem: string;
  relationType: LinkRelationType;
}

// v7.2 interactive algorithm types
export interface InteractiveAlgorithmOption {
  label: string;
  nextStepId: string;
  explanation?: string;
}

export interface InteractiveAlgorithmStep {
  stepId: string;
  type: "question" | "action" | "result";
  text: string;
  explanation?: string;
  finalMessage?: string;
  options?: InteractiveAlgorithmOption[];
}

export interface InteractiveAlgorithmData {
  initialStepId: string;
  steps: InteractiveAlgorithmStep[];
}

// v7.2 table data
export interface TableDataCell {
  text: string;
  bold?: boolean;
}

export interface TableData {
  headers: string[];
  rows: TableDataCell[][];
}

export interface FrameViewModel {
  id: string;
  kind: FrameKind;
  title: string;
  summary: string | null;
  body: string;
  marginNote: string | null;
  linkedQuestions: LinkedQuestionPreview[];
  // v7.2 extended fields (renderer consumes these; populated from v8 payload
  // or left undefined for legacy rows).
  content?: string;
  listItems?: string[];
  tableData?: TableData;
  mermaid?: string;
  highYield?: boolean;
  clinicalPearl?: string;
  interactiveData?: InteractiveAlgorithmData;
  // v8.1 additive fields — raw v8 payload for consumers that want it.
  // "7.5" | "8.0" | undefined (undefined = pre-v8.1 legacy row).
  schemaVersion?: "7.5" | "8.0";
  /** sha256 digest of the canonical content. Used by the anchoring layer. */
  contentHash?: string;
  /** Raw v8 display payload, if this frame was persisted as v8. */
  v8Display?: BlockDisplayV8;
  /** Raw v8 flags, if this frame was persisted as v8. */
  v8Flags?: BlockFlagsV8;
  /**
   * True when display carries panes that re-format content (list/table/
   * interactive). Used by the renderer to pick duplication-safe mode.
   */
  hasStructuralReformat?: boolean;
}

export interface SectionViewModel {
  id: string;
  title: string;
  hook: string | null;
  closingKeypoint: string | null;
  frames: FrameViewModel[];
}

export interface TocFrameItem {
  frameId: string;
  title: string;
  kind: FrameKind;
}

export interface TocItem {
  sectionId: string;
  title: string;
  frameCount: number;
  frames: TocFrameItem[];
}

export interface NoteStats {
  totalFrames: number;
  totalQuestions: number;
  framesByKind: Record<FrameKind, number>;
}

export interface NoteViewerModel {
  meta: {
    docId: string;
    logicalChunkId: string;
    chapterNo: number;
    chapterTitle: string;
    chunkIndex: number;
    pageRange: string | null;
    version: number;
    generatedAt: string;
  };
  toc: TocItem[];
  sections: SectionViewModel[];
  stats: NoteStats;
}

export interface NoteSearchResult {
  frameId: string;
  docId: string;
  frameTitle: string;
  sectionTitle: string;
  chapterTitle: string;
  snippet: string;
  kind: FrameKind;
}

export interface NoteDocumentListItem {
  docId: string;
  chapterNo: number;
  chapterTitle: string;
  chunkIndex: number;
  generatedAt: string;
  pageRange: string | null;
  frameCount: number;
}
