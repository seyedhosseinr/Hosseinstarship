import { and, count, desc, eq, inArray, isNull, isNotNull } from "drizzle-orm";

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

/** Result for the legacy "safe" delete that detaches exam-linked questions. */
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

/** Result for the hard-delete path that removes exam session links then questions. */
export type HardDeleteResult = {
  importId: string;
  deleted: {
    examSessionLinks: number;
    questions: number;
    flashcards: number;
    flashcardReviews: number;
    chunks: number;
    chunkAssets: number;
    noteDocuments: number;
    noteSections: number;
    noteFrames: number;
    importRecord: boolean;
  };
  fullyPurged: boolean;
};

/** Result for orphan / all-QBank purge operations. */
export type PurgeResult = {
  deleted: {
    examSessionLinks: number;
    questions: number;
    flashcards: number;
  };
};

export type QBankOrphanStats = {
  totalQuestions: number;
  linkedQuestions: number;
  orphanQuestions: number;
  examLinkedTotal: number;
};

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────

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

/** Return QBank-wide orphan statistics for the warning banner. */
export async function getQBankOrphanStats(): Promise<QBankOrphanStats> {
  const db = await getDb();

  const [totalRows, linkedRows, orphanRows, examRows] = await Promise.all([
    db.select({ value: count() }).from(questions),
    db.select({ value: count() }).from(questions).where(isNotNull(questions.importId)),
    db.select({ value: count() }).from(questions).where(isNull(questions.importId)),
    db.select({ value: count() }).from(examSessionQuestions),
  ]);

  return {
    totalQuestions: Number(totalRows[0]?.value ?? 0),
    linkedQuestions: Number(linkedRows[0]?.value ?? 0),
    orphanQuestions: Number(orphanRows[0]?.value ?? 0),
    examLinkedTotal: Number(examRows[0]?.value ?? 0),
  };
}

// ─────────────────────────────────────────────────────────────
// Delete: legacy "safe" / detach mode
// ─────────────────────────────────────────────────────────────

/**
 * Detach-only delete: exam-linked questions are SET import_id = NULL (preserved
 * in QBank) while non-exam-linked questions are hard-deleted.
 * Use this only when the user explicitly wants to "Preserve exam history".
 */
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
        .set({ importId: null, updatedAt: Date.now() })
        .where(and(eq(questions.importId, importId), inArray(questions.id, blockedQuestionIds)));
    }

    if (deletableQuestionIds.length > 0) {
      result.deleted.questionAttempts = Number(
        (await tx.select({ value: count() }).from(questionAttempts).where(inArray(questionAttempts.questionId, deletableQuestionIds)))[0]?.value ?? 0,
      );
      result.deleted.questionOptions = Number(
        (await tx.select({ value: count() }).from(questionOptions).where(inArray(questionOptions.questionId, deletableQuestionIds)))[0]?.value ?? 0,
      );
      await tx.delete(questions).where(inArray(questions.id, deletableQuestionIds));
      result.deleted.questions = deletableQuestionIds.length;
    }

    const flashcardRows = await tx.select({ id: flashcards.id }).from(flashcards).where(eq(flashcards.importId, importId));
    const flashcardIds = flashcardRows.map((row) => row.id);

    if (flashcardIds.length > 0) {
      result.deleted.flashcardReviews = Number(
        (await tx.select({ value: count() }).from(flashcardReviews).where(inArray(flashcardReviews.flashcardId, flashcardIds)))[0]?.value ?? 0,
      );
      await tx.delete(flashcards).where(inArray(flashcards.id, flashcardIds));
      result.deleted.flashcards = flashcardIds.length;
    }

    const chunkRows = await tx.select({ id: chunks.id, slug: chunks.slug }).from(chunks).where(eq(chunks.importId, importId));
    const chunkIds = chunkRows.map((row) => row.id);
    const chunkSlugs = chunkRows.map((row) => row.slug);

    if (chunkSlugs.length > 0) {
      const noteDocRows = await tx.select({ docId: noteDocuments.docId }).from(noteDocuments).where(inArray(noteDocuments.logicalChunkId, chunkSlugs));
      const noteDocIds = noteDocRows.map((row) => row.docId);

      if (noteDocIds.length > 0) {
        result.deleted.noteSections = Number(
          (await tx.select({ value: count() }).from(noteSections).where(inArray(noteSections.docId, noteDocIds)))[0]?.value ?? 0,
        );
        result.deleted.noteFrames = Number(
          (await tx.select({ value: count() }).from(noteFrames).where(inArray(noteFrames.docId, noteDocIds)))[0]?.value ?? 0,
        );
        await tx.delete(noteDocuments).where(inArray(noteDocuments.docId, noteDocIds));
        result.deleted.noteDocuments = noteDocIds.length;
      }
    }

    if (chunkIds.length > 0) {
      result.deleted.chunkAssets = Number(
        (await tx.select({ value: count() }).from(chunkAssets).where(inArray(chunkAssets.chunkId, chunkIds)))[0]?.value ?? 0,
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

// ─────────────────────────────────────────────────────────────
// Delete: hard-delete (default)
// ─────────────────────────────────────────────────────────────

/**
 * Hard-delete: removes exam_session_questions links first (to satisfy the
 * RESTRICT FK), then deletes ALL questions belonging to the import,
 * including exam-linked ones.  This is the default destructive action.
 */
export async function hardDeleteImportBatch(importId: string): Promise<HardDeleteResult> {
  const db = await getDb();

  const result: HardDeleteResult = {
    importId,
    deleted: {
      examSessionLinks: 0,
      questions: 0,
      flashcards: 0,
      flashcardReviews: 0,
      chunks: 0,
      chunkAssets: 0,
      noteDocuments: 0,
      noteSections: 0,
      noteFrames: 0,
      importRecord: false,
    },
    fullyPurged: false,
  };

  await db.transaction(async (tx) => {
    // 1. Collect all question IDs for this import
    const questionRows = await tx
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.importId, importId));
    const questionIds = questionRows.map((r) => r.id);

    if (questionIds.length > 0) {
      // 2. Delete exam_session_questions first (RESTRICT constraint)
      const esqRows = await tx
        .select({ value: count() })
        .from(examSessionQuestions)
        .where(inArray(examSessionQuestions.questionId, questionIds));
      result.deleted.examSessionLinks = Number(esqRows[0]?.value ?? 0);

      if (result.deleted.examSessionLinks > 0) {
        await tx
          .delete(examSessionQuestions)
          .where(inArray(examSessionQuestions.questionId, questionIds));
      }

      // 3. Delete questions (CASCADE removes options, attempts, notes, bookmarks)
      await tx.delete(questions).where(inArray(questions.id, questionIds));
      result.deleted.questions = questionIds.length;
    }

    // 4. Flashcards
    const flashcardRows = await tx.select({ id: flashcards.id }).from(flashcards).where(eq(flashcards.importId, importId));
    const flashcardIds = flashcardRows.map((r) => r.id);

    if (flashcardIds.length > 0) {
      result.deleted.flashcardReviews = Number(
        (await tx.select({ value: count() }).from(flashcardReviews).where(inArray(flashcardReviews.flashcardId, flashcardIds)))[0]?.value ?? 0,
      );
      await tx.delete(flashcards).where(inArray(flashcards.id, flashcardIds));
      result.deleted.flashcards = flashcardIds.length;
    }

    // 5. Chunks → note documents
    const chunkRows = await tx.select({ id: chunks.id, slug: chunks.slug }).from(chunks).where(eq(chunks.importId, importId));
    const chunkIds = chunkRows.map((r) => r.id);
    const chunkSlugs = chunkRows.map((r) => r.slug);

    if (chunkSlugs.length > 0) {
      const noteDocRows = await tx.select({ docId: noteDocuments.docId }).from(noteDocuments).where(inArray(noteDocuments.logicalChunkId, chunkSlugs));
      const noteDocIds = noteDocRows.map((r) => r.docId);

      if (noteDocIds.length > 0) {
        result.deleted.noteSections = Number(
          (await tx.select({ value: count() }).from(noteSections).where(inArray(noteSections.docId, noteDocIds)))[0]?.value ?? 0,
        );
        result.deleted.noteFrames = Number(
          (await tx.select({ value: count() }).from(noteFrames).where(inArray(noteFrames.docId, noteDocIds)))[0]?.value ?? 0,
        );
        await tx.delete(noteDocuments).where(inArray(noteDocuments.docId, noteDocIds));
        result.deleted.noteDocuments = noteDocIds.length;
      }
    }

    if (chunkIds.length > 0) {
      result.deleted.chunkAssets = Number(
        (await tx.select({ value: count() }).from(chunkAssets).where(inArray(chunkAssets.chunkId, chunkIds)))[0]?.value ?? 0,
      );
      await tx.delete(chunks).where(inArray(chunks.id, chunkIds));
      result.deleted.chunks = chunkIds.length;
    }

    // 6. Delete import record
    await tx.delete(imports).where(eq(imports.id, importId));
    result.deleted.importRecord = true;
    result.fullyPurged = true;
  });

  return result;
}

export async function bulkHardDeleteImportBatches(importIds: string[]): Promise<HardDeleteResult[]> {
  const results: HardDeleteResult[] = [];
  for (const id of importIds) {
    results.push(await hardDeleteImportBatch(id));
  }
  return results;
}

export async function bulkSafeDeleteImportBatches(importIds: string[]): Promise<SafeDeleteResult[]> {
  const results: SafeDeleteResult[] = [];
  for (const importId of importIds) {
    results.push(await safeDeleteImportBatch(importId));
  }
  return results;
}

// ─────────────────────────────────────────────────────────────
// Purge operations
// ─────────────────────────────────────────────────────────────

/**
 * Purge orphan QBank questions: deletes all questions where import_id IS NULL.
 * Deletes their exam_session_questions links first.
 */
export async function purgeOrphanQuestions(): Promise<PurgeResult> {
  const db = await getDb();
  const result: PurgeResult = { deleted: { examSessionLinks: 0, questions: 0, flashcards: 0 } };

  await db.transaction(async (tx) => {
    const orphanRows = await tx
      .select({ id: questions.id })
      .from(questions)
      .where(isNull(questions.importId));
    const orphanIds = orphanRows.map((r) => r.id);

    if (orphanIds.length === 0) return;

    const esqCount = await tx
      .select({ value: count() })
      .from(examSessionQuestions)
      .where(inArray(examSessionQuestions.questionId, orphanIds));
    result.deleted.examSessionLinks = Number(esqCount[0]?.value ?? 0);

    if (result.deleted.examSessionLinks > 0) {
      await tx.delete(examSessionQuestions).where(inArray(examSessionQuestions.questionId, orphanIds));
    }

    await tx.delete(questions).where(inArray(questions.id, orphanIds));
    result.deleted.questions = orphanIds.length;
  });

  return result;
}

/**
 * Purge ALL QBank questions (admin / full reset).
 * Deletes exam_session_questions first, then all questions.
 * Works even when imports table is empty.
 */
export async function purgeAllQuestions(): Promise<PurgeResult> {
  const db = await getDb();
  const result: PurgeResult = { deleted: { examSessionLinks: 0, questions: 0, flashcards: 0 } };

  await db.transaction(async (tx) => {
    // Count before delete
    const qCount = await tx.select({ value: count() }).from(questions);
    const totalQ = Number(qCount[0]?.value ?? 0);
    if (totalQ === 0) return;

    const esqCount = await tx.select({ value: count() }).from(examSessionQuestions);
    result.deleted.examSessionLinks = Number(esqCount[0]?.value ?? 0);

    // Delete all exam session question rows (removes RESTRICT constraint)
    if (result.deleted.examSessionLinks > 0) {
      await tx.delete(examSessionQuestions);
    }

    // Delete all questions (CASCADE handles options, attempts, notes, bookmarks)
    await tx.delete(questions);
    result.deleted.questions = totalQ;
  });

  return result;
}
