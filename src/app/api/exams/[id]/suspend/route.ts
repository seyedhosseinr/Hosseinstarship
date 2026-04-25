import { suspendExam } from "@/lib/exam/pg-exam-service";
import { ok, fromServiceError } from "@/app/api/exams/_shared";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    await suspendExam(id, body.elapsedSeconds ?? 0);
    return ok({ suspended: true });
  } catch (err) {
    return fromServiceError(err);
  }
}
