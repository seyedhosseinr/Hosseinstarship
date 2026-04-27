import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NotePageV2 as NotePageShell } from "@/components/library-v2";
import { getNoteByDocId } from "@/lib/contract/queries";
import {
  getCampbellNavigation,
  getChapterProgressMap,
  getChapterReaderContextForDoc,
} from "@/lib/library/queries";
import { listReaderFlashcardsForDoc } from "@/lib/reader/flashcard-queries";
import { getYieldAnnotationsForDoc } from "@/lib/yield/queries";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ docId: string }>;
  searchParams?: Promise<{ frame?: string; ref?: string }>;
}

const VALID_REFS = new Set(["mcq", "flashcard", "yield", "annotation", "note-link"]);
function normalizeRef(value: string | undefined) {
  return value && VALID_REFS.has(value) ? (value as "mcq" | "flashcard" | "yield" | "annotation" | "note-link") : undefined;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const note = await getNoteByDocId(resolvedParams.docId);

  if (!note) {
    return { title: "Note Not Found" };
  }

  return {
    title: `${note.meta.chapterTitle} | Chunk ${note.meta.chunkIndex}`,
    description: `Chapter ${note.meta.chapterNo}: ${note.meta.chapterTitle}`,
  };
}

function NoteLoadError({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="max-w-md rounded-2xl border border-destructive/30 bg-card p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Note could not be loaded</h2>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <a
          href="/library"
          className="mt-4 inline-block rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Back to Library
        </a>
      </div>
    </div>
  );
}

export default async function NotePage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  let note;
  try {
    note = await getNoteByDocId(resolvedParams.docId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error loading note data.";
    return <NoteLoadError message={msg} />;
  }

  if (!note) {
    notFound();
  }

  if (!note.meta?.docId || !note.sections || !Array.isArray(note.sections)) {
    return <NoteLoadError message="Invalid note structure: missing required fields (meta.docId, sections)." />;
  }

  let navigation, progressByChapter, relatedFlashcards, chapterContext, yieldData;
  try {
    [navigation, progressByChapter, relatedFlashcards, chapterContext, yieldData] =
      await Promise.all([
        getCampbellNavigation(note.meta.chapterNo),
        getChapterProgressMap(),
        listReaderFlashcardsForDoc(note.meta.docId),
        getChapterReaderContextForDoc(note.meta.docId),
        getYieldAnnotationsForDoc(note.meta.docId, note.meta.chapterNo),
      ]);
  } catch {
    return <NoteLoadError message="Failed to load navigation or progress data." />;
  }

  const initialStatus = progressByChapter.get(note.meta.chapterNo)?.status ?? "not_started";

  return (
    <NotePageShell
      note={note}
      initialFrameId={resolvedSearchParams?.frame}
      initialFrameRef={normalizeRef(resolvedSearchParams?.ref)}
      navigation={navigation}
      initialStatus={initialStatus}
      relatedFlashcards={relatedFlashcards}
      chapterContext={chapterContext}
      yieldData={yieldData}
    />
  );
}
