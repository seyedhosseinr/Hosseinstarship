import { getExamHistory } from "@/lib/exam/pg-exam-service";
import { ok, fromServiceError } from "@/app/api/exams/_shared";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "20");
    const history = await getExamHistory(limit);
    return ok(history);
  } catch (err) {
    return fromServiceError(err);
  }
}
