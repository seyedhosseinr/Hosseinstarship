import { taskEventKind, taskStatus } from "@/db/schema";
import {
  ensurePlannerDay,
  getPlannerMonthPlan,
  getPlannerSummary,
  getPlannerTaskById,
  getPlannerTodayPlan,
  getPlannerUpcomingTasks,
  getPlannerWeekPlan,
  insertPlannerTaskEvent,
  recalculatePlannerDay,
  recalculatePlannerPlan,
  updatePlannerTask,
} from "@/lib/planner/runtime-queries";

function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function syncTaskState(task: Awaited<ReturnType<typeof getPlannerTaskById>>) {
  if (!task) return null;
  if (task.dayId) {
    await recalculatePlannerDay(task.dayId);
  }
  await recalculatePlannerPlan(task.planId);
  return task;
}

export async function getSupportedTodayPlan() {
  return getPlannerTodayPlan();
}

export async function getSupportedWeekPlan(refDate?: string) {
  const parsed = refDate ? new Date(`${refDate}T00:00:00`) : undefined;
  return getPlannerWeekPlan(parsed);
}

export async function getSupportedMonthPlan(year: number, month: number) {
  return getPlannerMonthPlan(year, month);
}

export async function getSupportedUpcomingTasks(limit?: number) {
  return getPlannerUpcomingTasks(limit ?? 10);
}

export async function getSupportedPlannerSummary() {
  return getPlannerSummary();
}

export async function startPlannerTask(taskId: string) {
  const task = await getPlannerTaskById(taskId);
  if (!task) throw new Error("Task not found");
  if (task.status !== taskStatus.pending && task.status !== taskStatus.overdue) {
    throw new Error("Task cannot be started in its current state");
  }

  const updated = await updatePlannerTask(taskId, {
    status: taskStatus.inProgress,
    startedAt: task.startedAt ?? Date.now(),
  });

  if (!updated) throw new Error("Failed to start task");

  await insertPlannerTaskEvent({
    taskId,
    eventKind: taskEventKind.started,
    payload: { previousStatus: task.status },
  });

  return syncTaskState(updated);
}

export async function completePlannerTask(
  taskId: string,
  actualMinutes?: number,
  resultJson?: Record<string, unknown>,
) {
  const task = await getPlannerTaskById(taskId);
  if (!task) throw new Error("Task not found");
  if (
    task.status === taskStatus.completed ||
    task.status === taskStatus.skipped ||
    task.status === taskStatus.rescheduled
  ) {
    throw new Error("Task cannot be completed in its current state");
  }

  const nextActualMinutes = actualMinutes ?? task.actualMinutes ?? task.estimatedMinutes;
  const updated = await updatePlannerTask(taskId, {
    status: taskStatus.completed,
    actualMinutes: nextActualMinutes,
    completedCount: task.targetCount ?? task.completedCount,
    progressPercent: 100,
    completedAt: Date.now(),
    resultJson: resultJson ?? task.resultJson ?? null,
  });

  if (!updated) throw new Error("Failed to complete task");

  await insertPlannerTaskEvent({
    taskId,
    eventKind: taskEventKind.completed,
    payload: { previousStatus: task.status, actualMinutes: nextActualMinutes },
  });

  return syncTaskState(updated);
}

export async function skipPlannerTask(taskId: string) {
  const task = await getPlannerTaskById(taskId);
  if (!task) throw new Error("Task not found");
  if (
    task.status === taskStatus.completed ||
    task.status === taskStatus.skipped ||
    task.status === taskStatus.rescheduled
  ) {
    throw new Error("Task cannot be skipped in its current state");
  }

  const updated = await updatePlannerTask(taskId, {
    status: taskStatus.skipped,
    completedAt: Date.now(),
  });

  if (!updated) throw new Error("Failed to skip task");

  await insertPlannerTaskEvent({
    taskId,
    eventKind: taskEventKind.skipped,
    payload: { previousStatus: task.status },
  });

  return syncTaskState(updated);
}

export async function reschedulePlannerTask(taskId: string, targetDate: string) {
  const task = await getPlannerTaskById(taskId);
  if (!task) throw new Error("Task not found");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    throw new Error("targetDate must be a valid ISO date");
  }

  const targetDay = await ensurePlannerDay(task.planId, targetDate);
  const updated = await updatePlannerTask(taskId, {
    dayId: targetDay.id,
    scheduledFor: targetDate,
    status: taskStatus.pending,
    startedAt: null,
    completedAt: null,
    rescheduledTo: targetDay.id,
  });

  if (!updated) throw new Error("Failed to reschedule task");

  await insertPlannerTaskEvent({
    taskId,
    eventKind: taskEventKind.rescheduled,
    payload: {
      previousDayId: task.dayId,
      previousDate: task.scheduledFor,
      targetDayId: targetDay.id,
      targetDate,
    },
  });

  if (task.dayId && task.dayId !== targetDay.id) {
    await recalculatePlannerDay(task.dayId);
  }
  await recalculatePlannerDay(targetDay.id);
  await recalculatePlannerPlan(task.planId);
  return updated;
}

export async function movePlannerTaskToToday(taskId: string) {
  return reschedulePlannerTask(taskId, localIsoDate());
}

export async function snoozePlannerTask(taskId: string, days = 1) {
  if (days < 1 || days > 30) {
    throw new Error("days must be between 1 and 30");
  }
  const target = new Date();
  target.setDate(target.getDate() + days);
  return reschedulePlannerTask(taskId, localIsoDate(target));
}
