import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";

import { getDb } from "@/db/index";
import { parseCSV } from "@/lib/import/parsers";
import { getCampbellChapter } from "@/lib/library/campbell";
import { isNoteV8Json, SegmentNoteV8Z } from "@/lib/contract/note-v8-schema";
import type { BlockV8, SegmentNoteV8 } from "@/lib/contract/note-v8.types";
import { upgradeSegmentV7ToV8 } from "@/lib/contract/note-v7-to-v8";
import {
  chapters,
  chunkKind,
  chunks,
  contractChapters,
  flashcardCreatedFrom,
  flashcardStatus,
  flashcardType,
  flashcards,
  importStatus,
  imports,
  noteDocuments,
  noteFrames,
  noteSections,
  questionOptions,
  questionType,
  questions,
  yieldAnnotations,
} from "@/db/schema";

export type StructuredImportContentType = "notes" | "questions" | "flashcards" | "yield";
export type StructuredImportFormat = "json" | "csv" | "html";

export type StructuredImportResult = {
  importId: string;
  importedCount: number;
  skippedCount: number;
  errors: string[];
};

type NormalizedOption = {
  key: string;
  content: string;
  isCorrect: boolean;
};

type NormalizedQuestion = {
  chapterNo: number;
  stemHtml: string;
  stemText: string;
  explanationHtml: string | null;
  subject: string | null;
  difficulty: string | null;
  tags: string[] | null;
  chunkSlug: string | null;
  externalKey: string;
  options: NormalizedOption[];
  sourceBlockIds: string[];
};

type NormalizedFlashcard = {
  chapterNo: number | null;
  chunkSlug: string | null;
  deck: string | null;
  frontHtml: string;
  backHtml: string;
  tags: string[] | null;
  sourceBlockIds: string[];
  sourceJson: Record<string, unknown> | null;
  cardType: (typeof flashcardType)[keyof typeof flashcardType];
};

type FlashcardWrapperContext = {
  chapterNo?: number | null;
  segmentId?: string | null;
};

type NormalizedNoteFrame = {
  frameId?: string;
  kind: string;
  title: string;
  body: string;
  summary: string | null;
  // ── v8.1 additive fields (optional; undefined for legacy/v7.5 paths) ──
  schemaVersion?: "7.5" | "8.0" | null;
  contentHash?: string | null;
  /** Serialized v8 BlockDisplayV8 JSON. Null/undefined for non-v8 rows. */
  displayJson?: string | null;
  /** Serialized v8 BlockFlagsV8 JSON. Null/undefined for non-v8 rows. */
  flagsJson?: string | null;
  // ── v8.2 pushdown booleans (0/1). Null for rows where unknown. ──
  hasMermaid?: number | null;
  highYield?: number | null;
  decisionChanging?: number | null;
  examRelevant?: number | null;
};

type NormalizedNoteSection = {
  title: string;
  hook: string | null;
  closingKeypoint: string | null;
  frames: NormalizedNoteFrame[];
};

type NormalizedNote = {
  chapterNo: number;
  chapterTitle: string;
  chunkIndex: number;
  title: string;
  slug: string;
  notesHtml: string | null;
  plainText: string;
  pageStart: number | null;
  pageEnd: number | null;
  sections: NormalizedNoteSection[];
};

type NormalizedYieldCard = {
  id: string;
  chapterNo: number;
  segmentNo: number | null;
  sourceDocId: string | null;
  summaryLabel: string;
  sourceSectionTitles: string[];
  sourceAnchorHints: string[];
  conceptLabels: string[];
  reasons: string[];
  yieldTier: number;
  keyExamInfo: number;
  highYieldVisible: number;
};

const IMPORT_SOURCE_ID = "browser-structured-upload";
const GENERAL_UPLOAD_CHAPTER_NO = 0;

/**
 * Infer Campbell chapter number from a filename.
 * Priority order:
 *   1. Explicit "ch<N>" or "chapter_<N>" prefix/infix (e.g. ch95_seg01_q.json, chapter_95_questions.json, ch095.json)
 *   2. Leading digits separated by _ or - (e.g. 95-1q.json, 95_1q.json)
 *   3. Trailing 2-3 digit number separated by _ or - (e.g. questions_ch-95.json — handled by rule 1, but also notes_095.json)
 * Returns null if no valid chapter number in range [1,200] can be inferred.
 */
function inferChapterNoFromFileName(fileName: string): number | null {
  const baseName = fileName.replace(/\.[^.]+$/, "");

  // Priority 1: explicit "ch<N>" or "chapter_<N>" prefix or infix
  const chNameMatch = baseName.match(/(?:ch(?:apter)?[_-]?)(\d{1,3})/i);
  if (chNameMatch?.[1]) {
    const n = parseInt(chNameMatch[1], 10);
    if (n > 0 && n <= 200) return n;
  }

  // Priority 2: leading digits before _ or - (e.g. "95-1q", "95_1q")
  const leadingMatch = baseName.match(/^(\d{1,3})[_-]/);
  if (leadingMatch?.[1]) {
    const n = parseInt(leadingMatch[1], 10);
    if (n > 0 && n <= 200) return n;
  }

  // Priority 3: trailing 2-3 digit number (require >=2 digits to avoid single-digit segment nos)
  const trailingMatch = baseName.match(/[_-](\d{2,3})(?:[_-]|$)/);
  if (trailingMatch?.[1]) {
    const n = parseInt(trailingMatch[1], 10);
    if (n > 0 && n <= 200) return n;
  }

  return null;
}

function parseChapterNoFromSegmentId(segmentId: string | null | undefined): number | null {
  if (!segmentId) return null;
  return parseInteger(segmentId.split("_")[0], null);
}

function nowMs() {
  return Date.now();
}

function makeId(prefix: string, seed: string) {
  const hash = createHash("sha1").update(seed).digest("hex").slice(0, 18);
  return `${prefix}_${hash}`;
}

function jsonField<T>(value: T | null): T | null {
  return (value == null ? null : JSON.stringify(value)) as unknown as T | null;
}

function stripHtml(value: string) {
  return value
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toParagraphHtml(value: string) {
  const normalized = value.trim();
  if (!normalized) return "";

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

function parseInteger(value: unknown, fallback: number | null = null): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeTextArray(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const tags = value.map((entry) => String(entry).trim()).filter(Boolean);
    return tags.length > 0 ? tags : null;
  }

  if (typeof value === "string" && value.trim()) {
    const tags = value
      .split(/[;,|]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    return tags.length > 0 ? tags : null;
  }

  return null;
}

function normalizeQuestionType(
  value?: string | null,
): (typeof questionType)[keyof typeof questionType] {
  const normalized = (value ?? "").trim();
  return (
    Object.values(questionType).includes(normalized as (typeof questionType)[keyof typeof questionType])
      ? normalized
      : questionType.singleBestAnswer
  ) as (typeof questionType)[keyof typeof questionType];
}

function normalizeFlashcardType(
  value?: string | null,
): (typeof flashcardType)[keyof typeof flashcardType] {
  const normalized = (value ?? "").trim();
  return (
    Object.values(flashcardType).includes(normalized as (typeof flashcardType)[keyof typeof flashcardType])
      ? normalized
      : flashcardType.basic
  ) as (typeof flashcardType)[keyof typeof flashcardType];
}

function normalizeChunkKind(
  value?: string | null,
): (typeof chunkKind)[keyof typeof chunkKind] {
  const normalized = (value ?? "").trim();
  return (
    Object.values(chunkKind).includes(normalized as (typeof chunkKind)[keyof typeof chunkKind])
      ? normalized
      : chunkKind.notes
  ) as (typeof chunkKind)[keyof typeof chunkKind];
}

function optionKeyAt(index: number) {
  return String.fromCharCode(65 + index);
}

function readJsonCollection(rawText: string): Record<string, unknown>[] {
  const parsed = JSON.parse(rawText) as unknown;

  if (Array.isArray(parsed)) {
    return parsed.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object");
  }

  if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>;
    for (const key of ["items", "data", "notes", "documents", "questions", "flashcards", "cards"]) {
      const value = record[key];
      if (Array.isArray(value)) {
        return value.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object");
      }
    }

    return [record];
  }

  throw new Error("JSON payload must be an object or array.");
}

function deriveTitleFromHtml(rawHtml: string, fallback: string) {
  const headingMatch =
    rawHtml.match(/<h1[^>]*>(.*?)<\/h1>/i) ??
    rawHtml.match(/<title[^>]*>(.*?)<\/title>/i) ??
    rawHtml.match(/<h2[^>]*>(.*?)<\/h2>/i);

  if (headingMatch?.[1]) {
    const title = stripHtml(headingMatch[1]);
    if (title) return title;
  }

  return fallback;
}

function looksLikeHtml(rawText: string) {
  const trimmed = rawText.trimStart();

  return (
    /^<!doctype\s+html/i.test(trimmed) ||
    /^<\/?(html|body|section|article|main|header|footer|div|p|h[1-6]|ul|ol|table|figure|aside|span)\b/i.test(trimmed)
  );
}

async function ensureChapterRecord(chapterNo: number, titleHint?: string | null) {
  const db = await getDb();
  const existing = await db.query.chapters.findFirst({
    where: eq(chapters.chapterNo, chapterNo),
    columns: { id: true, title: true },
  });

  if (existing) {
    return existing;
  }

  const chapterMeta = chapterNo > 0 ? getCampbellChapter(chapterNo) : null;
  const title = titleHint?.trim() || chapterMeta?.title || `Imported Chapter ${chapterNo}`;
  const slug = `imported-${chapterNo}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;

  const values = {
    id: makeId("chapter", `${IMPORT_SOURCE_ID}|${chapterNo}`),
    volumeNo: chapterMeta?.volume ?? 0,
    partNo: null,
    partTitle: chapterMeta?.part ?? "Structured Upload",
    sectionTitle: null,
    chapterNo,
    title,
    slug,
    pageStart: chapterMeta?.start_page ?? null,
    pageEnd: chapterMeta?.end_page ?? null,
    sourceBook: chapterMeta ? "Campbell-Walsh-Wein" : "Structured Upload",
    sourceEdition: chapterMeta ? "13" : "1",
    isActive: 1,
    createdAt: nowMs(),
    updatedAt: nowMs(),
  };

  await db.insert(chapters).values(values);
  return { id: values.id, title: values.title };
}

async function ensureContractChapterRecord(chapterNo: number, chapterTitle: string) {
  const db = await getDb();
  const existing = await db.query.contractChapters.findFirst({
    where: eq(contractChapters.chapterNo, chapterNo),
    columns: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  const id = makeId("contract_chapter", `${IMPORT_SOURCE_ID}|${chapterNo}`);
  await db.insert(contractChapters).values({
    id,
    sourceId: IMPORT_SOURCE_ID,
    chapterNo,
    chapterTitle,
    createdAt: nowMs(),
  });

  return id;
}

async function createImportRow(params: {
  sourceName: string;
  fileName: string;
  sourceType: string;
  contentType: StructuredImportContentType;
  fileType: StructuredImportFormat;
}) {
  const db = await getDb();
  const timestamp = nowMs();
  const importId = makeId(
    "imp",
    `${params.sourceName}|${params.fileName}|${params.contentType}|${params.fileType}|${timestamp}`,
  );

  await db.insert(imports).values({
    id: importId,
    sourceName: params.sourceName,
    sourceType: params.sourceType,
    sourceVersion: null,
    schemaVersion: "dna-v3.1",
    status: importStatus.running,
    inputPath: null,
    manifestJson: null,
    errorMessage: null,
    fileName: params.fileName,
    fileType: params.fileType,
    contentType: params.contentType,
    itemCount: 0,
    startedAt: timestamp,
    completedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return importId;
}

async function completeImportRow(importId: string, totalItems: number) {
  const db = await getDb();
  await db
    .update(imports)
    .set({
      status: importStatus.completed,
      itemCount: totalItems,
      completedAt: nowMs(),
      updatedAt: nowMs(),
      errorMessage: null,
    })
    .where(eq(imports.id, importId));
}

async function failImportRow(importId: string, errorMessage: string) {
  const db = await getDb();
  await db
    .update(imports)
    .set({
      status: importStatus.failed,
      errorMessage,
      completedAt: nowMs(),
      updatedAt: nowMs(),
    })
    .where(eq(imports.id, importId));
}

// Exported for pinning tests. Pure function: normalizes raw option + answer
// data into the canonical `NormalizedOption[]`. The numeric `answerValue`
// branch is intentionally 0-based; if upstream sources ever ship 1-based
// numeric answers they MUST be converted before reaching this function.
export function normalizeQuestionOptions(
  raw: Record<string, unknown>,
  rawOptions: unknown,
  answerValue: unknown,
): NormalizedOption[] {
  let options: Array<string | Record<string, unknown>> = [];

  if (Array.isArray(rawOptions)) {
    options = rawOptions as Array<string | Record<string, unknown>>;
  } else if (rawOptions && typeof rawOptions === "object" && !Array.isArray(rawOptions)) {
    // Handle keyed object format: { A: "...", B: "...", C: "...", D: "...", E: "..." }
    // This is the format produced by the MCQ pipeline (question-system.md v4.0)
    const keyed = rawOptions as Record<string, unknown>;
    const letterKeys = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const fromKeyed = letterKeys
      .filter((k) => keyed[k] != null && String(keyed[k]).trim())
      .map((k) => String(keyed[k]).trim());
    if (fromKeyed.length >= 2) {
      options = fromKeyed;
    } else {
      // Fallback: try extracting from nested objects with content/text fields
      const fromNested = letterKeys
        .map((k) => keyed[k])
        .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
        .map((v) => v as Record<string, unknown>);
      if (fromNested.length >= 2) {
        options = fromNested;
      }
    }
  }

  if (options.length === 0) {
    // Legacy fallback: try optionA/optionB/... fields on the raw question object
    const collected = [
      raw.optionA ?? raw.a ?? raw["option_a"],
      raw.optionB ?? raw.b ?? raw["option_b"],
      raw.optionC ?? raw.c ?? raw["option_c"],
      raw.optionD ?? raw.d ?? raw["option_d"],
      raw.optionE ?? raw.e ?? raw["option_e"],
    ].filter((value) => value != null && String(value).trim());
    options = collected as Array<string | Record<string, unknown>>;
  }

  const correctIndexFromNumber = parseInteger(answerValue, null);
  const correctKeyFromString =
    typeof answerValue === "string" && answerValue.trim() ? answerValue.trim().toUpperCase() : null;

  return options
    .map((option, index) => {
      if (typeof option === "string") {
        const key = optionKeyAt(index);
        return {
          key,
          content: option.trim(),
          isCorrect:
            correctIndexFromNumber === index ||
            correctKeyFromString === key ||
            correctKeyFromString === String(index),
        };
      }

      const record = option as Record<string, unknown>;
      const key = String(record.optionKey ?? record.key ?? optionKeyAt(index)).trim().toUpperCase();
      const content = String(record.contentHtml ?? record.contentText ?? record.text ?? record.content ?? "")
        .trim();
      const explicitCorrect = record.isCorrect === true || record.correct === true;

      return {
        key,
        content,
        isCorrect:
          explicitCorrect ||
          correctIndexFromNumber === index ||
          correctKeyFromString === key ||
          correctKeyFromString === String(index),
      };
    })
    .filter((option) => option.content);
}

function normalizeQuestionRecord(
  raw: Record<string, unknown>,
  index: number,
  fileName: string,
): NormalizedQuestion {
  const stemHtml = String(
    raw.text ?? raw.stemHtml ?? raw.stem ?? raw.question ?? raw.prompt ?? "",
  ).trim();
  if (!stemHtml) {
    throw new Error(`Row ${index + 1} is missing question text.`);
  }

  const options = normalizeQuestionOptions(raw, raw.options, raw.correctAnswer ?? raw.answer ?? raw.correct ?? raw.correctOption ?? raw.correct_answer);
  if (options.length < 2) {
    throw new Error(`Row ${index + 1} must contain at least two options.`);
  }
  if (!options.some((option) => option.isCorrect)) {
    throw new Error(`Row ${index + 1} is missing a valid correct answer.`);
  }

  const segmentId = String(raw.segmentId ?? raw.segment_id ?? "").trim() || null;
  const chunkSlug =
    String(raw.chunkSlug ?? raw.chunk_slug ?? raw.logicalChunkId ?? "").trim() ||
    segmentId ||
    null;
  const explicitChapterNo = parseInteger(raw.chapterNo ?? raw.chapter_no ?? raw.chapter, null);
  const chapterNo =
    explicitChapterNo ??
    parseInteger(segmentId?.split("_")[0], null) ??
    inferChapterNoFromFileName(fileName) ??
    GENERAL_UPLOAD_CHAPTER_NO;
  const stemText = String(raw.stemText ?? stripHtml(stemHtml));
  const explicitKey = String(raw.externalKey ?? raw.key ?? "").trim();
  const rawId = String(raw.id ?? "").trim();
  const externalKey =
    explicitKey ||
    (segmentId && rawId ? `${segmentId}:${rawId}` : rawId) ||
    makeId("question_key", `${fileName}|${chapterNo}|${stemText}|${options.map((option) => option.content).join("|")}`);

  return {
    chapterNo,
    stemHtml,
    stemText,
    explanationHtml: raw.explanation != null || raw.explanationHtml != null
      ? String(raw.explanationHtml ?? raw.explanation)
      : null,
    subject: raw.subject != null ? String(raw.subject).trim() || null : null,
    difficulty: raw.difficulty != null ? String(raw.difficulty).trim() || null : null,
    tags: normalizeTextArray(raw.tags),
    chunkSlug,
    externalKey,
    options,
    sourceBlockIds: normalizeTextArray(raw.sourceBlockIds ?? raw.source_block_ids) ?? [],
  };
}

function normalizeFlashcardRecord(
  raw: Record<string, unknown>,
  index: number,
  fileName: string,
  wrapperContext?: FlashcardWrapperContext,
): NormalizedFlashcard {
  const frontHtml = String(raw.frontHtml ?? raw.front ?? raw.question ?? "").trim();
  const backHtml = String(raw.backHtml ?? raw.back ?? raw.answer ?? "").trim();
  if (!frontHtml || !backHtml) {
    throw new Error(`Row ${index + 1} must include front and back content.`);
  }

  const segmentId = String(raw.segmentId ?? raw.segment_id ?? "").trim() || null;
  const sourceBlockIds = normalizeTextArray(raw.sourceBlockIds ?? raw.source_block_ids) ?? [];
  const chapterNo =
    parseInteger(raw.chapterNo ?? raw.chapter_no ?? raw.chapter, null) ??
    parseChapterNoFromSegmentId(segmentId) ??
    (wrapperContext?.chapterNo ?? null) ??
    parseChapterNoFromSegmentId(wrapperContext?.segmentId ?? null) ??
    inferChapterNoFromFileName(fileName);
  const conceptLabels = normalizeTextArray(raw.conceptLabels ?? raw.concept_labels);
  const firstConceptLabel = conceptLabels?.[0] ?? null;
  const deckCandidates = [
    raw.deck,
    raw.subject,
    raw.clusterLabel,
    raw.parentConceptLabel,
    firstConceptLabel,
    chapterNo != null ? `Chapter ${chapterNo}` : null,
  ];
  const deck =
    deckCandidates
      .map((candidate) => (candidate == null ? null : String(candidate).trim()))
      .find((candidate) => candidate) ?? null;

  const sourceJson: Record<string, unknown> = {};
  const sourceJsonEntries: Array<[string, unknown]> = [
    ["segmentId", segmentId ?? wrapperContext?.segmentId ?? null],
    ["sourceBlockIds", sourceBlockIds.length > 0 ? sourceBlockIds : null],
    ["conceptLabels", conceptLabels ?? null],
    [
      "parentConceptLabel",
      raw.parentConceptLabel != null ? String(raw.parentConceptLabel).trim() || null : null,
    ],
    ["clusterLabel", raw.clusterLabel != null ? String(raw.clusterLabel).trim() || null : null],
    ["descriptorLabel", raw.descriptorLabel != null ? String(raw.descriptorLabel).trim() || null : null],
    ["sourceSectionTitles", normalizeTextArray(raw.sourceSectionTitles ?? raw.source_section_titles)],
    ["sourceAnchorHints", normalizeTextArray(raw.sourceAnchorHints ?? raw.source_anchor_hints)],
    ["relatedQuestionHints", normalizeTextArray(raw.relatedQuestionHints ?? raw.related_question_hints)],
    ["relatedFlashcardHints", normalizeTextArray(raw.relatedFlashcardHints ?? raw.related_flashcard_hints)],
  ];
  for (const [key, value] of sourceJsonEntries) {
    if (Array.isArray(value) ? value.length > 0 : value != null) {
      sourceJson[key] = value;
    }
  }

  return {
    chapterNo,
    chunkSlug:
      String(raw.chunkSlug ?? raw.chunk_slug ?? raw.logicalChunkId ?? "").trim() ||
      segmentId ||
      wrapperContext?.segmentId ||
      null,
    deck,
    frontHtml,
    backHtml,
    tags: normalizeTextArray(raw.tags),
    sourceBlockIds,
    sourceJson: Object.keys(sourceJson).length > 0 ? sourceJson : null,
    cardType: normalizeFlashcardType(
      typeof raw.type === "string" ? raw.type : typeof raw.cardType === "string" ? raw.cardType : null,
    ),
  };
}

function buildNoteSectionsFromRecord(
  raw: Record<string, unknown>,
  fallbackTitle: string,
  bodyHtml: string | null,
  bodyText: string,
): NormalizedNoteSection[] {
  const sectionRecords = Array.isArray(raw.sections)
    ? (raw.sections as Record<string, unknown>[])
    : Array.isArray(raw.frames)
      ? [{ title: raw.title ?? fallbackTitle, frames: raw.frames }]
      : [];

  if (sectionRecords.length === 0) {
    const summary = bodyText.slice(0, 220) || null;
    return [
      {
        title: fallbackTitle,
        hook: fallbackTitle,
        closingKeypoint: bodyText.split("\n").filter(Boolean).slice(-1)[0] ?? null,
        frames: [
          {
            kind: "core",
            title: fallbackTitle,
            body: bodyText,
            summary,
          },
        ],
      },
    ];
  }

  return sectionRecords.map((section, sectionIndex) => {
    const frames = Array.isArray(section.frames)
      ? (section.frames as Record<string, unknown>[])
      : [section];
    const normalizedFrames = frames
      .map((frame, frameIndex) => {
        const title = String(frame.title ?? section.title ?? `${fallbackTitle} ${sectionIndex + 1}.${frameIndex + 1}`).trim();
        const frameBody = String(
          frame.body ?? frame.text ?? frame.content ?? frame.summary ?? "",
        ).trim();
        const plainBody = stripHtml(frameBody || bodyHtml || bodyText);

        return plainBody
          ? {
              kind: String(frame.kind ?? "core").trim() || "core",
              title: title || fallbackTitle,
              body: plainBody,
              summary: plainBody.slice(0, 220) || null,
            }
          : null;
      })
      .filter((frame): frame is NormalizedNoteFrame => frame != null);

    const sectionTitle = String(section.title ?? fallbackTitle).trim() || fallbackTitle;
    const fallbackFrameBody = bodyText.trim();

    return {
      title: sectionTitle,
      hook: String(section.hook ?? section.title ?? fallbackTitle).trim() || null,
      closingKeypoint:
        String(section.closingKeypoint ?? section.closing_keypoint ?? "").trim() ||
        fallbackFrameBody.split("\n").filter(Boolean).slice(-1)[0] ||
        null,
      frames:
        normalizedFrames.length > 0
          ? normalizedFrames
          : [
              {
                kind: "core",
                title: sectionTitle,
                body: fallbackFrameBody,
                summary: fallbackFrameBody.slice(0, 220) || null,
              },
            ],
    };
  });
}

function normalizeNoteRecord(
  raw: Record<string, unknown>,
  index: number,
  fileName: string,
): NormalizedNote {
  const title = String(raw.title ?? raw.name ?? raw.docTitle ?? `Imported Note ${index + 1}`).trim() || `Imported Note ${index + 1}`;
  const explicitChapterNo = parseInteger(raw.chapterNo ?? raw.chapter_no ?? raw.chapter, null);
  const chapterNo = explicitChapterNo ?? inferChapterNoFromFileName(fileName) ?? GENERAL_UPLOAD_CHAPTER_NO;
  const chapterTitle =
    String(raw.chapterTitle ?? raw.chapter_title ?? `Imported Chapter ${chapterNo}`).trim() ||
    `Imported Chapter ${chapterNo}`;
  const chunkIndex = parseInteger(raw.chunkIndex ?? raw.segmentNo ?? raw.segment_no ?? raw.index, index) ?? index;
  const notesHtmlRaw =
    raw.notesHtml != null || raw.html != null || raw.contentHtml != null
      ? String(raw.notesHtml ?? raw.html ?? raw.contentHtml)
      : null;
  const plainText =
    String(raw.plainText ?? raw.text ?? raw.body ?? raw.content ?? stripHtml(notesHtmlRaw ?? "")).trim();
  if (!plainText && !notesHtmlRaw) {
    throw new Error(`Row ${index + 1} is missing note body content.`);
  }

  const notesHtml = notesHtmlRaw?.trim() ? notesHtmlRaw.trim() : toParagraphHtml(plainText);
  const slug =
    String(raw.slug ?? raw.logicalChunkId ?? raw.chunkSlug ?? "").trim() ||
    `upload-note-${makeId("slug", `${fileName}|${chapterNo}|${chunkIndex}|${title}`)}`;
  const sections = buildNoteSectionsFromRecord(raw, title, notesHtml, plainText);

  return {
    chapterNo,
    chapterTitle,
    chunkIndex,
    title,
    slug,
    notesHtml,
    plainText,
    pageStart: parseInteger(raw.pageStart ?? raw.page_start, null),
    pageEnd: parseInteger(raw.pageEnd ?? raw.page_end, null),
    sections,
  };
}

/**
 * Convert a NOTE v7.5 JSON artifact into a NormalizedNote for DB insertion.
 *
 * The runtime is intentionally one line of logic:
 *   1. upgrade the v7.5 payload to a v8 shape via the pure adapter
 *   2. validate the result with the strict v8 Zod schema (throws on malformed)
 *   3. hand the validated v8 segment to normalizeNoteV8, which is the single
 *      place that knows how to project a v8 segment onto NormalizedNote
 *      (body = canonical content, display_json + flags_json + content_hash +
 *      pushdown booleans + blockId preservation)
 *
 * There is no fallback flatten-only path here. Legacy v7.5 shapes that the
 * adapter cannot interpret throw at Zod.parse and are surfaced as import
 * errors upstream — the same error handling already used for malformed v8.
 */
function normalizeNoteV75(
  raw: Record<string, unknown>,
  fileName: string,
): NormalizedNote {
  const upgraded = upgradeSegmentV7ToV8(
    raw as unknown as Parameters<typeof upgradeSegmentV7ToV8>[0],
  );
  const validated = SegmentNoteV8Z.parse(upgraded);
  return normalizeNoteV8(validated, fileName);
}

/**
 * Detect if a JSON payload is a NOTE v7.5 artifact.
 */
function isNoteV75Json(parsed: unknown): parsed is Record<string, unknown> {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
  const obj = parsed as Record<string, unknown>;
  // Distinguish from v8 by schemaVersion literal (v8 == "8.0")
  if (obj.schemaVersion === "8.0") return false;
  return obj.schemaVersion === "7.5" || (!!obj.segmentId && Array.isArray(obj.sections));
}

/**
 * Compute the v8 content hash synchronously at import time using node:crypto.
 * Matches the normalization used by the async helper in note-v8-hashing.ts
 * (NFC + whitespace-collapse + trim) so hashes round-trip.
 */
function computeV8ContentHashSync(content: string): string {
  const normalized = content.normalize("NFC").replace(/\s+/g, " ").trim();
  return `sha256:${createHash("sha256").update(normalized).digest("hex")}`;
}

/**
 * Convert a validated v8.0 SegmentNote into NormalizedNote for DB insertion.
 * Maps v8 block display payload into the body text column.
 *
 * blockType handling:
 *   - v8 `blockType` values are all already valid `FrameKind` members
 *     EXCEPT that v8 dropped `high_yield` as a type; `flags.highYield` is used
 *     instead. v7.5-era `high_yield` callers are serviced via the v7→v8 adapter.
 */
function normalizeNoteV8(seg: SegmentNoteV8, fileName: string): NormalizedNote {
  const segmentId = seg.segmentId;

  // Parse chapter/segment from segmentId: "96_01" or "ch096-seg001"
  let chapterNoFromSeg: number | null = null;
  let segmentNoFromSeg: number | null = null;
  const simpleMatch = segmentId.match(/^(\d{1,3})_(\d{1,3})$/);
  if (simpleMatch) {
    chapterNoFromSeg = parseInt(simpleMatch[1], 10);
    segmentNoFromSeg = parseInt(simpleMatch[2], 10);
  } else {
    const segIdChMatch = segmentId.match(/(?:ch)(\d{1,3})/i);
    const segIdSegMatch = segmentId.match(/(?:seg)(\d{1,3})/i);
    chapterNoFromSeg = segIdChMatch ? parseInt(segIdChMatch[1], 10) : null;
    segmentNoFromSeg = segIdSegMatch ? parseInt(segIdSegMatch[1], 10) : null;
  }
  const chapterNo = chapterNoFromSeg ?? inferChapterNoFromFileName(fileName) ?? GENERAL_UPLOAD_CHAPTER_NO;
  const chunkIndex = segmentNoFromSeg ?? 0;

  const firstHeading = seg.sections[0]?.heading ?? "";
  const title = firstHeading || segmentId || `Note v8.0 ${fileName}`;
  const chapterTitle = `Chapter ${chapterNo}`;

  const normalizedSections: NormalizedNoteSection[] = seg.sections.map((section) => {
    const frames: NormalizedNoteFrame[] = section.blocks.map((block) => {
      // v8.1: body column holds CANONICAL CONTENT ONLY.
      // Display panes live in display_json and are rendered from there.
      const body = block.content.trim() || block.title || section.heading;
      const contentHash = block.contentHash ?? computeV8ContentHashSync(block.content);
      // v8.2 pushdown booleans — computed here so SQL filters are cheap and
      // don't require JSON parsing at query time.
      const hasMermaid = block.display?.mermaid ? 1 : 0;
      const highYield = block.flags?.highYield ? 1 : 0;
      const decisionChanging = block.flags?.decisionChanging ? 1 : 0;
      const examRelevant = block.flags?.examRelevant ? 1 : 0;
      return {
        // Preserve the canonical v8 blockId as the DB frame_id so anchoring,
        // MCQ/flashcard linking, and re-anchor all see a stable identifier.
        frameId: block.blockId,
        // v8 blockType is always a valid FrameKind literal (by design).
        kind: block.blockType,
        title: block.title || section.heading,
        body,
        summary: (block.content || block.title).slice(0, 220) || null,
        schemaVersion: "8.0",
        contentHash,
        displayJson: JSON.stringify(block.display),
        flagsJson: JSON.stringify(block.flags),
        hasMermaid,
        highYield,
        decisionChanging,
        examRelevant,
      };
    });

    return {
      title: section.heading,
      hook: section.heading,
      closingKeypoint:
        frames.length > 0
          ? frames[frames.length - 1].body.split("\n").filter(Boolean).slice(-1)[0] ?? null
          : null,
      frames:
        frames.length > 0
          ? frames
          : [
              {
                kind: "concept",
                title: section.heading,
                body: section.heading,
                summary: section.heading.slice(0, 220) || null,
              },
            ],
    };
  });

  const htmlParts = normalizedSections.map((s) => {
    const frameHtml = s.frames
      .map((f) => `<h3>${escapeHtml(f.title)}</h3>\n${toParagraphHtml(f.body)}`)
      .join("\n");
    return `<section>\n<h2>${escapeHtml(s.title)}</h2>\n${frameHtml}\n</section>`;
  });
  const notesHtml = htmlParts.join("\n");
  const plainText = normalizedSections
    .flatMap((s) => s.frames.map((f) => f.body))
    .join("\n\n");

  const slug = segmentId || `upload-note-v80-${makeId("slug", `${fileName}|${chapterNo}|${chunkIndex}`)}`;

  return {
    chapterNo,
    chapterTitle,
    chunkIndex,
    title,
    slug,
    notesHtml,
    plainText,
    pageStart: null,
    pageEnd: null,
    sections: normalizedSections,
  };
}

function parseNotesPayload(
  params: {
    fileName: string;
    format: StructuredImportFormat;
    rawText?: string;
    items?: Record<string, unknown>[];
  },
): NormalizedNote[] {
  const rawText = params.rawText ?? "";

  // Try NOTE v8.0 first, then NOTE v7.5.
  if (params.format === "json" || (!looksLikeHtml(rawText) && rawText.trimStart().startsWith("{"))) {
    try {
      const parsed = JSON.parse(rawText);
      if (isNoteV8Json(parsed)) {
        const v8 = SegmentNoteV8Z.safeParse(parsed);
        if (v8.success) {
          return [normalizeNoteV8(v8.data, params.fileName)];
        }
        // Malformed v8 — surface a readable error by throwing; upstream
        // parseStructuredImport already catches and records import errors.
        throw new Error(
          `NOTE v8.0 schema validation failed: ${v8.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")}`,
        );
      }
      if (isNoteV75Json(parsed)) {
        return [normalizeNoteV75(parsed, params.fileName)];
      }
    } catch (err) {
      // Re-throw v8 schema errors (they have a useful message). Swallow JSON syntax
      // errors and fall through to HTML handling for non-JSON payloads.
      if (err instanceof Error && err.message.startsWith("NOTE v8.0 schema validation")) {
        throw err;
      }
      // Not valid JSON — fall through
    }
  }

  if (params.format === "html" || looksLikeHtml(rawText)) {
    const rawHtml = rawText;
    const baseName = params.fileName.replace(/\.[^.]+$/, "");
    const title = deriveTitleFromHtml(rawHtml, baseName);

    let chapterNo = GENERAL_UPLOAD_CHAPTER_NO;
    let chapterTitle = "Browser Upload";

    const chNameMatch = baseName.match(/(?:ch(?:apter)?[_-]?)(\d{1,3})/i);
    const trailingMatch = baseName.match(/[_-](\d{1,3})(?:[_-]|$)/);
    const leadingMatch = baseName.match(/^(\d{1,3})[_-]/);

    const extracted =
      chNameMatch?.[1] ?? trailingMatch?.[1] ?? leadingMatch?.[1];
    if (extracted) {
      const num = parseInt(extracted, 10);
      if (num > 0 && num <= 200) {
        chapterNo = num;
        chapterTitle = `Chapter ${num}`;
      }
    }

    // Try compact "<chapter>_<segment>" pattern first (e.g. "ch78_01_mcq", "78_01_note"),
    // then fall back to explicit "seg<N>" keyword (e.g. "ch096_seg001").
    const chSegFromName = baseName.match(/^(?:ch(?:apter)?[_-]?)?\d{1,3}[_-](\d{1,3})(?=[_-]|$)/i);
    const segMatch = chSegFromName ?? baseName.match(/seg[_-]?(\d{1,3})/i);
    const chunkIndex = segMatch ? parseInt(segMatch[1], 10) : 0;

    return [
      {
        chapterNo,
        chapterTitle,
        chunkIndex,
        title,
        slug: `upload-note-${makeId("slug", `${params.fileName}|html`)}`,
        notesHtml: rawHtml,
        plainText: stripHtml(rawHtml),
        pageStart: null,
        pageEnd: null,
        sections: buildNoteSectionsFromRecord({}, title, rawHtml, stripHtml(rawHtml)),
      },
    ];
  }

  if (params.items) {
    return params.items.map((item, index) => {
      if (isNoteV8Json(item)) {
        const v8 = SegmentNoteV8Z.safeParse(item);
        if (v8.success) return normalizeNoteV8(v8.data, params.fileName);
      }
      if (isNoteV75Json(item)) return normalizeNoteV75(item, params.fileName);
      return normalizeNoteRecord(item, index, params.fileName);
    });
  }

  return readJsonCollection(params.rawText ?? "").map((item, index) => {
    if (isNoteV8Json(item)) {
      const v8 = SegmentNoteV8Z.safeParse(item);
      if (v8.success) return normalizeNoteV8(v8.data, params.fileName);
    }
    if (isNoteV75Json(item)) return normalizeNoteV75(item, params.fileName);
    return normalizeNoteRecord(item, index, params.fileName);
  });
}

function parseQuestionsPayload(
  params: {
    fileName: string;
    format: StructuredImportFormat;
    rawText?: string;
    items?: Record<string, unknown>[];
  },
): NormalizedQuestion[] {
  const records =
    params.items ??
    (params.format === "csv"
      ? parseCSV(params.rawText ?? "")
      : readJsonCollection(params.rawText ?? ""));

  return records.map((record, index) => normalizeQuestionRecord(record, index, params.fileName));
}

export function parseFlashcardsPayload(
  params: {
    fileName: string;
    format: StructuredImportFormat;
    rawText?: string;
    items?: Record<string, unknown>[];
  },
): NormalizedFlashcard[] {
  let records: Record<string, unknown>[] = params.items ?? [];
  let wrapperContext: FlashcardWrapperContext | undefined;

  if (!params.items) {
    if (params.format === "csv") {
      records = parseCSV(params.rawText ?? "");
    } else {
      const parsed = JSON.parse(params.rawText ?? "null") as unknown;
      if (Array.isArray(parsed)) {
        records = parsed.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object");
      } else if (parsed && typeof parsed === "object") {
        const record = parsed as Record<string, unknown>;
        const nested = Array.isArray(record.flashcards)
          ? record.flashcards
          : Array.isArray(record.cards)
            ? record.cards
            : null;
        if (nested) {
          wrapperContext = {
            chapterNo: parseInteger(record.chapterNo ?? record.chapter_no ?? record.chapter, null),
            segmentId: typeof record.segmentId === "string" ? record.segmentId.trim() || null : null,
          };
          records = nested.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object");
        } else {
          records = readJsonCollection(params.rawText ?? "");
        }
      } else {
        throw new Error("JSON payload must be an array or object.");
      }
    }
  }

  return records.map((record, index) =>
    normalizeFlashcardRecord(record, index, params.fileName, wrapperContext),
  );
}

function normalizeYieldRecord(
  raw: Record<string, unknown>,
  index: number,
  fileName: string,
  wrapperContext?: { chapterNo?: number | null; segmentNo?: number | null; sourceDocId?: string | null },
): NormalizedYieldCard {
  const cardTitle = String(raw.cardTitle ?? raw.title ?? raw.summaryLabel ?? "").trim();
  const summary = String(raw.summary ?? raw.description ?? "").trim();

  if (!cardTitle && !summary) {
    throw new Error(`Yield card ${index + 1} must have cardTitle or summary.`);
  }

  const sectionTitle = String(raw.sectionTitle ?? raw.section_title ?? "").trim();
  if (!sectionTitle) {
    throw new Error(`Yield card ${index + 1} is missing sectionTitle.`);
  }

  const anchorHints = normalizeTextArray(raw.anchorHints ?? raw.anchor_hints) ?? [];
  const bullets = normalizeTextArray(raw.bullets ?? raw.items ?? raw.points) ?? [];

  // keyExamInfo: string → add to reasons + set bit; boolean/number → set bit only
  const keyExamRaw = raw.keyExamInfo ?? raw.key_exam_info;
  let keyExamBit = 0;
  const keyExamReasons: string[] = [];
  if (typeof keyExamRaw === "string" && keyExamRaw.trim()) {
    keyExamBit = 1;
    keyExamReasons.push(keyExamRaw.trim());
  } else if (typeof keyExamRaw === "boolean") {
    keyExamBit = keyExamRaw ? 1 : 0;
  } else if (typeof keyExamRaw === "number") {
    keyExamBit = keyExamRaw ? 1 : 0;
  }

  const reasons = [...bullets, ...keyExamReasons].filter(Boolean);
  const conceptLabels = summary ? [summary] : [];

  const chapterNo =
    parseInteger(raw.chapterNo ?? raw.chapter_no ?? wrapperContext?.chapterNo, null) ??
    inferChapterNoFromFileName(fileName) ??
    GENERAL_UPLOAD_CHAPTER_NO;

  const segmentNo = parseInteger(
    raw.segmentNo ?? raw.segment_no ?? wrapperContext?.segmentNo,
    null,
  );

  const sourceDocId =
    String(raw.sourceDocId ?? raw.source_doc_id ?? wrapperContext?.sourceDocId ?? "").trim() ||
    null;

  const yieldTierRaw = parseInteger(raw.yieldTier ?? raw.yield_tier, 1) ?? 1;
  const yieldTier = Math.max(1, Math.min(3, yieldTierRaw));

  const highYieldRaw = raw.highYieldVisible ?? raw.high_yield_visible;
  const highYieldVisible = highYieldRaw === true || highYieldRaw === 1 ? 1 : 0;

  // Stable ID: prefer explicit id, else derive deterministically from content anchors
  const explicitId = String(raw.id ?? "").trim();
  const stableId =
    explicitId ||
    makeId("yield", `${fileName}|${chapterNo}|${segmentNo ?? ""}|${sectionTitle}|${cardTitle || summary}`);

  return {
    id: stableId,
    chapterNo,
    segmentNo,
    sourceDocId,
    summaryLabel: cardTitle || summary,
    sourceSectionTitles: [sectionTitle],
    sourceAnchorHints: anchorHints,
    conceptLabels,
    reasons,
    yieldTier,
    keyExamInfo: keyExamBit,
    highYieldVisible,
  };
}

/**
 * Normalize a YIELD v2.0 annotation into NormalizedYieldCard for DB insertion.
 * Maps the block-anchored annotation contract to the existing yieldAnnotations schema.
 */
function normalizeYieldV2Annotation(
  ann: Record<string, unknown>,
  index: number,
  segmentId: string,
  fileName: string,
): NormalizedYieldCard {
  const rawId = String(ann.id ?? "").trim();
  if (!rawId) throw new Error(`Yield v2 annotation ${index + 1}: id is required.`);
  // YIELD v2.0 contract: id is "unique within the output JSON" only, NOT globally unique.
  // Different segment files legitimately reuse ids like "ya-01", "ya-02", etc.
  // Prefix with segmentId to produce a globally unique PK across all imported segments.
  const id = `${segmentId}_${rawId}`;

  const sourceBlockId = String(ann.sourceBlockId ?? "").trim();
  if (!sourceBlockId) throw new Error(`Yield v2 annotation ${index + 1}: sourceBlockId is required.`);

  const sourceSectionTitle = String(ann.sourceSectionTitle ?? "").trim();
  if (!sourceSectionTitle) throw new Error(`Yield v2 annotation ${index + 1}: sourceSectionTitle is required.`);

  const sourceBlockTitle = String(ann.sourceBlockTitle ?? "").trim();
  const summaryLabel = String(ann.summaryLabel ?? "").trim();
  if (!summaryLabel) throw new Error(`Yield v2 annotation ${index + 1}: summaryLabel is required.`);

  const yieldTierRaw = typeof ann.yieldTier === "number" ? ann.yieldTier : 1;
  const yieldTier = Math.max(0, Math.min(3, Math.trunc(yieldTierRaw)));

  const keyExamInfo = ann.keyExamInfo === true ? 1 : 0;
  const highYieldVisible = ann.highYieldVisible === true ? 1 : 0;

  const conceptLabels = Array.isArray(ann.conceptLabels)
    ? (ann.conceptLabels as unknown[]).map(String).filter(Boolean)
    : [];
  const reasons = Array.isArray(ann.reasons)
    ? (ann.reasons as unknown[]).map(String).filter(Boolean)
    : [];

  // Derive chapter/segment from segmentId.
  // Supports "96_02" ({chapterNo}_{segmentNo}) and "ch096-seg002" formats.
  let chapterNo: number;
  let segmentNo: number | null = null;
  const simpleSegMatch = segmentId.match(/^(\d{1,3})_(\d{1,3})$/);
  if (simpleSegMatch) {
    chapterNo = parseInt(simpleSegMatch[1], 10);
    segmentNo = parseInt(simpleSegMatch[2], 10);
  } else {
    const segChMatch = segmentId.match(/(?:ch)(\d{1,3})/i);
    const segSegMatch = segmentId.match(/(?:seg)(\d{1,3})/i);
    chapterNo = segChMatch
      ? parseInt(segChMatch[1], 10)
      : (inferChapterNoFromFileName(fileName) ?? GENERAL_UPLOAD_CHAPTER_NO);
    segmentNo = segSegMatch ? parseInt(segSegMatch[1], 10) : null;
  }

  return {
    id,
    chapterNo,
    segmentNo,
    // sourceDocId must be a valid noteDocuments.docId FK or null.
    // The raw segmentId ("96_01") is NOT a valid docId (format: "note_ch096-seg001-notes").
    // Setting it to segmentId violates the FK constraint and silently skips every INSERT.
    // Leave it null here; the link can be resolved later once the corresponding note is imported.
    sourceDocId: null,
    summaryLabel,
    sourceSectionTitles: [sourceSectionTitle],
    sourceAnchorHints: [sourceBlockId, sourceBlockTitle].filter(Boolean),
    conceptLabels,
    reasons,
    yieldTier,
    keyExamInfo,
    highYieldVisible,
  };
}

/**
 * Detect if a JSON payload is a YIELD v2.0 artifact.
 */
function isYieldV2Json(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
  const obj = parsed as Record<string, unknown>;
  return !!obj.segmentId && Array.isArray(obj.annotations);
}

function parseYieldPayload(params: {
  fileName: string;
  format: StructuredImportFormat;
  rawText?: string;
  items?: Record<string, unknown>[];
}): NormalizedYieldCard[] {
  if (params.items) {
    return params.items.map((item, index) =>
      normalizeYieldRecord(item, index, params.fileName),
    );
  }

  const rawText = params.rawText ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("Yield payload must be valid JSON.");
  }

  // YIELD v2.0: { segmentId, annotations: [...] }
  if (isYieldV2Json(parsed)) {
    const wrapper = parsed as Record<string, unknown>;
    const segmentId = String(wrapper.segmentId ?? "").trim();
    const annotations = (wrapper.annotations as unknown[]).filter(
      (entry): entry is Record<string, unknown> => !!entry && typeof entry === "object",
    );
    return annotations.map((ann, index) =>
      normalizeYieldV2Annotation(ann, index, segmentId, params.fileName),
    );
  }

  // Legacy: Wrapper format: { chapterNo?, segmentNo?, sourceDocId?, cards: [...] }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const wrapper = parsed as Record<string, unknown>;
    const wrapperContext = {
      chapterNo: parseInteger(wrapper.chapterNo ?? wrapper.chapter_no, null),
      segmentNo: parseInteger(wrapper.segmentNo ?? wrapper.segment_no, null),
      sourceDocId:
        String(wrapper.sourceDocId ?? wrapper.source_doc_id ?? "").trim() || null,
    };

    if (Array.isArray(wrapper.cards)) {
      const cards = wrapper.cards.filter(
        (entry): entry is Record<string, unknown> => !!entry && typeof entry === "object",
      );
      return cards.map((item, index) =>
        normalizeYieldRecord(item, index, params.fileName, wrapperContext),
      );
    }

    // Single card object at root (no cards wrapper)
    return [normalizeYieldRecord(wrapper, 0, params.fileName, wrapperContext)];
  }

  // Flat array format: [{ ... }, ...]
  if (Array.isArray(parsed)) {
    const cards = parsed.filter(
      (entry): entry is Record<string, unknown> => !!entry && typeof entry === "object",
    );
    return cards.map((item, index) =>
      normalizeYieldRecord(item, index, params.fileName),
    );
  }

  throw new Error("Yield JSON must be an object with a 'cards' array, a v2 annotations object, or a flat array of yield cards.");
}

async function upsertChunkNote(
  importId: string,
  note: NormalizedNote,
) {
  const db = await getDb();
  const chapter = await ensureChapterRecord(note.chapterNo, note.chapterTitle);
  const contractChapterId = await ensureContractChapterRecord(note.chapterNo, chapter.title);
  const chunkId = makeId("chunk", note.slug);
  const timestamp = nowMs();
  const existingChunk = await db.query.chunks.findFirst({
    where: eq(chunks.id, chunkId),
    columns: { id: true },
  });

  const chunkValues = {
    id: chunkId,
    importId,
    chapterId: chapter.id,
    chunkIndex: note.chunkIndex,
    title: note.title,
    slug: note.slug,
    pageStart: note.pageStart,
    pageEnd: note.pageEnd,
    anchorStart: null,
    anchorEnd: null,
    chunkKind: normalizeChunkKind(chunkKind.notes),
    tokenEstimate: null,
    wordCount: note.plainText ? note.plainText.split(/\s+/).filter(Boolean).length : null,
    notesHtml: note.notesHtml,
    plainText: note.plainText,
    metadataJson: null,
    qcScore: null,
    isPublished: 1,
    updatedAt: timestamp,
  };

  if (existingChunk) {
    await db.update(chunks).set(chunkValues).where(eq(chunks.id, chunkId));
  } else {
    await db.insert(chunks).values({
      ...chunkValues,
      createdAt: timestamp,
    });
  }

  const docId = `note_${note.slug}`;
  const existingDoc = await db.query.noteDocuments.findFirst({
    where: eq(noteDocuments.docId, docId),
    columns: { id: true },
  });

  const pageRange =
    note.pageStart != null && note.pageEnd != null ? `${note.pageStart}-${note.pageEnd}` : null;

  const documentValues = {
    docId,
    logicalChunkId: note.slug,
    version: 1,
    chapterId: contractChapterId,
    chapterNo: note.chapterNo,
    chapterTitle: chapter.title,
    chunkIndex: note.chunkIndex,
    pageRange,
    generatedAt: timestamp,
    ingestStatus: "active",
    ingestBatchId: null,
  };

  if (existingDoc) {
    await db.update(noteDocuments).set(documentValues).where(eq(noteDocuments.docId, docId));
  } else {
    await db.insert(noteDocuments).values({
      id: makeId("note_document", docId),
      ...documentValues,
      createdAt: timestamp,
    });
  }

  await db.delete(noteFrames).where(eq(noteFrames.docId, docId));
  await db.delete(noteSections).where(eq(noteSections.docId, docId));

  for (const [sectionIndex, section] of note.sections.entries()) {
    const sectionId = `${docId}_section_${sectionIndex}`;
    await db.insert(noteSections).values({
      id: makeId("note_section", sectionId),
      sectionId,
      docId,
      orderIndex: sectionIndex,
      title: section.title,
      hook: section.hook,
      closingKeypoint: section.closingKeypoint,
      createdAt: timestamp,
    });

    for (const [frameIndex, frame] of section.frames.entries()) {
      const frameId = frame.frameId?.trim() || `${sectionId}_frame_${frameIndex}`;
      await db.insert(noteFrames).values({
        id: makeId("note_frame", frameId),
        frameId,
        docId,
        sectionId,
        orderIndex: frameIndex,
        kind: frame.kind || "core",
        title: frame.title,
        summary: frame.summary,
        body: frame.body,
        marginNote: null,
        // v8.1 additive persistence. Undefined values left out via ?? null.
        schemaVersion: frame.schemaVersion ?? null,
        contentHash: frame.contentHash ?? null,
        displayJson: frame.displayJson ?? null,
        flagsJson: frame.flagsJson ?? null,
        // v8.2 pushdown booleans.
        hasMermaid: frame.hasMermaid ?? null,
        highYield: frame.highYield ?? null,
        decisionChanging: frame.decisionChanging ?? null,
        examRelevant: frame.examRelevant ?? null,
        createdAt: timestamp,
      });
    }
  }

  return existingChunk ? 0 : 1;
}

async function resolveChunkIdBySlug(slug: string | null): Promise<string | null> {
  if (!slug) return null;
  const db = await getDb();
  const row = await db.query.chunks.findFirst({
    where: eq(chunks.slug, slug),
    columns: { id: true },
  });
  return row?.id ?? null;
}

async function upsertQuestion(
  importId: string,
  question: NormalizedQuestion,
) {
  const db = await getDb();
  const chapter = await ensureChapterRecord(question.chapterNo, null);
  // Look up by slug rather than computing makeId — this guarantees we never
  // write a chunk_id that violates the FK to chunks.id (which would happen if
  // the user imports questions BEFORE notes for that segment). When notes are
  // imported later, a re-upload of the questions will populate chunkId.
  const chunkId = await resolveChunkIdBySlug(question.chunkSlug);
  const questionId = makeId("question", question.externalKey);
  const existingQuestion = await db.query.questions.findFirst({
    where: eq(questions.externalKey, question.externalKey),
    columns: { id: true },
  });
  const persistedQuestionId = existingQuestion?.id ?? questionId;
  const correctOption = question.options.find((option) => option.isCorrect) ?? question.options[0];
  const correctOptionId = `${persistedQuestionId}_opt_${correctOption.key}`;
  const timestamp = nowMs();

  const values = {
    id: persistedQuestionId,
    importId,
    chapterId: chapter.id,
    chunkId,
    externalKey: question.externalKey,
    stemHtml: question.stemHtml,
    stemText: question.stemText,
    leadIn: null,
    explanationHtml: question.explanationHtml,
    educationalObjective: null,
    whyCorrect: null,
    whyOthersWrongJson: null,
    questionType: normalizeQuestionType(questionType.singleBestAnswer),
    difficulty: question.difficulty,
    subject: question.subject,
    system: null,
    category: null,
    topic: null,
    tagsJson: jsonField(question.tags),
    notebookAnchorId: question.sourceBlockIds[0] ?? null,
    correctOptionId,
    sourceJson:
      question.sourceBlockIds.length > 0
        ? jsonField({ sourceBlockIds: question.sourceBlockIds })
        : null,
    isActive: 1,
    updatedAt: timestamp,
  };

  if (existingQuestion) {
    await db.update(questions).set(values).where(eq(questions.id, persistedQuestionId));
  } else {
    await db.insert(questions).values({
      ...values,
      createdAt: timestamp,
    });
  }

  await db.delete(questionOptions).where(eq(questionOptions.questionId, persistedQuestionId));

  for (const [index, option] of question.options.entries()) {
    await db.insert(questionOptions).values({
      id: `${persistedQuestionId}_opt_${option.key}`,
      questionId: persistedQuestionId,
      optionKey: option.key,
      contentHtml: option.content,
      contentText: stripHtml(option.content),
      isCorrect: option.isCorrect ? 1 : 0,
      sortOrder: index,
      createdAt: timestamp,
    });
  }

  return existingQuestion ? 0 : 1;
}

async function upsertFlashcard(
  importId: string,
  flashcard: NormalizedFlashcard,
) {
  const db = await getDb();
  const chapterId =
    flashcard.chapterNo != null
      ? (await ensureChapterRecord(flashcard.chapterNo, null)).id
      : null;
  const chunkId = await resolveChunkIdBySlug(flashcard.chunkSlug);
  const flashcardId = makeId(
    "flashcard",
    `${flashcard.chapterNo ?? "none"}|${flashcard.frontHtml}|${flashcard.backHtml}`,
  );
  const existingFlashcard = await db.query.flashcards.findFirst({
    where: eq(flashcards.id, flashcardId),
    columns: { id: true },
  });
  const timestamp = nowMs();

  const values = {
    id: flashcardId,
    importId,
    chapterId,
    chapterNo: flashcard.chapterNo,
    chunkId,
    sourceQuestionId: null,
    sourceDocId: flashcard.chunkSlug ? `note_${flashcard.chunkSlug}` : null,
    sourceFrameId:
      flashcard.sourceBlockIds[0] ??
      (flashcard.chunkSlug ? `note_${flashcard.chunkSlug}_section_0_frame_0` : null),
    anchorId: flashcard.sourceBlockIds[0] ?? null,
    highlightText: null,
    cardType: flashcard.cardType,
    createdFrom: flashcardCreatedFrom.manual,
    status: flashcardStatus.active,
    deck: flashcard.deck,
    deckId: null,
    frontHtml: flashcard.frontHtml,
    backHtml: flashcard.backHtml,
    extraHtml: null,
    clozeText: null,
    educationalObjective: null,
    tagsJson: jsonField(flashcard.tags),
    sourceJson: flashcard.sourceJson ? jsonField(flashcard.sourceJson) : null,
    fsrsState: "new",
    fsrsDue: timestamp,
    isSuspended: 0,
    isArchived: 0,
    updatedAt: timestamp,
  };

  if (existingFlashcard) {
    await db.update(flashcards).set(values).where(eq(flashcards.id, flashcardId));
  } else {
    await db.insert(flashcards).values({
      ...values,
      createdAt: timestamp,
    });
  }

  return existingFlashcard ? 0 : 1;
}

async function upsertYieldAnnotation(
  _importId: string,
  card: NormalizedYieldCard,
): Promise<number> {
  const db = await getDb();
  const timestamp = nowMs();

  // Ensure chapter record exists so chapterNo is valid in the DB
  await ensureChapterRecord(card.chapterNo, null);

  const existing = await db.query.yieldAnnotations.findFirst({
    where: eq(yieldAnnotations.id, card.id),
    columns: { id: true },
  });

  const values = {
    id: card.id,
    chapterNo: card.chapterNo,
    segmentNo: card.segmentNo,
    sourceDocId: card.sourceDocId,
    summaryLabel: card.summaryLabel,
    sourceSectionTitles: JSON.stringify(card.sourceSectionTitles) as unknown as string[],
    sourceAnchorHints: JSON.stringify(card.sourceAnchorHints) as unknown as string[],
    conceptLabels: JSON.stringify(card.conceptLabels) as unknown as string[],
    reasons: JSON.stringify(card.reasons) as unknown as string[],
    yieldTier: card.yieldTier,
    keyExamInfo: card.keyExamInfo,
    highYieldVisible: card.highYieldVisible,
    updatedAt: timestamp,
  };

  if (existing) {
    await db.update(yieldAnnotations).set(values).where(eq(yieldAnnotations.id, card.id));
    return 0;
  }

  await db.insert(yieldAnnotations).values({ ...values, createdAt: timestamp });
  return 1;
}

export async function importStructuredPayload(params: {
  fileName: string;
  contentType: StructuredImportContentType;
  format: StructuredImportFormat;
  rawText?: string;
  items?: Record<string, unknown>[];
  sourceType?: string;
}): Promise<StructuredImportResult> {
  const importId = await createImportRow({
    sourceName: params.fileName,
    fileName: params.fileName,
    sourceType: params.sourceType ?? "manual",
    contentType: params.contentType,
    fileType: params.format,
  });

  const errors: string[] = [];
  let importedCount = 0;
  let skippedCount = 0;

  try {
    if (params.contentType === "notes") {
      const notes = parseNotesPayload(params);
      for (const [index, note] of notes.entries()) {
        try {
          importedCount += await upsertChunkNote(importId, note);
        } catch (error) {
          skippedCount += 1;
          errors.push(`Note ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } else if (params.contentType === "questions") {
      const questions = parseQuestionsPayload(params);
      for (const [index, question] of questions.entries()) {
        try {
          importedCount += await upsertQuestion(importId, question);
        } catch (error) {
          skippedCount += 1;
          errors.push(`Question ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } else if (params.contentType === "yield") {
      const cards = parseYieldPayload(params);
      for (const [index, card] of cards.entries()) {
        try {
          importedCount += await upsertYieldAnnotation(importId, card);
        } catch (error) {
          skippedCount += 1;
          errors.push(`Yield card ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } else {
      const flashcards = parseFlashcardsPayload(params);
      for (const [index, flashcard] of flashcards.entries()) {
        try {
          importedCount += await upsertFlashcard(importId, flashcard);
        } catch (error) {
          skippedCount += 1;
          errors.push(`Flashcard ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    await completeImportRow(importId, importedCount);

    return {
      importId,
      importedCount,
      skippedCount,
      errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Structured import failed.";
    await failImportRow(importId, message);
    throw error;
  }
}
