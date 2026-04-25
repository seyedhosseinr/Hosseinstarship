#!/usr/bin/env tsx
// scripts/import-batch.ts
// ──────────────────────────────────────────────────────
// CLI wrapper for the Drizzle batch importer.
//
// Usage:
//   npx tsx --tsconfig tsconfig.json scripts/import-batch.ts ./data/campbell-ch132-batch-04
//   npx tsx --tsconfig tsconfig.json scripts/import-batch.ts ./data/campbell-ch132-batch-04 --dry-run
//
// The batch directory is expected to contain any combination of:
//   manifest.json, qc_report.json, chunks.json, questions.json, flashcards.json
// ──────────────────────────────────────────────────────

import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { importBatchFromDirectory } from "@/lib/importers/import-to-db";

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

function printUsage(): void {
  console.log(`
╔═══════════════════════════════════════════════════╗
║        Batch Import → Drizzle / SQLite            ║
╚═══════════════════════════════════════════════════╝

Usage:
  npx tsx --tsconfig tsconfig.json scripts/import-batch.ts <batchDir> [--dry-run]

Arguments:
  batchDir      Path to a batch directory containing JSON artifacts
  --dry-run     Preview what would be imported without writing to the database

Examples:
  npx tsx --tsconfig tsconfig.json scripts/import-batch.ts ./data/campbell-ch132-batch-04
  npx tsx --tsconfig tsconfig.json scripts/import-batch.ts ./data/campbell-ch132-batch-04 --dry-run
`);
}

function exit(message: string, code = 1): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(code);
}

/* -------------------------------------------------------------------------- */
/*                                    MAIN                                    */
/* -------------------------------------------------------------------------- */

async function main() {
  const args = process.argv.slice(2);

  // Strip flags from positional args
  const positional = args.filter((a) => !a.startsWith("--"));
  const flags = new Set(args.filter((a) => a.startsWith("--")));

  if (flags.has("--help") || flags.has("-h") || positional.length === 0) {
    printUsage();
    process.exit(0);
  }

  const batchDir = resolve(positional[0]);
  const dryRun = flags.has("--dry-run");

  // ── Validate directory ──
  if (!existsSync(batchDir)) {
    exit(`Directory not found: ${batchDir}`);
  }

  // ── Run ──
  const label = dryRun ? "DRY-RUN" : "IMPORT";
  console.log(`\n⏳ [${label}] Importing from: ${batchDir}\n`);

  const t0 = performance.now();
  const summary = await importBatchFromDirectory(batchDir, dryRun);
  const elapsed = ((performance.now() - t0) / 1000).toFixed(2);

  // ── Report ──
  console.log(`\n${"─".repeat(52)}`);
  console.log(`  Import ${dryRun ? "(dry-run) " : ""}completed in ${elapsed}s`);
  console.log(`${"─".repeat(52)}`);
  console.log(`  Import ID:           ${summary.importId}`);
  console.log(`  Chunks inserted:     ${summary.chunksInserted}`);
  console.log(`  Chunks updated:      ${summary.chunksUpdated}`);
  console.log(`  Questions inserted:  ${summary.questionsInserted}`);
  console.log(`  Questions updated:   ${summary.questionsUpdated}`);
  console.log(`  Options inserted:    ${summary.optionsInserted}`);
  console.log(`  Options updated:     ${summary.optionsUpdated}`);
  console.log(`  Flashcards inserted: ${summary.flashcardsInserted}`);
  console.log(`  Flashcards updated:  ${summary.flashcardsUpdated}`);
  console.log(`  Dry run:             ${summary.dryRun ? "yes" : "no"}`);
  console.log(`${"─".repeat(52)}\n`);
}

main().catch((err) => {
  console.error("\n✗ Import failed:\n");
  console.error(err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) {
    console.error("\nStack trace:");
    console.error(err.stack);
  }
  process.exit(1);
});
