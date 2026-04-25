import { submitAnswer } from "@/lib/exam/pg-exam-service";
import { ok, fromServiceError, validationError } from "@/app/api/exams/_shared";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (typeof body.orderIndex !== "number" || !body.selectedOptionId) {
      return validationError("orderIndex and selectedOptionId are required.");
    }
    const result = await submitAnswer(
      id,
      body.orderIndex,
      body.selectedOptionId,
      body.timeSpentSeconds ?? 0,
    );
    return ok(result);
  } catch (err) {
    return fromServiceError(err);
  }
}
