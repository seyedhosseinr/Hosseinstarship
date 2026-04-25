import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { basename, relative, resolve, sep } from "node:path";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, getDbRuntime } from "@/db/index";
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
} from "@/db/schema";
import { getCampbellChapter } from "@/lib/library/campbell";

import type { ImportRunSummary } from "./types";

// Ensure absolute string paths — Turbopack can resolve() to URL objects
const WORKSPACE_ROOT = String(resolve(process.cwd()));
const WORKSPACE_DATA_ROOT = String(resolve(WORKSPACE_ROOT, "data"));
const IMPORT_SOURCE_ID = "campbell-walsh-wein-13";

const manifestSchema = z.object({
  source: z.string().min(1),
  schemaVersion: z.string().min(1).default("dna-v3.1"),
  generatedAt: z.string().optional(),
  chapters: z.array(z.number().int()).default([]),
  counts: z
    .object({
      chunks: z.number().int().nonnegative().default(0),
      questions: z.number().int().nonnegative().default(0),
      flashcards: z.number().int().nonnegative().default(0),
    })
    .default({ chunks: 0, questions: 0, flashcards: 0 }),
});

const chunkSchema = z.object({
  chapterNo: z.number().int(),
  chunkIndex: z.number().int().nonnegative(),
  title: z.string().min(1).optional(),
  slug: z.string().min(1),
  pageStart: z.number().int().nullable().optional(),
  pageEnd: z.number().int().nullable().optional(),
  chunkKind: z.string().optional(),
  tokenEstimate: z.number().int().nullable().optional(),
  wordCount: z.number().int().nullable().optional(),
  notesHtml: z.string().nullable().optional(),
  plainText: z.string().nullable().optional(),
  isPublished: z.boolean().optional(),
});

const questionOptionSchema = z.object({
  key: z.string().min(1).optional(),
  optionKey: z.string().min(1).optional(),
  contentText: z.string().nullable().optional(),
  contentHtml: z.string().nullable().optional(),
  isCorrect: z.boolean().optional(),
});

const questionSchema = z.object({
  externalKey: z.string().min(1),
  chapterNo: z.number().int(),
  chunkSlug: z.string().min(1).optional(),
  stemHtml: z.string().min(1),
  stemText: z.string().nullable().optional(),
  leadIn: z.string().nullable().optional(),
  explanationHtml: z.string().nullable().optional(),
  educationalObjective: z.string().nullable().optional(),
  questionType: z.string().optional(),
  difficulty: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  system: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  topic: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  options: z.array(questionOptionSchema).min(2),
});

const flashcardSchema = z.object({
  chapterNo: z.number().int().nullable().optional(),
  chunkSlug: z.string().min(1).optional(),
  cardType: z.string().optional(),
  deck: z.string().nullable().optional(),
  frontHtml: z.string().min(1),
  backHtml: z.string().min(1),
  educationalObjective: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
});

type Manifest = z.output<typeof manifestSchema>;
type BatchChunk = z.output<typeof chunkSchema>;
type BatchQuestion = z.output<typeof questionSchema>;
type BatchFlashcard = z.output<typeof flashcardSchema>;

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

function toWorkspaceRelativePath(absolutePath: string) {
  return relative(WORKSPACE_ROOT, absolutePath).split("\\").join("/");
}

async function readJsonFile<Schema extends z.ZodTypeAny>(
  filePath: string,
  schema: Schema,
): Promise<z.output<Schema>> {
  const content = await readFile(filePath, "utf8");
  return schema.parse(JSON.parse(content));
}

async function ensureReadableFile(filePath: string) {
  try {
    await access(filePath);
  } catch {
    throw new Error(`Required import artifact is missing: ${toWorkspaceRelativePath(filePath)}`);
  }
}

function resolveBatchDirectory(batchDirectory: string) {
  const trimmed = batchDirectory.trim();
  if (!trimmed) {
    throw new Error("Enter a workspace-relative batch directory under data/.");
  }
  if (/^[A-Za-z]:[\\/]|^\\\\/.test(trimmed)) {
    throw new Error("Batch directory must be workspace-relative, for example data/test-batch.");
  }

  const absolutePath = resolve(WORKSPACE_ROOT, trimmed);
  const relToData = relative(WORKSPACE_DATA_ROOT, absolutePath);
  const isInsideData =
    relToData !== "" &&
    relToData !== "." &&
    relToData !== ".." &&
    !relToData.startsWith(`..${sep}`) &&
    !relToData.startsWith("..\\") &&
    !relToData.startsWith("../");

  if (!isInsideData) {
    throw new Error("Batch directory must stay inside the workspace data/ directory.");
  }

  return {
    absolutePath,
    relativePath: trimmed.split("\\").join("/"),
  };
}

async function ensureChapter(chapterNo: number) {
  const db = await getDb();
  const existing = await db.query.chapters.findFirst({
    where: eq(chapters.chapterNo, chapterNo),
    columns: { id: true, title: true, slug: true },
  });

  if (existing) {
    return existing;
  }

  const chapterMeta = getCampbellChapter(chapterNo);
  if (!chapterMeta) {
    throw new Error(`Chapter ${chapterNo} is not available in the supported Campbell metadata.`);
  }

  const chapterId = makeId("chapter", `${IMPORT_SOURCE_ID}|${chapterNo}`);
  const slug = `campbell-${chapterNo}-${chapterMeta.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
  await db.insert(chapters).values({
    id: chapterId,
    volumeNo: chapterMeta.volume,
    partNo: null,
    partTitle: chapterMeta.part,
    sectionTitle: null,
    chapterNo,
    title: chapterMeta.title,
    slug,
    pageStart: chapterMeta.start_page,
    pageEnd: chapterMeta.end_page,
    sourceBook: "Campbell-Walsh-Wein",
    sourceEdition: "13",
    isActive: 1,
    createdAt: nowMs(),
    updatedAt: nowMs(),
  });

  return {
    id: chapterId,
    title: chapterMeta.title,
    slug,
  };
}

async function ensureContractChapter(chapterNo: number, chapterTitle: string) {
  const db = await getDb();
  const existing = await db.query.contractChapters.findFirst({
    where: eq(contractChapters.chapterNo, chapterNo),
    columns: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  const contractChapterId = makeId("contract_chapter", `${IMPORT_SOURCE_ID}|${chapterNo}`);
  await db.insert(contractChapters).values({
    id: contractChapterId,
    sourceId: IMPORT_SOURCE_ID,
    chapterNo,
    chapterTitle,
    createdAt: nowMs(),
  });

  return contractChapterId;
}

async function createImportRow(params: { batchDirectory: string; manifest: Manifest }) {
  const db = await getDb();
  const timestamp = nowMs();
  const importId = makeId("imp", `${params.manifest.source}|${params.batchDirectory}|${timestamp}`);

  await db.insert(imports).values({
    id: importId,
    sourceName: params.manifest.source,
    sourceType: "batch",
    sourceVersion: params.manifest.generatedAt ?? null,
    schemaVersion: params.manifest.schemaVersion,
    status: importStatus.running,
    inputPath: params.batchDirectory,
    manifestJson: jsonField(params.manifest),
    itemCount: 0,
    startedAt: timestamp,
    completedAt: null,
    errorMessage: null,
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

async function upsertChunkAndDocument(
  importId: string,
  chunk: BatchChunk,
  chapterId: string,
  chapterTitle: string,
  contractChapterId: string,
) {
  const db = await getDb();
  const chunkId = makeId("chunk", chunk.slug);
  const existingChunk = await db.query.chunks.findFirst({
    where: eq(chunks.id, chunkId),
    columns: { id: true },
  });
  const timestamp = nowMs();

  const chunkValues = {
    id: chunkId,
    importId,
    chapterId,
    chunkIndex: chunk.chunkIndex,
    title: chunk.title ?? null,
    slug: chunk.slug,
    pageStart: chunk.pageStart ?? null,
    pageEnd: chunk.pageEnd ?? null,
    anchorStart: null,
    anchorEnd: null,
    chunkKind: normalizeChunkKind(chunk.chunkKind),
    tokenEstimate: chunk.tokenEstimate ?? null,
    wordCount: chunk.wordCount ?? null,
    notesHtml: chunk.notesHtml ?? null,
    plainText: chunk.plainText ?? null,
    metadataJson: null,
    qcScore: null,
    isPublished: chunk.isPublished === false ? 0 : 1,
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

  const body = stripHtml(chunk.notesHtml ?? chunk.plainText ?? "");
  let noteDocumentInserted = 0;
  let noteDocumentUpdated = 0;

  if (body) {
    const docId = `note_${chunk.slug}`;
    const sectionId = `${docId}_section_0`;
    const frameId = `${docId}_frame_0`;
    const existingDoc = await db.query.noteDocuments.findFirst({
      where: eq(noteDocuments.docId, docId),
      columns: { id: true },
    });

    const pageRange =
      chunk.pageStart != null && chunk.pageEnd != null
        ? `${chunk.pageStart}-${chunk.pageEnd}`
        : null;

    const documentValues = {
      docId,
      logicalChunkId: chunk.slug,
      version: 1,
      chapterId: contractChapterId,
      chapterNo: chunk.chapterNo,
      chapterTitle,
      chunkIndex: chunk.chunkIndex,
      pageRange,
      generatedAt: timestamp,
      ingestStatus: "active",
      ingestBatchId: null,
    };

    if (existingDoc) {
      await db.update(noteDocuments).set(documentValues).where(eq(noteDocuments.docId, docId));
      noteDocumentUpdated += 1;
    } else {
      await db.insert(noteDocuments).values({
        id: makeId("note_document", docId),
        ...documentValues,
        createdAt: timestamp,
      });
      noteDocumentInserted += 1;
    }

    await db.delete(noteFrames).where(eq(noteFrames.docId, docId));
    await db.delete(noteSections).where(eq(noteSections.docId, docId));

    await db.insert(noteSections).values({
      id: makeId("note_section", sectionId),
      sectionId,
      docId,
      orderIndex: 0,
      title: chunk.title ?? `Chapter ${chunk.chapterNo}`,
      hook: chunk.title ?? null,
      closingKeypoint: body.split("\n").filter(Boolean).slice(-1)[0] ?? null,
      createdAt: timestamp,
    });

    await db.insert(noteFrames).values({
      id: makeId("note_frame", frameId),
      frameId,
      docId,
      sectionId,
      orderIndex: 0,
      kind: "core",
      title: chunk.title ?? `Chunk ${chunk.chunkIndex + 1}`,
      summary: body.slice(0, 220),
      body,
      marginNote: null,
      // v8.1: legacy chunk path has no v8 payload — all v8 columns NULL.
      schemaVersion: null,
      contentHash: null,
      displayJson: null,
      flagsJson: null,
      // v8.2 pushdown columns — NULL on legacy chunk path.
      hasMermaid: null,
      highYield: null,
      decisionChanging: null,
      examRelevant: null,
      createdAt: timestamp,
    });
  }

  return {
    chunkId,
    chunkInserted: existingChunk ? 0 : 1,
    chunkUpdated: existingChunk ? 1 : 0,
    noteDocumentInserted,
    noteDocumentUpdated,
  };
}

async function upsertQuestion(
  importId: string,
  question: BatchQuestion,
  chapterId: string,
  chunkId: string | null,
) {
  const db = await getDb();
  const questionId = makeId("question", question.externalKey);
  const existingQuestion = await db.query.questions.findFirst({
    where: eq(questions.externalKey, question.externalKey),
    columns: { id: true },
  });
  const persistedQuestionId = existingQuestion?.id ?? questionId;
  const correctIndex = question.options.findIndex((option) => Boolean(option.isCorrect));
  if (correctIndex < 0) {
    throw new Error(`Question ${question.externalKey} does not declare a correct option.`);
  }

  const correctOptionKey = (
    question.options[correctIndex]?.optionKey ??
    question.options[correctIndex]?.key ??
    optionKeyAt(correctIndex)
  )
    .trim()
    .toUpperCase();
  const correctOptionId = `${persistedQuestionId}_opt_${correctOptionKey}`;
  const timestamp = nowMs();

  const values = {
    id: persistedQuestionId,
    importId,
    chapterId,
    chunkId,
    externalKey: question.externalKey,
    stemHtml: question.stemHtml,
    stemText: question.stemText ?? stripHtml(question.stemHtml),
    leadIn: question.leadIn ?? null,
    explanationHtml: question.explanationHtml ?? null,
    educationalObjective: question.educationalObjective ?? null,
    whyCorrect: null,
    whyOthersWrongJson: null,
    questionType: normalizeQuestionType(question.questionType),
    difficulty: question.difficulty ?? null,
    subject: question.subject ?? null,
    system: question.system ?? null,
    category: question.category ?? null,
    topic: question.topic ?? null,
    tagsJson: jsonField(question.tags ?? null),
    notebookAnchorId: null,
    correctOptionId,
    sourceJson: null,
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
    const optionKey = (option.optionKey ?? option.key ?? optionKeyAt(index)).trim().toUpperCase();
    await db.insert(questionOptions).values({
      id: `${persistedQuestionId}_opt_${optionKey}`,
      questionId: persistedQuestionId,
      optionKey,
      contentHtml: option.contentHtml ?? option.contentText ?? "",
      contentText: option.contentText ?? stripHtml(option.contentHtml ?? ""),
      isCorrect: option.isCorrect ? 1 : 0,
      sortOrder: index,
      createdAt: timestamp,
    });
  }

  return {
    questionInserted: existingQuestion ? 0 : 1,
    questionUpdated: existingQuestion ? 1 : 0,
    optionInserted: question.options.length,
    optionUpdated: 0,
  };
}

async function upsertFlashcard(
  importId: string,
  flashcard: BatchFlashcard,
  chapterId: string | null,
  chunkId: string | null,
) {
  const db = await getDb();
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
    chapterNo: flashcard.chapterNo ?? null,
    chunkId,
    sourceQuestionId: null,
    sourceDocId: flashcard.chunkSlug ? `note_${flashcard.chunkSlug}` : null,
    sourceFrameId: flashcard.chunkSlug ? `note_${flashcard.chunkSlug}_frame_0` : null,
    anchorId: null,
    highlightText: null,
    cardType: normalizeFlashcardType(flashcard.cardType),
    createdFrom: flashcardCreatedFrom.note,
    status: flashcardStatus.active,
    deck: flashcard.deck ?? null,
    deckId: null,
    frontHtml: flashcard.frontHtml,
    backHtml: flashcard.backHtml,
    extraHtml: null,
    clozeText: null,
    educationalObjective: flashcard.educationalObjective ?? null,
    tagsJson: jsonField(flashcard.tags ?? null),
    sourceJson: null,
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

  return {
    flashcardInserted: existingFlashcard ? 0 : 1,
    flashcardUpdated: existingFlashcard ? 1 : 0,
  };
}

export async function runBatchImport(batchDirectory: string): Promise<ImportRunSummary> {
  const { absolutePath, relativePath } = resolveBatchDirectory(batchDirectory);
  const manifestPath = resolve(absolutePath, "manifest.json");
  const chunksPath = resolve(absolutePath, "chunks.json");
  const questionsPath = resolve(absolutePath, "questions.json");
  const flashcardsPath = resolve(absolutePath, "flashcards.json");

  await Promise.all([
    ensureReadableFile(manifestPath),
    ensureReadableFile(chunksPath),
    ensureReadableFile(questionsPath),
    ensureReadableFile(flashcardsPath),
  ]);

  const [manifest, chunkRows, questionRows, flashcardRows] = await Promise.all([
    readJsonFile(manifestPath, manifestSchema),
    readJsonFile(chunksPath, z.array(chunkSchema)),
    readJsonFile(questionsPath, z.array(questionSchema)),
    readJsonFile(flashcardsPath, z.array(flashcardSchema)),
  ]);

  const importId = await createImportRow({
    batchDirectory: relativePath,
    manifest,
  });

  const summary: ImportRunSummary = {
    importId,
    batchDirectory: relativePath,
    runtime: getDbRuntime(),
    sourceName: manifest.source || basename(absolutePath),
    totalItems: 0,
    counts: {
      chunks: { inserted: 0, updated: 0 },
      noteDocuments: { inserted: 0, updated: 0 },
      questions: { inserted: 0, updated: 0 },
      options: { inserted: 0, updated: 0 },
      flashcards: { inserted: 0, updated: 0 },
    },
  };

  try {
    const chunkIdBySlug = new Map<string, string>();
    const chapterIdByNo = new Map<number, string>();

    for (const chunk of chunkRows) {
      const chapter = await ensureChapter(chunk.chapterNo);
      chapterIdByNo.set(chunk.chapterNo, chapter.id);
      const contractChapterId = await ensureContractChapter(chunk.chapterNo, chapter.title);
      const result = await upsertChunkAndDocument(importId, chunk, chapter.id, chapter.title, contractChapterId);
      chunkIdBySlug.set(chunk.slug, result.chunkId);
      summary.counts.chunks.inserted += result.chunkInserted;
      summary.counts.chunks.updated += result.chunkUpdated;
      summary.counts.noteDocuments.inserted += result.noteDocumentInserted;
      summary.counts.noteDocuments.updated += result.noteDocumentUpdated;
    }

    for (const question of questionRows) {
      const chapter = await ensureChapter(question.chapterNo);
      chapterIdByNo.set(question.chapterNo, chapter.id);
      const result = await upsertQuestion(
        importId,
        question,
        chapter.id,
        question.chunkSlug ? (chunkIdBySlug.get(question.chunkSlug) ?? null) : null,
      );
      summary.counts.questions.inserted += result.questionInserted;
      summary.counts.questions.updated += result.questionUpdated;
      summary.counts.options.inserted += result.optionInserted;
      summary.counts.options.updated += result.optionUpdated;
    }

    for (const flashcard of flashcardRows) {
      const chapterId =
        flashcard.chapterNo != null
          ? (chapterIdByNo.get(flashcard.chapterNo) ?? (await ensureChapter(flashcard.chapterNo)).id)
          : null;
      if (flashcard.chapterNo != null && chapterId) {
        chapterIdByNo.set(flashcard.chapterNo, chapterId);
      }
      const result = await upsertFlashcard(
        importId,
        flashcard,
        chapterId,
        flashcard.chunkSlug ? (chunkIdBySlug.get(flashcard.chunkSlug) ?? null) : null,
      );
      summary.counts.flashcards.inserted += result.flashcardInserted;
      summary.counts.flashcards.updated += result.flashcardUpdated;
    }

    summary.totalItems = chunkRows.length + questionRows.length + flashcardRows.length;
    await completeImportRow(importId, summary.totalItems);
    return summary;
  } catch (error) {
    await failImportRow(importId, error instanceof Error ? error.message : "Unknown import error.");
    throw error;
  }
}
