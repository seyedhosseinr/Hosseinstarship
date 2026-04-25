import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getChapterReaderBundle, getChapterProgressMap, getCampbellNavigation } from "@/lib/library/queries";
import { ChapterReaderV2 as ChapterReaderShell } from "@/components/library-v2";
import type { ChapterStatus } from "@/lib/library/progress";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ chapterNo: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { chapterNo: raw } = await params;
  const chapterNo = Number(raw);
  if (!Number.isFinite(chapterNo)) return { title: "Chapter Not Found" };

  const bundle = await getChapterReaderBundle(chapterNo);
  if (!bundle) return { title: "Chapter Not Found" };

  return {
    title: `Ch. ${bundle.chapter.chapterNo}: ${bundle.chapter.title}`,
    description: `${bundle.chapter.part} — ${bundle.chapter.segmentCount} segment${bundle.chapter.segmentCount !== 1 ? "s" : ""}`,
  };
}

export default async function CampbellChapterPage({ params }: PageProps) {
  const { chapterNo: raw } = await params;
  const chapterNo = Number(raw);

  if (!Number.isFinite(chapterNo)) notFound();

  const [bundle, progressMap, navigation] = await Promise.all([
    getChapterReaderBundle(chapterNo),
    getChapterProgressMap(),
    getCampbellNavigation(chapterNo),
  ]);

  if (!bundle) notFound();

  const initialStatus = (
    progressMap.get(chapterNo)?.status ?? "not_started"
  ) as ChapterStatus;

  return (
    <ChapterReaderShell
      chapter={bundle.chapter}
      notes={bundle.notes}
      initialStatus={initialStatus}
      navigation={navigation}
    />
  );
}
