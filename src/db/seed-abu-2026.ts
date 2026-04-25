#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * ABU Board Prep — Campbell-Walsh 2026 (13-week COMPRESSED weight-based) seed.
 *
 * Run:
 *   DB_RUNTIME=pglite npx tsx --tsconfig tsconfig.json src/db/seed-abu-2026.ts
 *
 * Idempotent: wipes any existing plan with id === PLAN_ID and reinserts.
 * FK CASCADE handles cleanup of study_plan_days, study_tasks, study_task_links.
 */

import * as nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());

import { randomUUID } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db/index";
import {
  chapters,
  noteDocuments,
  studyPlans,
  studyPlanDays,
  studyTasks,
  studyTaskLinks,
  dayOfWeek,
  originRefType,
  planStatus,
  planDayStatus,
  targetMode,
  taskSourceType,
  taskStatus,
  taskType,
} from "@/db/schema";

/* -------------------------------------------------------------------------- */
/* Plan metadata                                                              */
/* -------------------------------------------------------------------------- */

const PLAN_ID = "abu-2026-v1";

const PLAN_META = {
  planKey: PLAN_ID,
  title: "ABU Board Prep — Campbell-Walsh 2026 (13-Week COMPRESSED)",
  description:
    "برنامه فشرده ۱۳ هفته‌ای (force majeure) برای امتحان بورد اورولوژی آمریکا. ۱۴۲ فصل، ~۳,۱۹۰ صفحه کمپل. روزانه ۷ روز با سرعت skim/aggressive. pipeline کامل AMBOSS Killer: Note → Flashcard → MCQ.",
  startDate: "2025-04-18",
  // 5 Shahrivar 1405 = 2026-08-27 (actual board exam date; the plan runs historical-labeled from 1404 but targets the 1405 exam window).
  examDate: "2026-08-27",
  totalWeeks: 13,
  dailyTimeBudgetMin: 420,
  repeatPattern: "daily_7x",
} as const;

/* -------------------------------------------------------------------------- */
/* Included chapters (142 entries)                                            */
/* -------------------------------------------------------------------------- */

// 131 chapters — 11 removed from the original 142 for the 13-week compressed plan
// (removed: 7, 12, 13, 14, 15, 22, 25, 78, 102, 145, 148 — surgical skills or basics covered elsewhere).
const INCLUDED_CHAPTER_NOS: readonly number[] = [
  2, 3, 4, 5, 6, 8,
  11, 16, 17, 20, 21,
  26, 27, 28, 29, 30, 31,
  32, 34, 35, 36, 37, 38,
  40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59,
  62, 63, 64,
  66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77,
  79, 80, 82, 83, 85, 86, 87,
  88, 90, 92, 94,
  95, 96, 97, 98, 99, 100,
  101, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114,
  116, 117, 118, 119, 120, 121, 122, 123,
  124, 125, 128, 129, 130, 131, 132, 133, 134, 135,
  136, 137, 139, 140, 141, 144,
  146, 147,
  149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 162, 163, 164, 165, 166,
];

const REMOVED_CHAPTER_NOS: readonly number[] = [7, 12, 13, 14, 15, 22, 25, 78, 102, 145, 148];

/* -------------------------------------------------------------------------- */
/* Yield tiers                                                                */
/* -------------------------------------------------------------------------- */

const TIER_HOT = new Set<number>([
  149, 150, 153, 155, 156, 157, 158, 159, 160, 162, 164, 165, 166,
  129, 130, 131, 132, 133, 134,
  41, 43, 45, 46, 48, 49, 50, 52, 56, 57,
  95, 96, 97, 98, 99,
  105, 107, 108, 109, 110, 113, 117, 118, 121,
  136, 137, 144,
  79, 80, 82,
  // Retiered HOT→MED: 26 (UTI), 27 (prostatitis/CPPS), 31 (TB/parasitic), 4 (US), 5 (CT/rad) — practitioner already knows.
  28,
  8, 20,
  86,
]);

// LOW-tier set pruned: removed chapters (7, 12, 13, 14, 22, 25, 78, 102, 145, 148) dropped from plan.
const TIER_LOW = new Set<number>([
  66, 88, 101, 119, 128,
]);

function tierOf(chapterNo: number): "hot" | "med" | "low" {
  if (TIER_HOT.has(chapterNo)) return "hot";
  if (TIER_LOW.has(chapterNo)) return "low";
  return "med";
}

function readingSpeed(chapterNo: number): number {
  // Middle-ground calibration for 13-week compressed plan:
  //   HOT 5 pg/hr (board-critical refresh, not first-read)
  //   LOW 11 pg/hr (anatomy/periop — practitioner already knows)
  //   MED 7 pg/hr (between 6 crawl and 8 skim)
  if (TIER_HOT.has(chapterNo)) return 5;
  if (TIER_LOW.has(chapterNo)) return 11;
  return 7;
}

function readingMinutes(pages: number, chapterNo: number): number {
  return Math.max(1, Math.round((pages / readingSpeed(chapterNo)) * 60));
}

/* -------------------------------------------------------------------------- */
/* Week structure (weight-based)                                              */
/* -------------------------------------------------------------------------- */

type WeekPattern = "acquire" | "mixed" | "weak" | "guideline" | "exam" | "taper";

interface WeekDef {
  readonly w: number;
  readonly phase: string;
  readonly pattern: WeekPattern;
  readonly chapters: readonly number[];
}

const WEEKS: readonly WeekDef[] = [
  { w: 1,  phase: "Prostate Ca A + BPH etiology",   pattern: "acquire", chapters: [149, 153, 154, 155, 156, 157, 158, 159] },
  { w: 2,  phase: "Prostate Ca B + BPH management", pattern: "acquire", chapters: [160, 162, 163, 164, 165, 166, 150, 151, 152] },
  { w: 3,  phase: "Peds Foundation + VUR start",    pattern: "acquire", chapters: [32, 34, 35, 36, 37, 38, 40, 41, 42] },
  { w: 4,  phase: "Peds Exstrophy/PUV/Neuro",       pattern: "acquire", chapters: [43, 44, 45, 46, 47, 48, 49, 50, 51, 52] },
  { w: 5,  phase: "Peds Reconstruct + Onc + Stone", pattern: "mixed",   chapters: [53, 54, 55, 56, 57, 58, 59, 62, 63, 64] },
  { w: 6,  phase: "Bladder Cancer complete",        pattern: "acquire", chapters: [129, 130, 131, 132, 133, 134, 135, 124, 125, 128] },
  { w: 7,  phase: "Kidney+Adrenal+Upper Tract",     pattern: "acquire", chapters: [136, 137, 139, 140, 141, 144, 146, 147] },
  { w: 8,  phase: "Stones+Nephro+Trauma",           pattern: "mixed",   chapters: [88, 90, 92, 94, 95, 96, 97, 98, 99, 100] },
  { w: 9,  phase: "LUT Female+Incont A",            pattern: "acquire", chapters: [101, 103, 104, 105, 107, 108, 109, 110, 111, 112] },
  { w: 10, phase: "LUT B+Pelvic Floor+Male Incont", pattern: "mixed",   chapters: [113, 114, 116, 117, 118, 119, 120, 121, 122, 123, 106] },
  { w: 11, phase: "Infections+Male Repro A",        pattern: "mixed",   chapters: [26, 27, 28, 29, 30, 31, 66, 67, 68, 69, 70, 71] },
  { w: 12, phase: "Male Repro B+Testis/Penis Onc",  pattern: "mixed",   chapters: [72, 73, 74, 75, 76, 77, 79, 80, 82, 83] },
  { w: 13, phase: "Genitalia+Diagnostics+Periop",   pattern: "taper",   chapters: [85, 86, 87, 2, 3, 4, 5, 6, 8, 11, 16, 17, 20, 21] },
];

const ALLOWED_PATTERNS: ReadonlySet<WeekPattern> = new Set([
  "acquire", "mixed", "weak", "guideline", "exam", "taper",
]);

/* -------------------------------------------------------------------------- */
/* Chapter registry (inline appendix — 142 entries)                           */
/* -------------------------------------------------------------------------- */

interface ChapterEntry {
  readonly no: number;
  readonly title: string;
  readonly startPage: number;
  readonly endPage: number;
  readonly volume: 1 | 2 | 3;
  readonly part: string;
}

const CHAPTERS: readonly ChapterEntry[] = [
  { no: 2, title: "Evaluation of the Urologic Patient: History and Physical Examination", startPage: 8, endPage: 23, volume: 1, part: "Clinical Decision Making" },
  { no: 3, title: "Indications and Interpretation of Laboratory Testing", startPage: 24, endPage: 39, volume: 1, part: "Clinical Decision Making" },
  { no: 4, title: "Urinary Tract Imaging: Basic Principles of Urologic Ultrasonography", startPage: 40, endPage: 65, volume: 1, part: "Clinical Decision Making" },
  { no: 5, title: "Principles of CT and Radiographic Imaging", startPage: 66, endPage: 91, volume: 1, part: "Clinical Decision Making" },
  { no: 6, title: "Magnetic Resonance Imaging", startPage: 92, endPage: 108, volume: 1, part: "Clinical Decision Making" },
  { no: 8, title: "Evaluation and Management of Hematuria", startPage: 120, endPage: 136, volume: 1, part: "Clinical Decision Making" },
  { no: 11, title: "Perioperative Care in Urologic Surgery", startPage: 150, endPage: 166, volume: 1, part: "Basics of Urologic Surgery" },
  { no: 16, title: "Fundamentals of Upper Urinary Tract Drainage", startPage: 199, endPage: 214, volume: 1, part: "Basics of Urologic Surgery" },
  { no: 17, title: "Principles of Urologic Endoscopy", startPage: 215, endPage: 228, volume: 1, part: "Basics of Urologic Surgery" },
  { no: 20, title: "Complications of Urologic Surgery", startPage: 283, endPage: 306, volume: 1, part: "Basics of Urologic Surgery" },
  { no: 21, title: "Urologic Considerations in Pregnancy", startPage: 307, endPage: 321, volume: 1, part: "Basics of Urologic Surgery" },
  { no: 26, title: "Infections of the Urinary Tract", startPage: 388, endPage: 458, volume: 1, part: "Infections and Inflammation" },
  { no: 27, title: "Inflammatory and Pain Conditions of the Lower Genitourinary Tract", startPage: 459, endPage: 479, volume: 1, part: "Infections and Inflammation" },
  { no: 28, title: "Interstitial Cystitis/Bladder Pain Syndrome and Related Disorders", startPage: 480, endPage: 510, volume: 1, part: "Infections and Inflammation" },
  { no: 29, title: "Sexually Transmitted Diseases", startPage: 511, endPage: 529, volume: 1, part: "Infections and Inflammation" },
  { no: 30, title: "Cutaneous Diseases of the External Genitalia", startPage: 530, endPage: 557, volume: 1, part: "Infections and Inflammation" },
  { no: 31, title: "Tuberculosis and Parasitic Infections of the Genitourinary Tract", startPage: 558, endPage: 583, volume: 1, part: "Infections and Inflammation" },
  { no: 32, title: "Embryology of the Human Genitourinary Tract", startPage: 584, endPage: 617, volume: 1, part: "Pediatric Urology" },
  { no: 34, title: "Perinatal Urology", startPage: 628, endPage: 657, volume: 1, part: "Pediatric Urology" },
  { no: 35, title: "Urologic Evaluation of the Child", startPage: 658, endPage: 671, volume: 1, part: "Pediatric Urology" },
  { no: 36, title: "Pediatric Urogenital Imaging", startPage: 672, endPage: 695, volume: 1, part: "Pediatric Urology" },
  { no: 37, title: "Infection and Inflammation of the Pediatric Genitourinary Tract", startPage: 696, endPage: 717, volume: 1, part: "Pediatric Urology" },
  { no: 38, title: "Core Principles of Perioperative Management in Children", startPage: 718, endPage: 730, volume: 1, part: "Pediatric Urology" },
  { no: 40, title: "Clinical and Urodynamic Evaluation of Lower Urinary Tract Dysfunction in Children", startPage: 744, endPage: 759, volume: 1, part: "Pediatric Urology" },
  { no: 41, title: "Management Strategies for Vesicoureteral Reflux", startPage: 760, endPage: 784, volume: 1, part: "Pediatric Urology" },
  { no: 42, title: "Bladder Anomalies in Children", startPage: 785, endPage: 794, volume: 1, part: "Pediatric Urology" },
  { no: 43, title: "Exstrophy-Epispadias Complex", startPage: 795, endPage: 854, volume: 1, part: "Pediatric Urology" },
  { no: 44, title: "Prune-Belly Syndrome", startPage: 855, endPage: 876, volume: 1, part: "Pediatric Urology" },
  { no: 45, title: "Posterior Urethral Valves", startPage: 877, endPage: 899, volume: 1, part: "Pediatric Urology" },
  { no: 46, title: "Neuromuscular Dysfunction of the Lower Urinary Tract in Children", startPage: 900, endPage: 920, volume: 1, part: "Pediatric Urology" },
  { no: 47, title: "Functional Disorders of the Bladder and Bowel in Children", startPage: 921, endPage: 940, volume: 1, part: "Pediatric Urology" },
  { no: 48, title: "Lower Urinary Tract Reconstruction in Children", startPage: 941, endPage: 973, volume: 1, part: "Pediatric Urology" },
  { no: 49, title: "Anomalies of the Kidney and Collecting System", startPage: 974, endPage: 1000, volume: 1, part: "Pediatric Urology" },
  { no: 50, title: "Renal Dysgenesis and Cystic Disease of the Kidney", startPage: 1001, endPage: 1026, volume: 1, part: "Pediatric Urology" },
  { no: 51, title: "Pathophysiology of Urinary Tract Obstruction", startPage: 1027, endPage: 1037, volume: 1, part: "Pediatric Urology" },
  { no: 52, title: "Ectopic Ureter, Ureterocele, and Ureteral Anomalies", startPage: 1038, endPage: 1063, volume: 1, part: "Pediatric Urology" },
  { no: 53, title: "Surgery of the Ureter in Children", startPage: 1064, endPage: 1090, volume: 1, part: "Pediatric Urology" },
  { no: 54, title: "Management of Pediatric Kidney Stone Disease", startPage: 1091, endPage: 1106, volume: 1, part: "Pediatric Urology" },
  { no: 55, title: "Management of Abnormalities of the External Genitalia in Males", startPage: 1107, endPage: 1140, volume: 1, part: "Pediatric Urology" },
  { no: 56, title: "Hypospadias", startPage: 1141, endPage: 1185, volume: 1, part: "Pediatric Urology" },
  { no: 57, title: "Etiology, Diagnosis, and Management of the Undescended Testis", startPage: 1186, endPage: 1210, volume: 1, part: "Pediatric Urology" },
  { no: 58, title: "Management of Abnormalities of the Genitalia in Girls", startPage: 1211, endPage: 1229, volume: 1, part: "Pediatric Urology" },
  { no: 59, title: "Differences of Sexual Development", startPage: 1230, endPage: 1253, volume: 1, part: "Pediatric Urology" },
  { no: 62, title: "Pediatric Genitourinary Trauma", startPage: 1289, endPage: 1310, volume: 1, part: "Pediatric Urology" },
  { no: 63, title: "Pediatric Urologic Oncology: Renal and Adrenal", startPage: 1311, endPage: 1332, volume: 1, part: "Pediatric Urology" },
  { no: 64, title: "Pediatric Urologic Oncology: Pelvis, Bladder, Testis, Genitalia", startPage: 1333, endPage: 1347, volume: 1, part: "Pediatric Urology" },
  { no: 66, title: "Surgical, Radiographic, and Endoscopic Anatomy of the Male Reproductive System", startPage: 1365, endPage: 1387, volume: 2, part: "Reproductive and Sexual Function" },
  { no: 67, title: "Male Reproductive Physiology", startPage: 1388, endPage: 1408, volume: 2, part: "Reproductive and Sexual Function" },
  { no: 68, title: "Integrated Men's Health", startPage: 1409, endPage: 1417, volume: 2, part: "Reproductive and Sexual Function" },
  { no: 69, title: "Male Infertility", startPage: 1418, endPage: 1436, volume: 2, part: "Reproductive and Sexual Function" },
  { no: 70, title: "Surgical Management of Male Infertility", startPage: 1437, endPage: 1469, volume: 2, part: "Reproductive and Sexual Function" },
  { no: 71, title: "Physiology of Penile Erection and Pathophysiology of ED", startPage: 1470, endPage: 1496, volume: 2, part: "Reproductive and Sexual Function" },
  { no: 72, title: "Evaluation and Management of Erectile Dysfunction", startPage: 1497, endPage: 1522, volume: 2, part: "Reproductive and Sexual Function" },
  { no: 73, title: "Priapism", startPage: 1523, endPage: 1540, volume: 2, part: "Reproductive and Sexual Function" },
  { no: 74, title: "Disorders of Male Orgasm and Ejaculation", startPage: 1541, endPage: 1560, volume: 2, part: "Reproductive and Sexual Function" },
  { no: 75, title: "Surgery for Erectile Dysfunction", startPage: 1561, endPage: 1578, volume: 2, part: "Reproductive and Sexual Function" },
  { no: 76, title: "Diagnosis and Management of Peyronie Disease", startPage: 1579, endPage: 1601, volume: 2, part: "Reproductive and Sexual Function" },
  { no: 77, title: "Sexual Function and Dysfunction in the Female", startPage: 1602, endPage: 1633, volume: 2, part: "Reproductive and Sexual Function" },
  { no: 79, title: "Neoplasms of the Testis", startPage: 1658, endPage: 1682, volume: 2, part: "Male Genitalia" },
  { no: 80, title: "Surgery of Testicular Tumors", startPage: 1683, endPage: 1705, volume: 2, part: "Male Genitalia" },
  { no: 82, title: "Tumors of the Penis", startPage: 1715, endPage: 1748, volume: 2, part: "Male Genitalia" },
  { no: 83, title: "Tumors of the Urethra", startPage: 1749, endPage: 1763, volume: 2, part: "Male Genitalia" },
  { no: 85, title: "Benign Disorders of the Penis and Urethra", startPage: 1774, endPage: 1793, volume: 2, part: "Male Genitalia" },
  { no: 86, title: "Urethral Stricture Disease", startPage: 1794, endPage: 1816, volume: 2, part: "Male Genitalia" },
  { no: 87, title: "Surgery of the Scrotum and Seminal Vesicles", startPage: 1817, endPage: 1837, volume: 2, part: "Male Genitalia" },
  { no: 88, title: "Surgical, Radiologic, and Endoscopic Anatomy of the Kidney and Ureter", startPage: 1838, endPage: 1853, volume: 2, part: "Renal Physiology and Pathophysiology" },
  { no: 90, title: "Fundamentals of Nephrology", startPage: 1883, endPage: 1895, volume: 2, part: "Renal Physiology and Pathophysiology" },
  { no: 92, title: "Urologic Complications of Renal Transplantation", startPage: 1903, endPage: 1941, volume: 2, part: "Renal Physiology and Pathophysiology" },
  { no: 94, title: "Upper Urinary Tract Trauma", startPage: 1972, endPage: 2003, volume: 2, part: "Upper Urinary Tract Obstruction and Trauma" },
  { no: 95, title: "Urinary Lithiasis: Etiology, Epidemiology, and Pathogenesis", startPage: 2004, endPage: 2010, volume: 2, part: "Urinary Lithiasis and Endourology" },
  { no: 96, title: "Acute Care of Urinary Lithiasis", startPage: 2011, endPage: 2026, volume: 2, part: "Urinary Lithiasis and Endourology" },
  { no: 97, title: "Surgical Management of Ureteral Calculi", startPage: 2027, endPage: 2048, volume: 2, part: "Urinary Lithiasis and Endourology" },
  { no: 98, title: "Surgical Management of Upper Urinary Tract Calculi", startPage: 2049, endPage: 2058, volume: 2, part: "Urinary Lithiasis and Endourology" },
  { no: 99, title: "Prevention of Urinary Stone Disease", startPage: 2059, endPage: 2066, volume: 2, part: "Urinary Lithiasis and Endourology" },
  { no: 100, title: "Lower Urinary Tract Calculi", startPage: 2067, endPage: 2083, volume: 2, part: "Urinary Lithiasis and Endourology" },
  { no: 101, title: "Surgical, Radiographic, and Endoscopic Anatomy of the Female Pelvis", startPage: 2084, endPage: 2103, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 103, title: "Physiology and Pharmacology of the Bladder and Urethra", startPage: 2157, endPage: 2165, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 104, title: "Pathophysiology and Classification of Lower Urinary Tract Dysfunction", startPage: 2166, endPage: 2179, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 105, title: "Evaluation and Management of Women With Urinary Incontinence and Pelvic Organ Prolapse", startPage: 2180, endPage: 2191, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 106, title: "Evaluation and Management of Males With Urinary Incontinence", startPage: 2192, endPage: 2217, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 107, title: "Urodynamic and Videourodynamic Evaluation of the Lower Urinary Tract", startPage: 2218, endPage: 2237, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 108, title: "Urinary Incontinence and Pelvic Prolapse: Epidemiology and Pathophysiology", startPage: 2238, endPage: 2275, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 109, title: "Neuromuscular Dysfunction of the Lower Urinary Tract", startPage: 2276, endPage: 2289, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 110, title: "Overactive Bladder", startPage: 2290, endPage: 2303, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 111, title: "Underactive Detrusor", startPage: 2304, endPage: 2336, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 112, title: "Nocturia", startPage: 2337, endPage: 2372, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 113, title: "Pharmacologic Management of LUT Storage and Emptying Failure", startPage: 2373, endPage: 2403, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 114, title: "Conservative Management of Urinary Incontinence", startPage: 2404, endPage: 2415, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 116, title: "Retropubic Suspension Surgery for Incontinence in Females", startPage: 2426, endPage: 2459, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 117, title: "Vaginal and Abdominal Reconstructive Surgery for POP", startPage: 2460, endPage: 2489, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 118, title: "Slings: Autologous, Biologic, Synthetic, and Mid-Urethral", startPage: 2490, endPage: 2502, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 119, title: "Genitourinary Complications of Mesh and Their Repair", startPage: 2503, endPage: 2514, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 120, title: "Aging and Geriatric Urology", startPage: 2515, endPage: 2554, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 121, title: "Urinary Tract Fistulae", startPage: 2555, endPage: 2583, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 122, title: "Bladder and Female Urethral Diverticula", startPage: 2584, endPage: 2600, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 123, title: "Surgical Procedures for Sphincteric Incontinence in the Male", startPage: 2584, endPage: 2600, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 124, title: "Bladder Surgery for Benign Disease", startPage: 2601, endPage: 2641, volume: 3, part: "Benign and Malignant Bladder Disorders" },
  { no: 125, title: "Genital and Lower Urinary Tract Trauma", startPage: 2642, endPage: 2654, volume: 3, part: "Benign and Malignant Bladder Disorders" },
  { no: 128, title: "Special Urologic Considerations in Transmasculine Individuals", startPage: 2677, endPage: 2686, volume: 3, part: "Benign and Malignant Bladder Disorders" },
  { no: 129, title: "Tumors of the Urinary Bladder", startPage: 2687, endPage: 2706, volume: 3, part: "Benign and Malignant Bladder Disorders" },
  { no: 130, title: "Management Strategies for Non–Muscle-Invasive Bladder Cancer", startPage: 2707, endPage: 2729, volume: 3, part: "Benign and Malignant Bladder Disorders" },
  { no: 131, title: "Management of Muscle-Invasive and Metastatic Bladder Cancer", startPage: 2730, endPage: 2755, volume: 3, part: "Benign and Malignant Bladder Disorders" },
  { no: 132, title: "Surgical Management of Bladder Cancer", startPage: 2756, endPage: 2783, volume: 3, part: "Benign and Malignant Bladder Disorders" },
  { no: 133, title: "Use of Intestinal Segments in Urinary Diversion", startPage: 2784, endPage: 2811, volume: 3, part: "Benign and Malignant Bladder Disorders" },
  { no: 134, title: "Continent Urinary Diversion", startPage: 2812, endPage: 2842, volume: 3, part: "Benign and Malignant Bladder Disorders" },
  { no: 135, title: "Minimally Invasive Urinary Diversion", startPage: 2843, endPage: 2859, volume: 3, part: "Benign and Malignant Bladder Disorders" },
  { no: 136, title: "Benign Renal Tumors", startPage: 2860, endPage: 2871, volume: 3, part: "Neoplasms of the Upper Urinary Tract" },
  { no: 137, title: "Malignant Renal Tumors", startPage: 2872, endPage: 2923, volume: 3, part: "Neoplasms of the Upper Urinary Tract" },
  { no: 139, title: "Surgical Management of Upper Urinary Tract Urothelial Tumors", startPage: 2940, endPage: 2967, volume: 3, part: "Neoplasms of the Upper Urinary Tract" },
  { no: 140, title: "Retroperitoneal Tumors", startPage: 2968, endPage: 2989, volume: 3, part: "Neoplasms of the Upper Urinary Tract" },
  { no: 141, title: "Contemporary Open Surgery of the Kidney", startPage: 2990, endPage: 3026, volume: 3, part: "Neoplasms of the Upper Urinary Tract" },
  { no: 144, title: "Treatment of Advanced Renal Cell Carcinoma", startPage: 3078, endPage: 3101, volume: 3, part: "Neoplasms of the Upper Urinary Tract" },
  { no: 146, title: "Pathophysiology, Evaluation, and Medical Management of Adrenal Disorders", startPage: 3111, endPage: 3160, volume: 3, part: "The Adrenals" },
  { no: 147, title: "Surgery of the Adrenal Glands", startPage: 3161, endPage: 3171, volume: 3, part: "The Adrenals" },
  { no: 149, title: "Benign Prostatic Hyperplasia: Etiology and Pathophysiology", startPage: 3180, endPage: 3220, volume: 3, part: "The Prostate" },
  { no: 150, title: "Evaluation and Nonsurgical Management of BPH", startPage: 3221, endPage: 3282, volume: 3, part: "The Prostate" },
  { no: 151, title: "Minimally Invasive and Endoscopic Management of BPH", startPage: 3283, endPage: 3317, volume: 3, part: "The Prostate" },
  { no: 152, title: "Simple Prostatectomy—Open, Laparoscopic, and Robotic", startPage: 3318, endPage: 3333, volume: 3, part: "The Prostate" },
  { no: 153, title: "Epidemiology, Etiology, and Prevention of Prostate Cancer", startPage: 3334, endPage: 3352, volume: 3, part: "The Prostate" },
  { no: 154, title: "Prostate Cancer Biomarkers", startPage: 3353, endPage: 3363, volume: 3, part: "The Prostate" },
  { no: 155, title: "Prostate Biopsy: Techniques and Imaging", startPage: 3364, endPage: 3381, volume: 3, part: "The Prostate" },
  { no: 156, title: "Pathology of Prostatic Neoplasia", startPage: 3382, endPage: 3389, volume: 3, part: "The Prostate" },
  { no: 157, title: "Diagnosis and Staging of Prostate Cancer", startPage: 3390, endPage: 3397, volume: 3, part: "The Prostate" },
  { no: 158, title: "Active Management Strategies for Localized Prostate Cancer", startPage: 3398, endPage: 3416, volume: 3, part: "The Prostate" },
  { no: 159, title: "Active Surveillance of Prostate Cancer", startPage: 3417, endPage: 3430, volume: 3, part: "The Prostate" },
  { no: 160, title: "Open Radical Prostatectomy", startPage: 3431, endPage: 3448, volume: 3, part: "The Prostate" },
  { no: 162, title: "Radiation Therapy for Prostate Cancer", startPage: 3474, endPage: 3504, volume: 3, part: "The Prostate" },
  { no: 163, title: "Focal Therapy of Prostate Cancer", startPage: 3505, endPage: 3542, volume: 3, part: "The Prostate" },
  { no: 164, title: "Treatment of Locally Advanced Prostate Cancer", startPage: 3543, endPage: 3561, volume: 3, part: "The Prostate" },
  { no: 165, title: "Management of Recurrent and Newly Metastatic Prostate Cancer", startPage: 3562, endPage: 3587, volume: 3, part: "The Prostate" },
  { no: 166, title: "Management of Castration-Resistant Prostate Cancer", startPage: 3588, endPage: 3612, volume: 3, part: "The Prostate" },
];

const CHAPTERS_BY_NO = new Map<number, ChapterEntry>(CHAPTERS.map((c) => [c.no, c]));

/* -------------------------------------------------------------------------- */
/* Jalali date helpers                                                        */
/* -------------------------------------------------------------------------- */

const JALALI_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];

const JALALI_WEEKDAY: Record<string, string> = {
  saturday: "شنبه",
  sunday: "یکشنبه",
  monday: "دوشنبه",
  tuesday: "سه‌شنبه",
  wednesday: "چهارشنبه",
  thursday: "پنجشنبه",
  friday: "جمعه",
};

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

function toPersianDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

function gregorianToJalali(gyInput: number, gmInput: number, gd: number): [number, number, number] {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let gy = gyInput;
  let jy = gy <= 1600 ? 0 : 979;
  gy -= gy <= 1600 ? 621 : 1600;
  const gy2 = gmInput > 2 ? gy + 1 : gy;
  let days =
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) -
    80 +
    gd +
    g_d_m[gmInput - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return [jy, jm, jd];
}

/* -------------------------------------------------------------------------- */
/* Date iteration                                                             */
/* -------------------------------------------------------------------------- */

type DowLiteral = (typeof dayOfWeek)[keyof typeof dayOfWeek];
const DOW_BY_INDEX: readonly DowLiteral[] = [
  dayOfWeek.sunday,
  dayOfWeek.monday,
  dayOfWeek.tuesday,
  dayOfWeek.wednesday,
  dayOfWeek.thursday,
  dayOfWeek.friday,
  dayOfWeek.saturday,
];

function isoToUtcDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function dateToIso(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d.getTime());
  next.setUTCDate(next.getUTCDate() + n);
  return next;
}

interface PlanDay {
  readonly index: number;              // 0..90
  readonly weekIndex: number;          // 0..12
  readonly date: Date;
  readonly iso: string;
  readonly dow: DowLiteral;
  readonly isAuditDay: boolean;
  readonly jalaliLabel: string;
}

const BASE_TOTAL_DAYS = 91;
const BASE_TOTAL_WEEKS = 13;
// Legacy aliases retained for existing references to TOTAL_DAYS/TOTAL_WEEKS in reports.
const TOTAL_DAYS = BASE_TOTAL_DAYS;
const TOTAL_WEEKS = BASE_TOTAL_WEEKS;
const WEEK14_EXTRA_DAYS = 7;
const MAX_TOTAL_DAYS = BASE_TOTAL_DAYS + WEEK14_EXTRA_DAYS; // 98
const MAX_TOTAL_WEEKS = BASE_TOTAL_WEEKS + 1;               // 14

function buildCalendar(startIso: string, totalDays: number = MAX_TOTAL_DAYS): PlanDay[] {
  const start = isoToUtcDate(startIso);
  const days: PlanDay[] = [];

  const weekCount = Math.ceil(totalDays / 7);

  // Audit day placement:
  //   Week 1 (starts Friday): day 0 = study day, day 6 (Thu) = audit (exception).
  //   Weeks 2..13: audit = the week's Friday.
  //   Week 14 (fallback, if present): week-1-style — Thu day 97 = audit.
  const weekAuditIndex: number[] = new Array(weekCount).fill(-1);
  weekAuditIndex[0] = 6;
  if (weekCount > 13) weekAuditIndex[13] = 97;

  for (let i = 0; i < totalDays; i++) {
    const d = addDays(start, i);
    const dow = DOW_BY_INDEX[d.getUTCDay()];
    const weekIndex = Math.floor(i / 7);
    if (weekIndex === 0 || weekIndex === 13) continue;
    if (dow === dayOfWeek.friday && weekAuditIndex[weekIndex] === -1) {
      weekAuditIndex[weekIndex] = i;
    }
  }
  for (let w = 0; w < weekCount; w++) {
    if (weekAuditIndex[w] === -1) weekAuditIndex[w] = w * 7 + 6;
  }

  for (let i = 0; i < totalDays; i++) {
    const d = addDays(start, i);
    const dow = DOW_BY_INDEX[d.getUTCDay()];
    const weekIndex = Math.floor(i / 7);
    const [jy, jm, jd] = gregorianToJalali(
      d.getUTCFullYear(),
      d.getUTCMonth() + 1,
      d.getUTCDate(),
    );
    const jalaliLabel = `${JALALI_WEEKDAY[dow]} ${toPersianDigits(jd)} ${JALALI_MONTHS[jm - 1]} ${toPersianDigits(jy)}`;
    days.push({
      index: i,
      weekIndex,
      date: d,
      iso: dateToIso(d),
      dow,
      isAuditDay: i === weekAuditIndex[weekIndex],
      jalaliLabel,
    });
  }
  return days;
}

/* -------------------------------------------------------------------------- */
/* Chapter-to-day packing per week                                            */
/* -------------------------------------------------------------------------- */

interface DayChapter {
  readonly chapterNo: number;
  readonly pagesStart: number;
  readonly pagesEnd: number;
  readonly pages: number;
  readonly minutes: number;
  readonly tier: "hot" | "med" | "low";
  readonly volume: 1 | 2 | 3;
  readonly title: string;
  readonly sliceIndex: number; // 1-based
  readonly sliceCount: number;
}

interface WeekPack {
  readonly weekIndex: number;
  readonly studyDays: readonly PlanDay[];
  readonly auditDay: PlanDay;
  readonly dayChapters: readonly (readonly DayChapter[])[]; // index aligned with studyDays
  readonly auditOverflow: readonly DayChapter[];            // extra chapter_read slice(s) on audit day, ≤ AUDIT_OVERFLOW_CAP
  readonly carryOut: readonly DayChapter[];                 // slices to prepend to next week's first study day
  readonly scaleFactor: 1;                                  // always 1.0 — no content drop
}

const PER_SLICE_MAX_MIN = 150;
// HARD throw: any day outside this range fails the seed. 620 tightens from the prior 700 ceiling.
const HARD_THROW_MIN = 240;
const HARD_THROW_MAX = 620;
// Day-budget soft range is [300, 540]. Audit days at 240 min are logged as expected low excursions.
const SOFT_WARN_MIN = 300;
const SOFT_WARN_MAX = 540;
// Reading cap per study day: 540 − overhead (flash 30 + qb 25/50 + note 15 + custom 25/0) ≈ 95 → reading ≤ 445.
const STUDY_DAY_READING_CAP = 445;
// Audit days no longer absorb overflow — 240-min fixed recipe. AUDIT_OVERFLOW_CAP=0 forces any surplus to throw.
const AUDIT_OVERFLOW_CAP = 0;

function splitChapterToSlices(ch: {
  chapterNo: number;
  pagesStart: number;
  pagesEnd: number;
  pages: number;
  minutes: number;
  tier: "hot" | "med" | "low";
  volume: 1 | 2 | 3;
  title: string;
}): DayChapter[] {
  const sliceCount = Math.max(1, Math.ceil(ch.minutes / PER_SLICE_MAX_MIN));
  if (sliceCount === 1) {
    return [{ ...ch, sliceIndex: 1, sliceCount: 1 }];
  }
  const pagesPerSlice = Math.max(1, Math.ceil(ch.pages / sliceCount));
  const minutesPerSlice = Math.max(10, Math.round(ch.minutes / sliceCount));
  const out: DayChapter[] = [];
  for (let i = 0; i < sliceCount; i++) {
    const sliceStart = ch.pagesStart + i * pagesPerSlice;
    const sliceEnd = i === sliceCount - 1 ? ch.pagesEnd : Math.min(ch.pagesEnd, sliceStart + pagesPerSlice - 1);
    if (sliceStart > sliceEnd) continue;
    out.push({
      chapterNo: ch.chapterNo,
      pagesStart: sliceStart,
      pagesEnd: sliceEnd,
      pages: sliceEnd - sliceStart + 1,
      minutes: minutesPerSlice,
      tier: ch.tier,
      volume: ch.volume,
      title: ch.title,
      sliceIndex: i + 1,
      sliceCount,
    });
  }
  return out;
}

interface SpillEntry {
  fromWeek: number;
  toWeek: number;
  target: "audit" | "next-week-saturday";
  chapterNo: number;
  sliceIndex: number;
  sliceCount: number;
  minutes: number;
}

function packWeek(
  weekIndex: number,
  weekDef: WeekDef,
  calendar: readonly PlanDay[],
  carryIn: readonly DayChapter[],
  spillLog: SpillEntry[],
): WeekPack {
  const weekDays = calendar.slice(weekIndex * 7, weekIndex * 7 + 7);
  const auditDay = weekDays.find((d) => d.isAuditDay) ?? weekDays[6];
  const studyDays = weekDays.filter((d) => d !== auditDay);

  const rawChapters = weekDef.chapters.map((chapterNo) => {
    const meta = CHAPTERS_BY_NO.get(chapterNo);
    if (!meta) throw new Error(`Chapter ${chapterNo} missing from CHAPTERS registry`);
    const pages = Math.max(1, meta.endPage - meta.startPage + 1);
    return {
      chapterNo,
      pagesStart: meta.startPage,
      pagesEnd: meta.endPage,
      pages,
      minutes: readingMinutes(pages, chapterNo),
      tier: tierOf(chapterNo),
      volume: meta.volume,
      title: meta.title,
    };
  });

  // NO SCALE FACTOR — spec forbids content drop. Slice chapters and spill overflow.
  const slices: DayChapter[] = [];
  for (const c of rawChapters) slices.push(...splitChapterToSlices(c));

  const dayChapters: DayChapter[][] = studyDays.map(() => []);
  const dayMinutes = new Array<number>(studyDays.length).fill(0);

  // Carry-in from previous week lands on this week's first study day (Saturday in weeks 2-13).
  // Dedicate its minutes up front so the LPT pass sees the correct bin weights.
  if (carryIn.length > 0) {
    for (const s of carryIn) {
      dayChapters[0].push(s);
      dayMinutes[0] += s.minutes;
    }
  }

  // LPT with soft cap: sort desc by minutes, place each in the currently lightest bin that still has room.
  // If no bin has room: check week-level budget. If remaining bins' combined slack is negative even without this slice,
  // send to overflow; otherwise drop it into the least-loaded bin (may push that day slightly over STUDY_DAY_READING_CAP
  // but the HARD_THROW_MAX check still guards against blowups).
  const sorted = [...slices].sort((a, b) => b.minutes - a.minutes);
  const overflow: DayChapter[] = [];
  const totalCapacity = studyDays.length * STUDY_DAY_READING_CAP;
  for (const s of sorted) {
    let fitBin = -1;
    let fitLoad = Infinity;
    let leastBin = 0;
    for (let b = 0; b < dayMinutes.length; b++) {
      if (dayMinutes[b] < dayMinutes[leastBin]) leastBin = b;
      if (dayMinutes[b] + s.minutes <= STUDY_DAY_READING_CAP && dayMinutes[b] < fitLoad) {
        fitBin = b;
        fitLoad = dayMinutes[b];
      }
    }
    if (fitBin >= 0) {
      dayChapters[fitBin].push(s);
      dayMinutes[fitBin] += s.minutes;
    } else {
      // Soft-overflow path: if total load (after placing this slice in least bin) stays within totalCapacity + AUDIT_OVERFLOW_CAP,
      // prefer to place it in the least-loaded bin rather than push to carry.
      const projected = dayMinutes.reduce((a, m) => a + m, 0) + s.minutes;
      if (projected <= totalCapacity + AUDIT_OVERFLOW_CAP) {
        dayChapters[leastBin].push(s);
        dayMinutes[leastBin] += s.minutes;
      } else {
        overflow.push(s);
      }
    }
  }

  // Step 1: absorb overflow into audit day's chapter_read (up to AUDIT_OVERFLOW_CAP).
  const auditOverflow: DayChapter[] = [];
  let auditMin = 0;
  const remaining: DayChapter[] = [];
  // Consume overflow in insertion order (smaller slices last, since they were sorted desc and tail-sliced).
  for (const s of overflow) {
    if (auditMin + s.minutes <= AUDIT_OVERFLOW_CAP) {
      auditOverflow.push(s);
      auditMin += s.minutes;
      spillLog.push({
        fromWeek: weekIndex + 1,
        toWeek: weekIndex + 1,
        target: "audit",
        chapterNo: s.chapterNo,
        sliceIndex: s.sliceIndex,
        sliceCount: s.sliceCount,
        minutes: s.minutes,
      });
    } else {
      remaining.push(s);
    }
  }

  // Step 2: remaining overflow spills to next week's Saturday (first study-day bin of week weekIndex+1).
  const carryOut: DayChapter[] = remaining;
  for (const s of carryOut) {
    spillLog.push({
      fromWeek: weekIndex + 1,
      toWeek: weekIndex + 2,
      target: "next-week-saturday",
      chapterNo: s.chapterNo,
      sliceIndex: s.sliceIndex,
      sliceCount: s.sliceCount,
      minutes: s.minutes,
    });
  }

  // Within each bin, order slices by (chapterNo, sliceIndex) for readable flow.
  for (const bin of dayChapters) {
    bin.sort((a, b) => a.chapterNo - b.chapterNo || a.sliceIndex - b.sliceIndex);
  }
  auditOverflow.sort((a, b) => a.chapterNo - b.chapterNo || a.sliceIndex - b.sliceIndex);

  return {
    weekIndex,
    studyDays,
    auditDay,
    dayChapters,
    auditOverflow,
    carryOut,
    scaleFactor: 1,
  };
}

/* -------------------------------------------------------------------------- */
/* Task row builders                                                          */
/* -------------------------------------------------------------------------- */

type TaskTypeLiteral = (typeof taskType)[keyof typeof taskType];
type OriginRefLiteral = (typeof originRefType)[keyof typeof originRefType];

interface TaskRow {
  id: string;
  planId: string;
  dayId: string;
  taskType: TaskTypeLiteral;
  status: (typeof taskStatus)[keyof typeof taskStatus];
  title: string;
  description: string | null;
  sortOrder: number;
  estimatedMinutes: number;
  targetCount: number | null;
  priority: number;
  scheduledFor: string;
  originRefType: OriginRefLiteral;
  originRefId: string;
  sourceType: (typeof taskSourceType)[keyof typeof taskSourceType];
  resultJson: string | null;
}

interface LinkRow {
  id: string;
  taskId: string;
  chapterId: string | null;
  docId: string | null;
  metadataJson: string;
  sortOrder: number;
}

function chapterLinkMetadata(ch: DayChapter): string {
  return JSON.stringify({
    chapterNo: ch.chapterNo,
    qbankChapterId: `ch-${String(ch.chapterNo).padStart(3, "0")}`,
    pagesStart: ch.pagesStart,
    pagesEnd: ch.pagesEnd,
    volume: ch.volume,
    tier: ch.tier,
    title: ch.title,
    sliceIndex: ch.sliceIndex,
    sliceCount: ch.sliceCount,
  });
}

// Study-day duration targets: keep total in [320, 540] whenever possible (spec §3).
const STUDY_DAY_MIN_TOTAL = 320;
const STUDY_DAY_MAX_TOTAL = 540;
const FLASH_BASE_MIN = 30;
const NOTE_BASE_MIN = 15;
const QB_BASE_MIN = 25;
const QB_HEAVY_MIN = 50;            // reallocated block when primary is MED/LOW (drops custom_task)
const QB_HEAVY_TARGET = 30;         // MCQ count for QB_HEAVY_MIN
const CUSTOM_BASE_MIN = 25;

function planStudyDayDurations(params: {
  readingMinutes: number;
  enableCustomTask: boolean;
}): {
  flashcardMin: number;
  questionBlockMin: number;
  questionBlockTarget: number;
  notebookMin: number;
  customMin: number | null;
} {
  // Custom-task only when primary chapter is HOT; otherwise QB gets the 25-min reallocation.
  const qbMin = params.enableCustomTask ? QB_BASE_MIN : QB_HEAVY_MIN;
  const qbTarget = params.enableCustomTask ? 20 : QB_HEAVY_TARGET;
  const customBase = params.enableCustomTask ? CUSTOM_BASE_MIN : 0;
  const baseOverhead = FLASH_BASE_MIN + qbMin + NOTE_BASE_MIN + customBase;
  const baseTotal = params.readingMinutes + baseOverhead;

  if (baseTotal >= STUDY_DAY_MIN_TOTAL && baseTotal <= STUDY_DAY_MAX_TOTAL) {
    return {
      flashcardMin: FLASH_BASE_MIN,
      questionBlockMin: qbMin,
      questionBlockTarget: qbTarget,
      notebookMin: NOTE_BASE_MIN,
      customMin: params.enableCustomTask ? CUSTOM_BASE_MIN : null,
    };
  }

  if (baseTotal < STUDY_DAY_MIN_TOTAL) {
    const boost = STUDY_DAY_MIN_TOTAL - baseTotal;
    const flashExtra = Math.round(boost * 0.6);
    const noteExtra = boost - flashExtra;
    return {
      flashcardMin: FLASH_BASE_MIN + flashExtra,
      questionBlockMin: qbMin,
      questionBlockTarget: qbTarget,
      notebookMin: NOTE_BASE_MIN + noteExtra,
      customMin: params.enableCustomTask ? CUSTOM_BASE_MIN : null,
    };
  }

  // baseTotal > STUDY_DAY_MAX_TOTAL: drop custom_task first, then leave heavy reading.
  return {
    flashcardMin: FLASH_BASE_MIN,
    questionBlockMin: qbMin,
    questionBlockTarget: qbTarget,
    notebookMin: NOTE_BASE_MIN,
    customMin: null,
  };
}

function buildDayTasks(params: {
  planId: string;
  dayId: string;
  iso: string;
  weekIndex: number;
  weekPhase: string;
  isAuditDay: boolean;
  chaptersForDay: readonly DayChapter[];
  auditOverflow?: readonly DayChapter[];
  enableCustomTask: boolean;
  chapterIdByNo: Map<number, string>;
  docIdByChapterNo: Map<number, string>;
}): { tasks: TaskRow[]; links: LinkRow[] } {
  const tasks: TaskRow[] = [];
  const links: LinkRow[] = [];
  let sort = 0;

  const pushTask = (t: Omit<TaskRow, "planId" | "dayId" | "scheduledFor" | "sortOrder" | "sourceType" | "status" | "resultJson">): TaskRow => {
    const row: TaskRow = {
      ...t,
      planId: params.planId,
      dayId: params.dayId,
      scheduledFor: params.iso,
      sortOrder: sort++,
      sourceType: taskSourceType.manual,
      status: taskStatus.pending,
      resultJson: null,
    };
    tasks.push(row);
    return row;
  };

  if (params.isAuditDay) {
    const weakId = `${PLAN_ID}:w${params.weekIndex + 1}:weak`;
    const examId = `${PLAN_ID}:w${params.weekIndex + 1}:exam`;
    pushTask({
      id: randomUUID(),
      taskType: taskType.weakAreaReview,
      title: `جمع‌بندی هفتگی — مرور نقاط ضعف (${params.weekPhase})`,
      description: "مرور ۹۰ دقیقه‌ای موضوعاتی که در MCQهای هفته قبل زیر ۷۰٪ دقت داشتی.",
      estimatedMinutes: 90,
      targetCount: null,
      priority: 2,
      originRefType: originRefType.weakArea,
      originRefId: weakId,
    });
    pushTask({
      id: randomUUID(),
      taskType: taskType.examBlock,
      title: `آزمون شبیه‌ساز هفتگی — ۵۰ سؤال (${params.weekPhase})`,
      description: "بلوک زمان‌دار ۶۰ دقیقه، ۵۰ سؤال AUA SASP یا QBank ترکیبی.",
      estimatedMinutes: 60,
      targetCount: 50,
      priority: 2,
      originRefType: originRefType.question,
      originRefId: examId,
    });
    pushTask({
      id: randomUUID(),
      taskType: taskType.flashcardReview,
      title: "FSRS — مرور کارت‌های اولویت‌دار هفته",
      description: "۶۰ دقیقه مرور، بدون کارت جدید.",
      estimatedMinutes: 60,
      targetCount: null,
      priority: 1,
      originRefType: originRefType.flashcard,
      originRefId: `${PLAN_ID}:w${params.weekIndex + 1}:fsrs-friday`,
    });
    pushTask({
      id: randomUUID(),
      taskType: taskType.notebookReview,
      title: "بازبینی هفتگی یادداشت‌های فارسی",
      description: "۳۰ دقیقه مرور one-pagerها و الگوریتم‌های هفته.",
      estimatedMinutes: 30,
      targetCount: null,
      priority: 0,
      originRefType: originRefType.document,
      originRefId: `${PLAN_ID}:w${params.weekIndex + 1}:notes`,
    });

    // Compressed spec §3: audit day carries a chapter_read overflow slice (≤120 min).
    const overflow = params.auditOverflow ?? [];
    for (const ch of overflow) {
      const chapterId = params.chapterIdByNo.get(ch.chapterNo) ?? null;
      const sliceSuffix = ch.sliceCount > 1 ? ` — بخش ${ch.sliceIndex}/${ch.sliceCount}` : "";
      const row = pushTask({
        id: randomUUID(),
        taskType: taskType.chapterRead,
        title: `فصل ${ch.chapterNo}${sliceSuffix} — ${ch.title} (pp ${ch.pagesStart}-${ch.pagesEnd}) [overflow]`,
        description: `Overflow از هفته ${params.weekIndex + 1} — ${ch.pages} صفحه، tier ${ch.tier}.`,
        estimatedMinutes: ch.minutes,
        targetCount: ch.pages,
        priority: ch.tier === "hot" ? 2 : ch.tier === "low" ? 0 : 1,
        originRefType: originRefType.chapter,
        originRefId: chapterId ?? String(ch.chapterNo),
      });
      links.push({
        id: randomUUID(),
        taskId: row.id,
        chapterId,
        docId: params.docIdByChapterNo.get(ch.chapterNo) ?? null,
        metadataJson: chapterLinkMetadata(ch),
        sortOrder: 0,
      });
    }
    return { tasks, links };
  }

  // Study day
  // Primary = first chapter by chapterNo order (since bins are sorted by chapterNo).
  const primary = params.chaptersForDay[0];
  const readingTotal = params.chaptersForDay.reduce((a, c) => a + c.minutes, 0);
  // Spec §6: custom_task only fires when primary chapter is HOT-tier.
  const primaryIsHot = primary !== undefined && primary.tier === "hot";
  const durations = planStudyDayDurations({
    readingMinutes: readingTotal,
    enableCustomTask: params.enableCustomTask && primaryIsHot,
  });

  for (const ch of params.chaptersForDay) {
    const chapterId = params.chapterIdByNo.get(ch.chapterNo) ?? null;
    const sliceSuffix = ch.sliceCount > 1 ? ` — بخش ${ch.sliceIndex}/${ch.sliceCount}` : "";
    const row = pushTask({
      id: randomUUID(),
      taskType: taskType.chapterRead,
      title: `فصل ${ch.chapterNo}${sliceSuffix} — ${ch.title} (pp ${ch.pagesStart}-${ch.pagesEnd})`,
      description: `خواندن ${ch.pages} صفحه، tier ${ch.tier}.`,
      estimatedMinutes: ch.minutes,
      targetCount: ch.pages,
      priority: ch.tier === "hot" ? 2 : ch.tier === "low" ? 0 : 1,
      originRefType: originRefType.chapter,
      originRefId: chapterId ?? String(ch.chapterNo),
    });
    links.push({
      id: randomUUID(),
      taskId: row.id,
      chapterId,
      docId: params.docIdByChapterNo.get(ch.chapterNo) ?? null,
      metadataJson: chapterLinkMetadata(ch),
      sortOrder: 0,
    });
  }

  pushTask({
    id: randomUUID(),
    taskType: taskType.flashcardReview,
    title:
      durations.flashcardMin > FLASH_BASE_MIN
        ? `FSRS — مرور گسترده (${durations.flashcardMin} دقیقه)`
        : "FSRS — مرور کارت‌های سررسید + ۲۵ کارت جدید",
    description: `${durations.flashcardMin} دقیقه صف FSRS Hossein Starship.`,
    estimatedMinutes: durations.flashcardMin,
    targetCount: null,
    priority: 1,
    originRefType: originRefType.flashcard,
    originRefId: `${PLAN_ID}:w${params.weekIndex + 1}:${params.iso}:fsrs`,
  });

  if (primary) {
    const primaryChapterId = params.chapterIdByNo.get(primary.chapterNo) ?? null;
    const qbRow = pushTask({
      id: randomUUID(),
      taskType: taskType.questionBlock,
      title: `${toPersianDigits(durations.questionBlockTarget)} سؤال QBank — فصل ${primary.chapterNo}`,
      description: `${durations.questionBlockMin} دقیقه، سؤالات AUA SASP / QBank تگ‌شده با فصل امروز.`,
      estimatedMinutes: durations.questionBlockMin,
      targetCount: durations.questionBlockTarget,
      priority: 1,
      originRefType: originRefType.chapter,
      originRefId: primaryChapterId ?? String(primary.chapterNo),
    });
    links.push({
      id: randomUUID(),
      taskId: qbRow.id,
      chapterId: primaryChapterId,
      docId: params.docIdByChapterNo.get(primary.chapterNo) ?? null,
      metadataJson: chapterLinkMetadata(primary),
      sortOrder: 0,
    });

    const noteRow = pushTask({
      id: randomUUID(),
      taskType: taskType.notebookReview,
      title:
        durations.notebookMin > NOTE_BASE_MIN
          ? `بازخوانی یادداشت فارسی — مرور گسترده فصل ${primary.chapterNo}`
          : `بازخوانی note فارسی فصل ${primary.chapterNo}`,
      description: `${durations.notebookMin} دقیقه مرور one-pager فارسی.`,
      estimatedMinutes: durations.notebookMin,
      targetCount: null,
      priority: 0,
      originRefType: originRefType.chapter,
      originRefId: primaryChapterId ?? String(primary.chapterNo),
    });
    links.push({
      id: randomUUID(),
      taskId: noteRow.id,
      chapterId: primaryChapterId,
      docId: params.docIdByChapterNo.get(primary.chapterNo) ?? null,
      metadataJson: chapterLinkMetadata(primary),
      sortOrder: 0,
    });
  }

  if (durations.customMin !== null && primary) {
    pushTask({
      id: randomUUID(),
      taskType: taskType.customTask,
      title: `خروجی الگوریتم / one-pager — فصل ${primary.chapterNo}`,
      description: `${durations.customMin} دقیقه تبدیل high-yield فصل به Image-Occlusion یا یک صفحه‌ای.`,
      estimatedMinutes: durations.customMin,
      targetCount: null,
      priority: 0,
      originRefType: originRefType.chapter,
      originRefId: params.chapterIdByNo.get(primary.chapterNo) ?? String(primary.chapterNo),
    });
  }

  return { tasks, links };
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

function validateStatic(): void {
  const EXPECTED_CHAPTER_COUNT = 131;
  if (INCLUDED_CHAPTER_NOS.length !== EXPECTED_CHAPTER_COUNT) {
    throw new Error(`INCLUDED_CHAPTER_NOS length = ${INCLUDED_CHAPTER_NOS.length}, expected ${EXPECTED_CHAPTER_COUNT}`);
  }
  if (CHAPTERS.length !== EXPECTED_CHAPTER_COUNT) {
    throw new Error(`CHAPTERS length = ${CHAPTERS.length}, expected ${EXPECTED_CHAPTER_COUNT}`);
  }
  if (WEEKS.length !== TOTAL_WEEKS) {
    throw new Error(`WEEKS length = ${WEEKS.length}, expected ${TOTAL_WEEKS}`);
  }

  // Ensure the deliberately-removed chapters are not reintroduced anywhere.
  const includedSet = new Set(INCLUDED_CHAPTER_NOS);
  for (const c of REMOVED_CHAPTER_NOS) {
    if (includedSet.has(c)) throw new Error(`Removed chapter ${c} reappeared in INCLUDED_CHAPTER_NOS`);
    if (CHAPTERS_BY_NO.has(c)) throw new Error(`Removed chapter ${c} still present in CHAPTERS registry`);
  }

  const included = new Set(INCLUDED_CHAPTER_NOS);
  const weekChapters: number[] = [];
  for (const w of WEEKS) {
    if (!ALLOWED_PATTERNS.has(w.pattern)) {
      throw new Error(`Week ${w.w} pattern ${w.pattern} not allowed`);
    }
    for (const c of w.chapters) {
      if (REMOVED_CHAPTER_NOS.includes(c)) {
        throw new Error(`Week ${w.w} references removed chapter ${c}`);
      }
      if (!included.has(c)) {
        throw new Error(`Week ${w.w} references chapter ${c} not in INCLUDED_CHAPTER_NOS`);
      }
      weekChapters.push(c);
    }
  }
  if (weekChapters.length !== EXPECTED_CHAPTER_COUNT) {
    throw new Error(`WEEKS cover ${weekChapters.length} chapters, expected ${EXPECTED_CHAPTER_COUNT}`);
  }
  const a = [...weekChapters].sort((x, y) => x - y);
  const b = [...INCLUDED_CHAPTER_NOS].sort((x, y) => x - y);
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      throw new Error(`WEEKS flattened ≠ INCLUDED_CHAPTER_NOS at index ${i}`);
    }
  }
  for (const ch of INCLUDED_CHAPTER_NOS) {
    if (!CHAPTERS_BY_NO.has(ch)) {
      throw new Error(`CHAPTERS registry missing chapter ${ch}`);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* goalJson                                                                    */
/* -------------------------------------------------------------------------- */

function buildGoalJson(): Record<string, unknown> {
  const adaptationRules: readonly string[] = [
    "If weekly qbank accuracy < 70% → insert weak_area_review (90min) into next week's Friday block",
    "If FSRS retention < 85% → reduce new cards to 15/day for next 7 days",
    "If daily estimatedMinutes exceeds 450 → split chapter across next day",
    "If chapter_read actualMinutes > 1.3× estimated → downgrade next chapter in same tier to skim",
  ];
  return {
    planKey: PLAN_ID,
    sourceBook: "Campbell-Walsh-Wein",
    sourceEdition: "13",
    phases: WEEKS.map((w) => w.phase),
    weeks: WEEKS.map((w, i) => ({
      weekNumber: w.w,
      phase: w.phase,
      pattern: w.pattern,
      chapters: [...w.chapters],
      // Final week (13) is the taper — stricter QBank target, no new notes.
      kpi: i >= TOTAL_WEEKS - 1
        ? {
          qbankTargetPercent: 80,
          fsrsRetentionTargetPercent: 85,
          notesOutput: "review only",
        }
        : {
          qbankTargetPercent: 70,
          fsrsRetentionTargetPercent: 85,
          notesOutput:
            "1 Persian one-pager per chapter (HOT-tier only) + all high-yield algorithms as Image-Occlusion cards",
        },
      adaptationRules: [...adaptationRules],
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  validateStatic();
  console.log(`✓ static validation passed (WEEKS × ${INCLUDED_CHAPTER_NOS.length} chapters)`);

  const db = await getDb();

  const chapterRows = await db
    .select({ id: chapters.id, chapterNo: chapters.chapterNo })
    .from(chapters)
    .where(inArray(chapters.chapterNo, [...INCLUDED_CHAPTER_NOS]));
  const chapterIdByNo = new Map<number, string>();
  for (const r of chapterRows) chapterIdByNo.set(r.chapterNo, r.id);

  const docRows = await db
    .select({
      chapterNo: noteDocuments.chapterNo,
      docId: noteDocuments.docId,
      generatedAt: noteDocuments.generatedAt,
    })
    .from(noteDocuments)
    .where(inArray(noteDocuments.chapterNo, [...INCLUDED_CHAPTER_NOS]))
    .orderBy(desc(noteDocuments.generatedAt));
  const docIdByChapterNo = new Map<number, string>();
  for (const r of docRows) {
    if (!docIdByChapterNo.has(r.chapterNo)) docIdByChapterNo.set(r.chapterNo, r.docId);
  }

  console.log(
    `✓ lookups: ${chapterIdByNo.size}/${INCLUDED_CHAPTER_NOS.length} chapters, ${docIdByChapterNo.size}/${INCLUDED_CHAPTER_NOS.length} note-docs resolved`,
  );

  // Always build the 98-day calendar; the last 7 days are only used if week 14 is activated.
  const calendar = buildCalendar(PLAN_META.startDate, MAX_TOTAL_DAYS);

  // Sequential pack with cross-week carry. Each week's overflow cascades into next week's Saturday.
  const spillLog: SpillEntry[] = [];
  const packs: WeekPack[] = [];
  let carry: readonly DayChapter[] = [];
  for (let i = 0; i < WEEKS.length; i++) {
    const pack = packWeek(i, WEEKS[i], calendar, carry, spillLog);
    packs.push(pack);
    carry = pack.carryOut;
  }

  // Week-14 conditional fallback (spec §5): if any slice remains unassigned after week 13,
  // extend the plan by 7 days instead of throwing. Carry lands on week-14 Saturday.
  const overflowMinutes = carry.reduce((a, c) => a + c.minutes, 0);
  const planExtendedToWeek14 = carry.length > 0;
  const week14CarryIn: readonly DayChapter[] = planExtendedToWeek14 ? carry : [];
  if (planExtendedToWeek14) {
    console.log(
      `⚠️  planExtendedToWeek14: true — ${carry.length} slices / ${overflowMinutes} minutes from week 13 spill into a new week 14. Last day shifts to 2025-07-24.`,
    );
    for (const s of carry) {
      spillLog.push({
        fromWeek: 13,
        toWeek: 14,
        target: "next-week-saturday",
        chapterNo: s.chapterNo,
        sliceIndex: s.sliceIndex,
        sliceCount: s.sliceCount,
        minutes: s.minutes,
      });
    }
    carry = [];
  }

  const effectiveTotalDays = planExtendedToWeek14 ? MAX_TOTAL_DAYS : BASE_TOTAL_DAYS;
  const effectiveTotalWeeks = planExtendedToWeek14 ? MAX_TOTAL_WEEKS : BASE_TOTAL_WEEKS;

  const dayRows: Array<{
    id: string;
    planId: string;
    date: string;
    dayOfWeek: DowLiteral;
    label: string | null;
    isRestDay: number;
    totalTasks: number;
    estimatedMinutes: number;
    targetMinutes: number;
    assignedMinutes: number;
    status: (typeof planDayStatus)[keyof typeof planDayStatus];
  }> = [];
  const taskRows: TaskRow[] = [];
  const linkRows: LinkRow[] = [];

  const planDayIdByIndex = new Map<number, string>();
  for (const day of calendar) planDayIdByIndex.set(day.index, randomUUID());

  let daysBelowSoft = 0;
  let daysAboveSoft = 0;
  const daysOutsideSpecRange: Array<{ date: string; weekIndex: number; minutes: number }> = [];

  for (let weekIdx = 0; weekIdx < TOTAL_WEEKS; weekIdx++) {
    const pack = packs[weekIdx];
    const weekDef = WEEKS[weekIdx];
    // Per spec §6: custom_task gating is now PER-DAY (HOT primary), not per-week.
    // buildDayTasks evaluates this itself — we pass true and let it check the primary tier.
    const enableCustomTask = true;

    for (let si = 0; si < pack.studyDays.length; si++) {
      const day = pack.studyDays[si];
      const dayId = planDayIdByIndex.get(day.index)!;
      const { tasks, links } = buildDayTasks({
        planId: PLAN_ID,
        dayId,
        iso: day.iso,
        weekIndex: weekIdx,
        weekPhase: weekDef.phase,
        isAuditDay: false,
        chaptersForDay: pack.dayChapters[si],
        enableCustomTask,
        chapterIdByNo,
        docIdByChapterNo,
      });
      const dayMinutes = tasks.reduce((a, t) => a + t.estimatedMinutes, 0);
      if (dayMinutes < HARD_THROW_MIN || dayMinutes > HARD_THROW_MAX) {
        throw new Error(
          `Day ${day.iso} (w${weekIdx + 1}) minutes=${dayMinutes} outside [${HARD_THROW_MIN},${HARD_THROW_MAX}]`,
        );
      }
      if (dayMinutes < SOFT_WARN_MIN || dayMinutes > SOFT_WARN_MAX) {
        daysOutsideSpecRange.push({ date: day.iso, weekIndex: weekIdx + 1, minutes: dayMinutes });
      }
      if (dayMinutes < SOFT_WARN_MIN) daysBelowSoft++;
      if (dayMinutes > SOFT_WARN_MAX) daysAboveSoft++;
      taskRows.push(...tasks);
      linkRows.push(...links);
      dayRows.push({
        id: dayId,
        planId: PLAN_ID,
        date: day.iso,
        dayOfWeek: day.dow,
        label: `${day.jalaliLabel} — ${weekDef.phase}`,
        isRestDay: 0,
        totalTasks: tasks.length,
        estimatedMinutes: dayMinutes,
        targetMinutes: PLAN_META.dailyTimeBudgetMin,
        assignedMinutes: dayMinutes,
        status: planDayStatus.scheduled,
      });
    }

    {
      const day = pack.auditDay;
      const dayId = planDayIdByIndex.get(day.index)!;
      const { tasks, links } = buildDayTasks({
        planId: PLAN_ID,
        dayId,
        iso: day.iso,
        weekIndex: weekIdx,
        weekPhase: weekDef.phase,
        isAuditDay: true,
        chaptersForDay: [],
        auditOverflow: pack.auditOverflow,
        enableCustomTask: false,
        chapterIdByNo,
        docIdByChapterNo,
      });
      const dayMinutes = tasks.reduce((a, t) => a + t.estimatedMinutes, 0);
      // Audit days are now INSIDE [320,540] per spec §3 (was treated as excursion before).
      if (dayMinutes < HARD_THROW_MIN || dayMinutes > HARD_THROW_MAX) {
        throw new Error(
          `Audit day ${day.iso} (w${weekIdx + 1}) minutes=${dayMinutes} outside [${HARD_THROW_MIN},${HARD_THROW_MAX}]`,
        );
      }
      if (dayMinutes < SOFT_WARN_MIN || dayMinutes > SOFT_WARN_MAX) {
        daysOutsideSpecRange.push({ date: day.iso, weekIndex: weekIdx + 1, minutes: dayMinutes });
      }
      if (dayMinutes < SOFT_WARN_MIN) daysBelowSoft++;
      if (dayMinutes > SOFT_WARN_MAX) daysAboveSoft++;
      taskRows.push(...tasks);
      linkRows.push(...links);
      dayRows.push({
        id: dayId,
        planId: PLAN_ID,
        date: day.iso,
        dayOfWeek: day.dow,
        label: `${day.jalaliLabel} — جمع‌بندی (${weekDef.phase})`,
        isRestDay: 0,
        totalTasks: tasks.length,
        estimatedMinutes: dayMinutes,
        targetMinutes: PLAN_META.dailyTimeBudgetMin,
        assignedMinutes: dayMinutes,
        status: planDayStatus.scheduled,
      });
    }
  }

  // ---- Week 14 fallback (conditional) ---------------------------------------------------
  // Emits 6 study days of targeted review tasks (HOT chapters from weeks 1-7) + 1 Thursday audit day.
  // Any week-13 carry-in lands on week-14 Saturday as chapter_read tasks.
  if (planExtendedToWeek14) {
    const week14Days = calendar.slice(BASE_TOTAL_DAYS, MAX_TOTAL_DAYS);
    const auditDay14 = week14Days.find((d) => d.isAuditDay) ?? week14Days[week14Days.length - 1];
    const studyDays14 = week14Days.filter((d) => d !== auditDay14);

    // HOT chapters drawn from weeks 1-7 (prostate, peds, bladder, kidney).
    const hotFromWeeks1to7: number[] = [];
    for (let i = 0; i < 7; i++) {
      for (const cno of WEEKS[i].chapters) {
        if (TIER_HOT.has(cno)) hotFromWeeks1to7.push(cno);
      }
    }

    for (let si = 0; si < studyDays14.length; si++) {
      const day = studyDays14[si];
      const dayId = planDayIdByIndex.get(day.index)!;
      const tasks14: TaskRow[] = [];
      const links14: LinkRow[] = [];
      let sort14 = 0;
      const push14 = (t: Omit<TaskRow, "planId" | "dayId" | "scheduledFor" | "sortOrder" | "sourceType" | "status" | "resultJson">): TaskRow => {
        const row: TaskRow = {
          ...t,
          planId: PLAN_ID,
          dayId,
          scheduledFor: day.iso,
          sortOrder: sort14++,
          sourceType: taskSourceType.manual,
          status: taskStatus.pending,
          resultJson: null,
        };
        tasks14.push(row);
        return row;
      };

      // Overflow chapter_read slices from week 13 → week-14 Saturday (studyDays14[1]).
      if (si === 1 && week14CarryIn.length > 0) {
        for (const ch of week14CarryIn) {
          const chapterId = chapterIdByNo.get(ch.chapterNo) ?? null;
          const sliceSuffix = ch.sliceCount > 1 ? ` — بخش ${ch.sliceIndex}/${ch.sliceCount}` : "";
          const row = push14({
            id: randomUUID(),
            taskType: taskType.chapterRead,
            title: `فصل ${ch.chapterNo}${sliceSuffix} — ${ch.title} (pp ${ch.pagesStart}-${ch.pagesEnd}) [w14 overflow]`,
            description: `Overflow از هفته ۱۳ — ${ch.pages} صفحه، tier ${ch.tier}.`,
            estimatedMinutes: ch.minutes,
            targetCount: ch.pages,
            priority: ch.tier === "hot" ? 2 : ch.tier === "low" ? 0 : 1,
            originRefType: originRefType.chapter,
            originRefId: chapterId ?? String(ch.chapterNo),
          });
          links14.push({
            id: randomUUID(),
            taskId: row.id,
            chapterId,
            docId: docIdByChapterNo.get(ch.chapterNo) ?? null,
            metadataJson: chapterLinkMetadata(ch),
            sortOrder: 0,
          });
        }
      }

      // 2 HOT-chapter notebook reviews, cycling through the week-1-to-7 HOT list.
      const hot1 = hotFromWeeks1to7[(si * 2) % hotFromWeeks1to7.length];
      const hot2 = hotFromWeeks1to7[(si * 2 + 1) % hotFromWeeks1to7.length];
      for (const hotCno of [hot1, hot2]) {
        const meta = CHAPTERS_BY_NO.get(hotCno);
        const title = meta ? meta.title : `فصل ${hotCno}`;
        const chapterId = chapterIdByNo.get(hotCno) ?? null;
        const row = push14({
          id: randomUUID(),
          taskType: taskType.notebookReview,
          title: `Week 14 — بازخوانی یادداشت HOT فصل ${hotCno} (${title})`,
          description: "۸۰ دقیقه مرور one-pager فارسی + الگوریتم‌های کلیدی.",
          estimatedMinutes: 80,
          targetCount: null,
          priority: 2,
          originRefType: originRefType.chapter,
          originRefId: chapterId ?? String(hotCno),
        });
        links14.push({
          id: randomUUID(),
          taskId: row.id,
          chapterId,
          docId: docIdByChapterNo.get(hotCno) ?? null,
          metadataJson: JSON.stringify({ chapterNo: hotCno, week14Review: true }),
          sortOrder: 0,
        });
      }

      // Flashcard review, question block, weak-area review — each 80 min.
      push14({
        id: randomUUID(),
        taskType: taskType.flashcardReview,
        title: "Week 14 — FSRS مرور گسترده HOT کارت‌ها",
        description: "۸۰ دقیقه صف FSRS، فقط HOT-tier.",
        estimatedMinutes: 80,
        targetCount: null,
        priority: 1,
        originRefType: originRefType.flashcard,
        originRefId: `${PLAN_ID}:w14:${day.iso}:fsrs`,
      });
      push14({
        id: randomUUID(),
        taskType: taskType.questionBlock,
        title: "Week 14 — ۳۰ سؤال QBank HOT ترکیبی",
        description: "۸۰ دقیقه، سؤالات QBank از فصل‌های HOT هفته ۱ تا ۷.",
        estimatedMinutes: 80,
        targetCount: 30,
        priority: 1,
        originRefType: originRefType.question,
        originRefId: `${PLAN_ID}:w14:${day.iso}:qbank-hot`,
      });
      push14({
        id: randomUUID(),
        taskType: taskType.weakAreaReview,
        title: "Week 14 — مرور نقاط ضعف ۱۳ هفته گذشته",
        description: "۸۰ دقیقه مرور موضوعاتی که در QBank هفتگی زیر ۷۰٪ دقت داشتی.",
        estimatedMinutes: 80,
        targetCount: null,
        priority: 2,
        originRefType: originRefType.weakArea,
        originRefId: `${PLAN_ID}:w14:${day.iso}:weak`,
      });

      const dayMinutes = tasks14.reduce((a, t) => a + t.estimatedMinutes, 0);
      if (dayMinutes < SOFT_WARN_MIN || dayMinutes > SOFT_WARN_MAX) {
        daysOutsideSpecRange.push({ date: day.iso, weekIndex: 14, minutes: dayMinutes });
      }
      if (dayMinutes < SOFT_WARN_MIN) daysBelowSoft++;
      if (dayMinutes > SOFT_WARN_MAX) daysAboveSoft++;
      taskRows.push(...tasks14);
      linkRows.push(...links14);
      dayRows.push({
        id: dayId,
        planId: PLAN_ID,
        date: day.iso,
        dayOfWeek: day.dow,
        label: `${day.jalaliLabel} — هفته ۱۴ (مرور تقویتی)`,
        isRestDay: 0,
        totalTasks: tasks14.length,
        estimatedMinutes: dayMinutes,
        targetMinutes: PLAN_META.dailyTimeBudgetMin,
        assignedMinutes: dayMinutes,
        status: planDayStatus.scheduled,
      });
    }

    // Week-14 audit day (Thu): 100-MCQ exam block + analysis.
    {
      const day = auditDay14;
      const dayId = planDayIdByIndex.get(day.index)!;
      const tasks14: TaskRow[] = [];
      let sort14 = 0;
      const push14 = (t: Omit<TaskRow, "planId" | "dayId" | "scheduledFor" | "sortOrder" | "sourceType" | "status" | "resultJson">): TaskRow => {
        const row: TaskRow = {
          ...t,
          planId: PLAN_ID,
          dayId,
          scheduledFor: day.iso,
          sortOrder: sort14++,
          sourceType: taskSourceType.manual,
          status: taskStatus.pending,
          resultJson: null,
        };
        tasks14.push(row);
        return row;
      };
      push14({
        id: randomUUID(),
        taskType: taskType.examBlock,
        title: "Week 14 — آزمون نهایی شبیه‌ساز ۱۰۰ سؤال",
        description: "۱۲۰ دقیقه، ۱۰۰ MCQ ترکیبی از تمام فصل‌های HOT هفته ۱ تا ۱۳.",
        estimatedMinutes: 120,
        targetCount: 100,
        priority: 2,
        originRefType: originRefType.question,
        originRefId: `${PLAN_ID}:w14:final-exam`,
      });
      push14({
        id: randomUUID(),
        taskType: taskType.notebookReview,
        title: "Week 14 — تحلیل پاسخ‌های آزمون + مرور اشتباهات",
        description: "۶۰ دقیقه آنالیز پاسخ‌های غلط و تثبیت الگوریتم‌ها.",
        estimatedMinutes: 60,
        targetCount: null,
        priority: 1,
        originRefType: originRefType.document,
        originRefId: `${PLAN_ID}:w14:exam-analysis`,
      });
      push14({
        id: randomUUID(),
        taskType: taskType.flashcardReview,
        title: "Week 14 — FSRS آخرین مرور HOT",
        description: "۶۰ دقیقه مرور صف HOT قبل از آزمون واقعی.",
        estimatedMinutes: 60,
        targetCount: null,
        priority: 1,
        originRefType: originRefType.flashcard,
        originRefId: `${PLAN_ID}:w14:final-fsrs`,
      });

      const dayMinutes = tasks14.reduce((a, t) => a + t.estimatedMinutes, 0);
      if (dayMinutes < SOFT_WARN_MIN || dayMinutes > SOFT_WARN_MAX) {
        daysOutsideSpecRange.push({ date: day.iso, weekIndex: 14, minutes: dayMinutes });
      }
      if (dayMinutes < SOFT_WARN_MIN) daysBelowSoft++;
      if (dayMinutes > SOFT_WARN_MAX) daysAboveSoft++;
      taskRows.push(...tasks14);
      dayRows.push({
        id: dayId,
        planId: PLAN_ID,
        date: day.iso,
        dayOfWeek: day.dow,
        label: `${day.jalaliLabel} — هفته ۱۴ (آزمون نهایی)`,
        isRestDay: 0,
        totalTasks: tasks14.length,
        estimatedMinutes: dayMinutes,
        targetMinutes: PLAN_META.dailyTimeBudgetMin,
        assignedMinutes: dayMinutes,
        status: planDayStatus.scheduled,
      });
    }
  }

  if (dayRows.length !== effectiveTotalDays) {
    throw new Error(`dayRows length = ${dayRows.length}, expected ${effectiveTotalDays}`);
  }

  // Hard throw: any day outside HARD_THROW_MIN..HARD_THROW_MAX (240..620) is a blowup — catch here.
  for (const r of dayRows) {
    if (r.estimatedMinutes < HARD_THROW_MIN || r.estimatedMinutes > HARD_THROW_MAX) {
      throw new Error(`Day ${r.date} minutes=${r.estimatedMinutes} outside HARD range [${HARD_THROW_MIN},${HARD_THROW_MAX}]`);
    }
  }

  // Fail-loudly: no week may have scale < 1.0 (spec §7).
  for (const p of packs) {
    if (p.scaleFactor < 1) {
      throw new Error(`Week ${p.weekIndex + 1} has scaleFactor ${p.scaleFactor} < 1.0 — content drop forbidden`);
    }
  }

  // Spills are informational — logged and reported. Week-14 fallback absorbs any residual carry past week 13.

  const usedTaskTypes = new Set(taskRows.map((t) => t.taskType));
  const allowed = new Set<string>(Object.values(taskType));
  for (const tt of usedTaskTypes) {
    if (!allowed.has(tt)) throw new Error(`Disallowed taskType: ${tt}`);
  }

  // dayRows are appended in per-week (study-days then audit-day) order, so the last-pushed row
  // is the final week's audit day (Friday), not the chronologically last day. Sort by date for report values.
  const sortedIsos = dayRows.map((r) => r.date).sort();
  const firstIso = sortedIsos[0];
  const lastIso = sortedIsos[sortedIsos.length - 1];
  const goalJson = buildGoalJson();

  const preDays = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(studyPlanDays)
    .where(eq(studyPlanDays.planId, PLAN_ID));
  const preTasks = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(studyTasks)
    .where(eq(studyTasks.planId, PLAN_ID));
  const preLinks = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(studyTaskLinks)
    .innerJoin(studyTasks, eq(studyTaskLinks.taskId, studyTasks.id))
    .where(eq(studyTasks.planId, PLAN_ID));
  const preCounts = {
    days: preDays[0]?.c ?? 0,
    tasks: preTasks[0]?.c ?? 0,
    links: preLinks[0]?.c ?? 0,
  };

  await db.transaction(async (tx) => {
    await tx.delete(studyPlans).where(eq(studyPlans.id, PLAN_ID));

    const selectedChapterIds = [...INCLUDED_CHAPTER_NOS]
      .map((n) => chapterIdByNo.get(n))
      .filter((v): v is string => typeof v === "string");

    await tx.insert(studyPlans).values({
      id: PLAN_ID,
      title: PLAN_META.title,
      description: PLAN_META.description,
      status: planStatus.active,
      startDate: PLAN_META.startDate,
      endDate: lastIso,
      selectedChapterIdsJson: JSON.stringify(selectedChapterIds) as unknown as string[] | null,
      goalJson: JSON.stringify(goalJson) as unknown as Record<string, unknown> | null,
      repeatPattern: PLAN_META.repeatPattern,
      totalTasks: taskRows.length,
      completedTasks: 0,
      progressPercent: 0,
      examDate: PLAN_META.examDate,
      targetMode: targetMode.examPrep,
      dailyTimeBudgetMin: PLAN_META.dailyTimeBudgetMin,
    });

    const dayInsertValues = dayRows.map((r) => ({
      id: r.id,
      planId: r.planId,
      date: r.date,
      dayOfWeek: r.dayOfWeek,
      label: r.label,
      isRestDay: r.isRestDay,
      totalTasks: r.totalTasks,
      estimatedMinutes: r.estimatedMinutes,
      targetMinutes: r.targetMinutes,
      assignedMinutes: r.assignedMinutes,
      status: r.status,
    }));

    for (let i = 0; i < dayInsertValues.length; i += 500) {
      await tx.insert(studyPlanDays).values(dayInsertValues.slice(i, i + 500));
    }

    const taskInsertValues = taskRows.map((t) => ({
      id: t.id,
      planId: t.planId,
      dayId: t.dayId,
      taskType: t.taskType,
      status: t.status,
      title: t.title,
      description: t.description,
      sortOrder: t.sortOrder,
      estimatedMinutes: t.estimatedMinutes,
      targetCount: t.targetCount,
      priority: t.priority,
      scheduledFor: t.scheduledFor,
      originRefType: t.originRefType,
      originRefId: t.originRefId,
      sourceType: t.sourceType,
      resultJson: t.resultJson as unknown as Record<string, unknown> | null,
    }));

    for (let i = 0; i < taskInsertValues.length; i += 500) {
      await tx.insert(studyTasks).values(taskInsertValues.slice(i, i + 500));
    }

    const linkInsertValues = linkRows.map((l) => ({
      id: l.id,
      taskId: l.taskId,
      chapterId: l.chapterId,
      docId: l.docId,
      metadataJson: l.metadataJson as unknown as Record<string, unknown> | null,
      sortOrder: l.sortOrder,
    }));

    for (let i = 0; i < linkInsertValues.length; i += 500) {
      await tx.insert(studyTaskLinks).values(linkInsertValues.slice(i, i + 500));
    }
  });

  const postDays = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(studyPlanDays)
    .where(eq(studyPlanDays.planId, PLAN_ID));
  const postTasks = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(studyTasks)
    .where(eq(studyTasks.planId, PLAN_ID));
  const postLinks = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(studyTaskLinks)
    .innerJoin(studyTasks, eq(studyTaskLinks.taskId, studyTasks.id))
    .where(eq(studyTasks.planId, PLAN_ID));
  const postCounts = {
    days: postDays[0]?.c ?? 0,
    tasks: postTasks[0]?.c ?? 0,
    links: postLinks[0]?.c ?? 0,
  };

  const auditDates = packs.map((p) => p.auditDay.iso);
  if (planExtendedToWeek14) {
    // Append the week-14 Thursday audit date (last day of the extended plan).
    auditDates.push(lastIso);
  }
  const dayIndexByIso = new Map<string, number>();
  dayRows.forEach((r, idx) => dayIndexByIso.set(r.date, idx));
  const tasksPerWeek = packs.map((p) => {
    const weekStart = p.weekIndex * 7;
    const weekEnd = weekStart + 7;
    let count = 0;
    for (const t of taskRows) {
      const idx = dayIndexByIso.get(t.scheduledFor);
      if (idx !== undefined && idx >= weekStart && idx < weekEnd) count++;
    }
    return { week: p.weekIndex + 1, tasks: count };
  });
  if (planExtendedToWeek14) {
    const w14Start = BASE_TOTAL_DAYS;
    const w14End = MAX_TOTAL_DAYS;
    let count = 0;
    for (const t of taskRows) {
      const idx = dayIndexByIso.get(t.scheduledFor);
      if (idx !== undefined && idx >= w14Start && idx < w14End) count++;
    }
    tasksPerWeek.push({ week: 14, tasks: count });
  }

  // Per-week reading minutes = sum of chapter_read estimatedMinutes per week.
  const readingMinPerWeek = packs.map((p) => {
    const weekStart = p.weekIndex * 7;
    const weekEnd = weekStart + 7;
    let mins = 0;
    for (const t of taskRows) {
      if (t.taskType !== taskType.chapterRead) continue;
      const idx = dayIndexByIso.get(t.scheduledFor);
      if (idx !== undefined && idx >= weekStart && idx < weekEnd) mins += t.estimatedMinutes;
    }
    return { week: p.weekIndex + 1, readingMinutes: mins };
  });
  if (planExtendedToWeek14) {
    const w14Start = BASE_TOTAL_DAYS;
    const w14End = MAX_TOTAL_DAYS;
    let mins = 0;
    for (const t of taskRows) {
      if (t.taskType !== taskType.chapterRead) continue;
      const idx = dayIndexByIso.get(t.scheduledFor);
      if (idx !== undefined && idx >= w14Start && idx < w14End) mins += t.estimatedMinutes;
    }
    readingMinPerWeek.push({ week: 14, readingMinutes: mins });
  }

  const studyDayMinutesList = dayRows
    .filter((r) => !auditDates.includes(r.date))
    .map((r) => r.estimatedMinutes);
  const studyDaysAbove540Count = studyDayMinutesList.filter((m) => m > 540).length;
  const studyDaysAbove620Count = studyDayMinutesList.filter((m) => m > 620).length;
  const maxStudyDayMinutes = studyDayMinutesList.reduce((m, x) => Math.max(m, x), 0);
  const minStudyDayMinutes = studyDayMinutesList.reduce((m, x) => Math.min(m, x), Infinity);

  console.log(`\n=== SEED SUMMARY (${effectiveTotalWeeks}-WEEK ${planExtendedToWeek14 ? "EXTENDED" : "COMPRESSED"}) ===`);
  console.log(
    JSON.stringify(
      {
        planId: PLAN_ID,
        planExtendedToWeek14,
        overflowMinutes,
        firstDay: firstIso,
        lastDay: lastIso,
        totalDays: dayRows.length,
        totalWeeks: effectiveTotalWeeks,
        totalAuditDays: auditDates.length,
        firstAuditDay: auditDates[0],
        secondAuditDay: auditDates[1],
        firstNormalFridayAudit: auditDates.slice(1).find((iso) => {
          const d = isoToUtcDate(iso);
          return DOW_BY_INDEX[d.getUTCDay()] === dayOfWeek.friday;
        }) ?? null,
        days: dayRows.length,
        tasks: taskRows.length,
        links: linkRows.length,
        auditDaysVsTotal: `${auditDates.length}/${effectiveTotalWeeks}`,
        auditDateSequence: auditDates,
        weeksValidated: true,
        preRunCounts: preCounts,
        postRunCounts: postCounts,
        postMatchesSeed:
          postCounts.days === dayRows.length
          && postCounts.tasks === taskRows.length
          && postCounts.links === linkRows.length,
        resolvedChapterIds: chapterIdByNo.size,
        resolvedDocIds: docIdByChapterNo.size,
        daysBelow300: daysBelowSoft,
        daysAbove540: daysAboveSoft,
        daysOutside_300_540_count: daysOutsideSpecRange.length,
        daysOutside_300_540: daysOutsideSpecRange,
        studyDaysAbove540: studyDaysAbove540Count,
        studyDaysAbove620: studyDaysAbove620Count,
        maxDayMinutes: dayRows.reduce((m, r) => Math.max(m, r.estimatedMinutes), 0),
        maxStudyDayMinutes,
        minStudyDayMinutes,
        scaleFactors: packs.map((p) => Number(p.scaleFactor.toFixed(3))),
        spillChain: spillLog,
        spillCount: spillLog.length,
        tasksPerWeek,
        readingMinPerWeek,
        unresolvedChapterIds_count: INCLUDED_CHAPTER_NOS.filter((n) => !chapterIdByNo.has(n)).length,
        unresolvedDocChapterNos_count: INCLUDED_CHAPTER_NOS.filter((n) => !docIdByChapterNo.has(n)).length,
        unresolvedChapterIds_total: INCLUDED_CHAPTER_NOS.length,
        unresolvedDocIds_total: INCLUDED_CHAPTER_NOS.length,
      },
      null,
      2,
    ),
  );

  // Final hard stop if any study day exceeds HARD_THROW_MAX=620 (already covered upstream, but
  // spec §Required report says "Study days > 620 must be 0 — if nonzero, halt").
  if (studyDaysAbove620Count > 0) {
    throw new Error(`studyDaysAbove620 = ${studyDaysAbove620Count} — halt per spec (max=${maxStudyDayMinutes})`);
  }
}

function cleanupPGliteLock(): void {
  try {
    const dir = process.env.PGLITE_DATA_DIR ?? process.env.PGLITE_DB_PATH ?? join(process.cwd(), ".pglite", "uro-omega");
    const pid = join(dir, "postmaster.pid");
    if (existsSync(pid)) rmSync(pid);
  } catch {
    // swallow — stale lock cleanup is best-effort
  }
}

main()
  .then(() => {
    cleanupPGliteLock();
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    cleanupPGliteLock();
    process.exit(1);
  });
