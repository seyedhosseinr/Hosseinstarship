/**
 * Hossein Starship — NOTE CONTRACT v8.0 (Zod validator)
 *
 * Enforces:
 *   - required/optional/forbidden matrix per blockType
 *   - content required and non-empty
 *   - interactiveData graph integrity (initialStepId resolves, nextStepId resolves)
 *   - callout ordering sane
 *   - table row width matches header count
 *
 * Does NOT enforce the substring-in-content invariant at Zod level — that is
 * handled by an optional linter pass `lintContentSubstringInvariant` below so
 * that authoring tools can treat it as a warning during migration while
 * production imports can still opt into strict mode.
 */

import { z } from "zod";
import {
  BLOCK_TYPES_V8,
  CALLOUT_KINDS_V8,
  NOTE_V8_SCHEMA_VERSION,
  type BlockDisplayV8,
  type BlockFlagsV8,
  type BlockTypeV8,
  type BlockV8,
  type InteractiveDataV8,
  type SegmentNoteV8,
  type TableDataV8,
} from "./note-v8.types";

// ─── Leaf schemas ────────────────────────────────────────────────────────────

const BlockTypeZ = z.enum(BLOCK_TYPES_V8 as unknown as [BlockTypeV8, ...BlockTypeV8[]]);
const CalloutKindZ = z.enum(CALLOUT_KINDS_V8 as unknown as [
  typeof CALLOUT_KINDS_V8[number],
  ...typeof CALLOUT_KINDS_V8[number][],
]);

const TableDataZ: z.ZodType<TableDataV8> = z
  .object({
    headers: z.array(z.string().min(1)).min(1),
    rows: z.array(z.array(z.string())).min(1),
  })
  .strict()
  .refine((t) => t.rows.every((r) => r.length === t.headers.length), {
    message: "every row must have the same number of cells as headers",
  });

const InteractiveOptionZ = z
  .object({
    label: z.string().min(1),
    nextStepId: z.string().min(1).nullable(),
    outcome: z.string().nullable(),
  })
  .strict();

// Interactive step rule (v8.2.1, preserving legacy v7.5 terminal shape):
//   - non-terminal step        → options.length >= 1
//   - terminal "result" step   → options may be [] AND finalMessage must be
//                                non-empty string
// `finalMessage` is optional and nullable on branch steps (they don't need it),
// but REQUIRED (non-empty) when options is empty — enforced by the refinement.
const InteractiveStepZ = z
  .object({
    prompt: z.string().min(1),
    options: z.array(InteractiveOptionZ),
    finalMessage: z.string().min(1).nullable().optional(),
  })
  .strict()
  .refine(
    (s) => {
      if (s.options.length > 0) return true;
      return typeof s.finalMessage === "string" && s.finalMessage.length > 0;
    },
    {
      message:
        "terminal step (options: []) requires a non-empty finalMessage",
      path: ["finalMessage"],
    },
  );

const InteractiveDataZ: z.ZodType<InteractiveDataV8> = z
  .object({
    initialStepId: z.string().min(1),
    steps: z.record(z.string().min(1), InteractiveStepZ),
  })
  .strict()
  .refine((d) => Object.prototype.hasOwnProperty.call(d.steps, d.initialStepId), {
    message: "initialStepId must exist as a key in steps",
  })
  .refine(
    (d) =>
      Object.values(d.steps).every((step) =>
        step.options.every(
          (opt) =>
            opt.nextStepId === null ||
            Object.prototype.hasOwnProperty.call(d.steps, opt.nextStepId),
        ),
      ),
    { message: "every non-null nextStepId must resolve to an existing step" },
  );

const CalloutZ = z
  .object({
    kind: CalloutKindZ,
    text: z.string().min(1),
    order: z.number().int().nonnegative(),
  })
  .strict();

const BlockDisplayZ: z.ZodType<BlockDisplayV8> = z
  .object({
    listItems: z.array(z.string().min(1)).min(1).nullable(),
    tableData: TableDataZ.nullable(),
    mermaid: z.string().min(1).nullable(),
    interactiveData: InteractiveDataZ.nullable(),
    callouts: z.array(CalloutZ).min(1).nullable(),
  })
  .strict();

const BlockFlagsZ: z.ZodType<BlockFlagsV8> = z
  .object({
    highYield: z.boolean(),
    decisionChanging: z.boolean(),
    examRelevant: z.boolean(),
  })
  .strict();

// ─── Per-blockType matrix enforcement ───────────────────────────────────────
//
// Lookups:
//   "required" → the field MUST be non-null
//   "optional" → the field may be null or non-null
//   "forbidden" → the field MUST be null

type Matrix = Record<
  BlockTypeV8,
  {
    listItems: "required" | "optional" | "forbidden";
    tableData: "required" | "optional" | "forbidden";
    mermaid: "required" | "optional" | "forbidden";
    interactiveData: "required" | "optional" | "forbidden";
    callouts: "required" | "optional" | "forbidden";
    /** Extra semantic rules that can't be expressed by the simple matrix. */
    extra?: Array<(display: BlockDisplayV8) => string | null>;
  }
>;

const mustHaveWarningCallout = (d: BlockDisplayV8): string | null => {
  if (!d.callouts || !d.callouts.some((c) => c.kind === "warning")) {
    return "trap blocks require at least one callout with kind=warning";
  }
  return null;
};

export const BLOCK_TYPE_MATRIX_V8: Matrix = {
  concept: {
    listItems: "optional",
    tableData: "optional",
    mermaid: "optional",
    interactiveData: "forbidden",
    callouts: "optional",
  },
  trap: {
    listItems: "optional",
    tableData: "forbidden",
    mermaid: "forbidden",
    interactiveData: "forbidden",
    callouts: "required",
    extra: [mustHaveWarningCallout],
  },
  clinical_decision: {
    listItems: "optional",
    tableData: "optional",
    mermaid: "optional",
    interactiveData: "optional",
    callouts: "optional",
  },
  interactive_algorithm: {
    listItems: "forbidden",
    tableData: "forbidden",
    mermaid: "required",
    interactiveData: "required",
    callouts: "optional",
  },
  threshold: {
    // Per contract §10: threshold does NOT require a table.
    listItems: "optional",
    tableData: "optional",
    mermaid: "forbidden",
    interactiveData: "forbidden",
    callouts: "optional",
  },
  differential: {
    listItems: "optional",
    tableData: "required",
    mermaid: "forbidden",
    interactiveData: "forbidden",
    callouts: "optional",
  },
  complication: {
    listItems: "optional",
    tableData: "optional",
    mermaid: "forbidden",
    interactiveData: "forbidden",
    callouts: "optional",
  },
  indication: {
    listItems: "required",
    tableData: "optional",
    mermaid: "forbidden",
    interactiveData: "forbidden",
    callouts: "optional",
  },
  follow_up: {
    listItems: "optional",
    tableData: "optional",
    mermaid: "forbidden",
    interactiveData: "forbidden",
    callouts: "optional",
  },
};

function enforceMatrix(
  blockType: BlockTypeV8,
  display: BlockDisplayV8,
  ctx: z.RefinementCtx,
): void {
  const rules = BLOCK_TYPE_MATRIX_V8[blockType];
  const check = (
    key: keyof Omit<typeof rules, "extra">,
    value: unknown,
  ) => {
    const rule = rules[key];
    const isSet = value !== null && value !== undefined;
    if (rule === "required" && !isSet) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["display", key],
        message: `display.${key} is required for blockType="${blockType}"`,
      });
    }
    if (rule === "forbidden" && isSet) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["display", key],
        message: `display.${key} is forbidden for blockType="${blockType}"`,
      });
    }
  };
  check("listItems", display.listItems);
  check("tableData", display.tableData);
  check("mermaid", display.mermaid);
  check("interactiveData", display.interactiveData);
  check("callouts", display.callouts);
  if (rules.extra) {
    for (const rule of rules.extra) {
      const err = rule(display);
      if (err) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["display"],
          message: err,
        });
      }
    }
  }
}

// ─── Block / Section / Segment ──────────────────────────────────────────────

const BlockZ: z.ZodType<BlockV8> = z
  .object({
    blockId: z.string().min(1),
    blockType: BlockTypeZ,
    title: z.string().min(1).max(300),
    content: z
      .string()
      .min(1, "content is required and must be non-empty")
      .refine((s) => s.trim().length > 0, {
        message: "content must not be only whitespace",
      }),
    display: BlockDisplayZ,
    flags: BlockFlagsZ,
    contentHash: z.string().optional(),
  })
  .strict()
  .superRefine((block, ctx) => {
    enforceMatrix(block.blockType, block.display, ctx);
  });

const SectionZ = z
  .object({
    heading: z.string().min(1),
    blocks: z.array(BlockZ).min(1),
  })
  .strict();

export const SegmentNoteV8Z: z.ZodType<SegmentNoteV8> = z
  .object({
    schemaVersion: z.literal(NOTE_V8_SCHEMA_VERSION),
    segmentId: z.string().min(1),
    sections: z.array(SectionZ).min(1),
    segmentHash: z.string().optional(),
  })
  .strict()
  .superRefine((seg, ctx) => {
    // blockId uniqueness within the segment
    const seen = new Set<string>();
    seg.sections.forEach((section, si) => {
      section.blocks.forEach((block, bi) => {
        if (seen.has(block.blockId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["sections", si, "blocks", bi, "blockId"],
            message: `duplicate blockId "${block.blockId}"`,
          });
        }
        seen.add(block.blockId);
      });
    });
  });

export type ParsedSegmentNoteV8 = z.infer<typeof SegmentNoteV8Z>;

// ─── Public validation entry points ─────────────────────────────────────────

export interface ValidationIssueV8 {
  path: (string | number)[];
  message: string;
}

export interface ValidationResultV8 {
  valid: boolean;
  data?: SegmentNoteV8;
  issues: ValidationIssueV8[];
  blockCount: number;
}

/**
 * Strict v8.0 validator. Returns a structured result instead of throwing
 * so callers can render issues in migration/import UIs.
 */
export function validateSegmentNoteV8(input: unknown): ValidationResultV8 {
  const parsed = SegmentNoteV8Z.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      issues: parsed.error.issues.map((i) => ({
        path: i.path as (string | number)[],
        message: i.message,
      })),
      blockCount: 0,
    };
  }
  const blockCount = parsed.data.sections.reduce((n, s) => n + s.blocks.length, 0);
  return { valid: true, data: parsed.data, issues: [], blockCount };
}

/**
 * Quick detector. Used to route between v7.5 and v8.0 pipelines BEFORE
 * paying the cost of full Zod validation.
 */
export function isNoteV8Json(input: unknown): input is Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const obj = input as Record<string, unknown>;
  return (
    obj.schemaVersion === NOTE_V8_SCHEMA_VERSION &&
    typeof obj.segmentId === "string" &&
    Array.isArray(obj.sections)
  );
}

// ─── Optional linter: substring-in-content invariant ────────────────────────
//
// Not a Zod rule because migrated v7.5 data will not always satisfy it.
// Use this as a WARNING pass in authoring tools / strict production imports.
// Mermaid is exempt (DSL, not prose).

function normalize(s: string): string {
  return s.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
}

export interface SubstringLintIssue {
  blockId: string;
  path: string;
  missingText: string;
}

export function lintContentSubstringInvariant(seg: SegmentNoteV8): SubstringLintIssue[] {
  const issues: SubstringLintIssue[] = [];

  for (const section of seg.sections) {
    for (const block of section.blocks) {
      const hay = normalize(block.content);
      const inside = (s: string) => hay.includes(normalize(s));
      const record = (path: string, missing: string) => {
        issues.push({ blockId: block.blockId, path, missingText: missing });
      };

      block.display.listItems?.forEach((item, i) => {
        if (!inside(item)) record(`display.listItems[${i}]`, item);
      });
      block.display.tableData?.rows.forEach((row, r) => {
        row.forEach((cell, c) => {
          if (cell && !inside(cell)) record(`display.tableData.rows[${r}][${c}]`, cell);
        });
      });
      block.display.callouts?.forEach((co, i) => {
        if (!inside(co.text)) record(`display.callouts[${i}].text`, co.text);
      });
      if (block.display.interactiveData) {
        for (const [sid, step] of Object.entries(block.display.interactiveData.steps)) {
          if (!inside(step.prompt)) {
            record(`display.interactiveData.steps.${sid}.prompt`, step.prompt);
          }
          step.options.forEach((opt, oi) => {
            if (!inside(opt.label)) {
              record(`display.interactiveData.steps.${sid}.options[${oi}].label`, opt.label);
            }
          });
        }
      }
      // mermaid is exempt by design.
    }
  }

  return issues;
}
