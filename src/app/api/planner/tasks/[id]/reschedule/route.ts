import { NextResponse } from "next/server";
import { revalidateAfterTaskComplete } from "@/lib/cache/revalidation";
import { reschedulePlannerTask } from "@/lib/services/planner-runtime-service";

function mapErrorToHttp(err: unknown): { status: number; body: Record<string, unknown> } {
  const message = err instanceof Error ? err.message : "Planner action failed";
  if (message.includes("not found")) {
    return { status: 404, body: { ok: false, code: "NOT_FOUND", message } };
  }
  if (message.includes("cannot")) {
    return { status: 409, body: { ok: false, code: "INVALID_STATE", message } };
  }
  if (message.includes("targetDate")) {
    return { status: 400, body: { ok: false, code: "VALIDATION_ERROR", message } };
  }
  return { status: 400, body: { ok: false, code: "PLANNER_ACTION_FAILED", message } };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ ok: false, code: "VALIDATION_ERROR", message: "task id required" }, { status: 400 });
    }
    const body = (await request.json().catch(() => ({}))) as { targetDate?: string };
    if (!body.targetDate || typeof body.targetDate !== "string") {
      return NextResponse.json(
        { ok: false, code: "VALIDATION_ERROR", message: "targetDate (YYYY-MM-DD) is required" },
        { status: 400 },
      );
    }
    const updated = await reschedulePlannerTask(id, body.targetDate);
    revalidateAfterTaskComplete();
    return NextResponse.json({
      ok: true,
      task: {
        id: updated.id,
        status: updated.status,
        scheduledFor: updated.scheduledFor,
        dayId: updated.dayId,
      },
    });
  } catch (err) {
    const { status, body } = mapErrorToHttp(err);
    return NextResponse.json(body, { status });
  }
}
