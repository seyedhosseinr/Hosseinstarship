/**
 * Verify imported data integrity after batch import.
 */
import { db } from "@/db/index";
import { imports, chunks, questions, questionOptions, flashcards, chapters } from "@/db/schema";

console.log("=== DATA INTEGRITY CHECK ===\n");

// Chapters
const chapterRows = db.select().from(chapters).all();
console.log(`CHAPTERS: ${chapterRows.length}`);
for (const c of chapterRows) {
  console.log(`  ${c.id} | chapterNo: ${c.chapterNo} | ${c.titleEn?.substring(0, 50)}`);
}

// Imports
const importRows = db.select().from(imports).all();
console.log(`\nIMPORTS: ${importRows.length}`);
for (const i of importRows) {
  console.log(`  ${i.id} | status: ${i.status} | dryRun: ${i.dryRun}`);
  const manifestOk = typeof i.manifestJson === "string" && i.manifestJson.startsWith("{");
  const qcOk = typeof i.qcReportJson === "string" && i.qcReportJson.startsWith("{");
  console.log(`    manifestJson: ${manifestOk ? "VALID JSON string" : "PROBLEM: " + typeof i.manifestJson}`);
  console.log(`    qcReportJson: ${qcOk ? "VALID JSON string" : "PROBLEM: " + typeof i.qcReportJson}`);
}

// Chunks
const chunkRows = db.select().from(chunks).all();
console.log(`\nCHUNKS: ${chunkRows.length}`);
for (const c of chunkRows) {
  console.log(`  ${c.id} | chapter: ${c.chapterId} | ${c.title?.substring(0, 50)}`);
  if (c.metadataJson) {
    try {
      JSON.parse(c.metadataJson);
      console.log(`    metadataJson: VALID JSON string`);
    } catch {
      console.log(`    metadataJson: INVALID JSON!`);
    }
  } else {
    console.log(`    metadataJson: null`);
  }
}

// Questions
const questionRows = db.select().from(questions).all();
console.log(`\nQUESTIONS: ${questionRows.length}`);
for (const q of questionRows) {
  console.log(`  ${q.id} | chapter: ${q.chapterId} | difficulty: ${q.difficulty} | correct: ${q.correctOptionId}`);

  // Validate JSON fields
  for (const [field, value] of [
    ["tagsJson", q.tagsJson],
    ["sourceJson", q.sourceJson],
    ["whyOthersWrongJson", q.whyOthersWrongJson],
  ] as const) {
    if (value) {
      try {
        JSON.parse(value as string);
        console.log(`    ${field}: VALID JSON string`);
      } catch {
        console.log(`    ${field}: INVALID JSON!`);
      }
    } else {
      console.log(`    ${field}: null`);
    }
  }
}

// Options
const optionRows = db.select().from(questionOptions).all();
console.log(`\nOPTIONS: ${optionRows.length}`);
const optsByQ = new Map<string, typeof optionRows>();
for (const o of optionRows) {
  const arr = optsByQ.get(o.questionId) ?? [];
  arr.push(o);
  optsByQ.set(o.questionId, arr);
}
for (const [qId, opts] of optsByQ) {
  const correctCount = opts.filter((o) => o.isCorrect === 1).length;
  console.log(`  Q: ${qId} | ${opts.length} options | ${correctCount} correct`);
  for (const o of opts) {
    console.log(`    ${o.label}: ${o.text?.substring(0, 50)}${o.isCorrect ? " ✓" : ""}`);
  }
}

// Flashcards
const flashcardRows = db.select().from(flashcards).all();
console.log(`\nFLASHCARDS: ${flashcardRows.length}`);
for (const f of flashcardRows) {
  console.log(`  ${f.id} | chapter: ${f.chapterId} | type: ${f.cardType}`);
  for (const [field, value] of [
    ["tagsJson", f.tagsJson],
    ["sourceJson", f.sourceJson],
  ] as const) {
    if (value) {
      try {
        JSON.parse(value as string);
        console.log(`    ${field}: VALID JSON string`);
      } catch {
        console.log(`    ${field}: INVALID JSON!`);
      }
    } else {
      console.log(`    ${field}: null`);
    }
  }
}

// Summary
console.log("\n=== SUMMARY ===");
const expected = { chapters: 1, chunks: 2, questions: 3, options: 13, flashcards: 2 };
const actual = {
  chapters: chapterRows.length,
  chunks: chunkRows.length,
  questions: questionRows.length,
  options: optionRows.length,
  flashcards: flashcardRows.length,
};

let allOk = true;
for (const [key, exp] of Object.entries(expected)) {
  const act = actual[key as keyof typeof actual];
  const ok = act === exp;
  if (!ok) allOk = false;
  console.log(`  ${key}: ${act}/${exp} ${ok ? "✓" : "✗ MISMATCH"}`);
}

// Check FK integrity: all chunks/questions/flashcards reference valid chapterId
const chapterIds = new Set(chapterRows.map((c) => c.id));
const badChunkFKs = chunkRows.filter((c) => !chapterIds.has(c.chapterId));
const badQFKs = questionRows.filter((q) => !chapterIds.has(q.chapterId));
const badFcFKs = flashcardRows.filter((f) => !chapterIds.has(f.chapterId));
if (badChunkFKs.length || badQFKs.length || badFcFKs.length) {
  allOk = false;
  console.log(`  FK integrity: ✗ broken refs (chunks: ${badChunkFKs.length}, questions: ${badQFKs.length}, flashcards: ${badFcFKs.length})`);
} else {
  console.log(`  FK integrity: ✓ all references valid`);
}

// Check all question options reference valid questions
const questionIds = new Set(questionRows.map((q) => q.id));
const badOptFKs = optionRows.filter((o) => !questionIds.has(o.questionId));
if (badOptFKs.length) {
  allOk = false;
  console.log(`  Option FK integrity: ✗ ${badOptFKs.length} orphaned options`);
} else {
  console.log(`  Option FK integrity: ✓ all options reference valid questions`);
}

// Check correctOptionId on questions references a valid option
const optionIds = new Set(optionRows.map((o) => o.id));
const badCorrectRefs = questionRows.filter((q) => q.correctOptionId && !optionIds.has(q.correctOptionId));
if (badCorrectRefs.length) {
  allOk = false;
  console.log(`  CorrectOption refs: ✗ ${badCorrectRefs.length} questions with invalid correctOptionId`);
} else {
  console.log(`  CorrectOption refs: ✓ all correctOptionId values valid`);
}

console.log(`\n${allOk ? "✅ ALL CHECKS PASSED" : "❌ SOME CHECKS FAILED"}`);
