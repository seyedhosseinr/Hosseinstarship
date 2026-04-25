import { toggleMark } from "@/lib/exam/pg-exam-service";
import { ok, fromServiceError, validationError } from "@/app/api/exams/_shared";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (typeof body.orderIndex !== "number") {
      return validationError("orderIndex required.");
    }
    const result = await toggleMark(id, body.orderIndex);
    return ok(result);
  } catch (err) {
    return fromServiceError(err);
  }
}
