// ──────────────────────────────────────────────────────────────
// Campbell Exam-Builder — typed helpers
// All data flows from the single JSON schema.
// ──────────────────────────────────────────────────────────────
import rawSchema from "./campbell-exam-builder.schema.json";
import type {
  ExamBuilderRoot,
  ExamBuilderSchema,
  ExamSubject,
  ExamSystem,
  ExamChapter,
  SchemaSection,
  SchemaOption,
  SelectionRules,
} from "./campbell-exam-builder.types";

const schema = (rawSchema as unknown as ExamBuilderRoot).examBuilder;

/* ── Schema access ───────────────────────────────────────────── */

export function getExamBuilderSchema(): ExamBuilderSchema {
  return schema;
}

export function getSchemaTitle(): string {
  return schema.title;
}

/* ── Section access ──────────────────────────────────────────── */

export function getSection(id: string): SchemaSection | undefined {
  return schema.sections.find((s) => s.id === id);
}

export function getSectionLabel(id: string): string {
  return getSection(id)?.label ?? id;
}

export function getTestModeOptions(): SchemaOption[] {
  return getSection("testMode")?.options ?? [];
}

export function getQuestionModeOptions(): SchemaOption[] {
  return getSection("questionMode")?.options ?? [];
}

export function getQuestionCountPresets(): number[] {
  return getSection("questionCount")?.presets ?? [10, 20, 40];
}

/** Whether the questionCount section allows custom (typed) values. */
export function isCustomQuestionCountAllowed(): boolean {
  return getSection("questionCount")?.custom ?? false;
}

/** Whether a given section has "selectAll" enabled. */
export function isSectionSelectAll(sectionId: string): boolean {
  return getSection(sectionId)?.selectAll ?? false;
}

/** Whether a given section has "expandAll" enabled. */
export function isSectionExpandAll(sectionId: string): boolean {
  return getSection(sectionId)?.expandAll ?? false;
}

/* ── Selection rules ─────────────────────────────────────────── */

export function getSelectionRules(): SelectionRules {
  return schema.selectionRules;
}

/* ── Subjects ────────────────────────────────────────────────── */

export function getAllSubjects(): ExamSubject[] {
  return schema.subjects ?? [];
}

export function getSubjectById(id: string): ExamSubject | undefined {
  return getAllSubjects().find((s) => s.id === id);
}

/** Total chapter count for a single subject (sum across its systems). */
export function getChapterCountForSubject(subjectId: string): number {
  const subject = getSubjectById(subjectId);
  if (!subject) return 0;
  return subject.systems.reduce((sum, sys) => sum + sys.chapterIds.length, 0);
}

/** Total system count for a single subject. */
export function getSystemCountForSubject(subjectId: string): number {
  const subject = getSubjectById(subjectId);
  return subject?.systems.length ?? 0;
}

/* ── Systems ─────────────────────────────────────────────────── */

export function getAllSystems(): ExamSystem[] {
  return getAllSubjects().flatMap((s) => s.systems ?? []);
}

export function getSystemsBySubjectIds(ids: string[]): ExamSystem[] {
  if (!ids.length) return [];
  const set = new Set(ids);
  return getAllSubjects()
    .filter((s) => set.has(s.id))
    .flatMap((s) => s.systems ?? []);
}

export function getSystemById(id: string): ExamSystem | undefined {
  return getAllSystems().find((s) => s.id === id);
}

/* ── Chapters ────────────────────────────────────────────────── */

export function getAllChapters(): ExamChapter[] {
  return schema.chapters ?? [];
}

export function getChapterById(id: string): ExamChapter | undefined {
  return getAllChapters().find((c) => c.id === id);
}

/**
 * Resolve chapters for the given system IDs.
 */
export function getChaptersBySystemIds(systemIds: string[]): ExamChapter[] {
  if (!systemIds.length) return [];
  const wanted = new Set(systemIds);
  const chapterIdSet = new Set<string>();

  for (const subject of schema.subjects) {
    for (const system of subject.systems) {
      if (wanted.has(system.id)) {
        for (const chId of system.chapterIds) chapterIdSet.add(chId);
      }
    }
  }
  return schema.chapters.filter((ch) => chapterIdSet.has(ch.id));
}

/**
 * Resolve chapters for the given subject IDs (all systems included).
 */
export function getChaptersBySubjectIds(subjectIds: string[]): ExamChapter[] {
  if (!subjectIds.length) return [];
  const systems = getSystemsBySubjectIds(subjectIds);
  return getChaptersBySystemIds(systems.map((s) => s.id));
}

/* ── Aggregate counts ────────────────────────────────────────── */

export function getTotalChapterCount(): number {
  return schema.chapters.length;
}

export function getTotalSystemCount(): number {
  return getAllSystems().length;
}

export function getChapterCountForSystem(systemId: string): number {
  const sys = getSystemById(systemId);
  return sys?.chapterIds.length ?? 0;
}

/**
 * Compute pool size (chapter-level). The finest grain is chapters;
 * when nothing is selected, the full schema is the pool.
 */
export function computePoolSize(
  selectedSubjectIds: string[],
  selectedSystemIds: string[],
  selectedChapterIds: string[],
): number {
  if (selectedChapterIds.length > 0) return selectedChapterIds.length;

  if (selectedSystemIds.length > 0) {
    const wanted = new Set(selectedSystemIds);
    let count = 0;
    for (const sub of schema.subjects) {
      for (const sys of sub.systems) {
        if (wanted.has(sys.id)) count += sys.chapterIds.length;
      }
    }
    return count;
  }

  if (selectedSubjectIds.length > 0) {
    const wanted = new Set(selectedSubjectIds);
    let count = 0;
    for (const sub of schema.subjects) {
      if (wanted.has(sub.id)) {
        for (const sys of sub.systems) count += sys.chapterIds.length;
      }
    }
    return count;
  }

  return schema.chapters.length;
}

/**
 * Validate whether the Create Test config is ready to start.
 * Returns `true` if *all* selectionRules.startRequires are met.
 */
export function isConfigValid(config: {
  testMode: string;
  questionMode: string;
  questionCount: number;
  poolSize: number;
}): boolean {
  return (
    config.testMode !== "" &&
    config.questionMode !== "" &&
    config.questionCount > 0 &&
    config.poolSize >= config.questionCount
  );
}

/** Return the chapter entry that matches a given chapter number (1–166). */
export function getChapterByNumber(chapterNo: number): ExamChapter | undefined {
  return getAllChapters().find((c) => c.chapterNo === chapterNo);
}

/**
 * Given a chapter number (e.g. 137 parsed from question ID "137-1q"),
 * return the subject ID, system ID, chapter ID, and chapter title for tagging.
 * Returns null if the chapter number is not found in the schema.
 */
export function chapterNumberToIds(chapterNo: number): {
  chapterId: string;
  subjectId: string;
  systemId: string;
  chapterTitle: string;
} | null {
  const chapterId = "ch-" + String(chapterNo).padStart(3, "0");
  for (const sub of getAllSubjects()) {
    for (const sys of sub.systems) {
      if (sys.chapterIds.includes(chapterId)) {
        const chapter = getAllChapters().find((c) => c.chapterNo === chapterNo);
        return {
          chapterId,
          subjectId: sub.id,
          systemId: sys.id,
          chapterTitle: chapter?.title ?? "",
        };
      }
    }
  }
  return null;
}

/**
 * Parse the first integer from a question ID string.
 * e.g. "137-1q" → 137, "137_2" → 137, "5-3q" → 5
 * Returns null if no valid chapter number (1–166) is found.
 */
export function parseChapterNumberFromId(id: string): number | null {
  const m = id.match(/^(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= 166 ? n : null;
}
