import { getDb } from "@/db/index";
import { questionAttempts, questions } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/questions/missed?chapterNo=95
 *
 * Returns the distinct question IDs that the user has answered incorrectly
 * for a given chapter. Used by the reader to highlight frames linked to
 * missed questions.
 */
export async function GET(req: NextRequest) {
  const chapterNo = req.nextUrl.searchParams.get("chapterNo");
  if (!chapterNo) {
    return NextResponse.json({ ok: false, questionIds: [] });
  }

  try {
    const db = await getDb();

    // Find questions tagged with this chapter that were answered incorrectly.
    // Questions store chapter tags in tagsJson as JSON array strings like ["ch-95", ...].
    // We look for the non-padded format.
    const chapterTag = `ch-${parseInt(chapterNo, 10)}`;

    const rows = await db
      .selectDistinct({ questionId: questionAttempts.questionId })
      .from(questionAttempts)
      .innerJoin(questions, eq(questionAttempts.questionId, questions.id))
      .where(
        and(
          eq(questionAttempts.outcome, "incorrect"),
          sql`${questions.tagsJson} LIKE ${"%" + chapterTag + "%"}`,
        ),
      );

    const questionIds = rows.map((r) => r.questionId);
    return NextResponse.json({ ok: true, questionIds });
  } catch {
    return NextResponse.json({ ok: true, questionIds: [] });
  }
}
