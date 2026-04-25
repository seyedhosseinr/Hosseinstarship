import React, { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { FrameCardV2 } from "../FrameCardV2";
import type { FrameViewModel } from "@/lib/contract/note-viewer.types";
import { emptyDisplayV8, emptyFlagsV8 } from "@/lib/contract/note-v8.types";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function buildFrame(overrides: Partial<FrameViewModel>): FrameViewModel {
  return {
    id: "frame-1",
    kind: "concept",
    title: "Default frame",
    summary: null,
    body: "Canonical prose stays available for anchors.",
    marginNote: null,
    linkedQuestions: [],
    content: "Canonical prose stays available for anchors.",
    listItems: undefined,
    tableData: undefined,
    mermaid: undefined,
    highYield: undefined,
    clinicalPearl: undefined,
    interactiveData: undefined,
    schemaVersion: "8.0",
    contentHash: "sha256:test",
    v8Display: emptyDisplayV8(),
    v8Flags: emptyFlagsV8(),
    hasStructuralReformat: false,
    ...overrides,
  };
}

describe("FrameCardV2 rich runtime rendering", () => {
  it("renders differential tables ahead of the canonical anchor surface and decorates flags without replacing kind", () => {
    const html = renderToStaticMarkup(
      <FrameCardV2
        frame={buildFrame({
          id: "96_01_b02",
          kind: "differential",
          title: "Differential of painless hematuria",
          body: "Painless hematuria still needs canonical prose for anchoring.",
          content: "Painless hematuria still needs canonical prose for anchoring.",
          tableData: {
            headers: ["Cause", "Test"],
            rows: [[{ text: "Tumor" }, { text: "CT urography" }]],
          },
          v8Display: {
            ...emptyDisplayV8(),
            tableData: {
              headers: ["Cause", "Test"],
              rows: [["Tumor", "CT urography"]],
            },
          },
          v8Flags: {
            highYield: true,
            decisionChanging: true,
            examRelevant: false,
          },
          hasStructuralReformat: true,
        })}
      />,
    );

    expect(html).toContain('data-frame-kind="differential"');
    expect(html).toContain("<table");
    expect(html).toContain('data-anchor-surface="canonical"');
    expect(html).toContain('data-anchor-mode="compact"');
    expect(html).toContain("High-yield");
    expect(html).toContain("Decision changing");
    expect(html.indexOf("<table")).toBeLessThan(html.indexOf('data-anchor-surface="canonical"'));
  });

  it("renders interactive algorithms with SVG graph as primary, mermaid demoted to fallback, plus compact canonical prose", () => {
    const html = renderToStaticMarkup(
      <FrameCardV2
        frame={buildFrame({
          id: "96_01_b03",
          kind: "interactive_algorithm",
          title: "Microscopic hematuria workup",
          body: "Risk stratify first, then decide whether to repeat urinalysis or work up.",
          content: "Risk stratify first, then decide whether to repeat urinalysis or work up.",
          mermaid: "flowchart TD\n  A[Risk] --> B[Low]",
          interactiveData: {
            initialStepId: "risk",
            steps: [
              {
                stepId: "risk",
                type: "question",
                text: "Risk level?",
                options: [{ label: "Low", nextStepId: "repeat" }],
              },
              {
                stepId: "repeat",
                type: "result",
                text: "Repeat urinalysis",
                finalMessage: "Repeat urinalysis",
              },
            ],
          },
          v8Display: {
            ...emptyDisplayV8(),
            mermaid: "flowchart TD\n  A[Risk] --> B[Low]",
          },
          hasStructuralReformat: true,
        })}
      />,
    );

    expect(html).toContain('data-frame-kind="interactive_algorithm"');
    // SVG decision graph is the primary renderer
    expect(html).toContain('data-algorithm-graph="svg"');
    expect(html).toContain('data-step-id="risk"');
    expect(html).toContain('data-step-id="repeat"');
    // Active step + node markers
    expect(html).toContain('data-step-state="current"');
    expect(html).toContain("Risk level?");
    expect(html).toContain("Low");
    // Mermaid still in DOM but demoted to collapsible fallback
    expect(html).toContain('data-mermaid-fallback="true"');
    expect(html).toContain('data-mermaid-state="source"');
    // Anchor surface invariant preserved
    expect(html).toContain('data-anchor-surface="canonical"');
    expect(html).toContain('data-anchor-mode="compact"');
    // SVG appears before mermaid; both before canonical anchor surface
    expect(html.indexOf('data-algorithm-graph="svg"')).toBeLessThan(
      html.indexOf('data-mermaid-fallback="true"'),
    );
    expect(html.indexOf('data-mermaid-fallback="true"')).toBeLessThan(
      html.indexOf('data-anchor-surface="canonical"'),
    );
  });

  it("interactive_algorithm without mermaid renders SVG graph and no fallback chrome", () => {
    const html = renderToStaticMarkup(
      <FrameCardV2
        frame={buildFrame({
          id: "no-mermaid-1",
          kind: "interactive_algorithm",
          title: "No mermaid",
          body: "canonical prose",
          content: "canonical prose",
          interactiveData: {
            initialStepId: "a",
            steps: [
              { stepId: "a", type: "action", text: "Do thing", finalMessage: "Done" },
            ],
          },
          hasStructuralReformat: true,
        })}
      />,
    );
    expect(html).toContain('data-algorithm-graph="svg"');
    expect(html).not.toContain('data-mermaid-fallback="true"');
    expect(html).not.toContain('data-mermaid-state="source"');
  });

  it("renders option choices with numeric chips when on a question step", () => {
    const html = renderToStaticMarkup(
      <FrameCardV2
        frame={buildFrame({
          id: "options-1",
          kind: "interactive_algorithm",
          body: "canonical prose",
          content: "canonical prose",
          interactiveData: {
            initialStepId: "q",
            steps: [
              {
                stepId: "q",
                type: "question",
                text: "Stage?",
                options: [
                  { label: "Low", nextStepId: "low" },
                  { label: "High", nextStepId: "high" },
                ],
              },
              { stepId: "low", type: "result", text: "Observe", finalMessage: "Observe" },
              { stepId: "high", type: "result", text: "Treat", finalMessage: "Treat" },
            ],
          },
          hasStructuralReformat: true,
        })}
      />,
    );
    expect(html).toContain('data-option-index="1"');
    expect(html).toContain('data-option-index="2"');
    expect(html).toContain('data-step-state="current"');
  });

  it("marks visited steps after the user advances through the graph", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <FrameCardV2
          frame={buildFrame({
            id: "visited-1",
            kind: "interactive_algorithm",
            body: "canonical prose",
            content: "canonical prose",
            interactiveData: {
              initialStepId: "a",
              steps: [
                {
                  stepId: "a",
                  type: "question",
                  text: "Start",
                  options: [{ label: "Go", nextStepId: "b" }],
                },
                { stepId: "b", type: "result", text: "Done", finalMessage: "Done" },
              ],
            },
            hasStructuralReformat: true,
          })}
        />,
      );
    });

    const goButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.getAttribute("data-option-target") === "b",
    );
    expect(goButton).toBeTruthy();

    act(() => {
      goButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Old "a" node should now be marked visited; new current is "b".
    const nodeA = container.querySelector('[data-step-id="a"]');
    const nodeB = container.querySelector('[data-step-id="b"]');
    expect(nodeA?.getAttribute("data-step-state")).toBe("visited");
    expect(nodeB?.getAttribute("data-step-state")).toBe("current");

    // Conclusion card visible.
    expect(container.querySelector('[data-algorithm-terminal="true"]')).not.toBeNull();
    expect(container.textContent).toContain("Conclusion");

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders terminal result panel when current step is a result", () => {
    const html = renderToStaticMarkup(
      <FrameCardV2
        frame={buildFrame({
          id: "terminal-1",
          kind: "interactive_algorithm",
          body: "canonical prose",
          content: "canonical prose",
          interactiveData: {
            initialStepId: "done",
            steps: [
              {
                stepId: "done",
                type: "result",
                text: "Refer to urology",
                finalMessage: "Refer to urology immediately",
              },
            ],
          },
          hasStructuralReformat: true,
        })}
      />,
    );
    expect(html).toContain('data-algorithm-terminal="true"');
    expect(html).toContain("Refer to urology immediately");
  });

  it("advances interactive_algorithm UI from structured payload in the real DOM", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <FrameCardV2
          frame={buildFrame({
            id: "96_01_b03",
            kind: "interactive_algorithm",
            title: "Microscopic hematuria workup",
            body: "Risk stratify first, then decide whether to repeat urinalysis or work up.",
            content: "Risk stratify first, then decide whether to repeat urinalysis or work up.",
            mermaid: "flowchart TD\n  A[Risk] --> B[Low]",
            interactiveData: {
              initialStepId: "risk",
              steps: [
                {
                  stepId: "risk",
                  type: "question",
                  text: "Risk level?",
                  options: [{ label: "Low", nextStepId: "repeat" }],
                },
                {
                  stepId: "repeat",
                  type: "result",
                  text: "Repeat urinalysis",
                  finalMessage: "Repeat urinalysis",
                },
              ],
            },
            v8Display: {
              ...emptyDisplayV8(),
              mermaid: "flowchart TD\n  A[Risk] --> B[Low]",
            },
            hasStructuralReformat: true,
          })}
        />,
      );
    });

    expect(container.textContent).toContain("Risk level?");
    const lowButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Low"),
    );
    expect(lowButton).toBeTruthy();

    act(() => {
      lowButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Repeat urinalysis");
    expect(container.querySelector('[data-mermaid-state="source"]')).not.toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders inline bold/italic/code in canonical block content", () => {
    const html = renderToStaticMarkup(
      <FrameCardV2
        frame={buildFrame({
          id: "rich-content-1",
          kind: "core",
          body: "Use **risk stratification** before deciding on *cystoscopy*; document `eGFR` first.",
          content: "Use **risk stratification** before deciding on *cystoscopy*; document `eGFR` first.",
          hasStructuralReformat: false,
        })}
      />,
    );
    expect(html).toContain("<strong");
    expect(html).toContain("risk stratification");
    expect(html).toContain("<em");
    expect(html).toContain("cystoscopy");
    expect(html).toContain("<code");
    expect(html).toContain("eGFR");
    // Markers themselves should not leak into rendered text
    expect(html).not.toContain("**risk stratification**");
    expect(html).not.toContain("`eGFR`");
  });

  it("renders inline bold inside listItems and inside clinicalPearl", () => {
    const html = renderToStaticMarkup(
      <FrameCardV2
        frame={buildFrame({
          id: "rich-list-1",
          kind: "concept",
          body: "Canonical prose.",
          content: "Canonical prose.",
          listItems: [
            "Always check **serum creatinine** at baseline.",
            "Avoid *empiric antibiotics* without culture.",
          ],
          clinicalPearl: "**Painless** hematuria is malignancy until proven otherwise.",
          hasStructuralReformat: true,
        })}
      />,
    );
    expect(html).toContain("<strong");
    expect(html).toContain("serum creatinine");
    expect(html).toContain("<em");
    expect(html).toContain("empiric antibiotics");
    expect(html).toContain("Painless");
    expect(html).not.toContain("**serum creatinine**");
    expect(html).not.toContain("**Painless**");
  });

  it("renders inline bold in interactive step text and in finalMessage", () => {
    const html = renderToStaticMarkup(
      <FrameCardV2
        frame={buildFrame({
          id: "rich-alg-1",
          kind: "interactive_algorithm",
          body: "canonical prose",
          content: "canonical prose",
          interactiveData: {
            initialStepId: "q",
            steps: [
              {
                stepId: "q",
                type: "question",
                text: "Is **gross hematuria** present?",
                options: [
                  { label: "**Yes**, visible blood", nextStepId: "refer" },
                ],
              },
              {
                stepId: "refer",
                type: "result",
                text: "Refer immediately",
                finalMessage: "Refer to **urology** within 2 weeks.",
              },
            ],
          },
          hasStructuralReformat: true,
        })}
      />,
    );
    // Bold inside the active step heading
    expect(html).toContain("<strong");
    expect(html).toContain("gross hematuria");
    // Bold inside the option button label
    expect(html).toContain("Yes");
    expect(html).not.toContain("**gross hematuria**");
    expect(html).not.toContain("**Yes**");
    expect(html).not.toContain("**urology**");
  });

  it("renders inline bold/italic inside frame.title and frame.summary", () => {
    const html = renderToStaticMarkup(
      <FrameCardV2
        frame={buildFrame({
          id: "title-1",
          kind: "concept",
          title: "Workup of **microscopic hematuria**",
          summary: "Stratify by *risk* before deciding on cystoscopy.",
          body: "canonical prose",
          content: "canonical prose",
        })}
      />,
    );
    expect(html).toContain("<strong");
    expect(html).toContain("microscopic hematuria");
    expect(html).toContain("<em");
    expect(html).toContain("risk");
    expect(html).not.toContain("**microscopic hematuria**");
    expect(html).not.toContain("*risk*");
  });

  it("suppresses clinicalPearl tail when its text duplicates the body content", () => {
    const dup = "Painless gross hematuria is malignancy until proven otherwise.";
    const html = renderToStaticMarkup(
      <FrameCardV2
        frame={buildFrame({
          id: "dup-pearl",
          kind: "core",
          body: dup,
          content: dup,
          clinicalPearl: dup,
        })}
      />,
    );
    expect(html).not.toContain("data-frame-pearl");
  });

  it("renders the pearl tail (no full aside chrome) when pearl is genuinely additive", () => {
    const html = renderToStaticMarkup(
      <FrameCardV2
        frame={buildFrame({
          id: "pearl-add",
          kind: "core",
          body: "Initial workup includes urinalysis and creatinine.",
          content: "Initial workup includes urinalysis and creatinine.",
          clinicalPearl: "Always exclude **menstrual contamination** before re-imaging.",
        })}
      />,
    );
    expect(html).toContain("data-frame-pearl");
    expect(html).toContain("<strong");
    expect(html).toContain("menstrual contamination");
    // No old aside box chrome
    expect(html).not.toContain("rounded-lib-md border border-amber-200 bg-amber-50/80");
  });

  it("does not render a clinicalPearl echo on alert-tier frames (warning IS the warning)", () => {
    const html = renderToStaticMarkup(
      <FrameCardV2
        frame={buildFrame({
          id: "warn-1",
          kind: "warning",
          title: "Stop drug",
          body: "Discontinue if creatinine rises >25%.",
          content: "Discontinue if creatinine rises >25%.",
          clinicalPearl: "Discontinue if creatinine rises >25%.",
        })}
      />,
    );
    expect(html).not.toContain("data-frame-pearl");
    // Body still rendered once
    expect(html).toContain("Discontinue if creatinine rises");
  });

  it("renders blocks where content is null but listItems carry the payload", () => {
    const html = renderToStaticMarkup(
      <FrameCardV2
        frame={buildFrame({
          id: "list-only-1",
          kind: "core",
          body: "",
          content: undefined,
          listItems: [
            "Check **serum calcium**",
            "Order *renal ultrasound*",
          ],
          hasStructuralReformat: true,
        })}
      />,
    );
    expect(html).toContain("<strong");
    expect(html).toContain("serum calcium");
    expect(html).toContain("<em");
    expect(html).toContain("renal ultrasound");
  });

  it("does not render a second table from canonical compact mode when structured table payload exists", () => {
    const html = renderToStaticMarkup(
      <FrameCardV2
        frame={buildFrame({
          id: "dup-table-1",
          kind: "differential",
          title: "Structured table wins",
          body: "| Wrong | Body |\n| --- | --- |\n| duplicate | render |",
          content: "| Wrong | Body |\n| --- | --- |\n| duplicate | render |",
          tableData: {
            headers: ["Cause", "Test"],
            rows: [[{ text: "Tumor" }, { text: "CT urography" }]],
          },
          v8Display: {
            ...emptyDisplayV8(),
            tableData: {
              headers: ["Cause", "Test"],
              rows: [["Tumor", "CT urography"]],
            },
          },
          hasStructuralReformat: true,
        })}
      />,
    );

    expect((html.match(/<table/g) ?? [])).toHaveLength(1);
    expect(html).toContain('data-anchor-surface="canonical"');
    expect(html).toContain("| Wrong | Body |");
  });

  it("keeps blockType as the primary semantic authority for concept, trap, and threshold frames", () => {
    const conceptHtml = renderToStaticMarkup(
      <FrameCardV2
        frame={buildFrame({
          id: "concept-1",
          kind: "concept",
          v8Display: {
            ...emptyDisplayV8(),
            callouts: [{ kind: "warning", text: "Secondary emphasis only.", order: 0 }],
          },
          v8Flags: { ...emptyFlagsV8(), highYield: true },
        })}
      />,
    );
    const trapHtml = renderToStaticMarkup(
      <FrameCardV2
        frame={buildFrame({
          id: "trap-1",
          kind: "trap",
          title: "Exam trap",
          v8Display: {
            ...emptyDisplayV8(),
            callouts: [{ kind: "tip", text: "Still a trap frame.", order: 0 }],
          },
        })}
      />,
    );
    const thresholdHtml = renderToStaticMarkup(
      <FrameCardV2
        frame={buildFrame({
          id: "threshold-1",
          kind: "threshold",
          title: "Threshold",
          v8Flags: { ...emptyFlagsV8(), examRelevant: true },
        })}
      />,
    );

    expect(conceptHtml).toContain('data-frame-kind="concept"');
    expect(conceptHtml).not.toContain('data-frame-kind="warning"');
    expect(trapHtml).toContain('data-frame-kind="trap"');
    expect(trapHtml).toContain("Exam Trap");
    expect(thresholdHtml).toContain('data-frame-kind="threshold"');
    expect(thresholdHtml).toContain("Exam relevant");
  });

  it("renders a real ch101_seg001 high_yield block with Notion callout chrome and additive pearl tail", () => {
    // Verbatim shape from ch101_seg001_note.json / 101_01_b02.
    const html = renderToStaticMarkup(
      <FrameCardV2
        frame={buildFrame({
          id: "101_01_b02",
          kind: "high_yield",
          title: "Skene's gland — هومولوگ پروستات",
          body: "**Skene's glands** در سمت ventral اوریفیس **urethra** قرار دارند و از طریق **Skene's ducts** به vulva تخلیه می‌شوند. از نظر embryologic معادل **prostate** هستند.",
          content: "**Skene's glands** در سمت ventral اوریفیس **urethra** قرار دارند و از طریق **Skene's ducts** به vulva تخلیه می‌شوند. از نظر embryologic معادل **prostate** هستند.",
          highYield: true,
          clinicalPearl: "External urethral meatus دقیقاً **1 cm** قدامی نسبت به vaginal opening است.",
        })}
      />,
    );
    // Notion callout chrome
    expect(html).toContain('data-frame-kind="high_yield"');
    expect(html).toContain('data-frame-tier="callout"');
    expect(html).toContain("High Yield");
    // Bold rendered, no raw markers
    expect(html).toContain("<strong");
    expect(html).toContain("Skene&#x27;s glands");
    expect(html).not.toContain("**Skene&#x27;s glands**");
    expect(html).not.toContain("**prostate**");
    // Additive pearl tail (different fact from body) renders
    expect(html).toContain("data-frame-pearl");
    expect(html).toContain("External urethral meatus");
    expect(html).toContain("1 cm");
    expect(html).not.toContain("**1 cm**");
    // Canonical anchor surface still present
    expect(html).toContain('data-anchor-surface="canonical"');
    // Old theatrical chrome gone
    expect(html).not.toContain("rounded-lib-md border border-amber-200 bg-amber-50/80");
  });

  it("does not crash on legacy or partially-null display payloads", () => {
    const legacyHtml = renderToStaticMarkup(
      <FrameCardV2
        frame={buildFrame({
          id: "legacy-1",
          kind: "core",
          schemaVersion: undefined,
          content: undefined,
          v8Display: undefined,
          v8Flags: undefined,
          hasStructuralReformat: false,
          body: "Legacy body-only rows still render.",
        })}
      />,
    );

    const partialHtml = renderToStaticMarkup(
      <FrameCardV2
        frame={buildFrame({
          id: "partial-1",
          kind: "concept",
          v8Display: {
            ...emptyDisplayV8(),
            listItems: null,
            tableData: null,
            mermaid: null,
            interactiveData: null,
            callouts: null,
          },
        })}
      />,
    );

    expect(legacyHtml).toContain("Legacy body-only rows still render.");
    expect(partialHtml).toContain("Canonical prose stays available for anchors.");
  });
});
