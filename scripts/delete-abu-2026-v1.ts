#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * One-off: delete abu-2026-v1 from the active database, leaving abu-2026-v2 intact.
 *
 * - Loads the project Drizzle client via getDb() (honors DB_RUNTIME / DATABASE_URL).
 * - Refuses to run unless abu-2026-v2 exists (sanity gate).
 * - Wraps the delete in a transaction; relies on FK CASCADE to remove study_plan_days,
 *   study_tasks, and study_task_links rows.
 * - Asserts v1 is absent and v2 is present after commit.
 *
 * Run:
 *   $env:DATABASE_URL = "<prod>"
 *   $env:DB_RUNTIME   = "postgres"
 *   npx tsx scripts/delete-abu-2026-v1.ts
 *
 * Intentionally not part of the codebase — file is removed in the next commit.
 */

import * as nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());

process.env.PG_CONNECTION_TIMEOUT_MS ??= "60000";
process.env.PG_IDLE_TIMEOUT_MS ??= "30000";
process.env.PG_POOL_MAX ??= "2";

import { eq, sql } from "drizzle-orm";

import { getDb } from "@/db/index";
import { studyPlans, studyPlanDays, studyTasks, studyTaskLinks } from "@/db/schema";

const V1 = "abu-2026-v1";
const V2 = "abu-2026-v2";

async function main(): Promise<void> {
  const db = await getDb();
  await db.execute(sql`select 1`);

  const countsFor = async (planId: string) => {
    const [days] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(studyPlanDays)
      .where(eq(studyPlanDays.planId, planId));
    const [tasks] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(studyTasks)
      .where(eq(studyTasks.planId, planId));
    const [links] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(studyTaskLinks)
      .innerJoin(studyTasks, eq(studyTaskLinks.taskId, studyTasks.id))
      .where(eq(studyTasks.planId, planId));
    return {
      days: days?.c ?? 0,
      tasks: tasks?.c ?? 0,
      links: links?.c ?? 0,
    };
  };

  const planRow = (id: string) =>
    db.select({ id: studyPlans.id, title: studyPlans.title }).from(studyPlans).where(eq(studyPlans.id, id));

  const v2Before = await planRow(V2);
  if (v2Before.length === 0) {
    throw new Error(`Refusing to delete ${V1}: ${V2} does not exist (sanity gate).`);
  }
  const v1Before = await planRow(V1);
  const v1CountsBefore = await countsFor(V1);
  const v2CountsBefore = await countsFor(V2);

  console.log("=== BEFORE ===");
  console.log(JSON.stringify({
    v1Present: v1Before.length > 0,
    v2Present: v2Before.length > 0,
    v1Counts: v1CountsBefore,
    v2Counts: v2CountsBefore,
  }, null, 2));

  if (v1Before.length === 0) {
    console.log(`\n${V1} not present — nothing to delete. Exiting cleanly.`);
    return;
  }

  await db.transaction(async (tx) => {
    const result = await tx.delete(studyPlans).where(eq(studyPlans.id, V1));
    console.log(`\n→ DELETE FROM study_plans WHERE id='${V1}' executed`);
    if ("rowCount" in result && typeof result.rowCount === "number") {
      console.log(`  rowCount: ${result.rowCount}`);
    }
  });

  const v1After = await planRow(V1);
  const v2After = await planRow(V2);
  const v1CountsAfter = await countsFor(V1);
  const v2CountsAfter = await countsFor(V2);

  console.log("\n=== AFTER ===");
  console.log(JSON.stringify({
    v1Present: v1After.length > 0,
    v2Present: v2After.length > 0,
    v1Counts: v1CountsAfter,
    v2Counts: v2CountsAfter,
  }, null, 2));

  if (v1After.length !== 0) {
    throw new Error(`Post-delete assertion failed: ${V1} still present.`);
  }
  if (v2After.length === 0) {
    throw new Error(`Post-delete assertion failed: ${V2} disappeared (BUG — should have been untouched).`);
  }
  if (v1CountsAfter.days !== 0 || v1CountsAfter.tasks !== 0 || v1CountsAfter.links !== 0) {
    throw new Error(`Post-delete assertion failed: ${V1} cascade left orphaned rows: ${JSON.stringify(v1CountsAfter)}`);
  }
  if (
    v2CountsAfter.days !== v2CountsBefore.days ||
    v2CountsAfter.tasks !== v2CountsBefore.tasks ||
    v2CountsAfter.links !== v2CountsBefore.links
  ) {
    throw new Error(`Post-delete assertion failed: ${V2} counts changed during delete: ${JSON.stringify(v2CountsAfter)}`);
  }

  const allPlans = await db.select({ id: studyPlans.id, title: studyPlans.title }).from(studyPlans);
  console.log("\n=== plans remaining ===");
  console.log(JSON.stringify(allPlans, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("delete-abu-2026-v1 failed:", err);
    process.exit(1);
  });
