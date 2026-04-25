/**
 * QBank corpus audits.
 *
 * `getCorrectAnswerDistribution` measures where the correct option sits in
 * the stored display order (A, B, C, D, ...) across every active question.
 * A healthy exam corpus is roughly uniform; a strong skew — for example,
 * >50% of answers concentrated on B — points at generator bias in the
 * import pipeline rather than a mapping bug in the app.
 *
 * This is a DIAGNOSTIC, not a runtime code path. It is safe to call from a
 * script (e.g. `DB_RUNTIME=pglite tsx scripts/audit-qbank-bias.ts`) or from
 * a test with a stubbed row source.
 */

import { asc, eq } from "drizzle-orm";

import { getDb } from "@/db/index";
import { questionOptions, questions } from "@/db/schema";

export interface CorrectAnswerDistribution {
  counts: Record<string, number>;
  totalWithCorrect: number;
  totalQuestions: number;
  /** Percent of `totalWithCorrect` in the most populated slot, 0–100. */
  maxShare: number;
  /** The letter at `maxShare`. */
  maxKey: string | null;
}

export interface OptionRowLike {
  questionId: string;
  optionKey: string;
  isCorrect: number;
  sortOrder: number;
}

/**
 * Compute distribution over a flat list of option rows. Exported for tests
 * so we can run deterministic fixtures without touching the DB.
 */
export function computeCorrectAnswerDistribution(
  rows: readonly OptionRowLike[],
  questionIds: readonly string[],
): CorrectAnswerDistribution {
  const byQuestion = new Map<string, OptionRowLike[]>();
  for (const r of rows) {
    const arr = byQuestion.get(r.questionId);
    if (arr) arr.push(r);
    else byQuestion.set(r.questionId, [r]);
  }

  const counts: Record<string, number> = {};
  let totalWithCorrect = 0;

  for (const qid of questionIds) {
    const opts = byQuestion.get(qid);
    if (!opts || opts.length === 0) continue;
    const ordered = opts.slice().sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = ordered.findIndex((o) => o.isCorrect === 1);
    if (idx < 0) continue;
    // Use position letter — audit is about where the correct answer SITS
    // in the displayed order, not which key was stored.
    const letter = String.fromCharCode(65 + idx);
    counts[letter] = (counts[letter] ?? 0) + 1;
    totalWithCorrect += 1;
  }

  let maxKey: string | null = null;
  let maxCount = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (v > maxCount) {
      maxCount = v;
      maxKey = k;
    }
  }
  const maxShare =
    totalWithCorrect > 0 ? Math.round((maxCount / totalWithCorrect) * 1000) / 10 : 0;

  return {
    counts,
    totalWithCorrect,
    totalQuestions: questionIds.length,
    maxShare,
    maxKey,
  };
}

/**
 * Run the distribution audit against the live database. Returns an empty
 * report if no active questions exist.
 */
export async function getCorrectAnswerDistribution(): Promise<CorrectAnswerDistribution> {
  const db = await getDb();
  const qRows = await db
    .select({ id: questions.id })
    .from(questions)
    .where(eq(questions.isActive, 1));
  const questionIds = qRows.map((r) => r.id);
  if (questionIds.length === 0) {
    return {
      counts: {},
      totalWithCorrect: 0,
      totalQuestions: 0,
      maxShare: 0,
      maxKey: null,
    };
  }

  const optRows = await db
    .select({
      questionId: questionOptions.questionId,
      optionKey: questionOptions.optionKey,
      isCorrect: questionOptions.isCorrect,
      sortOrder: questionOptions.sortOrder,
    })
    .from(questionOptions)
    .orderBy(asc(questionOptions.questionId), asc(questionOptions.sortOrder));

  return computeCorrectAnswerDistribution(optRows, questionIds);
}
