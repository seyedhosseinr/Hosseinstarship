"use server";

import { revalidateAfterTaskComplete } from "@/lib/cache/revalidation";
import {
  completePlannerTask,
  getSupportedMonthPlan,
  getSupportedPlannerSummary,
  getSupportedTodayPlan,
  getSupportedUpcomingTasks,
  getSupportedWeekPlan,
  movePlannerTaskToToday,
  reschedulePlannerTask,
  skipPlannerTask,
  snoozePlannerTask,
  startPlannerTask,
} from "@/lib/services/planner-runtime-service";

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

function succeed<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

function fail(code: string, message: string): ActionResult<never> {
  return { ok: false, error: { code, message } };
}

function handleError(error: unknown): ActionResult<never> {
  if (error instanceof Error) {
    if (error.message.includes("not found")) return fail("NOT_FOUND", error.message);
    if (error.message.includes("cannot")) return fail("INVALID_STATE", error.message);
    if (error.message.includes("No active")) return fail("NO_ACTIVE_PLAN", error.message);
    return fail("SERVICE_ERROR", error.message);
  }

  return fail("INTERNAL_ERROR", "An unexpected planner error occurred.");
}

export async function getTodayPlanAction() {
  try {
    const result = await getSupportedTodayPlan();
    if (!result) return fail("NO_ACTIVE_PLAN", "No active study plan found.");
    return succeed(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function getWeekPlanAction(refDate?: string) {
  try {
    const result = await getSupportedWeekPlan(refDate);
    if (!result) return fail("NO_ACTIVE_PLAN", "No active study plan found.");
    return succeed(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function getMonthPlanAction(year: number, month: number) {
  try {
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return fail("VALIDATION_ERROR", "year and month (1-12) are required.");
    }
    const result = await getSupportedMonthPlan(year, month);
    if (!result) return fail("NO_ACTIVE_PLAN", "No active study plan found.");
    return succeed(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function getUpcomingTasksAction(limit?: number) {
  try {
    return succeed(await getSupportedUpcomingTasks(limit));
  } catch (error) {
    return handleError(error);
  }
}

export async function getPlannerSummaryAction() {
  try {
    return succeed(await getSupportedPlannerSummary());
  } catch (error) {
    return handleError(error);
  }
}

export async function startTaskAction(taskId: string) {
  try {
    if (!taskId) return fail("VALIDATION_ERROR", "taskId is required.");
    const result = await startPlannerTask(taskId);
    revalidateAfterTaskComplete();
    return succeed(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function completeTaskAction(taskId: string, actualMinutes?: number, resultJson?: Record<string, unknown>) {
  try {
    if (!taskId) return fail("VALIDATION_ERROR", "taskId is required.");
    const result = await completePlannerTask(taskId, actualMinutes, resultJson);
    revalidateAfterTaskComplete();
    return succeed(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function skipTaskAction(taskId: string) {
  try {
    if (!taskId) return fail("VALIDATION_ERROR", "taskId is required.");
    const result = await skipPlannerTask(taskId);
    revalidateAfterTaskComplete();
    return succeed(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function rescheduleTaskAction(taskId: string, targetDate: string) {
  try {
    if (!taskId) return fail("VALIDATION_ERROR", "taskId is required.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return fail("VALIDATION_ERROR", "targetDate must be a valid ISO date (YYYY-MM-DD).");
    }
    const result = await reschedulePlannerTask(taskId, targetDate);
    revalidateAfterTaskComplete();
    return succeed(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function moveToTodayAction(taskId: string) {
  try {
    if (!taskId) return fail("VALIDATION_ERROR", "taskId is required.");
    const result = await movePlannerTaskToToday(taskId);
    revalidateAfterTaskComplete();
    return succeed(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function snoozeTaskAction(taskId: string, days = 1) {
  try {
    if (!taskId) return fail("VALIDATION_ERROR", "taskId is required.");
    const result = await snoozePlannerTask(taskId, days);
    revalidateAfterTaskComplete();
    return succeed(result);
  } catch (error) {
    return handleError(error);
  }
}
