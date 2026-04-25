#!/usr/bin/env npx tsx
/**
 * scripts/inspect-planner-state.ts
 *
 * Quick sanity-check after backfill. Shows everything needed to verify
 * the planner is healthy and KPI cards will have real data.
 *
 * Usage:
 *   npx tsx .\scripts\inspect-planner-state.ts
 */

import { resolve } from "path";
import Database from "better-sqlite3";
import { existsSync } from "fs";

const DB_PATH = resolve(__dirname, "..", "local.db");

function bar(pct: number, width = 30): string {
  const filled = Math.round((pct / 100) * width);
  return "[" + "█".repeat(filled) + "░".repeat(width - filled) + `] ${pct}%`;
}

function fmt(n: number): string {
  return String(n).padStart(5);
}

async function main() {
  if (!existsSync(DB_PATH)) {
    console.error("❌  DB not found:", DB_PATH);
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readonly: true });
  console.log(`\n📍  DB: ${DB_PATH}\n`);

  // ── All plans ─────────────────────────────────────────────────────────────
  console.log("═".repeat(70));
  console.log("  PLANS");
  console.log("═".repeat(70));
  const plans = db.prepare(`
    SELECT id, title, status, start_date, end_date,
           total_tasks, completed_tasks, progress_percent
    FROM   study_plans
    ORDER  BY created_at DESC
  `).all() as any[];

  if (plans.length === 0) {
    console.log("  No plans found.");
  }
  for (const p of plans) {
    const marker = p.status === "active" ? " ◀ ACTIVE" : "";
    console.log(`\n  ${p.title}${marker}`);
    console.log(`  ID: ${p.id}`);
    console.log(`  ${p.start_date} → ${p.end_date ?? "open"}  |  status: ${p.status}`);
    console.log(`  Tasks: ${p.completed_tasks}/${p.total_tasks}  ${bar(p.progress_percent)}`);
  }

  const active = plans.find(p => p.status === "active");
  if (!active) {
    console.log("\n⚠️   No active plan — nothing more to show.\n");
    db.close();
    return;
  }

  const planId = active.id;

  // ── Counts ────────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(70));
  console.log("  COUNTS");
  console.log("═".repeat(70));

  const counts = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM study_plan_days WHERE plan_id = ?) AS day_count,
      (SELECT COUNT(*) FROM study_tasks      WHERE plan_id = ?) AS task_count,
      (SELECT COUNT(*) FROM study_tasks      WHERE plan_id = ? AND status = 'completed') AS completed,
      (SELECT COUNT(*) FROM study_tasks      WHERE plan_id = ? AND status = 'overdue')   AS overdue,
      (SELECT COUNT(*) FROM study_tasks      WHERE plan_id = ? AND status = 'pending')   AS pending
  `).get(planId, planId, planId, planId, planId) as any;

  console.log(`\n  Day rows   : ${fmt(counts.day_count)}`);
  console.log(`  Task rows  : ${fmt(counts.task_count)}`);
  console.log(`  Pending    : ${fmt(counts.pending)}`);
  console.log(`  Completed  : ${fmt(counts.completed)}`);
  console.log(`  Overdue    : ${fmt(counts.overdue)}`);

  if (counts.task_count === 0) {
    console.log("\n  ⚠️   taskCount is 0 — backfill hasn't run yet.");
    console.log("      Run: npx tsx .\\scripts\\backfill-board-plan-tasks.ts\n");
    db.close();
    return;
  }

  // ── Task type distribution ────────────────────────────────────────────────
  console.log("\n" + "═".repeat(70));
  console.log("  TASK TYPE DISTRIBUTION");
  console.log("═".repeat(70));
  const typeDist = db.prepare(`
    SELECT task_type, COUNT(*) AS cnt
    FROM   study_tasks
    WHERE  plan_id = ?
    GROUP  BY task_type
    ORDER  BY cnt DESC
  `).all(planId) as any[];

  for (const row of typeDist) {
    console.log(`  ${row.task_type.padEnd(20)} : ${fmt(row.cnt)}`);
  }

  // ── Settings / KPI Defaults ───────────────────────────────────────────────
  console.log("\n" + "═".repeat(70));
  console.log("  SETTINGS (KPI Defaults)");
  console.log("═".repeat(70));
  const settings = db.prepare(`SELECT * FROM study_planner_settings LIMIT 1`).get() as any;

  if (!settings) {
    console.log("  ⚠️   No settings row — run backfill to initialise defaults.");
  } else {
    console.log(`  Daily goal      : ${settings.daily_goal_minutes ?? "—"} min`);
    console.log(`  Start time      : ${settings.preferred_start_time ?? "—"}`);
    console.log(`  Default task    : ${settings.default_task_duration_minutes ?? "—"} min`);
    console.log(`  Streak current  : ${settings.streak_current ?? 0}`);
    console.log(`  Last study date : ${settings.last_study_date ?? "—"}`);
  }

  // ── Today's plan ─────────────────────────────────────────────────────────
  const today = (function localDate() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  })();

  console.log("\n" + "═".repeat(70));
  console.log(`  TODAY (${today})`);
  console.log("═".repeat(70));

  const todayDay = db.prepare(`
    SELECT * FROM study_plan_days WHERE plan_id = ? AND date = ?
  `).get(planId, today) as any;

  if (!todayDay) {
    console.log("  No day row for today (might be outside plan range or a rest day).");
  } else {
    console.log(`  Day ID          : ${todayDay.id}`);
    console.log(`  is_rest_day     : ${todayDay.is_rest_day}`);
    console.log(`  total_tasks     : ${todayDay.total_tasks}`);
    console.log(`  completed_tasks : ${todayDay.completed_tasks}`);
    console.log(`  estimated_mins  : ${todayDay.estimated_minutes}`);

    const todayTasks = db.prepare(`
      SELECT task_type, title, estimated_minutes, priority, status
      FROM   study_tasks
      WHERE  day_id = ?
      ORDER  BY sort_order
    `).all(todayDay.id) as any[];

    console.log(`\n  Today's tasks (${todayTasks.length}):`);
    for (const t of todayTasks) {
      const pLabel = t.priority === 2 ? "🔴" : t.priority === 1 ? "🟡" : "⚪";
      console.log(`    ${pLabel} [${t.task_type.padEnd(18)}] ${t.estimated_minutes?.toString().padStart(3) ?? " ? "}m  ${t.title}`);
    }
  }

  // ── KPI Summary ───────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(70));
  console.log("  PLANNER KPI PREVIEW");
  console.log("═".repeat(70));

  const dailyGoal   = settings?.daily_goal_minutes ?? 420;
  const todayTotal  = todayDay?.total_tasks ?? 0;
  const todayDone   = todayDay?.completed_tasks ?? 0;
  const todayPct    = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;
  const todayEstMin = todayDay?.estimated_minutes ?? 0;

  console.log(`\n  Daily Goals     : ${dailyGoal} min`);
  console.log(`  پیشرفت امروز   : ${bar(todayPct, 20)}`);
  console.log(`  تسک امروز      : ${todayDone}/${todayTotal}`);
  console.log(`  پیشرفت کل      : ${bar(active.progress_percent, 20)}`);
  console.log(`  تسک عقب‌مانده  : ${counts.overdue}`);
  console.log(`  ساعت مطالعه    : est ${(todayEstMin/60).toFixed(1)} h / goal ${(dailyGoal/60).toFixed(0)} h`);

  // ── First 20 tasks ────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(70));
  console.log("  FIRST 20 TASKS");
  console.log("═".repeat(70));
  const firstTasks = db.prepare(`
    SELECT t.id, t.task_type, t.title, t.estimated_minutes, t.priority, t.status, d.date
    FROM   study_tasks t
    JOIN   study_plan_days d ON t.day_id = d.id
    WHERE  t.plan_id = ?
    ORDER  BY d.date, t.sort_order
    LIMIT  20
  `).all(planId) as any[];

  for (const t of firstTasks) {
    const pLabel = t.priority === 2 ? "🔴" : t.priority === 1 ? "🟡" : "⚪";
    console.log(`  ${t.date}  ${pLabel} ${t.task_type.padEnd(18)} ${(t.estimated_minutes??0).toString().padStart(3)}m  ${t.title.slice(0,50)}`);
  }

  // ── First 10 days with task counts ────────────────────────────────────────
  console.log("\n" + "═".repeat(70));
  console.log("  FIRST 10 POPULATED DAYS");
  console.log("═".repeat(70));
  const first10Days = db.prepare(`
    SELECT d.date, d.day_of_week, d.is_rest_day,
           d.total_tasks, d.completed_tasks, d.estimated_minutes
    FROM   study_plan_days d
    WHERE  d.plan_id = ? AND d.total_tasks > 0
    ORDER  BY d.date
    LIMIT  10
  `).all(planId) as any[];

  for (const d of first10Days) {
    console.log(`  ${d.date}  ${d.day_of_week.padEnd(10)}  tasks: ${d.total_tasks}  est: ${d.estimated_minutes}m`);
  }

  console.log("\n" + "═".repeat(70) + "\n");
  db.close();
}

main().catch(err => {
  console.error("❌", (err as Error)?.message ?? err);
  process.exit(1);
});