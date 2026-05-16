process.env.DB_RUNTIME = "pglite";
process.env.PGLITE_DATA_DIR = "memory://media-payload-tests-bootstrap";

import { describe, expect, it } from "vitest";

import { getDb, resetDbForTests } from "@/db/index";
import {
  getMediaAssetPayloadByStorageKey,
  upsertMediaAssetPayloadsBatch,
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

describe("media-asset payload DB adapter", () => {
  it("upserts payload rows and reads them back by storage key", async () => {
    const db = await freshDb("payloads-roundtrip");

    const first = await upsertMediaAssetPayloadsBatch(db, [
      {
        storageKey: "campbell/164/ch164_fig_164_1.png",
        contentType: "image/png",
        base64Data: "AQID",
        byteLength: 3,
      },
    ]);
    expect(first).toEqual({ inserted: 1, updated: 0 });

    const second = await upsertMediaAssetPayloadsBatch(db, [
      {
        storageKey: "campbell/164/ch164_fig_164_1.png",
        contentType: "image/png",
        base64Data: "AQIDBA==",
        byteLength: 4,
      },
    ]);
    expect(second).toEqual({ inserted: 0, updated: 1 });

    const payload = await getMediaAssetPayloadByStorageKey(
      db,
      "campbell/164/ch164_fig_164_1.png",
    );
    expect(payload).toEqual({
      storageKey: "campbell/164/ch164_fig_164_1.png",
      contentType: "image/png",
      base64Data: "AQIDBA==",
      byteLength: 4,
    });
  });
});
