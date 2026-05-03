"use client";
import { create } from "zustand";
import type {
  ExamConfig,
  ExamMode,
  ActiveQuestion,
  ExamScore,
  QuestionResult,
  SubjectBreakdown,
  ExamSession,
} from "@/types/exam";

export type ExamPhase =
  | "idle"
  | "building"
  | "active"
  | "suspended"
  | "finished"
  | "review";

export interface ExamState {
  phase: ExamPhase;
  sessionId: string | null;
  session: ExamSession | null;
  questions: ActiveQuestion[];
  currentIndex: number;
  timeSpent: number; // seconds elapsed client-side
  isPaused: boolean;

  // Results (populated after finish)
  score: ExamScore | null;
  results: QuestionResult[] | null;
  breakdown: SubjectBreakdown[] | null;

  // Review filter
  reviewFilter: "all" | "correct" | "incorrect" | "omitted" | "marked";
  reviewIndex: number;

  // Loading state
  isLoading: boolean;
  error: string | null;
}

export interface ExamActions {
  // Builder
  startBuild: () => void;
  cancelBuild: () => void;

  // Session lifecycle
  initExam: (config: ExamConfig) => Promise<boolean>;

  // Active exam
  selectAnswer: (orderIndex: number, optionId: string) => void;
  confirmAnswer: (orderIndex: number) => Promise<void>;
  toggleMark: (orderIndex: number) => Promise<void>;
  goToQuestion: (index: number) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  tick: () => void;
  togglePause: () => void;

  // Finish
  finishExam: () => Promise<void>;
  suspendExam: () => Promise<void>;

  // Review
  enterReview: (defaultFilter?: ExamState["reviewFilter"]) => void;
  setReviewFilter: (f: ExamState["reviewFilter"]) => void;
  setReviewIndex: (i: number) => void;

  // Reset
  resetExam: () => void;

  // Hydrate from URL session
  loadSession: (sessionId: string) => Promise<void>;
}

const INITIAL: ExamState = {
  phase: "idle",
  sessionId: null,
  session: null,
  questions: [],
  currentIndex: 0,
  timeSpent: 0,
  isPaused: false,
  score: null,
  results: null,
  breakdown: null,
  reviewFilter: "all",
  reviewIndex: 0,
  isLoading: false,
  error: null,
};

export const useExamStore = create<ExamState & ExamActions>((set, get) => ({
  ...INITIAL,

  startBuild: () => set({ phase: "building", error: null }),
  cancelBuild: () => set({ phase: "idle" }),

  initExam: async (config) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/exams/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? "Failed to start exam");

      const { sessionId, questions, totalQuestions } = json.data;
      set({
        phase: "active",
        sessionId,
        session: {
          id: sessionId,
          title: config.title ?? null,
          mode: config.mode as ExamMode,
          status: "active",
          totalQuestions: totalQuestions ?? questions.length,
          currentQuestionIndex: 0,
          scorePercent: null,
          totalCorrect: 0,
          totalIncorrect: 0,
          totalOmitted: 0,
          startedAt: Date.now(),
          completedAt: null,
          elapsedSeconds: 0,
        },
        questions,
        currentIndex: 0,
        timeSpent: 0,
        isPaused: false,
        score: null,
        results: null,
        breakdown: null,
        isLoading: false,
      });
      if (typeof window !== "undefined") {
        localStorage.setItem("exam_active_session", sessionId);
      }
      return true;
    } catch (err) {
      set({
        isLoading: false,
        error:
          err instanceof Error ? err.message : "Failed to start exam",
      });
      return false;
    }
  },

  selectAnswer: (orderIndex, optionId) => {
    const { questions, phase } = get();
    if (phase !== "active") return;

    set({
      questions: questions.map((q, i) =>
        i === orderIndex ? { ...q, selectedOptionId: optionId } : q
      ),
    });
  },

  confirmAnswer: async (orderIndex) => {
    const { sessionId, questions, phase } = get();
    if (!sessionId || phase !== "active") return;
    const q = questions[orderIndex];
    if (!q?.selectedOptionId || q.isSubmitted) return;

    try {
      const res = await fetch(`/api/exams/${sessionId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIndex,
          selectedOptionId: q.selectedOptionId,
          timeSpentSeconds: q.timeSpentSeconds,
        }),
      });
      const json = await res.json();
      if (!json.ok) return;

      // API returns `explanation` (plain key); map to `explanationHtml` for the UI
      const { outcome, correctOptionId, explanation, explanationHtml: _expHtml, review } = json.data;
      const resolvedExplanation: string | undefined = _expHtml ?? explanation ?? undefined;
      set({
        questions: questions.map((item, i) =>
          i === orderIndex
            ? { ...item, isSubmitted: true, outcome, correctOptionId, explanationHtml: resolvedExplanation, review: review ?? null }
            : item
        ),
      });
    } catch {
      /* optimistic — ignore network errors */
    }
  },

  toggleMark: async (orderIndex) => {
    const { sessionId, questions } = get();
    const q = questions[orderIndex];
    if (!q || !sessionId) return;

    const newMarked = !q.isMarked;
    set({
      questions: questions.map((item, i) =>
        i === orderIndex ? { ...item, isMarked: newMarked } : item
      ),
    });

    try {
      await fetch(`/api/exams/${sessionId}/mark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIndex }),
      });
    } catch {
      /* ignore */
    }
  },

  goToQuestion: (index) => {
    const { questions, sessionId } = get();
    if (index < 0 || index >= questions.length) return;
    set({ currentIndex: index });
    if (sessionId) {
      fetch(`/api/exams/${sessionId}/navigate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIndex: index }),
      }).catch(() => {});
    }
  },

  nextQuestion: () => {
    const { currentIndex, questions } = get();
    if (currentIndex < questions.length - 1) get().goToQuestion(currentIndex + 1);
  },

  prevQuestion: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) get().goToQuestion(currentIndex - 1);
  },

  tick: () => {
    const { phase, isPaused, timeSpent, questions, currentIndex } = get();
    if (phase !== "active" || isPaused) return;
    const newQs = [...questions];
    if (newQs[currentIndex]) {
      newQs[currentIndex] = {
        ...newQs[currentIndex],
        timeSpentSeconds: (newQs[currentIndex].timeSpentSeconds ?? 0) + 1,
      };
    }
    set({ timeSpent: timeSpent + 1, questions: newQs });
  },

  togglePause: () => set((s) => ({ isPaused: !s.isPaused })),

  finishExam: async () => {
    const { sessionId, timeSpent } = get();
    if (!sessionId) return;
    set({ isLoading: true });
    try {
      const res = await fetch(`/api/exams/${sessionId}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elapsedSeconds: timeSpent }),
      });
      const json = await res.json();
      if (!json.ok)
        throw new Error(json.error?.message ?? "Failed to finish exam");

      const { score, results, breakdown, session } = json.data;
      set({
        phase: "finished",
        score,
        results,
        breakdown,
        session,
        isLoading: false,
      });
      if (typeof window !== "undefined")
        localStorage.removeItem("exam_active_session");
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to finish",
      });
    }
  },

  suspendExam: async () => {
    const { sessionId, timeSpent } = get();
    if (!sessionId) return;
    try {
      await fetch(`/api/exams/${sessionId}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elapsedSeconds: timeSpent }),
      });
    } catch {
      /* ignore */
    }
    if (typeof window !== "undefined")
      localStorage.removeItem("exam_active_session");
    set({ ...INITIAL });
  },

  enterReview: (defaultFilter = "all") =>
    set({ phase: "review", reviewFilter: defaultFilter, reviewIndex: 0 }),
  setReviewFilter: (f) => set({ reviewFilter: f, reviewIndex: 0 }),
  setReviewIndex: (i) => set({ reviewIndex: i }),

  resetExam: () => {
    if (typeof window !== "undefined")
      localStorage.removeItem("exam_active_session");
    set({ ...INITIAL });
  },

  loadSession: async (sessionId) => {
    set({ isLoading: true, error: null });
    try {
      // Try results first (for completed sessions)
      const resR = await fetch(`/api/exams/${sessionId}/results`);
      const jsonR = await resR.json();
      if (jsonR.ok && jsonR.data?.session?.status === "completed") {
        const { score, results, breakdown, session } = jsonR.data;
        set({
          phase: "finished",
          sessionId,
          session,
          score,
          results,
          breakdown,
          isLoading: false,
        });
        return;
      }
      // Active session
      const resS = await fetch(`/api/exams/${sessionId}/state`);
      const jsonS = await resS.json();
      if (!jsonS.ok) throw new Error("Session not found");
      const { session, questions } = jsonS.data;
      set({
        phase: "active",
        sessionId,
        session,
        questions,
        currentIndex: session.currentQuestionIndex ?? 0,
        isLoading: false,
      });
    } catch (err) {
      set({
        isLoading: false,
        error:
          err instanceof Error ? err.message : "Failed to load session",
      });
    }
  },
}));
