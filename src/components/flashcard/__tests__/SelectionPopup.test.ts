import { describe, expect, it } from "vitest";

import {
  findUniqueQuoteOffsets,
  resolveSelectionAgainstCanonicalSurface,
} from "../SelectionPopup";

function createRangeForText(node: Text, start: number, end: number) {
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  return range;
}

describe("SelectionPopup canonical anchoring resolution", () => {
  it("uses direct canonical offsets when the selection is inside canonical prose, even with duplicate substrings", () => {
    const frame = document.createElement("div");
    frame.dataset.frameId = "frame-1";
    frame.dataset.contentHash = "sha256:frame-1";

    const canonical = document.createElement("div");
    canonical.dataset.anchorSurface = "canonical";
    canonical.dataset.contentHash = "sha256:canonical-1";
    const canonicalText = document.createTextNode("alpha beta alpha gamma");
    canonical.appendChild(canonicalText);
    frame.appendChild(canonical);

    const secondAlphaStart = canonicalText.data.lastIndexOf("alpha");
    const range = createRangeForText(canonicalText, secondAlphaStart, secondAlphaStart + "alpha".length);

    const resolved = resolveSelectionAgainstCanonicalSurface(frame, range, "alpha");

    expect(resolved.resolution).toBe("canonical-range");
    expect(resolved.blockText).toBe("alpha beta alpha gamma");
    expect(resolved.start).toBe(secondAlphaStart);
    expect(resolved.end).toBe(secondAlphaStart + 5);
    expect(resolved.contentHash).toBe("sha256:canonical-1");
  });

  it("maps rich-pane selections back to canonical prose only when the quote is unique there", () => {
    const frame = document.createElement("div");
    frame.dataset.frameId = "frame-2";

    const richPane = document.createElement("div");
    const richText = document.createTextNode("CT urography");
    richPane.appendChild(richText);
    frame.appendChild(richPane);

    const canonical = document.createElement("div");
    canonical.dataset.anchorSurface = "canonical";
    const canonicalText = document.createTextNode(
      "Painless hematuria requires CT urography before reassurance.",
    );
    canonical.appendChild(canonicalText);
    frame.appendChild(canonical);

    const range = createRangeForText(richText, 0, richText.data.length);
    const resolved = resolveSelectionAgainstCanonicalSurface(frame, range, "CT urography");

    expect(resolved.resolution).toBe("rich-pane-unique-quote");
    expect(resolved.blockText).toBe(canonicalText.data);
    expect(resolved.start).toBe(canonicalText.data.indexOf("CT urography"));
    expect(resolved.end).toBe(resolved.start! + "CT urography".length);
  });

  it("fails safely when a rich-pane quote is ambiguous inside canonical prose", () => {
    const frame = document.createElement("div");
    frame.dataset.frameId = "frame-3";

    const richPane = document.createElement("div");
    const richText = document.createTextNode("stone");
    richPane.appendChild(richText);
    frame.appendChild(richPane);

    const canonical = document.createElement("div");
    canonical.dataset.anchorSurface = "canonical";
    canonical.appendChild(
      document.createTextNode("stone can obstruct the ureter, and another stone may recur later."),
    );
    frame.appendChild(canonical);

    const range = createRangeForText(richText, 0, richText.data.length);
    const resolved = resolveSelectionAgainstCanonicalSurface(frame, range, "stone");

    expect(resolved.resolution).toBe("ambiguous-rich-pane");
    expect(resolved.blockText).toBeUndefined();
    expect(resolved.start).toBeUndefined();
    expect(resolved.end).toBeUndefined();
  });

  it("detects duplicate substring ambiguity in quote recovery", () => {
    expect(findUniqueQuoteOffsets("alpha beta alpha gamma", "alpha")).toBeNull();
    expect(findUniqueQuoteOffsets("alpha beta gamma", "beta")).toEqual({ start: 6, end: 10 });
  });
});
