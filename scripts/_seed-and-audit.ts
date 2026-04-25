#!/usr/bin/env tsx
// Single-process: seed → immediately audit. PGlite leaves postmaster.pid on
// abrupt Node exit so two separate script runs would quarantine the seeded
// dir. Keeping both in one process avoids that.
import * as nextEnv from "@next/env";

async function main() {
  nextEnv.loadEnvConfig(process.cwd());
  const { getDb } = await import("@/db/index");
  await getDb();
  const { runBatchImport } = await import("@/lib/import-light/batch-import");
  const { getCorrectAnswerDistribution } = await import("@/lib/qbank/audit");

  const summary = await runBatchImport("./data/test-batch");
  console.log("imported questions:", summary.counts.questions.inserted);

  const dist = await getCorrectAnswerDistribution();
  const ordered = Object.entries(dist.counts).sort(([a], [b]) => a.localeCompare(b));
  console.log();
  console.log("position  count    share");
  console.log("--------  -----    -----");
  for (const [letter, count] of ordered) {
    const share =
      dist.totalWithCorrect > 0
        ? ((count / dist.totalWithCorrect) * 100).toFixed(1) + "%"
        : "0%";
    console.log(`${letter.padEnd(8)}  ${String(count).padEnd(5)}    ${share}`);
  }
  console.log();
  console.log(`questions:              ${dist.totalQuestions}`);
  console.log(`with a correct option:  ${dist.totalWithCorrect}`);
  console.log(`most populated slot:    ${dist.maxKey ?? "-"} (${dist.maxShare}%)`);
  if (dist.maxShare > 35) {
    console.log(`\n[WARN] positional bias detected — ${dist.maxKey} is ${dist.maxShare}%.`);
  } else {
    console.log("\n[OK] no significant positional bias.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
