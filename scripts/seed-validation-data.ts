#!/usr/bin/env tsx
/**
 * Minimal seed for sidebar validation.
 * Inserts one chapter (Ch. 2) with realistic note sections and yield annotations.
 * Uses getDb() — works with both PGlite and Postgres.
 *
 * Usage:
 *   DB_RUNTIME=pglite npx tsx --tsconfig tsconfig.json scripts/seed-validation-data.ts
 */

import * as nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());

import { getDb } from "@/db/index";
import {
  contractChapters,
  noteDocuments,
  noteSections,
  noteFrames,
  yieldAnnotations,
} from "@/db/schema";
import { eq } from "drizzle-orm";

const CHAPTER_NO = 2;
const CHAPTER_ID = "contract-ch-2";
const DOC_ID = "doc-ch2-seg0";
const NOW = Date.now();

const SECTIONS = [
  { sectionId: "sec-ch2-history", title: "History Taking in Urology", orderIndex: 0 },
  { sectionId: "sec-ch2-physical-exam", title: "Physical Examination of the Urologic Patient", orderIndex: 1 },
  { sectionId: "sec-ch2-urinalysis", title: "Urinalysis: Interpretation and Pitfalls", orderIndex: 2 },
  { sectionId: "sec-ch2-special-tests", title: "Special Diagnostic Tests and Referral Criteria", orderIndex: 3 },
];

const FRAMES = [
  // Section 0 — History
  { frameId: "frame-ch2-h1", sectionId: "sec-ch2-history", orderIndex: 0, kind: "core", title: "Chief Complaint Documentation", body: "Always document the onset, duration, character, and severity of the presenting urologic complaint. Use validated scoring instruments (IPSS, IIEF) where applicable.", summary: "Structured symptom capture" },
  { frameId: "frame-ch2-h2", sectionId: "sec-ch2-history", orderIndex: 1, kind: "pearl", title: "Sexual History", body: "Sexual function history is often omitted but critical — erectile dysfunction is a sentinel for cardiovascular risk and should be asked routinely.", summary: "ED as CV risk marker" },

  // Section 1 — Physical exam
  { frameId: "frame-ch2-p1", sectionId: "sec-ch2-physical-exam", orderIndex: 0, kind: "core", title: "Digital Rectal Exam", body: "DRE assesses prostate size, consistency, symmetry, and nodularity. Median sulcus obliteration and induration suggest carcinoma.", summary: "DRE technique and findings" },
  { frameId: "frame-ch2-p2", sectionId: "sec-ch2-physical-exam", orderIndex: 1, kind: "warning", title: "Scrotal Transillumination", body: "A solid non-transilluminating scrotal mass is a testicular tumor until proven otherwise. Do not miss this on physical exam.", summary: "Transillumination sign" },

  // Section 2 — Urinalysis
  { frameId: "frame-ch2-u1", sectionId: "sec-ch2-urinalysis", orderIndex: 0, kind: "core", title: "Microscopic Hematuria", body: "≥3 RBCs per HPF on two of three properly collected specimens is the threshold for workup. Always rule out UTI before imaging.", summary: "Hematuria workup threshold" },
  { frameId: "frame-ch2-u2", sectionId: "sec-ch2-urinalysis", orderIndex: 1, kind: "pitfall", title: "Dipstick False Positives", body: "Myoglobinuria and hemoglobinuria both give a positive dipstick without RBCs on microscopy — always confirm with microscopy when dipstick is positive.", summary: "Dipstick vs microscopy" },

  // Section 3 — Special tests
  { frameId: "frame-ch2-s1", sectionId: "sec-ch2-special-tests", orderIndex: 0, kind: "keypoint", title: "PSA Interpretation Context", body: "PSA must be interpreted in context of age, prostate volume, and rate of change. PSA velocity >0.75 ng/mL/yr is suspicious even when absolute value is normal.", summary: "PSA velocity and context" },
  { frameId: "frame-ch2-s2", sectionId: "sec-ch2-special-tests", orderIndex: 1, kind: "indication", title: "Immediate Referral Criteria", body: "Refer immediately for: painless hematuria, palpable renal mass, scrotal mass, elevated PSA with abnormal DRE, or obstructive uropathy.", summary: "Red flag referrals" },
];

const YIELD_CARDS = [
  {
    id: "yield-ch2-1",
    summaryLabel: "History triggers that demand immediate urology referral",
    sourceSectionTitles: JSON.stringify(["History Taking in Urology"]),
    sourceAnchorHints: JSON.stringify(["sec-ch2-history"]),
    conceptLabels: JSON.stringify(["history", "referral"]),
    reasons: JSON.stringify(["high-yield exam"]),
    yieldTier: 3,
    keyExamInfo: 1,
    highYieldVisible: 1,
  },
  {
    id: "yield-ch2-2",
    summaryLabel: "DRE findings that distinguish BPH from prostate cancer",
    sourceSectionTitles: JSON.stringify(["Physical Examination of the Urologic Patient"]),
    sourceAnchorHints: JSON.stringify(["sec-ch2-physical-exam"]),
    conceptLabels: JSON.stringify(["DRE", "prostate"]),
    reasons: JSON.stringify(["frequently tested"]),
    yieldTier: 3,
    keyExamInfo: 1,
    highYieldVisible: 1,
  },
  {
    id: "yield-ch2-3",
    summaryLabel: "Microscopic hematuria: workup threshold and false positives",
    sourceSectionTitles: JSON.stringify(["Urinalysis: Interpretation and Pitfalls"]),
    sourceAnchorHints: JSON.stringify(["sec-ch2-urinalysis"]),
    conceptLabels: JSON.stringify(["hematuria", "urinalysis"]),
    reasons: JSON.stringify(["classic board question"]),
    yieldTier: 2,
    keyExamInfo: 0,
    highYieldVisible: 0,
  },
  {
    id: "yield-ch2-4",
    summaryLabel: "PSA velocity and immediate referral thresholds",
    sourceSectionTitles: JSON.stringify(["Special Diagnostic Tests and Referral Criteria"]),
    sourceAnchorHints: JSON.stringify(["sec-ch2-special-tests"]),
    conceptLabels: JSON.stringify(["PSA", "referral"]),
    reasons: JSON.stringify(["high-yield"]),
    yieldTier: 2,
    keyExamInfo: 0,
    highYieldVisible: 0,
  },
];

async function main() {
  const db = await getDb();
  const nowMs = NOW;

  // ── 1. contractChapters ────────────────────────────────────────────────
  const existingContract = await db.query.contractChapters.findFirst({
    where: eq(contractChapters.id, CHAPTER_ID),
  });
  if (!existingContract) {
    await db.insert(contractChapters).values({
      id: CHAPTER_ID,
      sourceId: "campbell-walsh-wein-13",
      chapterNo: CHAPTER_NO,
      chapterTitle: "Evaluation of the Urologic Patient: History, Physical Examination, and Urinalysis",
      createdAt: nowMs,
    });
    console.log("✓ contractChapters inserted");
  } else {
    console.log("· contractChapters already exists");
  }

  // ── 2. noteDocuments ───────────────────────────────────────────────────
  const existingDoc = await db.query.noteDocuments.findFirst({
    where: eq(noteDocuments.docId, DOC_ID),
  });
  if (!existingDoc) {
    await db.insert(noteDocuments).values({
      id: `ndoc-${DOC_ID}`,
      docId: DOC_ID,
      logicalChunkId: `lc-ch2-0`,
      version: 1,
      chapterId: CHAPTER_ID,
      chapterNo: CHAPTER_NO,
      chapterTitle: "Evaluation of the Urologic Patient: History, Physical Examination, and Urinalysis",
      chunkIndex: 0,
      pageRange: "8-19",
      generatedAt: nowMs,
      ingestStatus: "active",
      createdAt: nowMs,
    });
    console.log("✓ noteDocuments inserted");
  } else {
    console.log("· noteDocuments already exists");
  }

  // ── 3. noteSections ────────────────────────────────────────────────────
  for (const sec of SECTIONS) {
    const existing = await db.query.noteSections.findFirst({
      where: eq(noteSections.sectionId, sec.sectionId),
    });
    if (!existing) {
      await db.insert(noteSections).values({
        id: `ns-${sec.sectionId}`,
        sectionId: sec.sectionId,
        docId: DOC_ID,
        orderIndex: sec.orderIndex,
        title: sec.title,
        createdAt: nowMs,
      });
    }
  }
  console.log(`✓ noteSections inserted (${SECTIONS.length})`);

  // ── 4. noteFrames ──────────────────────────────────────────────────────
  for (const frame of FRAMES) {
    const existing = await db.query.noteFrames.findFirst({
      where: eq(noteFrames.frameId, frame.frameId),
    });
    if (!existing) {
      await db.insert(noteFrames).values({
        id: `nf-${frame.frameId}`,
        frameId: frame.frameId,
        docId: DOC_ID,
        sectionId: frame.sectionId,
        orderIndex: frame.orderIndex,
        kind: frame.kind,
        title: frame.title,
        body: frame.body,
        summary: frame.summary,
        createdAt: nowMs,
      });
    }
  }
  console.log(`✓ noteFrames inserted (${FRAMES.length})`);

  // ── 5. yieldAnnotations ────────────────────────────────────────────────
  for (const card of YIELD_CARDS) {
    const existing = await db.query.yieldAnnotations.findFirst({
      where: eq(yieldAnnotations.id, card.id),
    });
    if (!existing) {
      // .$type<string[]>() is a TS-only annotation; PGlite needs the text column
      // to receive a JSON string, not a JS array (which Drizzle would serialize via .toString())
      await db.insert(yieldAnnotations).values({
        id: card.id,
        chapterNo: CHAPTER_NO,
        sourceDocId: DOC_ID,
        summaryLabel: card.summaryLabel,
        sourceSectionTitles: card.sourceSectionTitles as unknown as string[],
        sourceAnchorHints: card.sourceAnchorHints as unknown as string[],
        conceptLabels: card.conceptLabels as unknown as string[],
        reasons: card.reasons as unknown as string[],
        yieldTier: card.yieldTier,
        keyExamInfo: card.keyExamInfo,
        highYieldVisible: card.highYieldVisible,
        createdAt: nowMs,
        updatedAt: nowMs,
      });
    }
  }
  console.log(`✓ yieldAnnotations inserted (${YIELD_CARDS.length})`);

  console.log(`
Validation routes:
  /library                              → macro hierarchy (no DB needed)
  /library/campbell/chapter/2           → chapter reader + NOTE micro-nav
  /notes/${DOC_ID}                → note viewer + YIELD micro-nav (switch tab)
  /yield                                → standalone yield page
`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
