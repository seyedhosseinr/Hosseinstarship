"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useExamStore } from "@/store/useExamStore";
import {
  ActiveExamShell,
  ResultsShell,
  ReviewShell,
} from "@/components/exam-v2";

export default function ActiveExamRoute() {
  const router = useRouter();
  const store = useExamStore();
  const {
    phase,
    sessionId,
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

  useEffect(() => {
    if (phase === "idle" && typeof window !== "undefined") {
      const saved = localStorage.getItem("exam_active_session");
      if (saved) {
        useExamStore.getState().loadSession(saved);
      } else {
        router.replace("/qbank");
      }
    }
  }, [phase, router]);

  if (phase === "finished" && score && results) {
    return (
      <ResultsShell
        score={score}
        results={results}
        subjectBreakdown={breakdown ?? []}
        timeSpent={timeSpent}
        questionTimes={questions.map((q) => q.timeSpentSeconds)}
        mode={session?.mode}
        testId={sessionId ?? undefined}
        onReview={() => enterReview()}
        onRetry={() => {
          resetExam();
          router.push("/exam/builder");
        }}
      />
    );
  }

  if (phase === "review" && results) {
    return (
      <ReviewShell
        results={results}
        score={score!}
        mode={session?.mode}
        testId={sessionId ?? undefined}
        currentIndex={reviewIndex}
        onGoToQuestion={setReviewIndex}
        onExit={() => enterReview("all")}
        onShowResults={() => useExamStore.setState({ phase: "finished" })}
        onShowAnalysis={() => useExamStore.setState({ phase: "finished" })}
      />
    );
  }

  if (phase === "idle") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">در حال بارگذاری...</p>
      </div>
    );
  }

  return <ActiveExamShell />;
}
