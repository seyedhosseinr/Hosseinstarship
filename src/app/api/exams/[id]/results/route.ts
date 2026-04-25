import { getExamResults } from "@/lib/exam/pg-exam-service";
import { ok, fromServiceError } from "@/app/api/exams/_shared";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const results = await getExamResults(id);
    return ok(results);
  } catch (err) {
    return fromServiceError(err);
  }
}
