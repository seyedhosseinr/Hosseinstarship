import { eq } from "drizzle-orm";

import { getDb } from "@/db/index";
import {
  planDayStatus,
  planStatus,
  studyPlanDays,
  studyPlans,
  studyTasks,
  taskSourceType,
  taskStatus,
  taskType,
} from "@/db/schema";
import {
  completePlannerTask,
  getSupportedPlannerSummary,
  getSupportedTodayPlan,
  getSupportedWeekPlan,
  movePlannerTaskToToday,
  reschedulePlannerTask,
  skipPlannerTask,
  snoozePlannerTask,
  startPlannerTask,
} from "@/lib/services/planner-runtime-service";

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayOfWeekValue(date: Date) {
  const values = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ] as const;
  return values[date.getDay()];
}

async function main() {
  const db = await getDb();
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 3);

  const todayIso = isoDate(today);
  const tomorrowIso = isoDate(tomorrow);
  const nextWeekIso = isoDate(nextWeek);

  const planId = makeId("plan");
  const todayDayId = makeId("day");
  const tomorrowDayId = makeId("day");
  const nextWeekDayId = makeId("day");

  await db.insert(studyPlans).values({
    id: planId,
    title: "Planner smoke plan",
    status: planStatus.active,
    startDate: todayIso,
    endDate: nextWeekIso,
    progressPercent: 0,
    totalTasks: 0,
    completedTasks: 0,
    dailyTimeBudgetMin: 90,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  await db.insert(studyPlanDays).values([
    {
      id: todayDayId,
      planId,
      date: todayIso,
      dayOfWeek: dayOfWeekValue(today),
      label: "Today",
      isRestDay: 0,
      totalTasks: 0,
      completedTasks: 0,
      estimatedMinutes: 0,
      actualMinutes: 0,
      targetMinutes: 90,
      assignedMinutes: 0,
      completedMinutes: 0,
      loadScore: 0,
      status: planDayStatus.scheduled,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: tomorrowDayId,
      planId,
      date: tomorrowIso,
      dayOfWeek: dayOfWeekValue(tomorrow),
      label: "Tomorrow",
      isRestDay: 0,
      totalTasks: 0,
      completedTasks: 0,
      estimatedMinutes: 0,
      actualMinutes: 0,
      targetMinutes: 90,
      assignedMinutes: 0,
      completedMinutes: 0,
      loadScore: 0,
      status: planDayStatus.scheduled,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: nextWeekDayId,
      planId,
      date: nextWeekIso,
      dayOfWeek: dayOfWeekValue(nextWeek),
      label: "Later",
      isRestDay: 0,
      totalTasks: 0,
      completedTasks: 0,
      estimatedMinutes: 0,
      actualMinutes: 0,
      targetMinutes: 90,
      assignedMinutes: 0,
      completedMinutes: 0,
      loadScore: 0,
      status: planDayStatus.scheduled,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ]);

  const taskIds = {
    startThenComplete: makeId("task"),
    skip: makeId("task"),
    reschedule: makeId("task"),
    moveToToday: makeId("task"),
    snooze: makeId("task"),
  };

  await db.insert(studyTasks).values([
    {
      id: taskIds.startThenComplete,
      planId,
      dayId: todayDayId,
      taskType: taskType.customTask,
      status: taskStatus.pending,
      title: "Finish supported task",
      estimatedMinutes: 20,
      actualMinutes: 0,
      progressPercent: 0,
      completedCount: 0,
      priority: 1,
      sourceType: taskSourceType.manual,
      difficultyWeight: 1,
      scheduledFor: todayIso,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: taskIds.skip,
      planId,
      dayId: todayDayId,
      taskType: taskType.notebookReview,
      status: taskStatus.pending,
      title: "Skip note review",
      estimatedMinutes: 15,
      actualMinutes: 0,
      progressPercent: 0,
      completedCount: 0,
      priority: 0,
      sourceType: taskSourceType.manual,
      difficultyWeight: 1,
      scheduledFor: todayIso,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: taskIds.reschedule,
      planId,
      dayId: todayDayId,
      taskType: taskType.customTask,
      status: taskStatus.pending,
      title: "Reschedule task",
      estimatedMinutes: 10,
      actualMinutes: 0,
      progressPercent: 0,
      completedCount: 0,
      priority: 0,
      sourceType: taskSourceType.manual,
      difficultyWeight: 1,
      scheduledFor: todayIso,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: taskIds.moveToToday,
      planId,
      dayId: tomorrowDayId,
      taskType: taskType.flashcardReview,
      status: taskStatus.pending,
      title: "Move flashcard review to today",
      estimatedMinutes: 25,
      actualMinutes: 0,
      progressPercent: 0,
      completedCount: 0,
      priority: 1,
      sourceType: taskSourceType.manual,
      difficultyWeight: 1,
      scheduledFor: tomorrowIso,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: taskIds.snooze,
      planId,
      dayId: todayDayId,
      taskType: taskType.customTask,
      status: taskStatus.pending,
      title: "Snooze task",
      estimatedMinutes: 30,
      actualMinutes: 0,
      progressPercent: 0,
      completedCount: 0,
      priority: 0,
      sourceType: taskSourceType.manual,
      difficultyWeight: 1,
      scheduledFor: todayIso,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ]);

  const todayBefore = await getSupportedTodayPlan();
  const weekBefore = await getSupportedWeekPlan(todayIso);
  const summaryBefore = await getSupportedPlannerSummary();

  if (!todayBefore || todayBefore.tasks.length < 4) {
    throw new Error("Today plan did not load seeded tasks.");
  }
  if (!weekBefore || weekBefore.days.length === 0) {
    throw new Error("Week plan did not load seeded days.");
  }
  if (!summaryBefore || summaryBefore.plan?.id !== planId) {
    throw new Error("Planner summary did not resolve the active plan.");
  }

  await startPlannerTask(taskIds.startThenComplete);
  await completePlannerTask(taskIds.startThenComplete, 18, { smoke: true });
  await skipPlannerTask(taskIds.skip);
  await reschedulePlannerTask(taskIds.reschedule, nextWeekIso);
  await movePlannerTaskToToday(taskIds.moveToToday);
  await snoozePlannerTask(taskIds.snooze, 1);

  const updatedTasks = await db
    .select({
      id: studyTasks.id,
      status: studyTasks.status,
      scheduledFor: studyTasks.scheduledFor,
      dayId: studyTasks.dayId,
      progressPercent: studyTasks.progressPercent,
    })
    .from(studyTasks)
    .where(eq(studyTasks.planId, planId));

  const byId = Object.fromEntries(updatedTasks.map((task) => [task.id, task]));

  if (byId[taskIds.startThenComplete]?.status !== taskStatus.completed) {
    throw new Error("Complete task mutation failed.");
  }
  if (byId[taskIds.startThenComplete]?.progressPercent !== 100) {
    throw new Error("Completed task progress was not updated.");
  }
  if (byId[taskIds.skip]?.status !== taskStatus.skipped) {
    throw new Error("Skip task mutation failed.");
  }
  if (byId[taskIds.reschedule]?.scheduledFor !== nextWeekIso) {
    throw new Error("Reschedule task mutation failed.");
  }
  if (byId[taskIds.moveToToday]?.scheduledFor !== todayIso) {
    throw new Error("Move-to-today mutation failed.");
  }
  if (byId[taskIds.snooze]?.scheduledFor !== tomorrowIso) {
    throw new Error("Snooze task mutation failed.");
  }

  const todayAfter = await getSupportedTodayPlan();
  const weekAfter = await getSupportedWeekPlan(todayIso);

  if (!todayAfter || !weekAfter) {
    throw new Error("Planner views failed after mutations.");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        todayTaskCount: todayAfter.tasks.length,
        weekDayCount: weekAfter.days.length,
        statuses: {
          completed: byId[taskIds.startThenComplete]?.status,
          skipped: byId[taskIds.skip]?.status,
        },
      },
      null,
      2,
    ),
  );

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
