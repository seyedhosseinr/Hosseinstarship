import { NextRequest, NextResponse } from "next/server";
import { listFlashcardsByChapter } from "@/lib/flashcards/taxonomy-queries";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const chapterNo = parseInt(searchParams.get("chapterNo") ?? "", 10);
  if (isNaN(chapterNo)) {
    return NextResponse.json({ ok: false, error: "chapterNo is required" }, { status: 400 });
  }

  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);
  const dueOnly = searchParams.get("dueOnly") === "true";
  const stateFilter = searchParams.get("state") ?? undefined;

  try {
    const cards = await listFlashcardsByChapter(chapterNo, { limit, offset, dueOnly, stateFilter });
    return NextResponse.json({ ok: true, cards });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
