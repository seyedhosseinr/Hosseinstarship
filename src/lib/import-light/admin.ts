import { and, count, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db/index";
import {
  chunkAssets,
  chunks,
  examSessionQuestions,
  flashcardReviews,
  flashcards,
  imports,
  noteDocuments,
  noteFrames,
  noteSections,
  questionAttempts,
  questionOptions,
  questions,
} from "@/db/schema";

export type ImportSummaryRow = typeof imports.$inferSelect & {
  chunkCount: number;
  noteDocumentCount: number;
  questionCount: number;
  flashcardCount: number;
  examLinkedQuestionCount: number;
};

export type ImportBatchDetails = {
  import: ImportSummaryRow;
  attemptedQuestionCount: number;
  reviewedFlashcardCount: number;
};

export type SafeDeleteResult = {
  importId: string;
  deleted: {
    chunks: number;
    chunkAssets: number;
    noteDocuments: number;
    noteSections: number;
    noteFrames: number;
    questions: number;
    questionOptions: number;
    questionAttempts: number;
    flashcards: number;
    flashcardReviews: number;
    importRecord: boolean;
  };
  skipped: {
    examLinkedQuestions: number;
  };
  fullyPurged: boolean;
};

async function countByImport(importId: string) {
  const db = await getDb();

  const chunkRows = await db
    .select({ id: chunks.id, slug: chunks.slug })
    .from(chunks)
    .where(eq(chunks.importId, importId));
  const questionRows = await db
    .select({ id: questions.id })
    .from(questions)
    .where(eq(questions.importId, importId));
  const flashcardRows = await db
    .select({ id: flashcards.id })
    .from(flashcards)
    .where(eq(flashcards.importId, importId));
  const examLinkedRows = await db
    .select({ questionId: examSessionQuestions.questionId })
    .from(examSessionQuestions)
    .innerJoin(questions, eq(questions.id, examSessionQuestions.questionId))
    .where(eq(questions.importId, importId))
    .groupBy(examSessionQuestions.questionId);

  const chunkSlugs = chunkRows.map((row) => row.slug);
  let noteDocumentCount = 0;

  if (chunkSlugs.length > 0) {
    const noteDocumentRows = await db
      .select({ docId: noteDocuments.docId })
      .from(noteDocuments)
      .where(inArray(noteDocuments.logicalChunkId, chunkSlugs));
    noteDocumentCount = noteDocumentRows.length;
  }

  return {
    chunkIds: chunkRows.map((row) => row.id),
    chunkSlugs,
    questionIds: questionRows.map((row) => row.id),
    flashcardIds: flashcardRows.map((row) => row.id),
    chunkCount: chunkRows.length,
    noteDocumentCount,
    questionCount: questionRows.length,
    flashcardCount: flashcardRows.length,
    examLinkedQuestionCount: examLinkedRows.length,
  };
}

async function countRowsForIds<TColumn>(
  table: any,
  column: TColumn,
  ids: string[],
) {
  if (ids.length === 0) return 0;

  const db = await getDb();
  const rows = await db
    .select({ value: count() })
    .from(table)
    .where(inArray(column as never, ids));

  return Number(rows[0]?.value ?? 0);
}

export async function listImportSummaries(limit = 24): Promise<ImportSummaryRow[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(imports)
    .orderBy(desc(imports.createdAt))
    .limit(limit);

  const summaries = await Promise.all(
    rows.map(async (row) => {
      const counts = await countByImport(row.id);

      return {
        ...row,
        chunkCount: counts.chunkCount,
        noteDocumentCount: counts.noteDocumentCount,
        questionCount: counts.questionCount,
        flashcardCount: counts.flashcardCount,
        examLinkedQuestionCount: counts.examLinkedQuestionCount,
      };
    }),
  );

  return summaries;
}

export async function getImportBatchDetails(importId: string): Promise<ImportBatchDetails | null> {
  const db = await getDb();
  const importRow = await db.query.imports.findFirst({
    where: eq(imports.id, importId),
  });

  if (!importRow) {
    return null;
  }

  const counts = await countByImport(importId);

  const attemptedQuestionCount =
    counts.questionIds.length > 0
      ? (
          await db
            .select({ questionId: questionAttempts.questionId })
            .from(questionAttempts)
            .where(inArray(questionAttempts.questionId, counts.questionIds))
            .groupBy(questionAttempts.questionId)
        ).length
      : 0;

  const reviewedFlashcardCount =
    counts.flashcardIds.length > 0
      ? (
          await db
            .select({ flashcardId: flashcardReviews.flashcardId })
            .from(flashcardReviews)
            .where(inArray(flashcardReviews.flashcardId, counts.flashcardIds))
            .groupBy(flashcardReviews.flashcardId)
        ).length
      : 0;

  return {
    import: {
      ...importRow,
      chunkCount: counts.chunkCount,
      noteDocumentCount: counts.noteDocumentCount,
      questionCount: counts.questionCount,
      flashcardCount: counts.flashcardCount,
      examLinkedQuestionCount: counts.examLinkedQuestionCount,
    },
    attemptedQuestionCount,
    reviewedFlashcardCount,
  };
}

export async function getExamLinkedQuestionCount(importId: string): Promise<number> {
  const counts = await countByImport(importId);
  return counts.examLinkedQuestionCount;
}

export async function safeDeleteImportBatch(importId: string): Promise<SafeDeleteResult> {
  const details = await getImportBatchDetails(importId);

  const result: SafeDeleteResult = {
    importId,
    deleted: {
      chunks: 0,
      chunkAssets: 0,
      noteDocuments: 0,
      noteSections: 0,
      noteFrames: 0,
      questions: 0,
      questionOptions: 0,
      questionAttempts: 0,
      flashcards: 0,
      flashcardReviews: 0,
      importRecord: false,
    },
    skipped: {
      examLinkedQuestions: details?.import.examLinkedQuestionCount ?? 0,
    },
    fullyPurged: false,
  };

  if (!details) {
    return result;
  }

  const db = await getDb();

  await db.transaction(async (tx) => {
    const blockedQuestionRows = await tx
      .select({ questionId: examSessionQuestions.questionId })
      .from(examSessionQuestions)
      .innerJoin(questions, eq(questions.id, examSessionQuestions.questionId))
      .where(eq(questions.importId, importId))
      .groupBy(examSessionQuestions.questionId);

    const blockedQuestionIds = blockedQuestionRows.map((row) => row.questionId);

    const allQuestionRows = await tx
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.importId, importId));

    const deletableQuestionIds = allQuestionRows
      .map((row) => row.id)
      .filter((id) => !blockedQuestionIds.includes(id));

    if (blockedQuestionIds.length > 0) {
      await tx
        .update(questions)
        .set({
          importId: null,
          updatedAt: Date.now(),
        })
        .where(and(eq(questions.importId, importId), inArray(questions.id, blockedQuestionIds)));
    }

    if (deletableQuestionIds.length > 0) {
      result.deleted.questionAttempts =
        Number(
          (
            await tx
              .select({ value: count() })
              .from(questionAttempts)
              .where(inArray(questionAttempts.questionId, deletableQuestionIds))
          )[0]?.value ?? 0,
        );
      result.deleted.questionOptions =
        Number(
          (
            await tx
              .select({ value: count() })
              .from(questionOptions)
              .where(inArray(questionOptions.questionId, deletableQuestionIds))
          )[0]?.value ?? 0,
        );

      await tx.delete(questions).where(inArray(questions.id, deletableQuestionIds));
      result.deleted.questions = deletableQuestionIds.length;
    }

    const flashcardRows = await tx
      .select({ id: flashcards.id })
      .from(flashcards)
      .where(eq(flashcards.importId, importId));
    const flashcardIds = flashcardRows.map((row) => row.id);

    if (flashcardIds.length > 0) {
      result.deleted.flashcardReviews =
        Number(
          (
            await tx
              .select({ value: count() })
              .from(flashcardReviews)
              .where(inArray(flashcardReviews.flashcardId, flashcardIds))
          )[0]?.value ?? 0,
        );

      await tx.delete(flashcards).where(inArray(flashcards.id, flashcardIds));
      result.deleted.flashcards = flashcardIds.length;
    }

    const chunkRows = await tx
      .select({ id: chunks.id, slug: chunks.slug })
      .from(chunks)
      .where(eq(chunks.importId, importId));
    const chunkIds = chunkRows.map((row) => row.id);
    const chunkSlugs = chunkRows.map((row) => row.slug);

    if (chunkSlugs.length > 0) {
      const noteDocRows = await tx
        .select({ docId: noteDocuments.docId })
        .from(noteDocuments)
        .where(inArray(noteDocuments.logicalChunkId, chunkSlugs));
      const noteDocIds = noteDocRows.map((row) => row.docId);

      if (noteDocIds.length > 0) {
        result.deleted.noteSections =
          Number(
            (
              await tx
                .select({ value: count() })
                .from(noteSections)
                .where(inArray(noteSections.docId, noteDocIds))
            )[0]?.value ?? 0,
          );
        result.deleted.noteFrames =
          Number(
            (
              await tx
                .select({ value: count() })
                .from(noteFrames)
                .where(inArray(noteFrames.docId, noteDocIds))
            )[0]?.value ?? 0,
          );

        await tx.delete(noteDocuments).where(inArray(noteDocuments.docId, noteDocIds));
        result.deleted.noteDocuments = noteDocIds.length;
      }
    }

    if (chunkIds.length > 0) {
      result.deleted.chunkAssets =
        Number(
          (
            await tx
              .select({ value: count() })
              .from(chunkAssets)
              .where(inArray(chunkAssets.chunkId, chunkIds))
          )[0]?.value ?? 0,
        );

      await tx.delete(chunks).where(inArray(chunks.id, chunkIds));
      result.deleted.chunks = chunkIds.length;
    }

    await tx.delete(imports).where(eq(imports.id, importId));
    result.deleted.importRecord = true;
    result.fullyPurged = blockedQuestionIds.length === 0;
  });

  return result;
}

export async function bulkSafeDeleteImportBatches(importIds: string[]): Promise<SafeDeleteResult[]> {
  const results: SafeDeleteResult[] = [];

  for (const importId of importIds) {
    results.push(await safeDeleteImportBatch(importId));
  }

  return results;
}
