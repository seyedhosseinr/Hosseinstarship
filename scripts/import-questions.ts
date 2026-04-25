// scripts/import-questions.ts
// URO-OMEGA — Part 4: CLI Import Tool
// Usage:
//   npx tsx scripts/import-questions.ts validate ./data/2-1.json
//   npx tsx scripts/import-questions.ts import ./data/2-1.json
//   npx tsx scripts/import-questions.ts import ./data/2-1.json --overwrite
//   npx tsx scripts/import-questions.ts import ./data/*.json --dry-run
//   npx tsx scripts/import-questions.ts stats

import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, basename } from 'path';
import { importQuestions, printImportReport } from '../src/lib/importers/question-importer';
import { validateQuestions, printStats, RawQuestion } from '../src/lib/importers/validators';

// ──────────────────────────────────────────────
// CLI Argument Parsing
// ──────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];
const filePaths = args.filter(a => !a.startsWith('--'));
const flags = new Set(args.filter(a => a.startsWith('--')));

function printUsage() {
  console.log(`
╔══════════════════════════════════════════════════╗
║     URO-OMEGA Question Import CLI                ║
╚══════════════════════════════════════════════════╝

Commands:
  validate <file.json> [file2.json...]   Validate JSON files
  import <file.json> [file2.json...]     Import questions to database
  stats                                   Show database statistics

Flags:
  --overwrite   Overwrite existing questions with same concept_id
  --dry-run     Validate and show what would be imported, but don't write
  --verbose     Show detailed error messages

Examples:
  npx tsx scripts/import-questions.ts validate ./prisma/data/questions/2-1.json
  npx tsx scripts/import-questions.ts import ./prisma/data/questions/*.json
  npx tsx scripts/import-questions.ts import ./prisma/data/questions/2-1.json --overwrite
  npx tsx scripts/import-questions.ts stats
`);
}

// ──────────────────────────────────────────────
// File Loader
// ──────────────────────────────────────────────

function loadQuestionFiles(paths: string[]): { file: string; questions: RawQuestion[] }[] {
  const results: { file: string; questions: RawQuestion[] }[] = [];

  for (const filePath of paths) {
    const fullPath = resolve(filePath);

    if (!existsSync(fullPath)) {
      console.error(`❌ File not found: ${fullPath}`);
      continue;
    }

    try {
      const content = readFileSync(fullPath, 'utf-8');
      const parsed = JSON.parse(content);

      if (!Array.isArray(parsed)) {
        console.error(`❌ File ${basename(fullPath)} is not a JSON array`);
        continue;
      }

      results.push({
        file: basename(fullPath),
        questions: parsed as RawQuestion[],
      });

      console.log(`📁 Loaded ${basename(fullPath)}: ${parsed.length} questions`);
    } catch (err) {
      console.error(`❌ Failed to parse ${basename(fullPath)}:`, err instanceof Error ? err.message : err);
    }
  }

  return results;
}

// ──────────────────────────────────────────────
// Commands
// ──────────────────────────────────────────────

async function runValidate() {
  const files = filePaths.slice(1); // Skip command name
  if (files.length === 0) {
    console.error('❌ No files specified. Usage: validate <file.json>');
    process.exit(1);
  }

  const loaded = loadQuestionFiles(files);
  
  for (const { file, questions } of loaded) {
    console.log(`\n🔍 Validating ${file}...`);
    const result = validateQuestions(questions);
    console.log(printStats(result));
  }
}

async function runImport() {
  const files = filePaths.slice(1);
  if (files.length === 0) {
    console.error('❌ No files specified. Usage: import <file.json>');
    process.exit(1);
  }

  const loaded = loadQuestionFiles(files);
  const overwrite = flags.has('--overwrite');
  const dryRun = flags.has('--dry-run');

  let totalImported = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const { file, questions } of loaded) {
    console.log(`\n📥 Importing ${file}...`);

    const result = await importQuestions(questions, {
      overwrite,
      dryRun,
      batchSize: 50,
    });

    console.log(printImportReport(result));
    console.log(printStats(result.validation));

    totalImported += result.imported;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
  }

  if (loaded.length > 1) {
    console.log('\n═══════════════════════════════════════');
    console.log('📊 TOTAL SUMMARY:');
    console.log(`   Imported: ${totalImported}`);
    console.log(`   Updated:  ${totalUpdated}`);
    console.log(`   Skipped:  ${totalSkipped}`);
    console.log('═══════════════════════════════════════');
  }
}

async function runStats() {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const [
      totalQuestions,
      totalChapters,
      totalSubjects,
      bySource,
      byBloom,
      chaptersWithQuestions,
    ] = await Promise.all([
      prisma.question.count(),
      prisma.chapter.count(),
      prisma.subject.count(),
      prisma.question.groupBy({ by: ['sourceType'], _count: true }),
      prisma.question.groupBy({ by: ['bloomLevel'], _count: true }),
      prisma.question.groupBy({
        by: ['chapterId'],
        _count: true,
        orderBy: { _count: { chapterId: 'desc' } },
        take: 20,
      }),
    ]);

    // Fetch chapter names for top chapters
    const topChapterIds = chaptersWithQuestions.map(c => c.chapterId);
    const topChapters = await prisma.chapter.findMany({
      where: { id: { in: topChapterIds } },
      select: { id: true, chapterNumber: true, nameEn: true },
    });
    const chapterNameMap = new Map(topChapters.map(c => [c.id, c]));

    console.log(`
╔══════════════════════════════════════════════════╗
║     URO-OMEGA Database Statistics                ║
╚══════════════════════════════════════════════════╝

📚 Subjects:  ${totalSubjects}
📖 Chapters:  ${totalChapters}
❓ Questions: ${totalQuestions}

📊 By Source:`);
    for (const s of bySource) {
      console.log(`   ${s.sourceType.padEnd(15)} ${s._count}`);
    }

    console.log('\n🎯 By Bloom Level:');
    for (const b of byBloom) {
      console.log(`   ${b.bloomLevel.padEnd(15)} ${b._count}`);
    }

    console.log('\n📖 Top Chapters:');
    for (const ch of chaptersWithQuestions) {
      const info = chapterNameMap.get(ch.chapterId);
      if (info) {
        console.log(`   Ch ${String(info.chapterNumber).padStart(3)}: ${String(ch._count).padStart(4)} questions — ${info.nameEn}`);
      }
    }

    // Coverage
    const coveredChapters = new Set(chaptersWithQuestions.map(c => c.chapterId));
    const coverage = ((coveredChapters.size / totalChapters) * 100).toFixed(1);
    console.log(`\n📈 Chapter Coverage: ${coveredChapters.size}/${totalChapters} (${coverage}%)`);

  } finally {
    await prisma.$disconnect();
  }
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────

async function main() {
  switch (command) {
    case 'validate':
      await runValidate();
      break;
    case 'import':
      await runImport();
      break;
    case 'stats':
      await runStats();
      break;
    default:
      printUsage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
