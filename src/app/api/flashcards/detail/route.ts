import { NextRequest, NextResponse } from "next/server";
import { getFlashcardSourceContext } from "@/lib/flashcards/taxonomy-queries";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
  }

  try {
    const context = await getFlashcardSourceContext(id);
    return NextResponse.json({ ok: true, data: context });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
