import { NextResponse } from "next/server";
import { mapSupportedTaskToLite } from "@/lib/planner/planner-dashboard-slice";
import { getActivePlannerPlan, getPlannerTodayPlan } from "@/lib/planner/runtime-queries";

export async function GET() {
  try {
    const active = await getActivePlannerPlan();
    if (!active) {
      return NextResponse.json({
        available: false,
        reason: "no_active_plan",
        plan: null,
        day: null,
        tasks: [],
        overdueTasks: [],
        today: [],
        overdue: [],
        week: [],
      });
    }

    const today = await getPlannerTodayPlan();
    if (!today) {
      return NextResponse.json({
        available: false,
        reason: "no_active_plan",
        plan: null,
        day: null,
        tasks: [],
        overdueTasks: [],
        today: [],
        overdue: [],
        week: [],
      });
    }

    const tasks = today.tasks.map(mapSupportedTaskToLite);
    const overdue = today.overdueTasks.map(mapSupportedTaskToLite);

    return NextResponse.json({
      available: true,
      plan: today.plan,
      day: today.day,
      tasks,
      overdueTasks: overdue,
      today: tasks,
      overdue,
    });
  } catch (err) {
    console.error("[GET /api/planner/today]", err);
    return NextResponse.json(
      {
        available: false,
        reason: "planner_not_configured",
        plan: null,
        day: null,
        tasks: [],
        overdueTasks: [],
        today: [],
        overdue: [],
        week: [],
      },
      { status: 500 },
    );
  }
}
