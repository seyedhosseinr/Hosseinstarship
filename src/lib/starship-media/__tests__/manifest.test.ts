import { describe, expect, it } from "vitest";
import { validateManifest, isSafeFilename } from "../manifest";

const CH = 164;

function ok(parsed: unknown, ch = CH) {
  const r = validateManifest(parsed, ch);
  if (!r.ok) throw new Error(`Expected ok validation, got error: ${r.message}`);
  return r;
}
function err(parsed: unknown, ch = CH) {
  const r = validateManifest(parsed, ch);
  if (r.ok) throw new Error("Expected validation error, got ok");
  return r;
}

describe("validateManifest — top-level shape", () => {
  it("rejects non-object input", () => {
    expect(err(null).error).toBe("not-an-object");
    expect(err("string").error).toBe("not-an-object");
    expect(err([]).error).toBe("not-an-object");
  });
  it("rejects missing/non-integer chapterNumber", () => {
    expect(err({}).error).toBe("missing-chapter-number");
    expect(err({ chapterNumber: "164", assets: [] }).error).toBe("missing-chapter-number");
    expect(err({ chapterNumber: 1.5, assets: [] }).error).toBe("missing-chapter-number");
  });
  it("rejects when manifest.chapterNumber differs from selected chapter", () => {
    const r = err({ chapterNumber: 200, assets: [{ mediaId: "x", kind: "figure", filename: "x.png" }] });
    expect(r.error).toBe("chapter-mismatch");
    expect(r.manifestChapterNumber).toBe(200);
  });
  it("rejects missing/invalid assets array", () => {
    expect(err({ chapterNumber: CH }).error).toBe("missing-assets");
    expect(err({ chapterNumber: CH, assets: "x" }).error).toBe("assets-not-array");
    expect(err({ chapterNumber: CH, assets: [] }).error).toBe("empty-assets");
  });
});

describe("validateManifest — per-asset rules", () => {
  it("accepts a minimal canonical entry", () => {
    const r = ok({
      chapterNumber: CH,
      assets: [{ mediaId: "ch164_fig1", kind: "figure", filename: "fig1.png" }],
    });
    expect(r.valid).toHaveLength(1);
    expect(r.valid[0].mediaId).toBe("ch164_fig1");
    expect(r.valid[0].kind).toBe("figure");
    expect(r.valid[0].filename).toBe("fig1.png");
    // Optional fields default to null/false.
    expect(r.valid[0].refId).toBeNull();
    expect(r.valid[0].figureLabel).toBeNull();
    expect(r.valid[0].segmentId).toBeNull();
    expect(r.valid[0].sourcePage).toBeNull();
    expect(r.valid[0].caption).toBeNull();
    expect(r.valid[0].tags).toBeNull();
    expect(r.valid[0].highYield).toBe(false);
    expect(r.rejected).toHaveLength(0);
  });

  it("preserves all optional fields when present", () => {
    const r = ok({
      chapterNumber: CH,
      assets: [
        {
          mediaId: "ch164_fig_164_4",
          refId: "figure:164.4",
          figureLabel: "Figure 164.4",
          kind: "figure",
          filename: "fig-164-4.png",
          segmentId: "ch164_seg01",
          sourcePage: 12,
          caption: "anatomy landmark",
          tags: ["anatomy", "landmark"],
          highYield: true,
        },
      ],
    });
    expect(r.valid[0]).toMatchObject({
      mediaId: "ch164_fig_164_4",
      refId: "figure:164.4",
      figureLabel: "Figure 164.4",
      kind: "figure",
      segmentId: "ch164_seg01",
      sourcePage: 12,
      caption: "anatomy landmark",
      tags: ["anatomy", "landmark"],
      highYield: true,
    });
  });

  it("rejects invalid kinds", () => {
    const r = ok({
      chapterNumber: CH,
      assets: [
        { mediaId: "a", kind: "diagram", filename: "x.png" },
      ],
    });
    expect(r.valid).toHaveLength(0);
    expect(r.rejected).toHaveLength(1);
    expect(r.rejected[0].reason).toBe("invalid-kind");
  });

  it("rejects unsafe filenames (path traversal, absolute, dotted, no extension)", () => {
    const r = ok({
      chapterNumber: CH,
      assets: [
        { mediaId: "a1", kind: "figure", filename: "../etc/passwd" },
        { mediaId: "a2", kind: "figure", filename: "/abs/path.png" },
        { mediaId: "a3", kind: "figure", filename: "no-extension" },
        { mediaId: "a4", kind: "figure", filename: "weird name.png" },
      ],
    });
    expect(r.valid).toHaveLength(0);
    expect(r.rejected.map((x) => x.reason)).toEqual([
      "invalid-filename",
      "invalid-filename",
      "invalid-filename",
      "invalid-filename",
    ]);
  });

  it("flags duplicate mediaIds within the same manifest", () => {
    const r = ok({
      chapterNumber: CH,
      assets: [
        { mediaId: "dup", kind: "figure", filename: "a.png" },
        { mediaId: "dup", kind: "image", filename: "b.png" },
      ],
    });
    expect(r.valid).toHaveLength(1);
    expect(r.valid[0].kind).toBe("figure");
    expect(r.rejected).toHaveLength(1);
    expect(r.rejected[0].reason).toBe("duplicate-media-id");
    expect(r.rejected[0].mediaId).toBe("dup");
  });

  it("rejects entries with malformed mediaId", () => {
    const r = ok({
      chapterNumber: CH,
      assets: [
        { mediaId: "bad space", kind: "figure", filename: "a.png" },
        { mediaId: "ok_id", kind: "figure", filename: "b.png" },
      ],
    });
    expect(r.valid.map((v) => v.mediaId)).toEqual(["ok_id"]);
    expect(r.rejected).toHaveLength(1);
    expect(r.rejected[0].reason).toBe("invalid-media-id");
  });

  it("rejects non-object asset entries gracefully", () => {
    const r = ok({
      chapterNumber: CH,
      assets: ["not-an-object", null, { mediaId: "a", kind: "figure", filename: "a.png" }],
    });
    expect(r.valid.map((v) => v.mediaId)).toEqual(["a"]);
    expect(r.rejected).toHaveLength(2);
    expect(r.rejected.every((x) => x.reason === "missing-required-field")).toBe(true);
  });

  it("requires required fields and reports missing per entry", () => {
    const r = ok({
      chapterNumber: CH,
      assets: [
        { kind: "figure", filename: "a.png" },              // no mediaId
        { mediaId: "b", filename: "b.png" },                // no kind
        { mediaId: "c", kind: "figure" },                    // no filename
      ],
    });
    expect(r.valid).toHaveLength(0);
    expect(r.rejected.map((x) => x.reason)).toEqual([
      "missing-required-field",
      "missing-required-field",
      "missing-required-field",
    ]);
  });
});

describe("isSafeFilename", () => {
  it("accepts simple filenames with extensions", () => {
    expect(isSafeFilename("a.png")).toBe(true);
    expect(isSafeFilename("fig-164-4.png")).toBe(true);
    expect(isSafeFilename("complex_name.with-dashes.jpg")).toBe(true);
  });
  it("rejects path traversal and slashes", () => {
    expect(isSafeFilename("../foo.png")).toBe(false);
    expect(isSafeFilename("a/b.png")).toBe(false);
    expect(isSafeFilename("\\\\server\\share\\x.png")).toBe(false);
  });
  it("rejects names without an extension", () => {
    expect(isSafeFilename("noext")).toBe(false);
    expect(isSafeFilename(".dotfile")).toBe(false);
  });
});
