/**
 * Zod validation schemas for pipeline output files.
 * MCQ JSON, Flashcard JSON, Note HTML, Note JSON v7.5, Note JSON v8.0, Yield v1 + v2.
 */
import { z } from "zod";
import {
  SegmentNoteV8Z,
  isNoteV8Json,
  validateSegmentNoteV8,
} from "@/lib/contract/note-v8-schema";
import type { SegmentNoteV8 } from "@/lib/contract/note-v8.types";

/* ═══════════════════════════════════════════════════════════════
   MCQ Question Schema (question-system.md v4.0)
═══════════════════════════════════════════════════════════════ */

const mcqQuestionSchema = z.object({
  id: z.string().min(1),
  segmentId: z.string().optional(),
  stem: z.string().min(10, "stem must be at least 10 characters"),
  // Accept keyed object with letter keys (A-E) — at least 4 options required
  options: z.record(z.string().min(1)).refine(
    (obj) => {
      const keys = Object.keys(obj);
      return keys.length >= 4 && keys.every((k) => /^[A-H]$/.test(k));
    },
    { message: "options must have 4-5 letter keys (A, B, C, D, E)" },
  ),
  correctAnswer: z.string().regex(/^[A-H]$/, "correctAnswer must be a letter A-E"),
  // v6.1 files omit explanation — they use the review object instead.
  // structured-import builds explanationHtml from review.keyTeachingPoint.
  explanation: z.string().min(10, "explanation must be at least 10 characters").optional(),
  // v5.1 may omit difficulty; downstream DB accepts null.
  difficulty: z.string().min(1).optional(),
  tags: z.array(z.string()).optional().default([]),
  // v5.1 author fields (optional):
  sourceBlockIds: z.array(z.string()).optional().default([]),
  conceptLabels: z.array(z.string()).optional().default([]),
  sourceSectionTitles: z.array(z.string()).optional().default([]),
  sourceAnchorHints: z.array(z.string()).optional().default([]),
  relatedFlashcardHints: z.array(z.string()).optional().default([]),
  // legacy pipeline aliases (kept for older v4.0 files):
  sourceConceptIds: z.array(z.string()).optional().default([]),
  sourceFrameIds: z.array(z.string()).optional().default([]),
}).passthrough();

export const mcqFileSchema = z.object({
  schemaVersion: z.string().optional(),
  segmentId: z.string().optional(),
  questions: z.array(mcqQuestionSchema).min(1, "Must contain at least 1 question"),
}).passthrough();

export type MCQFile = z.infer<typeof mcqFileSchema>;

/* ═══════════════════════════════════════════════════════════════
   Flashcard Schema (flashcard-system.md v3.1 / v4.2)
═══════════════════════════════════════════════════════════════ */

const flashcardItemSchema = z.object({
  id: z.string().min(1),
  segmentId: z.string().optional(),
  // Accept any string type — pipeline may output "pitfall", "mechanism", "cloze", etc.
  // The DB normalizes unknown types to "basic" at insert time.
  type: z.string().min(1),
  front: z.string().min(3, "front must be at least 3 characters"),
  back: z.string().min(1, "back must not be empty"),
  tags: z.array(z.string()).optional().default([]),
  // v4.2 author fields (all optional):
  sourceBlockIds: z.array(z.string()).optional().default([]),
  conceptLabels: z.array(z.string()).optional().default([]),
  parentConceptLabel: z.string().optional(),
  clusterLabel: z.string().optional(),
  descriptorLabel: z.string().optional(),
  sourceSectionTitles: z.array(z.string()).optional().default([]),
  sourceAnchorHints: z.array(z.string()).optional().default([]),
  relatedQuestionHints: z.array(z.string()).optional().default([]),
  relatedFlashcardHints: z.array(z.string()).optional().default([]),
  // legacy pipeline aliases:
  sourceConceptIds: z.array(z.string()).optional().default([]),
  sourceFrameIds: z.array(z.string()).optional().default([]),
  sourceQuestionIds: z.array(z.string()).optional().default([]),
}).passthrough();

export const flashcardFileSchema = z.object({
  schemaVersion: z.string().optional(),
  segmentId: z.string().optional(),
  flashcards: z.array(flashcardItemSchema).min(1, "Must contain at least 1 flashcard"),
}).passthrough();

export type FlashcardFile = z.infer<typeof flashcardFileSchema>;

/* ═══════════════════════════════════════════════════════════════
   Note HTML Schema (note-system.md v3.1) — legacy HTML
═══════════════════════════════════════════════════════════════ */

const ALLOWED_TAGS = new Set([
  "section", "h2", "h3", "p", "ul", "ol", "li",
  "strong", "em", "table", "thead", "tbody", "tr", "th", "td",
]);

export function validateNoteHtml(html: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const trimmed = html.trim();

  if (trimmed.length < 50) {
    errors.push("Note HTML must be at least 50 characters");
  }
  if (!trimmed.startsWith("<")) {
    errors.push("Note must start with an HTML tag (first character must be <)");
  }
  if (!/<section[\s>]/i.test(trimmed)) {
    errors.push("Note must contain at least one <section> element");
  }
  if (!/<h2[\s>]/i.test(trimmed)) {
    errors.push("Note must contain at least one <h2> heading");
  }
  if (!/<p[\s>]|<ul[\s>]|<ol[\s>]/i.test(trimmed)) {
    errors.push("Note must contain block content (<p>, <ul>, or <ol>)");
  }

  // Check for disallowed tags
  const tagMatches = trimmed.match(/<\/?([a-z][a-z0-9]*)/gi) ?? [];
  const disallowed = new Set<string>();
  for (const match of tagMatches) {
    const tagName = match.replace(/<\/?/, "").toLowerCase();
    if (!ALLOWED_TAGS.has(tagName)) {
      disallowed.add(tagName);
    }
  }
  if (disallowed.size > 0) {
    errors.push(`Disallowed HTML tags found: ${[...disallowed].join(", ")}`);
  }

  // Check for attributes on tags (not allowed per note-system.md)
  if (/<[a-z][a-z0-9]*\s+[a-z]/i.test(trimmed)) {
    // More strict: only flag class/style/id attributes, not self-closing patterns
    if (/\s(class|style|id|data-|onclick|onload)=/i.test(trimmed)) {
      errors.push("HTML tags must not contain attributes (class, style, id, etc.)");
    }
  }

  return { valid: errors.length === 0, errors };
}

/* ═══════════════════════════════════════════════════════════════
   NOTE v7.5 JSON Schema (block-linked canonical)
═══════════════════════════════════════════════════════════════ */

// Actual NOTE v7.5 contract blockTypes (from NOTE.MD)
const VALID_BLOCK_TYPES = [
  "concept", "trap", "threshold", "indication",
  "differential", "algorithm", "clinical_decision",
  "complication", "follow_up", "high_yield",
  "interactive_algorithm",
] as const;

const noteBlockSchema = z.object({
  blockId: z.string().min(1, "blockId is required"),
  blockType: z.string().min(1, "blockType is required"),
  // title and content are "String | null" per the NOTE v7.5 contract
  title: z.string().nullable().default(""),
  content: z.string().nullable().default(""),
  // All optional fields must use .nullish() — JSON null is NOT the same as absent (undefined)
  listItems: z.array(z.union([z.string(), z.record(z.unknown())])).nullish(),
  tableData: z.union([z.record(z.unknown()), z.array(z.unknown())]).nullish(),
  mermaid: z.string().nullish(),
  interactiveData: z.record(z.unknown()).nullish(),
}).passthrough();

const noteSectionSchema = z.object({
  heading: z.string().min(1, "section heading is required"),
  blocks: z.array(noteBlockSchema).min(1, "section must have at least 1 block"),
}).passthrough();

export const noteV75Schema = z.object({
  schemaVersion: z.literal("7.5"),
  segmentId: z.string().min(1, "segmentId is required"),
  sections: z.array(noteSectionSchema).min(1, "must contain at least 1 section"),
}).passthrough();

export type NoteV75File = z.infer<typeof noteV75Schema>;

/* ═══════════════════════════════════════════════════════════════
   YIELD v1.0 Schema (legacy section-hint format)
═══════════════════════════════════════════════════════════════ */

const yieldCardV1Schema = z
  .object({
    id: z.string().optional(),
    chapterNo: z.union([z.number().int().positive(), z.string()]).optional(),
    segmentNo: z.union([z.number().int(), z.string()]).optional(),
    sourceDocId: z.string().optional(),
    sourceFrameId: z.string().optional(),
    sectionTitle: z.string().min(1, "sectionTitle is required"),
    cardTitle: z.string().default(""),
    summary: z.string().default(""),
    bullets: z.array(z.string()).default([]),
    anchorHints: z.array(z.string()).default([]),
    keyExamInfo: z.union([z.string(), z.number(), z.boolean()]).optional(),
    yieldTier: z.number().int().min(1).max(3).default(1),
    highYieldVisible: z.union([z.number(), z.boolean()]).optional(),
  })
  .refine(
    (card) => card.cardTitle.trim().length > 0 || card.summary.trim().length > 0,
    { message: "Each yield card must have cardTitle or summary" },
  );

const yieldWrapperV1Schema = z.object({
  chapterNo: z.union([z.number().int().positive(), z.string()]).optional(),
  segmentNo: z.union([z.number().int(), z.string()]).optional(),
  sourceDocId: z.string().optional(),
  cards: z.array(yieldCardV1Schema).min(1, "Must contain at least 1 yield card"),
});

export const yieldFileSchema = z.union([
  yieldWrapperV1Schema,
  z.array(yieldCardV1Schema).min(1, "Must contain at least 1 yield card"),
]);

export type YieldFile = z.infer<typeof yieldFileSchema>;

/* ═══════════════════════════════════════════════════════════════
   YIELD v2.0 Schema (block-anchored annotation contract)
═══════════════════════════════════════════════════════════════ */

// Exact vocabulary from Yield_v2.md ALLOWED REASON VALUES
const ALLOWED_YIELD_REASONS = [
  "management-changing",
  "staging-boundary",
  "threshold-cutoff",
  "next-step-management",
  "exam-trap",
  "contraindication",
  "diagnostic-discriminator",
  "complication-recognition",
  "prognostic-factor",
  "follow-up-rule",
  "supportive-concept",
  "low-yield-background",
] as const;

const yieldAnnotationV2Schema = z.object({
  id: z.string().min(1, "annotation id is required"),
  sourceBlockId: z.string().min(1, "sourceBlockId is required"),
  sourceSectionTitle: z.string().min(1, "sourceSectionTitle is required"),
  sourceBlockTitle: z.string().default(""),
  conceptLabels: z.array(z.string()).default([]),
  yieldTier: z.number().int().min(0).max(3),
  keyExamInfo: z.boolean(),
  highYieldVisible: z.boolean(),
  reasons: z.array(z.string()).default([]),
  summaryLabel: z.string().min(1, "summaryLabel is required"),
}).passthrough();

export const yieldV2Schema = z.object({
  segmentId: z.string().min(1, "segmentId is required"),
  annotations: z.array(yieldAnnotationV2Schema).min(1, "must contain at least 1 annotation"),
}).passthrough();

export type YieldV2File = z.infer<typeof yieldV2Schema>;

/* ═══════════════════════════════════════════════════════════════
   Detection: identify artifact schema from parsed JSON
═══════════════════════════════════════════════════════════════ */

export type DetectedArtifact =
  | { kind: "note_v8_0"; data: SegmentNoteV8 }
  | { kind: "note_v7_5"; data: NoteV75File }
  | { kind: "yield_v2"; data: YieldV2File }
  | { kind: "yield_v1"; data: YieldFile }
  | { kind: "questions"; data: MCQFile }
  | { kind: "flashcards"; data: FlashcardFile }
  | { kind: "unknown" };

export function detectArtifactFromJson(parsed: unknown): DetectedArtifact {
  if (!parsed || typeof parsed !== "object") return { kind: "unknown" };

  // NOTE v8.0: detected FIRST so v7.5 is not mistaken for it.
  if (!Array.isArray(parsed) && isNoteV8Json(parsed)) {
    const result = SegmentNoteV8Z.safeParse(parsed);
    if (result.success) return { kind: "note_v8_0", data: result.data };
  }

  // NOTE v7.5: has schemaVersion "7.5" + sections + segmentId
  if (!Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    if (obj.schemaVersion === "7.5" && obj.segmentId && Array.isArray(obj.sections)) {
      const result = noteV75Schema.safeParse(parsed);
      if (result.success) return { kind: "note_v7_5", data: result.data };
    }

    // YIELD v2.0: has segmentId + annotations array
    if (obj.segmentId && Array.isArray(obj.annotations)) {
      const result = yieldV2Schema.safeParse(parsed);
      if (result.success) return { kind: "yield_v2", data: result.data };
    }

    // MCQ: has questions array
    if (Array.isArray(obj.questions)) {
      const result = mcqFileSchema.safeParse(parsed);
      if (result.success) return { kind: "questions", data: result.data };
    }

    // Flashcard: has flashcards array
    if (Array.isArray(obj.flashcards)) {
      const result = flashcardFileSchema.safeParse(parsed);
      if (result.success) return { kind: "flashcards", data: result.data };
    }

    // YIELD v1: has cards array
    if (Array.isArray(obj.cards)) {
      const result = yieldFileSchema.safeParse(parsed);
      if (result.success) return { kind: "yield_v1", data: result.data };
    }
  }

  // Flat array — try yield v1
  if (Array.isArray(parsed)) {
    const result = yieldFileSchema.safeParse(parsed);
    if (result.success) return { kind: "yield_v1", data: result.data };
  }

  return { kind: "unknown" };
}

/* ═══════════════════════════════════════════════════════════════
   Unified validation entry point
═══════════════════════════════════════════════════════════════ */

export type ContentType = "questions" | "flashcards" | "notes" | "yield";

export interface ValidationResult {
  valid: boolean;
  itemCount: number;
  errors: Array<{ index?: number; message: string }>;
  detectedKind?: DetectedArtifact["kind"];
  schemaVersion?: string;
}

function validateNoteV75(parsed: unknown): ValidationResult {
  const result = noteV75Schema.safeParse(parsed);
  if (result.success) {
    const blockCount = result.data.sections.reduce((sum, s) => sum + s.blocks.length, 0);
    // Additional structural checks
    const errors: Array<{ index?: number; message: string }> = [];

    // Check blockId uniqueness within the file
    const seenBlockIds = new Set<string>();
    for (const [si, section] of result.data.sections.entries()) {
      for (const [bi, block] of section.blocks.entries()) {
        if (seenBlockIds.has(block.blockId)) {
          errors.push({
            index: bi,
            message: `sections[${si}].blocks[${bi}]: duplicate blockId "${block.blockId}"`,
          });
        }
        seenBlockIds.add(block.blockId);

        // Validate blockType is known (advisory only — warn, never reject)
        if (!VALID_BLOCK_TYPES.includes(block.blockType as typeof VALID_BLOCK_TYPES[number])) {
          errors.push({
            message: `sections[${si}].blocks[${bi}]: unrecognized blockType "${block.blockType}" (known: ${VALID_BLOCK_TYPES.join(", ")})`,
          });
        }

        // Per NOTE v7.5 contract: interactive_algorithm requires interactiveData
        if (block.blockType === "interactive_algorithm" && !block.interactiveData) {
          errors.push({
            message: `sections[${si}].blocks[${bi}]: interactive_algorithm block missing interactiveData`,
          });
        }

        // Per NOTE v7.5 contract: algorithm requires mermaid OR listItems
        if (block.blockType === "algorithm" && !block.mermaid && (!block.listItems || (block.listItems as unknown[]).length === 0)) {
          errors.push({
            message: `sections[${si}].blocks[${bi}]: algorithm block must have mermaid or listItems`,
          });
        }
      }
    }

    // Warnings don't invalidate — they're structural advisories
    return {
      valid: true,
      itemCount: blockCount,
      errors,
      detectedKind: "note_v7_5",
      schemaVersion: "7.5",
    };
  }

  return {
    valid: false,
    itemCount: 0,
    errors: result.error.issues.map((issue) => ({
      index: typeof issue.path[1] === "number" ? issue.path[1] : undefined,
      message: `${issue.path.join(".")}: ${issue.message}`,
    })),
    detectedKind: "note_v7_5",
    schemaVersion: "7.5",
  };
}

function validateYieldV2(parsed: unknown): ValidationResult {
  const result = yieldV2Schema.safeParse(parsed);
  if (result.success) {
    const errors: Array<{ index?: number; message: string }> = [];

    for (const [i, ann] of result.data.annotations.entries()) {
      // Validate yieldTier range
      if (ann.yieldTier < 0 || ann.yieldTier > 3) {
        errors.push({
          index: i,
          message: `annotations[${i}]: yieldTier must be 0-3, got ${ann.yieldTier}`,
        });
      }

      // Validate reasons use allowed vocabulary (warn, don't reject)
      for (const reason of ann.reasons) {
        if (!ALLOWED_YIELD_REASONS.includes(reason as typeof ALLOWED_YIELD_REASONS[number])) {
          errors.push({
            message: `annotations[${i}]: unknown reason "${reason}"`,
          });
        }
      }
    }

    return {
      valid: true,
      itemCount: result.data.annotations.length,
      errors,
      detectedKind: "yield_v2",
      schemaVersion: "2.0",
    };
  }

  return {
    valid: false,
    itemCount: 0,
    errors: result.error.issues.map((issue) => ({
      index: typeof issue.path[1] === "number" ? issue.path[1] : undefined,
      message: `${issue.path.join(".")}: ${issue.message}`,
    })),
    detectedKind: "yield_v2",
    schemaVersion: "2.0",
  };
}

export function validateFileContent(contentType: ContentType, text: string): ValidationResult {
  const trimmed = text.trim();

  if (contentType === "notes") {
    // Try JSON first — could be NOTE v8.0 or v7.5
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        // v8.0 is checked before v7.5 so a v8 file isn't misrouted.
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          if (isNoteV8Json(parsed)) {
            const v8 = validateSegmentNoteV8(parsed);
            return {
              valid: v8.valid,
              itemCount: v8.blockCount,
              errors: v8.issues.map((i) => ({
                message: `${i.path.join(".")}: ${i.message}`,
              })),
              detectedKind: "note_v8_0",
              schemaVersion: "8.0",
            };
          }
        }
        // Check if it's NOTE v7.5
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const obj = parsed as Record<string, unknown>;
          if (obj.schemaVersion === "7.5" || (obj.segmentId && Array.isArray(obj.sections))) {
            return validateNoteV75(parsed);
          }
        }
        // Not a v7.5 note JSON — fall through to legacy JSON/HTML handling
        // For JSON notes without v7.5 markers, accept if it has any note-like structure
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const obj = parsed as Record<string, unknown>;
          if (obj.title || obj.sections || obj.frames || obj.html || obj.notesHtml || obj.body || obj.content) {
            return {
              valid: true,
              itemCount: 1,
              errors: [],
              detectedKind: "unknown",
              schemaVersion: "legacy",
            };
          }
        }
        // Arrays of note-like objects
        if (Array.isArray(parsed) && parsed.length > 0) {
          return {
            valid: true,
            itemCount: parsed.length,
            errors: [],
            detectedKind: "unknown",
            schemaVersion: "legacy",
          };
        }
      } catch {
        // Not valid JSON — fall through to HTML validation
      }
    }

    // Legacy HTML note
    const result = validateNoteHtml(trimmed);
    return {
      valid: result.valid,
      itemCount: result.valid ? 1 : 0,
      errors: result.errors.map((msg) => ({ message: msg })),
      detectedKind: "unknown",
      schemaVersion: "html",
    };
  }

  // MCQ / Flashcard / Yield = JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {
      valid: false,
      itemCount: 0,
      errors: [{ message: "Invalid JSON syntax" }],
    };
  }

  if (contentType === "questions") {
    const result = mcqFileSchema.safeParse(parsed);
    if (result.success) {
      return {
        valid: true,
        itemCount: result.data.questions.length,
        errors: [],
        detectedKind: "questions",
      };
    }
    return {
      valid: false,
      itemCount: 0,
      errors: result.error.issues.map((issue) => ({
        index: typeof issue.path[1] === "number" ? issue.path[1] : undefined,
        message: `${issue.path.join(".")}: ${issue.message}`,
      })),
      detectedKind: "questions",
    };
  }

  if (contentType === "flashcards") {
    const result = flashcardFileSchema.safeParse(parsed);
    if (result.success) {
      return {
        valid: true,
        itemCount: result.data.flashcards.length,
        errors: [],
        detectedKind: "flashcards",
      };
    }
    return {
      valid: false,
      itemCount: 0,
      errors: result.error.issues.map((issue) => ({
        index: typeof issue.path[1] === "number" ? issue.path[1] : undefined,
        message: `${issue.path.join(".")}: ${issue.message}`,
      })),
      detectedKind: "flashcards",
    };
  }

  if (contentType === "yield") {
    // Try YIELD v2.0 first (has segmentId + annotations)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      if (obj.segmentId && Array.isArray(obj.annotations)) {
        return validateYieldV2(parsed);
      }
    }

    // Fall back to YIELD v1.0
    const result = yieldFileSchema.safeParse(parsed);
    if (result.success) {
      const count = Array.isArray(result.data) ? result.data.length : result.data.cards.length;
      return {
        valid: true,
        itemCount: count,
        errors: [],
        detectedKind: "yield_v1",
        schemaVersion: "1.0",
      };
    }
    return {
      valid: false,
      itemCount: 0,
      errors: result.error.issues.map((issue) => ({
        index: typeof issue.path[1] === "number" ? issue.path[1] : undefined,
        message: `${issue.path.join(".")}: ${issue.message}`,
      })),
      detectedKind: "unknown",
    };
  }

  return { valid: false, itemCount: 0, errors: [{ message: "Unknown content type" }] };
}
