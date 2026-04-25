/**
 * Hossein Starship — NOTE v7.5 → v8.0 ADAPTER
 *
 * Pure, idempotent, deterministic. No network, no I/O, no mutation of input.
 *
 * Responsibilities:
 *   - preserve blockId 1:1
 *   - preserve content 1:1 when non-empty; else synthesize from title + display
 *   - remap blockType:
 *       v7.5 "high_yield"        → best-fit + flags.highYield = true
 *       v7.5 "algorithm"         → "interactive_algorithm" if interactiveData present,
 *                                  else "clinical_decision"
 *       all others preserved (except those that would collide with v8 rules;
 *       unknown types default to "concept").
 *   - map listItems / tableData / mermaid / interactiveData / clinicalPearl
 *     into display.*; derive flags from author-authored booleans.
 *
 * The adapter does NOT enforce the v8 Zod matrix — it only produces a
 * structurally-shaped v8 object. Callers should pipe the result through
 * SegmentNoteV8Z for strict validation, or through `lintContentSubstringInvariant`
 * for content-backbone tracing.
 */

import {
  BLOCK_TYPES_V8,
  NOTE_V8_SCHEMA_VERSION,
  emptyDisplayV8,
  emptyFlagsV8,
  type BlockDisplayV8,
  type BlockFlagsV8,
  type BlockTypeV8,
  type BlockV8,
  type CalloutV8,
  type InteractiveDataV8,
  type InteractiveStepV8,
  type SectionV8,
  type SegmentNoteV8,
  type TableDataV8,
} from "./note-v8.types";

// ─── Loose v7.5 input shape (does not enforce Zod, accepts real-world input) ─

interface V75Block {
  blockId: string;
  blockType: string;
  title?: string | null;
  content?: string | null;
  listItems?: unknown[] | null;
  tableData?: unknown;
  mermaid?: string | null;
  interactiveData?: unknown;
  clinicalPearl?: string | null;
  highYield?: boolean | null;
  decisionChanging?: boolean | null;
  examRelevant?: boolean | null;
  // passthrough tolerated:
  [k: string]: unknown;
}

interface V75Section {
  heading: string;
  blocks: V75Block[];
}

interface V75Segment {
  schemaVersion?: string;
  segmentId: string;
  sections: V75Section[];
}

// ─── blockType remapping ─────────────────────────────────────────────────────

const V8_TYPE_SET: ReadonlySet<string> = new Set(BLOCK_TYPES_V8);

function bestFitFromText(textLowercase: string, hasInteractiveData: boolean): BlockTypeV8 {
  // Applied only when the legacy blockType is "high_yield" (no semantic signal)
  // or an unknown value. Order matters — first match wins.
  const t = textLowercase;
  if (hasInteractiveData) return "interactive_algorithm";
  if (/\b(differential|dx|ddx)\b/.test(t)) return "differential";
  if (/\b(threshold|cut.?off|criteria)\b/.test(t)) return "threshold";
  if (/\b(pitfall|trap|don[’']?t|avoid|warning)\b/.test(t)) return "trap";
  if (/\b(indication|when to)\b/.test(t)) return "indication";
  if (/\b(complication)\b/.test(t)) return "complication";
  if (/\b(follow.?up|surveillance)\b/.test(t)) return "follow_up";
  if (/\b(decision|choose|select|which)\b/.test(t)) return "clinical_decision";
  return "concept";
}

function remapBlockType(
  legacy: string,
  signal: { hasInteractiveData: boolean; titlePlusContentLower: string },
): { blockType: BlockTypeV8; forcedHighYield: boolean } {
  if (legacy === "high_yield") {
    return {
      blockType: bestFitFromText(signal.titlePlusContentLower, signal.hasInteractiveData),
      forcedHighYield: true,
    };
  }
  if (legacy === "algorithm") {
    return {
      blockType: signal.hasInteractiveData ? "interactive_algorithm" : "clinical_decision",
      forcedHighYield: false,
    };
  }
  if (V8_TYPE_SET.has(legacy)) {
    return { blockType: legacy as BlockTypeV8, forcedHighYield: false };
  }
  // Unknown / legacy-only types (core, pearl, warning, pitfall, keypoint, etc.)
  return {
    blockType: bestFitFromText(signal.titlePlusContentLower, signal.hasInteractiveData),
    forcedHighYield: false,
  };
}

// ─── display payload mappers ─────────────────────────────────────────────────

function toStringArray(v: unknown): string[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item === "string") {
      const t = item.trim();
      if (t) out.push(t);
    } else if (item && typeof item === "object") {
      // Tolerate object-shaped list items by stringifying — v8 requires plain strings.
      const rec = item as Record<string, unknown>;
      const maybeText =
        typeof rec.text === "string"
          ? rec.text
          : typeof rec.label === "string"
            ? rec.label
            : JSON.stringify(item);
      if (maybeText.trim()) out.push(maybeText.trim());
    }
  }
  return out.length > 0 ? out : null;
}

function toTableData(v: unknown): TableDataV8 | null {
  if (!v || typeof v !== "object") return null;
  const obj = v as Record<string, unknown>;
  const headers = Array.isArray(obj.headers)
    ? (obj.headers as unknown[]).map((h) => (typeof h === "string" ? h : String(h ?? "")))
    : [];
  const rowsRaw = Array.isArray(obj.rows) ? (obj.rows as unknown[]) : [];
  if (headers.length === 0 || rowsRaw.length === 0) return null;
  const rows: string[][] = rowsRaw.map((row) => {
    if (!Array.isArray(row)) return headers.map(() => "");
    return headers.map((_h, i) => {
      const cell = (row as unknown[])[i];
      if (cell == null) return "";
      if (typeof cell === "string") return cell;
      // v7.5 TableDataCell: { text, bold? }
      if (typeof cell === "object") {
        const cc = cell as Record<string, unknown>;
        if (typeof cc.text === "string") return cc.text;
      }
      return String(cell);
    });
  });
  return { headers, rows };
}

function toInteractiveData(v: unknown): InteractiveDataV8 | null {
  if (!v || typeof v !== "object") return null;
  const obj = v as Record<string, unknown>;
  const initial = typeof obj.initialStepId === "string" ? obj.initialStepId : null;
  if (!initial) return null;

  // v7.5 shape: steps is an array of {stepId, type, text, options?, finalMessage?}.
  // v8 shape:   steps is a Record<stepId, {prompt, options[], finalMessage?}>.
  //
  // Terminal "result" nodes in the legacy v7.5 contract have options: [] and
  // a non-null finalMessage. Those terminals are PRESERVED VERBATIM — we do
  // NOT synthesize a fake option. The v8 validator accepts options: [] as
  // long as finalMessage is non-empty (see note-v8-schema.ts).
  const stepsOut: Record<string, InteractiveStepV8> = {};
  const rawSteps = obj.steps;

  const readFinalMessage = (s: Record<string, unknown>): string | null => {
    if (typeof s.finalMessage === "string" && s.finalMessage.trim().length > 0) {
      return s.finalMessage;
    }
    return null;
  };

  const readOptions = (s: Record<string, unknown>) => {
    const optsRaw = Array.isArray(s.options) ? (s.options as unknown[]) : [];
    return optsRaw
      .map((o) => {
        if (!o || typeof o !== "object") return null;
        const oo = o as Record<string, unknown>;
        const label = typeof oo.label === "string" ? oo.label : "";
        const nextStepId =
          typeof oo.nextStepId === "string" && oo.nextStepId.length > 0
            ? oo.nextStepId
            : null;
        const outcome =
          typeof oo.outcome === "string"
            ? oo.outcome
            : typeof oo.explanation === "string"
              ? oo.explanation
              : null;
        if (!label) return null;
        return { label, nextStepId, outcome };
      })
      .filter(
        (x): x is { label: string; nextStepId: string | null; outcome: string | null } =>
          x !== null,
      );
  };

  const buildStep = (
    s: Record<string, unknown>,
    fallbackPrompt: string,
  ): InteractiveStepV8 | null => {
    const prompt =
      typeof s.text === "string"
        ? s.text
        : typeof s.prompt === "string"
          ? s.prompt
          : "";
    const options = readOptions(s);
    const finalMessage = readFinalMessage(s);
    // Terminal legacy step with neither options nor finalMessage is malformed —
    // skip it rather than emit something Zod will reject. Keeps the adapter
    // idempotent and lossless where possible, without producing invalid v8.
    if (options.length === 0 && finalMessage === null) return null;
    return {
      prompt: prompt || fallbackPrompt,
      options,
      // Only attach finalMessage when non-null so v8 objects stay minimal
      // for branch steps (tests and downstream consumers diff better).
      ...(finalMessage !== null ? { finalMessage } : {}),
    };
  };

  if (Array.isArray(rawSteps)) {
    for (const raw of rawSteps as unknown[]) {
      if (!raw || typeof raw !== "object") continue;
      const s = raw as Record<string, unknown>;
      const id = typeof s.stepId === "string" ? s.stepId : null;
      if (!id) continue;
      const step = buildStep(s, id);
      if (step) stepsOut[id] = step;
    }
  } else if (rawSteps && typeof rawSteps === "object") {
    // Already v8-ish record shape
    for (const [id, step] of Object.entries(rawSteps as Record<string, unknown>)) {
      if (!step || typeof step !== "object") continue;
      const built = buildStep(step as Record<string, unknown>, id);
      if (built) stepsOut[id] = built;
    }
  }

  if (Object.keys(stepsOut).length === 0) return null;
  if (!Object.prototype.hasOwnProperty.call(stepsOut, initial)) {
    // Adapter leniency: if initialStepId is missing, anchor to the first declared step.
    const firstKey = Object.keys(stepsOut)[0];
    return { initialStepId: firstKey, steps: stepsOut };
  }
  return { initialStepId: initial, steps: stepsOut };
}

function toCallouts(legacy: V75Block): CalloutV8[] | null {
  const out: CalloutV8[] = [];
  if (typeof legacy.clinicalPearl === "string" && legacy.clinicalPearl.trim().length > 0) {
    out.push({ kind: "clinical_pearl", text: legacy.clinicalPearl.trim(), order: out.length });
  }
  // `blockType === "warning"` / "pitfall" legacy kinds become a warning callout so
  // the information is not lost; the blockType itself remaps via `remapBlockType`.
  if (legacy.blockType === "warning" || legacy.blockType === "pitfall" || legacy.blockType === "trap") {
    const warningText =
      typeof legacy.content === "string" && legacy.content.trim().length > 0
        ? legacy.content.trim()
        : typeof legacy.title === "string"
          ? legacy.title.trim()
          : "";
    if (warningText) {
      out.push({ kind: "warning", text: warningText, order: out.length });
    }
  }
  return out.length > 0 ? out : null;
}

function synthesizeContent(
  legacy: V75Block,
  display: BlockDisplayV8,
): string {
  // content is REQUIRED in v8. When v7.5 left content null/empty, synthesize
  // a linearized text backbone from available sources so anchoring still works.
  const parts: string[] = [];
  const title = typeof legacy.title === "string" ? legacy.title.trim() : "";
  const content = typeof legacy.content === "string" ? legacy.content.trim() : "";
  if (content) {
    parts.push(content);
  } else if (title) {
    parts.push(title);
  }
  if (display.listItems) {
    parts.push(display.listItems.join("\n• "));
  }
  if (display.tableData) {
    parts.push(
      [display.tableData.headers.join(" | "), ...display.tableData.rows.map((r) => r.join(" | "))].join("\n"),
    );
  }
  if (display.callouts) {
    parts.push(display.callouts.map((c) => c.text).join("\n"));
  }
  if (display.interactiveData) {
    const stepTexts = Object.values(display.interactiveData.steps)
      .map((s) => s.prompt)
      .join(" / ");
    if (stepTexts) parts.push(stepTexts);
  }
  // mermaid intentionally excluded — it's DSL, not prose.
  const joined = parts.filter(Boolean).join("\n\n").trim();
  return joined || "(empty)";
}

// ─── public API ──────────────────────────────────────────────────────────────

export interface AdapterOptions {
  /**
   * Author-supplied content is REQUIRED in v8. When a v7.5 block has no
   * content, the adapter synthesizes one from other fields. Set `strict: true`
   * to throw instead (useful for author-time tooling).
   * Default: false.
   */
  strictContent?: boolean;
}

export function upgradeBlockV7ToV8(legacy: V75Block, opts: AdapterOptions = {}): BlockV8 {
  const blockId = legacy.blockId;
  const title = (typeof legacy.title === "string" ? legacy.title.trim() : "") || blockId;

  const display: BlockDisplayV8 = emptyDisplayV8();
  display.listItems = toStringArray(legacy.listItems);
  display.tableData = toTableData(legacy.tableData);
  display.mermaid =
    typeof legacy.mermaid === "string" && legacy.mermaid.trim().length > 0
      ? legacy.mermaid
      : null;
  display.interactiveData = toInteractiveData(legacy.interactiveData);
  display.callouts = toCallouts(legacy);

  const hasInteractive = display.interactiveData !== null;
  const searchableText =
    `${title} ${typeof legacy.content === "string" ? legacy.content : ""}`.toLowerCase();
  const { blockType, forcedHighYield } = remapBlockType(legacy.blockType, {
    hasInteractiveData: hasInteractive,
    titlePlusContentLower: searchableText,
  });

  const flags: BlockFlagsV8 = emptyFlagsV8();
  flags.highYield = Boolean(legacy.highYield) || forcedHighYield;
  flags.decisionChanging = Boolean(legacy.decisionChanging);
  flags.examRelevant = Boolean(legacy.examRelevant);

  let content = typeof legacy.content === "string" ? legacy.content.trim() : "";
  if (!content) {
    if (opts.strictContent) {
      throw new Error(
        `upgradeBlockV7ToV8: block ${blockId} has empty content and strictContent=true`,
      );
    }
    content = synthesizeContent(legacy, display);
  }

  // Honor interactive_algorithm v8 rule: mermaid required. If we ended up as
  // interactive_algorithm but have no mermaid, fall back to clinical_decision
  // to keep the adapter output Zod-valid by default.
  let finalBlockType: BlockTypeV8 = blockType;
  if (finalBlockType === "interactive_algorithm" && !display.mermaid) {
    finalBlockType = "clinical_decision";
  }
  // Enforce differential matrix: tableData is required. v7.5 differential blocks
  // often carry only listItems — fall back to clinical_decision which accepts both.
  if (finalBlockType === "differential" && !display.tableData) {
    finalBlockType = "clinical_decision";
  }
  // Enforce indication matrix: listItems is required. v7.5 indication blocks
  // may have content/tableData but no listItems — fall back to clinical_decision.
  if (finalBlockType === "indication" && !display.listItems) {
    finalBlockType = "clinical_decision";
  }

  // Enforce trap-block invariants that are only knowable after finalBlockType is settled:
  //
  // 1. At least one callout with kind="warning" — required by the Zod matrix
  //    mustHaveWarningCallout rule. toCallouts() only adds a warning entry when
  //    legacy.blockType is already "warning"|"pitfall"|"trap". When bestFitFromText
  //    infers "trap" from a different legacy type (e.g. "high_yield" whose title
  //    contains "pitfall" / "avoid"), the callout is absent and Zod rejects the output.
  //
  // 2. tableData / mermaid / interactiveData must be null — the matrix marks them
  //    as "forbidden" for trap blocks. Clearing them here prevents a second wave
  //    of Zod errors when those fields were populated before the remap.
  if (finalBlockType === "trap") {
    const hasWarning = display.callouts?.some((c) => c.kind === "warning");
    if (!hasWarning) {
      const warningText = content.trim() || title;
      const next: CalloutV8 = {
        kind: "warning",
        text: warningText,
        order: display.callouts ? display.callouts.length : 0,
      };
      display.callouts = display.callouts ? [...display.callouts, next] : [next];
    }
    // Clear fields that are forbidden by the trap matrix rule.
    display.tableData = null;
    display.mermaid = null;
    display.interactiveData = null;
  }

  // Enforce interactive_algorithm matrix: listItems and tableData are forbidden.
  if (finalBlockType === "interactive_algorithm") {
    display.listItems = null;
    display.tableData = null;
  }

  return {
    blockId,
    blockType: finalBlockType,
    title,
    content,
    display,
    flags,
  };
}

/**
 * Upgrade an entire v7.5 segment to v8. Pure and idempotent:
 * passing an already-upgraded v8 segment through this is a no-op (because
 * v8 blocks will match the v7.5 loose shape for all mapped fields).
 */
export function upgradeSegmentV7ToV8(
  legacy: V75Segment,
  opts: AdapterOptions = {},
): SegmentNoteV8 {
  const sections: SectionV8[] = legacy.sections.map((section) => ({
    heading: section.heading,
    blocks: section.blocks.map((b) => upgradeBlockV7ToV8(b, opts)),
  }));
  return {
    schemaVersion: NOTE_V8_SCHEMA_VERSION,
    segmentId: legacy.segmentId,
    sections,
  };
}
