// === URO Knowledge Contract v1.0.0 — TypeScript Types ===

// === Enums ===
export type ChoiceLetter = "A" | "B" | "C" | "D" | "E";
export type FrameKind =
  | "core" | "pearl" | "warning" | "pitfall" | "keypoint"
  | "concept" | "trap" | "threshold" | "indication" | "differential"
  | "algorithm" | "clinical_decision" | "complication" | "follow_up"
  | "high_yield" | "interactive_algorithm";
export type SectionHook = "بالینی" | "آماری" | "باور غلط" | "سوال چالشی" | "مقایسه‌ای" | "تشخیصی" | "درمانی";
export type LinkRelationType = "primary" | "supporting" | "extended";
export type LinkStatus = "active" | "stale" | "orphaned" | "needs_review";
export type ValidationLevel = "L1_structural" | "L2_semantic" | "L3_crosslink" | "L4_quality";
export type IngestStatus = "active" | "superseded" | "draft" | "rejected";
export type BatchStatus = "pending" | "processing" | "completed" | "failed" | "rolled_back";

// === Document Types ===
export interface NoteMeta {
  docId: string;
  logicalChunkId: string;
  version: number;
  chapterNo: number;
  chapterTitle: string;
  chunkIndex: number;
  pageRange: string | null;
  sourceType: "campbell";
  language: "fa";
  generatedAt: string;
  generatorVersion: string;
}

export interface NoteFrame {
  id: string;
  kind: FrameKind;
  title: string;
  summary: string | null;
  body: string;
  marginNote: string | null;
}

export interface NoteSection {
  id: string;
  title: string;
  hook: SectionHook | null;
  frames: NoteFrame[];
  closingKeypoint: string | null;
}

export interface FrameAnchor {
  id: string;
  title: string;
  kind: FrameKind;
}

export interface SectionAnchor {
  id: string;
  title: string;
  frames: FrameAnchor[];
}

export interface AnchorIndex {
  docId: string;
  sections: SectionAnchor[];
}

export interface NoteDocument {
  meta: NoteMeta;
  sections: NoteSection[];
  anchors: AnchorIndex;
}

// === Question Types ===
export interface QuestionChoice {
  letter: ChoiceLetter;
  text: string;
}

export interface Question {
  questionId: string;
  chapterNo: number;
  chunkIndex: number;
  logicalChunkId: string;
  stem: string;
  choices: QuestionChoice[];
  correctAnswer: ChoiceLetter;
  explanation: string;
  linkedDocId: string;
  primaryAnchorId: string;
  supportingAnchorIds: string[];
  difficulty: "easy" | "medium" | "hard" | null;
  tags: string[];
}

// === Link Types ===
export interface QuestionNoteLink {
  linkId: string;
  questionId: string;
  docId: string;
  frameId: string;
  relationType: LinkRelationType;
  linkStatus: LinkStatus;
  linkedAt: string;
}

// === Validation Types ===
export interface ValidationIssue {
  level: ValidationLevel;
  severity: "error" | "warning";
  code: string;
  message: string;
  location: {
    docId?: string;
    sectionId?: string;
    frameId?: string;
    questionId?: string;
    linkId?: string;
  };
}

export interface ValidationSummary {
  documentsValidated: number;
  questionsValidated: number;
  linksValidated: number;
  errorsFound: number;
  warningsFound: number;
  reviewMarkersFound: number;
}

export interface ValidationReport {
  status: "passed" | "passed_with_warnings" | "failed";
  validatedAt: string;
  levelsExecuted: ValidationLevel[];
  summary: ValidationSummary;
  issues: ValidationIssue[];
}

// === Contract Envelope ===
export interface KnowledgeContract {
  contractVersion: "1.0.0";
  schemaVersion: "note-mvp-v1";
  generatedBy: "uro-zero-compiler";
  generatedAt: string;
  sourceId: string;
  documents: NoteDocument[];
  questions: Question[];
  links: QuestionNoteLink[];
  validation: ValidationReport;
}
