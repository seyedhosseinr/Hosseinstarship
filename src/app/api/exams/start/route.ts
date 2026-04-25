import { NextResponse } from "next/server";
import { startExam } from "@/lib/exam/pg-exam-service";
import { ok, fromServiceError, validationError } from "@/app/api/exams/_shared";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.mode || !body.poolMode || !body.questionCount) {
      return validationError("mode, poolMode, and questionCount are required.");
    }
    const result = await startExam({
      title: body.title,
      mode: body.mode,
      poolMode: body.poolMode,
      questionCount: Number(body.questionCount),
      selectedVolumeIds: body.selectedVolumeIds ?? [],
      selectedPartIds: body.selectedPartIds ?? [],
      selectedChapterIds: body.selectedChapterIds ?? [],
    });
    return ok(result, 201);
  } catch (err) {
    return fromServiceError(err);
  }
}
