/**
 * GET /api/exams/question-note?questionId=xxx
 *
 * Bridges exam questions to their linked note content.
 * Path:  questions.chunkId → chunks.slug → noteDocuments.logicalChunkId → full note data
 * Fallback: questions.chapterId → chapters.chapterNo → noteDocuments.chapterNo
 */
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db/index";
import { questions, chunks, chapters, noteDocuments } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getNoteByDocId } from "@/lib/contract/queries";

type AnchorPayload = { primary: string | null; supporting: string[] };
const EMPTY_ANCHORS: AnchorPayload = { primary: null, supporting: [] };

function deriveAnchors(
  notebookAnchorId: string | null,
  sourceJsonRaw: unknown,
): AnchorPayload {
  let parsed: unknown = sourceJsonRaw;
  if (typeof sourceJsonRaw === "string" && sourceJsonRaw.length > 0) {
    try {
      parsed = JSON.parse(sourceJsonRaw);
    } catch {
      parsed = null;
    }
  }
  const rawList = (parsed && typeof parsed === "object" && parsed !== null)
    ? (parsed as Record<string, unknown>).sourceBlockIds
    : null;
  const list = Array.isArray(rawList)
    ? rawList.filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];
  const primary = notebookAnchorId ?? list[0] ?? null;
  const supporting = primary
    ? list.filter((id) => id !== primary)
    : list.slice(1);
  return { primary, supporting };
}

export async function GET(req: NextRequest) {
  const questionId = req.nextUrl.searchParams.get("questionId");
  if (!questionId) {
    return NextResponse.json(
      { ok: false, error: "questionId is required" },
      { status: 400 },
    );
  }

  try {
    const db = await getDb();

    // ── Step 1: Get the question row ──
    const question = await db.query.questions.findFirst({
      where: eq(questions.id, questionId),
      columns: {
        id: true,
        chunkId: true,
        chapterId: true,
        notebookAnchorId: true,
        sourceJson: true,
      },
    });

    if (!question) {
      return NextResponse.json({
        ok: true,
        note: null,
        anchors: EMPTY_ANCHORS,
        reason: "question_not_found",
      });
    }

    const anchors = deriveAnchors(question.notebookAnchorId, question.sourceJson);

    let docId: string | null = null;

    // ── Step 2a: question.chunkId → chunk.slug → noteDocuments ──
    if (question.chunkId) {
      const chunk = await db.query.chunks.findFirst({
        where: eq(chunks.id, question.chunkId),
        columns: { slug: true },
      });

      if (chunk?.slug) {
        const noteDoc = await db.query.noteDocuments.findFirst({
          where: and(
            eq(noteDocuments.logicalChunkId, chunk.slug),
            eq(noteDocuments.ingestStatus, "active"),
          ),
          orderBy: desc(noteDocuments.version),
          columns: { docId: true },
        });

        if (noteDoc) docId = noteDoc.docId;
      }
    }

    // ── Step 2b: fallback via chapterId → chapters.chapterNo → noteDocuments ──
    if (!docId && question.chapterId) {
      const chapter = await db.query.chapters.findFirst({
        where: eq(chapters.id, question.chapterId),
        columns: { chapterNo: true },
      });

      if (chapter) {
        const noteDoc = await db.query.noteDocuments.findFirst({
          where: and(
            eq(noteDocuments.chapterNo, chapter.chapterNo),
            eq(noteDocuments.ingestStatus, "active"),
          ),
          orderBy: desc(noteDocuments.version),
          columns: { docId: true },
        });

        if (noteDoc) docId = noteDoc.docId;
      }
    }

    if (!docId) {
      return NextResponse.json({ ok: true, note: null, anchors, reason: "no_linked_note" });
    }

    // ── Step 3: Load full note content ──
    const note = await getNoteByDocId(docId);
    if (!note) {
      return NextResponse.json({ ok: true, note: null, anchors, reason: "note_data_missing" });
    }

    return NextResponse.json({ ok: true, note, anchors });
  } catch (error) {
    console.error("[question-note]", error);
    return NextResponse.json(
      { ok: false, error: "Failed to load note" },
      { status: 500 },
    );
  }
}
