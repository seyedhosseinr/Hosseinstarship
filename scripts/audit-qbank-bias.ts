#!/usr/bin/env tsx
/**
 * Measures where the correct answer sits in the stored display order across
 * the entire active QBank corpus. Use this to distinguish TRUE generator
 * bias ("always B" because the upstream pipeline prefers B) from an APP-
 * LEVEL bug. A healthy corpus is roughly uniform (≈25% per slot for A–D).
 *
 * Run:
 *   DB_RUNTIME=pglite npx tsx scripts/audit-qbank-bias.ts
 *
 * For the Neon cloud runtime swap `pglite` for `neon`.
 */
import * as nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

async function main() {
  loadEnvConfig(process.cwd());

  const { getDbRuntime } = await import("@/db/index");
  const { getCorrectAnswerDistribution } = await import("@/lib/qbank/audit");

  console.log(`runtime: ${getDbRuntime()}\n`);
  const dist = await getCorrectAnswerDistribution();

  if (dist.totalQuestions === 0) {
    console.log("No active questions found.");
    process.exit(0);
  }

  const ordered = Object.entries(dist.counts).sort(([a], [b]) => a.localeCompare(b));
  const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - s.length));

  console.log("position  count    share");
  console.log("--------  -----    -----");
  for (const [letter, count] of ordered) {
    const share =
      dist.totalWithCorrect > 0
        ? ((count / dist.totalWithCorrect) * 100).toFixed(1) + "%"
        : "0%";
    console.log(`${pad(letter, 8)}  ${pad(String(count), 5)}    ${share}`);
  }

  console.log(`\nquestions:              ${dist.totalQuestions}`);
  console.log(`with a correct option:  ${dist.totalWithCorrect}`);
  console.log(`most populated slot:    ${dist.maxKey ?? "-"} (${dist.maxShare}%)`);

  if (dist.maxShare > 35) {
    console.log(
      `\n[WARN] positional bias detected — ${dist.maxKey} is ${dist.maxShare}% of ` +
        `answers (uniform would be ~25%). This is corpus/generator bias, not an app bug.`,
    );
  } else {
    console.log("\n[OK] no significant positional bias.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
