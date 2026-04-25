import { NextRequest, NextResponse } from "next/server";
import { chapterStatuses } from "@/lib/library/progress";
import {
  recordChapterOpen,
  recordChapterQuestionAttempt,
  recordChapterRead,
  setManualChapterStatus,
} from "@/lib/library/progress";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const chapterNo = Number(body?.chapterNo);

  if (!Number.isInteger(chapterNo) || chapterNo <= 0) {
    return NextResponse.json({ error: "Invalid chapterNo" }, { status: 400 });
  }

  switch (body?.event) {
    case "opened":
      await recordChapterOpen(chapterNo);
      return NextResponse.json({ ok: true });
    case "read":
      await recordChapterRead(chapterNo);
      return NextResponse.json({ ok: true });
    case "set_status":
      if (!chapterStatuses.includes(body?.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        status: await setManualChapterStatus(chapterNo, body.status),
      });
    case "question_attempt":
      await recordChapterQuestionAttempt(chapterNo, Boolean(body?.correct));
      return NextResponse.json({ ok: true });
    default:
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }
}
