import { readFileSync } from "node:fs";
import { join } from "node:path";
import React, { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { SegmentRenderer } from "../SegmentRenderer";
import { MediaRefProvider } from "@/components/starship-media/MediaRefProvider";
import type { FrameViewModel, SectionViewModel } from "@/lib/contract/note-viewer.types";
import type { MediaAsset } from "@/lib/starship-media/types";

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

function buildSection(frame: FrameViewModel): SectionViewModel {
  return {
    id: "section-contract-1",
    title: "Contract section",
    hook: null,
    closingKeypoint: null,
    frames: [frame],
  };
}

function buildAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "asset-contract-1",
    mediaId: "campbell-164-fig-164-4",
    chapterNumber: 164,
    segmentId: null,
    refId: "figure:164-4",
    figureLabel: "Fig. 164-4",
    kind: "figure",
    filename: "ch164_fig_164_4.png",
    storagePath: "/media/campbell/164/ch164_fig_164_4.png",
    sourcePage: null,
    caption: "Imported contract image.",
    tags: null,
    highYield: false,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe("reader regression DOM contracts", () => {
  it("renders visible reference marker UI and inline clickable media anchors in the real SegmentRenderer path", () => {
    const html = renderToStaticMarkup(
      <MediaRefProvider enabled chapterNo={164} assets={[]}>
        <SegmentRenderer
          chapterNo={164}
          segmentId="ch164-contract-seg"
          sections={[
            buildSection(
              buildFrame({
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
              }),
            ),
          ]}
        />
      </MediaRefProvider>,
    );

    expect(html).toContain('data-frame-id="media-reference-frame"');
    expect(html).toContain('data-anchor-surface="canonical"');
    expect(html).toContain('data-reader-reference-rail="true"');
    expect(html).toContain('data-reader-rail-marker="true"');
    expect(html).toContain('aria-label="1 source references"');
    expect(html).toContain("<button");
    expect(html).toContain('data-media-ref-anchor="true"');
    expect(html).toContain('data-media-ref-id="figure:164.4"');
    expect(html).toContain("Figure 164.4");
    expect(html).toContain('type="button"');
  });

  it("opens the reference rail and matched media lightbox from the rendered controls", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <MediaRefProvider enabled chapterNo={164} assets={[buildAsset()]}>
          <SegmentRenderer
            chapterNo={164}
            segmentId="ch164-contract-seg"
            sections={[
              buildSection(
                buildFrame({
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
                }),
              ),
            ]}
          />
        </MediaRefProvider>,
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

    const mediaAnchor = container.querySelector<HTMLButtonElement>("[data-media-ref-anchor]");
    expect(mediaAnchor).not.toBeNull();
    expect(mediaAnchor!.textContent).toBe("Fig. 164-4");

    act(() => {
      mediaAnchor!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(document.body.textContent).toContain("Imported asset");
    expect(document.body.textContent).not.toContain("Image not imported yet");
    expect(document.querySelector<HTMLImageElement>('[data-testid="media-image"]')?.getAttribute("src"))
      .toBe("/media/campbell/164/ch164_fig_164_4.png");

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
