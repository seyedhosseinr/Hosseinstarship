#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * ABU Board Prep — Campbell-Walsh 2026 (v2 replacement, 10-week rank-one sprint) seed.
 *
 * Replaces the previous abu-2026-v2 plan in-place.
 * Start reality: 2026-05-12, 19:00, user has started chapter 94.
 * First task is chapter 94. Task titles include exact clock windows.
 *
 * Run:
 *   DB_RUNTIME=pglite npx tsx --tsconfig tsconfig.json src/db/seed-abu-2026-v2.ts
 */

import * as nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());

process.env.PG_CONNECTION_TIMEOUT_MS ??= "60000";
process.env.PG_IDLE_TIMEOUT_MS ??= "30000";
process.env.PG_POOL_MAX ??= "2";

import { createHash, randomUUID } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/db/index";
import { getPGliteLocation } from "@/db/config";
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

const PLAN_ID = "abu-2026-v2";
const TOTAL_DAYS = 70;
const TOTAL_WEEKS = 10;

const PLAN_META = {
  id: PLAN_ID,
  title: "ABU Board Prep — 10-Week Rank-One Sprint از فصل ۹۴",
  description:
    "Replacement for abu-2026-v2. Starts 2026-05-12 at 19:00 from chapter 94, then continues by ABU-board weight: trauma/stones → oncology → FPMRS → pediatrics → male/core → mock/weak repair. Clock windows are embedded in task titles.",
  startDate: "2026-05-12",
  examDate: "2026-08-27",
  totalWeeks: TOTAL_WEEKS,
  totalDays: TOTAL_DAYS,
  dailyTimeBudgetMin: 660,
  eveningKickoffBudgetMin: 245,
  repeatPattern: "daily_7x_rank_one",
} as const;

const INCLUDED_CHAPTER_NOS: readonly number[] = [
  2, 3, 4, 5, 8, 11, 16, 17, 20, 21, 26, 27,
  28, 31, 32, 34, 35, 36, 37, 38, 40, 41, 42, 43,
  44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55,
  56, 57, 58, 59, 62, 63, 64, 66, 67, 68, 69, 70,
  71, 72, 73, 74, 75, 76, 77, 79, 80, 82, 83, 85,
  86, 87, 92, 94, 95, 96, 97, 98, 99, 100, 104, 105,
  106, 107, 108, 109, 110, 111, 113, 114, 116, 117, 118, 121,
  122, 123, 124, 125, 129, 130, 131, 132, 133, 134, 135, 136,
  137, 139, 140, 141, 144, 146, 147, 149, 150, 151, 152, 153,
  154, 155, 156, 157, 158, 159, 160, 162, 163, 164, 165, 166
];

const REMOVED_CHAPTER_NOS: readonly number[] = [
  6, 7, 12, 13, 14, 15, 22, 25, 29, 30, 78, 88, 90, 101, 102, 103, 112, 119, 120, 128, 145, 148
];

const STUDY_CHAPTER_SEQUENCE: readonly number[] = [
  94, 95, 96, 97, 98, 99, 100, 92, 149, 153, 154, 155,
  156, 157, 158, 159, 160, 150, 151, 152, 162, 163, 164, 165,
  166, 136, 137, 139, 140, 141, 144, 146, 147, 124, 125, 129,
  130, 131, 132, 133, 134, 135, 104, 105, 106, 107, 108, 109,
  110, 111, 113, 114, 116, 117, 118, 121, 122, 123, 32, 34,
  35, 36, 37, 38, 40, 41, 42, 43, 44, 45, 46, 47,
  48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59,
  62, 63, 64, 66, 67, 68, 69, 70, 71, 72, 73, 74,
  75, 76, 77, 79, 80, 82, 83, 85, 86, 87, 26, 27,
  28, 31, 2, 3, 4, 5, 8, 11, 16, 17, 20, 21
];

const TIER_HOT = new Set<number>([
  94,
  149, 150, 153, 155, 156, 157, 158, 159, 160, 162, 164, 165, 166,
  129, 130, 131, 132, 133, 134,
  41, 43, 45, 46, 48, 49, 50, 52, 56, 57,
  95, 96, 97, 98, 99,
  105, 107, 108, 109, 110, 113, 117, 118, 121,
  136, 137, 144,
  79, 80, 82,
  28,
  8, 20,
  86,
]);

const TIER_LOW = new Set<number>([66]);

type YieldTier = "hot" | "med" | "low";

function tierOf(chapterNo: number): YieldTier {
  if (TIER_HOT.has(chapterNo)) return "hot";
  if (TIER_LOW.has(chapterNo)) return "low";
  return "med";
}

function readingSpeed(chapterNo: number): number {
  if (TIER_HOT.has(chapterNo)) return 5;
  if (TIER_LOW.has(chapterNo)) return 11;
  return 7;
}

function readingMinutes(pages: number, chapterNo: number): number {
  return Math.max(1, Math.round((pages / readingSpeed(chapterNo)) * 60));
}

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
  { no: 8, title: "Evaluation and Management of Hematuria", startPage: 120, endPage: 136, volume: 1, part: "Clinical Decision Making" },
  { no: 11, title: "Perioperative Care in Urologic Surgery", startPage: 150, endPage: 166, volume: 1, part: "Basics of Urologic Surgery" },
  { no: 16, title: "Fundamentals of Upper Urinary Tract Drainage", startPage: 199, endPage: 214, volume: 1, part: "Basics of Urologic Surgery" },
  { no: 17, title: "Principles of Urologic Endoscopy", startPage: 215, endPage: 228, volume: 1, part: "Basics of Urologic Surgery" },
  { no: 20, title: "Complications of Urologic Surgery", startPage: 283, endPage: 306, volume: 1, part: "Basics of Urologic Surgery" },
  { no: 21, title: "Urologic Considerations in Pregnancy", startPage: 307, endPage: 321, volume: 1, part: "Basics of Urologic Surgery" },
  { no: 26, title: "Infections of the Urinary Tract", startPage: 388, endPage: 458, volume: 1, part: "Infections and Inflammation" },
  { no: 27, title: "Inflammatory and Pain Conditions of the Lower Genitourinary Tract", startPage: 459, endPage: 479, volume: 1, part: "Infections and Inflammation" },
  { no: 28, title: "Interstitial Cystitis/Bladder Pain Syndrome and Related Disorders", startPage: 480, endPage: 510, volume: 1, part: "Infections and Inflammation" },
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
  { no: 92, title: "Urologic Complications of Renal Transplantation", startPage: 1903, endPage: 1941, volume: 2, part: "Renal Physiology and Pathophysiology" },
  { no: 94, title: "Upper Urinary Tract Trauma", startPage: 1972, endPage: 2003, volume: 2, part: "Upper Urinary Tract Obstruction and Trauma" },
  { no: 95, title: "Urinary Lithiasis: Etiology, Epidemiology, and Pathogenesis", startPage: 2004, endPage: 2010, volume: 2, part: "Urinary Lithiasis and Endourology" },
  { no: 96, title: "Acute Care of Urinary Lithiasis", startPage: 2011, endPage: 2026, volume: 2, part: "Urinary Lithiasis and Endourology" },
  { no: 97, title: "Surgical Management of Ureteral Calculi", startPage: 2027, endPage: 2048, volume: 2, part: "Urinary Lithiasis and Endourology" },
  { no: 98, title: "Surgical Management of Upper Urinary Tract Calculi", startPage: 2049, endPage: 2058, volume: 2, part: "Urinary Lithiasis and Endourology" },
  { no: 99, title: "Prevention of Urinary Stone Disease", startPage: 2059, endPage: 2066, volume: 2, part: "Urinary Lithiasis and Endourology" },
  { no: 100, title: "Lower Urinary Tract Calculi", startPage: 2067, endPage: 2083, volume: 2, part: "Urinary Lithiasis and Endourology" },
  { no: 104, title: "Pathophysiology and Classification of Lower Urinary Tract Dysfunction", startPage: 2166, endPage: 2179, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 105, title: "Evaluation and Management of Women With Urinary Incontinence and Pelvic Organ Prolapse", startPage: 2180, endPage: 2191, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 106, title: "Evaluation and Management of Males With Urinary Incontinence", startPage: 2192, endPage: 2217, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 107, title: "Urodynamic and Videourodynamic Evaluation of the Lower Urinary Tract", startPage: 2218, endPage: 2237, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 108, title: "Urinary Incontinence and Pelvic Prolapse: Epidemiology and Pathophysiology", startPage: 2238, endPage: 2275, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 109, title: "Neuromuscular Dysfunction of the Lower Urinary Tract", startPage: 2276, endPage: 2289, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 110, title: "Overactive Bladder", startPage: 2290, endPage: 2303, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 111, title: "Underactive Detrusor", startPage: 2304, endPage: 2336, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 113, title: "Pharmacologic Management of LUT Storage and Emptying Failure", startPage: 2373, endPage: 2403, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 114, title: "Conservative Management of Urinary Incontinence", startPage: 2404, endPage: 2415, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 116, title: "Retropubic Suspension Surgery for Incontinence in Females", startPage: 2426, endPage: 2459, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 117, title: "Vaginal and Abdominal Reconstructive Surgery for POP", startPage: 2460, endPage: 2489, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 118, title: "Slings: Autologous, Biologic, Synthetic, and Mid-Urethral", startPage: 2490, endPage: 2502, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 121, title: "Urinary Tract Fistulae", startPage: 2555, endPage: 2583, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 122, title: "Bladder and Female Urethral Diverticula", startPage: 2584, endPage: 2600, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 123, title: "Surgical Procedures for Sphincteric Incontinence in the Male", startPage: 2584, endPage: 2600, volume: 2, part: "Urine Transport, Storage, and Emptying" },
  { no: 124, title: "Bladder Surgery for Benign Disease", startPage: 2601, endPage: 2641, volume: 3, part: "Benign and Malignant Bladder Disorders" },
  { no: 125, title: "Genital and Lower Urinary Tract Trauma", startPage: 2642, endPage: 2654, volume: 3, part: "Benign and Malignant Bladder Disorders" },
  { no: 129, title: "Tumors of the Urinary Bladder", startPage: 2687, endPage: 2706, volume: 3, part: "Benign and Malignant Bladder Disorders" },
  { no: 130, title: "Management Strategies for Non\u2013Muscle-Invasive Bladder Cancer", startPage: 2707, endPage: 2729, volume: 3, part: "Benign and Malignant Bladder Disorders" },
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
  { no: 152, title: "Simple Prostatectomy\u2014Open, Laparoscopic, and Robotic", startPage: 3318, endPage: 3333, volume: 3, part: "The Prostate" },
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
  let days = 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gmInput - 1];
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
  readonly index: number;
  readonly weekIndex: number;
  readonly date: Date;
  readonly iso: string;
  readonly dow: DowLiteral;
  readonly jalaliLabel: string;
}

function buildCalendar(startIso: string): PlanDay[] {
  const start = isoToUtcDate(startIso);
  const days: PlanDay[] = [];
  for (let i = 0; i < TOTAL_DAYS; i++) {
    const d = addDays(start, i);
    const dow = DOW_BY_INDEX[d.getUTCDay()];
    const [jy, jm, jd] = gregorianToJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    days.push({
      index: i,
      weekIndex: Math.floor(i / 7),
      date: d,
      iso: dateToIso(d),
      dow,
      jalaliLabel: `${JALALI_WEEKDAY[dow]} ${toPersianDigits(jd)} ${JALALI_MONTHS[jm - 1]} ${toPersianDigits(jy)}`,
    });
  }
  return days;
}

function toClock(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function clockRange(startMin: number, durationMin: number): string {
  return `${toClock(startMin)}–${toClock(startMin + durationMin)}`;
}

interface ReadingWindow {
  readonly startMin: number;
  readonly durationMin: number;
}

const EVENING_READING_WINDOWS: readonly ReadingWindow[] = [
  { startMin: 19 * 60 + 15, durationMin: 80 },
  { startMin: 20 * 60 + 50, durationMin: 75 },
];

const FULL_DAY_READING_WINDOWS: readonly ReadingWindow[] = [
  { startMin: 7 * 60, durationMin: 140 },
  { startMin: 9 * 60 + 35, durationMin: 140 },
  { startMin: 13 * 60, durationMin: 80 },
  { startMin: 17 * 60 + 30, durationMin: 80 },
];

interface ReadingAssignment {
  readonly dayIndex: number;
  readonly startMin: number;
  readonly durationMin: number;
  readonly chapterNo: number;
  readonly title: string;
  readonly volume: 1 | 2 | 3;
  readonly tier: YieldTier;
  readonly pagesStart: number;
  readonly pagesEnd: number;
  readonly pages: number;
  readonly chapterPages: number;
  readonly chapterMinutes: number;
  readonly sliceIndex: number;
  readonly sliceCount: number;
}

interface MutableAssignment {
  dayIndex: number;
  startMin: number;
  durationMin: number;
  chapterNo: number;
  title: string;
  volume: 1 | 2 | 3;
  tier: YieldTier;
  pagesStart: number;
  pagesEnd: number;
  pages: number;
  chapterPages: number;
  chapterMinutes: number;
  assignedBeforeMin: number;
}

function fractionLabel(sliceIndex: number, sliceCount: number): string {
  if (sliceCount <= 1) return "کل فصل";
  if (sliceCount === 2) return sliceIndex === 1 ? "نیمه اول" : "نیمه دوم";
  if (sliceCount === 3) return ["یک‌سوم اول", "یک‌سوم دوم", "یک‌سوم سوم"][sliceIndex - 1] ?? `بخش ${sliceIndex} از ۳`;
  return `بخش ${toPersianDigits(sliceIndex)} از ${toPersianDigits(sliceCount)}`;
}

function buildReadingAssignments(): ReadingAssignment[] {
  const raw: MutableAssignment[] = [];
  let chapterPointer = 0;
  let currentChapterNo = STUDY_CHAPTER_SEQUENCE[0];
  let currentMeta = CHAPTERS_BY_NO.get(currentChapterNo);
  if (!currentMeta) throw new Error(`Missing chapter metadata for ${currentChapterNo}`);
  let currentPages = currentMeta.endPage - currentMeta.startPage + 1;
  let currentChapterMinutes = readingMinutes(currentPages, currentChapterNo);
  let remainingMin = currentChapterMinutes;
  let assignedInChapterMin = 0;

  for (let dayIndex = 0; dayIndex < TOTAL_DAYS && chapterPointer < STUDY_CHAPTER_SEQUENCE.length; dayIndex++) {
    const windows = dayIndex === 0 ? EVENING_READING_WINDOWS : FULL_DAY_READING_WINDOWS;
    for (const window of windows) {
      let cursor = window.startMin;
      let remainingWindow = window.durationMin;
      while (remainingWindow > 0 && chapterPointer < STUDY_CHAPTER_SEQUENCE.length) {
        const minutes = Math.min(remainingWindow, remainingMin);
        const startFraction = assignedInChapterMin / currentChapterMinutes;
        const endFraction = (assignedInChapterMin + minutes) / currentChapterMinutes;
        const pageStart = currentMeta.startPage + Math.floor(currentPages * startFraction);
        const pageEnd = Math.min(currentMeta.endPage, currentMeta.startPage + Math.max(0, Math.ceil(currentPages * endFraction) - 1));
        raw.push({
          dayIndex,
          startMin: cursor,
          durationMin: minutes,
          chapterNo: currentChapterNo,
          title: currentMeta.title,
          volume: currentMeta.volume,
          tier: tierOf(currentChapterNo),
          pagesStart: pageStart,
          pagesEnd: Math.max(pageStart, pageEnd),
          pages: Math.max(1, Math.max(pageStart, pageEnd) - pageStart + 1),
          chapterPages: currentPages,
          chapterMinutes: currentChapterMinutes,
          assignedBeforeMin: assignedInChapterMin,
        });
        cursor += minutes;
        remainingWindow -= minutes;
        remainingMin -= minutes;
        assignedInChapterMin += minutes;

        if (remainingMin <= 0) {
          chapterPointer++;
          if (chapterPointer >= STUDY_CHAPTER_SEQUENCE.length) break;
          currentChapterNo = STUDY_CHAPTER_SEQUENCE[chapterPointer];
          currentMeta = CHAPTERS_BY_NO.get(currentChapterNo);
          if (!currentMeta) throw new Error(`Missing chapter metadata for ${currentChapterNo}`);
          currentPages = currentMeta.endPage - currentMeta.startPage + 1;
          currentChapterMinutes = readingMinutes(currentPages, currentChapterNo);
          remainingMin = currentChapterMinutes;
          assignedInChapterMin = 0;
        }
      }
    }
  }

  if (chapterPointer < STUDY_CHAPTER_SEQUENCE.length) {
    const remaining = STUDY_CHAPTER_SEQUENCE.slice(chapterPointer);
    throw new Error(`Reading schedule did not finish all chapters. Remaining: ${remaining.join(", ")}`);
  }

  const counts = new Map<number, number>();
  for (const a of raw) counts.set(a.chapterNo, (counts.get(a.chapterNo) ?? 0) + 1);
  const seen = new Map<number, number>();
  return raw.map((a) => {
    const sliceIndex = (seen.get(a.chapterNo) ?? 0) + 1;
    seen.set(a.chapterNo, sliceIndex);
    return {
      dayIndex: a.dayIndex,
      startMin: a.startMin,
      durationMin: a.durationMin,
      chapterNo: a.chapterNo,
      title: a.title,
      volume: a.volume,
      tier: a.tier,
      pagesStart: a.pagesStart,
      pagesEnd: a.pagesEnd,
      pages: a.pages,
      chapterPages: a.chapterPages,
      chapterMinutes: a.chapterMinutes,
      sliceIndex,
      sliceCount: counts.get(a.chapterNo) ?? 1,
    };
  });
}

function phaseForChapter(chapterNo: number): string {
  if ([94, 95, 96, 97, 98, 99, 100, 92].includes(chapterNo)) return "Trauma + Stones kickoff";
  if (chapterNo >= 149 || [136, 137, 139, 140, 141, 144, 146, 147].includes(chapterNo)) return "Major oncology: prostate/kidney/adrenal";
  if ([124, 125, 129, 130, 131, 132, 133, 134, 135].includes(chapterNo)) return "Bladder cancer + diversion";
  if ([104, 105, 106, 107, 108, 109, 110, 111, 113, 114, 116, 117, 118, 121, 122, 123].includes(chapterNo)) return "FPMRS / neurourology / LUT";
  if (chapterNo >= 32 && chapterNo <= 64) return "Pediatric urology";
  if ([66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 79, 80, 82, 83, 85, 86, 87].includes(chapterNo)) return "Andrology + genital oncology";
  return "Core / infection / diagnostics";
}

function reviewThemeForDay(dayIndex: number): string {
  if (dayIndex === 67) return "Mock 150 + full review";
  if (dayIndex === 68) return "Weak repair: oncology + pediatric + FPMRS";
  if (dayIndex === 69) return "Final 10-week sprint taper + next-phase handoff";
  if (dayIndex % 7 === 6) return "Weekly audit + weak-area repair";
  return "Mixed consolidation";
}

type TaskTypeLiteral = (typeof taskType)[keyof typeof taskType];
type OriginRefLiteral = (typeof originRefType)[keyof typeof originRefType];

function stableId(prefix: string, ...parts: readonly string[]): string {
  const hash = createHash("sha256").update(parts.join("\u001f")).digest("hex").slice(0, 24);
  return `${prefix}_${hash}`;
}

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
  actualMinutes: number;
  targetCount: number | null;
  completedCount: number;
  progressPercent: number;
  priority: number;
  scheduledFor: string;
  originRefType: OriginRefLiteral;
  originRefId: string;
  sourceType: (typeof taskSourceType)[keyof typeof taskSourceType];
  resultJson: string | null;
  startedAt: number | null;
  completedAt: number | null;
}

interface LinkRow {
  id: string;
  taskId: string;
  chapterId: string | null;
  docId: string | null;
  metadataJson: string;
  sortOrder: number;
}

type PriorTaskState = Pick<
  TaskRow,
  | "status"
  | "actualMinutes"
  | "completedCount"
  | "progressPercent"
  | "startedAt"
  | "completedAt"
  | "resultJson"
>;

function taskSemanticKey(task: {
  scheduledFor: string | null;
  taskType: string;
  originRefType: string | null;
  originRefId: string | null;
  title: string;
}): string {
  return [
    task.scheduledFor ?? "",
    task.taskType,
    task.originRefType ?? "",
    task.originRefId ?? "",
    task.title,
  ].join("\u001f");
}

function applyPriorTaskState(taskRows: TaskRow[], prior: Map<string, PriorTaskState>): number {
  let restored = 0;
  for (const task of taskRows) {
    const previous = prior.get(taskSemanticKey(task));
    if (!previous) continue;
    task.status = previous.status;
    task.actualMinutes = previous.actualMinutes;
    task.completedCount = previous.completedCount;
    task.progressPercent = previous.progressPercent;
    task.startedAt = previous.startedAt;
    task.completedAt = previous.completedAt;
    task.resultJson = previous.resultJson;
    restored++;
  }
  return restored;
}

function chapterLinkMetadata(ch: ReadingAssignment): string {
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
    fractionLabel: fractionLabel(ch.sliceIndex, ch.sliceCount),
    timeRange: clockRange(ch.startMin, ch.durationMin),
  });
}

function buildDayTasks(params: {
  planId: string;
  dayId: string;
  day: PlanDay;
  assignments: readonly ReadingAssignment[];
  chapterIdByNo: Map<number, string>;
  docIdByChapterNo: Map<number, string>;
}): { tasks: TaskRow[]; links: LinkRow[] } {
  const tasks: TaskRow[] = [];
  const links: LinkRow[] = [];
  let sort = 0;

  const pushTask = (t: Omit<TaskRow, "planId" | "dayId" | "scheduledFor" | "sortOrder" | "sourceType" | "status" | "actualMinutes" | "completedCount" | "progressPercent" | "resultJson" | "startedAt" | "completedAt">): TaskRow => {
    const sortOrder = sort++;
    const row: TaskRow = {
      ...t,
      id: stableId("task", params.planId, params.day.iso, String(sortOrder), t.taskType, t.originRefType, t.originRefId, t.title),
      planId: params.planId,
      dayId: params.dayId,
      scheduledFor: params.day.iso,
      sortOrder,
      sourceType: taskSourceType.manual,
      status: taskStatus.pending,
      actualMinutes: 0,
      completedCount: 0,
      progressPercent: 0,
      resultJson: null,
      startedAt: null,
      completedAt: null,
    };
    tasks.push(row);
    return row;
  };

  const dayIndex = params.day.index;
  const assignments = [...params.assignments].sort((a, b) => a.startMin - b.startMin);
  const firstChapter = assignments[0]?.chapterNo;
  const primaryChapterId = firstChapter ? params.chapterIdByNo.get(firstChapter) ?? null : null;

  if (dayIndex === 0) {
    pushTask({
      id: randomUUID(),
      taskType: taskType.customTask,
      title: "19:00–19:15 آماده‌سازی شروع برنامه — موبایل بیرون، میز تمیز، فصل ۹۴ باز",
      description: "Day 0 evening kickoff. هدف: ورود واقعی به برنامه، نه برنامه‌ریزی دوباره.",
      estimatedMinutes: 15,
      targetCount: null,
      priority: 2,
      originRefType: originRefType.weakArea,
      originRefId: `${PLAN_ID}:day0:setup`,
    });
  } else if (assignments.length > 0) {
    pushTask({
      id: randomUUID(),
      taskType: taskType.flashcardReview,
      title: "06:05–06:50 FSRS — مرور کارت‌های سررسید قبل از خواندن",
      description: "فقط کارت‌های due؛ کارت جدید نساز.",
      estimatedMinutes: 45,
      targetCount: null,
      priority: 1,
      originRefType: originRefType.flashcard,
      originRefId: `${PLAN_ID}:${params.day.iso}:morning-fsrs`,
    });
  }

  for (const ch of assignments) {
    const chapterId = params.chapterIdByNo.get(ch.chapterNo) ?? null;
    const row = pushTask({
      id: randomUUID(),
      taskType: taskType.chapterRead,
      title: `${clockRange(ch.startMin, ch.durationMin)} مطالعه فصل ${ch.chapterNo} — ${fractionLabel(ch.sliceIndex, ch.sliceCount)} — ${ch.title}`,
      description: `خواندن هدفمند بدون page-number در عنوان. محدوده داخلی برای لینک/اعتبارسنجی: pp ${ch.pagesStart}-${ch.pagesEnd}. tier=${ch.tier}.`,
      estimatedMinutes: ch.durationMin,
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

  if (dayIndex === 0) {
    const qbRow = pushTask({
      id: randomUUID(),
      taskType: taskType.questionBlock,
      title: "22:05–22:35 خودآزمایی فصل ۹۴ — ۲۰ تا ۲۵ سؤال/سؤال‌سازی فعال",
      description: "اگر QBank آماده نیست، از روی NOTE سوال بساز: staging، imaging، exploration indications.",
      estimatedMinutes: 30,
      targetCount: 25,
      priority: 2,
      originRefType: originRefType.chapter,
      originRefId: primaryChapterId ?? "94",
    });
    links.push({
      id: randomUUID(),
      taskId: qbRow.id,
      chapterId: primaryChapterId,
      docId: params.docIdByChapterNo.get(94) ?? null,
      metadataJson: JSON.stringify({ chapterNo: 94, qbankChapterId: "ch-094", timeRange: "22:05–22:35", mode: "day0-self-test" }),
      sortOrder: 0,
    });
    pushTask({ id: randomUUID(), taskType: taskType.flashcardReview, title: "22:35–23:05 ساخت ۱۵–۲۰ فلش‌کارت از decision points فصل ۹۴", description: "فقط decision point: staging, CT, nonoperative management, exploration.", estimatedMinutes: 30, targetCount: 20, priority: 1, originRefType: originRefType.flashcard, originRefId: `${PLAN_ID}:day0:fc` });
    pushTask({ id: randomUUID(), taskType: taskType.notebookReview, title: "23:05–23:20 الگوریتم یک‌صفحه‌ای — Upper urinary tract trauma", description: "خروجی امشب: یک الگوریتم فارسی کوتاه برای renal/ureteral trauma.", estimatedMinutes: 15, targetCount: null, priority: 1, originRefType: originRefType.document, originRefId: `${PLAN_ID}:day0:algorithm` });
    return { tasks, links };
  }

  if (assignments.length > 0) {
    const mcqTarget = assignments.some((a) => a.tier === "hot") ? 75 : 50;
    const qbRow = pushTask({
      id: randomUUID(),
      taskType: taskType.questionBlock,
      title: `14:30–15:30 Timed MCQ — ${toPersianDigits(mcqTarget)} سؤال روی فصل/فصل‌های امروز`,
      description: "بلوک زمان‌دار؛ بعد از اتمام، فقط درصد مهم نیست، trap غلط‌ها مهم است.",
      estimatedMinutes: 60,
      targetCount: mcqTarget,
      priority: 2,
      originRefType: originRefType.chapter,
      originRefId: primaryChapterId ?? `${PLAN_ID}:${params.day.iso}:qbank`,
    });
    if (firstChapter) {
      links.push({
        id: randomUUID(),
        taskId: qbRow.id,
        chapterId: primaryChapterId,
        docId: params.docIdByChapterNo.get(firstChapter) ?? null,
        metadataJson: JSON.stringify({ chapterNo: firstChapter, qbankChapterId: `ch-${String(firstChapter).padStart(3, "0")}`, timeRange: "14:30–15:30", mode: "timed-mcq" }),
        sortOrder: 0,
      });
    }
    pushTask({ id: randomUUID(), taskType: taskType.weakAreaReview, title: "15:45–16:45 Review غلط‌ها — علت غلط، trap، rule نهایی", description: "هر غلط باید why-missed / trap / correct-rule داشته باشد.", estimatedMinutes: 60, targetCount: null, priority: 2, originRefType: originRefType.weakArea, originRefId: `${PLAN_ID}:${params.day.iso}:wrong-review` });
    pushTask({ id: randomUUID(), taskType: taskType.flashcardReview, title: "20:00–20:45 ساخت کارت از غلط‌ها و decision points امروز", description: "کارت جدید فقط از غلط، trap، guideline threshold و الگوریتم درمان.", estimatedMinutes: 45, targetCount: null, priority: 1, originRefType: originRefType.flashcard, originRefId: `${PLAN_ID}:${params.day.iso}:new-cards` });
    pushTask({ id: randomUUID(), taskType: taskType.notebookReview, title: "20:45–21:30 دفترچه ضعف‌ها / algorithm sheet", description: "یک خروجی ملموس: جدول، الگوریتم، یا rule list. بدون خروجی = کار ناقص.", estimatedMinutes: 45, targetCount: null, priority: 1, originRefType: originRefType.document, originRefId: `${PLAN_ID}:${params.day.iso}:notebook` });
    pushTask({ id: randomUUID(), taskType: taskType.flashcardReview, title: "21:30–22:00 FSRS سبک + بستن برنامه فردا", description: "مرور کوتاه و آماده‌سازی فصل بعدی. ساعت ۲۲:۴۵ خواب.", estimatedMinutes: 30, targetCount: null, priority: 0, originRefType: originRefType.flashcard, originRefId: `${PLAN_ID}:${params.day.iso}:night-fsrs` });
    return { tasks, links };
  }

  const theme = reviewThemeForDay(dayIndex);
  if (dayIndex === 67) {
    pushTask({ id: randomUUID(), taskType: taskType.examBlock, title: "07:30–10:30 Mock آزمون — ۱۵۰ سؤال زمان‌دار", description: "نیم‌ماک سنگین. گوشی بیرون. مثل روز امتحان.", estimatedMinutes: 180, targetCount: 150, priority: 2, originRefType: originRefType.question, originRefId: `${PLAN_ID}:mock-150` });
    pushTask({ id: randomUUID(), taskType: taskType.weakAreaReview, title: "13:30–16:30 Review کامل Mock — فقط غلط و شک‌دار", description: "برای هر غلط: why missed / trap / correct rule.", estimatedMinutes: 180, targetCount: null, priority: 2, originRefType: originRefType.weakArea, originRefId: `${PLAN_ID}:mock-150-review` });
    pushTask({ id: randomUUID(), taskType: taskType.flashcardReview, title: "20:00–21:00 FSRS + کارت‌های ماک", description: theme, estimatedMinutes: 60, targetCount: null, priority: 1, originRefType: originRefType.flashcard, originRefId: `${PLAN_ID}:mock-150-fsrs` });
  } else if (dayIndex === 68) {
    pushTask({ id: randomUUID(), taskType: taskType.weakAreaReview, title: "07:30–09:30 Weak repair — Oncology", description: "Prostate/bladder/kidney/testis/penis: فقط نقاط ضعف ماک و QBank.", estimatedMinutes: 120, targetCount: null, priority: 2, originRefType: originRefType.weakArea, originRefId: `${PLAN_ID}:weak-oncology` });
    pushTask({ id: randomUUID(), taskType: taskType.weakAreaReview, title: "09:45–11:45 Weak repair — Pediatric + FPMRS", description: "VUR/PUV/hypospadias + neurogenic bladder/incontinence/UDS.", estimatedMinutes: 120, targetCount: null, priority: 2, originRefType: originRefType.weakArea, originRefId: `${PLAN_ID}:weak-peds-fpmrs` });
    pushTask({ id: randomUUID(), taskType: taskType.questionBlock, title: "13:30–15:00 ۷۵ سؤال weak-area زمان‌دار", description: "فقط از مباحثی که زیر ۷۰٪ بوده‌اند.", estimatedMinutes: 90, targetCount: 75, priority: 2, originRefType: originRefType.question, originRefId: `${PLAN_ID}:weak-qbank` });
    pushTask({ id: randomUUID(), taskType: taskType.notebookReview, title: "20:00–21:30 Final weak notebook cleanup", description: theme, estimatedMinutes: 90, targetCount: null, priority: 1, originRefType: originRefType.document, originRefId: `${PLAN_ID}:weak-notebook` });
  } else {
    pushTask({ id: randomUUID(), taskType: taskType.examBlock, title: "07:30–10:30 Final mixed simulation — ۱۵۰ سؤال", description: "نه برای یادگیری جدید؛ برای stamina و pacing.", estimatedMinutes: 180, targetCount: 150, priority: 2, originRefType: originRefType.question, originRefId: `${PLAN_ID}:final-sim` });
    pushTask({ id: randomUUID(), taskType: taskType.notebookReview, title: "13:30–15:00 مرور الگوریتم‌های نهایی", description: "Trauma, stones, prostate, bladder, peds, FPMRS, infections.", estimatedMinutes: 90, targetCount: null, priority: 1, originRefType: originRefType.document, originRefId: `${PLAN_ID}:final-algorithms` });
    pushTask({ id: randomUUID(), taskType: taskType.flashcardReview, title: "20:00–21:00 FSRS سبک — بدون کارت جدید", description: theme, estimatedMinutes: 60, targetCount: null, priority: 0, originRefType: originRefType.flashcard, originRefId: `${PLAN_ID}:final-fsrs` });
  }
  return { tasks, links };
}

function validateStatic(): void {
  const expectedChapterCount = 120;
  if (INCLUDED_CHAPTER_NOS.length !== expectedChapterCount) throw new Error(`INCLUDED_CHAPTER_NOS length = ${INCLUDED_CHAPTER_NOS.length}, expected ${expectedChapterCount}`);
  if (CHAPTERS.length !== expectedChapterCount) throw new Error(`CHAPTERS length = ${CHAPTERS.length}, expected ${expectedChapterCount}`);
  if (STUDY_CHAPTER_SEQUENCE.length !== expectedChapterCount) throw new Error(`STUDY_CHAPTER_SEQUENCE length = ${STUDY_CHAPTER_SEQUENCE.length}, expected ${expectedChapterCount}`);
  if (new Set(STUDY_CHAPTER_SEQUENCE).size !== STUDY_CHAPTER_SEQUENCE.length) throw new Error("STUDY_CHAPTER_SEQUENCE contains duplicate chapters");
  const includedSet = new Set(INCLUDED_CHAPTER_NOS);
  for (const c of REMOVED_CHAPTER_NOS) {
    if (includedSet.has(c)) throw new Error(`Removed chapter ${c} reappeared in INCLUDED_CHAPTER_NOS`);
    if (CHAPTERS_BY_NO.has(c)) throw new Error(`Removed chapter ${c} still present in CHAPTERS registry`);
  }
  const a = [...STUDY_CHAPTER_SEQUENCE].sort((x, y) => x - y);
  const b = [...INCLUDED_CHAPTER_NOS].sort((x, y) => x - y);
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) throw new Error(`Sequence/included mismatch at index ${i}: ${a[i]} vs ${b[i]}`);
  for (const ch of INCLUDED_CHAPTER_NOS) if (!CHAPTERS_BY_NO.has(ch)) throw new Error(`CHAPTERS registry missing chapter ${ch}`);
  if (STUDY_CHAPTER_SEQUENCE[0] !== 94) throw new Error("First study chapter must be 94 per user instruction");
}

function buildGoalJson(readingAssignments: readonly ReadingAssignment[]): Record<string, unknown> {
  const finishDayIndex = readingAssignments.reduce((m, a) => Math.max(m, a.dayIndex), 0);
  const chaptersByWeek = Array.from({ length: TOTAL_WEEKS }, (_, weekIndex) => {
    const weekChapters = new Set<number>();
    for (const a of readingAssignments) if (Math.floor(a.dayIndex / 7) === weekIndex) weekChapters.add(a.chapterNo);
    return { weekNumber: weekIndex + 1, chapters: [...weekChapters] };
  });
  return {
    planKey: PLAN_ID,
    sourceBook: "Campbell-Walsh-Wein",
    sourceEdition: "13 / 2026 sprint",
    startReality: "2026-05-12 19:00; user starts from chapter 94",
    chaptersTotal: INCLUDED_CHAPTER_NOS.length,
    finishFirstPassDayIndex: finishDayIndex,
    dailyClockTemplate: {
      fullDay: ["06:05–06:50 FSRS", "07:00–09:20 Campbell/NOTE Block A", "09:35–11:55 Campbell/NOTE Block B", "13:00–14:20 Campbell/NOTE Block C", "14:30–15:30 Timed MCQ", "15:45–16:45 MCQ wrong review", "17:30–18:50 Campbell/NOTE Block D", "20:00–20:45 flashcards from wrongs", "20:45–21:30 weak notebook / algorithm", "21:30–22:00 FSRS light"],
      eveningKickoff: ["19:00–19:15 setup", "19:15–20:35 chapter 94", "20:50–22:05 chapter 94", "22:05–22:35 self-test", "22:35–23:05 flashcards", "23:05–23:20 algorithm"],
    },
    chaptersByWeek,
    adaptationRules: [
      "If MCQ accuracy < 70% in a topic, next available weak_area_review must target that topic before new low-yield reading.",
      "If a day is missed, do not push the whole schedule; replace the next final review block, not core HOT reading.",
      "No additional chapter removals without explicit user approval.",
      "No silent scaling or content drop; chapter 94 remains included.",
    ],
  };
}

const TRANSIENT_ERROR_PATTERNS: readonly RegExp[] = [/connection terminated/i, /connection timeout/i, /timeout exceeded/i, /timeout/i, /econnreset/i, /etimedout/i, /enetunreach/i, /enotfound/i, /server.*closed/i];

function isTransientDbError(err: unknown): boolean {
  const layers: unknown[] = [err];
  const cause = (err as { cause?: unknown } | null)?.cause;
  if (cause && cause !== err) layers.push(cause);
  for (const e of layers) {
    const code = (e as { code?: unknown } | null)?.code;
    if (typeof code === "string" && /^E(TIMEDOUT|CONNRESET|CONNREFUSED|NOTFOUND|NETUNREACH|PIPE)$/i.test(code)) return true;
    const msg = e instanceof Error ? e.message : String(e);
    if (TRANSIENT_ERROR_PATTERNS.some((p) => p.test(msg))) return true;
  }
  return false;
}

async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 3, delaysMs: readonly number[] = [2000, 5000, 10000]): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      const wait = delaysMs[Math.min(i - 1, delaysMs.length - 1)];
      const detail = lastErr instanceof Error ? lastErr.message : String(lastErr);
      console.warn(`  ↻ ${label}: attempt ${i + 1}/${attempts} after ${wait}ms (${detail})`);
      await new Promise((r) => setTimeout(r, wait));
    }
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientDbError(err)) throw err;
    }
  }
  throw lastErr;
}

async function main(): Promise<void> {
  validateStatic();
  const readingAssignments = buildReadingAssignments();
  const firstReading = readingAssignments[0];
  if (!firstReading || firstReading.chapterNo !== 94 || firstReading.dayIndex !== 0) throw new Error("Schedule must start on day 0 with chapter 94");
  const finishDayIndex = readingAssignments.reduce((m, a) => Math.max(m, a.dayIndex), 0);
  console.log(`✓ static validation passed (${TOTAL_WEEKS} weeks / ${TOTAL_DAYS} days / ${INCLUDED_CHAPTER_NOS.length} chapters)`);
  console.log(`✓ first-pass reading finishes on day index ${finishDayIndex}; remaining days = ${TOTAL_DAYS - finishDayIndex - 1}`);

  const db = await getDb();
  await withRetry("preflight SELECT 1", async () => { await db.execute(sql`select 1`); });
  console.log("✓ preflight: SELECT 1 OK");

  const chaptersTotal = await withRetry("count chapters", async () => {
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(chapters);
    return row?.n ?? 0;
  });
  console.log(`✓ preflight: chapters table has ${chaptersTotal} rows`);
  if (chaptersTotal === 0) throw new Error("chapters table is empty. Run scripts/seed-campbell-chapters.ts first.");

  const includedSet = new Set<number>(INCLUDED_CHAPTER_NOS);
  const allChapterRows = await withRetry("load chapters", async () => db.select({ id: chapters.id, chapterNo: chapters.chapterNo }).from(chapters));
  const chapterIdByNo = new Map<number, string>();
  for (const r of allChapterRows) if (includedSet.has(r.chapterNo)) chapterIdByNo.set(r.chapterNo, r.id);

  const allDocRows = await withRetry("load noteDocuments", async () => db.select({ chapterNo: noteDocuments.chapterNo, docId: noteDocuments.docId, generatedAt: noteDocuments.generatedAt }).from(noteDocuments).orderBy(desc(noteDocuments.generatedAt)));
  const docIdByChapterNo = new Map<number, string>();
  for (const r of allDocRows) {
    if (!includedSet.has(r.chapterNo)) continue;
    if (!docIdByChapterNo.has(r.chapterNo)) docIdByChapterNo.set(r.chapterNo, r.docId);
  }
  console.log(`✓ lookups: ${chapterIdByNo.size}/${INCLUDED_CHAPTER_NOS.length} chapters, ${docIdByChapterNo.size}/${INCLUDED_CHAPTER_NOS.length} note-docs resolved`);

  const calendar = buildCalendar(PLAN_META.startDate);
  if (calendar.length !== TOTAL_DAYS) throw new Error(`calendar length=${calendar.length}, expected ${TOTAL_DAYS}`);
  const assignmentsByDay = new Map<number, ReadingAssignment[]>();
  for (const a of readingAssignments) {
    const arr = assignmentsByDay.get(a.dayIndex) ?? [];
    arr.push(a);
    assignmentsByDay.set(a.dayIndex, arr);
  }

  const dayRows: Array<{ id: string; planId: string; date: string; dayOfWeek: DowLiteral; label: string | null; isRestDay: number; totalTasks: number; completedTasks: number; estimatedMinutes: number; actualMinutes: number; targetMinutes: number; assignedMinutes: number; completedMinutes: number; status: (typeof planDayStatus)[keyof typeof planDayStatus] }> = [];
  const taskRows: TaskRow[] = [];
  const linkRows: LinkRow[] = [];
  const planDayIdByIndex = new Map<number, string>();
  for (const day of calendar) planDayIdByIndex.set(day.index, stableId("plan_day", PLAN_ID, day.iso));

  const dailyMinutes: Array<{ dayIndex: number; iso: string; minutes: number; chapterNos: number[] }> = [];
  for (const day of calendar) {
    const assignments = assignmentsByDay.get(day.index) ?? [];
    const dayId = planDayIdByIndex.get(day.index)!;
    const { tasks, links } = buildDayTasks({ planId: PLAN_ID, dayId, day, assignments, chapterIdByNo, docIdByChapterNo });
    const dayMinutes = tasks.reduce((a, t) => a + t.estimatedMinutes, 0);
    const chapterNos = [...new Set(assignments.map((a) => a.chapterNo))];
    const phase = chapterNos.length > 0 ? phaseForChapter(chapterNos[0]) : reviewThemeForDay(day.index);
    const targetMinutes = day.index === 0 ? PLAN_META.eveningKickoffBudgetMin : PLAN_META.dailyTimeBudgetMin;
    if (dayMinutes > 780) throw new Error(`Day ${day.iso} exceeds hard rank-one cap: ${dayMinutes} min`);
    taskRows.push(...tasks);
    linkRows.push(...links);
    dayRows.push({ id: dayId, planId: PLAN_ID, date: day.iso, dayOfWeek: day.dow, label: `${day.jalaliLabel} — ${phase}`, isRestDay: 0, totalTasks: tasks.length, completedTasks: 0, estimatedMinutes: dayMinutes, actualMinutes: 0, targetMinutes, assignedMinutes: dayMinutes, completedMinutes: 0, status: planDayStatus.scheduled });
    dailyMinutes.push({ dayIndex: day.index, iso: day.iso, minutes: dayMinutes, chapterNos });
  }

  if (dayRows.length !== TOTAL_DAYS) throw new Error(`dayRows length=${dayRows.length}, expected ${TOTAL_DAYS}`);
  const chapterReadSet = new Set<number>();
  for (const a of readingAssignments) chapterReadSet.add(a.chapterNo);
  if (chapterReadSet.size !== INCLUDED_CHAPTER_NOS.length) throw new Error(`chapterReadSet size=${chapterReadSet.size}, expected ${INCLUDED_CHAPTER_NOS.length}`);

  const firstIso = dayRows.map((r) => r.date).sort()[0];
  const lastIso = dayRows.map((r) => r.date).sort().at(-1)!;
  const goalJson = buildGoalJson(readingAssignments);

  const preDays = await db.select({ c: sql<number>`count(*)::int` }).from(studyPlanDays).where(eq(studyPlanDays.planId, PLAN_ID));
  const preTasks = await db.select({ c: sql<number>`count(*)::int` }).from(studyTasks).where(eq(studyTasks.planId, PLAN_ID));
  const preLinks = await db.select({ c: sql<number>`count(*)::int` }).from(studyTaskLinks).innerJoin(studyTasks, eq(studyTaskLinks.taskId, studyTasks.id)).where(eq(studyTasks.planId, PLAN_ID));
  const preCounts = { days: preDays[0]?.c ?? 0, tasks: preTasks[0]?.c ?? 0, links: preLinks[0]?.c ?? 0 };
  const priorTaskRows = await db
    .select({
      scheduledFor: studyTasks.scheduledFor,
      taskType: studyTasks.taskType,
      originRefType: studyTasks.originRefType,
      originRefId: studyTasks.originRefId,
      title: studyTasks.title,
      status: studyTasks.status,
      actualMinutes: studyTasks.actualMinutes,
      completedCount: studyTasks.completedCount,
      progressPercent: studyTasks.progressPercent,
      startedAt: studyTasks.startedAt,
      completedAt: studyTasks.completedAt,
      resultJson: studyTasks.resultJson,
    })
    .from(studyTasks)
    .where(eq(studyTasks.planId, PLAN_ID));
  const priorBySemanticKey = new Map<string, PriorTaskState>();
  for (const row of priorTaskRows) {
    priorBySemanticKey.set(taskSemanticKey(row), {
      status: row.status,
      actualMinutes: row.actualMinutes,
      completedCount: row.completedCount,
      progressPercent: row.progressPercent,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      resultJson: row.resultJson == null ? null : typeof row.resultJson === "string" ? row.resultJson : JSON.stringify(row.resultJson),
    });
  }
  const restoredTaskStates = applyPriorTaskState(taskRows, priorBySemanticKey);
  const dayStats = new Map<string, { totalTasks: number; completedTasks: number; estimatedMinutes: number; actualMinutes: number }>();
  for (const task of taskRows) {
    const current = dayStats.get(task.dayId) ?? { totalTasks: 0, completedTasks: 0, estimatedMinutes: 0, actualMinutes: 0 };
    current.totalTasks++;
    current.estimatedMinutes += task.estimatedMinutes;
    current.actualMinutes += task.actualMinutes;
    if (task.status === taskStatus.completed) current.completedTasks++;
    dayStats.set(task.dayId, current);
  }
  for (const day of dayRows) {
    const stats = dayStats.get(day.id);
    if (!stats) continue;
    day.totalTasks = stats.totalTasks;
    day.completedTasks = stats.completedTasks;
    day.estimatedMinutes = stats.estimatedMinutes;
    day.actualMinutes = stats.actualMinutes;
    day.assignedMinutes = stats.estimatedMinutes;
    day.completedMinutes = stats.actualMinutes;
    day.status =
      stats.totalTasks > 0 && stats.completedTasks >= stats.totalTasks
        ? planDayStatus.completed
        : stats.completedTasks > 0
          ? planDayStatus.partial
          : planDayStatus.scheduled;
  }
  const completedPlanTasks = taskRows.filter((t) => t.status === taskStatus.completed).length;
  const planProgressPercent = taskRows.length > 0 ? Math.round((completedPlanTasks / taskRows.length) * 100) : 0;

  await db.transaction(async (tx) => {
    await tx.delete(studyPlans).where(eq(studyPlans.id, PLAN_ID));
    const selectedChapterIds = [...INCLUDED_CHAPTER_NOS].map((n) => chapterIdByNo.get(n)).filter((v): v is string => typeof v === "string");
    await tx.insert(studyPlans).values({ id: PLAN_ID, title: PLAN_META.title, description: PLAN_META.description, status: planStatus.active, startDate: PLAN_META.startDate, endDate: lastIso, selectedChapterIdsJson: JSON.stringify(selectedChapterIds) as unknown as string[] | null, goalJson: JSON.stringify(goalJson) as unknown as Record<string, unknown> | null, repeatPattern: PLAN_META.repeatPattern, totalTasks: taskRows.length, completedTasks: completedPlanTasks, progressPercent: planProgressPercent, examDate: PLAN_META.examDate, targetMode: targetMode.examPrep, dailyTimeBudgetMin: PLAN_META.dailyTimeBudgetMin });
    for (let i = 0; i < dayRows.length; i += 500) await tx.insert(studyPlanDays).values(dayRows.slice(i, i + 500).map((r) => ({ id: r.id, planId: r.planId, date: r.date, dayOfWeek: r.dayOfWeek, label: r.label, isRestDay: r.isRestDay, totalTasks: r.totalTasks, completedTasks: r.completedTasks, estimatedMinutes: r.estimatedMinutes, actualMinutes: r.actualMinutes, targetMinutes: r.targetMinutes, assignedMinutes: r.assignedMinutes, completedMinutes: r.completedMinutes, status: r.status })));
    for (let i = 0; i < taskRows.length; i += 500) await tx.insert(studyTasks).values(taskRows.slice(i, i + 500).map((t) => ({ id: t.id, planId: t.planId, dayId: t.dayId, taskType: t.taskType, status: t.status, title: t.title, description: t.description, sortOrder: t.sortOrder, estimatedMinutes: t.estimatedMinutes, actualMinutes: t.actualMinutes, targetCount: t.targetCount, completedCount: t.completedCount, progressPercent: t.progressPercent, priority: t.priority, scheduledFor: t.scheduledFor, originRefType: t.originRefType, originRefId: t.originRefId, sourceType: t.sourceType, resultJson: t.resultJson as unknown as Record<string, unknown> | null, startedAt: t.startedAt, completedAt: t.completedAt })));
    for (let i = 0; i < linkRows.length; i += 500) await tx.insert(studyTaskLinks).values(linkRows.slice(i, i + 500).map((l) => ({ id: l.id, taskId: l.taskId, chapterId: l.chapterId, docId: l.docId, metadataJson: l.metadataJson as unknown as Record<string, unknown> | null, sortOrder: l.sortOrder })));
  });

  const postDays = await db.select({ c: sql<number>`count(*)::int` }).from(studyPlanDays).where(eq(studyPlanDays.planId, PLAN_ID));
  const postTasks = await db.select({ c: sql<number>`count(*)::int` }).from(studyTasks).where(eq(studyTasks.planId, PLAN_ID));
  const postLinks = await db.select({ c: sql<number>`count(*)::int` }).from(studyTaskLinks).innerJoin(studyTasks, eq(studyTaskLinks.taskId, studyTasks.id)).where(eq(studyTasks.planId, PLAN_ID));
  const postCounts = { days: postDays[0]?.c ?? 0, tasks: postTasks[0]?.c ?? 0, links: postLinks[0]?.c ?? 0 };
  const allPlanRows = await db.select({ id: studyPlans.id, title: studyPlans.title }).from(studyPlans);
  const maxDayMinutes = dailyMinutes.reduce((m, r) => Math.max(m, r.minutes), 0);
  const minDayMinutes = dailyMinutes.reduce((m, r) => Math.min(m, r.minutes), Infinity);
  const readingMinTotal = readingAssignments.reduce((a, r) => a + r.durationMin, 0);
  const tasksPerWeek = Array.from({ length: TOTAL_WEEKS }, (_, weekIndex) => ({ week: weekIndex + 1, tasks: taskRows.filter((t) => Math.floor((calendar.find((d) => d.iso === t.scheduledFor)?.index ?? 0) / 7) === weekIndex).length }));

  console.log(`\n=== SEED SUMMARY (10-WEEK RANK-ONE / v2 replacement) ===`);
  console.log(JSON.stringify({ planId: PLAN_ID, firstDay: firstIso, lastDay: lastIso, totalDays: dayRows.length, totalWeeks: TOTAL_WEEKS, chapterCount: INCLUDED_CHAPTER_NOS.length, firstChapter: STUDY_CHAPTER_SEQUENCE[0], ch94Included: INCLUDED_CHAPTER_NOS.includes(94), finishFirstPassDayIndex: finishDayIndex, finishFirstPassDate: calendar[finishDayIndex]?.iso, remainingReviewDaysAfterFirstPass: TOTAL_DAYS - finishDayIndex - 1, readingAssignments: readingAssignments.length, readingMinTotal, tasks: taskRows.length, links: linkRows.length, restoredTaskStates, preRunCounts: preCounts, postRunCounts: postCounts, postMatchesSeed: postCounts.days === dayRows.length && postCounts.tasks === taskRows.length && postCounts.links === linkRows.length, resolvedChapterIds: chapterIdByNo.size, resolvedDocIds: docIdByChapterNo.size, maxDayMinutes, minDayMinutes, day0: dailyMinutes[0], lastReadingDay: dailyMinutes.find((d) => d.dayIndex === finishDayIndex), tasksPerWeek, plansInDb: allPlanRows.map((r) => r.id), unresolvedChapterIds_count: INCLUDED_CHAPTER_NOS.filter((n) => !chapterIdByNo.has(n)).length, unresolvedDocChapterNos_count: INCLUDED_CHAPTER_NOS.filter((n) => !docIdByChapterNo.has(n)).length }, null, 2));

  if (postCounts.days !== dayRows.length || postCounts.tasks !== taskRows.length || postCounts.links !== linkRows.length) throw new Error("postCounts do not match generated seed rows");
}

function cleanupPGliteLock(): void {
  try {
    const dir = getPGliteLocation();
    const pid = join(dir, "postmaster.pid");
    if (existsSync(pid)) rmSync(pid);
  } catch {
    // best-effort
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
