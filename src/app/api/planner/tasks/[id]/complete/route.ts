import { NextResponse } from "next/server";
import { revalidateAfterTaskComplete } from "@/lib/cache/revalidation";
import { completePlannerTask } from "@/lib/services/planner-runtime-service";

function mapErrorToHttp(err: unknown): { status: number; body: Record<string, unknown> } {
  const message = err instanceof Error ? err.message : "Planner action failed";
  if (message.includes("not found")) {
    return { status: 404, body: { ok: false, code: "NOT_FOUND", message } };
  }
  if (message.includes("cannot")) {
    return { status: 409, body: { ok: false, code: "INVALID_STATE", message } };
  }
  return { status: 400, body: { ok: false, code: "PLANNER_ACTION_FAILED", message } };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ ok: false, code: "VALIDATION_ERROR", message: "task id required" }, { status: 400 });
    }
    const body = (await request.json().catch(() => ({}))) as {
      actualMinutes?: number;
      resultJson?: Record<string, unknown>;
    };
    const updated = await completePlannerTask(id, body.actualMinutes, body.resultJson);
    if (!updated) {
      return NextResponse.json({ ok: false, code: "SYNC_FAILED", message: "Task updated but state sync failed" }, { status: 500 });
    }
    revalidateAfterTaskComplete();
    return NextResponse.json({
      ok: true,
      task: {
        id: updated.id,
        status: updated.status,
        completedAt: updated.completedAt,
        actualMinutes: updated.actualMinutes,
      },
    });
  } catch (err) {
    const { status, body } = mapErrorToHttp(err);
    return NextResponse.json(body, { status });
  }
}
