"use client";

import { useExamStore } from "@/store/useExamStore";
import {
  BuilderWizard,
  ActiveExamShell,
  ResultsShell,
  ReviewShell,
} from "@/components/exam-v2";

export default function ExamBuilderPage() {
  const store = useExamStore();
  const {
    phase,
    score,
    results,
    breakdown,
    timeSpent,
    questions,
    session,
    reviewIndex,
    setReviewIndex,
    enterReview,
    resetExam,
  } = store;

  if (phase === "finished" && score && results) {
    return (
      <ResultsShell
        score={score}
        results={results}
        subjectBreakdown={breakdown ?? []}
        timeSpent={timeSpent}
        questionTimes={questions.map((q) => q.timeSpentSeconds)}
        mode={session?.mode}
        testId={store.sessionId ?? undefined}
        onReview={() => enterReview()}
        onRetry={() => resetExam()}
      />
    );
  }

  if (phase === "review" && results) {
    return (
      <ReviewShell
        results={results}
        score={score!}
        mode={session?.mode}
        testId={store.sessionId ?? undefined}
        currentIndex={reviewIndex}
        onGoToQuestion={setReviewIndex}
        onExit={() => store.enterReview("all")}
        onShowResults={() => store.enterReview("all")}
        onShowAnalysis={() => store.enterReview("all")}
      />
    );
  }

  if (phase === "active") {
    return <ActiveExamShell />;
  }

  return <BuilderWizard />;
}

