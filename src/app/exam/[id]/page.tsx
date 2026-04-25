"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useExamStore } from "@/store/useExamStore";
import ExamComplete from "@/components/exam/ExamComplete";
import ReviewTestPage from "@/components/exam/ReviewTestPage";

export default function ExamResultsRoute() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const store = useExamStore();
  const {
    phase,
    score,
    results,
    breakdown,
    timeSpent,
    questions,
    session,
    reviewFilter,
    reviewIndex,
    setReviewFilter,
    setReviewIndex,
    enterReview,
    resetExam,
  } = store;

  useEffect(() => {
    if (id && phase === "idle") {
      store.loadSession(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (phase === "finished" && score && results) {
    return (
      <ExamComplete
        score={score}
        results={results}
        subjectBreakdown={breakdown ?? []}
        timeSpent={timeSpent}
        questionTimes={questions.map((q) => q.timeSpentSeconds)}
        mode={session?.mode}
        testId={id}
        onReview={() => enterReview()}
        onRetry={() => {
          resetExam();
          router.push("/qbank");
        }}
      />
    );
  }

  if (phase === "review" && results) {
    return (
      <ReviewTestPage
        results={results}
        score={score!}
        mode={session?.mode}
        testId={id}
        currentIndex={reviewIndex}
        onGoToQuestion={setReviewIndex}
        onExit={() => enterReview("all")}
        onShowResults={() => store.enterReview("all")}
        onShowAnalysis={() => store.enterReview("all")}
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
      }}
    >
      <p>در حال بارگذاری...</p>
    </div>
  );
}
