#!/usr/bin/env npx tsx
/**
 * _skip-past-tasks.ts
 *
 * Marks all overdue tasks (on days before today) as "skipped"
 * so the planner backlog becomes zero.
 * Also recalculates day/plan progress after changes.
 */

import {
  getActivePlan,
  listOverdueTasks,
  listDaysByPlan,
  recalcDayProgress,
  recalcPlanProgress,
  countTasksByStatus,
} from "../src/lib/db/queries/planner";
import { db } from "../src/db/index";
import { studyTasks, studyPlanDays } from "../src/db/schema";
import { eq, and, lt, inArray } from "drizzle-orm";

function main() {
  const plan = getActivePlan();
  if (!plan) {
    console.log("No active plan found.");
    return;
  }

  console.log(`\nPlan: "${plan.title}"`);

  const today = new Date().toISOString().slice(0, 10);
  console.log(`Today: ${today}\n`);

  // Find all overdue tasks
  const overdue = listOverdueTasks(plan.id);
  console.log(`Overdue tasks: ${overdue.length}`);

  if (overdue.length === 0) {
    console.log("Nothing to skip — backlog already zero!");
    return;
  }

  // Also find pending/in_progress tasks on past days that might not be marked overdue yet
  const pastDays = db
    .select({ id: studyPlanDays.id, date: studyPlanDays.date })
    .from(studyPlanDays)
    .where(
      and(
        eq(studyPlanDays.planId, plan.id),
        lt(studyPlanDays.date, today),
      ),
    )
    .all();

  console.log(`Past days: ${pastDays.length}`);

  // Show which dates have overdue tasks
  const dayIdSet = new Set(pastDays.map((d) => d.id));
  for (const d of pastDays) {
    const count = overdue.filter((t) => t.dayId === d.id).length;
    if (count > 0) {
      console.log(`  ${d.date}: ${count} overdue`);
    }
  }

  // Mark all overdue tasks as skipped
  const overdueIds = overdue.map((t) => t.id);
  const now = Date.now();

  db.update(studyTasks)
    .set({ status: "skipped", updatedAt: now })
    .where(inArray(studyTasks.id, overdueIds))
    .run();

  console.log(`\n✅ Marked ${overdueIds.length} overdue tasks as "skipped"`);

  // Also mark any remaining pending/in_progress on past days
  if (pastDays.length > 0) {
    const pastDayIds = pastDays.map((d) => d.id);
    const result = db
      .update(studyTasks)
      .set({ status: "skipped", updatedAt: now })
      .where(
        and(
          eq(studyTasks.planId, plan.id),
          inArray(studyTasks.dayId, pastDayIds),
          inArray(studyTasks.status, ["pending", "in_progress"]),
        ),
      )
      .run();

    console.log(`✅ Also skipped remaining pending tasks on past days`);
  }

  // Recalc
  console.log("\nRecalculating progress...");
  const allDays = listDaysByPlan(plan.id);
  for (const d of allDays) {
    recalcDayProgress(d.id);
  }
  recalcPlanProgress(plan.id);

  // Verify
  const finalCounts = countTasksByStatus(plan.id);
  console.log("\nFinal task counts:", JSON.stringify(finalCounts, null, 2));
  console.log("\n✅ Done — backlog should now be zero.");
}

main();
