import { NextResponse } from "next/server";
import { countDueFlashcards } from "@/lib/flashcards/queries";
import { normalizeChapterKey } from "@/lib/flashcards/chapter-filter";
import { listManagedDueFlashcards, reviewManagedFlashcard, undoLastManagedReview } from "@/lib/services/flashcard-service";

function parseLimit(request: Request) {
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 100);
  if (!Number.isFinite(limit)) return 100;
  return Math.min(Math.max(Math.trunc(limit), 1), 100);
}

function parseChapter(request: Request): number | undefined {
  const raw = new URL(request.url).searchParams.get("chapter");
  const key = normalizeChapterKey(raw);
  if (key == null) return undefined;
  return Number.parseInt(key, 10);
}

export async function GET(request: Request) {
  try {
    const chapterNo = parseChapter(request);
    const [cards, totalDue] = await Promise.all([
      listManagedDueFlashcards(parseLimit(request), chapterNo),
      countDueFlashcards(chapterNo ?? null),
    ]);
    return NextResponse.json({
      ok: true,
      totalDue,
      cards,
      chapter: chapterNo ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Failed to load review queue.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      flashcardId?: string;
      rating?: 1 | 2 | 3 | 4;
      sessionId?: string | null;
      timeSpentMs?: number | null;
      examDate?: number | null;
    };

    if (!body.flashcardId) {
      return NextResponse.json({ ok: false, message: "flashcardId is required." }, { status: 400 });
    }

    if (![1, 2, 3, 4].includes(body.rating ?? 0)) {
      return NextResponse.json({ ok: false, message: "rating must be between 1 and 4." }, { status: 400 });
    }

    const result = await reviewManagedFlashcard({
      flashcardId: body.flashcardId,
      rating: body.rating as 1 | 2 | 3 | 4,
      sessionId: body.sessionId ?? null,
      timeSpentMs: typeof body.timeSpentMs === "number" ? body.timeSpentMs : null,
      examDate: typeof body.examDate === "number" ? body.examDate : null,
    });

    return NextResponse.json({
      ok: true,
      result,
      remainingDue: result.remainingDue,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Failed to review flashcard.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      flashcardId?: string;
    };

    if (!body.flashcardId) {
      return NextResponse.json({ ok: false, message: "flashcardId is required." }, { status: 400 });
    }

    const result = await undoLastManagedReview(body.flashcardId);
    return NextResponse.json({
      ok: true,
      undone: Boolean(result),
      remainingDue: result?.remainingDue ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Failed to undo flashcard review.",
      },
      { status: 500 },
    );
  }
}
