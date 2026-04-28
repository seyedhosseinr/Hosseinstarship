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
import type { MediaAsset } from "@/lib/starship-media/types";

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

/* ────────────────────────────────────────────────────────────────────────
   Phase 2 — registry resolver paths
   ────────────────────────────────────────────────────────────────────────
   The provider runs `resolveMediaAsset` on click and supplies the
   resolved row (or null) to the lightbox. These tests assert that:
     • An empty registry → fallback dialog (Phase 1 behavior preserved)
     • A populated registry whose row matches → matched dialog with
       caption / image / kind badge / high-yield badge / page metadata
     • The flag-off path still bypasses both anchors and the fetch
   ──────────────────────────────────────────────────────────────────── */

function pickAsset(over: Partial<MediaAsset>): MediaAsset {
  return {
    id: over.id ?? `id-${over.mediaId ?? "x"}`,
    mediaId: over.mediaId ?? "media-x",
    chapterNumber: over.chapterNumber ?? 164,
    segmentId: over.segmentId ?? null,
    refId: over.refId ?? null,
    figureLabel: over.figureLabel ?? null,
    kind: over.kind ?? "figure",
    filename: over.filename ?? null,
    storagePath: over.storagePath ?? null,
    sourcePage: over.sourcePage ?? null,
    caption: over.caption ?? null,
    tags: over.tags ?? null,
    highYield: over.highYield ?? false,
    createdAt: over.createdAt ?? 0,
    updatedAt: over.updatedAt ?? 0,
  };
}

describe("Media reader pipeline — Phase 2 registry resolution", () => {
  it("unmatched reference (registry empty) → fallback dialog identical to Phase 1", () => {
    const sections = [
      buildSection("sec-x", "See Figure 164.4 here."),
    ];
    act(() => {
      root.render(
        <MediaRefProvider enabled chapterNo={164} assets={[]}>
          <SegmentRenderer
            sections={sections}
            chapterNo={164}
            segmentId="ch164-seg-01"
          />
        </MediaRefProvider>,
      );
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>(
          "button[data-media-ref-anchor='true']",
        )!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const docText = document.body.textContent ?? "";
    expect(docText).toContain("Image not imported yet");
    // Fallback shows the verbatim label and Ref ID.
    expect(docText).toContain("Figure 164.4");
    expect(docText).toContain("figure:164.4");
    // No matched-only UI is rendered.
    expect(document.querySelector('[data-testid="media-image"]')).toBeNull();
    expect(document.querySelector('[data-testid="media-caption"]')).toBeNull();
    expect(
      document.querySelector('[data-testid="media-kind-badge"]'),
    ).toBeNull();
  });

  it("matched reference → populated media dialog with image, caption, kind + high-yield badges, and page metadata", () => {
    const target = pickAsset({
      mediaId: "campbell-164-fig-164-4",
      refId: "figure:164.4",
      figureLabel: "Figure 164.4 — sciatic foramen",
      kind: "figure",
      chapterNumber: 164,
      segmentId: null,
      filename: "fig-164-4.png",
      storagePath: "/media/campbell/164/fig-164-4.png",
      sourcePage: 3782,
      caption: "Greater vs lesser sciatic foramen in the female pelvis.",
      tags: ["anatomy", "pelvic-floor"],
      highYield: true,
    });
    const sections = [
      buildSection("sec-match", "Detailed anatomy is shown in Figure 164.4."),
    ];

    act(() => {
      root.render(
        <MediaRefProvider enabled chapterNo={164} assets={[target]}>
          <SegmentRenderer
            sections={sections}
            chapterNo={164}
            segmentId="ch164-seg-01"
          />
        </MediaRefProvider>,
      );
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>(
          "button[data-media-ref-anchor='true']",
        )!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const docText = document.body.textContent ?? "";
    // The matched branch's description differs from the fallback's.
    expect(docText).toContain("Imported asset");
    expect(docText).not.toContain("Image not imported yet");

    // Image element rendered with the storagePath src.
    const img = document.querySelector<HTMLImageElement>(
      '[data-testid="media-image"]',
    );
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe(target.storagePath);

    // Caption rendered.
    const caption = document.querySelector('[data-testid="media-caption"]');
    expect(caption?.textContent).toContain("sciatic foramen");

    // Kind + high-yield badges visible.
    expect(
      document.querySelector('[data-testid="media-kind-badge"]')?.textContent,
    ).toBe("Figure");
    expect(
      document.querySelector('[data-testid="media-high-yield-badge"]')
        ?.textContent,
    ).toContain("High yield");

    // Page metadata present.
    expect(docText).toContain("3782");
    // mediaId surfaced as the canonical handle.
    expect(docText).toContain("campbell-164-fig-164-4");
  });

  it("flag off → registry assets supplied but no anchors mounted, no fetch attempted, prose intact", () => {
    const target = pickAsset({
      mediaId: "would-not-match",
      refId: "figure:1",
      chapterNumber: 1,
    });
    const sections = [
      buildSection("sec-off", "See Figure 1 in the disabled scenario."),
    ];
    act(() => {
      root.render(
        <MediaRefProvider enabled={false} chapterNo={1} assets={[target]}>
          <SegmentRenderer
            sections={sections}
            chapterNo={1}
            segmentId="ch1-seg-off"
          />
        </MediaRefProvider>,
      );
    });

    expect(
      container.querySelectorAll("button[data-media-ref-anchor='true']").length,
    ).toBe(0);
    expect(container.textContent).toContain("Figure 1");
    expect(container.textContent).toContain("disabled scenario");
    // No dialog mounted at all.
    expect(document.querySelector('[data-testid="media-image"]')).toBeNull();
    expect(document.body.textContent).not.toContain("Imported asset");
    expect(document.body.textContent).not.toContain("Image not imported yet");
  });

  it("matched asset whose storagePath is null still renders metadata (no broken image)", () => {
    const target = pickAsset({
      mediaId: "metadata-only",
      refId: "image:2",
      kind: "image",
      figureLabel: "Image 2",
      chapterNumber: 5,
      caption: "Pending bundle import.",
      storagePath: null,
    });
    const sections = [
      buildSection("sec-fa-2", "نگاه کنید به تصویر ۲ برای جزئیات."),
    ];
    act(() => {
      root.render(
        <MediaRefProvider enabled chapterNo={5} assets={[target]}>
          <SegmentRenderer
            sections={sections}
            chapterNo={5}
            segmentId="ch5-seg-fa"
          />
        </MediaRefProvider>,
      );
    });
    act(() => {
      container
        .querySelector<HTMLButtonElement>(
          "button[data-media-ref-anchor='true']",
        )!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    // No <img> when storagePath is null.
    expect(document.querySelector('[data-testid="media-image"]')).toBeNull();
    // Frame container also absent.
    expect(
      document.querySelector('[data-testid="media-image-frame"]'),
    ).toBeNull();
    // But caption + kind badge + matched description ARE rendered.
    expect(
      document.querySelector('[data-testid="media-caption"]')?.textContent,
    ).toContain("Pending bundle import");
    expect(document.body.textContent).toContain("Imported asset");
    expect(
      document.querySelector('[data-testid="media-kind-badge"]')?.textContent,
    ).toBe("Image");
  });
});
