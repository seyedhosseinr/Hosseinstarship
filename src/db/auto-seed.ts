/**
 * auto-seed.ts
 *
 * Creates a minimal active study plan (exam date only, no tasks) the first time
 * PGlite boots on a fresh DB. This ensures the dashboard's "days to exam" counter
 * always shows something meaningful without requiring a manual seed run.
 *
 * Safe: runs only when `study_plans` table is completely empty.
 * Idempotent: skips if any plan already exists.
 */

import { count } from "drizzle-orm";
import { studyPlans, planStatus, targetMode } from "./schema";
import type { AppDrizzleInstance } from "./index";

const PLAN_ID = "abu-2026-v1";
const EXAM_DATE = "2026-08-27";
const PLAN_START = "2025-04-18";

export async function autoSeedIfEmpty(db: AppDrizzleInstance): Promise<void> {
  try {
    const [row] = await db.select({ value: count(studyPlans.id) }).from(studyPlans).limit(1);
    if ((row?.value ?? 0) > 0) return; // already seeded

    await db.insert(studyPlans).values({
      id: PLAN_ID,
      title: "ABU Board Prep — Campbell-Walsh 2026",
      description: "برنامه فشرده ۱۳ هفته‌ای برای امتحان بورد اورولوژی آمریکا",
      status: planStatus.active,
      startDate: PLAN_START,
      examDate: EXAM_DATE,
      totalTasks: 0,
      completedTasks: 0,
      progressPercent: 0,
      repeatPattern: "daily_7x",
      targetMode: targetMode.examPrep,
      dailyTimeBudgetMin: 420,
    });

    console.info("[auto-seed] Created minimal plan with examDate:", EXAM_DATE);
  } catch (err) {
    // Non-fatal — dashboard can run without exam date
    console.warn("[auto-seed] Could not auto-seed plan:", err);
  }
}
