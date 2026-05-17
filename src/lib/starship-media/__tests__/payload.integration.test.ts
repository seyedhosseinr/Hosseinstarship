process.env.DB_RUNTIME = "pglite";
process.env.PGLITE_DATA_DIR = "memory://media-payload-tests-bootstrap";

import { beforeEach, describe, expect, it } from "vitest";

import { getDb, resetDbForTests } from "@/db/index";
import {
  drizzleBundleStorage,
  getMediaAssetPayload,
  listMediaAssetsForChapter,
  upsertMediaAssetsBatch,
} from "../db";

const globalWithPGlite = globalThis as typeof globalThis & {
  __uroPGlite?: unknown;
};

async function freshDb(label: string) {
  const safe = label.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
  process.env.PGLITE_DATA_DIR = `memory://media-payload-${safe}-${Date.now()}`;
  delete globalWithPGlite.__uroPGlite;
  await resetDbForTests();
  return getDb();
}

describe("media payload storage", () => {
  beforeEach(() => {
    /* each test gets a fresh in-memory db via freshDb() */
  });

  it("stores imported bytes in the DB and returns a Vercel-safe serve path", async () => {
    const db = await freshDb("bundle-storage");
    const storage = drizzleBundleStorage(db);
    const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);

    const storagePath = await storage.writeFile("campbell/164/ch164_fig_164_1.png", bytes);
    expect(storagePath).toBe("/api/media-assets/campbell/164/ch164_fig_164_1.png");

    const payload = await getMediaAssetPayload(db, "campbell/164/ch164_fig_164_1.png");
    expect(payload?.contentType).toBe("image/png");
    expect(Array.from(payload?.bytes ?? [])).toEqual(Array.from(bytes));
    expect(payload?.byteLength).toBe(bytes.byteLength);
  });

  it("normalizes legacy /media storage paths into /api/media-assets paths on registry reads", async () => {
    const db = await freshDb("legacy-normalization");
    await upsertMediaAssetsBatch(db, [
      {
        mediaId: "ch164_fig_164_1",
        chapterNumber: 164,
        segmentId: "164_01",
        refId: "figure:164.1",
        figureLabel: "Fig. 164.1",
        kind: "figure",
        filename: "ch164_fig_164_1.png",
        storagePath: "/media/campbell/164/ch164_fig_164_1.png",
        sourcePage: 2,
        caption: "Imported asset",
        tags: ["ultrasound"],
        highYield: true,
      },
    ]);

    const [asset] = await listMediaAssetsForChapter(db, 164);
    expect(asset?.storagePath).toBe(
      "/api/media-assets/campbell/164/ch164_fig_164_1.png",
    );
  });
});
