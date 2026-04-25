/**
 * YIELD Annotation Types
 *
 * YIELD is a structured high-yield annotation layer linked to chapter/segment
 * study content. It sits between NOTE and question practice in the study flow:
 *
 *   NOTE → YIELD → MCQ → FLASHCARD
 *
 * These types mirror the yield_annotations DB table and provide the normalized
 * view models used by the YIELD tab UI components.
 */

// ---------------------------------------------------------------------------
// Raw DB infer type (matches yield_annotations table shape)
// ---------------------------------------------------------------------------

export type YieldAnnotationRow = {
  id: string;
  chapterNo: number;
  segmentNo: number | null;
  sourceDocId: string | null;
  summaryLabel: string;
  /** Stored as JSON string in DB; parsed to string[] in view model */
  sourceSectionTitles: string[] | string;
  /** Stored as JSON string in DB; parsed to string[] in view model */
  sourceAnchorHints: string[] | string;
  /** Stored as JSON string in DB; parsed to string[] in view model */
  conceptLabels: string[] | string;
  /** Stored as JSON string in DB; parsed to string[] in view model */
  reasons: string[] | string;
  yieldTier: number;
  /** Integer boolean: 0 | 1 */
  keyExamInfo: number;
  /** Integer boolean: 0 | 1 */
  highYieldVisible: number;
  createdAt: number;
  updatedAt: number;
};

// ---------------------------------------------------------------------------
// Normalized view model — what UI components consume
// ---------------------------------------------------------------------------

export interface YieldCardViewModel {
  id: string;
  /** summaryLabel — primary visible title */
  title: string;
  /** First source section title — used as group header / subtitle */
  sectionTitle: string;
  /** All source section titles */
  allSectionTitles: string[];
  /** Anchor hints for jumping to source note section */
  anchorHints: string[];
  /** Neutral semantic concept tags */
  conceptLabels: string[];
  /** Action/exam/management oriented tags */
  reasons: string[];
  /** 1–3: importance tier */
  tier: number;
  /** true = this card covers a key exam question type */
  isKeyExam: boolean;
  /** true = mark as prominently high-yield */
  isHighYield: boolean;
  /** docId of source note document, or null for chapter-wide cards */
  sourceNoteId: string | null;
  chapterNo: number;
  segmentNo: number | null;
}

// ---------------------------------------------------------------------------
// Grouped by section (for YIELD tab display + sidebar navigation)
// ---------------------------------------------------------------------------

export interface YieldSectionGroup {
  /** The source section title that groups these cards */
  sectionTitle: string;
  cards: YieldCardViewModel[];
}

// ---------------------------------------------------------------------------
// Full view model passed to YieldTab component
// ---------------------------------------------------------------------------

export interface YieldViewModel {
  chapterNo: number;
  /** docId of the source note, or null if this is chapter-wide */
  docId: string | null;
  sections: YieldSectionGroup[];
  totalCards: number;
}
