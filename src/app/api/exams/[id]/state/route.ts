import { getExamState } from "@/lib/exam/pg-exam-service";
import { ok, fromServiceError } from "@/app/api/exams/_shared";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const state = await getExamState(id);
    return ok(state);
  } catch (err) {
    return fromServiceError(err);
  }
}
