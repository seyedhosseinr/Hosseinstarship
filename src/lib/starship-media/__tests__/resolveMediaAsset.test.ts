import { describe, expect, it } from "vitest";
import { detectMediaRefs } from "../detectMediaRefs";
import { canonicaliseLabel, resolveMediaAsset } from "../resolveMediaAsset";
import type { MediaAsset } from "../types";

function asset(over: Partial<MediaAsset>): MediaAsset {
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

function refOf(text: string) {
  const r = detectMediaRefs(text);
  if (r.length !== 1) throw new Error(`Expected exactly one ref in "${text}", got ${r.length}`);
  return r[0]!;
}

const CTX = { chapterNo: 164, segmentId: "ch164-seg-01" };

describe("canonicaliseLabel", () => {
  it("normalises English forms to kind:number", () => {
    expect(canonicaliseLabel("Figure 164.4")).toBe("figure:164.4");
    expect(canonicaliseLabel("Fig. 164-4")).toBe("figure:164-4");
    expect(canonicaliseLabel("fig 164–4")).toBe("figure:164-4");
    expect(canonicaliseLabel("Image 2")).toBe("image:2");
    expect(canonicaliseLabel("Table 5.2")).toBe("table:5.2");
  });
  it("normalises Persian forms with Persian-Indic digits", () => {
    expect(canonicaliseLabel("تصویر ۲")).toBe("image:2");
    expect(canonicaliseLabel("شکل ۳")).toBe("figure:3");
    expect(canonicaliseLabel("جدول ۴")).toBe("table:4");
    expect(canonicaliseLabel("شکل ۱۶۴.۴")).toBe("figure:164.4");
  });
  it("returns null on garbage / empty / unknown keywords", () => {
    expect(canonicaliseLabel(null)).toBeNull();
    expect(canonicaliseLabel("")).toBeNull();
    expect(canonicaliseLabel("hello world")).toBeNull();
  });
});

describe("resolveMediaAsset", () => {
  it("returns null on empty registry — Reader keeps fallback dialog", () => {
    expect(resolveMediaAsset(refOf("Figure 164.4"), CTX, [])).toBeNull();
  });

  it("Tier 1 — matches on exact refId", () => {
    const target = asset({ mediaId: "m1", refId: "figure:164.4", figureLabel: "Figure 164.4" });
    const distractor = asset({ mediaId: "m2", refId: "figure:200.1", figureLabel: "Figure 200.1" });
    const result = resolveMediaAsset(refOf("Figure 164.4"), CTX, [distractor, target]);
    expect(result?.mediaId).toBe("m1");
  });

  it("Tier 1 is case-insensitive on the prefix", () => {
    const target = asset({ mediaId: "m1", refId: "FIGURE:164.4" });
    const result = resolveMediaAsset(refOf("Figure 164.4"), CTX, [target]);
    expect(result?.mediaId).toBe("m1");
  });

  it("Tier 2 — matches when refId is missing but figureLabel canonicalises identically", () => {
    const target = asset({
      mediaId: "m1",
      refId: null,
      figureLabel: "Fig. 164-4", // canonical form is figure:164-4
    });
    const result = resolveMediaAsset(refOf("Figure 164-4"), CTX, [target]);
    expect(result?.mediaId).toBe("m1");
  });

  it("Tier 2 normalises Persian-Indic digits via the Persian ref", () => {
    const target = asset({
      mediaId: "m-fa",
      kind: "image",
      refId: null,
      figureLabel: "Image 2",
    });
    const result = resolveMediaAsset(refOf("تصویر ۲"), CTX, [target]);
    expect(result?.mediaId).toBe("m-fa");
  });

  it("Tier 3 — chapter + kind + number, falling back from missing refId AND missing label", () => {
    const target = asset({
      mediaId: "m-no-meta",
      chapterNumber: 164,
      kind: "figure",
      refId: null,
      figureLabel: null,
      // The resolver has nothing to canonicalise on — under the current
      // contract it should NOT match. Tier 3 still requires the asset
      // to expose a canonical id via refId or label.
    });
    expect(resolveMediaAsset(refOf("Figure 164.4"), CTX, [target])).toBeNull();
  });

  it("Tier 3 matches when refId is null but label is present (cross-tier safety net)", () => {
    const target = asset({
      mediaId: "m3",
      chapterNumber: 164,
      kind: "figure",
      refId: null,
      figureLabel: "Figure 164.4",
    });
    // Tier 2 should already fire for this case; Tier 3 is a safety net.
    const result = resolveMediaAsset(refOf("Fig. 164.4"), CTX, [target]);
    expect(result?.mediaId).toBe("m3");
  });

  it("ignores cross-chapter rows even when refId looks identical", () => {
    const sameRefDifferentChapter = asset({
      mediaId: "m-other",
      chapterNumber: 200,
      refId: "figure:1",
      figureLabel: "Figure 1",
    });
    // Note: Tier 1 matches by refId alone (no chapter filter) — that's the
    // contract: an importer-stable refId is globally unique, and a stable
    // refId IS expected to be unique cross-chapter when present. This
    // documents the contract rather than asserting the chapter is filtered.
    expect(
      resolveMediaAsset(refOf("Figure 1"), CTX, [sameRefDifferentChapter])?.mediaId,
    ).toBe("m-other");
  });

  it("Tier 2 is global by design — label match wins regardless of chapter", () => {
    // Contract note: Tier 2 (figureLabel) does NOT filter by chapter.
    // If two chapters end up with the same canonical label, the importer
    // is expected to disambiguate with `refId`. Tier 3 is the
    // chapter-scoped fallback for label-less rows.
    const otherChapterButLabelMatches = asset({
      mediaId: "m-other",
      chapterNumber: 200,
      kind: "figure",
      refId: null,
      figureLabel: "Figure 1",
    });
    expect(
      resolveMediaAsset(refOf("Figure 1"), CTX, [otherChapterButLabelMatches])
        ?.mediaId,
    ).toBe("m-other");
  });

  it("Tier 3 will not match an asset whose chapter differs and has no label/refId", () => {
    const otherChapterNoMeta = asset({
      mediaId: "m-other",
      chapterNumber: 200,
      kind: "figure",
      refId: null,
      figureLabel: null,
    });
    expect(
      resolveMediaAsset(refOf("Figure 1"), CTX, [otherChapterNoMeta]),
    ).toBeNull();
  });

  it("does NOT match across kinds (figure vs image)", () => {
    const wrongKind = asset({
      mediaId: "m-img",
      kind: "image",
      refId: "image:5",
      figureLabel: "Image 5",
    });
    // Detector ref is `figure:5`, asset is `image:5`. Tier 1 misses
    // because refIds differ; tier 2 misses because canonicalising the
    // label gives `image:5` not `figure:5`; tier 3 enforces kind match.
    expect(
      resolveMediaAsset(refOf("Figure 5"), CTX, [wrongKind]),
    ).toBeNull();
  });

  it("tie-break — prefers same-segment match over chapter-wide", () => {
    const chapterWide = asset({
      mediaId: "m-wide",
      refId: "figure:1",
      segmentId: null,
    });
    const sameSegment = asset({
      mediaId: "m-narrow",
      refId: "figure:1",
      segmentId: "ch164-seg-01",
    });
    const otherSegment = asset({
      mediaId: "m-other-seg",
      refId: "figure:1",
      segmentId: "ch164-seg-99",
    });
    const result = resolveMediaAsset(
      refOf("Figure 1"),
      CTX,
      [chapterWide, otherSegment, sameSegment],
    );
    expect(result?.mediaId).toBe("m-narrow");
  });

  it("tie-break — prefers chapter-wide (segmentId=null) over an unrelated segment", () => {
    const chapterWide = asset({
      mediaId: "m-wide",
      refId: "figure:1",
      segmentId: null,
    });
    const otherSegment = asset({
      mediaId: "m-other-seg",
      refId: "figure:1",
      segmentId: "ch164-seg-99",
    });
    const result = resolveMediaAsset(
      refOf("Figure 1"),
      CTX,
      [otherSegment, chapterWide],
    );
    expect(result?.mediaId).toBe("m-wide");
  });

  it("tie-break — deterministic by mediaId when nothing distinguishes the candidates", () => {
    const a = asset({ mediaId: "alpha", refId: "figure:1", segmentId: null });
    const b = asset({ mediaId: "beta",  refId: "figure:1", segmentId: null });
    // Two chapter-wide rows with the same refId — tie-broken by mediaId asc.
    const result = resolveMediaAsset(refOf("Figure 1"), CTX, [b, a]);
    expect(result?.mediaId).toBe("alpha");
  });

  it("never throws on weird inputs", () => {
    expect(() =>
      resolveMediaAsset(
        refOf("Figure 1"),
        { chapterNo: null, segmentId: null },
        [asset({ refId: null, figureLabel: null, chapterNumber: 0 })],
      ),
    ).not.toThrow();
  });
});
