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
        overdueTasks: [],
        overdue: [],
        today: [],
        week: [],
      });
    }

    const today = await getPlannerTodayPlan();
    if (!today) {
      return NextResponse.json({
        available: false,
        reason: "no_active_plan",
        overdueTasks: [],
        overdue: [],
        today: [],
        week: [],
      });
    }

    const overdue = today.overdueTasks.map(mapSupportedTaskToLite);

    return NextResponse.json({
      available: true,
      plan: today.plan,
      overdueTasks: overdue,
      overdue,
      today: [],
      week: [],
    });
  } catch (err) {
    console.error("[GET /api/planner/overdue]", err);
    return NextResponse.json(
      {
        available: false,
        reason: "planner_not_configured",
        overdueTasks: [],
        overdue: [],
        today: [],
        week: [],
      },
      { status: 500 },
    );
  }
}
