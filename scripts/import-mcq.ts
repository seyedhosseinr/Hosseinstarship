#!/usr/bin/env tsx
// scripts/import-mcq.ts
// ──────────────────────────────────────────────────────
// CLI importer for MCQ JSON v6.1 files produced by the Hossein Starship
// MCQ engine (hossein-starship-mcq-engine skill).
//
// MUST run against Postgres (Neon). PGlite is rejected at startup.
//
// Usage:
//   DB_RUNTIME=postgres DATABASE_URL=<neon-url> \
//     npx tsx --tsconfig tsconfig.json scripts/import-mcq.ts \
//     C:/Projects/mcq&fc/outputs/mcqs/ch148_seg01_mcq.json
//
//   # Multiple files
//   DB_RUNTIME=postgres DATABASE_URL=<neon-url> \
//     npx tsx --tsconfig tsconfig.json scripts/import-mcq.ts \
//     C:/Projects/mcq&fc/outputs/mcqs/ch148_seg01_mcq.json \
//     C:/Projects/mcq&fc/outputs/mcqs/ch148_seg02_mcq.json
//
//   # Dry-run (validate + preview, no DB writes)
//   DB_RUNTIME=postgres DATABASE_URL=<neon-url> \
//     npx tsx --tsconfig tsconfig.json scripts/import-mcq.ts \
//     C:/Projects/mcq&fc/outputs/mcqs/ch148_seg01_mcq.json --dry-run
//
// File format: MCQ JSON schema v6.1
//   { schemaVersion: "6.1", segmentId: "148_01", questions: [...] }
// ──────────────────────────────────────────────────────

// ── MUST be the first executable lines — loads .env / .env.local /
//    .env.production.local before ANY @/db/* module is imported, so the
//    DB runtime and DATABASE_URL are visible when config.ts runs.
import * as nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());

import { readFileSync, existsSync } from "node:fs";
import { resolve, basename } from "node:path";
import { z } from "zod";

import { getDatabaseRuntime } from "@/db/config";
import { importStructuredPayload } from "@/lib/import-light/structured-import";

// ── Preflight: reject non-postgres runtimes immediately ─────────────────────

function preflight(): void {
  const runtime = getDatabaseRuntime();
  const dbUrl = process.env.DATABASE_URL?.trim() ?? "";

  if (runtime !== "postgres") {
    console.error(`
✗  Wrong runtime: "${runtime}".
   This script writes to Postgres (Neon) only — PGlite is not acceptable here.

   Fix: set DB_RUNTIME=postgres and DATABASE_URL=postgres://...
   Example:
     DB_RUNTIME=postgres DATABASE_URL="<neon-url>" \\
       npx tsx --tsconfig tsconfig.json scripts/import-mcq.ts <files...>
`);
    process.exit(1);
  }

  if (!/^postgres(ql)?:\/\//i.test(dbUrl)) {
    console.error(`
✗  DB_RUNTIME=postgres but DATABASE_URL is missing or not a postgres:// URL.
   Current value: "${dbUrl || "(empty)"}"

   Fix: set DATABASE_URL to your Neon connection string, e.g.
     DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
   You can add it to .env.production.local or pass it inline.
`);
    process.exit(1);
  }

  // Mask the password in the log line
  const safeUrl = dbUrl.replace(/:([^@/]+)@/, ":***@");
  console.log(`  runtime  : postgres`);
  console.log(`  db url   : ${safeUrl}`);
}

// ── Zod schema for v6.1 validation ─────────────────────────────────────────

const stemHighlightSchema = z.object({
  quote: z.string(),
  kind: z.enum(["highlight", "underline", "bold"]),
  note: z.string(),
});

const optionReviewSchema = z.object({
  optionKey: z.string().min(1),
  title: z.string(),
  why: z.string(),
  discriminator: z.string().nullable().optional(),
  trapType: z.string().nullable().optional(),
  linkedSourceBlockIds: z.array(z.string()).nullable().optional(),
  highlights: z.array(z.unknown()).nullable().optional(),
});

const reviewSchema = z.object({
  keyTeachingPoint: z.string(),
  stemHighlights: z.array(stemHighlightSchema),
  optionReviews: z.array(optionReviewSchema),
  takeHomeMessages: z.array(z.string()),
});

const questionSchema = z.object({
  id: z.string().min(1),
  segmentId: z.string().min(1),
  sourceBlockIds: z.array(z.string()),
  stem: z.string().min(1),
  options: z.record(z.enum(["A", "B", "C", "D", "E"]), z.string()),
  correctAnswer: z.enum(["A", "B", "C", "D", "E"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  questionStyle: z.string().min(1),
  questionRole: z.string().min(1),
  cognitiveLevel: z.enum(["recall", "application", "synthesis"]),
  boardYieldTier: z.string().min(1),
  tags: z.array(z.string()),
  conceptLabels: z.array(z.string()),
  sourceSectionTitles: z.array(z.string()),
  sourceAnchorHints: z.array(z.string()),
  relatedFlashcardHints: z.array(z.string()),
  review: reviewSchema,
});

const mcqFileSchema = z.object({
  schemaVersion: z.literal("6.1"),
  segmentId: z.string().min(1),
  questions: z.array(questionSchema).min(1),
});

type McqFile = z.output<typeof mcqFileSchema>;

// ── Helpers ──────────────────────────────────────────────────────────────────

function printUsage(): void {
  console.log(`
╔══════════════════════════════════════════════════════╗
║     MCQ JSON v6.1 Importer — Hossein Starship        ║
╚══════════════════════════════════════════════════════╝

Requires DB_RUNTIME=postgres and DATABASE_URL to be set.

Usage:
  DB_RUNTIME=postgres DATABASE_URL=<neon-url> \\
    npx tsx --tsconfig tsconfig.json scripts/import-mcq.ts \\
    <file1.json> [file2.json ...] [--dry-run]

Arguments:
  file.json     Path to one or more MCQ JSON v6.1 files
  --dry-run     Validate and preview without writing to the database

File format expected:
  { "schemaVersion": "6.1", "segmentId": "148_01", "questions": [...] }

Examples:
  DB_RUNTIME=postgres DATABASE_URL="<url>" \\
    npx tsx --tsconfig tsconfig.json scripts/import-mcq.ts \\
    C:/Projects/mcq&fc/outputs/mcqs/ch148_seg01_mcq.json

  DB_RUNTIME=postgres DATABASE_URL="<url>" \\
    npx tsx --tsconfig tsconfig.json scripts/import-mcq.ts \\
    C:/Projects/mcq&fc/outputs/mcqs/ch148_seg01_mcq.json \\
    C:/Projects/mcq&fc/outputs/mcqs/ch148_seg02_mcq.json \\
    C:/Projects/mcq&fc/outputs/mcqs/ch149_seg01_mcq.json

  # Dry-run (no DB writes)
  DB_RUNTIME=postgres DATABASE_URL="<url>" \\
    npx tsx --tsconfig tsconfig.json scripts/import-mcq.ts \\
    C:/Projects/mcq&fc/outputs/mcqs/ch148_seg01_mcq.json --dry-run
`);
}

function formatZodError(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => `  • ${issue.path.join(".")} — ${issue.message}`)
    .join("\n");
}

// ── File loader + validator ──────────────────────────────────────────────────

function loadAndValidateFile(
  filePath: string,
): { file: McqFile; rawText: string; fileName: string } | null {
  const fullPath = resolve(filePath);
  const fileName = basename(fullPath);

  if (!existsSync(fullPath)) {
    console.error(`  ✗ File not found: ${fullPath}`);
    return null;
  }

  let rawText: string;
  try {
    rawText = readFileSync(fullPath, "utf-8");
  } catch (err) {
    console.error(`  ✗ Cannot read ${fileName}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    console.error(`  ✗ ${fileName}: invalid JSON — ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }

  const result = mcqFileSchema.safeParse(parsed);
  if (!result.success) {
    console.error(`  ✗ ${fileName}: schema validation failed`);
    console.error(formatZodError(result.error));
    return null;
  }

  return { file: result.data, rawText, fileName };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith("--"));
  const flags = new Set(args.filter((a) => a.startsWith("--")));

  if (flags.has("--help") || flags.has("-h") || positional.length === 0) {
    printUsage();
    process.exit(0);
  }

  const dryRun = flags.has("--dry-run");
  const label = dryRun ? "DRY-RUN" : "IMPORT";

  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║     MCQ JSON v6.1 ${label.padEnd(34)}║`);
  console.log(`╚══════════════════════════════════════════════════════╝\n`);

  // ── Preflight: must be postgres ──
  preflight();
  console.log();

  // ── Load + validate all files first ──
  console.log(`Validating ${positional.length} file(s)...\n`);
  const loaded: Array<{ file: McqFile; rawText: string; fileName: string }> = [];

  for (const filePath of positional) {
    const result = loadAndValidateFile(filePath);
    if (result) {
      console.log(
        `  ✓ ${result.fileName} — segmentId: ${result.file.segmentId}, ${result.file.questions.length} question(s)`,
      );
      loaded.push(result);
    }
  }

  const invalid = positional.length - loaded.length;
  if (invalid > 0) {
    console.error(`\n  ${invalid} file(s) failed validation. Aborting.\n`);
    process.exit(1);
  }

  if (dryRun) {
    console.log(`\n[DRY-RUN] Validation passed — no database writes.\n`);
    console.log("Summary:");
    for (const { file, fileName } of loaded) {
      console.log(`  ${fileName}: ${file.questions.length} question(s)  (segmentId: ${file.segmentId})`);
    }
    const total = loaded.reduce((sum, { file }) => sum + file.questions.length, 0);
    console.log(`\n  Total: ${total} question(s) across ${loaded.length} file(s)\n`);
    return;
  }

  // ── Import each file ──
  console.log(`\nImporting ${loaded.length} file(s)...\n`);

  let totalImported = 0;
  let totalSkipped = 0;
  const t0 = performance.now();

  for (const { rawText, fileName } of loaded) {
    process.stdout.write(`  ⏳ ${fileName} ... `);
    try {
      const result = await importStructuredPayload({
        fileName,
        contentType: "questions",
        format: "json",
        rawText,
        sourceType: "mcq-v61",
      });

      const status =
        result.errors.length > 0
          ? `${result.importedCount} imported, ${result.skippedCount} skipped (${result.errors.length} error(s))`
          : `${result.importedCount} imported`;

      console.log(`✓ ${status}`);

      if (result.errors.length > 0) {
        for (const errMsg of result.errors) {
          console.error(`      ✗ ${errMsg}`);
        }
      }

      totalImported += result.importedCount;
      totalSkipped += result.skippedCount;
    } catch (err) {
      console.log("✗ FAILED");
      console.error(`      ${err instanceof Error ? err.message : String(err)}`);
      totalSkipped += 1;
    }
  }

  const elapsed = ((performance.now() - t0) / 1000).toFixed(2);

  console.log(`\n${"─".repeat(54)}`);
  console.log(`  Completed in ${elapsed}s`);
  console.log(`  Runtime:   postgres`);
  console.log(`  Files:     ${loaded.length}`);
  console.log(`  Imported:  ${totalImported}`);
  console.log(`  Skipped:   ${totalSkipped}`);
  console.log(`${"─".repeat(54)}\n`);

  if (totalSkipped > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n✗ Fatal error:", err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
