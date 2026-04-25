"use server";

import { desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db/index";
import {
  chapters,
  chunks,
  contractChapters,
  examSessionQuestions,
  flashcards,
  noteDocuments,
  questions,
} from "@/db/schema";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export type ContentItem = {
  id: string;
  type: "question" | "flashcard" | "chunk";
  title: string;
  preview: string;
  createdAt: number;
  updatedAt: number | null;
  chapterNo?: number | null;
  chapterTitle?: string | null;
  difficulty?: string | null;
  cardType?: string | null;
  subjectId?: string | null;
  importId?: string | null;
};

export type ChapterGroup = {
  chapterId: string;
  chapterNo: number;
  chapterTitle: string;
  part: string;
  questionCount: number;
  flashcardCount: number;
  chunkCount: number;
};

export type ContentStats = {
  totalQuestions: number;
  totalFlashcards: number;
  totalChunks: number;
  chaptersWithContent: number;
};

function compactPreview(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

export async function getContentByChapterAction(): Promise<ActionResult<{ groups: ChapterGroup[]; stats: ContentStats }>> {
  try {
    const db = await getDb();
    const [chapterRows, noteRows] = await Promise.all([
      db.select().from(chapters),
      db.select().from(contractChapters),
    ]);

    const [chunkRows, questionRows, flashcardRows] = await Promise.all([
      db.select({
        chapterId: chunks.chapterId,
      }).from(chunks),
      db.select({
        chapterId: questions.chapterId,
      }).from(questions),
      db.select({
        chapterId: flashcards.chapterId,
        chapterNo: flashcards.chapterNo,
      }).from(flashcards),
    ]);

    const groupMap = new Map<string, ChapterGroup>();
    for (const chapter of chapterRows) {
      groupMap.set(chapter.id, {
        chapterId: chapter.id,
        chapterNo: chapter.chapterNo,
        chapterTitle: chapter.title,
        part: chapter.partTitle,
        questionCount: 0,
        flashcardCount: 0,
        chunkCount: 0,
      });
    }

    const contractTitleByNo = new Map(noteRows.map((row) => [row.chapterNo, row.chapterTitle]));

    for (const row of chunkRows) {
      const group = groupMap.get(row.chapterId);
      if (group) group.chunkCount += 1;
    }

    for (const row of questionRows) {
      const group = groupMap.get(row.chapterId);
      if (group) group.questionCount += 1;
    }

    for (const row of flashcardRows) {
      if (row.chapterId) {
        const group = groupMap.get(row.chapterId);
        if (group) group.flashcardCount += 1;
        continue;
      }

      if (row.chapterNo != null) {
        const fallbackId = `contract-chapter-${row.chapterNo}`;
        const existing = groupMap.get(fallbackId);
        if (existing) {
          existing.flashcardCount += 1;
        } else {
          groupMap.set(fallbackId, {
            chapterId: fallbackId,
            chapterNo: row.chapterNo,
            chapterTitle: contractTitleByNo.get(row.chapterNo) ?? `Chapter ${row.chapterNo}`,
            part: "Structured Upload",
            questionCount: 0,
            flashcardCount: 1,
            chunkCount: 0,
          });
        }
      }
    }

    const groups = Array.from(groupMap.values())
      .filter((group) => group.questionCount > 0 || group.flashcardCount > 0 || group.chunkCount > 0)
      .sort((a, b) => a.chapterNo - b.chapterNo);

    return {
      success: true,
      data: {
        groups,
        stats: {
          totalQuestions: groups.reduce((sum, group) => sum + group.questionCount, 0),
          totalFlashcards: groups.reduce((sum, group) => sum + group.flashcardCount, 0),
          totalChunks: groups.reduce((sum, group) => sum + group.chunkCount, 0),
          chaptersWithContent: groups.length,
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to load import content groups.",
    };
  }
}

export async function getChapterContentItemsAction(
  chapterId: string,
  type?: "question" | "flashcard" | "chunk",
): Promise<ActionResult<ContentItem[]>> {
  try {
    const db = await getDb();
    const chapterNo =
      chapterId.startsWith("contract-chapter-")
        ? Number.parseInt(chapterId.replace("contract-chapter-", ""), 10)
        : null;

    const items: ContentItem[] = [];

    if (!type || type === "chunk") {
      const chunkRows =
        chapterNo == null
          ? await db
              .select()
              .from(chunks)
              .where(eq(chunks.chapterId, chapterId))
              .orderBy(desc(chunks.updatedAt), desc(chunks.createdAt))
          : [];
      const chunkSlugs = chunkRows.map((row) => row.slug);
      const noteDocRows =
        chunkSlugs.length > 0
          ? await db.select().from(noteDocuments).where(inArray(noteDocuments.logicalChunkId, chunkSlugs))
          : [];
      const noteDocBySlug = new Map(noteDocRows.map((row) => [row.logicalChunkId, row]));

      for (const row of chunkRows) {
        const linkedDoc = noteDocBySlug.get(row.slug);
        items.push({
          id: row.id,
          type: "chunk",
          title: row.title ?? row.slug,
          preview: compactPreview(row.plainText ?? row.notesHtml),
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          chapterNo,
          chapterTitle: linkedDoc?.chapterTitle ?? null,
          importId: row.importId ?? null,
        });
      }
    }

    if (!type || type === "question") {
      const questionRows =
        chapterNo == null
          ? await db
              .select()
              .from(questions)
              .where(eq(questions.chapterId, chapterId))
              .orderBy(desc(questions.updatedAt), desc(questions.createdAt))
          : [];

      for (const row of questionRows) {
        items.push({
          id: row.id,
          type: "question",
          title: compactPreview(row.stemText ?? row.stemHtml),
          preview: compactPreview(row.explanationHtml ?? row.stemHtml),
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          chapterNo,
          difficulty: row.difficulty ?? null,
          subjectId: row.subject ?? null,
          importId: row.importId ?? null,
        });
      }
    }

    if (!type || type === "flashcard") {
      const flashcardRows =
        chapterNo == null
          ? await db
              .select()
              .from(flashcards)
              .where(eq(flashcards.chapterId, chapterId))
              .orderBy(desc(flashcards.updatedAt), desc(flashcards.createdAt))
          : await db
              .select()
              .from(flashcards)
              .where(eq(flashcards.chapterNo, chapterNo))
              .orderBy(desc(flashcards.updatedAt), desc(flashcards.createdAt));

      for (const row of flashcardRows) {
        items.push({
          id: row.id,
          type: "flashcard",
          title: compactPreview(row.frontHtml),
          preview: compactPreview(row.backHtml),
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          chapterNo: row.chapterNo ?? chapterNo,
          cardType: row.cardType,
          subjectId: row.deck ?? null,
          importId: row.importId ?? null,
        });
      }
    }

    return {
      success: true,
      data: items.sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt)),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to load chapter content items.",
    };
  }
}

export async function deleteContentItemAction(
  id: string,
  type: "question" | "flashcard" | "chunk",
): Promise<ActionResult<{ deleted: boolean }>> {
  try {
    const db = await getDb();

    if (type === "question") {
      const linkedExamRows = await db
        .select({ questionId: examSessionQuestions.questionId })
        .from(examSessionQuestions)
        .where(eq(examSessionQuestions.questionId, id))
        .limit(1);

      if (linkedExamRows.length > 0) {
        return {
          success: false,
          error: "Question is linked to an exam session and cannot be deleted from import admin.",
        };
      }

      await db.delete(questions).where(eq(questions.id, id));
      return { success: true, data: { deleted: true } };
    }

    if (type === "flashcard") {
      await db.delete(flashcards).where(eq(flashcards.id, id));
      return { success: true, data: { deleted: true } };
    }

    const chunkRow = await db.query.chunks.findFirst({
      where: eq(chunks.id, id),
      columns: { slug: true },
    });

    if (chunkRow?.slug) {
      const docs = await db
        .select({ docId: noteDocuments.docId })
        .from(noteDocuments)
        .where(eq(noteDocuments.logicalChunkId, chunkRow.slug));
      const docIds = docs.map((row) => row.docId);
      if (docIds.length > 0) {
        await db.delete(noteDocuments).where(inArray(noteDocuments.docId, docIds));
      }
    }

    await db.delete(chunks).where(eq(chunks.id, id));
    return { success: true, data: { deleted: true } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to delete content item.",
    };
  }
}
