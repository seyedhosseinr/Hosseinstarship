import { NextResponse } from "next/server";
import { mapSupportedTaskToLite } from "@/lib/planner/planner-dashboard-slice";
import { getActivePlannerPlan, getPlannerWeekPlan } from "@/lib/planner/runtime-queries";

export async function GET(request: Request) {
  try {
    const active = await getActivePlannerPlan();
    if (!active) {
      return NextResponse.json({
        available: false,
        reason: "no_active_plan",
        plan: null,
        weekStart: null,
        weekEnd: null,
        days: [],
        totalTasks: 0,
        completedTasks: 0,
        overdueTasks: [],
        week: [],
        today: [],
        overdue: [],
      });
    }

    const url = new URL(request.url);
    const ref = url.searchParams.get("date");
    const refDate = ref && /^\d{4}-\d{2}-\d{2}$/.test(ref) ? new Date(`${ref}T00:00:00`) : undefined;

    const week = await getPlannerWeekPlan(refDate);
    if (!week) {
      return NextResponse.json({
        available: false,
        reason: "no_active_plan",
        plan: null,
        weekStart: null,
        weekEnd: null,
        days: [],
        totalTasks: 0,
        completedTasks: 0,
        overdueTasks: [],
        week: [],
        today: [],
        overdue: [],
      });
    }

    const weekFlat = week.days.flatMap((d) => d.tasks.map(mapSupportedTaskToLite));
    const overdue = week.overdueTasks.map(mapSupportedTaskToLite);

    return NextResponse.json({
      available: true,
      plan: week.plan,
      weekStart: week.weekStart,
      weekEnd: week.weekEnd,
      days: week.days,
      totalTasks: week.totalTasks,
      completedTasks: week.completedTasks,
      overdueTasks: overdue,
      week: weekFlat,
      today: [],
      overdue,
    });
  } catch (err) {
    console.error("[GET /api/planner/week]", err);
    return NextResponse.json(
      {
        available: false,
        reason: "planner_not_configured",
        plan: null,
        weekStart: null,
        weekEnd: null,
        days: [],
        totalTasks: 0,
        completedTasks: 0,
        overdueTasks: [],
        week: [],
        today: [],
        overdue: [],
      },
      { status: 500 },
    );
  }
}
