/**
 * Phase 3.6 — DB-adapter integration test for the media-bundle pipeline.
 *
 * Boots a real in-memory PGlite + Drizzle instance (`memory://` scheme,
 * same pattern as `note-runtime-integration.test.ts`), runs the bundled
 * migrations, and exercises both helpers extracted from the API route:
 *
 *   • `upsertMediaAssetsBatch` — locks in the Phase 3.5 fixes:
 *       1. Pre-flight existence check uses `inArray` (must compile to
 *          `IN (...)` not `= ANY((p1, p2))`). The previous bug surfaced
 *          ONLY when more than one row was upserted, so this test
 *          INSISTS on a multi-row batch.
 *       2. `tags` is JSON-stringified before going into TEXT, then
 *          parsed back into `string[]` on read. Verified end-to-end via
 *          a roundtrip through `listMediaAssetsForChapter`.
 *
 *   • `listMediaAssetsForChapter` — verifies the row→MediaAsset shape,
 *     including tags decode and `highYield` boolean coercion.
 *
 * Fixture isolation: each test points PGlite at a fresh `memory://`
 * URL so state doesn't leak across cases. No file IO; this test never
 * touches `public/media/` or the real PGlite OPFS data dir.
 */

process.env.DB_RUNTIME = "pglite";
process.env.PGLITE_DATA_DIR = `memory://media-db-tests-bootstrap`;

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { getDb, resetDbForTests } from "@/db/index";
import { mediaAssets } from "@/db/schema";
import {
  drizzleUpserter,
  listMediaAssetsForChapter,
  rowToMediaAsset,
  upsertMediaAssetsBatch,
} from "../db";
import type { MediaAssetUpsertRow } from "../importer";

const globalWithPGlite = globalThis as typeof globalThis & {
  __uroPGlite?: unknown;
};

async function freshDb(label: string) {
  const safe = label.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
  process.env.PGLITE_DATA_DIR = `memory://media-db-${safe}-${Date.now()}`;
  delete globalWithPGlite.__uroPGlite;
  await resetDbForTests();
  return getDb();
}

function row(overrides: Partial<MediaAssetUpsertRow>): MediaAssetUpsertRow {
  return {
    mediaId: overrides.mediaId ?? "media-x",
    chapterNumber: overrides.chapterNumber ?? 164,
    segmentId: overrides.segmentId ?? null,
    refId: overrides.refId ?? null,
    figureLabel: overrides.figureLabel ?? null,
    kind: overrides.kind ?? "figure",
    filename: overrides.filename ?? "x.png",
    storagePath: overrides.storagePath ?? "/media/campbell/164/x.png",
    sourcePage: overrides.sourcePage ?? null,
    caption: overrides.caption ?? null,
    tags: overrides.tags ?? null,
    highYield: overrides.highYield ?? false,
  };
}

describe("media-assets DB adapter — multi-row insert (locks ANY-vs-inArray bug)", () => {
  beforeEach(() => {
    /* Each test calls freshDb() with a unique label below. */
  });

  it("inserts multiple rows in a single batch and returns inserted/updated counts", async () => {
    const db = await freshDb("multi-insert");
    const rows = [
      row({
        mediaId: "ch164_fig_164_4",
        refId: "figure:164.4",
        figureLabel: "Figure 164.4",
        kind: "figure",
        filename: "fig-164-4.png",
        storagePath: "/media/campbell/164/fig-164-4.png",
        tags: ["anatomy", "verification"],
        highYield: true,
      }),
      row({
        mediaId: "ch164_img_2",
        refId: "image:2",
        figureLabel: "Image 2",
        kind: "image",
        filename: "img-2.png",
        storagePath: "/media/campbell/164/img-2.png",
        tags: ["verification"],
        highYield: false,
      }),
    ];

    const result = await upsertMediaAssetsBatch(db, rows);
    // Critical: the previous Drizzle `= ANY(${ids})` form threw on a
    // multi-row batch with a record-tuple type mismatch. If this test
    // returns successfully with inserted=2, the inArray contract holds.
    expect(result.inserted).toBe(2);
    expect(result.updated).toBe(0);

    const persisted = await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.chapterNumber, 164));
    expect(persisted).toHaveLength(2);
    expect(persisted.map((r) => r.mediaId).sort()).toEqual([
      "ch164_fig_164_4",
      "ch164_img_2",
    ]);
  });

  it("handles a single-row batch identically (sanity)", async () => {
    const db = await freshDb("single-insert");
    const result = await upsertMediaAssetsBatch(db, [
      row({ mediaId: "only", filename: "only.png" }),
    ]);
    expect(result).toEqual({ inserted: 1, updated: 0 });
  });
});

describe("media-assets DB adapter — re-import / upsert", () => {
  it("re-imports update existing rows in place; counts split inserted vs updated", async () => {
    const db = await freshDb("reimport-counts");

    // First import — both rows are new.
    const v1 = await upsertMediaAssetsBatch(db, [
      row({ mediaId: "a", caption: "v1 caption a", tags: ["t1"] }),
      row({ mediaId: "b", caption: "v1 caption b", tags: ["t2"] }),
    ]);
    expect(v1).toEqual({ inserted: 2, updated: 0 });

    // Second import — same mediaIds + a brand-new one. Caption changed.
    const v2 = await upsertMediaAssetsBatch(db, [
      row({ mediaId: "a", caption: "v2 caption a", tags: ["t1", "extra"] }),
      row({ mediaId: "b", caption: "v2 caption b" }),
      row({ mediaId: "c", caption: "fresh c" }),
    ]);
    expect(v2).toEqual({ inserted: 1, updated: 2 });

    const all = await listMediaAssetsForChapter(db, 164);
    expect(all).toHaveLength(3);
    const a = all.find((x) => x.mediaId === "a")!;
    expect(a.caption).toBe("v2 caption a");
    expect(a.tags).toEqual(["t1", "extra"]);
    const b = all.find((x) => x.mediaId === "b")!;
    expect(b.caption).toBe("v2 caption b");
    expect(b.tags).toBeNull(); // explicit null in row() helper
    const c = all.find((x) => x.mediaId === "c")!;
    expect(c.caption).toBe("fresh c");
  });

  it("AssetUpserter wrapper is identical to the bare function", async () => {
    const db = await freshDb("upserter-wrapper");
    const upserter = drizzleUpserter(db);
    const r = await upserter.upsert([
      row({ mediaId: "u", filename: "u.png" }),
      row({ mediaId: "v", filename: "v.png" }),
    ]);
    expect(r).toEqual({ inserted: 2, updated: 0 });
  });
});

describe("media-assets DB adapter — tags JSON roundtrip (locks Phase 3.5 bug)", () => {
  it("writes tags as JSON-stringified TEXT and reads them back as string[]", async () => {
    const db = await freshDb("tags-roundtrip");
    await upsertMediaAssetsBatch(db, [
      row({
        mediaId: "tagged",
        tags: ["anatomy", "landmark", "high-yield"],
      }),
    ]);

    // Inspect the raw column — must be a JSON-encoded string, NOT a
    // Postgres array literal like '{anatomy,landmark}' (which is what
    // the previous code path produced, breaking the resolver).
    const [raw] = await db
      .select({ tagsJson: mediaAssets.tagsJson })
      .from(mediaAssets)
      .where(eq(mediaAssets.mediaId, "tagged"));
    expect(typeof raw.tagsJson).toBe("string");
    const reparsed = JSON.parse(raw.tagsJson as unknown as string);
    expect(reparsed).toEqual(["anatomy", "landmark", "high-yield"]);

    // The high-level read path returns a real string[] in the client shape.
    const [client] = await listMediaAssetsForChapter(db, 164);
    expect(client.tags).toEqual(["anatomy", "landmark", "high-yield"]);
  });

  it("null tags stay null on read (no JSON.parse(null) crash)", async () => {
    const db = await freshDb("tags-null");
    await upsertMediaAssetsBatch(db, [row({ mediaId: "untagged", tags: null })]);
    const [client] = await listMediaAssetsForChapter(db, 164);
    expect(client.tags).toBeNull();
  });

  it("rowToMediaAsset is tolerant to legacy raw-array storage on the column", async () => {
    // Simulate a row whose tagsJson somehow ended up as a JS array
    // (legacy / external write). The reader-side tolerant parser keeps
    // it from crashing the resolver.
    const fake = {
      id: "x",
      mediaId: "x",
      chapterNumber: 1,
      segmentId: null,
      refId: null,
      figureLabel: null,
      kind: "figure",
      filename: "x.png",
      storagePath: "/x.png",
      sourcePage: null,
      caption: null,
      tagsJson: ["legacy-tag"] as unknown as string[],
      highYield: 0,
      createdAt: 0,
      updatedAt: 0,
    } as Parameters<typeof rowToMediaAsset>[0];
    expect(rowToMediaAsset(fake).tags).toEqual(["legacy-tag"]);
  });
});

describe("media-assets DB adapter — chapter / kind filtering", () => {
  it("listMediaAssetsForChapter only returns rows for the requested chapter", async () => {
    const db = await freshDb("chapter-filter");
    await upsertMediaAssetsBatch(db, [
      row({ mediaId: "a164", chapterNumber: 164, filename: "a.png" }),
      row({ mediaId: "b200", chapterNumber: 200, filename: "b.png" }),
      row({ mediaId: "c164", chapterNumber: 164, filename: "c.png" }),
    ]);

    const ch164 = await listMediaAssetsForChapter(db, 164);
    expect(ch164.map((x) => x.mediaId).sort()).toEqual(["a164", "c164"]);
    const ch200 = await listMediaAssetsForChapter(db, 200);
    expect(ch200.map((x) => x.mediaId)).toEqual(["b200"]);
    const ch999 = await listMediaAssetsForChapter(db, 999);
    expect(ch999).toEqual([]);
  });

  it("highYield round-trips correctly as boolean (1/0 ↔ true/false)", async () => {
    const db = await freshDb("highyield-roundtrip");
    await upsertMediaAssetsBatch(db, [
      row({ mediaId: "yes", highYield: true }),
      row({ mediaId: "no", highYield: false }),
    ]);
    const all = await listMediaAssetsForChapter(db, 164);
    const yes = all.find((x) => x.mediaId === "yes")!;
    const no = all.find((x) => x.mediaId === "no")!;
    expect(yes.highYield).toBe(true);
    expect(no.highYield).toBe(false);
  });
});
