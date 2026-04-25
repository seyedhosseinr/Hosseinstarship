import { NextResponse } from "next/server";
import { createManagedFlashcard, getManagedFlashcardStats, listManagedFlashcards } from "@/lib/services/flashcard-service";

function badRequest(message: string) {
  return NextResponse.json({ ok: false, message }, { status: 400 });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("q")?.trim() ?? undefined;
    const limit = Number(searchParams.get("limit") ?? 48);
    const [stats, cards] = await Promise.all([
      getManagedFlashcardStats(),
      listManagedFlashcards({
        search,
        limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 48,
      }),
    ]);

    return NextResponse.json({
      ok: true,
      stats,
      cards,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Failed to load flashcards.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      front?: string;
      back?: string;
      type?: "basic" | "basic_reverse" | "cloze" | "image_occlusion" | "mcq";
      chapterId?: string | null;
      chapterNo?: number | null;
      sourceQuestionId?: string | null;
      sourceDocId?: string | null;
      sourceFrameId?: string | null;
      anchorId?: string | null;
      highlightText?: string | null;
      educationalObjective?: string | null;
      tags?: string[] | null;
      deck?: string | null;
      sourceType?: "manual" | "question" | "note";
      importance?: number | null;
      status?: "active" | "pending_review";
    };

    if (!body.front?.trim() || !body.back?.trim()) {
      return badRequest("Both front and back are required.");
    }

    const created = await createManagedFlashcard({
      front: body.front.trim(),
      back: body.back.trim(),
      type: body.type,
      chapterId: body.chapterId ?? null,
      chapterNo: typeof body.chapterNo === "number" ? body.chapterNo : null,
      sourceQuestionId: body.sourceQuestionId ?? null,
      sourceDocId: body.sourceDocId ?? null,
      sourceFrameId: body.sourceFrameId ?? null,
      anchorId: body.anchorId ?? null,
      highlightText: body.highlightText ?? null,
      educationalObjective: body.educationalObjective ?? null,
      tags: Array.isArray(body.tags) ? body.tags : null,
      deck: body.deck ?? null,
      sourceType: body.sourceType,
      importance: typeof body.importance === "number" ? body.importance : null,
      status: body.status,
    });

    return NextResponse.json({
      ok: true,
      card: {
        id: created.record.id,
        status: created.record.status,
        dueAt: created.record.fsrsDue,
      },
      quality: created.quality,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Failed to create flashcard.",
      },
      { status: 500 },
    );
  }
}
