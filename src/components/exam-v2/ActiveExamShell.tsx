"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useExamStore } from "@/store/useExamStore";
import { useExamKeyboard } from "@/hooks/useExamKeyboard";
import { useStrikethrough } from "@/hooks/useStrikethrough";
import { useFontScale } from "@/hooks/useFontScale";
import { useNavScroll } from "@/hooks/useNavScroll";
import { ExamShell } from "./ExamShell";
import { QuestionStage } from "./QuestionStage";
import { ExamToolbarV2 } from "./ExamToolbarV2";
import { QuestionNavRail } from "./QuestionNavRail";
import { BottomDock } from "./BottomDock";
import { FinishDialog } from "./FinishDialog";
import { ExplanationCard } from "./ExplanationCard";
import { StudyPanelV2 } from "./StudyPanelV2";
import { QuestionStem } from "./QuestionStem";
import { OptionRow } from "./OptionRow";
import { OutcomeBanner } from "./OutcomeBanner";
import { ConfirmButton } from "./ConfirmButton";

export interface ActiveExamShellProps {
  sessionId?: string;
}

export function ActiveExamShell({ sessionId }: ActiveExamShellProps) {
  const router = useRouter();
  const store = useExamStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  const isStudyMode = store.session?.mode === "study";
  const [showNav, setShowNav] = useState(true);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showStudyPanel, setShowStudyPanel] = useState(false);
  const { fontSize, inc: fontInc, dec: fontDec } = useFontScale(15);
  const { toggle: toggleStrike, getStrikes } = useStrikethrough();

  const {
    phase, questions, currentIndex, timeSpent, isPaused,
    selectAnswer, confirmAnswer, toggleMark, goToQuestion,
    nextQuestion, prevQuestion, tick, togglePause, finishExam,
    isLoading, error,
  } = store;

  // Auto-open study panel in study mode
  useEffect(() => {
    if (isStudyMode) setShowStudyPanel(true);
  }, [isStudyMode]);

  // Hydrate session from URL param
  useEffect(() => {
    if (sessionId && phase === "idle") store.loadSession(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Timer
  useEffect(() => {
    if (phase !== "active") return;
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useNavScroll(navRef, currentIndex);

  const currentQ = questions[currentIndex];

  const handleConfirm = useCallback(() => {
    if (currentQ?.selectedOptionId && !currentQ.isSubmitted) confirmAnswer(currentIndex);
  }, [currentQ, confirmAnswer, currentIndex]);

  const handleSelectOption = useCallback(
    (idx: number) => {
      if (currentQ && !currentQ.isSubmitted) {
        selectAnswer(currentIndex, currentQ.options[idx]?.id ?? "");
      }
    },
    [currentQ, selectAnswer, currentIndex],
  );

  useExamKeyboard({
    enabled: phase === "active",
    onNext: nextQuestion,
    onPrev: prevQuestion,
    onMark: () => toggleMark(currentIndex),
    onConfirm: handleConfirm,
    onSelectOption: handleSelectOption,
  });

  // Loading / Error
  if (isLoading) {
    return (
      <ExamShell className="items-center justify-center">
        <Loader2 size={40} className="animate-spin text-lib-accent" />
        <p className="mt-4 text-sm text-lib-text-muted">Loading exam...</p>
      </ExamShell>
    );
  }
  if (error) {
    return (
      <ExamShell className="items-center justify-center">
        <AlertCircle size={48} className="text-lib-incorrect" />
        <p className="mt-4 text-lib-text">Failed to load exam</p>
        <p className="mt-2 text-sm text-lib-text-muted">{error}</p>
        <ConfirmButton onClick={() => router.push("/qbank")} className="mt-6">Back to QBank</ConfirmButton>
      </ExamShell>
    );
  }
  if (phase === "idle" || phase === "building") return null;

  const total = questions.length;
  const answeredCount = questions.filter((q) => q.isSubmitted).length;
  const markedCount = questions.filter((q) => q.isMarked).length;

  return (
    <ExamShell>
      <ExamToolbarV2
        currentIndex={currentIndex}
        total={total}
        answeredCount={answeredCount}
        markedCount={markedCount}
        timeSpent={timeSpent}
        isPaused={isPaused}
        isMarked={currentQ?.isMarked ?? false}
        showNav={showNav}
        showStudyPanel={showStudyPanel}
        fontSize={fontSize}
        isStudyMode={isStudyMode}
        onToggleNav={() => setShowNav((s) => !s)}
        onToggleStudyPanel={() => setShowStudyPanel((s) => !s)}
        onPrev={prevQuestion}
        onNext={nextQuestion}
        onMark={() => currentQ && toggleMark(currentIndex)}
        onTogglePause={togglePause}
        onFontInc={fontInc}
        onFontDec={fontDec}
        onEndExam={() => setShowFinishModal(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left nav rail */}
        <AnimatePresence initial={false}>
          {showNav && (
            <motion.div
              key="nav"
              initial={{ width: 0 }}
              animate={{ width: 200 }}
              exit={{ width: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="shrink-0 overflow-y-auto overflow-x-hidden border-e border-lib-border bg-lib-nav-bg"
            >
              <QuestionNavRail
                ref={navRef}
                questions={questions}
                currentIndex={currentIndex}
                onSelect={goToQuestion}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main question area */}
        <main className="flex flex-1 flex-col overflow-y-auto">
          {isPaused ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <div className="mb-4 text-5xl">⏸</div>
                <p className="mb-2 text-xl font-bold text-lib-text">Exam Paused</p>
                <p className="mb-6 text-sm text-lib-text-muted">Your time is not counting.</p>
                <ConfirmButton onClick={togglePause}>▶ Resume</ConfirmButton>
              </div>
            </div>
          ) : currentQ ? (
            <QuestionStage>
              {/* Header */}
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-lib-accent px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white">
                  Q {currentIndex + 1}
                </span>
                <span className="text-xs text-lib-text-muted">of {total}</span>
                {currentQ.isSubmitted && currentQ.outcome && (
                  <OutcomeBanner outcome={currentQ.outcome} className="ms-auto" />
                )}
              </div>

              <QuestionStem html={currentQ.stemHtml} fontSize={fontSize} className="mb-7" />

              {/* Options */}
              <div className="mb-6 flex flex-col gap-1.5">
                {currentQ.options.map((opt, idx) => (
                  <OptionRow
                    key={opt.id}
                    optionId={opt.id}
                    index={idx}
                    contentHtml={opt.contentHtml}
                    fontSize={fontSize}
                    isSelected={currentQ.selectedOptionId === opt.id}
                    isSubmitted={currentQ.isSubmitted}
                    isCorrectOption={currentQ.isSubmitted && opt.id === currentQ.correctOptionId}
                    isStruck={getStrikes(currentQ.questionId).has(opt.id)}
                    onSelect={() => selectAnswer(currentIndex, opt.id)}
                    onStrike={() => toggleStrike(currentQ.questionId, opt.id)}
                  />
                ))}
              </div>

              {/* Confirm button */}
              {!currentQ.isSubmitted && currentQ.selectedOptionId && (
                <ConfirmButton onClick={() => confirmAnswer(currentIndex)}>
                  Confirm Answer ↵
                </ConfirmButton>
              )}

              {/* Inline explanation */}
              {currentQ.isSubmitted && (
                <div className="mt-6">
                  <ExplanationCard question={currentQ} fontSize={fontSize} />
                </div>
              )}
            </QuestionStage>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-lib-text-muted">سوالی موجود نیست</p>
            </div>
          )}
        </main>

        {/* Right study panel */}
        <AnimatePresence initial={false}>
          {showStudyPanel && (
            <motion.div
              key="study-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 380, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="shrink-0 overflow-y-auto overflow-x-hidden border-s border-lib-border bg-lib-surface"
            >
              <StudyPanelV2 question={currentQ ?? null} onClose={() => setShowStudyPanel(false)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomDock
        timeSpent={timeSpent}
        currentIndex={currentIndex}
        total={total}
        isSubmitted={currentQ?.isSubmitted ?? false}
        onPrev={prevQuestion}
        onNext={nextQuestion}
        onEndExam={() => setShowFinishModal(true)}
      />

      <FinishDialog
        open={showFinishModal}
        total={total}
        answeredCount={answeredCount}
        markedCount={markedCount}
        onCancel={() => setShowFinishModal(false)}
        onConfirm={async () => {
          setShowFinishModal(false);
          await finishExam();
        }}
      />
    </ExamShell>
  );
}
