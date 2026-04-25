process.env.DB_RUNTIME = "pglite";
process.env.PGLITE_DATA_DIR = `memory://note-runtime-tests-bootstrap`;

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { getDb, resetDbForTests } from "@/db/index";
import { noteFrames } from "@/db/schema";
import { importStructuredPayload } from "@/lib/import-light/structured-import";
import {
  getNoteByDocId,
  listDecisionChangingFrames,
  listDifferentialFrames,
  listHighYieldFrames,
  listInteractiveAlgorithmFrames,
  listMermaidFrames,
  listNoteDocumentsForChapterNo,
} from "../queries";
import {
  NOTE_V8_SCHEMA_VERSION,
  emptyDisplayV8,
  emptyFlagsV8,
  type SegmentNoteV8,
} from "../note-v8.types";

const globalWithPGlite = globalThis as typeof globalThis & {
  __uroPGlite?: unknown;
};

function resetRuntimeDb(label: string) {
  const safeLabel = label.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
  process.env.PGLITE_DATA_DIR = `memory://${safeLabel}-${Date.now()}`;
  delete globalWithPGlite.__uroPGlite;
  return resetDbForTests();
}

function buildRuntimeFixture(): SegmentNoteV8 {
  return {
    schemaVersion: NOTE_V8_SCHEMA_VERSION,
    segmentId: "96_01",
    sections: [
      {
        heading: "Hematuria",
        blocks: [
          {
            blockId: "96_01_b01",
            blockType: "concept",
            title: "Bladder compliance",
            content:
              "Bladder compliance is delta volume over delta pressure; low compliance tracks fibrosis.",
            display: emptyDisplayV8(),
            flags: { ...emptyFlagsV8(), examRelevant: true },
          },
          {
            blockId: "96_01_b02",
            blockType: "differential",
            title: "Differential of painless hematuria",
            content:
              "Painless hematuria requires evaluation for urothelial carcinoma and BPH before reassurance.",
            display: {
              ...emptyDisplayV8(),
              tableData: {
                headers: ["Cause", "Best next test"],
                rows: [
                  ["Urothelial carcinoma", "CT urography"],
                  ["BPH", "Cystoscopy"],
                ],
              },
            },
            flags: { ...emptyFlagsV8(), highYield: true, decisionChanging: true },
          },
          {
            blockId: "96_01_b03",
            blockType: "interactive_algorithm",
            title: "Microscopic hematuria workup",
            content:
              "Risk stratify microscopic hematuria. Low risk repeats urinalysis. High risk proceeds to workup.",
            display: {
              ...emptyDisplayV8(),
              mermaid: "flowchart TD\n  A[Risk] --> B[Low]\n  A --> C[High]",
              interactiveData: {
                initialStepId: "risk",
                steps: {
                  risk: {
                    prompt: "Risk level?",
                    options: [
                      { label: "Low", nextStepId: "repeat", outcome: null },
                      { label: "High", nextStepId: null, outcome: "Proceed to workup" },
                    ],
                  },
                  repeat: {
                    prompt: "Repeat urinalysis?",
                    options: [{ label: "Yes", nextStepId: null, outcome: "Repeat urinalysis" }],
                  },
                },
              },
            },
            flags: { ...emptyFlagsV8(), decisionChanging: true },
          },
          {
            blockId: "96_01_b04",
            blockType: "trap",
            title: "Exam trap",
            content:
              "Painless hematuria is malignancy until proven otherwise; cystoscopy is not optional.",
            display: {
              ...emptyDisplayV8(),
              callouts: [
                {
                  kind: "warning",
                  text: "Do not dismiss painless hematuria as infection without evaluation.",
                  order: 0,
                },
              ],
            },
            flags: emptyFlagsV8(),
          },
        ],
      },
    ],
  };
}

function buildLegacyV75RichFixture() {
  return {
    schemaVersion: "7.5",
    segmentId: "96_02",
    sections: [
      {
        heading: "Legacy hematuria",
        blocks: [
          {
            blockId: "96_02_b01",
            blockType: "differential",
            title: "Differential clues",
            content: "Use the differential table to separate malignant from benign causes.",
            tableData: {
              headers: ["Cause", "Clue"],
              rows: [
                ["Urothelial carcinoma", "Painless gross hematuria"],
                ["Stone", "Colicky pain"],
              ],
            },
            decisionChanging: true,
          },
          {
            blockId: "96_02_b02",
            blockType: "indication",
            title: "When to scope",
            content: "Cystoscopy is indicated in the following settings.",
            listItems: ["Gross hematuria", "Persistent microscopic hematuria"],
            examRelevant: true,
          },
          {
            blockId: "96_02_b03",
            blockType: "algorithm",
            title: "Legacy workup algorithm",
            content: "Risk stratify first, then choose surveillance or full workup.",
            mermaid: "flowchart TD\n  A[Risk] --> B[Low]\n  A --> C[High]",
            interactiveData: {
              initialStepId: "risk",
              steps: [
                {
                  stepId: "risk",
                  type: "question",
                  text: "Risk level?",
                  options: [
                    { label: "Low", nextStepId: "surveillance", explanation: "Watch closely" },
                    { label: "High", nextStepId: null, finalMessage: "Proceed to workup" },
                  ],
                },
                {
                  stepId: "surveillance",
                  type: "result",
                  text: "Surveillance",
                  finalMessage: "Repeat urinalysis",
                },
              ],
            },
            decisionChanging: true,
          },
          {
            blockId: "96_02_b04",
            blockType: "high_yield",
            title: "High-yield pearl",
            content: "Painless hematuria is malignancy until proven otherwise.",
            clinicalPearl: "Never reassure without complete evaluation.",
            highYield: true,
          },
        ],
      },
    ],
  };
}

function findFrame(note: Awaited<ReturnType<typeof getNoteByDocId>>, frameId: string) {
  const frame = note?.sections.flatMap((section) => section.frames).find((entry) => entry.id === frameId);
  expect(frame).toBeDefined();
  return frame!;
}

beforeEach(async (ctx) => {
  await resetRuntimeDb(`note-runtime-${ctx.task.name}`);
});

describe("note runtime integration", () => {
  it("persists v8 display + flags and exposes them through the real reader query path", async () => {
    const result = await importStructuredPayload({
      fileName: "ch096-seg001-notes.json",
      contentType: "notes",
      format: "json",
      rawText: JSON.stringify(buildRuntimeFixture()),
    });

    expect(result.errors).toEqual([]);
    expect(result.importedCount).toBe(1);

    const docs = await listNoteDocumentsForChapterNo(96);
    expect(docs).toHaveLength(1);

    const docId = docs[0].docId;
    const db = await getDb();
    const rows = await db.query.noteFrames.findMany({
      where: eq(noteFrames.docId, docId),
      orderBy: noteFrames.orderIndex,
    });

    const differentialRow = rows.find((row) => row.frameId === "96_01_b02");
    expect(differentialRow?.body).toBe(
      "Painless hematuria requires evaluation for urothelial carcinoma and BPH before reassurance.",
    );
    expect(differentialRow?.body).not.toContain("| Cause |");
    expect(JSON.parse(differentialRow?.displayJson ?? "{}")).toMatchObject({
      tableData: { headers: ["Cause", "Best next test"] },
    });
    expect(JSON.parse(differentialRow?.flagsJson ?? "{}")).toMatchObject({
      highYield: true,
      decisionChanging: true,
      examRelevant: false,
    });

    const note = await getNoteByDocId(docId);
    expect(note).not.toBeNull();

    const differential = findFrame(note, "96_01_b02");
    expect(differential.kind).toBe("differential");
    expect(differential.content).toBe(differential.body);
    expect(differential.tableData?.headers).toEqual(["Cause", "Best next test"]);
    expect(differential.v8Display?.tableData?.rows[0]).toEqual([
      "Urothelial carcinoma",
      "CT urography",
    ]);
    expect(differential.v8Flags).toEqual({
      highYield: true,
      decisionChanging: true,
      examRelevant: false,
    });
    expect(differential.hasStructuralReformat).toBe(true);
    expect(differential.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);

    const algorithm = findFrame(note, "96_01_b03");
    expect(algorithm.kind).toBe("interactive_algorithm");
    expect(algorithm.mermaid).toContain("flowchart TD");
    expect(algorithm.interactiveData?.initialStepId).toBe("risk");
    expect(algorithm.interactiveData?.steps[0]?.type).toBe("question");
    expect(algorithm.v8Flags?.decisionChanging).toBe(true);

    const trap = findFrame(note, "96_01_b04");
    expect(trap.kind).toBe("trap");
    expect(trap.v8Display?.callouts?.[0]?.kind).toBe("warning");

    await expect(listInteractiveAlgorithmFrames()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ frameId: "96_01_b03" })]),
    );
    await expect(listMermaidFrames()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ frameId: "96_01_b03" })]),
    );
    await expect(listDifferentialFrames()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ frameId: "96_01_b02" })]),
    );
    await expect(listHighYieldFrames()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ frameId: "96_01_b02" })]),
    );
    await expect(listDecisionChangingFrames()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ frameId: "96_01_b02" }),
        expect.objectContaining({ frameId: "96_01_b03" }),
      ]),
    );
  }, 20000);

  it("adapts v7.5 rich notes through the v7.5 -> v8 path before persistence", async () => {
    const result = await importStructuredPayload({
      fileName: "legacy-96-02.json",
      contentType: "notes",
      format: "json",
      rawText: JSON.stringify(buildLegacyV75RichFixture()),
    });

    expect(result.errors).toEqual([]);

    const docs = await listNoteDocumentsForChapterNo(96);
    const docId = docs.find((doc) => doc.chunkIndex === 2)?.docId;
    expect(docId).toBeTruthy();

    const db = await getDb();
    const rows = await db.query.noteFrames.findMany({
      where: eq(noteFrames.docId, docId!),
      orderBy: noteFrames.orderIndex,
    });
    expect(rows.map((row) => row.frameId)).toEqual([
      "96_02_b01",
      "96_02_b02",
      "96_02_b03",
      "96_02_b04",
    ]);

    const differentialRow = rows.find((row) => row.frameId === "96_02_b01");
    expect(differentialRow?.schemaVersion).toBe("8.0");
    expect(differentialRow?.displayJson).toContain("\"tableData\"");
    expect(differentialRow?.flagsJson).toContain("\"decisionChanging\":true");

    const indicationRow = rows.find((row) => row.frameId === "96_02_b02");
    expect(indicationRow?.displayJson).toContain("\"listItems\"");
    expect(indicationRow?.flagsJson).toContain("\"examRelevant\":true");

    const algorithmRow = rows.find((row) => row.frameId === "96_02_b03");
    expect(algorithmRow?.kind).toBe("interactive_algorithm");
    expect(algorithmRow?.displayJson).toContain("\"mermaid\"");
    expect(algorithmRow?.displayJson).toContain("\"interactiveData\"");

    const highYieldRow = rows.find((row) => row.frameId === "96_02_b04");
    expect(highYieldRow?.kind).toBe("concept");
    expect(highYieldRow?.highYield).toBe(1);
    expect(highYieldRow?.displayJson).toContain("\"clinical_pearl\"");
    expect(highYieldRow?.flagsJson).toContain("\"highYield\":true");

    const note = await getNoteByDocId(docId!);
    const differential = findFrame(note, "96_02_b01");
    expect(differential.kind).toBe("differential");
    expect(differential.tableData?.headers).toEqual(["Cause", "Clue"]);
    expect(differential.v8Flags?.decisionChanging).toBe(true);

    const indication = findFrame(note, "96_02_b02");
    expect(indication.kind).toBe("indication");
    expect(indication.listItems).toEqual(["Gross hematuria", "Persistent microscopic hematuria"]);
    expect(indication.v8Flags?.examRelevant).toBe(true);

    const algorithm = findFrame(note, "96_02_b03");
    expect(algorithm.kind).toBe("interactive_algorithm");
    expect(algorithm.mermaid).toContain("flowchart TD");
    expect(algorithm.interactiveData?.initialStepId).toBe("risk");
    expect(algorithm.v8Flags?.decisionChanging).toBe(true);

    const highYield = findFrame(note, "96_02_b04");
    expect(highYield.kind).toBe("concept");
    expect(highYield.highYield).toBe(true);
    expect(highYield.v8Flags?.highYield).toBe(true);
    expect(highYield.v8Display?.callouts?.[0]?.kind).toBe("clinical_pearl");

    await expect(listInteractiveAlgorithmFrames()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ frameId: "96_02_b03" })]),
    );
    await expect(listMermaidFrames()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ frameId: "96_02_b03" })]),
    );
    await expect(listDifferentialFrames()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ frameId: "96_02_b01" })]),
    );
    await expect(listHighYieldFrames()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ frameId: "96_02_b04" })]),
    );
    await expect(listDecisionChangingFrames()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ frameId: "96_02_b01" }),
        expect.objectContaining({ frameId: "96_02_b03" }),
      ]),
    );
  }, 20000);

  it("keeps legacy body-only rows readable when no structured payload exists", async () => {
    const result = await importStructuredPayload({
      fileName: "legacy-body-only.json",
      contentType: "notes",
      format: "json",
      rawText: JSON.stringify({
        chapterNo: 96,
        chunkIndex: 3,
        title: "Legacy fallback",
        slug: "legacy-fallback",
        body: "Legacy rows still render from the body column alone.",
        sections: [
          {
            title: "Legacy section",
            frames: [
              {
                kind: "core",
                title: "Legacy frame",
                body: "Legacy rows still render from the body column alone.",
              },
            ],
          },
        ],
      }),
    });

    expect(result.errors).toEqual([]);

    const note = await getNoteByDocId("note_legacy-fallback");
    expect(note).not.toBeNull();

    const frame = findFrame(note, "note_legacy-fallback_section_0_frame_0");
    expect(frame.kind).toBe("core");
    expect(frame.content).toBeUndefined();
    expect(frame.v8Display).toBeUndefined();
    expect(frame.v8Flags).toBeUndefined();
    expect(frame.body).toBe("Legacy rows still render from the body column alone.");
  }, 20000);
});
