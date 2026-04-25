import { describe, expect, it } from "vitest";

import { migrateAnnotation } from "../useReaderAnnotations";

describe("migrateAnnotation", () => {
  it("round-trips a current-shape ReaderAnnotation", () => {
    const input = {
      id: "ann_1",
      docId: "ch-12",
      chapterNo: 12,
      frameId: "frame-3",
      sectionId: "sec-1",
      quote: "renal cell carcinoma",
      type: "highlight",
      color: "#DFFF4F",
      comment: null,
      createdAt: "2026-04-23T00:00:00.000Z",
    };
    expect(migrateAnnotation(input)).toEqual(input);
  });

  it("upgrades a legacy row missing kind to 'highlight'", () => {
    const legacy = {
      id: "ann_legacy",
      docId: "ch-1",
      chapterNo: 1,
      frameId: "frame-x",
      sectionId: null,
      quote: "stenosis",
      // no `type` field — legacy LocalStorage row written before kind existed
      color: "#B8F36B",
      comment: null,
      createdAt: "2025-01-01T00:00:00.000Z",
    };
    const out = migrateAnnotation(legacy);
    expect(out?.type).toBe("highlight");
    expect(out?.quote).toBe("stenosis");
    expect(out?.id).toBe("ann_legacy");
  });

  it("coerces an unrecognised kind back to 'highlight'", () => {
    const out = migrateAnnotation({
      id: "ann_2",
      quote: "hematuria",
      type: "lasso", // invented kind
    });
    expect(out?.type).toBe("highlight");
  });

  it("preserves underline and comment kinds", () => {
    expect(migrateAnnotation({ id: "a", quote: "x", type: "underline" })?.type).toBe("underline");
    expect(migrateAnnotation({ id: "a", quote: "x", type: "comment" })?.type).toBe("comment");
  });

  it("accepts Dexie-shaped rows (kind + textQuote + sourceBlockId + localCreatedAt)", () => {
    const row = {
      id: "ann_dexie",
      docId: "doc-1",
      chapterNo: 5,
      sourceBlockId: "frame-7",
      kind: "underline",
      color: null,
      comment: null,
      textQuote: "obstructive uropathy",
      textPositionStart: 12,
      textPositionEnd: 32,
      prefix: "",
      suffix: "",
      blockChecksum: "",
      status: "active",
      localCreatedAt: "2026-03-01T00:00:00.000Z",
      localUpdatedAt: "2026-03-01T00:00:00.000Z",
    };
    const out = migrateAnnotation(row);
    expect(out).toMatchObject({
      id: "ann_dexie",
      docId: "doc-1",
      chapterNo: 5,
      frameId: "frame-7",
      type: "underline",
      quote: "obstructive uropathy",
      createdAt: "2026-03-01T00:00:00.000Z",
    });
  });

  it("returns null when id is missing", () => {
    expect(migrateAnnotation({ quote: "x", type: "highlight" })).toBeNull();
  });

  it("returns null when both quote and textQuote are missing", () => {
    expect(migrateAnnotation({ id: "ann_3", type: "highlight" })).toBeNull();
  });

  it("returns null for non-objects", () => {
    expect(migrateAnnotation(null)).toBeNull();
    expect(migrateAnnotation(undefined)).toBeNull();
    expect(migrateAnnotation("string")).toBeNull();
    expect(migrateAnnotation(42)).toBeNull();
  });

  it("normalises numeric chapterNo, defaults missing to 0", () => {
    expect(migrateAnnotation({ id: "a", quote: "x" })?.chapterNo).toBe(0);
    expect(migrateAnnotation({ id: "a", quote: "x", chapterNo: 7 })?.chapterNo).toBe(7);
    expect(migrateAnnotation({ id: "a", quote: "x", chapterNo: "7" })?.chapterNo).toBe(0);
  });

  it("uses createdAt when present, falls back to localCreatedAt", () => {
    const a = migrateAnnotation({ id: "a", quote: "x", createdAt: "2026-01-01T00:00:00.000Z" });
    expect(a?.createdAt).toBe("2026-01-01T00:00:00.000Z");
    const b = migrateAnnotation({
      id: "a",
      quote: "x",
      localCreatedAt: "2026-02-02T00:00:00.000Z",
    });
    expect(b?.createdAt).toBe("2026-02-02T00:00:00.000Z");
  });

  it("survives RTL Persian quote with ZWNJ + combining marks unchanged", () => {
    // ZWNJ between می and خواهد is a common Persian word boundary marker
    const persianQuote = "می\u200Cخواهد"; // U+200C ZWNJ
    const out = migrateAnnotation({
      id: "fa1",
      quote: persianQuote,
      type: "highlight",
    });
    expect(out?.quote).toBe(persianQuote);
    expect(out?.quote.length).toBe(persianQuote.length); // code units preserved
  });
});
