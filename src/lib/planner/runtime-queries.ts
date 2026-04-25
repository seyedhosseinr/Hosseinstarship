import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  lt,
  lte,
  ne,
  sql,
} from "drizzle-orm";
import { getDb } from "@/db/index";
import {
  chapters,
  chunks,
  dayOfWeek,
  examSessions,
  noteDocuments,
  noteFrames,
  planDayStatus,
  planStatus,
  studyPlanDays,
  studyPlannerSettings,
  studyPlans,
  studyTaskEvents,
  studyTaskLinks,
  studyTasks,
  taskEventKind,
  taskStatus,
} from "@/db/schema";
import type {
  MonthPlanDay,
  MonthPlanResult,
  PlannerSummary,
  SupportedPlannerDay,
  SupportedPlannerTask,
  TaskStatusValue,
  TodayPlanResult,
  WeekPlanDay,
  WeekPlanResult,
} from "./runtime-types";

type DayOfWeekValue = (typeof dayOfWeek)[keyof typeof dayOfWeek];
type SupportedPlan = typeof studyPlans.$inferSelect;

type PlannerTaskRow = {
  id: string;
  taskType: SupportedPlannerTask["taskType"];
  status: TaskStatusValue;
  title: string;
  description: string | null;
  estimatedMinutes: number;
  actualMinutes: number;
  progressPercent: number;
  targetCount: number | null;
  completedCount: number;
  priority: number;
  scheduledDate: string | null;
  chapterId: string | null;
  chapterTitle: string | null;
  chapterNo: number | null;
  chunkId: string | null;
  chunkTitle: string | null;
  chunkIndex: number | null;
  examSessionId: string | null;
  examSessionTitle: string | null;
  examSessionStatus: string | null;
  docId: string | null;
  docChapterNo: number | null;
  docChapterTitle: string | null;
  docChunkIndex: number | null;
  frameId: string | null;
  frameTitle: string | null;
  frameSectionId: string | null;
};

const ACTIVE_QUEUE_STATUSES: TaskStatusValue[] = [
  taskStatus.pending,
  taskStatus.inProgress,
  taskStatus.overdue,
];

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function serializeJsonRecord(value: Record<string, unknown> | null | undefined) {
  return value == null ? null : sql`${JSON.stringify(value)}`;
}

function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return null;
}

function addDays(value: string, amount: number) {
  const date = parseIsoDate(value);
  date.setDate(date.getDate() + amount);
  return toIsoDate(date);
}

function startOfStudyWeek(value: string) {
  const date = parseIsoDate(value);
  const shift = (date.getDay() + 1) % 7;
  date.setDate(date.getDate() - shift);
  return toIsoDate(date);
}

function endOfStudyWeek(value: string) {
  return addDays(startOfStudyWeek(value), 6);
}

function toDayOfWeekValue(value: string): DayOfWeekValue {
  const map: DayOfWeekValue[] = [
    dayOfWeek.sunday,
    dayOfWeek.monday,
    dayOfWeek.tuesday,
    dayOfWeek.wednesday,
    dayOfWeek.thursday,
    dayOfWeek.friday,
    dayOfWeek.saturday,
  ];
  return map[parseIsoDate(value).getDay()];
}

function buildTaskMap(rows: PlannerTaskRow[]): SupportedPlannerTask[] {
  const tasks = new Map<string, SupportedPlannerTask>();

  for (const row of rows) {
    const existing = tasks.get(row.id);
    if (existing) {
      if (!existing.linkedChapter && row.chapterId && row.chapterTitle && row.chapterNo != null) {
        existing.linkedChapter = { id: row.chapterId, title: row.chapterTitle, chapterNo: row.chapterNo };
      }
      if (!existing.linkedChunk && row.chunkId && row.chunkIndex != null) {
        existing.linkedChunk = { id: row.chunkId, title: row.chunkTitle, chunkIndex: row.chunkIndex };
      }
      if (!existing.linkedExamSession && row.examSessionId) {
        existing.linkedExamSession = {
          id: row.examSessionId,
          title: row.examSessionTitle,
          status: row.examSessionStatus ?? "unknown",
        };
      }
      if (!existing.linkedDocument && row.docId && row.docChapterNo != null && row.docChunkIndex != null) {
        existing.linkedDocument = {
          docId: row.docId,
          chapterNo: row.docChapterNo,
          chapterTitle: row.docChapterTitle ?? "",
          chunkIndex: row.docChunkIndex,
        };
      }
      if (!existing.linkedFrame && row.frameId && row.frameTitle && row.frameSectionId) {
        existing.linkedFrame = {
          frameId: row.frameId,
          title: row.frameTitle,
          sectionId: row.frameSectionId,
        };
      }
      continue;
    }

    tasks.set(row.id, {
      id: row.id,
      taskType: row.taskType,
      status: row.status,
      title: row.title,
      description: row.description,
      estimatedMinutes: row.estimatedMinutes,
      actualMinutes: row.actualMinutes,
      progressPercent: row.progressPercent,
      targetCount: row.targetCount,
      completedCount: row.completedCount,
      priority: row.priority,
      scheduledDate: row.scheduledDate,
      linkedChapter:
        row.chapterId && row.chapterTitle && row.chapterNo != null
          ? { id: row.chapterId, title: row.chapterTitle, chapterNo: row.chapterNo }
          : null,
      linkedChunk:
        row.chunkId && row.chunkIndex != null
          ? { id: row.chunkId, title: row.chunkTitle, chunkIndex: row.chunkIndex }
          : null,
      linkedExamSession:
        row.examSessionId
          ? { id: row.examSessionId, title: row.examSessionTitle, status: row.examSessionStatus ?? "unknown" }
          : null,
      linkedDocument:
        row.docId && row.docChapterNo != null && row.docChunkIndex != null
          ? {
              docId: row.docId,
              chapterNo: row.docChapterNo,
              chapterTitle: row.docChapterTitle ?? "",
              chunkIndex: row.docChunkIndex,
            }
          : null,
      linkedFrame:
        row.frameId && row.frameTitle && row.frameSectionId
          ? { frameId: row.frameId, title: row.frameTitle, sectionId: row.frameSectionId }
          : null,
    });
  }

  return Array.from(tasks.values());
}

function toSupportedDay(day: typeof studyPlanDays.$inferSelect): SupportedPlannerDay {
  return { id: day.id, date: day.date, label: day.label, isRestDay: day.isRestDay };
}

function toPlanSnapshot(plan: SupportedPlan) {
  // selectedChapterIdsJson is stored as text but typed as string[] | null via drizzle $type;
  // runtime value may arrive as array (driver-decoded) or JSON string — normalise to a count.
  let selectedChapterCount = 0;
  const raw: unknown = plan.selectedChapterIdsJson;
  if (Array.isArray(raw)) {
    selectedChapterCount = raw.length;
  } else if (typeof raw === "string" && raw.length > 0) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) selectedChapterCount = parsed.length;
    } catch {
      // ignore — leave 0
    }
  }
  return {
    id: plan.id,
    title: plan.title,
    progressPercent: plan.progressPercent,
    completedTasks: plan.completedTasks,
    totalTasks: plan.totalTasks,
    startDate: plan.startDate,
    endDate: plan.endDate,
    examDate: plan.examDate,
    selectedChapterCount,
  };
}

async function selectResolvedTasks(whereClause: ReturnType<typeof and>) {
  const db = await getDb();
  const rows = await db
    .select({
      id: studyTasks.id,
      taskType: studyTasks.taskType,
      status: studyTasks.status,
      title: studyTasks.title,
      description: studyTasks.description,
      estimatedMinutes: studyTasks.estimatedMinutes,
      actualMinutes: studyTasks.actualMinutes,
      progressPercent: studyTasks.progressPercent,
      targetCount: studyTasks.targetCount,
      completedCount: studyTasks.completedCount,
      priority: studyTasks.priority,
      scheduledDate: studyTasks.scheduledFor,
      chapterId: chapters.id,
      chapterTitle: chapters.title,
      chapterNo: chapters.chapterNo,
      chunkId: chunks.id,
      chunkTitle: chunks.title,
      chunkIndex: chunks.chunkIndex,
      examSessionId: examSessions.id,
      examSessionTitle: examSessions.title,
      examSessionStatus: examSessions.status,
      docId: noteDocuments.docId,
      docChapterNo: noteDocuments.chapterNo,
      docChapterTitle: noteDocuments.chapterTitle,
      docChunkIndex: noteDocuments.chunkIndex,
      frameId: noteFrames.frameId,
      frameTitle: noteFrames.title,
      frameSectionId: noteFrames.sectionId,
    })
    .from(studyTasks)
    .leftJoin(studyTaskLinks, eq(studyTaskLinks.taskId, studyTasks.id))
    .leftJoin(chapters, eq(studyTaskLinks.chapterId, chapters.id))
    .leftJoin(chunks, eq(studyTaskLinks.chunkId, chunks.id))
    .leftJoin(examSessions, eq(studyTaskLinks.examSessionId, examSessions.id))
    .leftJoin(noteDocuments, eq(studyTaskLinks.docId, noteDocuments.docId))
    .leftJoin(noteFrames, eq(studyTaskLinks.frameId, noteFrames.frameId))
    .where(whereClause)
    .orderBy(asc(studyTasks.scheduledFor), asc(studyTasks.sortOrder), asc(studyTasks.createdAt));

  return buildTaskMap(rows);
}

export async function getActivePlannerPlan() {
  const db = await getDb();
  const rows = await db
    .select()
    .from(studyPlans)
    .where(eq(studyPlans.status, planStatus.active))
    .orderBy(desc(studyPlans.updatedAt), desc(studyPlans.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

export async function getPlannerSettingsSnapshot() {
  const db = await getDb();
  const rows = await db
    .select()
    .from(studyPlannerSettings)
    .orderBy(desc(studyPlannerSettings.updatedAt), desc(studyPlannerSettings.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

export async function ensurePlannerDay(planId: string, isoDate: string) {
  const db = await getDb();
  const existing = await db
    .select()
    .from(studyPlanDays)
    .where(and(eq(studyPlanDays.planId, planId), eq(studyPlanDays.date, isoDate)))
    .limit(1);

  if (existing[0]) return existing[0];

  const created = await db
    .insert(studyPlanDays)
    .values({
      id: makeId("plan_day"),
      planId,
      date: isoDate,
      dayOfWeek: toDayOfWeekValue(isoDate),
      label: null,
      isRestDay: 0,
      totalTasks: 0,
      completedTasks: 0,
      estimatedMinutes: 0,
      actualMinutes: 0,
      targetMinutes: 0,
      assignedMinutes: 0,
      completedMinutes: 0,
      status: planDayStatus.scheduled,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    .returning();

  return created[0];
}

export async function markPlannerOverdueTasks(planId: string, todayIso = toIsoDate(new Date())) {
  const db = await getDb();
  const rows = await db
    .update(studyTasks)
    .set({ status: taskStatus.overdue, updatedAt: Date.now() })
    .where(
      and(
        eq(studyTasks.planId, planId),
        inArray(studyTasks.status, [taskStatus.pending, taskStatus.inProgress]),
        lt(studyTasks.scheduledFor, todayIso),
      ),
    )
    .returning();

  return rows.length;
}

export async function getPlannerDayByDate(planId: string, isoDate: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(studyPlanDays)
    .where(and(eq(studyPlanDays.planId, planId), eq(studyPlanDays.date, isoDate)))
    .limit(1);

  return rows[0] ?? null;
}

export async function getPlannerTaskById(taskId: string) {
  const db = await getDb();
  const rows = await db.select().from(studyTasks).where(eq(studyTasks.id, taskId)).limit(1);
  const task = rows[0];
  if (!task) return null;
  return {
    ...task,
    resultJson: parseJsonRecord(task.resultJson),
  };
}

export async function getPlannerTodayPlan(): Promise<TodayPlanResult | null> {
  const plan = await getActivePlannerPlan();
  if (!plan) return null;

  const todayIso = toIsoDate(new Date());
  await markPlannerOverdueTasks(plan.id, todayIso);

  const [day, tasks, overdueTasks] = await Promise.all([
    getPlannerDayByDate(plan.id, todayIso),
    selectResolvedTasks(and(eq(studyTasks.planId, plan.id), eq(studyTasks.scheduledFor, todayIso), ne(studyTasks.status, taskStatus.rescheduled))),
    selectResolvedTasks(and(eq(studyTasks.planId, plan.id), eq(studyTasks.status, taskStatus.overdue))),
  ]);

  return {
    plan: toPlanSnapshot(plan),
    day: day ? toSupportedDay(day) : null,
    tasks,
    overdueTasks,
  };
}

export async function getPlannerUpcomingTasks(limit = 10) {
  const plan = await getActivePlannerPlan();
  if (!plan) return [] as SupportedPlannerTask[];

  const todayIso = toIsoDate(new Date());
  await markPlannerOverdueTasks(plan.id, todayIso);

  const tasks = await selectResolvedTasks(
    and(
      eq(studyTasks.planId, plan.id),
      gte(studyTasks.scheduledFor, addDays(todayIso, 1)),
      inArray(studyTasks.status, ACTIVE_QUEUE_STATUSES),
      ne(studyTasks.status, taskStatus.rescheduled),
    ),
  );

  return tasks.slice(0, limit);
}

export async function getPlannerWeekPlan(refDate?: Date): Promise<WeekPlanResult | null> {
  const plan = await getActivePlannerPlan();
  if (!plan) return null;

  const refIso = toIsoDate(refDate ?? new Date());
  const weekStart = startOfStudyWeek(refIso);
  const weekEnd = endOfStudyWeek(refIso);
  await markPlannerOverdueTasks(plan.id);

  const db = await getDb();
  const [dayRows, tasks, overdueTasks] = await Promise.all([
    db
      .select()
      .from(studyPlanDays)
      .where(and(eq(studyPlanDays.planId, plan.id), gte(studyPlanDays.date, weekStart), lte(studyPlanDays.date, weekEnd)))
      .orderBy(asc(studyPlanDays.date)),
    selectResolvedTasks(and(eq(studyTasks.planId, plan.id), gte(studyTasks.scheduledFor, weekStart), lte(studyTasks.scheduledFor, weekEnd), ne(studyTasks.status, taskStatus.rescheduled))),
    selectResolvedTasks(and(eq(studyTasks.planId, plan.id), eq(studyTasks.status, taskStatus.overdue))),
  ]);

  const tasksByDate = new Map<string, SupportedPlannerTask[]>();
  for (const task of tasks) {
    const dateKey = task.scheduledDate ?? weekStart;
    const bucket = tasksByDate.get(dateKey) ?? [];
    bucket.push(task);
    tasksByDate.set(dateKey, bucket);
  }

  const dayMap = new Map(dayRows.map((day) => [day.date, day]));
  const days: WeekPlanDay[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const isoDate = addDays(weekStart, offset);
    const existing = dayMap.get(isoDate);
    days.push(
      existing
        ? { ...toSupportedDay(existing), dayOfWeek: existing.dayOfWeek, tasks: tasksByDate.get(isoDate) ?? [] }
        : { id: `${plan.id}:${isoDate}`, date: isoDate, label: null, isRestDay: 0, dayOfWeek: toDayOfWeekValue(isoDate), tasks: tasksByDate.get(isoDate) ?? [] },
    );
  }

  const totalTasks = days.reduce((sum, day) => sum + day.tasks.length, 0);
  const completedTasks = days.reduce((sum, day) => sum + day.tasks.filter((task) => task.status === taskStatus.completed).length, 0);

  return {
    plan: toPlanSnapshot(plan),
    weekStart,
    weekEnd,
    days,
    totalTasks,
    completedTasks,
    overdueTasks,
  };
}

/**
 * Month plan for the planner-v2 calendar view. Returns exactly 42 cells (6 weeks × 7 days)
 * aligned to a week-start-on-Saturday grid — the leading/trailing cells are marked `inMonth: false`.
 *
 * `year` and `month` are Gregorian (month is 1-12). The caller is responsible for Jalali↔Gregorian
 * translation on the client — this keeps the DB query logic simple (all stored dates are Gregorian ISO).
 */
export async function getPlannerMonthPlan(year: number, month: number): Promise<MonthPlanResult | null> {
  const plan = await getActivePlannerPlan();
  if (!plan) return null;

  await markPlannerOverdueTasks(plan.id);

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0)); // last day of month
  const monthStartIso = toIsoDate(monthStart);
  const monthEndIso = toIsoDate(monthEnd);

  // Align the grid to week-start-on-Saturday (startOfStudyWeek already does that).
  const gridStart = startOfStudyWeek(monthStartIso);
  const gridEndSeed = endOfStudyWeek(monthEndIso);
  // Ensure the grid has exactly 42 cells (6 weeks). If the last week-end is sooner, extend by a week.
  let gridEnd = gridEndSeed;
  const daysInGrid = Math.round(
    (parseIsoDate(gridEnd).getTime() - parseIsoDate(gridStart).getTime()) / 86_400_000,
  ) + 1;
  if (daysInGrid < 42) {
    gridEnd = addDays(gridEnd, 42 - daysInGrid);
  }

  const db = await getDb();
  const [dayRows, tasks] = await Promise.all([
    db
      .select()
      .from(studyPlanDays)
      .where(and(eq(studyPlanDays.planId, plan.id), gte(studyPlanDays.date, gridStart), lte(studyPlanDays.date, gridEnd)))
      .orderBy(asc(studyPlanDays.date)),
    selectResolvedTasks(and(eq(studyTasks.planId, plan.id), gte(studyTasks.scheduledFor, gridStart), lte(studyTasks.scheduledFor, gridEnd), ne(studyTasks.status, taskStatus.rescheduled))),
  ]);

  const tasksByDate = new Map<string, SupportedPlannerTask[]>();
  for (const task of tasks) {
    const dateKey = task.scheduledDate ?? gridStart;
    const bucket = tasksByDate.get(dateKey) ?? [];
    bucket.push(task);
    tasksByDate.set(dateKey, bucket);
  }

  const dayMap = new Map(dayRows.map((day) => [day.date, day]));
  const days: MonthPlanDay[] = [];
  for (let offset = 0; offset < 42; offset += 1) {
    const isoDate = addDays(gridStart, offset);
    const inMonth = isoDate >= monthStartIso && isoDate <= monthEndIso;
    const existing = dayMap.get(isoDate);
    days.push(
      existing
        ? {
            ...toSupportedDay(existing),
            dayOfWeek: existing.dayOfWeek,
            inMonth,
            tasks: tasksByDate.get(isoDate) ?? [],
          }
        : {
            id: `${plan.id}:${isoDate}`,
            date: isoDate,
            label: null,
            isRestDay: 0,
            dayOfWeek: toDayOfWeekValue(isoDate),
            inMonth,
            tasks: tasksByDate.get(isoDate) ?? [],
          },
    );
  }

  const inMonthDays = days.filter((d) => d.inMonth);
  const totalTasks = inMonthDays.reduce((sum, day) => sum + day.tasks.length, 0);
  const completedTasks = inMonthDays.reduce(
    (sum, day) => sum + day.tasks.filter((task) => task.status === taskStatus.completed).length,
    0,
  );

  return {
    plan: toPlanSnapshot(plan),
    year,
    month,
    rangeStart: gridStart,
    rangeEnd: gridEnd,
    days,
    totalTasks,
    completedTasks,
  };
}

export async function getPlannerSummary(): Promise<PlannerSummary> {
  const [plan, settings, todayPlan, upcomingTasks] = await Promise.all([
    getActivePlannerPlan(),
    getPlannerSettingsSnapshot(),
    getPlannerTodayPlan(),
    getPlannerUpcomingTasks(20),
  ]);

  if (!plan || !todayPlan) {
    return {
      plan: null,
      today: null,
      streak: { current: settings?.streakCurrent ?? 0, longest: settings?.streakLongest ?? 0 },
      overdueTasks: 0,
      upcomingTaskCount: 0,
      dailyGoalMinutes: settings?.dailyGoalMinutes ?? 0,
    };
  }

  const todayTotal = todayPlan.tasks.length;
  const todayCompleted = todayPlan.tasks.filter((task) => task.status === taskStatus.completed).length;

  return {
    plan: toPlanSnapshot(plan),
    today: {
      totalTasks: todayTotal,
      completedTasks: todayCompleted,
      progressPercent: todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0,
      estimatedMinutes: todayPlan.tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0),
    },
    streak: { current: settings?.streakCurrent ?? 0, longest: settings?.streakLongest ?? 0 },
    overdueTasks: todayPlan.overdueTasks.length,
    upcomingTaskCount: upcomingTasks.length,
    dailyGoalMinutes: settings?.dailyGoalMinutes ?? 0,
  };
}

export async function updatePlannerTask(taskId: string, values: Partial<typeof studyTasks.$inferInsert>) {
  const db = await getDb();
  const rows = await db
    .update(studyTasks)
    .set({
      ...values,
      resultJson:
        values.resultJson === undefined
          ? undefined
          : serializeJsonRecord(values.resultJson as Record<string, unknown> | null),
      updatedAt: Date.now(),
    })
    .where(eq(studyTasks.id, taskId))
    .returning();

  const task = rows[0];
  if (!task) return null;
  return {
    ...task,
    resultJson: parseJsonRecord(task.resultJson),
  };
}

export async function insertPlannerTaskEvent(input: {
  taskId: string;
  eventKind: (typeof taskEventKind)[keyof typeof taskEventKind];
  payload?: Record<string, unknown> | null;
}) {
  const db = await getDb();
  const rows = await db
    .insert(studyTaskEvents)
    .values({
      id: makeId("task_event"),
      taskId: input.taskId,
      eventKind: input.eventKind,
      payload: serializeJsonRecord(input.payload),
      occurredAt: Date.now(),
      createdAt: Date.now(),
    })
    .returning();

  return rows[0] ?? null;
}

export async function recalculatePlannerDay(dayId: string) {
  const db = await getDb();
  const dayRows = await db.select().from(studyPlanDays).where(eq(studyPlanDays.id, dayId)).limit(1);
  const day = dayRows[0];
  if (!day) return null;

  const aggregateRows = await db
    .select({
      totalTasks: count(studyTasks.id),
      completedTasks: sql<number>`COALESCE(SUM(CASE WHEN ${studyTasks.status} = 'completed' THEN 1 ELSE 0 END), 0)`,
      estimatedMinutes: sql<number>`COALESCE(SUM(${studyTasks.estimatedMinutes}), 0)`,
      actualMinutes: sql<number>`COALESCE(SUM(${studyTasks.actualMinutes}), 0)`,
    })
    .from(studyTasks)
    .where(and(eq(studyTasks.dayId, dayId), ne(studyTasks.status, taskStatus.rescheduled)));

  const totalTasks = Number(aggregateRows[0]?.totalTasks ?? 0);
  const completedTasks = Number(aggregateRows[0]?.completedTasks ?? 0);
  const estimatedMinutes = Number(aggregateRows[0]?.estimatedMinutes ?? 0);
  const actualMinutes = Number(aggregateRows[0]?.actualMinutes ?? 0);
  const nextStatus =
    day.isRestDay === 1 && totalTasks === 0
      ? planDayStatus.rest
      : totalTasks === 0
        ? planDayStatus.scheduled
        : completedTasks >= totalTasks
          ? planDayStatus.completed
          : completedTasks > 0
            ? planDayStatus.partial
            : planDayStatus.scheduled;

  const rows = await db
    .update(studyPlanDays)
    .set({
      totalTasks,
      completedTasks,
      estimatedMinutes,
      actualMinutes,
      targetMinutes: Math.max(day.targetMinutes, estimatedMinutes),
      assignedMinutes: estimatedMinutes,
      completedMinutes: actualMinutes,
      status: nextStatus,
      updatedAt: Date.now(),
    })
    .where(eq(studyPlanDays.id, dayId))
    .returning();

  return rows[0] ?? null;
}

export async function recalculatePlannerPlan(planId: string) {
  const db = await getDb();
  const aggregateRows = await db
    .select({
      totalTasks: count(studyTasks.id),
      completedTasks: sql<number>`COALESCE(SUM(CASE WHEN ${studyTasks.status} = 'completed' THEN 1 ELSE 0 END), 0)`,
    })
    .from(studyTasks)
    .where(and(eq(studyTasks.planId, planId), ne(studyTasks.status, taskStatus.rescheduled)));

  const totalTasks = Number(aggregateRows[0]?.totalTasks ?? 0);
  const completedTasks = Number(aggregateRows[0]?.completedTasks ?? 0);
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const rows = await db
    .update(studyPlans)
    .set({
      totalTasks,
      completedTasks,
      progressPercent,
      updatedAt: Date.now(),
    })
    .where(eq(studyPlans.id, planId))
    .returning();

  return rows[0] ?? null;
}
