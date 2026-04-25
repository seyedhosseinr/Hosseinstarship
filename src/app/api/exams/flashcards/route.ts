import { createFlashcardFromQuestion } from "@/lib/exam/pg-exam-queries";
import { ok, fromServiceError, validationError } from "@/app/api/exams/_shared";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.questionId || !body.front || !body.back) {
      return validationError("questionId, front, back required.");
    }
    const id = await createFlashcardFromQuestion({
      questionId: body.questionId,
      examSessionId: body.examSessionId,
      front: body.front,
      back: body.back,
      subject: body.subject,
      deck: body.deck,
    });
    return ok({ flashcardId: id }, 201);
  } catch (err) {
    return fromServiceError(err);
  }
}

export async function GET() {
  return ok({ message: "Use POST to create flashcards from questions." });
}
