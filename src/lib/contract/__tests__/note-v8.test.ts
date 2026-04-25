/**
 * Hossein Starship — NOTE CONTRACT v8.0 tests.
 *
 * Covers:
 *   - v8 schema acceptance for every blockType with minimally-valid display
 *   - per-blockType matrix rejections (required / forbidden)
 *   - interactive_algorithm graph integrity (initialStepId / nextStepId)
 *   - v7.5 → v8 adapter correctness
 *   - high_yield migration to flags.highYield + best-fit blockType
 *   - content preservation across adapter
 *   - query helper correctness (hasTable, hasMermaid, hasInteractive, flag filters)
 *   - hashing determinism and idempotence
 *   - substring linter on missing content references
 *   - anchoring safety: blockId is preserved 1:1, content is never empty
 */

import { describe, it, expect } from "vitest";

import {
  SegmentNoteV8Z,
  validateSegmentNoteV8,
  isNoteV8Json,
  lintContentSubstringInvariant,
} from "../note-v8-schema";
import {
  NOTE_V8_SCHEMA_VERSION,
  emptyDisplayV8,
  emptyFlagsV8,
  type BlockDisplayV8,
  type BlockTypeV8,
  type BlockV8,
  type SegmentNoteV8,
} from "../note-v8.types";
import { upgradeBlockV7ToV8, upgradeSegmentV7ToV8 } from "../note-v7-to-v8";
import {
  computeContentHash,
  computeSegmentHash,
  attachHashes,
  normalizeForHash,
} from "../note-v8-hashing";
import {
  allHighYieldBlocks,
  allDecisionChangingBlocks,
  allInteractiveAlgorithmBlocks,
  allMermaidBlocks,
  allDifferentialBlocks,
  computeSegmentStats,
  findBlockById,
  hasTable,
  hasMermaid,
  hasInteractive,
} from "../note-v8-queries";

// ─── Fixture builders ────────────────────────────────────────────────────────

function buildBlock(
  overrides: Partial<BlockV8> & { blockId: string; blockType: BlockTypeV8 },
): BlockV8 {
  return {
    title: "Untitled",
    content: "placeholder content",
    display: emptyDisplayV8(),
    flags: emptyFlagsV8(),
    ...overrides,
  } as BlockV8;
}

function buildSegment(blocks: BlockV8[]): SegmentNoteV8 {
  return {
    schemaVersion: NOTE_V8_SCHEMA_VERSION,
    segmentId: "96_01",
    sections: [{ heading: "Section A", blocks }],
  };
}

// ─── Schema acceptance per blockType ─────────────────────────────────────────

describe("v8 schema acceptance", () => {
  it("accepts a concept block with empty display", () => {
    const seg = buildSegment([
      buildBlock({
        blockId: "96_01_b01",
        blockType: "concept",
        content: "compliance is ΔV/ΔP; normal exceeds 20 mL/cmH2O",
      }),
    ]);
    expect(validateSegmentNoteV8(seg).valid).toBe(true);
  });

  it("accepts a trap block with a warning callout", () => {
    const display: BlockDisplayV8 = {
      ...emptyDisplayV8(),
      callouts: [{ kind: "warning", text: "do not miss painless hematuria", order: 0 }],
    };
    const seg = buildSegment([
      buildBlock({
        blockId: "96_01_b01",
        blockType: "trap",
        content: "painless gross hematuria: do not miss painless hematuria",
        display,
      }),
    ]);
    expect(validateSegmentNoteV8(seg).valid).toBe(true);
  });

  it("accepts a differential block with a table", () => {
    const seg = buildSegment([
      buildBlock({
        blockId: "96_01_b01",
        blockType: "differential",
        content: "differential of painless hematuria",
        display: {
          ...emptyDisplayV8(),
          tableData: {
            headers: ["cause", "test"],
            rows: [
              ["urothelial carcinoma", "CT urography"],
              ["bph", "cystoscopy"],
            ],
          },
        },
      }),
    ]);
    expect(validateSegmentNoteV8(seg).valid).toBe(true);
  });

  it("accepts an indication block with listItems", () => {
    const seg = buildSegment([
      buildBlock({
        blockId: "96_01_b01",
        blockType: "indication",
        content: "indications for cystoscopy include gross hematuria",
        display: { ...emptyDisplayV8(), listItems: ["gross hematuria"] },
      }),
    ]);
    expect(validateSegmentNoteV8(seg).valid).toBe(true);
  });

  it("accepts an interactive_algorithm with mermaid + interactiveData", () => {
    const seg = buildSegment([
      buildBlock({
        blockId: "96_01_b01",
        blockType: "interactive_algorithm",
        content: "workup algorithm for microscopic hematuria",
        display: {
          ...emptyDisplayV8(),
          mermaid: "flowchart TD\n  A --> B",
          interactiveData: {
            initialStepId: "root",
            steps: {
              root: {
                prompt: "risk level?",
                options: [
                  { label: "low", nextStepId: "low", outcome: null },
                  { label: "high", nextStepId: null, outcome: "workup" },
                ],
              },
              low: {
                prompt: "repeat ua?",
                options: [{ label: "yes", nextStepId: null, outcome: "repeat" }],
              },
            },
          },
        },
      }),
    ]);
    expect(validateSegmentNoteV8(seg).valid).toBe(true);
  });

  it("accepts a threshold block WITHOUT a table (per contract §10)", () => {
    const seg = buildSegment([
      buildBlock({
        blockId: "96_01_b01",
        blockType: "threshold",
        content: "compliance above 20 mL/cmH2O is considered normal",
      }),
    ]);
    expect(validateSegmentNoteV8(seg).valid).toBe(true);
  });
});

// ─── Schema rejection / matrix enforcement ───────────────────────────────────

describe("v8 schema rejection", () => {
  it("rejects empty content", () => {
    const seg = buildSegment([
      buildBlock({ blockId: "96_01_b01", blockType: "concept", content: "" }),
    ]);
    expect(validateSegmentNoteV8(seg).valid).toBe(false);
  });

  it("rejects whitespace-only content", () => {
    const seg = buildSegment([
      buildBlock({ blockId: "96_01_b01", blockType: "concept", content: "   " }),
    ]);
    expect(validateSegmentNoteV8(seg).valid).toBe(false);
  });

  it("rejects blockType=high_yield (forbidden in v8)", () => {
    const seg = {
      schemaVersion: "8.0",
      segmentId: "96_01",
      sections: [
        {
          heading: "s",
          blocks: [
            {
              blockId: "96_01_b01",
              blockType: "high_yield",
              title: "t",
              content: "c",
              display: emptyDisplayV8(),
              flags: emptyFlagsV8(),
            },
          ],
        },
      ],
    };
    expect(validateSegmentNoteV8(seg).valid).toBe(false);
  });

  it("rejects trap with no warning callout", () => {
    const seg = buildSegment([
      buildBlock({
        blockId: "96_01_b01",
        blockType: "trap",
        content: "trap content",
        display: {
          ...emptyDisplayV8(),
          callouts: [{ kind: "tip", text: "tip", order: 0 }],
        },
      }),
    ]);
    expect(validateSegmentNoteV8(seg).valid).toBe(false);
  });

  it("rejects differential without tableData", () => {
    const seg = buildSegment([
      buildBlock({
        blockId: "96_01_b01",
        blockType: "differential",
        content: "some ddx content",
      }),
    ]);
    expect(validateSegmentNoteV8(seg).valid).toBe(false);
  });

  it("rejects indication without listItems", () => {
    const seg = buildSegment([
      buildBlock({
        blockId: "96_01_b01",
        blockType: "indication",
        content: "indications...",
      }),
    ]);
    expect(validateSegmentNoteV8(seg).valid).toBe(false);
  });

  it("rejects interactive_algorithm missing mermaid", () => {
    const seg = buildSegment([
      buildBlock({
        blockId: "96_01_b01",
        blockType: "interactive_algorithm",
        content: "x",
        display: {
          ...emptyDisplayV8(),
          interactiveData: {
            initialStepId: "a",
            steps: {
              a: { prompt: "p", options: [{ label: "ok", nextStepId: null, outcome: null }] },
            },
          },
        },
      }),
    ]);
    expect(validateSegmentNoteV8(seg).valid).toBe(false);
  });

  it("rejects interactive_algorithm missing interactiveData", () => {
    const seg = buildSegment([
      buildBlock({
        blockId: "96_01_b01",
        blockType: "interactive_algorithm",
        content: "x",
        display: { ...emptyDisplayV8(), mermaid: "flowchart TD\nA-->B" },
      }),
    ]);
    expect(validateSegmentNoteV8(seg).valid).toBe(false);
  });

  it("rejects mermaid on differential (forbidden)", () => {
    const seg = buildSegment([
      buildBlock({
        blockId: "96_01_b01",
        blockType: "differential",
        content: "ddx",
        display: {
          ...emptyDisplayV8(),
          mermaid: "flowchart TD\nA-->B",
          tableData: { headers: ["a"], rows: [["x"]] },
        },
      }),
    ]);
    expect(validateSegmentNoteV8(seg).valid).toBe(false);
  });

  it("rejects orphan nextStepId in interactiveData", () => {
    const seg = buildSegment([
      buildBlock({
        blockId: "96_01_b01",
        blockType: "interactive_algorithm",
        content: "x",
        display: {
          ...emptyDisplayV8(),
          mermaid: "flowchart TD\nA-->B",
          interactiveData: {
            initialStepId: "a",
            steps: {
              a: {
                prompt: "p",
                options: [{ label: "go", nextStepId: "ghost", outcome: null }],
              },
            },
          },
        },
      }),
    ]);
    expect(validateSegmentNoteV8(seg).valid).toBe(false);
  });

  it("rejects duplicate blockId in the same segment", () => {
    const seg = buildSegment([
      buildBlock({ blockId: "dup", blockType: "concept", content: "a" }),
      buildBlock({ blockId: "dup", blockType: "concept", content: "b" }),
    ]);
    expect(validateSegmentNoteV8(seg).valid).toBe(false);
  });

  it("rejects a row width mismatch in tableData", () => {
    const seg = buildSegment([
      buildBlock({
        blockId: "96_01_b01",
        blockType: "differential",
        content: "ddx",
        display: {
          ...emptyDisplayV8(),
          tableData: { headers: ["a", "b"], rows: [["one"]] },
        },
      }),
    ]);
    expect(validateSegmentNoteV8(seg).valid).toBe(false);
  });
});

// ─── Detection ───────────────────────────────────────────────────────────────

describe("isNoteV8Json", () => {
  it("detects v8 by schemaVersion literal", () => {
    expect(isNoteV8Json({ schemaVersion: "8.0", segmentId: "96_01", sections: [] })).toBe(true);
  });
  it("rejects v7.5", () => {
    expect(isNoteV8Json({ schemaVersion: "7.5", segmentId: "96_01", sections: [] })).toBe(false);
  });
  it("rejects arrays", () => {
    expect(isNoteV8Json([])).toBe(false);
  });
});

// ─── v7.5 → v8 adapter ──────────────────────────────────────────────────────

describe("v7.5 → v8 adapter", () => {
  it("preserves blockId 1:1", () => {
    const v8 = upgradeBlockV7ToV8({
      blockId: "96_01_b07",
      blockType: "concept",
      content: "x",
    });
    expect(v8.blockId).toBe("96_01_b07");
  });

  it("preserves content 1:1 when non-empty", () => {
    const v8 = upgradeBlockV7ToV8({
      blockId: "b",
      blockType: "concept",
      content: "the canonical text backbone",
    });
    expect(v8.content).toBe("the canonical text backbone");
  });

  it("migrates blockType=high_yield to a best-fit type + flags.highYield=true", () => {
    const v8 = upgradeBlockV7ToV8({
      blockId: "b",
      blockType: "high_yield",
      title: "differential of painless hematuria",
      content: "dx split",
    });
    expect(v8.flags.highYield).toBe(true);
    expect(v8.blockType).toBe("differential");
  });

  it("falls back to concept when high_yield text has no signals", () => {
    const v8 = upgradeBlockV7ToV8({
      blockId: "b",
      blockType: "high_yield",
      title: "random fact",
      content: "no signal text",
    });
    expect(v8.blockType).toBe("concept");
    expect(v8.flags.highYield).toBe(true);
  });

  it("maps v7.5 algorithm + interactiveData to interactive_algorithm when mermaid is present", () => {
    const v8 = upgradeBlockV7ToV8({
      blockId: "b",
      blockType: "algorithm",
      content: "algo content",
      mermaid: "flowchart TD\nA-->B",
      interactiveData: {
        initialStepId: "a",
        steps: [
          { stepId: "a", type: "question", text: "q?", options: [{ label: "go", nextStepId: null }] },
        ],
      },
    });
    expect(v8.blockType).toBe("interactive_algorithm");
    expect(v8.display.mermaid).toBeTruthy();
    expect(v8.display.interactiveData).not.toBeNull();
  });

  it("maps v7.5 algorithm (no interactive data) to clinical_decision", () => {
    const v8 = upgradeBlockV7ToV8({
      blockId: "b",
      blockType: "algorithm",
      content: "decision rationale",
    });
    expect(v8.blockType).toBe("clinical_decision");
  });

  it("maps v7.5 clinicalPearl into a clinical_pearl callout", () => {
    const v8 = upgradeBlockV7ToV8({
      blockId: "b",
      blockType: "concept",
      content: "body",
      clinicalPearl: "pearl text",
    });
    expect(v8.display.callouts?.[0].kind).toBe("clinical_pearl");
    expect(v8.display.callouts?.[0].text).toBe("pearl text");
  });

  it("synthesizes content when v7.5 content is empty, preserving display info", () => {
    const v8 = upgradeBlockV7ToV8({
      blockId: "b",
      blockType: "concept",
      title: "bladder compliance",
      content: "",
      listItems: ["ΔV/ΔP", "normal >20"],
    });
    expect(v8.content.length).toBeGreaterThan(0);
    expect(v8.content).toContain("bladder compliance");
    expect(v8.content).toContain("ΔV/ΔP");
  });

  it("downgrades interactive_algorithm without mermaid to clinical_decision", () => {
    const v8 = upgradeBlockV7ToV8({
      blockId: "b",
      blockType: "interactive_algorithm",
      content: "c",
      interactiveData: {
        initialStepId: "a",
        steps: [
          { stepId: "a", type: "question", text: "q", options: [{ label: "ok", nextStepId: null }] },
        ],
      },
    });
    expect(v8.blockType).toBe("clinical_decision");
  });

  it("converts v7.5 object-shaped list items into strings", () => {
    const v8 = upgradeBlockV7ToV8({
      blockId: "b",
      blockType: "concept",
      content: "c",
      listItems: [{ text: "a" }, { text: "b" }],
    });
    expect(v8.display.listItems).toEqual(["a", "b"]);
  });

  it("produces a v8 segment that Zod validates (concept with content only)", () => {
    const v7 = {
      schemaVersion: "7.5",
      segmentId: "96_01",
      sections: [
        {
          heading: "s1",
          blocks: [{ blockId: "96_01_b01", blockType: "concept", content: "canonical text" }],
        },
      ],
    };
    const v8 = upgradeSegmentV7ToV8(v7);
    expect(SegmentNoteV8Z.safeParse(v8).success).toBe(true);
  });
});

// ─── Query helpers ──────────────────────────────────────────────────────────

describe("v8 query helpers", () => {
  const seg: SegmentNoteV8 = buildSegment([
    buildBlock({
      blockId: "b1",
      blockType: "concept",
      content: "c",
      flags: { ...emptyFlagsV8(), highYield: true },
    }),
    buildBlock({
      blockId: "b2",
      blockType: "differential",
      content: "c",
      display: {
        ...emptyDisplayV8(),
        tableData: { headers: ["a"], rows: [["x"]] },
      },
      flags: { ...emptyFlagsV8(), decisionChanging: true },
    }),
    buildBlock({
      blockId: "b3",
      blockType: "interactive_algorithm",
      content: "c",
      display: {
        ...emptyDisplayV8(),
        mermaid: "flowchart TD\nA-->B",
        interactiveData: {
          initialStepId: "s",
          steps: {
            s: { prompt: "p", options: [{ label: "ok", nextStepId: null, outcome: null }] },
          },
        },
      },
    }),
  ]);

  it("hasTable / hasMermaid / hasInteractive are accurate", () => {
    const [b1, b2, b3] = seg.sections[0].blocks;
    expect(hasTable(b1)).toBe(false);
    expect(hasTable(b2)).toBe(true);
    expect(hasMermaid(b3)).toBe(true);
    expect(hasInteractive(b3)).toBe(true);
  });

  it("filters by blockType", () => {
    expect(allInteractiveAlgorithmBlocks(seg).map((b) => b.blockId)).toEqual(["b3"]);
    expect(allDifferentialBlocks(seg).map((b) => b.blockId)).toEqual(["b2"]);
  });

  it("filters by flags", () => {
    expect(allHighYieldBlocks(seg).map((b) => b.blockId)).toEqual(["b1"]);
    expect(allDecisionChangingBlocks(seg).map((b) => b.blockId)).toEqual(["b2"]);
  });

  it("filters by derived presence", () => {
    expect(allMermaidBlocks(seg).map((b) => b.blockId)).toEqual(["b3"]);
  });

  it("computeSegmentStats matches expectations", () => {
    const s = computeSegmentStats(seg);
    expect(s.totalBlocks).toBe(3);
    expect(s.byBlockType.concept).toBe(1);
    expect(s.byBlockType.differential).toBe(1);
    expect(s.byBlockType.interactive_algorithm).toBe(1);
    expect(s.withTable).toBe(1);
    expect(s.withMermaid).toBe(1);
    expect(s.withInteractive).toBe(1);
    expect(s.highYield).toBe(1);
    expect(s.decisionChanging).toBe(1);
  });

  it("findBlockById resolves", () => {
    expect(findBlockById(seg, "b2")?.blockType).toBe("differential");
    expect(findBlockById(seg, "nope")).toBeNull();
  });
});

// ─── Hashing ────────────────────────────────────────────────────────────────

describe("v8 hashing", () => {
  it("computeContentHash is deterministic", async () => {
    const a = await computeContentHash("hello world");
    const b = await computeContentHash("hello world");
    expect(a).toBe(b);
    expect(a.startsWith("sha256:")).toBe(true);
  });

  it("content hash is whitespace-insensitive via normalizeForHash", async () => {
    expect(normalizeForHash("  hello  world  ")).toBe("hello world");
    const a = await computeContentHash("  hello   world  ");
    const b = await computeContentHash("hello world");
    expect(a).toBe(b);
  });

  it("computeSegmentHash reflects block changes", async () => {
    const seg = buildSegment([
      buildBlock({ blockId: "b1", blockType: "concept", content: "one" }),
    ]);
    const h1 = await computeSegmentHash(seg);

    const seg2: SegmentNoteV8 = {
      ...seg,
      sections: [
        {
          heading: seg.sections[0].heading,
          blocks: [{ ...seg.sections[0].blocks[0], content: "two" }],
        },
      ],
    };
    const h2 = await computeSegmentHash(seg2);
    expect(h1).not.toBe(h2);
  });

  it("attachHashes populates contentHash and segmentHash", async () => {
    const seg = buildSegment([
      buildBlock({ blockId: "b1", blockType: "concept", content: "one" }),
    ]);
    const out = await attachHashes(seg);
    expect(out.segmentHash?.startsWith("sha256:")).toBe(true);
    expect(out.sections[0].blocks[0].contentHash?.startsWith("sha256:")).toBe(true);
  });
});

// ─── Content substring linter ───────────────────────────────────────────────

describe("substring linter", () => {
  it("reports list items that are not in content", () => {
    const seg = buildSegment([
      buildBlock({
        blockId: "b",
        blockType: "concept",
        content: "just prose about compliance",
        display: { ...emptyDisplayV8(), listItems: ["nonexistent phrase"] },
      }),
    ]);
    const issues = lintContentSubstringInvariant(seg);
    expect(issues.length).toBe(1);
    expect(issues[0].path).toContain("listItems");
  });

  it("finds no issues when list items appear in content", () => {
    const seg = buildSegment([
      buildBlock({
        blockId: "b",
        blockType: "concept",
        content: "compliance is ΔV/ΔP; normal exceeds 20 mL/cmH2O",
        display: { ...emptyDisplayV8(), listItems: ["ΔV/ΔP", "normal exceeds 20 mL/cmH2O"] },
      }),
    ]);
    expect(lintContentSubstringInvariant(seg)).toEqual([]);
  });

  it("ignores mermaid DSL (not prose)", () => {
    const seg = buildSegment([
      buildBlock({
        blockId: "b",
        blockType: "concept",
        content: "short prose",
        display: {
          ...emptyDisplayV8(),
          mermaid: "flowchart TD\nZ[totally different]-->W[nothing to see]",
        },
      }),
    ]);
    expect(lintContentSubstringInvariant(seg)).toEqual([]);
  });
});

// ─── Anchoring safety invariants ────────────────────────────────────────────

describe("anchoring safety", () => {
  it("v8 block content is never empty after successful validation", () => {
    const seg = buildSegment([
      buildBlock({ blockId: "b", blockType: "concept", content: "x" }),
    ]);
    const r = validateSegmentNoteV8(seg);
    expect(r.valid).toBe(true);
    for (const b of r.data!.sections.flatMap((s) => s.blocks)) {
      expect(b.content.trim().length).toBeGreaterThan(0);
    }
  });

  it("adapter preserves blockId across full segment upgrade", () => {
    const v7 = {
      schemaVersion: "7.5",
      segmentId: "96_01",
      sections: [
        {
          heading: "s",
          blocks: [
            { blockId: "96_01_b01", blockType: "concept", content: "a" },
            { blockId: "96_01_b02", blockType: "concept", content: "b" },
          ],
        },
      ],
    };
    const v8 = upgradeSegmentV7ToV8(v7);
    const ids = v8.sections.flatMap((s) => s.blocks.map((b) => b.blockId));
    expect(ids).toEqual(["96_01_b01", "96_01_b02"]);
  });
});
