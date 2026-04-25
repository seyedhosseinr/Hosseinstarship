/**
 * Hossein Starship — NOTE CONTRACT v8.0 (types)
 *
 * Safe evolution of v7.5.
 *
 * Constitution:
 *   - Topology stays: segment → section → block.
 *   - Canonical block fields stay: blockId, blockType, title, content.
 *   - blockType is the SINGLE primary semantic authority.
 *   - content is REQUIRED, non-empty, canonical. It is the anchoring backbone.
 *   - display is a CONTROLLED structured projection (no free AST, no nodes[]).
 *   - flags carry non-derivable author intent only.
 *   - Derived booleans (hasTable, hasMermaid, hasInteractive) are NEVER stored.
 *     They live only in computed helpers — see note-v8-queries.ts.
 *   - Hashes (contentHash, segmentHash) are computed at import/runtime.
 *     Authors MUST NOT supply them.
 */

export const NOTE_V8_SCHEMA_VERSION = "8.0" as const;
export type NoteV8SchemaVersion = typeof NOTE_V8_SCHEMA_VERSION;

/** Block-level primary semantic authority. */
export const BLOCK_TYPES_V8 = [
  "concept",
  "trap",
  "clinical_decision",
  "interactive_algorithm",
  "threshold",
  "differential",
  "complication",
  "indication",
  "follow_up",
] as const;
export type BlockTypeV8 = (typeof BLOCK_TYPES_V8)[number];

/** Callout kinds. `clinical_pearl` replaces the v7.5 `clinicalPearl` field. */
export const CALLOUT_KINDS_V8 = ["clinical_pearl", "warning", "tip"] as const;
export type CalloutKindV8 = (typeof CALLOUT_KINDS_V8)[number];

export interface TableDataV8 {
  headers: string[];
  /** Every row MUST have rows[r].length === headers.length. */
  rows: string[][];
}

export interface InteractiveOptionV8 {
  label: string;
  /** id of the next step in `InteractiveDataV8.steps`, or null for terminal. */
  nextStepId: string | null;
  /** terminal outcome text (shown when nextStepId === null). */
  outcome: string | null;
}

export interface InteractiveStepV8 {
  prompt: string;
  /**
   * Branch options. MUST be non-empty for non-terminal (decision) steps.
   * For terminal "result" steps the array MAY be empty, in which case
   * `finalMessage` carries the outcome text. This matches the legacy v7.5
   * NOTE contract's terminal-node shape and is what the v7.5→v8 adapter
   * preserves verbatim during migration (no fake-option synthesis).
   */
  options: InteractiveOptionV8[];
  /**
   * Outcome text for a terminal "result" step. Required (non-empty string)
   * when `options` is empty; optional otherwise (branch steps can omit it).
   * Null is treated identically to absent. Never `""`.
   */
  finalMessage?: string | null;
}

export interface InteractiveDataV8 {
  initialStepId: string;
  /** Record keyed by stepId. Every `nextStepId` must resolve to a key here. */
  steps: Record<string, InteractiveStepV8>;
}

export interface CalloutV8 {
  kind: CalloutKindV8;
  text: string;
  /** Display order. 0-based. */
  order: number;
}

/**
 * Structured display payload. Every key is required to be present
 * (either a value or null) so validators never need to branch on presence.
 *
 * `mermaid` is DSL and is exempt from the content-substring invariant.
 * All other text fields should be traceable back to `content`.
 */
export interface BlockDisplayV8 {
  listItems: string[] | null;
  tableData: TableDataV8 | null;
  mermaid: string | null;
  interactiveData: InteractiveDataV8 | null;
  callouts: CalloutV8[] | null;
}

/**
 * Author intent flags. Derived booleans (hasTable/hasMermaid/hasInteractive)
 * are NEVER stored here — they are computed by helpers in note-v8-queries.ts.
 */
export interface BlockFlagsV8 {
  highYield: boolean;
  decisionChanging: boolean;
  examRelevant: boolean;
}

export interface BlockV8 {
  blockId: string;
  blockType: BlockTypeV8;
  title: string;
  /** REQUIRED, non-empty. Canonical text backbone for anchoring + fallback rendering. */
  content: string;
  display: BlockDisplayV8;
  flags: BlockFlagsV8;
  /**
   * sha256 digest of normalized `content`. Runtime/importer-computed.
   * Authors MUST NOT supply this. Optional on input; populated on ingest.
   */
  contentHash?: string;
}

export interface SectionV8 {
  heading: string;
  blocks: BlockV8[];
}

export interface SegmentNoteV8 {
  schemaVersion: NoteV8SchemaVersion;
  segmentId: string;
  sections: SectionV8[];
  /** Runtime-computed. Authors MUST NOT supply. */
  segmentHash?: string;
}

// ─── Factory helpers (kept pure, no side effects) ────────────────────────────

export function emptyDisplayV8(): BlockDisplayV8 {
  return {
    listItems: null,
    tableData: null,
    mermaid: null,
    interactiveData: null,
    callouts: null,
  };
}

export function emptyFlagsV8(): BlockFlagsV8 {
  return {
    highYield: false,
    decisionChanging: false,
    examRelevant: false,
  };
}

// ─── Type guards ─────────────────────────────────────────────────────────────

export function isBlockTypeV8(v: unknown): v is BlockTypeV8 {
  return typeof v === "string" && (BLOCK_TYPES_V8 as readonly string[]).includes(v);
}

export function isCalloutKindV8(v: unknown): v is CalloutKindV8 {
  return typeof v === "string" && (CALLOUT_KINDS_V8 as readonly string[]).includes(v);
}

/**
 * Best-effort structural check. Does NOT perform the per-blockType matrix.
 * Use the Zod schema in note-v8-schema.ts for full validation.
 */
export function looksLikeSegmentNoteV8(v: unknown): v is SegmentNoteV8 {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    o.schemaVersion === NOTE_V8_SCHEMA_VERSION &&
    typeof o.segmentId === "string" &&
    Array.isArray(o.sections)
  );
}
