/**
 * Local-first planner mirror + optimistic mutations.
 *
 * The legacy planner path is 100% server-action-driven: every read goes
 * through a server action and every write fires a server action. That's
 * fine online but completely broken offline.
 *
 * Local-first strategy (see architecture §5):
 *   - First successful server fetch after flag-on is seeded into Dexie.
 *   - All subsequent reads prefer Dexie and fall back to server.
 *   - Writes update Dexie synchronously and enqueue an outbox row.
 *   - Planner aggregation is NOT re-computed client-side — aggregates come
 *     from the server after each sync. Locally we update a cached
 *     per-task snapshot so the UI is instant.
 */

import type {
  PlannerDayRow,
  PlannerPlanRow,
  PlannerTaskRow,
  PlannerTaskStatus,
} from "./idb";
import { getLocalDb } from "./idb";
import { enqueueMutation } from "./outbox";
import type {
  SupportedPlannerTask,
  SupportedPlannerDay,
  TodayPlanResult,
  WeekPlanResult,
  WeekPlanDay,
  PlannerSummary,
} from "@/lib/planner/runtime-types";

/* ── Reads ─────────────────────────────────────────────────── */

export async function listTodayTasks(isoDate: string): Promise<PlannerTaskRow[]> {
  const db = getLocalDb();
  const days = await db.plannerDays.where("isoDate").equals(isoDate).toArray();
  if (days.length === 0) return [];
  const dayIds = days.map((d) => d.id);
  const tasks: PlannerTaskRow[] = [];
  for (const id of dayIds) {
    const rows = await db.plannerTasks.where("dayId").equals(id).toArray();
    tasks.push(...rows);
  }
  return tasks.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
}

export async function listWeekTasks(
  startIso: string,
  endIso: string,
): Promise<PlannerTaskRow[]> {
  const db = getLocalDb();
  return db.plannerTasks
    .where("scheduledFor")
    .between(startIso, endIso, true, true)
    .toArray();
}

export async function getActivePlan(): Promise<PlannerPlanRow | null> {
  const db = getLocalDb();
  const rows = await db.plannerPlans.where("status").equals("active").toArray();
  return rows[0] ?? null;
}

/* ── Writes (optimistic) ───────────────────────────────────── */

async function updateTaskStatus(
  taskId: string,
  status: PlannerTaskStatus,
  op: "start" | "complete" | "skip" | "reset",
): Promise<void> {
  const db = getLocalDb();
  await db.transaction("rw", db.plannerTasks, db.outbox, async () => {
    const existing = await db.plannerTasks.get(taskId);
    if (!existing) return;
    const now = new Date().toISOString();
    const updatedPayload = {
      ...((existing.payload ?? {}) as Record<string, unknown>),
      status,
    };
    await db.plannerTasks.put({
      ...existing,
      status,
      payload: updatedPayload,
      localUpdatedAt: now,
    });
    await enqueueMutation({
      entityType: "planner_item",
      entityLocalId: taskId,
      entityServerId: existing.serverId,
      operation: "update",
      payload: { op, taskId: existing.serverId ?? taskId, status },
    });
  });
}

export async function startTask(taskId: string): Promise<void> {
  await updateTaskStatus(taskId, "in_progress", "start");
}

export async function completeTask(taskId: string): Promise<void> {
  await updateTaskStatus(taskId, "completed", "complete");
}

export async function skipTask(taskId: string): Promise<void> {
  await updateTaskStatus(taskId, "skipped", "skip");
}

export async function resetTask(taskId: string): Promise<void> {
  await updateTaskStatus(taskId, "pending", "reset");
}

export async function rescheduleTask(
  taskId: string,
  newScheduledFor: string,
): Promise<void> {
  const db = getLocalDb();
  await db.transaction("rw", db.plannerTasks, db.outbox, async () => {
    const existing = await db.plannerTasks.get(taskId);
    if (!existing) return;
    const now = new Date().toISOString();
    await db.plannerTasks.put({
      ...existing,
      scheduledFor: newScheduledFor,
      localUpdatedAt: now,
    });
    await enqueueMutation({
      entityType: "planner_item",
      entityLocalId: taskId,
      entityServerId: existing.serverId,
      operation: "update",
      payload: {
        op: "reschedule",
        taskId: existing.serverId ?? taskId,
        scheduledFor: newScheduledFor,
      },
    });
  });
}

/* ── Additional mutations ─────────────────────────────────── */

export async function snoozeTask(taskId: string, days: number): Promise<void> {
  const d = new Date();
  d.setDate(d.getDate() + days);
  await rescheduleTask(taskId, d.toISOString().slice(0, 10));
}

export async function moveTaskToToday(taskId: string): Promise<void> {
  await rescheduleTask(taskId, new Date().toISOString().slice(0, 10));
}

/* ── Has-seed helper ───────────────────────────────────────── */

export async function hasPlannerSeed(): Promise<boolean> {
  const db = getLocalDb();
  return (await db.plannerPlans.count()) > 0;
}

export async function hasUnsyncedPlannerMutations(): Promise<boolean> {
  const db = getLocalDb();
  const count = await db.outbox
    .where("entityType")
    .equals("planner_item")
    .and((row) => row.syncStatus !== "synced")
    .count();
  return count > 0;
}

/* ── Adapter: Dexie row ↔ UI types ────────────────────────── */

function normalizeStatus(s: string): PlannerTaskStatus {
  if (s === "completed") return "completed";
  if (s === "skipped") return "skipped";
  if (s === "in_progress") return "in_progress";
  return "pending";
}

function taskRowToSupportedTask(row: PlannerTaskRow): SupportedPlannerTask {
  const p = (row.payload ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    taskType: ((p.taskType as string) ?? row.kind) as SupportedPlannerTask["taskType"],
    status: ((p.status as string) ?? row.status) as SupportedPlannerTask["status"],
    title: row.title,
    description: (p.description as string | null) ?? null,
    estimatedMinutes: (p.estimatedMinutes as number) ?? 0,
    actualMinutes: (p.actualMinutes as number) ?? 0,
    progressPercent: (p.progressPercent as number) ?? 0,
    targetCount: (p.targetCount as number | null) ?? null,
    completedCount: (p.completedCount as number) ?? 0,
    priority: (p.priority as number) ?? 0,
    scheduledDate: row.scheduledFor,
    linkedChapter: (p.linkedChapter as SupportedPlannerTask["linkedChapter"]) ?? null,
    linkedChunk: (p.linkedChunk as SupportedPlannerTask["linkedChunk"]) ?? null,
    linkedExamSession: (p.linkedExamSession as SupportedPlannerTask["linkedExamSession"]) ?? null,
    linkedDocument: (p.linkedDocument as SupportedPlannerTask["linkedDocument"]) ?? null,
    linkedFrame: (p.linkedFrame as SupportedPlannerTask["linkedFrame"]) ?? null,
  };
}

function supportedTaskToRow(
  task: SupportedPlannerTask,
  planId: string,
  dayId: string,
): PlannerTaskRow {
  return {
    id: task.id,
    serverId: task.id,
    planId,
    dayId,
    scheduledFor: task.scheduledDate ?? new Date().toISOString().slice(0, 10),
    status: normalizeStatus(task.status),
    title: task.title,
    kind: task.taskType,
    payload: {
      taskType: task.taskType,
      status: task.status,
      description: task.description,
      estimatedMinutes: task.estimatedMinutes,
      actualMinutes: task.actualMinutes,
      progressPercent: task.progressPercent,
      targetCount: task.targetCount,
      completedCount: task.completedCount,
      priority: task.priority,
      linkedChapter: task.linkedChapter,
      linkedChunk: task.linkedChunk,
      linkedExamSession: task.linkedExamSession,
      linkedDocument: task.linkedDocument,
      linkedFrame: task.linkedFrame,
    },
    localUpdatedAt: new Date().toISOString(),
  };
}

async function preserveLocallyEditedTaskRows(
  incoming: PlannerTaskRow[],
): Promise<PlannerTaskRow[]> {
  if (incoming.length === 0) return incoming;

  const db = getLocalDb();
  const unsynced = await db.outbox
    .where("entityType")
    .equals("planner_item")
    .and((row) => row.syncStatus !== "synced")
    .toArray();
  if (unsynced.length === 0) return incoming;

  const protectedIds = new Set(unsynced.map((row) => row.entityLocalId));
  return Promise.all(
    incoming.map(async (row) => {
      if (!protectedIds.has(row.id)) return row;
      return (await db.plannerTasks.get(row.id)) ?? row;
    }),
  );
}

function dayRowToSupportedDay(row: PlannerDayRow): SupportedPlannerDay {
  const p = (row.payload ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    date: row.isoDate,
    label: (p.label as string | null) ?? null,
    isRestDay: (p.isRestDay as number) ?? 0,
  };
}

/* ── Seed from server responses ───────────────────────────── */

export async function seedFromTodayPlan(data: TodayPlanResult): Promise<void> {
  const db = getLocalDb();
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  const planRow: PlannerPlanRow = {
    id: data.plan.id,
    serverId: data.plan.id,
    title: data.plan.title,
    status: "active",
    startDate: null,
    endDate: null,
    payload: {
      progressPercent: data.plan.progressPercent,
      completedTasks: data.plan.completedTasks,
      totalTasks: data.plan.totalTasks,
    },
    localUpdatedAt: now,
  };

  const dayRow: PlannerDayRow | null = data.day
    ? {
        id: data.day.id,
        serverId: data.day.id,
        planId: data.plan.id,
        isoDate: data.day.date,
        payload: { label: data.day.label, isRestDay: data.day.isRestDay },
        localUpdatedAt: now,
      }
    : null;

  const dayId = dayRow?.id ?? `day-${today}`;
  const todayTaskRows = data.tasks.map((t) =>
    supportedTaskToRow(t, data.plan.id, dayId),
  );
  const overdueTaskRows = data.overdueTasks.map((t) =>
    supportedTaskToRow(t, data.plan.id, `day-${t.scheduledDate ?? "past"}`),
  );
  const allTaskRows = await preserveLocallyEditedTaskRows([
    ...todayTaskRows,
    ...overdueTaskRows,
  ]);

  await db.transaction(
    "rw",
    db.plannerPlans,
    db.plannerDays,
    db.plannerTasks,
    async () => {
      await db.plannerPlans.put(planRow);
      if (dayRow) await db.plannerDays.put(dayRow);
      if (allTaskRows.length > 0) await db.plannerTasks.bulkPut(allTaskRows);
    },
  );
}

export async function seedFromWeekPlan(data: WeekPlanResult): Promise<void> {
  const db = getLocalDb();
  const now = new Date().toISOString();

  const planRow: PlannerPlanRow = {
    id: data.plan.id,
    serverId: data.plan.id,
    title: data.plan.title,
    status: "active",
    startDate: data.weekStart,
    endDate: data.weekEnd,
    payload: {
      progressPercent: data.plan.progressPercent,
      completedTasks: data.plan.completedTasks,
      totalTasks: data.plan.totalTasks,
    },
    localUpdatedAt: now,
  };

  const dayRows: PlannerDayRow[] = data.days.map((d) => ({
    id: d.id,
    serverId: d.id,
    planId: data.plan.id,
    isoDate: d.date,
    payload: { label: d.label, isRestDay: d.isRestDay, dayOfWeek: d.dayOfWeek },
    localUpdatedAt: now,
  }));

  const taskRows: PlannerTaskRow[] = data.days.flatMap((d) =>
    (d.tasks ?? []).map((t) => supportedTaskToRow(t, data.plan.id, d.id)),
  );
  const overdueRows = data.overdueTasks.map((t) =>
    supportedTaskToRow(t, data.plan.id, `day-${t.scheduledDate ?? "past"}`),
  );
  const allTaskRows = await preserveLocallyEditedTaskRows([
    ...taskRows,
    ...overdueRows,
  ]);

  await db.transaction(
    "rw",
    db.plannerPlans,
    db.plannerDays,
    db.plannerTasks,
    async () => {
      await db.plannerPlans.put(planRow);
      if (dayRows.length > 0) await db.plannerDays.bulkPut(dayRows);
      if (allTaskRows.length > 0) await db.plannerTasks.bulkPut(allTaskRows);
    },
  );
}

/* ── Local reads returning UI types ───────────────────────── */

export async function getTodayPlanLocal(): Promise<TodayPlanResult | null> {
  const plan = await getActivePlan();
  if (!plan) return null;

  const pp = (plan.payload ?? {}) as Record<string, unknown>;
  const today = new Date().toISOString().slice(0, 10);
  const db = getLocalDb();

  const todayRows = await db.plannerTasks
    .where("scheduledFor")
    .equals(today)
    .toArray();

  const pastRows = await db.plannerTasks
    .where("scheduledFor")
    .below(today)
    .toArray();
  const overdueRows = pastRows.filter(
    (t) => t.status !== "completed" && t.status !== "skipped",
  );

  const days = await db.plannerDays.where("isoDate").equals(today).toArray();
  const day: SupportedPlannerDay | null = days[0]
    ? dayRowToSupportedDay(days[0])
    : null;

  return {
    plan: {
      id: plan.id,
      title: plan.title,
      progressPercent: (pp.progressPercent as number) ?? 0,
      completedTasks: (pp.completedTasks as number) ?? 0,
      totalTasks: (pp.totalTasks as number) ?? 0,
      startDate: (pp.startDate as string) ?? "",
      endDate: (pp.endDate as string) ?? null,
      examDate: (pp.examDate as string) ?? null,
      selectedChapterCount:
        (pp.selectedChapterCount as number) ??
        (Array.isArray(pp.selectedChapterIds) ? (pp.selectedChapterIds as unknown[]).length : 0),
    },
    day,
    tasks: todayRows.map(taskRowToSupportedTask),
    overdueTasks: overdueRows.map(taskRowToSupportedTask),
  };
}

export async function getWeekPlanLocal(
  refDate?: string,
): Promise<WeekPlanResult | null> {
  const plan = await getActivePlan();
  if (!plan) return null;

  const pp = (plan.payload ?? {}) as Record<string, unknown>;

  // Compute Saturday–Friday week boundaries
  const ref = refDate ? new Date(refDate + "T00:00:00") : new Date();
  const dow = ref.getDay(); // 0=Sun … 6=Sat
  const satOffset = dow === 6 ? 0 : -(dow + 1);
  const weekStart = new Date(ref);
  weekStart.setDate(ref.getDate() + satOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const startIso = weekStart.toISOString().slice(0, 10);
  const endIso = weekEnd.toISOString().slice(0, 10);
  const db = getLocalDb();

  const dayRows = await db.plannerDays
    .where("isoDate")
    .between(startIso, endIso, true, true)
    .toArray();

  const tasks = await listWeekTasks(startIso, endIso);
  const tasksByDay = new Map<string, PlannerTaskRow[]>();
  for (const t of tasks) {
    if (!tasksByDay.has(t.dayId)) tasksByDay.set(t.dayId, []);
    tasksByDay.get(t.dayId)!.push(t);
  }

  const days: WeekPlanDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const dayRow = dayRows.find((r) => r.isoDate === iso);
    const dp = (dayRow?.payload ?? {}) as Record<string, unknown>;
    const dayTasks = dayRow ? (tasksByDay.get(dayRow.id) ?? []) : [];

    days.push({
      id: dayRow?.id ?? `day-${iso}`,
      date: iso,
      dayOfWeek:
        (dp.dayOfWeek as string) ??
        d.toLocaleDateString("en-US", { weekday: "long" }),
      label: (dp.label as string | null) ?? null,
      isRestDay: (dp.isRestDay as number) ?? 0,
      tasks: dayTasks.map(taskRowToSupportedTask),
    });
  }

  const pastTasks = await db.plannerTasks
    .where("scheduledFor")
    .below(startIso)
    .toArray();
  const overdue = pastTasks.filter(
    (t) => t.status !== "completed" && t.status !== "skipped",
  );

  const completedCount = tasks.filter((t) => t.status === "completed").length;

  return {
    plan: {
      id: plan.id,
      title: plan.title,
      progressPercent: (pp.progressPercent as number) ?? 0,
      completedTasks: (pp.completedTasks as number) ?? 0,
      totalTasks: (pp.totalTasks as number) ?? 0,
      startDate: (pp.startDate as string) ?? "",
      endDate: (pp.endDate as string) ?? null,
      examDate: (pp.examDate as string) ?? null,
      selectedChapterCount:
        (pp.selectedChapterCount as number) ??
        (Array.isArray(pp.selectedChapterIds) ? (pp.selectedChapterIds as unknown[]).length : 0),
    },
    weekStart: startIso,
    weekEnd: endIso,
    days,
    totalTasks: tasks.length,
    completedTasks: completedCount,
    overdueTasks: overdue.map(taskRowToSupportedTask),
  };
}

export async function getSummaryLocal(): Promise<PlannerSummary | null> {
  const plan = await getActivePlan();
  if (!plan) return null;

  const pp = (plan.payload ?? {}) as Record<string, unknown>;
  const today = new Date().toISOString().slice(0, 10);
  const db = getLocalDb();

  const todayRows = await db.plannerTasks
    .where("scheduledFor")
    .equals(today)
    .toArray();
  const completedToday = todayRows.filter(
    (t) => t.status === "completed",
  ).length;
  const estimatedMinutes = todayRows.reduce((s, t) => {
    const tp = (t.payload ?? {}) as Record<string, unknown>;
    return s + ((tp.estimatedMinutes as number) ?? 0);
  }, 0);

  return {
    plan: {
      id: plan.id,
      title: plan.title,
      progressPercent: (pp.progressPercent as number) ?? 0,
      completedTasks: (pp.completedTasks as number) ?? 0,
      totalTasks: (pp.totalTasks as number) ?? 0,
      startDate: (pp.startDate as string) ?? "",
      endDate: (pp.endDate as string) ?? null,
      examDate: (pp.examDate as string) ?? null,
      selectedChapterCount:
        (pp.selectedChapterCount as number) ??
        (Array.isArray(pp.selectedChapterIds) ? (pp.selectedChapterIds as unknown[]).length : 0),
    },
    today: {
      totalTasks: todayRows.length,
      completedTasks: completedToday,
      progressPercent:
        todayRows.length > 0
          ? Math.round((completedToday / todayRows.length) * 100)
          : 0,
      estimatedMinutes,
    },
    streak: (pp.streak as { current: number; longest: number }) ?? {
      current: 0,
      longest: 0,
    },
    overdueTasks: 0,
    upcomingTaskCount: 0,
    dailyGoalMinutes: (pp.dailyGoalMinutes as number) ?? 0,
  };
}
