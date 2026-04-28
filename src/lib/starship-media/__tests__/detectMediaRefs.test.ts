import { describe, expect, it } from "vitest";
import { detectMediaRefs, normaliseRefNumber } from "../detectMediaRefs";

describe("detectMediaRefs", () => {
  it("returns empty for prose with no media keywords", () => {
    expect(detectMediaRefs("Plain text without any references.")).toEqual([]);
    expect(detectMediaRefs("")).toEqual([]);
  });

  it("matches the canonical English forms", () => {
    const cases = [
      "See Figure 164.4 for the anatomy.",
      "See Fig. 164-4 for the anatomy.",
      "See Fig 164.4 for the anatomy.",
      "Refer to Image 2 below.",
      "Compare with Table 5.2.",
    ];
    for (const text of cases) {
      const refs = detectMediaRefs(text);
      expect(refs, text).toHaveLength(1);
      expect(refs[0].raw, text).toBe(refs[0].raw);
      expect(text.slice(refs[0].start, refs[0].end), text).toBe(refs[0].raw);
    }
  });

  it("classifies kind correctly", () => {
    expect(detectMediaRefs("Figure 1")[0].kind).toBe("figure");
    expect(detectMediaRefs("Fig. 1")[0].kind).toBe("figure");
    expect(detectMediaRefs("Image 1")[0].kind).toBe("image");
    expect(detectMediaRefs("Table 1")[0].kind).toBe("table");
    expect(detectMediaRefs("شکل ۳")[0].kind).toBe("figure");
    expect(detectMediaRefs("تصویر ۲")[0].kind).toBe("image");
    expect(detectMediaRefs("جدول ۴")[0].kind).toBe("table");
  });

  it("normalises Persian-Indic digits to ASCII for refId", () => {
    const refs = detectMediaRefs("نگاه کنید به تصویر ۱۶۴.۴");
    expect(refs).toHaveLength(1);
    expect(refs[0].number).toBe("۱۶۴.۴");
    expect(refs[0].refId).toBe("image:164.4");
    expect(refs[0].label).toBe("تصویر ۱۶۴.۴");
  });

  it("preserves the verbatim slice for splice-based rendering", () => {
    const text = "Greater detail in Fig. 164-4 and شکل ۳.";
    const refs = detectMediaRefs(text);
    expect(refs).toHaveLength(2);
    expect(text.slice(refs[0].start, refs[0].end)).toBe("Fig. 164-4");
    expect(text.slice(refs[1].start, refs[1].end)).toBe("شکل ۳");
  });

  it("does not misfire on words that merely contain the keyword stem", () => {
    expect(detectMediaRefs("Configured 5 patients.")).toEqual([]);
    expect(detectMediaRefs("Imaged 3 lesions.")).toEqual([]);
    expect(detectMediaRefs("Tablespoon 2 tsp.")).toEqual([]);
    expect(detectMediaRefs("شکلی 5")).toEqual([]);
  });

  it("requires whitespace between keyword and number", () => {
    expect(detectMediaRefs("Fig5 was unclear.")).toEqual([]);
    expect(detectMediaRefs("Image2 missing.")).toEqual([]);
  });

  it("accepts NBSP and ZWNJ as separators", () => {
    expect(detectMediaRefs("Fig. 164.4")).toHaveLength(1);
    expect(detectMediaRefs("شکل‌۳")).toHaveLength(1);
  });

  it("accepts en-dash compound numbers", () => {
    const refs = detectMediaRefs("See Fig. 164–4 (en-dash).");
    expect(refs).toHaveLength(1);
    expect(refs[0].refId).toBe("figure:164-4");
  });

  it("yields multiple non-overlapping matches in order", () => {
    const text = "Compare Figure 1 with Figure 2 and Table 3.";
    const refs = detectMediaRefs(text);
    expect(refs.map((r) => r.refId)).toEqual([
      "figure:1",
      "figure:2",
      "table:3",
    ]);
    // Non-overlapping
    for (let i = 1; i < refs.length; i++) {
      expect(refs[i].start).toBeGreaterThanOrEqual(refs[i - 1].end);
    }
  });
});

describe("normaliseRefNumber", () => {
  it("maps Persian-Indic digits to ASCII and en-dashes to hyphens", () => {
    expect(normaliseRefNumber("۱۶۴.۴")).toBe("164.4");
    expect(normaliseRefNumber("164–4")).toBe("164-4");
    expect(normaliseRefNumber("2")).toBe("2");
  });
});
