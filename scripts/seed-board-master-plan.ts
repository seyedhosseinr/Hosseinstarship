/* filepath: scripts/seed-board-master-plan.ts */
/* eslint-disable no-console */

import {
  createPlan,
  createDaysBatch,
  createTask,
  recalcDayProgress,
  recalcPlanProgress,
  upsertSettings,
  listPlans,
  deletePlan,
  updatePlan,
  listDaysByPlan,
} from "../src/lib/db/queries/planner";
import { getCampbellChapterMetadata } from "../src/lib/planner/task-title";

type ChapterTuple = [chapter: number, startPage: number, endPage: number];
type Dow =
  | "saturday"
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday";

type PhaseId =
  | "phase_a_foundations_boot"
  | "phase_b_systems_coverage"
  | "phase_c_high_yield_heavy_coverage"
  | "phase_d_compression_second_pass"
  | "phase_e_final_board_push";

interface CoverageUnit {
  chapter: number;
  pageStart: number;
  pageEnd: number;
  pages: number;
}

interface SeedTask {
  taskType: "custom_task" | "question_block" | "flashcard_review";
  title: string;
  description: string;
  estimatedMinutes: number;
  priority: number;
  targetCount?: number | null;
}

function buildCoverageTitle(chapter: number, pageStart: number, pageEnd: number): string {
  const chapterTitle = getCampbellChapterMetadata(chapter)?.title ?? `Chapter ${chapter}`;
  return `Chapter ${chapter} — ${chapterTitle} — Read + Review (pp ${pageStart}-${pageEnd})`;
}

const PLAN_TITLE = "Board Urology 1405 â€” Campbell Master Plan";
const START_DATE = "2026-03-16";
const EXAM_DATE = "2026-08-27";
const PRE_EXAM_END = "2026-08-26";

const PHASE_A_END = "2026-04-12";
const PHASE_B_END = "2026-06-07";
const PHASE_C_END = "2026-07-19";
const PHASE_D_END = "2026-08-09";
const PHASE_E_END = "2026-08-26";

const FIRST_PASS_END = PHASE_C_END;
const LIGHT_DAY: Dow = "friday";
const DAILY_GOAL_MINUTES = 420;
const DEFAULT_TASK_DURATION_MINUTES = 45;

/**
 * Ù…Ù‡Ù…:
 * Ú†ÙˆÙ† Ù¾Ù„Ù†Ø± ØªÙˆ Ø®ÙˆØ¯Ø´ FSRS virtual tasks Ù…ÛŒâ€ŒØ³Ø§Ø²Ø¯ØŒ Ø§ÛŒÙ† Ø±Ø§ false Ú¯Ø°Ø§Ø´ØªÙ…
 * ØªØ§ duplicate rail Ù†Ø³Ø§Ø²ÛŒ.
 *
 * Ø§Ú¯Ø± Ø®ÙˆØ§Ø³ØªÛŒ Ø¹Ù„Ø§ÙˆÙ‡ Ø¨Ø± virtual FSRS tasks ÛŒÚ© rail Ø«Ø§Ø¨Øª Ø±ÙˆØ²Ø§Ù†Ù‡ Ù‡Ù… Ø¨Ø¨ÛŒÙ†ÛŒØŒ
 * Ø§ÛŒÙ† Ø±Ø§ true Ú©Ù†.
 */
const ENABLE_FIXED_FSRS_RAIL = false;

/**
 * ÙÙ‚Ø· ÙØµÙ„â€ŒÙ‡Ø§ÛŒ included.
 * Ø¨Ø±Ø§ÛŒ Ø³Ø¨Ú© Ù†Ú¯Ù‡â€ŒØ¯Ø§Ø´ØªÙ† ÙØ§ÛŒÙ„ØŒ title Ø±Ø§ Ø¯Ø§Ø®Ù„ seed Ù†ÛŒØ§ÙˆØ±Ø¯Ù‡â€ŒØ§Ù… Ùˆ taskÙ‡Ø§ Ø±Ø§ Ø¨Ø± Ø§Ø³Ø§Ø³ chapter/page Ù…ÛŒâ€ŒØ³Ø§Ø²Ù….
 *
 * Ù†Ú©ØªÙ‡:
 * chapter 146 Ø¯Ø± Ø¯ÛŒØªØ§ÛŒ ØªÙˆ Ø®Ø±Ø§Ø¨ Ø¨ÙˆØ¯ (3161 -> 3160)ØŒ Ù¾Ø³ ÙØ¹Ù„Ø§Ù‹ Ø¹Ù…Ø¯Ø§Ù‹ Ø§Ø² seed coverage Ø­Ø°Ù Ø´Ø¯Ù‡
 * ØªØ§ overlap Ùˆ seed Ø®Ø±Ø§Ø¨ Ø§ÛŒØ¬Ø§Ø¯ Ù†Ú©Ù†Ø¯.
 */
const INCLUDED_CHAPTERS: ChapterTuple[] = [
  [2, 8, 23],
  [3, 24, 39],
  [4, 40, 65],
  [5, 66, 91],
  [6, 92, 108],
  [7, 109, 119],
  [8, 120, 136],
  [11, 150, 166],
  [12, 167, 174],
  [13, 175, 184],
  [14, 185, 190],
  [15, 191, 198],
  [16, 199, 214],
  [17, 215, 228],
  [20, 283, 306],
  [21, 307, 321],
  [22, 322, 330],
  [25, 360, 387],
  [26, 388, 458],
  [27, 459, 479],
  [28, 480, 510],
  [29, 511, 529],
  [30, 530, 557],
  [31, 558, 583],
  [32, 584, 617],
  [34, 628, 657],
  [35, 658, 671],
  [36, 672, 695],
  [37, 696, 717],
  [38, 718, 730],
  [40, 744, 759],
  [41, 760, 784],
  [42, 785, 794],
  [43, 795, 854],
  [44, 855, 876],
  [45, 877, 899],
  [46, 900, 920],
  [47, 921, 940],
  [48, 941, 973],
  [49, 974, 1000],
  [50, 1001, 1026],
  [51, 1027, 1037],
  [52, 1038, 1063],
  [53, 1064, 1090],
  [54, 1091, 1106],
  [55, 1107, 1140],
  [56, 1141, 1185],
  [57, 1186, 1210],
  [58, 1211, 1229],
  [59, 1230, 1253],
  [62, 1289, 1310],
  [63, 1311, 1332],
  [64, 1333, 1347],

  [66, 1365, 1387],
  [67, 1388, 1408],
  [68, 1409, 1417],
  [69, 1418, 1436],
  [70, 1437, 1469],
  [71, 1470, 1496],
  [72, 1497, 1522],
  [73, 1523, 1540],
  [74, 1541, 1560],
  [75, 1561, 1578],
  [76, 1579, 1601],
  [77, 1602, 1633],
  [78, 1634, 1657],
  [79, 1658, 1682],
  [80, 1683, 1705],
  [82, 1715, 1748],
  [83, 1749, 1763],
  [85, 1774, 1793],
  [86, 1794, 1816],
  [87, 1817, 1837],

  [88, 1838, 1853],
  [89, 1854, 1882],
  [90, 1883, 1895],
  [92, 1903, 1941],
  [94, 1972, 2003],
  [95, 2004, 2010],
  [96, 2011, 2026],
  [97, 2027, 2048],
  [98, 2049, 2058],
  [99, 2059, 2066],
  [100, 2067, 2083],
  [101, 2084, 2103],
  [102, 2104, 2156],
  [103, 2157, 2165],
  [104, 2166, 2179],
  [105, 2180, 2191],
  [106, 2192, 2217],
  [107, 2218, 2237],
  [108, 2238, 2275],
  [109, 2276, 2289],
  [110, 2290, 2303],
  [111, 2304, 2336],
  [112, 2337, 2372],
  [113, 2373, 2403],
  [114, 2404, 2415],
  [116, 2426, 2459],
  [117, 2460, 2489],
  [118, 2490, 2502],
  [119, 2503, 2514],
  [120, 2515, 2554],
  [121, 2555, 2583],
  [122, 2584, 2600],
  [123, 2601, 2641],
  [124, 2642, 2654],
  [125, 2655, 2663],
  [128, 2687, 2706],
  [129, 2707, 2729],
  [130, 2730, 2755],
  [131, 2756, 2783],
  [132, 2784, 2811],
  [133, 2812, 2842],
  [134, 2843, 2859],
  [135, 2860, 2871],
  [136, 2872, 2923],
  [137, 2924, 2939],
  [139, 2968, 2989],
  [140, 2990, 3026],
  [141, 3027, 3058],
  [144, 3102, 3110],
  [145, 3111, 3160],
  [147, 3161, 3171],
  [148, 3172, 3179],
  [149, 3180, 3220],
  [150, 3221, 3282],
  [151, 3283, 3317],
  [152, 3318, 3333],
  [153, 3334, 3352],
  [154, 3353, 3363],
  [155, 3364, 3381],
  [156, 3382, 3389],
  [157, 3390, 3397],
  [158, 3398, 3416],
  [159, 3417, 3430],
  [160, 3431, 3448],
  [162, 3474, 3504],
  [163, 3505, 3542],
  [164, 3543, 3561],
  [165, 3562, 3587],
  [166, 3588, 3612],
];

const PHASES: Array<{ id: PhaseId; start: string; end: string }> = [
  { id: "phase_a_foundations_boot", start: "2026-03-16", end: "2026-04-12" },
  { id: "phase_b_systems_coverage", start: "2026-04-13", end: "2026-06-07" },
  { id: "phase_c_high_yield_heavy_coverage", start: "2026-06-08", end: "2026-07-19" },
  { id: "phase_d_compression_second_pass", start: "2026-07-20", end: "2026-08-09" },
  { id: "phase_e_final_board_push", start: "2026-08-10", end: "2026-08-26" },
];

const ANCHOR_POOLS: Record<PhaseId, string[]> = {
  phase_a_foundations_boot: [
    "Anchor â€” Stones primer",
    "Anchor â€” BPH/LUTS primer",
    "Anchor â€” Bladder oncology primer",
    "Anchor â€” Prostate oncology primer",
  ],
  phase_b_systems_coverage: [
    "Anchor â€” Pediatric high-yield recall",
    "Anchor â€” Andrology / infertility recall",
    "Anchor â€” Stones / obstruction anchor",
    "Anchor â€” LUTS / BPH anchor",
    "Anchor â€” Bladder oncology anchor",
  ],
  phase_c_high_yield_heavy_coverage: [
    "Anchor â€” Bladder oncology",
    "Anchor â€” Renal / adrenal oncology",
    "Anchor â€” Prostate oncology",
    "Anchor â€” Stones / endourology",
    "Anchor â€” LUTS / BPH / reconstruction",
    "Anchor â€” Selected pediatric high-yield",
  ],
  phase_d_compression_second_pass: [
    "Second Pass â€” Oncology weighted review",
    "Second Pass â€” LUTS / BPH weighted review",
    "Second Pass â€” Stones weighted review",
    "Second Pass â€” Selected pediatrics weighted review",
    "Second Pass â€” Weak areas weighted review",
  ],
  phase_e_final_board_push: [
    "Final Review â€” Prostate / bladder",
    "Final Review â€” Stones / LUTS",
    "Final Review â€” Pediatrics / andrology",
    "Final Review â€” Weak areas / misses",
  ],
};

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseIso(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(iso: string, count: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + count);
  return toIsoDate(d);
}

const DOWS: Dow[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function getDow(iso: string): Dow {
  return DOWS[parseIso(iso).getDay()];
}

function inRange(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end;
}

function enumerateDates(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function getPhaseId(iso: string): PhaseId {
  const phase = PHASES.find((p) => inRange(iso, p.start, p.end));
  if (!phase) {
    // exam day fallback
    return "phase_e_final_board_push";
  }
  return phase.id;
}

function weekNumberFromStart(iso: string): number {
  const start = parseIso(START_DATE).getTime();
  const current = parseIso(iso).getTime();
  const diffDays = Math.floor((current - start) / 86_400_000);
  return Math.floor(diffDays / 7) + 1;
}

function chapterPages(start: number, end: number): number {
  return end >= start ? end - start + 1 : 1;
}

function buildCoverageUnits(targetPages = 31): CoverageUnit[] {
  const units: CoverageUnit[] = [];

  for (const [chapter, start, end] of INCLUDED_CHAPTERS) {
    let cursor = start;
    const safeEnd = end >= start ? end : start;

    while (cursor <= safeEnd) {
      const unitEnd = Math.min(safeEnd, cursor + targetPages - 1);
      units.push({
        chapter,
        pageStart: cursor,
        pageEnd: unitEnd,
        pages: chapterPages(cursor, unitEnd),
      });
      cursor = unitEnd + 1;
    }
  }

  return units;
}

function pickAnchor(iso: string): string {
  const phase = getPhaseId(iso);
  const pool = ANCHOR_POOLS[phase];
  const index = weekNumberFromStart(iso) - 1;
  return pool[index % pool.length];
}

function buildQuestionTask(iso: string): SeedTask {
  const phase = getPhaseId(iso);

  if (phase === "phase_d_compression_second_pass") {
    return {
      taskType: "question_block",
      title: "QBank â€” Mixed weighted block",
      description: "20â€“25 Ø³Ø¤Ø§Ù„ mixed Ø¨Ø± Ø§Ø³Ø§Ø³ oncology / LUTS / stones / weak areas.",
      estimatedMinutes: 75,
      priority: 2,
      targetCount: 25,
    };
  }

  if (phase === "phase_e_final_board_push") {
    return {
      taskType: "question_block",
      title: "QBank â€” Final mixed / incorrects / marked",
      description: "25â€“40 Ø³Ø¤Ø§Ù„ Ù…Ø±ÙˆØ±Ù…Ø­ÙˆØ± Ø§Ø² incorrects, marked, weak areas Ùˆ high-yield domains.",
      estimatedMinutes: 75,
      priority: 2,
      targetCount: 30,
    };
  }

  return {
    taskType: "question_block",
    title: "QBank â€” Targeted block",
    description: "15â€“20 Ø³Ø¤Ø§Ù„ Ù‡Ø¯ÙÙ…Ù†Ø¯ Ø§Ø² coverage Ø§Ù…Ø±ÙˆØ² + anchor Ù‡ÙØªÚ¯ÛŒ.",
    estimatedMinutes: 75,
    priority: 2,
    targetCount: 20,
  };
}

function buildImportTask(iso: string): SeedTask {
  const phase = getPhaseId(iso);

  if (phase === "phase_e_final_board_push") {
    return {
      taskType: "custom_task",
      title: "Import / Note Processing â€” minimal",
      description: "ÙÙ‚Ø· note anchor ÛŒØ§ quick recap Ø§Ø² Ù‡Ù…Ø§Ù† Ù…Ø­ØªÙˆØ§ÛŒ Ø§Ù…Ø±ÙˆØ². backlog Ù†Ø³Ø§Ø².",
      estimatedMinutes: 15,
      priority: 0,
    };
  }

  return {
    taskType: "custom_task",
    title: "Import / Note Processing",
    description: "ÙÙ‚Ø· Ø¨Ø±Ø§ÛŒ Ù…Ø­ØªÙˆØ§ÛŒ Ù‡Ù…Ø§Ù† Ø±ÙˆØ²: note anchor / quick recap / flashcard seed. backlog Ù†Ø³Ø§Ø².",
    estimatedMinutes: 30,
    priority: 1,
  };
}

function buildFsrsTask(): SeedTask {
  return {
    taskType: "flashcard_review",
    title: "FSRS Due â€” finish due queue",
    description: "Ù‡Ù…Ù‡ dueÙ‡Ø§ÛŒ Ø§Ù…Ø±ÙˆØ² Ø±Ø§ ØªØ§ Ø­Ø¯ Ù…Ù…Ú©Ù† Ø¨Ù‡ ØµÙØ± Ø¨Ø±Ø³Ø§Ù†. Ø§Ú¯Ø± backlog Ø¨Ø§Ù„Ø§ Ø¨ÙˆØ¯ new cards Ø±Ø§ Ù‚Ø·Ø¹ Ú©Ù†.",
    estimatedMinutes: 45,
    priority: 2,
  };
}

function buildMainStudyTask(iso: string, unitMap: Map<string, CoverageUnit>): SeedTask {
  if (iso <= FIRST_PASS_END) {
    const unit = unitMap.get(iso);
    if (unit) {
      return {
        taskType: "custom_task",
        title: buildCoverageTitle(unit.chapter, unit.pageStart, unit.pageEnd),
        description: `Ø¨Ù„ÙˆÚ© Ù¾ÙˆØ´Ø´ Ø¯ÙˆØ± Ø§ÙˆÙ„. Ù‡Ø¯Ù: Ø®ÙˆØ§Ù†Ø¯Ù† ÙØ¹Ø§Ù„ + Ø­Ø§Ø´ÛŒÙ‡â€ŒÙ†ÙˆÛŒØ³ÛŒ Ø³Ø¨Ú© + ØªÙˆÙ‚Ù Ù†Ú©Ø±Ø¯Ù† Ø±ÙˆÛŒ perfectionism.`,
        estimatedMinutes: 180,
        priority: 2,
      };
    }

    return {
      taskType: "custom_task",
      title: "Coverage Buffer / Carry-over",
      description: "Ø¨Ø±Ø§ÛŒ Ø±ÙˆØ² buffer ÙØ§Ø² Ø§ÙˆÙ„: Ø¹Ù‚Ø¨â€ŒØ§ÙØªØ§Ø¯Ú¯ÛŒâ€ŒÙ‡Ø§ÛŒ coverage Ø±Ø§ Ø¨Ø¨Ù†Ø¯ ÛŒØ§ unit Ù†ÛŒÙ…Ù‡â€ŒØªÙ…Ø§Ù… Ø±Ø§ Ø¬Ù…Ø¹ Ú©Ù†.",
      estimatedMinutes: 180,
      priority: 2,
    };
  }

  if (iso <= PHASE_D_END) {
    return {
      taskType: "custom_task",
      title: "Weighted Review Block",
      description: "Second pass weighted review Ø±ÙˆÛŒ domains Ø¨Ø§ ÙˆØ²Ù† Ø¨Ø§Ù„Ø§: oncology / LUTS / stones / selected peds.",
      estimatedMinutes: 180,
      priority: 2,
    };
  }

  return {
    taskType: "custom_task",
    title: "Rapid Review Block",
    description: "Ù…Ø±ÙˆØ± Ø³Ø±ÛŒØ¹ Ùˆ ÙØ´Ø±Ø¯Ù‡ ÙÙ‚Ø· Ø±ÙˆÛŒ high-yield, weak areas, incorrects Ùˆ Ù…Ø±ÙˆØ±Ù‡Ø§ÛŒ final.",
    estimatedMinutes: 180,
    priority: 2,
  };
}

function buildAnchorTask(iso: string): SeedTask {
  return {
    taskType: "custom_task",
    title: pickAnchor(iso),
    description: "Ø¨Ù„ÙˆÚ© anchor Ø¨Ø±Ø§ÛŒ Ø¬Ù„ÙˆÚ¯ÛŒØ±ÛŒ Ø§Ø² sequential trap Ùˆ Ø­ÙØ¸ exposure Ù…Ø¯Ø§ÙˆÙ… Ø¨Ù‡ domains Ù¾Ø±Ø¨Ø§Ø²Ø¯Ù‡.",
    estimatedMinutes: 75,
    priority: 2,
  };
}

function buildLightDayTasks(iso: string): SeedTask[] {
  const week = weekNumberFromStart(iso);

  const tasks: SeedTask[] = [
    {
      taskType: "custom_task",
      title: `Week ${week} â€” Catch-up / Backlog Close`,
      description: "Ø±ÙˆØ² Ø³Ø¨Ú©: ÙÙ‚Ø· Ø¹Ù‚Ø¨â€ŒØ§ÙØªØ§Ø¯Ú¯ÛŒâ€ŒÙ‡Ø§ØŒ Ù†ÛŒÙ…Ù‡â€ŒÚ©Ø§Ø±Ù‡â€ŒÙ‡Ø§ Ùˆ carry-overÙ‡Ø§ Ø±Ø§ Ø¨Ø¨Ù†Ø¯.",
      estimatedMinutes: 120,
      priority: 2,
    },
    {
      taskType: "question_block",
      title: "QBank â€” Incorrects / marked review",
      description: "Ù…Ø±ÙˆØ± Ø³Ø¤Ø§Ù„â€ŒÙ‡Ø§ÛŒ ØºÙ„Ø·ØŒ marked Ùˆ explanationÙ‡Ø§ÛŒ Ù…Ù‡Ù… Ù‡ÙØªÙ‡.",
      estimatedMinutes: 45,
      priority: 1,
      targetCount: 15,
    },
    {
      taskType: "custom_task",
      title: `Week ${week} â€” Weekly Audit + Replan`,
      description: "Ø¨Ø±Ø±Ø³ÛŒ weak domainsØŒ overduesØŒ due backlog Ùˆ ØªÙ†Ø¸ÛŒÙ… Ù‡ÙØªÙ‡ Ø¨Ø¹Ø¯.",
      estimatedMinutes: 45,
      priority: 1,
    },
    {
      taskType: "custom_task",
      title: "Import hygiene / quick tagging",
      description: "ÙÙ‚Ø· Ù…Ø±ØªØ¨â€ŒØ³Ø§Ø²ÛŒ importÙ‡Ø§ÛŒ Ù‡Ù…Ø§Ù† Ù‡ÙØªÙ‡. Ú†ÛŒØ²ÛŒ Ø±Ø§ Ø§Ø² Ù†Ùˆ Ù†Ø³Ø§Ø².",
      estimatedMinutes: 15,
      priority: 0,
    },
  ];

  if (ENABLE_FIXED_FSRS_RAIL) {
    tasks.splice(1, 0, {
      taskType: "flashcard_review",
      title: "FSRS Cleanup â€” light day",
      description: "Ø¬Ù…Ø¹â€ŒÚ©Ø±Ø¯Ù† due backlog Ùˆ lapse-heavy cards.",
      estimatedMinutes: 60,
      priority: 2,
    });
  }

  return tasks;
}

function buildExamDayTasks(): SeedTask[] {
  return [
    {
      taskType: "custom_task",
      title: "Board of Urology â€” Exam Day",
      description: "Ø±ÙˆØ² Ø¢Ø²Ù…ÙˆÙ†. Ù…Ø·Ø§Ù„Ø¹Ù‡ Ø³Ù†Ú¯ÛŒÙ† Ø§Ù†Ø¬Ø§Ù… Ù†Ø¯Ù‡. ÙÙ‚Ø· warm-up Ø°Ù‡Ù†ÛŒ Ùˆ Ø¢Ø±Ø§Ù…Ø´.",
      estimatedMinutes: 15,
      priority: 2,
    },
  ];
}

function buildTasksForDate(iso: string, unitMap: Map<string, CoverageUnit>): SeedTask[] {
  if (iso === EXAM_DATE) {
    return buildExamDayTasks();
  }

  if (getDow(iso) === LIGHT_DAY) {
    return buildLightDayTasks(iso);
  }

  const tasks: SeedTask[] = [];

  tasks.push(buildMainStudyTask(iso, unitMap));
  tasks.push(buildAnchorTask(iso));

  if (ENABLE_FIXED_FSRS_RAIL) {
    tasks.push(buildFsrsTask());
  }

  tasks.push(buildQuestionTask(iso));
  tasks.push(buildImportTask(iso));

  tasks.push({
    taskType: "custom_task",
    title: "Daily Audit / Tomorrow Prep",
    description: "Ø¨Ø±Ø±Ø³ÛŒ carry-overØŒ ØªØ¹ÛŒÛŒÙ† ÙØ±Ø¯Ø§ØŒ Ùˆ Ø¬Ù„ÙˆÚ¯ÛŒØ±ÛŒ Ø§Ø² Ù¾Ø®Ø´â€ŒØ´Ø¯Ù† ØªØ³Ú©â€ŒÙ‡Ø§.",
    estimatedMinutes: 15,
    priority: 0,
  });

  return tasks;
}

function main() {
  console.log("Seeding board master plan...");
  console.log("Plan title:", PLAN_TITLE);
  console.log("Start:", START_DATE, "Exam:", EXAM_DATE);
  console.log("Fixed FSRS rail:", ENABLE_FIXED_FSRS_RAIL ? "ON" : "OFF (using your existing virtual FSRS planner tasks)");
  console.log("Note: chapter 146 excluded from coverage because its page range is broken in the source data.");

  // 1) delete same-title plan if exists
  const sameTitlePlans = listPlans().filter((p) => p.title === PLAN_TITLE);
  for (const p of sameTitlePlans) {
    console.log(`Deleting old plan with same title: ${p.id}`);
    deletePlan(p.id);
  }

  // 2) pause any other active plans
  const activePlans = listPlans().filter((p) => p.status === "active");
  for (const p of activePlans) {
    console.log(`Pausing active plan: ${p.id} (${p.title})`);
    updatePlan(p.id, { status: "paused" });
  }

  // 3) planner settings
  upsertSettings({
    dailyGoalMinutes: DAILY_GOAL_MINUTES,
    preferredStartTime: "08:00",
    restDaysJson: [LIGHT_DAY],
    notificationsEnabled: 1,
    autoReschedule: 0,
    defaultTaskDurationMinutes: DEFAULT_TASK_DURATION_MINUTES,
  });

  // 4) create master plan
  const plan = createPlan({
  id: generateId("plan"),
  title: PLAN_TITLE,
  description:
    "Campbell-driven, ABU-informed, FSRS-integrated board plan seeded automatically from 2026-03-16 through exam day.",
  status: "active",
  startDate: START_DATE,
  endDate: EXAM_DATE,
  selectedChapterIdsJson: null,
  goalJson: null,
  repeatPattern: "board-master-v1",
});// 5) create all days
  const allDates = enumerateDates(START_DATE, EXAM_DATE);
  createDaysBatch(
    allDates.map((iso) => ({
      id: generateId("day"),
      planId: plan.id,
      date: iso,
      dayOfWeek: getDow(iso),
      isRestDay: 0,
    })),
  );

  const days = listDaysByPlan(plan.id);
  const dayMap = new Map(days.map((d) => [d.date, d] as const));

  // 6) build coverage units and map them onto non-Friday dates through first pass
  const coverageUnits = buildCoverageUnits(31);
  const firstPassStudyDates = allDates.filter(
    (iso) => iso <= FIRST_PASS_END && getDow(iso) !== LIGHT_DAY,
  );

  if (coverageUnits.length > firstPassStudyDates.length) {
    throw new Error(
      `Coverage units (${coverageUnits.length}) exceed available first-pass study dates (${firstPassStudyDates.length}). Reduce unit size or extend first pass.`,
    );
  }

  const unitMap = new Map<string, CoverageUnit>();
  for (let i = 0; i < firstPassStudyDates.length; i++) {
    const iso = firstPassStudyDates[i];
    const unit = coverageUnits[i];
    if (unit) unitMap.set(iso, unit);
  }

  // 7) create tasks day by day
  let taskCount = 0;

  for (const iso of allDates) {
    const day = dayMap.get(iso);
    if (!day) {
      throw new Error(`Day row missing for ${iso}`);
    }

    const tasks = buildTasksForDate(iso, unitMap);

    tasks.forEach((t, index) => {
      createTask({
        id: generateId("task"),
        planId: plan.id,
        dayId: day.id,
        taskType: t.taskType,
        status: "pending",
        title: t.title,
        description: t.description,
        sortOrder: index,
        estimatedMinutes: t.estimatedMinutes,
        targetCount: t.targetCount ?? null,
        priority: t.priority,
      });
      taskCount++;
    });

    recalcDayProgress(day.id);
  }

  // 8) final recalc
  recalcPlanProgress(plan.id);

  const totalPages = coverageUnits.reduce((sum, u) => sum + u.pages, 0);

  console.log("");
  console.log("DONE");
  console.log("Plan ID:", plan.id);
  console.log("Days created:", allDates.length);
  console.log("Tasks created:", taskCount);
  console.log("Coverage units:", coverageUnits.length);
  console.log("Coverage pages (seeded):", totalPages);
  console.log("Open /planner in your app.");
}

main();
