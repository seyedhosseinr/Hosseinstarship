// ──────────────────────────────────────────────────────────────
// Campbell Exam-Builder — TypeScript types derived from schema
// Single source of truth: campbell-exam-builder.schema.json
// ──────────────────────────────────────────────────────────────

/* ── Schema-level primitives ─────────────────────────────────── */

export interface SchemaTab {
  id: string;
  label: string;
  default?: boolean;
}

export interface SchemaOption {
  id: string;
  label: string;
  /** Key into statsTemplate.questionPools (question-mode only) */
  countKey?: string;
}

export interface SchemaSection {
  id: string;
  label: string;
  selection?: "single" | "multiple";
  selectAll?: boolean;
  expandAll?: boolean;
  options?: SchemaOption[];
  /** Question-count presets (e.g. [10, 20, 40, 60]) */
  presets?: number[];
  /** Whether the user can type a custom value */
  custom?: boolean;
}

/* ── Content hierarchy ───────────────────────────────────────── */

export interface ExamSystem {
  id: string;
  label: string;
  chapterIds: string[];
}

export interface ExamSubject {
  id: string;
  label: string;
  volume: string;
  part: string;
  chapterRange: [number, number];
  systems: ExamSystem[];
}

export interface ExamChapter {
  id: string;
  chapterNo: number;
  title: string;
  volume: string;
  subjectId: string;
  systemId: string;
  pageStart: number;
}

/* ── Rules & stats ───────────────────────────────────────────── */

export interface SelectionRules {
  testMode: string;
  questionMode: string;
  subjects: string;
  systems: string;
  chapters: string;
  defaultQuestionCountPresets: number[];
  startRequires: string[];
}

export interface StatsTemplate {
  questionPools: Record<string, number>;
  subjectCounts: Record<string, number>;
  systemCounts: Record<string, number>;
  chapterCounts: Record<string, number>;
}

/* ── Top-level schema ────────────────────────────────────────── */

export interface ExamBuilderSchema {
  version: string;
  title: string;
  tabs: SchemaTab[];
  sections: SchemaSection[];
  subjects: ExamSubject[];
  chapters: ExamChapter[];
  selectionRules: SelectionRules;
  statsTemplate: StatsTemplate;
}

/** Root shape of the JSON file: `{ "examBuilder": { … } }` */
export interface ExamBuilderRoot {
  examBuilder: ExamBuilderSchema;
}
