import { NextResponse } from "next/server";
import { getFlashcardHierarchyCounts } from "@/lib/flashcards/taxonomy-queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const hierarchy = await getFlashcardHierarchyCounts();

    // Compute totals
    let totalCards = 0, totalDue = 0, totalNew = 0;
    for (const vol of hierarchy) {
      totalCards += vol.total;
      totalDue += vol.due;
      totalNew += vol.newCount;
    }

    return NextResponse.json({ ok: true, hierarchy, totalCards, totalDue, totalNew });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
