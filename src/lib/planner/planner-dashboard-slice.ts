import { planStatus, taskStatus } from "@/db/schema";
import {
  getActivePlannerPlan,
  getPlannerSettingsSnapshot,
  getPlannerTodayPlan,
  getPlannerUpcomingTasks,
  getPlannerWeekPlan,
} from "@/lib/planner/runtime-queries";
import type { SupportedPlannerTask } from "@/lib/planner/runtime-types";

export type PlannerTaskLite = {
  id: string;
  title: string;
  taskType: string;
  status: string;
  estimatedMinutes: number;
  priority: number;
  scheduledFor: string | null;
};

export type PlannerActivePlanLite = {
  id: string;
  title: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  totalTasks: number;
  completedTasks: number;
  progressPercent: number;
};

export type PlannerUnavailableReason = "no_active_plan" | "planner_not_configured";

export type PlannerDashboardSlice = {
  available: boolean;
  reason?: PlannerUnavailableReason;
  examDate: string | null;
  daysToExam: number | null;
  totalTasks: number;
  completedTasks: number;
  todayTasks: number;
  completedToday: number;
  overdueTasks: number;
  studyStreak: number;
  dailyGoalMinutes: number;
  tasksToday: PlannerTaskLite[];
  tasksOverdue: PlannerTaskLite[];
  weekTasks: PlannerTaskLite[];
  upcomingTasks: Array<{ id: string; title: string; scheduledFor: string }>;
  activePlan: PlannerActivePlanLite | null;
};

const EMPTY: PlannerDashboardSlice = {
  available: false,
  reason: "no_active_plan",
  examDate: null,
  daysToExam: null,
  totalTasks: 0,
  completedTasks: 0,
  todayTasks: 0,
  completedToday: 0,
  overdueTasks: 0,
  studyStreak: 0,
  dailyGoalMinutes: 0,
  tasksToday: [],
  tasksOverdue: [],
  weekTasks: [],
  upcomingTasks: [],
  activePlan: null,
};

export function mapSupportedTaskToLite(task: SupportedPlannerTask): PlannerTaskLite {
  return {
    id: task.id,
    title: task.title,
    taskType: task.taskType,
    status: task.status,
    estimatedMinutes: task.estimatedMinutes ?? 0,
    priority: task.priority ?? 0,
    scheduledFor: task.scheduledDate,
  };
}

export async function getPlannerDashboardSlice(): Promise<PlannerDashboardSlice> {
  try {
    const activePlanRow = await getActivePlannerPlan();
    if (!activePlanRow) {
      return { ...EMPTY, available: false, reason: "no_active_plan" };
    }

    const settings = await getPlannerSettingsSnapshot();
    const [todayPlan, weekPlan, upcoming] = await Promise.all([
      getPlannerTodayPlan(),
      getPlannerWeekPlan(),
      getPlannerUpcomingTasks(20),
    ]);

    if (!todayPlan) {
      return { ...EMPTY, available: false, reason: "no_active_plan" };
    }

    const today = new Date().toISOString().slice(0, 10);
    let daysToExam: number | null = null;
    if (activePlanRow.examDate) {
      const examMs = new Date(activePlanRow.examDate).getTime();
      const nowMs = new Date(today).getTime();
      daysToExam = Math.max(0, Math.ceil((examMs - nowMs) / 86_400_000));
    }

    const tasksToday = todayPlan.tasks.map(mapSupportedTaskToLite);
    const tasksOverdue = todayPlan.overdueTasks.map(mapSupportedTaskToLite);
    const weekTasks =
      weekPlan?.days.flatMap((d) => d.tasks.map(mapSupportedTaskToLite)) ?? [];

    const completedToday = todayPlan.tasks.filter((t) => t.status === taskStatus.completed).length;

    const activePlan: PlannerActivePlanLite = {
      id: String(activePlanRow.id),
      title: activePlanRow.title ?? null,
      status: String(activePlanRow.status ?? planStatus.active),
      startDate: activePlanRow.startDate ?? null,
      endDate: activePlanRow.endDate ?? null,
      totalTasks: activePlanRow.totalTasks ?? 0,
      completedTasks: activePlanRow.completedTasks ?? 0,
      progressPercent:
        activePlanRow.totalTasks && activePlanRow.totalTasks > 0
          ? Math.round(((activePlanRow.completedTasks ?? 0) / activePlanRow.totalTasks) * 100)
          : 0,
    };

    return {
      available: true,
      examDate: activePlanRow.examDate ?? null,
      daysToExam,
      totalTasks: activePlan.totalTasks,
      completedTasks: activePlan.completedTasks,
      todayTasks: todayPlan.tasks.length,
      completedToday,
      overdueTasks: todayPlan.overdueTasks.length,
      studyStreak: settings?.streakCurrent ?? 0,
      dailyGoalMinutes: settings?.dailyGoalMinutes ?? 120,
      tasksToday,
      tasksOverdue,
      weekTasks,
      upcomingTasks: upcoming.map((t) => ({
        id: t.id,
        title: t.title,
        scheduledFor: t.scheduledDate ?? "",
      })),
      activePlan,
    };
  } catch (err) {
    console.error("[getPlannerDashboardSlice] failed:", err);
    return {
      ...EMPTY,
      available: false,
      reason: "planner_not_configured",
    };
  }
}
