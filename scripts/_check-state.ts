import { getActivePlan, countTasksByStatus, listOverdueTasks, getTodayPlan } from '../src/lib/db/queries/planner';

const plan = getActivePlan();
if (!plan) { console.log('No plan'); process.exit(0); }

const counts = countTasksByStatus(plan.id);
console.log('Final counts:', JSON.stringify(counts));
console.log('Overdue:', listOverdueTasks(plan.id).length);

const today = getTodayPlan();
if (today) {
  console.log('Today tasks:', today.tasks.length);
  console.log('Overdue tasks:', today.overdueTasks.length);
  for (const t of today.tasks) {
    console.log('  -', t.taskType, ':', t.title);
  }
}
