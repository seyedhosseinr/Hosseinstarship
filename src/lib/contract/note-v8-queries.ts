/**
 * Hossein Starship — NOTE v8.0 QUERY HELPERS
 *
 * Derived booleans (hasTable / hasMermaid / hasInteractive) are NOT stored
 * on disk. They are computed on the fly by these helpers. Everything here
 * is a pure function over in-memory v8 data — no DB, no network.
 *
 * If/when v8 blocks are persisted in `note_frames` with a payload JSON
 * column, these helpers can be used to build generated columns / expression
 * indexes without changing the storage contract.
 */

import type { BlockTypeV8, BlockV8, SegmentNoteV8 } from "./note-v8.types";

// ─── Derived-boolean selectors (never persisted) ─────────────────────────────

export function hasTable(b: BlockV8): boolean {
  return b.display.tableData !== null;
}

export function hasMermaid(b: BlockV8): boolean {
  return b.display.mermaid !== null;
}

export function hasInteractive(b: BlockV8): boolean {
  return b.display.interactiveData !== null;
}

export function hasListItems(b: BlockV8): boolean {
  return b.display.listItems !== null;
}

export function hasCallouts(b: BlockV8): boolean {
  return b.display.callouts !== null && b.display.callouts.length > 0;
}

// ─── Flat iteration ──────────────────────────────────────────────────────────

export function* iterateBlocks(seg: SegmentNoteV8): Generator<BlockV8, void, undefined> {
  for (const section of seg.sections) {
    for (const block of section.blocks) {
      yield block;
    }
  }
}

export function toFlatBlocks(seg: SegmentNoteV8): BlockV8[] {
  return [...iterateBlocks(seg)];
}

// ─── Filters ─────────────────────────────────────────────────────────────────

export function filterByBlockType(seg: SegmentNoteV8, t: BlockTypeV8): BlockV8[] {
  return toFlatBlocks(seg).filter((b) => b.blockType === t);
}

export const allInteractiveAlgorithmBlocks = (seg: SegmentNoteV8) =>
  filterByBlockType(seg, "interactive_algorithm");

export const allDifferentialBlocks = (seg: SegmentNoteV8) =>
  filterByBlockType(seg, "differential");

export const allThresholdBlocks = (seg: SegmentNoteV8) =>
  filterByBlockType(seg, "threshold");

export const allTrapBlocks = (seg: SegmentNoteV8) =>
  filterByBlockType(seg, "trap");

export function allMermaidBlocks(seg: SegmentNoteV8): BlockV8[] {
  return toFlatBlocks(seg).filter(hasMermaid);
}

export function allBlocksWithTable(seg: SegmentNoteV8): BlockV8[] {
  return toFlatBlocks(seg).filter(hasTable);
}

export function allBlocksWithInteractive(seg: SegmentNoteV8): BlockV8[] {
  return toFlatBlocks(seg).filter(hasInteractive);
}

export function allHighYieldBlocks(seg: SegmentNoteV8): BlockV8[] {
  return toFlatBlocks(seg).filter((b) => b.flags.highYield);
}

export function allDecisionChangingBlocks(seg: SegmentNoteV8): BlockV8[] {
  return toFlatBlocks(seg).filter((b) => b.flags.decisionChanging);
}

export function allExamRelevantBlocks(seg: SegmentNoteV8): BlockV8[] {
  return toFlatBlocks(seg).filter((b) => b.flags.examRelevant);
}

// ─── Counters (cheap) ────────────────────────────────────────────────────────

export interface V8SegmentStats {
  totalBlocks: number;
  byBlockType: Record<BlockTypeV8, number>;
  withTable: number;
  withMermaid: number;
  withInteractive: number;
  withCallouts: number;
  highYield: number;
  decisionChanging: number;
  examRelevant: number;
}

export function computeSegmentStats(seg: SegmentNoteV8): V8SegmentStats {
  const byBlockType: Record<BlockTypeV8, number> = {
    concept: 0,
    trap: 0,
    clinical_decision: 0,
    interactive_algorithm: 0,
    threshold: 0,
    differential: 0,
    complication: 0,
    indication: 0,
    follow_up: 0,
  };

  let totalBlocks = 0;
  let withTable = 0;
  let withMermaid = 0;
  let withInteractive = 0;
  let withCallouts = 0;
  let highYield = 0;
  let decisionChanging = 0;
  let examRelevant = 0;

  for (const b of iterateBlocks(seg)) {
    totalBlocks += 1;
    byBlockType[b.blockType] += 1;
    if (hasTable(b)) withTable += 1;
    if (hasMermaid(b)) withMermaid += 1;
    if (hasInteractive(b)) withInteractive += 1;
    if (hasCallouts(b)) withCallouts += 1;
    if (b.flags.highYield) highYield += 1;
    if (b.flags.decisionChanging) decisionChanging += 1;
    if (b.flags.examRelevant) examRelevant += 1;
  }

  return {
    totalBlocks,
    byBlockType,
    withTable,
    withMermaid,
    withInteractive,
    withCallouts,
    highYield,
    decisionChanging,
    examRelevant,
  };
}

// ─── Lookup by blockId ───────────────────────────────────────────────────────

export function findBlockById(seg: SegmentNoteV8, blockId: string): BlockV8 | null {
  for (const block of iterateBlocks(seg)) {
    if (block.blockId === blockId) return block;
  }
  return null;
}
