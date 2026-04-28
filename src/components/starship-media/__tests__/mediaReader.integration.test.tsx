/**
 * Phase-1 media reader pipeline — end-to-end React integration test.
 *
 * Asserted contract:
 *   1. A prose reference like "Figure 164.4" is rendered as a compact
 *      clickable media anchor when the feature is enabled.
 *   2. Clicking the anchor opens the fallback dialog.
 *   3. The dialog shows "Image not imported yet", the detected label,
 *      the chapter number, and the segment id when available.
 *   4. With the feature flag disabled, prose renders normally without
 *      media anchors.
 *   5. Persian RTL examples like "تصویر ۲" and "شکل ۳" are detected.
 *
 * Pure jsdom + react-dom/client — no auth, no PGlite, no OPFS, no
 * importer, no real network. Mirrors FrameCardV2.test.tsx style.
 */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MediaRefProvider } from "../MediaRefProvider";
import { SegmentRenderer } from "@/components/library-v2/SegmentRenderer";
import type { FrameViewModel, SectionViewModel } from "@/lib/contract/note-viewer.types";
import { emptyDisplayV8, emptyFlagsV8 } from "@/lib/contract/note-v8.types";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

function buildFrame(overrides: Partial<FrameViewModel>): FrameViewModel {
  return {
    id: "frame-x",
    kind: "concept",
    title: "",
    summary: null,
    body: "",
    marginNote: null,
    linkedQuestions: [],
    content: "",
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

function buildSection(
  id: string,
  body: string,
  title = "Test section",
): SectionViewModel {
  return {
    id,
    title,
    hook: null,
    closingKeypoint: null,
    frames: [
      buildFrame({
        id: `${id}-f1`,
        kind: "concept",
        title: "",
        body,
        content: body,
      }),
    ],
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("Media reader pipeline (Phase 1)", () => {
  it("renders a clickable media anchor for an English figure reference when enabled", () => {
    const sections = [
      buildSection(
        "sec-eng",
        "Anatomy is detailed in Figure 164.4 — review carefully.",
      ),
    ];
    act(() => {
      root.render(
        <MediaRefProvider enabled>
          <SegmentRenderer
            sections={sections}
            chapterNo={164}
            segmentId="ch164-seg-01"
          />
        </MediaRefProvider>,
      );
    });

    const anchors = container.querySelectorAll<HTMLButtonElement>(
      "button[data-media-ref-anchor='true']",
    );
    expect(anchors.length).toBe(1);
    const anchor = anchors[0]!;
    expect(anchor.getAttribute("data-media-ref-id")).toBe("figure:164.4");
    expect(anchor.getAttribute("data-media-ref-kind")).toBe("figure");
    // The anchor is rendered inline inside the prose surrounding text.
    expect(anchor.textContent).toContain("Figure 164.4");
    // Surrounding prose stays intact in the same paragraph.
    const paragraph = anchor.closest("p");
    expect(paragraph?.textContent).toContain("Anatomy is detailed in");
    expect(paragraph?.textContent).toContain("review carefully");
  });

  it("opens the fallback dialog with chapter, segment, label, and 'Image not imported yet' on click", () => {
    const sections = [
      buildSection(
        "sec-click",
        "See Fig. 164-4 for the relevant landmark.",
      ),
    ];
    act(() => {
      root.render(
        <MediaRefProvider enabled>
          <SegmentRenderer
            sections={sections}
            chapterNo={164}
            segmentId="ch164-seg-42"
          />
        </MediaRefProvider>,
      );
    });

    // Dialog should not be mounted yet.
    expect(document.body.textContent).not.toContain("Image not imported yet");

    const anchor = container.querySelector<HTMLButtonElement>(
      "button[data-media-ref-anchor='true']",
    );
    expect(anchor, "anchor must render before click").not.toBeNull();

    act(() => {
      anchor!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Dialog body lives outside `container` because the Dialog primitive
    // attaches itself directly. Look at document.body.
    const docText = document.body.textContent ?? "";
    expect(docText).toContain("Image not imported yet");
    expect(docText).toContain("Fig. 164-4");
    expect(docText).toContain("164"); // chapter
    expect(docText).toContain("ch164-seg-42"); // segment id
    // The stable refId — ASCII normalised — is rendered as the breadcrumb.
    expect(docText).toContain("figure:164-4");
  });

  it("does NOT render media anchors when the flag is disabled", () => {
    const sections = [
      buildSection(
        "sec-disabled",
        "See Figure 1 for the disabled-flag scenario.",
      ),
    ];
    act(() => {
      root.render(
        <MediaRefProvider enabled={false}>
          <SegmentRenderer
            sections={sections}
            chapterNo={164}
            segmentId="ch164-seg-01"
          />
        </MediaRefProvider>,
      );
    });

    const anchors = container.querySelectorAll(
      "button[data-media-ref-anchor='true']",
    );
    expect(anchors.length).toBe(0);
    // Verbatim text is still rendered in the prose.
    expect(container.textContent).toContain("Figure 1");
    expect(container.textContent).toContain("disabled-flag scenario");
  });

  it("detects Persian RTL references (تصویر, شکل) when enabled", () => {
    const sections = [
      buildSection(
        "sec-fa",
        "نگاه کنید به تصویر ۲ و شکل ۳ برای جزئیات بیشتر.",
      ),
    ];
    act(() => {
      root.render(
        <MediaRefProvider enabled>
          <SegmentRenderer
            sections={sections}
            chapterNo={5}
            segmentId="ch5-seg-fa"
          />
        </MediaRefProvider>,
      );
    });

    const anchors = container.querySelectorAll<HTMLButtonElement>(
      "button[data-media-ref-anchor='true']",
    );
    expect(anchors.length).toBe(2);

    const ids = Array.from(anchors).map((a) =>
      a.getAttribute("data-media-ref-id"),
    );
    expect(ids).toContain("image:2");
    expect(ids).toContain("figure:3");

    // Labels carry verbatim Persian-Indic digits.
    const labels = Array.from(anchors).map((a) => a.textContent ?? "");
    expect(labels.some((t) => t.includes("تصویر ۲"))).toBe(true);
    expect(labels.some((t) => t.includes("شکل ۳"))).toBe(true);
  });
});

