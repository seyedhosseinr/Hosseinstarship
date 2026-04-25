/**
 * GET /api/dashboard/debug
 * Returns raw planner data from the DB for debugging the daysToExam issue.
 * Only available in development.
 */
import { NextResponse } from "next/server";
import { getDb } from "@/db/index";
import { desc, eq, count, sql } from "drizzle-orm";
import { studyPlans, studyTasks, studyPlannerSettings, planStatus } from "@/db/schema";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  try {
    const db = await getDb();
    const today = new Date().toISOString().slice(0, 10);

    const [allPlans, activePlans, todayTasks, settings] = await Promise.all([
      db.select({ id: studyPlans.id, status: studyPlans.status, examDate: studyPlans.examDate, title: studyPlans.title }).from(studyPlans).limit(10),
      db.select({ id: studyPlans.id, status: studyPlans.status, examDate: studyPlans.examDate }).from(studyPlans).where(eq(studyPlans.status, planStatus.active)).limit(5),
      db.select({ count: count(studyTasks.id) }).from(studyTasks).where(eq(studyTasks.scheduledFor, today)).limit(1),
      db.select({ streakCurrent: studyPlannerSettings.streakCurrent, dailyGoalMinutes: studyPlannerSettings.dailyGoalMinutes }).from(studyPlannerSettings).limit(1),
    ]);

    const activePlan = activePlans[0];
    let daysToExam: number | null = null;
    if (activePlan?.examDate) {
      const examMs = new Date(activePlan.examDate).getTime();
      const nowMs = new Date(today).getTime();
      daysToExam = Math.max(0, Math.ceil((examMs - nowMs) / 86_400_000));
    }

    return NextResponse.json({
      today,
      allPlans,
      activePlan: activePlan ?? null,
      daysToExam,
      todayTaskCount: todayTasks[0]?.count ?? 0,
      settings: settings[0] ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
