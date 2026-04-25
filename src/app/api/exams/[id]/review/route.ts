import { getExamReview } from "@/lib/exam/pg-exam-service";
import { ok, fromServiceError } from "@/app/api/exams/_shared";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const review = await getExamReview(id);
    return ok(review);
  } catch (err) {
    return fromServiceError(err);
  }
}
