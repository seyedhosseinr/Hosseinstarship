/**
 * scripts/repair-question-chapter-assignments.ts
 *
 * Repairs questions that were imported to chapter 0 (the generic fallback)
 * because their JSON files did not include explicit chapterNo fields.
 *
 * Strategy:
 *   1. Find the chapter row with chapterNo=0 (if it exists)
 *   2. Find all questions pointing to it, with their import record for fileName
 *   3. Infer the correct chapter number from each import's fileName
 *   4. Locate the correct chapter in the DB by chapterNo
 *   5. Update chapterId on those questions
 *   6. Update externalKey for auto-derived keys (starting with "question_key_")
 *      so that re-importing the same files won't create duplicates
 *
 * Usage:
 *   npx tsx scripts/repair-question-chapter-assignments.ts
 *   npx tsx scripts/repair-question-chapter-assignments.ts --dry-run
 */

import { createHash } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db/index";
import { chapters, imports, questionOptions, questions } from "@/db/schema";

const DRY_RUN = process.argv.includes("--dry-run");

// ─── helpers ────────────────────────────────────────────────────────────────

function sha1slice18(seed: string): string {
  return createHash("sha1").update(seed).digest("hex").slice(0, 18);
}

function makeQuestionKey(seed: string): string {
  return `question_key_${sha1slice18(seed)}`;
}

/**
 * Same logic as the fixed inferChapterNoFromFileName in structured-import.ts.
 */
function inferChapterNoFromFileName(fileName: string): number | null {
  const baseName = fileName.replace(/\.[^.]+$/, "");

  // Priority 1: explicit "ch<N>" or "chapter_<N>"
  const chNameMatch = baseName.match(/(?:ch(?:apter)?[_-]?)(\d{1,3})/i);
  if (chNameMatch?.[1]) {
    const n = parseInt(chNameMatch[1], 10);
    if (n > 0 && n <= 200) return n;
  }

  // Priority 2: leading digits "95-1q" or "95_1q"
  const leadingMatch = baseName.match(/^(\d{1,3})[_-]/);
  if (leadingMatch?.[1]) {
    const n = parseInt(leadingMatch[1], 10);
    if (n > 0 && n <= 200) return n;
  }

  // Priority 3: trailing 2-3 digit number (require >=2 digits)
  const trailingMatch = baseName.match(/[_-](\d{2,3})(?:[_-]|$)/);
  if (trailingMatch?.[1]) {
    const n = parseInt(trailingMatch[1], 10);
    if (n > 0 && n <= 200) return n;
  }

  return null;
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  const db = await getDb();
  const now = Date.now();

  // 1. Find the generic chapter 0 row
  const chapter0 = await db.query.chapters.findFirst({
    where: eq(chapters.chapterNo, 0),
    columns: { id: true, chapterNo: true, title: true },
  });

  if (!chapter0) {
    console.log("✅ No chapter with chapterNo=0 found. Nothing to repair.");
    return;
  }

  console.log(`Found chapter 0 row: id=${chapter0.id} title="${chapter0.title}"`);

  // 2. Find questions pointing to chapter 0
  const badQuestions = await db
    .select({
      id: questions.id,
      externalKey: questions.externalKey,
      stemText: questions.stemText,
      importId: questions.importId,
    })
    .from(questions)
    .where(eq(questions.chapterId, chapter0.id));

  if (badQuestions.length === 0) {
    console.log("✅ No questions found on chapter 0. Nothing to repair.");
    return;
  }

  console.log(`Found ${badQuestions.length} question(s) on chapter 0.`);

  // 3. Load import records for these questions
  const importIds = [...new Set(badQuestions.map((q) => q.importId).filter((id): id is string => !!id))];
  const importRows =
    importIds.length > 0
      ? await db
          .select({ id: imports.id, fileName: imports.fileName })
          .from(imports)
          .where(inArray(imports.id, importIds))
      : [];
  const importFileNames = new Map(importRows.map((r) => [r.id, r.fileName ?? ""]));

  // 4. Load all options for these questions (for externalKey recalculation)
  const questionIds = badQuestions.map((q) => q.id);
  const optionRows =
    questionIds.length > 0
      ? await db
          .select({
            questionId: questionOptions.questionId,
            contentText: questionOptions.contentText,
            sortOrder: questionOptions.sortOrder,
          })
          .from(questionOptions)
          .where(inArray(questionOptions.questionId, questionIds))
      : [];

  const optsByQuestion = new Map<string, string[]>();
  // Sort by sortOrder then group
  const sortedOpts = [...optionRows].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );
  for (const opt of sortedOpts) {
    if (!optsByQuestion.has(opt.questionId)) optsByQuestion.set(opt.questionId, []);
    optsByQuestion.get(opt.questionId)!.push(opt.contentText ?? "");
  }

  // 5. Group questions by (fileName, inferred chapterNo)
  type Group = {
    chapterNo: number;
    fileName: string;
    questions: typeof badQuestions;
  };
  const groups: Group[] = [];
  const groupMap = new Map<string, Group>();

  for (const q of badQuestions) {
    const fileName = q.importId ? (importFileNames.get(q.importId) ?? "") : "";
    if (!fileName) {
      console.warn(`  ⚠️  Question ${q.id} has no import fileName — skipping.`);
      continue;
    }

    const chapterNo = inferChapterNoFromFileName(fileName);
    if (!chapterNo) {
      console.warn(
        `  ⚠️  Cannot infer chapter from fileName="${fileName}" for question ${q.id} — skipping.`,
      );
      continue;
    }

    const key = `${fileName}|${chapterNo}`;
    if (!groupMap.has(key)) {
      const group: Group = { chapterNo, fileName, questions: [] };
      groups.push(group);
      groupMap.set(key, group);
    }
    groupMap.get(key)!.questions.push(q);
  }

  if (groups.length === 0) {
    console.log("⚠️  No groups with inferable chapter numbers. Nothing repaired.");
    return;
  }

  // 6. For each group, find target chapter and apply updates
  let totalRepaired = 0;
  let totalSkipped = 0;

  for (const group of groups) {
    const targetChapter = await db.query.chapters.findFirst({
      where: eq(chapters.chapterNo, group.chapterNo),
      columns: { id: true, chapterNo: true, title: true },
    });

    if (!targetChapter) {
      console.warn(
        `  ⚠️  Chapter ${group.chapterNo} (inferred from "${group.fileName}") not in DB — ` +
          `skipping ${group.questions.length} question(s). Import that chapter first.`,
      );
      totalSkipped += group.questions.length;
      continue;
    }

    console.log(
      `\n📂 "${group.fileName}" → chapter ${group.chapterNo} "${targetChapter.title}"` +
        ` — ${group.questions.length} question(s)`,
    );

    for (const q of group.questions) {
      const opts = optsByQuestion.get(q.id) ?? [];

      // Recalculate externalKey for auto-derived keys (starting with "question_key_")
      let newExternalKey: string | null = null;
      if (q.externalKey.startsWith("question_key_") && q.stemText) {
        const seed = `${group.fileName}|${group.chapterNo}|${q.stemText}|${opts.join("|")}`;
        newExternalKey = makeQuestionKey(seed);
      }

      if (DRY_RUN) {
        console.log(
          `  [dry-run] Would update question ${q.id}: chapterId → ${targetChapter.id}` +
            (newExternalKey ? `, externalKey → ${newExternalKey}` : ""),
        );
        totalRepaired += 1;
        continue;
      }

      try {
        if (newExternalKey && newExternalKey !== q.externalKey) {
          // Check for externalKey collision
          const conflict = await db.query.questions.findFirst({
            where: and(
              eq(questions.externalKey, newExternalKey),
            ),
            columns: { id: true },
          });

          if (conflict && conflict.id !== q.id) {
            console.warn(
              `  ⚠️  externalKey collision for question ${q.id} → updating chapterId only.`,
            );
            await db
              .update(questions)
              .set({ chapterId: targetChapter.id, updatedAt: now })
              .where(eq(questions.id, q.id));
          } else {
            await db
              .update(questions)
              .set({ chapterId: targetChapter.id, externalKey: newExternalKey, updatedAt: now })
              .where(eq(questions.id, q.id));
          }
        } else {
          await db
            .update(questions)
            .set({ chapterId: targetChapter.id, updatedAt: now })
            .where(eq(questions.id, q.id));
        }

        console.log(
          `  ✅ Repaired question ${q.id}` +
            (newExternalKey && newExternalKey !== q.externalKey ? ` (externalKey updated)` : ""),
        );
        totalRepaired += 1;
      } catch (err) {
        console.error(
          `  ❌ Failed to repair question ${q.id}: ${err instanceof Error ? err.message : err}`,
        );
        totalSkipped += 1;
      }
    }
  }

  // 7. Report
  console.log("\n═══════════════════════════════════════════════");
  if (DRY_RUN) {
    console.log(`[DRY RUN] Would repair ${totalRepaired} question(s), skip ${totalSkipped}.`);
    console.log("Run without --dry-run to apply.");
  } else {
    console.log(`Repaired: ${totalRepaired} question(s)`);
    console.log(`Skipped:  ${totalSkipped} question(s)`);
  }
  console.log("═══════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("❌ Repair failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
