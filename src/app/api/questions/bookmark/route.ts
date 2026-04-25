/**
 * POST /api/questions/bookmark
 * Body: { questionId: string }
 * Toggles a bookmark in the `question_bookmarks` table and returns the new
 * state. Kept side-effect-only (no GET) because the bookmarked set is loaded
 * in `listQBankQuestions` on page render.
 */
import { NextRequest, NextResponse } from "next/server";
import { toggleBookmark } from "@/lib/exam/pg-exam-queries";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const questionId = typeof body?.questionId === "string" ? body.questionId.trim() : "";
    if (!questionId) {
      return NextResponse.json(
        { ok: false, error: "questionId is required" },
        { status: 400 },
      );
    }
    const bookmarked = await toggleBookmark(questionId);
    return NextResponse.json({ ok: true, questionId, bookmarked });
  } catch (error) {
    console.error("[questions/bookmark]", error);
    return NextResponse.json(
      { ok: false, error: "Failed to toggle bookmark" },
      { status: 500 },
    );
  }
}
