import { NextResponse } from "next/server";
import {
  getCampbellVolumes,
  getPartsByVolumeIds,
  getChaptersByPartIds,
} from "@/lib/exam/campbell-hierarchy";
import { getCampbellChapterDetail } from "@/lib/library/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level"); // "volumes" | "parts" | "chapters" | "segments"
  const volumeId = searchParams.get("volumeId");
  const partId = searchParams.get("partId");
  const chapterNo = searchParams.get("chapterNo");

  try {
    if (level === "volumes") {
      const volumes = getCampbellVolumes();
      return NextResponse.json({
        ok: true,
        data: volumes.map((v) => ({
          id: v.id,
          label: v.label,
          volumeNo: v.volumeNo,
          partCount: v.parts.length,
          chapterCount: v.parts.reduce((sum, p) => sum + p.chapters.length, 0),
        })),
      });
    }

    if (level === "parts" && volumeId) {
      const parts = getPartsByVolumeIds([volumeId]);
      return NextResponse.json({
        ok: true,
        data: parts.map((p) => ({
          id: p.id,
          label: p.label,
          volumeId: p.volumeId,
          chapterCount: p.chapters.length,
        })),
      });
    }

    if (level === "chapters" && partId) {
      const chapters = getChaptersByPartIds([partId]);
      return NextResponse.json({
        ok: true,
        data: chapters.map((c) => ({
          id: c.id,
          chapterNo: c.chapterNo,
          title: c.title,
          partId: c.partId,
        })),
      });
    }

    if (level === "segments" && chapterNo) {
      const detail = await getCampbellChapterDetail(Number(chapterNo));
      if (!detail) {
        return NextResponse.json({ ok: false, error: "Chapter not found" }, { status: 404 });
      }
      return NextResponse.json({
        ok: true,
        data: {
          chapterNo: detail.chapterNo,
          title: detail.title,
          volumeNo: detail.volumeNo,
          part: detail.part,
          questionCount: detail.questionCount,
          flashcardCount: detail.flashcardCount,
          segments: detail.segments,
        },
      });
    }

    return NextResponse.json({ ok: false, error: "Invalid level parameter" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
