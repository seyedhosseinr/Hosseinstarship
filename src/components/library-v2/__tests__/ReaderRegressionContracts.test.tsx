import { readFileSync } from "node:fs";
import { join } from "node:path";
import React, { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { FrameCardV2 } from "../FrameCardV2";
import { SegmentRenderer } from "../SegmentRenderer";
import type { FrameViewModel, SectionViewModel } from "@/lib/contract/note-viewer.types";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function buildFrame(overrides: Partial<FrameViewModel> = {}): FrameViewModel {
  return {
    id: "frame-contract-1",
    kind: "concept",
    title: "Reader contract frame",
    summary: null,
    body: "Canonical reader text.",
    marginNote: null,
    linkedQuestions: [],
    content: "Canonical reader text.",
    ...overrides,
  };
}

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("reader regression DOM contracts", () => {
  it("renders visible reference marker UI and inline clickable media anchors in FrameCardV2", () => {
    const html = renderToStaticMarkup(
      <FrameCardV2
        frame={buildFrame({
          id: "media-reference-frame",
          body: "Review Figure 164.4 before choosing the next test.",
          content: "Review Figure 164.4 before choosing the next test.",
          linkedQuestions: [
            {
              questionId: "q-1",
              stem: "Which workup is next?",
              relationType: "primary",
            },
          ],
        })}
      />,
    );

    expect(html).toContain('data-frame-id="media-reference-frame"');
    expect(html).toContain('data-anchor-surface="canonical"');
    expect(html).toContain('data-reader-reference-rail="true"');
    expect(html).toContain('data-reader-rail-marker="true"');
    expect(html).toContain('aria-label="1 source reference"');
    expect(html).toContain("<button");
    expect(html).toContain('data-reader-media-anchor="true"');
    expect(html).toContain("Figure 164.4");
    expect(html).toContain('type="button"');
  });

  it("opens the reference rail and media fallback from the rendered controls", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <FrameCardV2
          frame={buildFrame({
            id: "interactive-contract-frame",
            body: "Compare Fig. 164-4 with the source stem.",
            content: "Compare Fig. 164-4 with the source stem.",
            linkedQuestions: [
              {
                questionId: "q-1",
                stem: "Which workup is next?",
                relationType: "primary",
              },
            ],
          })}
        />,
      );
    });

    const marker = container.querySelector<HTMLButtonElement>("[data-reader-rail-marker]");
    const rail = container.querySelector<HTMLDetailsElement>("[data-reader-reference-rail]");
    expect(marker).not.toBeNull();
    expect(rail).not.toBeNull();
    expect(rail!.open).toBe(false);

    act(() => {
      marker!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(rail!.open).toBe(true);

    const mediaAnchor = container.querySelector<HTMLButtonElement>("[data-reader-media-anchor]");
    expect(mediaAnchor).not.toBeNull();
    expect(mediaAnchor!.textContent).toBe("Fig. 164-4");

    act(() => {
      mediaAnchor!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelector("[data-reader-media-fallback]")).not.toBeNull();
    expect(container.textContent).toContain("This image/media reference is not imported yet.");

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps SegmentRenderer section and frame data attributes for selection and auto-highlight", () => {
    const sections: SectionViewModel[] = [
      {
        id: "section-contract-1",
        title: "Contract section",
        hook: null,
        closingKeypoint: null,
        frames: [buildFrame({ id: "frame-contract-2" })],
      },
    ];

    const html = renderToStaticMarkup(<SegmentRenderer sections={sections} />);

    expect(html).toContain('data-section-id="section-contract-1"');
    expect(html).toContain('data-frame-id="frame-contract-2"');
    expect(html).toContain('data-anchor-surface="canonical"');
  });

  it("keeps both reader shells wired to SelectionPopup, auto-highlight, and reader content settings", () => {
    for (const path of [
      "src/components/library-v2/ChapterReaderV2.tsx",
      "src/components/library-v2/NotePageV2.tsx",
    ]) {
      const source = readSource(path);

      expect(source).toContain("useAutoHighlight");
      expect(source).toContain("<SelectionPopup");
      expect(source).toContain("autoHighlight={autoHighlight}");
      expect(source).toContain('data-reader-content="true"');
      expect(source).toContain("reader-content");
      expect(source).toContain("--reader-line-height");
      expect(source).toContain("--reader-prose-w");
    }
  });
});
