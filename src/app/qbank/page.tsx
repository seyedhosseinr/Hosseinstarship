import { listQBankQuestions } from "@/lib/qbank/queries";
import { QBankBrowser } from "@/components/exam-v2";

export const dynamic = "force-dynamic";

export default async function Page() {
  let questions: Awaited<ReturnType<typeof listQBankQuestions>> = [];
  try {
    questions = await listQBankQuestions();
  } catch (err) {
    console.error("[qbank] Failed to load questions:", err);
  }
  return <QBankBrowser questions={questions} />;
}
