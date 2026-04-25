import { afterEach, describe, expect, it } from "vitest";

import {
  findAnchorSurface,
  resolveAnchorRange,
  resolveAnchorRangeByFrameId,
} from "../anchorResolver";

function makeFrame(html: string, frameId = "frame-1"): HTMLElement {
  const frame = document.createElement("div");
  frame.dataset.frameId = frameId;
  frame.innerHTML = html;
  document.body.appendChild(frame);
  return frame;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("findAnchorSurface", () => {
  it("returns the canonical surface when present", () => {
    const frame = makeFrame(
      `<div data-anchor-surface="canonical"><p>hello</p></div>`,
    );
    const surface = findAnchorSurface(frame);
    expect(surface?.dataset.anchorSurface).toBe("canonical");
  });

  it("falls back to the frame element when no canonical surface exists", () => {
    const frame = makeFrame(`<p>hello</p>`);
    expect(findAnchorSurface(frame)).toBe(frame);
  });

  it("returns null for null input", () => {
    expect(findAnchorSurface(null)).toBeNull();
  });
});

describe("resolveAnchorRange — plain LTR", () => {
  it("middle-of-text range in a single text node", () => {
    const frame = makeFrame(
      `<div data-anchor-surface="canonical">renal cell carcinoma</div>`,
    );
    // "cell" → index 6..10
    const r = resolveAnchorRange(frame, 6, 10);
    expect(r).not.toBeNull();
    expect(r!.toString()).toBe("cell");
  });

  it("range spanning <em> emphasis boundary", () => {
    const frame = makeFrame(
      `<div data-anchor-surface="canonical">acute <em>renal</em> failure</div>`,
    );
    // textContent = "acute renal failure" → "renal failure" at 6..19
    const r = resolveAnchorRange(frame, 6, 19);
    expect(r!.toString()).toBe("renal failure");
  });

  it("range spanning soft <br> boundary", () => {
    const frame = makeFrame(
      `<div data-anchor-surface="canonical">line one<br>line two</div>`,
    );
    // textContent = "line oneline two" — <br> contributes 0 text length
    const r = resolveAnchorRange(frame, 5, 12);
    expect(r!.toString()).toBe("oneline");
  });

  it("range at exact start of block", () => {
    const frame = makeFrame(
      `<div data-anchor-surface="canonical">alpha beta gamma</div>`,
    );
    const r = resolveAnchorRange(frame, 0, 5);
    expect(r!.toString()).toBe("alpha");
  });

  it("range at exact end of block", () => {
    const frame = makeFrame(
      `<div data-anchor-surface="canonical">alpha beta gamma</div>`,
    );
    const surfaceLen = "alpha beta gamma".length;
    const r = resolveAnchorRange(frame, surfaceLen - 5, surfaceLen);
    expect(r!.toString()).toBe("gamma");
  });

  it("range covering entire surface", () => {
    const frame = makeFrame(
      `<div data-anchor-surface="canonical"><strong>bold</strong> middle <em>italic</em></div>`,
    );
    const text = "bold middle italic";
    const r = resolveAnchorRange(frame, 0, text.length);
    expect(r!.toString()).toBe(text);
  });

  it("collapsed range (start == end) resolves at the boundary", () => {
    const frame = makeFrame(
      `<div data-anchor-surface="canonical">abc</div>`,
    );
    const r = resolveAnchorRange(frame, 2, 2);
    expect(r).not.toBeNull();
    expect(r!.collapsed).toBe(true);
  });
});

describe("resolveAnchorRange — RTL Persian", () => {
  it("middle-of-text range in Persian text", () => {
    const persian = "بیمار با هماچوری مراجعه کرد";
    const frame = makeFrame(
      `<div data-anchor-surface="canonical">${persian}</div>`,
    );
    // "هماچوری" starts at "بیمار با ".length = 9
    const start = persian.indexOf("هماچوری");
    const end = start + "هماچوری".length;
    const r = resolveAnchorRange(frame, start, end);
    expect(r).not.toBeNull();
    expect(r!.toString()).toBe("هماچوری");
  });

  it("Persian text with ZWNJ (U+200C) is measured in code units", () => {
    // می‌خواهد — ZWNJ between می and خواهد (8 code units)
    const word = "می\u200Cخواهد";
    expect(word.length).toBe(8);
    const frame = makeFrame(
      `<div data-anchor-surface="canonical">او ${word} برود</div>`,
    );
    const surfaceText = `او ${word} برود`;
    const start = surfaceText.indexOf(word);
    const end = start + word.length;
    const r = resolveAnchorRange(frame, start, end);
    expect(r).not.toBeNull();
    expect(r!.toString()).toBe(word);
    // ZWNJ preserved — code-unit accounting
    expect(r!.toString().includes("\u200C")).toBe(true);
  });

  it("Persian text with combining marks counts code units, not graphemes", () => {
    // Letter ا + combining diacritic َ (fatha U+064E) = 2 code units, 1 grapheme
    const aWithFatha = "ا\u064E";
    expect(aWithFatha.length).toBe(2);
    const frame = makeFrame(
      `<div data-anchor-surface="canonical">${aWithFatha}بجد</div>`,
    );
    // Anchor "بجد" → starts at index 2 (after the 2 code units of ا+fatha)
    const r = resolveAnchorRange(frame, 2, 5);
    expect(r!.toString()).toBe("بجد");
  });
});

describe("resolveAnchorRange — defensive paths", () => {
  it("returns null for missing frame", () => {
    expect(resolveAnchorRange(null, 0, 5)).toBeNull();
  });

  it("returns null for negative start", () => {
    const frame = makeFrame(`<div data-anchor-surface="canonical">abc</div>`);
    expect(resolveAnchorRange(frame, -1, 2)).toBeNull();
  });

  it("returns null for end before start", () => {
    const frame = makeFrame(`<div data-anchor-surface="canonical">abc</div>`);
    expect(resolveAnchorRange(frame, 3, 1)).toBeNull();
  });

  it("returns null for stale offsets beyond current blockText length", () => {
    const frame = makeFrame(`<div data-anchor-surface="canonical">abc</div>`);
    expect(resolveAnchorRange(frame, 1, 99)).toBeNull();
  });

  it("returns null for non-finite offsets without throwing", () => {
    const frame = makeFrame(`<div data-anchor-surface="canonical">abc</div>`);
    expect(resolveAnchorRange(frame, NaN, 2)).toBeNull();
    expect(resolveAnchorRange(frame, 0, Infinity)).toBeNull();
  });

  it("works on a frame with no canonical surface (uses frame as fallback)", () => {
    const frame = makeFrame(`<p>plain frame text</p>`);
    const r = resolveAnchorRange(frame, 6, 11);
    expect(r!.toString()).toBe("frame");
  });

  it("empty surface returns collapsed (0,0) range, null otherwise", () => {
    const frame = makeFrame(`<div data-anchor-surface="canonical"></div>`);
    expect(resolveAnchorRange(frame, 0, 0)?.collapsed).toBe(true);
    expect(resolveAnchorRange(frame, 0, 1)).toBeNull();
  });
});

describe("resolveAnchorRangeByFrameId", () => {
  it("locates frame by data-frame-id and resolves the range", () => {
    makeFrame(
      `<div data-anchor-surface="canonical">hello world</div>`,
      "frame-xyz",
    );
    const r = resolveAnchorRangeByFrameId(document, "frame-xyz", 6, 11);
    expect(r!.toString()).toBe("world");
  });

  it("returns null for unknown frameId", () => {
    expect(resolveAnchorRangeByFrameId(document, "frame-missing", 0, 1)).toBeNull();
  });

  it("escapes frameId values that contain CSS-special characters", () => {
    makeFrame(
      `<div data-anchor-surface="canonical">abcdef</div>`,
      "frame:1.2",
    );
    const r = resolveAnchorRangeByFrameId(document, "frame:1.2", 0, 3);
    expect(r!.toString()).toBe("abc");
  });
});
