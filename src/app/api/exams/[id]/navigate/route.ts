import { getDb } from "@/db/index";
import { examSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ok, fromServiceError, validationError } from "@/app/api/exams/_shared";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (typeof body.questionIndex !== "number") {
      return validationError("questionIndex required.");
    }
    const db = await getDb();
    await db
      .update(examSessions)
      .set({ currentQuestionIndex: body.questionIndex, updatedAt: Date.now() })
      .where(eq(examSessions.id, id));
    return ok({ navigated: true });
  } catch (err) {
    return fromServiceError(err);
  }
}
