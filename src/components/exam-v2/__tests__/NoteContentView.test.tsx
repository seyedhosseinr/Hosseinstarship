import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NoteContentView } from "../NoteContentView";
import type { QuestionNoteData } from "@/hooks/useQuestionNote";

function buildNote(overrides: Partial<QuestionNoteData> = {}): QuestionNoteData {
  return {
    meta: {
      docId: "doc-1",
      logicalChunkId: "ch001-001",
      chapterNo: 96,
      chapterTitle: "Female pelvic anatomy",
      chunkIndex: 0,
      pageRange: "1-3",
      version: 1,
      generatedAt: "2026-04-17T00:00:00.000Z",
    },
    stats: { totalFrames: 1, totalQuestions: 0 },
    sections: [
      {
        id: "sec-1",
        title: "External genitalia",
        hook: null,
        closingKeypoint: null,
        frames: [],
      },
    ],
    ...overrides,
  };
}

describe("NoteContentView (exam-v2 reader path)", () => {
  it("renders inline bold from RTL Persian + English mixed content (regression for **vulva** leak)", () => {
    const html = renderToStaticMarkup(
      <NoteContentView
        note={buildNote({
          sections: [
            {
              id: "sec-1",
              title: "External genitalia",
              hook: null,
              closingKeypoint: null,
              frames: [
                {
                  id: "f1",
                  kind: "core",
                  title: "Vulvar anatomy",
                  summary: null,
                  body: "**vulva** شامل **mons pubis**، **labia majora** و **vestibule** است.",
                  content: "**vulva** شامل **mons pubis**، **labia majora** و **vestibule** است.",
                  marginNote: null,
                  linkedQuestions: [],
                },
              ],
            },
          ],
        })}
      />,
    );
    expect(html).toContain("<strong");
    expect(html).toContain("vulva");
    expect(html).toContain("mons pubis");
    expect(html).toContain("vestibule");
    // Raw markers must NOT leak through
    expect(html).not.toContain("**vulva**");
    expect(html).not.toContain("**mons pubis**");
    expect(html).not.toContain("**vestibule**");
  });

  it("renders inline bold inside listItems (no raw ** leakage)", () => {
    const html = renderToStaticMarkup(
      <NoteContentView
        note={buildNote({
          sections: [
            {
              id: "sec-1",
              title: "Items",
              hook: null,
              closingKeypoint: null,
              frames: [
                {
                  id: "f1",
                  kind: "concept",
                  title: "Steps",
                  summary: null,
                  body: "",
                  marginNote: null,
                  linkedQuestions: [],
                  listItems: ["Check **serum creatinine**", "Order *renal ultrasound*"],
                },
              ],
            },
          ],
        })}
      />,
    );
    expect(html).toContain("<strong");
    expect(html).toContain("serum creatinine");
    expect(html).toContain("<em");
    expect(html).toContain("renal ultrasound");
    expect(html).not.toContain("**serum creatinine**");
    expect(html).not.toContain("*renal ultrasound*");
  });

  it("renders inline bold inside the boxed clinicalPearl panel", () => {
    const html = renderToStaticMarkup(
      <NoteContentView
        note={buildNote({
          sections: [
            {
              id: "sec-1",
              title: "Pearl",
              hook: null,
              closingKeypoint: null,
              frames: [
                {
                  id: "f1",
                  kind: "pearl",
                  title: "Painless hematuria",
                  summary: null,
                  body: "",
                  marginNote: null,
                  linkedQuestions: [],
                  clinicalPearl: "**Painless** hematuria is malignancy until proven otherwise.",
                },
              ],
            },
          ],
        })}
      />,
    );
    expect(html).toContain("<strong");
    expect(html).toContain("Painless");
    expect(html).not.toContain("**Painless**");
  });
});
