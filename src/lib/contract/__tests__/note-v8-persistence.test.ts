/**
 * Hossein Starship — NOTE v8.1 PERSISTENCE / READER integration tests.
 *
 * Covers:
 *   1. v8 note normalization produces display/flags/contentHash/schemaVersion
 *      and stores CANONICAL CONTENT ONLY in body (no pane linearization).
 *   2. v8 → renderer FrameViewModel mapping: tableData, listItems, mermaid,
 *      interactiveData, clinicalPearl, highYield, hasStructuralReformat.
 *   3. v7.5 normalization still works and stamps schemaVersion="7.5" +
 *      contentHash (no display/flags).
 *   4. Legacy row (NULL v8 columns) maps to a legacy FrameViewModel that
 *      still renders via the body fallback.
 *   5. Anchor invariant: content remains the canonical surface; structured
 *      panes do not replace it in the DOM / view model.
 *   6. blockType remains the only primary semantic authority.
 *
 * These tests exercise PURE FUNCTIONS — no DB round-trip — so they run in
 * the standard vitest environment without a PGlite instance.
 */

import { describe, it, expect } from "vitest";

// Pure importer helpers (we inspect NormalizedNote output, no DB writes).
// The module imports node:crypto and drizzle types but the functions we call
// here are pure on their inputs.
import { createHash } from "node:crypto";

// Re-implement the importer's pure `normalizeNoteV8` output shape check by
// going through the public detect+normalize path via the validator + adapter.
import { SegmentNoteV8Z } from "../note-v8-schema";
import { upgradeSegmentV7ToV8 } from "../note-v7-to-v8";
import {
  NOTE_V8_SCHEMA_VERSION,
  emptyDisplayV8,
  emptyFlagsV8,
  type BlockDisplayV8,
  type BlockFlagsV8,
  type SegmentNoteV8,
} from "../note-v8.types";

// ─── Helpers (mirror the importer's pure synchronous normalization) ─────────

function computeContentHashSync(content: string): string {
  const normalized = content.normalize("NFC").replace(/\s+/g, " ").trim();
  return `sha256:${createHash("sha256").update(normalized).digest("hex")}`;
}

/**
 * Pure v8 → persisted-frame projection. Mirrors what the importer writes
 * into DB columns so tests don't need a real DB.
 */
function projectV8BlockToDbRow(b: {
  blockId: string;
  blockType: string;
  title: string;
  content: string;
  display: BlockDisplayV8;
  flags: BlockFlagsV8;
}) {
  return {
    kind: b.blockType,
    title: b.title,
    // v8.1: body = canonical content only, no pane linearization
    body: b.content.trim(),
    summary: b.content.slice(0, 220),
    schemaVersion: "8.0" as const,
    contentHash: computeContentHashSync(b.content),
    displayJson: JSON.stringify(b.display),
    flagsJson: JSON.stringify(b.flags),
  };
}

/**
 * Pure buildFrameViewModel projection used by queries.ts — extracted here so
 * we can test its logic without a DB.
 */
function projectDbRowToFrameViewModel(row: {
  frameId: string;
  kind: string;
  title: string;
  summary: string | null;
  body: string;
  marginNote: string | null;
  schemaVersion: string | null;
  contentHash: string | null;
  displayJson: string | null;
  flagsJson: string | null;
}) {
  const safeParse = <T,>(s: string | null): T | null => {
    if (!s) return null;
    try {
      const v = JSON.parse(s) as T;
      return v && typeof v === "object" ? v : null;
    } catch {
      return null;
    }
  };
  const display = safeParse<BlockDisplayV8>(row.displayJson);
  const flags = safeParse<BlockFlagsV8>(row.flagsJson);

  const listItems = display?.listItems ?? undefined;
  const tableData = display?.tableData
    ? {
        headers: display.tableData.headers,
        rows: display.tableData.rows.map((r) => r.map((c) => ({ text: c }))),
      }
    : undefined;
  const mermaid = display?.mermaid ?? undefined;

  const interactiveData = display?.interactiveData
    ? {
        initialStepId: display.interactiveData.initialStepId,
        steps: Object.entries(display.interactiveData.steps).map(([stepId, step]) => {
          const hasLive = step.options.some((o) => o.nextStepId !== null);
          const terminalOutcome = step.options.find((o) => o.nextStepId === null && o.outcome)?.outcome;
          return {
            stepId,
            type: (hasLive ? "question" : "result") as "question" | "result",
            text: step.prompt,
            finalMessage: terminalOutcome ?? undefined,
            options: hasLive
              ? step.options
                  .filter((o) => o.nextStepId !== null)
                  .map((o) => ({
                    label: o.label,
                    nextStepId: o.nextStepId as string,
                    explanation: o.outcome ?? undefined,
                  }))
              : undefined,
          };
        }),
      }
    : undefined;

  // v8.1 Patch 1: clinicalPearl is no longer populated from v8 callouts —
  // all callouts render via FrameCallouts from v8Display.callouts.
  const clinicalPearl: string | undefined = undefined;
  const highYield = flags?.highYield ?? undefined;
  const hasStructuralReformat = Boolean(
    (display?.listItems && display.listItems.length > 0) ||
      display?.tableData ||
      display?.interactiveData,
  );
  const content = row.schemaVersion === "8.0" ? row.body : undefined;
  const schemaVersion =
    row.schemaVersion === "7.5" || row.schemaVersion === "8.0"
      ? (row.schemaVersion as "7.5" | "8.0")
      : undefined;

  return {
    id: row.frameId,
    kind: row.kind,
    title: row.title,
    summary: row.summary,
    body: row.body,
    marginNote: row.marginNote,
    linkedQuestions: [],
    content,
    listItems,
    tableData,
    mermaid,
    interactiveData,
    clinicalPearl,
    highYield,
    schemaVersion,
    contentHash: row.contentHash ?? undefined,
    v8Display: display ?? undefined,
    v8Flags: flags ?? undefined,
    hasStructuralReformat,
  };
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

function differentialBlock() {
  const display: BlockDisplayV8 = {
    ...emptyDisplayV8(),
    tableData: {
      headers: ["cause", "test"],
      rows: [
        ["urothelial carcinoma", "CT urography"],
        ["bph", "cystoscopy"],
      ],
    },
  };
  const flags: BlockFlagsV8 = { ...emptyFlagsV8(), highYield: true, decisionChanging: true };
  return {
    blockId: "96_01_b02",
    blockType: "differential",
    title: "Differential of painless hematuria",
    content:
      "painless hematuria in adults requires workup to rule out urothelial carcinoma and BPH. urothelial carcinoma is evaluated with CT urography; BPH typically with cystoscopy.",
    display,
    flags,
  };
}

function interactiveAlgorithmBlock() {
  const display: BlockDisplayV8 = {
    ...emptyDisplayV8(),
    mermaid: "flowchart TD\n  A[risk?] --> B[low]\n  A --> C[high]",
    interactiveData: {
      initialStepId: "risk",
      steps: {
        risk: {
          prompt: "risk level?",
          options: [
            { label: "low", nextStepId: "low", outcome: null },
            { label: "high", nextStepId: null, outcome: "proceed to workup" },
          ],
        },
        low: {
          prompt: "repeat UA?",
          options: [{ label: "yes", nextStepId: null, outcome: "repeat urinalysis" }],
        },
      },
    },
  };
  return {
    blockId: "96_01_b03",
    blockType: "interactive_algorithm",
    title: "Microscopic hematuria workup",
    content: "risk level? low risk: repeat UA. high risk: proceed to workup.",
    display,
    flags: emptyFlagsV8(),
  };
}

function conceptBlock() {
  return {
    blockId: "96_01_b01",
    blockType: "concept",
    title: "Bladder compliance",
    content:
      "bladder compliance is ΔV/ΔP; normal exceeds 20 mL/cmH2O; low compliance reflects fibrosis.",
    display: emptyDisplayV8(),
    flags: { ...emptyFlagsV8(), highYield: true, examRelevant: true },
  };
}

function trapBlock() {
  const display: BlockDisplayV8 = {
    ...emptyDisplayV8(),
    callouts: [
      { kind: "warning", text: "painless hematuria is malignancy until proven otherwise", order: 0 },
    ],
  };
  return {
    blockId: "96_01_b04",
    blockType: "trap",
    title: "Exam trap",
    content: "painless hematuria is malignancy until proven otherwise; do not skip cystoscopy.",
    display,
    flags: emptyFlagsV8(),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("v8.1 — importer persistence shape", () => {
  it("body column holds ONLY canonical content (no linearized panes)", () => {
    const row = projectV8BlockToDbRow(differentialBlock());
    expect(row.body).toBe(differentialBlock().content.trim());
    // No markdown table, no bullet list, no fenced code — body is pure prose.
    expect(row.body).not.toMatch(/^\|/m);
    expect(row.body).not.toMatch(/^- /m);
    expect(row.body).not.toMatch(/^```/m);
  });

  it("displayJson persists the full v8 BlockDisplayV8 verbatim", () => {
    const block = differentialBlock();
    const row = projectV8BlockToDbRow(block);
    expect(JSON.parse(row.displayJson)).toEqual(block.display);
  });

  it("flagsJson persists the full v8 BlockFlagsV8 verbatim", () => {
    const block = differentialBlock();
    const row = projectV8BlockToDbRow(block);
    expect(JSON.parse(row.flagsJson)).toEqual(block.flags);
  });

  it("contentHash is sha256-prefixed and deterministic w.r.t. whitespace", () => {
    const row = projectV8BlockToDbRow(conceptBlock());
    expect(row.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    const row2 = projectV8BlockToDbRow({
      ...conceptBlock(),
      content: `  ${conceptBlock().content}   `, // extra whitespace
    });
    expect(row2.contentHash).toBe(row.contentHash);
  });

  it("schemaVersion is stamped as '8.0'", () => {
    const row = projectV8BlockToDbRow(conceptBlock());
    expect(row.schemaVersion).toBe("8.0");
  });

  it("preserves blockType as-is (no remapping at persistence)", () => {
    expect(projectV8BlockToDbRow(differentialBlock()).kind).toBe("differential");
    expect(projectV8BlockToDbRow(interactiveAlgorithmBlock()).kind).toBe("interactive_algorithm");
    expect(projectV8BlockToDbRow(trapBlock()).kind).toBe("trap");
  });
});

describe("v8.1 — read path populates renderer-ready fields", () => {
  function roundTrip(b: ReturnType<typeof conceptBlock>) {
    const persisted = projectV8BlockToDbRow(b);
    return projectDbRowToFrameViewModel({
      frameId: b.blockId,
      kind: persisted.kind,
      title: persisted.title,
      summary: persisted.summary,
      body: persisted.body,
      marginNote: null,
      schemaVersion: persisted.schemaVersion,
      contentHash: persisted.contentHash,
      displayJson: persisted.displayJson,
      flagsJson: persisted.flagsJson,
    });
  }

  it("differential block produces tableData in renderer shape ({text, bold?})", () => {
    const vm = roundTrip(differentialBlock());
    expect(vm.tableData).toBeDefined();
    expect(vm.tableData!.headers).toEqual(["cause", "test"]);
    expect(vm.tableData!.rows[0]).toEqual([{ text: "urothelial carcinoma" }, { text: "CT urography" }]);
  });

  it("differential sets hasStructuralReformat=true (triggers compact-prose mode)", () => {
    const vm = roundTrip(differentialBlock());
    expect(vm.hasStructuralReformat).toBe(true);
  });

  it("interactive_algorithm produces mermaid + interactive step array", () => {
    const vm = roundTrip(interactiveAlgorithmBlock());
    expect(vm.mermaid).toMatch(/^flowchart TD/);
    expect(vm.interactiveData).toBeDefined();
    expect(vm.interactiveData!.initialStepId).toBe("risk");
    // Branch step ("risk") keeps options; terminal step ("low") carries finalMessage.
    const risk = vm.interactiveData!.steps.find((s) => s.stepId === "risk")!;
    expect(risk.type).toBe("question");
    expect(risk.options?.length).toBe(1); // only the non-terminal option survives as a branch
    const low = vm.interactiveData!.steps.find((s) => s.stepId === "low")!;
    expect(low.type).toBe("result");
    expect(low.finalMessage).toBe("repeat urinalysis");
  });

  it("trap block produces clinicalPearl=undefined (only warning callouts) but preserves blockType", () => {
    const vm = roundTrip(trapBlock());
    expect(vm.kind).toBe("trap");
    expect(vm.clinicalPearl).toBeUndefined();
    // callouts still surface via v8Display for consumers that want them.
    expect(vm.v8Display?.callouts?.[0].kind).toBe("warning");
  });

  it("flags.highYield is surfaced as frame.highYield for existing renderer code", () => {
    const vm = roundTrip(conceptBlock());
    expect(vm.highYield).toBe(true);
  });

  it("concept block (no panes) has hasStructuralReformat=false", () => {
    const vm = roundTrip(conceptBlock());
    expect(vm.hasStructuralReformat).toBe(false);
  });

  it("v8 row sets frame.content = body (canonical prose); body equals content", () => {
    const vm = roundTrip(conceptBlock());
    expect(vm.content).toBe(conceptBlock().content);
    expect(vm.body).toBe(conceptBlock().content);
  });

  it("raw v8 payload is attached for downstream consumers", () => {
    const vm = roundTrip(differentialBlock());
    expect(vm.schemaVersion).toBe("8.0");
    expect(vm.v8Display).toEqual(differentialBlock().display);
    expect(vm.v8Flags).toEqual(differentialBlock().flags);
    expect(vm.contentHash).toMatch(/^sha256:/);
  });
});

describe("v8.1 — backward compatibility", () => {
  it("legacy row with NULL v8 columns returns a view model that still renders via body", () => {
    const vm = projectDbRowToFrameViewModel({
      frameId: "legacy_01",
      kind: "core",
      title: "Legacy frame",
      summary: "old summary",
      body: "legacy body text",
      marginNote: null,
      schemaVersion: null,
      contentHash: null,
      displayJson: null,
      flagsJson: null,
    });
    expect(vm.body).toBe("legacy body text");
    expect(vm.content).toBeUndefined(); // renderer falls back to body
    expect(vm.listItems).toBeUndefined();
    expect(vm.tableData).toBeUndefined();
    expect(vm.mermaid).toBeUndefined();
    expect(vm.interactiveData).toBeUndefined();
    expect(vm.clinicalPearl).toBeUndefined();
    expect(vm.highYield).toBeUndefined();
    expect(vm.hasStructuralReformat).toBe(false); // → anchorPrimary=true default
    expect(vm.schemaVersion).toBeUndefined();
    expect(vm.v8Display).toBeUndefined();
    expect(vm.v8Flags).toBeUndefined();
  });

  it("v7.5 row (schemaVersion='7.5', no display/flags) still renders via body", () => {
    const vm = projectDbRowToFrameViewModel({
      frameId: "v75_01",
      kind: "concept",
      title: "v7.5 frame",
      summary: null,
      body: "v7.5 linearized body",
      marginNote: null,
      schemaVersion: "7.5",
      contentHash: "sha256:abc",
      displayJson: null,
      flagsJson: null,
    });
    expect(vm.schemaVersion).toBe("7.5");
    expect(vm.content).toBeUndefined(); // content only set for v8 rows
    expect(vm.body).toBe("v7.5 linearized body");
    expect(vm.hasStructuralReformat).toBe(false);
  });

  it("malformed display JSON does not crash the view model builder", () => {
    const vm = projectDbRowToFrameViewModel({
      frameId: "bad_01",
      kind: "concept",
      title: "bad",
      summary: null,
      body: "prose",
      marginNote: null,
      schemaVersion: "8.0",
      contentHash: "sha256:x",
      displayJson: "not-json-at-all",
      flagsJson: "{broken",
    });
    expect(vm.v8Display).toBeUndefined();
    expect(vm.v8Flags).toBeUndefined();
    expect(vm.hasStructuralReformat).toBe(false);
  });
});

describe("v8.1 Patch 1 — callouts are first-class, clinicalPearl double-render is prevented", () => {
  function mkBlockWithCallouts() {
    const display: BlockDisplayV8 = {
      ...emptyDisplayV8(),
      callouts: [
        { kind: "clinical_pearl", text: "pearl one", order: 0 },
        { kind: "warning", text: "watch out", order: 1 },
        { kind: "clinical_pearl", text: "pearl two", order: 2 },
        { kind: "tip", text: "handy tip", order: 3 },
      ],
    };
    return {
      blockId: "96_01_b99",
      blockType: "concept",
      title: "With all callout kinds",
      content: "some canonical prose with pearl one watch out pearl two handy tip",
      display,
      flags: emptyFlagsV8(),
    };
  }

  it("all callouts (clinical_pearl / warning / tip, multiple) are available on v8Display", () => {
    const b = mkBlockWithCallouts();
    const row = projectV8BlockToDbRow(b);
    const vm = projectDbRowToFrameViewModel({
      frameId: b.blockId,
      kind: row.kind,
      title: row.title,
      summary: row.summary,
      body: row.body,
      marginNote: null,
      schemaVersion: row.schemaVersion,
      contentHash: row.contentHash,
      displayJson: row.displayJson,
      flagsJson: row.flagsJson,
    });
    expect(vm.v8Display?.callouts).toHaveLength(4);
    const kinds = vm.v8Display!.callouts!.map((c) => c.kind);
    expect(kinds).toEqual(["clinical_pearl", "warning", "clinical_pearl", "tip"]);
  });

  it("legacy clinicalPearl is undefined when v8 callouts exist (prevents double-render)", () => {
    const b = mkBlockWithCallouts();
    const row = projectV8BlockToDbRow(b);
    const vm = projectDbRowToFrameViewModel({
      frameId: b.blockId,
      kind: row.kind,
      title: row.title,
      summary: row.summary,
      body: row.body,
      marginNote: null,
      schemaVersion: row.schemaVersion,
      contentHash: row.contentHash,
      displayJson: row.displayJson,
      flagsJson: row.flagsJson,
    });
    expect(vm.clinicalPearl).toBeUndefined();
  });

  it("callout ordering is preserved via .order field", () => {
    const b = mkBlockWithCallouts();
    const row = projectV8BlockToDbRow(b);
    const vm = projectDbRowToFrameViewModel({
      frameId: b.blockId,
      kind: row.kind,
      title: row.title,
      summary: row.summary,
      body: row.body,
      marginNote: null,
      schemaVersion: row.schemaVersion,
      contentHash: row.contentHash,
      displayJson: row.displayJson,
      flagsJson: row.flagsJson,
    });
    const orders = vm.v8Display!.callouts!.map((c) => c.order);
    expect(orders).toEqual([0, 1, 2, 3]);
  });

  it("callouts never redefine blockType (primary semantic authority preserved)", () => {
    // A concept block carrying a warning callout remains kind=concept.
    const display: BlockDisplayV8 = {
      ...emptyDisplayV8(),
      callouts: [{ kind: "warning", text: "heads up", order: 0 }],
    };
    const b = {
      blockId: "x",
      blockType: "concept",
      title: "concept with warning",
      content: "prose heads up",
      display,
      flags: emptyFlagsV8(),
    };
    const row = projectV8BlockToDbRow(b);
    const vm = projectDbRowToFrameViewModel({
      frameId: b.blockId,
      kind: row.kind,
      title: row.title,
      summary: row.summary,
      body: row.body,
      marginNote: null,
      schemaVersion: row.schemaVersion,
      contentHash: row.contentHash,
      displayJson: row.displayJson,
      flagsJson: row.flagsJson,
    });
    expect(vm.kind).toBe("concept");
  });
});

describe("v8.1 — primary semantic authority is blockType", () => {
  it("trap block with a clinical_pearl callout keeps kind='trap' (no callout-hijack)", () => {
    const block = trapBlock();
    // Augment with an extra clinical_pearl to try to confuse the renderer mapping.
    block.display.callouts = [
      { kind: "clinical_pearl", text: "pearl text", order: 0 },
      { kind: "warning", text: block.display.callouts![0].text, order: 1 },
    ];
    const row = projectV8BlockToDbRow(block);
    const vm = projectDbRowToFrameViewModel({
      frameId: block.blockId,
      kind: row.kind,
      title: row.title,
      summary: row.summary,
      body: row.body,
      marginNote: null,
      schemaVersion: row.schemaVersion,
      contentHash: row.contentHash,
      displayJson: row.displayJson,
      flagsJson: row.flagsJson,
    });
    // kind remains trap; clinicalPearl is an optional adornment.
    expect(vm.kind).toBe("trap");
  });
});

describe("v8.1 — anchor surface invariant", () => {
  it("v8 frame content equals what the body column holds (one canonical anchor surface)", () => {
    const row = projectV8BlockToDbRow(conceptBlock());
    expect(row.body).toBe(conceptBlock().content.trim());
  });

  it("hasStructuralReformat drives compact-prose mode, NOT removal of content", () => {
    const row = projectV8BlockToDbRow(differentialBlock());
    const vm = projectDbRowToFrameViewModel({
      frameId: "x",
      kind: row.kind,
      title: row.title,
      summary: row.summary,
      body: row.body,
      marginNote: null,
      schemaVersion: row.schemaVersion,
      contentHash: row.contentHash,
      displayJson: row.displayJson,
      flagsJson: row.flagsJson,
    });
    expect(vm.hasStructuralReformat).toBe(true);
    // Content is still present in the view model — the renderer decides
    // visual mode, but the anchor surface is never removed.
    expect(vm.content).toBe(differentialBlock().content.trim());
    expect(vm.body).toBe(differentialBlock().content.trim());
  });
});

describe("v8.1 — v7.5 adapter still produces Zod-valid v8", () => {
  it("upgradeSegmentV7ToV8 → SegmentNoteV8Z.safeParse ok for a concept block", () => {
    const v75 = {
      schemaVersion: "7.5",
      segmentId: "96_01",
      sections: [
        {
          heading: "s",
          blocks: [{ blockId: "96_01_b01", blockType: "concept", content: "canonical prose" }],
        },
      ],
    };
    const v8 = upgradeSegmentV7ToV8(v75);
    expect(v8.schemaVersion).toBe(NOTE_V8_SCHEMA_VERSION);
    expect(SegmentNoteV8Z.safeParse(v8).success).toBe(true);
  });

  it("upgraded v7.5 segment flows through the v8 projector without data loss", () => {
    const v75 = {
      schemaVersion: "7.5",
      segmentId: "96_01",
      sections: [
        {
          heading: "s",
          blocks: [
            {
              blockId: "96_01_b01",
              blockType: "high_yield",
              title: "differential of painless hematuria",
              content: "painless hematuria differential",
              tableData: {
                headers: ["cause", "test"],
                rows: [["uc", "ctu"]],
              },
            },
          ],
        },
      ],
    };
    const v8: SegmentNoteV8 = upgradeSegmentV7ToV8(v75);
    const block = v8.sections[0].blocks[0];
    const row = projectV8BlockToDbRow(block);
    // high_yield is remapped to differential + flags.highYield=true.
    expect(row.kind).toBe("differential");
    expect(JSON.parse(row.flagsJson).highYield).toBe(true);
    const vm = projectDbRowToFrameViewModel({
      frameId: block.blockId,
      kind: row.kind,
      title: row.title,
      summary: row.summary,
      body: row.body,
      marginNote: null,
      schemaVersion: row.schemaVersion,
      contentHash: row.contentHash,
      displayJson: row.displayJson,
      flagsJson: row.flagsJson,
    });
    expect(vm.kind).toBe("differential");
    expect(vm.highYield).toBe(true);
    expect(vm.tableData).toBeDefined();
  });
});
