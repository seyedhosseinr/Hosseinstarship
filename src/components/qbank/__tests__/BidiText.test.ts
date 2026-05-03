import { describe, it, expect } from "vitest";
import { segmentBidi } from "../BidiText";

describe("segmentBidi — pure Latin input", () => {
  it("returns one latin segment for ASCII-only text", () => {
    const segs = segmentBidi("transition zone");
    expect(segs).toHaveLength(1);
    expect(segs[0].kind).toBe("latin");
    expect(segs[0].text).toBe("transition zone");
  });

  it("keeps multi-word medical phrases as one latin run", () => {
    const segs = segmentBidi("benign prostatic hyperplasia");
    expect(segs).toHaveLength(1);
    expect(segs[0].kind).toBe("latin");
    expect(segs[0].text).toBe("benign prostatic hyperplasia");
  });

  it("keeps hyphenated abbreviations in one run", () => {
    const segs = segmentBidi("PSMA-PET");
    expect(segs).toHaveLength(1);
    expect(segs[0].kind).toBe("latin");
  });

  it("includes Greek letters in latin runs (α β γ)", () => {
    const segs = segmentBidi("5α-reductase");
    expect(segs).toHaveLength(1);
    expect(segs[0].kind).toBe("latin");
  });

  it("includes β3 agonist as one latin run", () => {
    const segs = segmentBidi("β3 agonist");
    expect(segs).toHaveLength(1);
    expect(segs[0].kind).toBe("latin");
  });
});

describe("segmentBidi — mixed Persian/Latin input", () => {
  it("splits 'BPH از transition zone' correctly", () => {
    const segs = segmentBidi("BPH از transition zone");
    const kinds = segs.map((s) => s.kind);
    expect(kinds).toContain("latin");
    expect(kinds).toContain("persian");
    // Latin runs must contain the right words
    const latinTexts = segs.filter((s) => s.kind === "latin").map((s) => s.text.trim());
    expect(latinTexts).toContain("BPH");
    expect(latinTexts.some((t) => t === "transition zone")).toBe(true);
  });

  it("treats Persian-dominant text as persian segment", () => {
    const segs = segmentBidi("هیپرپلازی قابل توجه");
    expect(segs).toHaveLength(1);
    expect(segs[0].kind).toBe("persian");
  });

  it("extracts 'transition zone' as a single latin run from a Persian sentence", () => {
    const text = "هیپرپلازی قابل توجه transition zone بدون";
    const segs = segmentBidi(text);
    const latinRuns = segs.filter((s) => s.kind === "latin").map((s) => s.text.trim());
    // "transition zone" must be a single run (not split on the space)
    expect(latinRuns).toContain("transition zone");
    expect(latinRuns).not.toContain("transition");
    expect(latinRuns).not.toContain("zone");
  });

  it("keeps 'benign prostatic hyperplasia' as one run in Persian text", () => {
    const text = "تشخیص benign prostatic hyperplasia است";
    const segs = segmentBidi(text);
    const latinRuns = segs.filter((s) => s.kind === "latin").map((s) => s.text.trim());
    expect(latinRuns).toContain("benign prostatic hyperplasia");
  });

  it("keeps 'CT abdomen-pelvis' as one run", () => {
    const segs = segmentBidi("نتیجه CT abdomen-pelvis نرمال");
    const latinRuns = segs.filter((s) => s.kind === "latin").map((s) => s.text.trim());
    expect(latinRuns).toContain("CT abdomen-pelvis");
  });

  it("keeps 'high-grade prostatic intraepithelial neoplasia' as one run", () => {
    const text = "تشخیص high-grade prostatic intraepithelial neoplasia";
    const segs = segmentBidi(text);
    const latinRuns = segs.filter((s) => s.kind === "latin").map((s) => s.text.trim());
    expect(latinRuns).toContain("high-grade prostatic intraepithelial neoplasia");
  });

  it("separates 'MRI' from the Persian word 'پروستات'", () => {
    const segs = segmentBidi("MRI پروستات");
    const latinRuns = segs.filter((s) => s.kind === "latin").map((s) => s.text.trim());
    expect(latinRuns).toContain("MRI");
    const persianRuns = segs.filter((s) => s.kind === "persian").map((s) => s.text.trim());
    expect(persianRuns.some((t) => t.includes("پروستات"))).toBe(true);
  });
});

describe("segmentBidi — edge cases", () => {
  it("returns empty array for empty string", () => {
    expect(segmentBidi("")).toEqual([]);
  });

  it("handles single Persian character", () => {
    const segs = segmentBidi("ا");
    expect(segs).toHaveLength(1);
    expect(segs[0].kind).toBe("persian");
  });

  it("handles single Latin character", () => {
    const segs = segmentBidi("A");
    expect(segs).toHaveLength(1);
    expect(segs[0].kind).toBe("latin");
  });

  it("handles option letters A/B/C/D/E as latin", () => {
    for (const letter of ["A", "B", "C", "D", "E"]) {
      const segs = segmentBidi(letter);
      expect(segs[0].kind).toBe("latin");
    }
  });

  it("handles pH = 5.8 style as latin", () => {
    const segs = segmentBidi("pH = 5.8");
    // At minimum, pH must be in a latin run
    const latinRuns = segs.filter((s) => s.kind === "latin").map((s) => s.text.trim());
    expect(latinRuns.some((t) => t.includes("pH"))).toBe(true);
  });

  it("handles Gleason 4+5 as one run", () => {
    const segs = segmentBidi("Gleason 4+5");
    const latinRuns = segs.filter((s) => s.kind === "latin").map((s) => s.text.trim());
    expect(latinRuns).toContain("Gleason 4+5");
  });
});
