import { eq, asc } from "drizzle-orm";
import { getDb } from "@/db/index";
import { questions, questionOptions, chapters, questionBookmarks } from "@/db/schema";
import {
  getMcqAmbossReviewFromSourceJson,
  parseJsonObject,
  type McqAmbossReview,
} from "@/types/mcq-review";

/* ------------------------------------------------------------------ */
/*  QBank question type expected by QBankScreen                        */
/* ------------------------------------------------------------------ */

export type QBankQuestion = {
  id: string;
  text: string;
  options: string[];
  optionKeys: string[];
  answer: number;
  correctAnswer: string;
  explanation?: string;
  review?: McqAmbossReview | null;
  sourceJson?: Record<string, unknown> | null;
  subject?: string;
  tags?: string[];
  difficulty?: string;
  bookmarked: boolean;
  chapterNo?: number;
};

/* ------------------------------------------------------------------ */
/*  Query: list all active questions with their options                */
/* ------------------------------------------------------------------ */

export async function listQBankQuestions(): Promise<QBankQuestion[]> {
  const db = await getDb();

  // Fetch all active questions joined with chapter for chapterNo
  const rows = await db
    .select({
      id: questions.id,
      stemText: questions.stemText,
      explanationHtml: questions.explanationHtml,
      difficulty: questions.difficulty,
      subject: questions.subject,
      tagsJson: questions.tagsJson,
      sourceJson: questions.sourceJson,
      chapterId: questions.chapterId,
      chapterNo: chapters.chapterNo,
    })
    .from(questions)
    .innerJoin(chapters, eq(questions.chapterId, chapters.id))
    .where(eq(questions.isActive, 1));

  // Load persisted bookmarks so the UI reflects DB state on first render.
  // Question bookmarks are a single-column table; loading all rows is cheap
  // and avoids N round-trips as the user scrolls.
  const bookmarkRows = await db
    .select({ questionId: questionBookmarks.questionId })
    .from(questionBookmarks);
  const bookmarkedIds = new Set(bookmarkRows.map((r) => r.questionId));

  // Fetch all options, ordered by questionId then sortOrder
  const allOptions = await db
    .select({
      questionId: questionOptions.questionId,
      optionKey: questionOptions.optionKey,
      contentText: questionOptions.contentText,
      isCorrect: questionOptions.isCorrect,
      sortOrder: questionOptions.sortOrder,
    })
    .from(questionOptions)
    .orderBy(asc(questionOptions.questionId), asc(questionOptions.sortOrder));

  // Group options by questionId
  const optionsByQuestion = new Map<
    string,
    { optionKey: string; contentText: string | null; isCorrect: number; sortOrder: number }[]
  >();
  for (const opt of allOptions) {
    const arr = optionsByQuestion.get(opt.questionId) ?? [];
    arr.push(opt);
    optionsByQuestion.set(opt.questionId, arr);
  }

  // Map to QBankQuestion format
  return rows.map((row) => {
    const opts = optionsByQuestion.get(row.id) ?? [];
    const optionTexts = opts.map((o) => o.contentText ?? "");
    const optionKeys = opts.map((o, index) => o.optionKey || String.fromCharCode(65 + index));
    const correctIndex = opts.findIndex((o) => o.isCorrect === 1);
    const correctAnswer =
      correctIndex >= 0
        ? optionKeys[correctIndex] ?? String.fromCharCode(65 + correctIndex)
        : optionKeys[0] ?? "A";
    const sourceJson = parseJsonObject(row.sourceJson);
    const review = getMcqAmbossReviewFromSourceJson(sourceJson);

    // Parse tags from JSON string
    let tags: string[] = [];
    if (row.tagsJson) {
      try {
        const parsed =
          typeof row.tagsJson === "string"
            ? JSON.parse(row.tagsJson)
            : row.tagsJson;
        if (Array.isArray(parsed)) tags = parsed;
      } catch {
        // ignore malformed JSON
      }
    }

    // Add chapter tag in ch-XXX format
    const chNo = row.chapterNo != null ? Number(row.chapterNo) : undefined;
    if (chNo != null) {
      const chTag = `ch-${chNo}`;
      if (!tags.includes(chTag)) {
        tags = [chTag, ...tags];
      }
    }

    return {
      id: row.id,
      text: row.stemText ?? "",
      options: optionTexts,
      optionKeys,
      answer: correctIndex >= 0 ? correctIndex : 0,
      correctAnswer,
      explanation: row.explanationHtml ?? undefined,
      review,
      sourceJson,
      subject: row.subject ?? undefined,
      tags,
      difficulty: row.difficulty ?? undefined,
      bookmarked: bookmarkedIds.has(row.id),
      chapterNo: chNo,
    };
  });
}
