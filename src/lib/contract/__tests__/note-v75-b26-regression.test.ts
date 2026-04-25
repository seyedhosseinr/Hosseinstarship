/**
 * v8.2.1 — regression test for ch096_seg001.json / block 96_01_b26.
 *
 * Shape under test (verbatim-matching the described v7.5 contract):
 *   - interactive_algorithm block with step_1..step_5 as branching questions
 *     and step_6 / step_7 as terminal "result" steps.
 *   - step_6 and step_7 both have options: [] AND non-null finalMessage.
 *   - Every non-null nextStepId in the graph resolves to an existing step
 *     (including references to step_6 / step_7).
 *
 * Fix contract (all asserted here):
 *   1. The v7.5 → v8 adapter preserves step_6 / step_7 verbatim — their
 *      options stay empty, their finalMessage is copied through, and they
 *      appear as keys in the adapted steps record.
 *   2. The v8 Zod validator accepts the adapted segment.
 *   3. Non-terminal steps still require options.length >= 1.
 *   4. Terminal steps still require a non-empty finalMessage when options
 *      are empty (a step with both empty is rejected / dropped).
 *   5. nextStepId resolution sees terminal steps as valid targets.
 *   6. No fake "ادامه" / "ok" option is synthesized by the adapter anymore.
 */

import { describe, it, expect } from "vitest";
import { SegmentNoteV8Z } from "../note-v8-schema";
import { upgradeSegmentV7ToV8 } from "../note-v7-to-v8";

// ─── Minimal fixture mirroring ch096_seg001.json / 96_01_b26 ────────────────
// Terminal step_6 / step_7 with options: [] + finalMessage.
// (Full segment wrapper is the minimum SegmentNoteV8Z accepts: schemaVersion,
// segmentId, sections[]. The block we care about lives at sections[4].blocks[3]
// to match the real file's path.)

function padEmptySections(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    heading: `section-${i}`,
    blocks: [
      {
        blockId: `96_01_b_pad_${i}`,
        blockType: "concept",
        title: `pad ${i}`,
        content: `placeholder prose for section ${i}`,
      },
    ],
  }));
}

const V75_CH096_SEG001 = {
  schemaVersion: "7.5",
  segmentId: "96_01",
  sections: [
    // 0..3: harmless padding so the target block lands at sections[4].blocks[3]
    ...padEmptySections(4),
    {
      heading: "Interactive algorithm — regression target",
      blocks: [
        { blockId: "96_01_b23", blockType: "concept", title: "a", content: "a" },
        { blockId: "96_01_b24", blockType: "concept", title: "b", content: "b" },
        { blockId: "96_01_b25", blockType: "concept", title: "c", content: "c" },
        {
          // sections[4].blocks[3] — the regression target
          blockId: "96_01_b26",
          blockType: "interactive_algorithm",
          title: "Workup of microscopic hematuria",
          content:
            "risk stratification; low / intermediate / high risk pathways; repeat UA vs cystoscopy vs CT urography.",
          mermaid:
            "flowchart TD\n  s1[risk?] --> s2[low]\n  s1 --> s3[intermediate]\n  s1 --> s4[high]\n  s2 --> s5[repeat UA]\n  s5 --> s6[repeat result]\n  s3 --> s7[cysto+renal US]",
          interactiveData: {
            initialStepId: "step_1",
            steps: [
              {
                stepId: "step_1",
                type: "question",
                text: "Risk stratification?",
                options: [
                  { label: "low", nextStepId: "step_2" },
                  { label: "intermediate", nextStepId: "step_3" },
                  { label: "high", nextStepId: "step_4" },
                ],
              },
              {
                stepId: "step_2",
                type: "question",
                text: "Low risk — shared decision?",
                options: [
                  { label: "repeat UA", nextStepId: "step_5" },
                  { label: "cystoscopy + renal US", nextStepId: "step_7" },
                ],
              },
              {
                stepId: "step_3",
                type: "question",
                text: "Intermediate — proceed with workup?",
                options: [
                  { label: "cystoscopy + renal US", nextStepId: "step_7" },
                ],
              },
              {
                stepId: "step_4",
                type: "question",
                text: "High — CT urography plan?",
                options: [
                  { label: "cystoscopy + CT urography", nextStepId: "step_6" },
                ],
              },
              {
                stepId: "step_5",
                type: "question",
                text: "After repeat UA, is hematuria persistent?",
                options: [
                  { label: "yes", nextStepId: "step_7" },
                  { label: "no", nextStepId: "step_6" },
                ],
              },
              // Terminal result steps — options: [] + non-null finalMessage.
              // This is THE shape the v7.5 → v8 migration was regressing on.
              {
                stepId: "step_6",
                type: "result",
                text: "Terminal — benign outcome",
                options: [],
                finalMessage: "No further workup; routine follow-up.",
              },
              {
                stepId: "step_7",
                type: "result",
                text: "Terminal — workup outcome",
                options: [],
                finalMessage: "Proceed with cystoscopy and appropriate imaging.",
              },
            ],
          },
        },
      ],
    },
  ],
};

describe("ch096_seg001.json / 96_01_b26 — terminal-step migration regression", () => {
  it("adapter preserves step_6 and step_7 with options: [] and their finalMessage", () => {
    const v8 = upgradeSegmentV7ToV8(V75_CH096_SEG001);
    const target = v8.sections[4].blocks[3];

    expect(target.blockId).toBe("96_01_b26");
    expect(target.blockType).toBe("interactive_algorithm");
    expect(target.display.interactiveData).not.toBeNull();

    const steps = target.display.interactiveData!.steps;

    // Both terminal steps made it into the adapted record.
    expect(steps).toHaveProperty("step_6");
    expect(steps).toHaveProperty("step_7");

    // options are preserved as empty arrays — NO fake option synthesis.
    expect(steps.step_6.options).toEqual([]);
    expect(steps.step_7.options).toEqual([]);

    // finalMessage is carried through verbatim.
    expect(steps.step_6.finalMessage).toBe("No further workup; routine follow-up.");
    expect(steps.step_7.finalMessage).toBe(
      "Proceed with cystoscopy and appropriate imaging.",
    );

    // And no "ادامه" / "ok" synthesized labels leaked into the adapted shape.
    const allLabels = Object.values(steps).flatMap((s) => s.options.map((o) => o.label));
    expect(allLabels).not.toContain("ادامه");
    expect(allLabels).not.toContain("ok");
  });

  it("the adapted segment passes the v8 Zod validator", () => {
    const v8 = upgradeSegmentV7ToV8(V75_CH096_SEG001);
    const parsed = SegmentNoteV8Z.safeParse(v8);
    if (!parsed.success) {
      // surface the issues cleanly if this ever fails again
      throw new Error(
        "Zod rejected the adapted segment:\n" +
          parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n"),
      );
    }
    expect(parsed.success).toBe(true);
  });

  it("nextStepId resolution sees terminal steps (step_6 / step_7) as valid targets", () => {
    const v8 = upgradeSegmentV7ToV8(V75_CH096_SEG001);
    const steps = v8.sections[4].blocks[3].display.interactiveData!.steps;
    const allNextIds = Object.values(steps).flatMap((s) =>
      s.options.map((o) => o.nextStepId).filter((x): x is string => x !== null),
    );
    for (const id of allNextIds) {
      expect(Object.prototype.hasOwnProperty.call(steps, id)).toBe(true);
    }
    // And the graph DOES reach the terminals.
    expect(allNextIds).toContain("step_6");
    expect(allNextIds).toContain("step_7");
  });

  it("non-terminal steps still require options.length >= 1 (rejected when empty with no finalMessage)", () => {
    // A step that is neither "real terminal" (no finalMessage) nor "branch"
    // (no options) is malformed. The adapter drops it — the Zod rule for
    // initialStepId existence catches the resulting graph hole.
    const malformed = {
      schemaVersion: "7.5",
      segmentId: "96_01",
      sections: [
        {
          heading: "s",
          blocks: [
            {
              blockId: "x_b1",
              blockType: "interactive_algorithm",
              title: "x",
              content: "x content",
              mermaid: "flowchart TD\n A --> B",
              interactiveData: {
                initialStepId: "ghost",
                steps: [
                  {
                    stepId: "ghost",
                    type: "question",
                    text: "no options, no finalMessage",
                    options: [],
                    // no finalMessage field at all
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const v8 = upgradeSegmentV7ToV8(malformed);
    // The bad step is dropped, so steps is empty, so Zod fails.
    expect(SegmentNoteV8Z.safeParse(v8).success).toBe(false);
  });

  it("terminal step with options: [] AND no finalMessage is rejected by Zod directly", () => {
    // This is the pure-v8-input path: a caller writes v8 with an illegal
    // terminal. The validator must reject it at schema level.
    const seg = {
      schemaVersion: "8.0",
      segmentId: "96_01",
      sections: [
        {
          heading: "s",
          blocks: [
            {
              blockId: "x_b1",
              blockType: "interactive_algorithm",
              title: "x",
              content: "x content",
              display: {
                listItems: null,
                tableData: null,
                mermaid: "flowchart TD\n A --> B",
                interactiveData: {
                  initialStepId: "t",
                  steps: {
                    t: { prompt: "terminal w/o message", options: [] }, // illegal
                  },
                },
                callouts: null,
              },
              flags: { highYield: false, decisionChanging: false, examRelevant: false },
            },
          ],
        },
      ],
    };
    const r = SegmentNoteV8Z.safeParse(seg);
    expect(r.success).toBe(false);
    if (!r.success) {
      const anyMatch = r.error.issues.some(
        (i) =>
          /non-empty finalMessage/i.test(i.message) ||
          i.path.join(".").includes("finalMessage"),
      );
      expect(anyMatch).toBe(true);
    }
  });

  it("a pure-v8 terminal step with options: [] + non-empty finalMessage is accepted", () => {
    const seg = {
      schemaVersion: "8.0",
      segmentId: "96_01",
      sections: [
        {
          heading: "s",
          blocks: [
            {
              blockId: "x_b1",
              blockType: "interactive_algorithm",
              title: "x",
              content: "x content",
              display: {
                listItems: null,
                tableData: null,
                mermaid: "flowchart TD\n A --> B",
                interactiveData: {
                  initialStepId: "t",
                  steps: {
                    t: {
                      prompt: "terminal w/ message",
                      options: [],
                      finalMessage: "done",
                    },
                  },
                },
                callouts: null,
              },
              flags: { highYield: false, decisionChanging: false, examRelevant: false },
            },
          ],
        },
      ],
    };
    expect(SegmentNoteV8Z.safeParse(seg).success).toBe(true);
  });
});
