import { describe, expect, it } from "vitest";

import {
  buildBundledMediaServePath,
  buildBundledMediaStorageKey,
  inferContentTypeFromPath,
  normalizeBundledMediaStorageKey,
  storagePathToBundledMediaKey,
} from "../storage";

describe("starship-media storage helpers", () => {
  it("builds the Vercel-safe storage key and serve path", () => {
    const key = buildBundledMediaStorageKey(164, "ch164_fig_164_1.png");
    expect(key).toBe("campbell/164/ch164_fig_164_1.png");
    expect(buildBundledMediaServePath(key)).toBe(
      "/api/media-assets/campbell/164/ch164_fig_164_1.png",
    );
  });

  it("normalizes only safe storage keys", () => {
    expect(normalizeBundledMediaStorageKey("campbell/164/ch164_fig_164_1.png")).toBe(
      "campbell/164/ch164_fig_164_1.png",
    );
    expect(normalizeBundledMediaStorageKey(["campbell", "164", "ch164_fig_164_1.png"])).toBe(
      "campbell/164/ch164_fig_164_1.png",
    );
    expect(normalizeBundledMediaStorageKey("../escape.png")).toBeNull();
  });

  it("converts legacy /media paths into bundle keys", () => {
    expect(storagePathToBundledMediaKey("/media/campbell/164/ch164_fig_164_1.png")).toBe(
      "campbell/164/ch164_fig_164_1.png",
    );
    expect(storagePathToBundledMediaKey("/api/media-assets/campbell/164/ch164_fig_164_1.png")).toBeNull();
  });

  it("infers content types from file extensions", () => {
    expect(inferContentTypeFromPath("campbell/164/x.png")).toBe("image/png");
    expect(inferContentTypeFromPath("campbell/164/x.jpeg")).toBe("image/jpeg");
    expect(inferContentTypeFromPath("campbell/164/x.unknown")).toBe("application/octet-stream");
  });
});
