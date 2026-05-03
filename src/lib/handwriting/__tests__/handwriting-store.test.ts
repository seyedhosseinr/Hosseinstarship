import { beforeEach, describe, expect, it } from "vitest";
import { resetLocalDb } from "@/lib/local-first/idb";
import { makeAnchorKey, parseAnchorKey } from "../anchor-key";
import {
  loadHandwrittenNote,
  saveHandwrittenNote,
  clearHandwrittenNote,
  listHandwrittenNotesBySegment,
} from "../handwriting-store";
import type { HandwritingStroke } from "../types";

const CHAPTER = "ch-42";
const SEGMENT = "seg-1";
const BLOCK_A = "frame-abc";
const BLOCK_B = "frame-xyz";

const STROKE_A: HandwritingStroke = {
  id: "s1",
  points: [
    { x: 10, y: 20 },
    { x: 30, y: 40 },
  ],
  color: "#000",
  width: 2,
  tool: "pen",
};

const STROKE_B: HandwritingStroke = {
  id: "s2",
  points: [
    { x: 50, y: 60 },
    { x: 70, y: 80 },
  ],
  color: "#f00",
  width: 3,
  tool: "pen",
};

beforeEach(async () => {
  await resetLocalDb();
});

/* ── anchor-key unit tests ────────────────────────────────── */

describe("makeAnchorKey", () => {
  it("produces a deterministic composite key", () => {
    const key = makeAnchorKey(CHAPTER, SEGMENT, BLOCK_A);
    expect(key).toBe(`${CHAPTER}::${SEGMENT}::${BLOCK_A}`);
  });

  it("different inputs produce different keys", () => {
    const k1 = makeAnchorKey(CHAPTER, SEGMENT, BLOCK_A);
    const k2 = makeAnchorKey(CHAPTER, SEGMENT, BLOCK_B);
    expect(k1).not.toBe(k2);
  });

  it("is stable across calls", () => {
    expect(makeAnchorKey(CHAPTER, SEGMENT, BLOCK_A)).toBe(
      makeAnchorKey(CHAPTER, SEGMENT, BLOCK_A),
    );
  });
});

describe("parseAnchorKey", () => {
  it("round-trips makeAnchorKey", () => {
    const key = makeAnchorKey(CHAPTER, SEGMENT, BLOCK_A);
    const parsed = parseAnchorKey(key);
    expect(parsed).toEqual({ chapterId: CHAPTER, segmentId: SEGMENT, blockId: BLOCK_A });
  });

  it("returns null for malformed keys", () => {
    expect(parseAnchorKey("bad-key")).toBeNull();
    expect(parseAnchorKey("a::b")).toBeNull();
  });
});

/* ── handwriting-store CRUD ───────────────────────────────── */

describe("loadHandwrittenNote", () => {
  it("returns null when no note exists", async () => {
    const result = await loadHandwrittenNote(CHAPTER, SEGMENT, BLOCK_A);
    expect(result).toBeNull();
  });
});

describe("saveHandwrittenNote / loadHandwrittenNote", () => {
  it("saves and loads strokes by anchor", async () => {
    await saveHandwrittenNote(CHAPTER, SEGMENT, BLOCK_A, [STROKE_A]);
    const loaded = await loadHandwrittenNote(CHAPTER, SEGMENT, BLOCK_A);
    expect(loaded).not.toBeNull();
    expect(loaded!.strokes).toHaveLength(1);
    expect(loaded!.strokes[0].id).toBe("s1");
  });

  it("upserts on second save (same anchor)", async () => {
    await saveHandwrittenNote(CHAPTER, SEGMENT, BLOCK_A, [STROKE_A]);
    await saveHandwrittenNote(CHAPTER, SEGMENT, BLOCK_A, [STROKE_A, STROKE_B]);
    const loaded = await loadHandwrittenNote(CHAPTER, SEGMENT, BLOCK_A);
    expect(loaded!.strokes).toHaveLength(2);
  });

  it("sets anchorKey correctly", async () => {
    await saveHandwrittenNote(CHAPTER, SEGMENT, BLOCK_A, [STROKE_A]);
    const loaded = await loadHandwrittenNote(CHAPTER, SEGMENT, BLOCK_A);
    expect(loaded!.anchorKey).toBe(makeAnchorKey(CHAPTER, SEGMENT, BLOCK_A));
  });
});

describe("anchor isolation — switching anchors does not leak strokes", () => {
  it("strokes saved to BLOCK_A are not visible when loading BLOCK_B", async () => {
    await saveHandwrittenNote(CHAPTER, SEGMENT, BLOCK_A, [STROKE_A]);
    const loadedB = await loadHandwrittenNote(CHAPTER, SEGMENT, BLOCK_B);
    expect(loadedB).toBeNull();
  });

  it("each anchor stores independent strokes", async () => {
    await saveHandwrittenNote(CHAPTER, SEGMENT, BLOCK_A, [STROKE_A]);
    await saveHandwrittenNote(CHAPTER, SEGMENT, BLOCK_B, [STROKE_B]);

    const noteA = await loadHandwrittenNote(CHAPTER, SEGMENT, BLOCK_A);
    const noteB = await loadHandwrittenNote(CHAPTER, SEGMENT, BLOCK_B);

    expect(noteA!.strokes[0].id).toBe("s1");
    expect(noteB!.strokes[0].id).toBe("s2");
  });
});

describe("clearHandwrittenNote", () => {
  it("soft-deletes the note so loadHandwrittenNote returns null", async () => {
    await saveHandwrittenNote(CHAPTER, SEGMENT, BLOCK_A, [STROKE_A]);
    await clearHandwrittenNote(CHAPTER, SEGMENT, BLOCK_A);
    const result = await loadHandwrittenNote(CHAPTER, SEGMENT, BLOCK_A);
    expect(result).toBeNull();
  });

  it("clearing one anchor does not affect another", async () => {
    await saveHandwrittenNote(CHAPTER, SEGMENT, BLOCK_A, [STROKE_A]);
    await saveHandwrittenNote(CHAPTER, SEGMENT, BLOCK_B, [STROKE_B]);
    await clearHandwrittenNote(CHAPTER, SEGMENT, BLOCK_A);

    expect(await loadHandwrittenNote(CHAPTER, SEGMENT, BLOCK_A)).toBeNull();
    expect(await loadHandwrittenNote(CHAPTER, SEGMENT, BLOCK_B)).not.toBeNull();
  });
});

describe("listHandwrittenNotesBySegment", () => {
  it("returns all active notes for the segment", async () => {
    await saveHandwrittenNote(CHAPTER, SEGMENT, BLOCK_A, [STROKE_A]);
    await saveHandwrittenNote(CHAPTER, SEGMENT, BLOCK_B, [STROKE_B]);
    const list = await listHandwrittenNotesBySegment(CHAPTER, SEGMENT);
    expect(list).toHaveLength(2);
  });

  it("excludes soft-deleted notes", async () => {
    await saveHandwrittenNote(CHAPTER, SEGMENT, BLOCK_A, [STROKE_A]);
    await saveHandwrittenNote(CHAPTER, SEGMENT, BLOCK_B, [STROKE_B]);
    await clearHandwrittenNote(CHAPTER, SEGMENT, BLOCK_A);
    const list = await listHandwrittenNotesBySegment(CHAPTER, SEGMENT);
    expect(list).toHaveLength(1);
    expect(list[0].blockId).toBe(BLOCK_B);
  });

  it("does not return notes from a different chapter", async () => {
    await saveHandwrittenNote("ch-99", SEGMENT, BLOCK_A, [STROKE_A]);
    const list = await listHandwrittenNotesBySegment(CHAPTER, SEGMENT);
    expect(list).toHaveLength(0);
  });
});

/* ── feature flag default ────────────────────────────────── */

describe("isHandwrittenNotesEnabled", () => {
  it("is off by default (no env var set, no localStorage override)", async () => {
    // Dynamic import to avoid module-level env-read caching.
    const { isHandwrittenNotesEnabled } = await import("../flag");
    expect(isHandwrittenNotesEnabled()).toBe(false);
  });
});
