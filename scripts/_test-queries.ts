/**
 * Smoke test for the query layer against the test-batch data.
 */
import {
  listChapters,
  listChaptersWithCounts,
  getChapterByNumber,
  getChapterProgress,
  getChapterCount,
} from "../src/lib/db/queries/chapters";

import {
  listChunksByChapter,
  getChunkById,
  getAdjacentChunks,
  getChunkCount,
  getChapterWordCount,
} from "../src/lib/db/queries/chunks";

import {
  getQuestionWithOptions,
  listQuestions,
  listQuestionIdsByChapter,
  countQuestions,
  getQuestionStats,
  getQuestionFull,
  toggleBookmark,
  isBookmarked,
  listBookmarkedIds,
} from "../src/lib/db/queries/questions";

import {
  listFlashcards,
  getFlashcardById,
  getFlashcardStats,
  countFlashcards,
} from "../src/lib/db/queries/flashcards";

import {
  listImports,
  listImportsWithCounts,
  getImportCount,
  getLatestCompletedImport,
} from "../src/lib/db/queries/imports";

let pass = 0;
let fail = 0;

function assert(label: string, ok: boolean) {
  if (ok) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.log(`  ✗ ${label}`);
    fail++;
  }
}

console.log("=== QUERY LAYER SMOKE TEST ===\n");

// Chapters
console.log("CHAPTERS:");
const ch = listChapters();
assert("listChapters returns > 0", ch.length > 0);

const ch132 = getChapterByNumber(132);
assert("getChapterByNumber(132) found", !!ch132);

const chCounts = listChaptersWithCounts();
assert("listChaptersWithCounts returns counts", chCounts.length > 0 && chCounts[0].questionCount >= 0);

const chCount = getChapterCount();
assert("getChapterCount() > 0", chCount > 0);

const progress = getChapterProgress(ch132!.id);
assert("getChapterProgress returns data", !!progress && progress.totalQuestions > 0);

// Chunks
console.log("\nCHUNKS:");
const chunkList = listChunksByChapter(ch132!.id);
assert("listChunksByChapter returns 2", chunkList.length === 2);

const chunk0 = getChunkById(chunkList[0].id);
assert("getChunkById works", !!chunk0);

const adj = getAdjacentChunks(ch132!.id, chunkList[0].chunkIndex);
assert("getAdjacentChunks has next", !!adj.next);
assert("getAdjacentChunks no prev for first", !adj.prev);

const chunkCount = getChunkCount(ch132!.id);
assert("getChunkCount returns 2", chunkCount === 2);

const wordCount = getChapterWordCount(ch132!.id);
assert("getChapterWordCount >= 0", wordCount >= 0);

// Questions
console.log("\nQUESTIONS:");
const allQs = listQuestions();
assert("listQuestions returns 3", allQs.length === 3);

const qIds = listQuestionIdsByChapter(ch132!.id);
assert("listQuestionIdsByChapter returns 3", qIds.length === 3);

const qWithOpts = getQuestionWithOptions(allQs[0].id);
assert("getQuestionWithOptions has options", !!qWithOpts && qWithOpts.options.length > 0);

const qFull = getQuestionFull(allQs[0].id);
assert("getQuestionFull has chapterTitle", !!qFull && qFull.chapterTitle !== undefined);

const qCount = countQuestions({ chapterId: ch132!.id });
assert("countQuestions matches", qCount === 3);

const stats = getQuestionStats(ch132!.id);
assert("getQuestionStats returns totalQuestions=3", stats.totalQuestions === 3);
assert("getQuestionStats usedQuestions=0 (no attempts)", stats.usedQuestions === 0);

// Bookmark toggle
const bookmarkResult = toggleBookmark(allQs[0].id);
assert("toggleBookmark returns true (added)", bookmarkResult === true);
assert("isBookmarked returns true", isBookmarked(allQs[0].id));

const bookmarked = listBookmarkedIds();
assert("listBookmarkedIds contains our Q", bookmarked.includes(allQs[0].id));

const unbookmark = toggleBookmark(allQs[0].id);
assert("toggleBookmark returns false (removed)", unbookmark === false);
assert("isBookmarked returns false", !isBookmarked(allQs[0].id));

// Unused pool
const unused = listQuestions({ pool: "unused" });
assert("unused pool returns all 3 (no attempts)", unused.length === 3);

// Flashcards
console.log("\nFLASHCARDS:");
const fcs = listFlashcards();
assert("listFlashcards returns 2", fcs.length === 2);

const fc0 = getFlashcardById(fcs[0].id);
assert("getFlashcardById works", !!fc0);

const fcCount = countFlashcards();
assert("countFlashcards returns 2", fcCount === 2);

const fcStats = getFlashcardStats();
assert("getFlashcardStats.total = 2", fcStats.total === 2);
assert("getFlashcardStats.new = 2 (never reviewed)", fcStats.new === 2);

// Imports
console.log("\nIMPORTS:");
const imps = listImports();
assert("listImports returns > 0", imps.length > 0);

const impCounts = listImportsWithCounts();
assert("listImportsWithCounts has counts", impCounts.length > 0 && impCounts[0].chunkCount >= 0);

const impCount = getImportCount();
assert("getImportCount > 0", impCount > 0);

const latest = getLatestCompletedImport();
assert("getLatestCompletedImport found", !!latest);

// Summary
console.log(`\n=== RESULTS: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
