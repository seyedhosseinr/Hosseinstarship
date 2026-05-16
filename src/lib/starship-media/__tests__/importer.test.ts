/**
 * Importer end-to-end tests.
 *
 * The importer is fully dependency-injected and zip-agnostic — these
 * tests build a synthetic `BundleEntries` map directly (no real zip),
 * feed it through the importer, and assert against an in-memory
 * storage map and a fake upserter. No DB. No filesystem. No network.
 */

import { describe, expect, it } from "vitest";
import { strToU8 } from "fflate";

import {
  runMediaBundleImport,
  type AssetUpserter,
  type BundleEntries,
  type BundleStorage,
  type MediaAssetUpsertRow,
} from "../importer";
import { buildBundledMediaServePath } from "../storage";

interface InMemoryDeps {
  storage: BundleStorage;
  upserter: AssetUpserter;
  files: Map<string, Uint8Array>;
  upsertCalls: MediaAssetUpsertRow[][];
}

function inMemoryDeps(opts: {
  upsertResult?: () => Promise<{ inserted: number; updated: number }>;
  failOnFile?: (relPath: string) => boolean;
} = {}): InMemoryDeps {
  const files = new Map<string, Uint8Array>();
  const upsertCalls: MediaAssetUpsertRow[][] = [];
  const storage: BundleStorage = {
    async writeFile(relPath, data) {
      if (opts.failOnFile?.(relPath)) {
        throw new Error(`simulated fs failure for ${relPath}`);
      }
      files.set(relPath, data);
      return buildBundledMediaServePath(relPath);
    },
  };
  const upserter: AssetUpserter = {
    async upsert(rows) {
      upsertCalls.push(rows);
      if (opts.upsertResult) return opts.upsertResult();
      return { inserted: rows.length, updated: 0 };
    },
  };
  return { storage, upserter, files, upsertCalls };
}

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

function bundle(manifestObj: unknown, files: Record<string, Uint8Array>): BundleEntries {
  return {
    "manifest.json": strToU8(JSON.stringify(manifestObj)),
    ...files,
  };
}

describe("runMediaBundleImport — happy path", () => {
  it("imports every valid asset, writes files, and upserts rows once", async () => {
    const manifest = {
      chapterNumber: 164,
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
          tags: ["anatomy"],
          highYield: true,
        },
        { mediaId: "ch164_img_2", kind: "image", filename: "img-2.png" },
      ],
    };
    const entries = bundle(manifest, {
      "fig-164-4.png": PNG_BYTES,
      "img-2.png": PNG_BYTES,
    });
    const deps = inMemoryDeps();

    const summary = await runMediaBundleImport({
      entries,
      selectedChapterNumber: 164,
      ...deps,
    });

    expect(summary.ok).toBe(true);
    expect(summary.receivedAssets).toBe(2);
    expect(summary.imported).toBe(2);
    expect(summary.inserted).toBe(2);
    expect(summary.updated).toBe(0);
    expect(summary.skipped).toBe(0);
    expect(summary.failed).toBe(0);
    expect(summary.missingFiles).toHaveLength(0);
    expect(summary.writeFailures).toHaveLength(0);
    expect(summary.importedMediaIds).toEqual(["ch164_fig_164_4", "ch164_img_2"]);
    expect(summary.manifestError).toBeUndefined();

    expect(deps.files.has("campbell/164/fig-164-4.png")).toBe(true);
    expect(deps.files.has("campbell/164/img-2.png")).toBe(true);

    expect(deps.upsertCalls).toHaveLength(1);
    expect(deps.upsertCalls[0]).toHaveLength(2);
    expect(deps.upsertCalls[0][0]).toMatchObject({
      mediaId: "ch164_fig_164_4",
      chapterNumber: 164,
      kind: "figure",
      figureLabel: "Figure 164.4",
      refId: "figure:164.4",
      filename: "fig-164-4.png",
      storagePath: "/api/media-assets/campbell/164/fig-164-4.png",
      caption: "anatomy landmark",
      tags: ["anatomy"],
      highYield: true,
      sourcePage: 12,
      segmentId: "ch164_seg01",
    });
  });

  it("supports bundles whose contents are nested in a single root folder", async () => {
    const manifest = {
      chapterNumber: 200,
      assets: [{ mediaId: "x", kind: "figure", filename: "x.png" }],
    };
    const entries: BundleEntries = {
      "ch200/manifest.json": strToU8(JSON.stringify(manifest)),
      "ch200/x.png": PNG_BYTES,
    };
    const deps = inMemoryDeps();
    const summary = await runMediaBundleImport({
      entries,
      selectedChapterNumber: 200,
      ...deps,
    });
    expect(summary.ok).toBe(true);
    expect(summary.imported).toBe(1);
    expect(deps.files.has("campbell/200/x.png")).toBe(true);
  });
});

describe("runMediaBundleImport — bundle-level errors", () => {
  it("reports missing-manifest when manifest.json is absent", async () => {
    const summary = await runMediaBundleImport({
      entries: { "x.png": PNG_BYTES },
      selectedChapterNumber: 164,
      ...inMemoryDeps(),
    });
    expect(summary.ok).toBe(false);
    expect(summary.manifestError?.error).toBe("missing-manifest");
  });

  it("reports manifest-not-json on unparseable manifest", async () => {
    const summary = await runMediaBundleImport({
      entries: { "manifest.json": strToU8("{bad json") },
      selectedChapterNumber: 164,
      ...inMemoryDeps(),
    });
    expect(summary.ok).toBe(false);
    expect(summary.manifestError?.error).toBe("manifest-not-json");
  });

  it("reports chapter-mismatch when the manifest's chapter differs from the selected one", async () => {
    const summary = await runMediaBundleImport({
      entries: bundle(
        {
          chapterNumber: 1,
          assets: [{ mediaId: "x", kind: "figure", filename: "x.png" }],
        },
        { "x.png": PNG_BYTES },
      ),
      selectedChapterNumber: 164,
      ...inMemoryDeps(),
    });
    expect(summary.ok).toBe(false);
    expect(summary.manifestError?.error).toBe("chapter-mismatch");
    expect(summary.manifestError?.manifestChapterNumber).toBe(1);
  });
});

describe("runMediaBundleImport — per-entry categorisation", () => {
  it("classifies missing-file, invalid-kind, duplicate-media-id, and successful imports independently", async () => {
    const manifest = {
      chapterNumber: 164,
      assets: [
        { mediaId: "ok", kind: "figure", filename: "ok.png" },
        { mediaId: "dup", kind: "figure", filename: "a.png" },
        { mediaId: "dup", kind: "image", filename: "b.png" },
        { mediaId: "no-file", kind: "figure", filename: "missing.png" },
        { mediaId: "bad-kind", kind: "diagram", filename: "any.png" },
      ],
    };
    const entries = bundle(manifest, {
      "ok.png": PNG_BYTES,
      "a.png": PNG_BYTES,
      "any.png": PNG_BYTES,
    });
    const deps = inMemoryDeps();
    const summary = await runMediaBundleImport({
      entries,
      selectedChapterNumber: 164,
      ...deps,
    });
    expect(summary.ok).toBe(true);
    expect(summary.receivedAssets).toBe(5);
    expect(summary.imported).toBe(2); // "ok" and the first "dup" (a.png)
    expect(summary.importedMediaIds).toEqual(["ok", "dup"]);
    expect(summary.skipped).toBe(2);
    expect(summary.rejected.map((r) => r.reason).sort()).toEqual([
      "duplicate-media-id",
      "invalid-kind",
    ]);
    expect(summary.missingFiles).toEqual([
      { mediaId: "no-file", filename: "missing.png" },
    ]);
    expect(summary.failed).toBe(0);
  });

  it("counts a write-stage filesystem failure under failed (not imported)", async () => {
    const manifest = {
      chapterNumber: 164,
      assets: [
        { mediaId: "ok", kind: "figure", filename: "ok.png" },
        { mediaId: "boom", kind: "figure", filename: "boom.png" },
      ],
    };
    const deps = inMemoryDeps({
      failOnFile: (p) => p.endsWith("boom.png"),
    });
    const summary = await runMediaBundleImport({
      entries: bundle(manifest, {
        "ok.png": PNG_BYTES,
        "boom.png": PNG_BYTES,
      }),
      selectedChapterNumber: 164,
      ...deps,
    });
    expect(summary.imported).toBe(1);
    expect(summary.importedMediaIds).toEqual(["ok"]);
    expect(summary.failed).toBe(1);
    expect(summary.writeFailures[0].mediaId).toBe("boom");
  });

  it("upserter's reported updated count is preserved (re-import scenario)", async () => {
    const manifest = {
      chapterNumber: 164,
      assets: [{ mediaId: "x", kind: "figure", filename: "x.png" }],
    };
    const deps = inMemoryDeps({
      upsertResult: async () => ({ inserted: 0, updated: 1 }),
    });
    const summary = await runMediaBundleImport({
      entries: bundle(manifest, { "x.png": PNG_BYTES }),
      selectedChapterNumber: 164,
      ...deps,
    });
    expect(summary.inserted).toBe(0);
    expect(summary.updated).toBe(1);
    expect(summary.imported).toBe(1);
  });

  it("if the upsert call throws, every staged row is counted as failed", async () => {
    const manifest = {
      chapterNumber: 164,
      assets: [
        { mediaId: "a", kind: "figure", filename: "a.png" },
        { mediaId: "b", kind: "figure", filename: "b.png" },
      ],
    };
    const deps = inMemoryDeps({
      upsertResult: async () => {
        throw new Error("db down");
      },
    });
    const summary = await runMediaBundleImport({
      entries: bundle(manifest, {
        "a.png": PNG_BYTES,
        "b.png": PNG_BYTES,
      }),
      selectedChapterNumber: 164,
      ...deps,
    });
    expect(summary.imported).toBe(0);
    expect(summary.failed).toBe(2);
    expect(summary.writeFailures.every((f) => f.reason === "db down")).toBe(true);
  });
});
