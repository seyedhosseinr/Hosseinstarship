import { listQBankQuestions } from "@/lib/qbank/queries";
import { QBankBrowser } from "@/components/exam-v2";

export const dynamic = "force-dynamic";

function normalizeChapterQuery(value: string | undefined): string | null {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  const match = text.match(/^(?:ch-)?0*(\d{1,3})$/i);
  if (!match) return text;
  return `ch-${Number(match[1])}`;
}

type PageProps = {
  searchParams?: Promise<{ chapter?: string | string[]; mode?: string | string[] }>;
};

export default async function Page({ searchParams }: PageProps) {
  let questions: Awaited<ReturnType<typeof listQBankQuestions>> = [];
  try {
    questions = await listQBankQuestions();
  } catch (err) {
    console.error("[qbank] Failed to load questions:", err);
  }

  const params = searchParams ? await searchParams : undefined;
  const rawChapter = Array.isArray(params?.chapter) ? params?.chapter[0] : params?.chapter;
  const initialChapterId = normalizeChapterQuery(rawChapter ? String(rawChapter) : undefined);
  const rawMode = Array.isArray(params?.mode) ? params?.mode[0] : params?.mode;
  const initialMode = rawMode ? String(rawMode) : null;

  return (
    <QBankBrowser
      questions={questions}
      initialChapterId={initialChapterId}
      initialMode={initialMode}
    />
  );
}
