import { revalidatePath, revalidateTag } from "next/cache";

export const CACHE_TAGS = {
  dashboard: "dashboard",
  dashboardStats: "dashboard-stats",
  dashboardActivity: "dashboard-activity",
  dashboardRecommendations: "dashboard-recommendations",
  readinessScore: "readiness-score",
  masteryRadar: "mastery-radar",
  flashcards: "flashcards",
  flashcardsDue: "flashcards-due",
  fsrsState: "fsrs-state",
  flashcardReviews: "flashcard-reviews",
  questions: "questions",
  questionBank: "question-bank",
  exams: "exams",
  examSessions: "exam-sessions",
  examResults: "exam-results",
  notes: "notes",
  noteDocuments: "note-documents",
  noteProgress: "note-progress",
  readingProgress: "reading-progress",
  planner: "planner",
  plannerTasks: "planner-tasks",
  plannerToday: "planner-today",
  taskQueue: "task-queue",
  analytics: "analytics",
  weakAreas: "weak-areas",
  chapterPerformance: "chapter-performance",
  accuracyTrend: "accuracy-trend",
  gamification: "gamification",
  streak: "streak",
  xp: "xp",
  achievements: "achievements",
  sidebar: "sidebar",
  navigation: "navigation",
  chapterList: "chapter-list",
} as const;

function revalidateTags(tags: string[]) {
  for (const tag of tags) {
    revalidateTag(tag);
  }
}

export function revalidateAfterFlashcardReview() {
  revalidateTags([
    CACHE_TAGS.flashcards,
    CACHE_TAGS.flashcardsDue,
    CACHE_TAGS.fsrsState,
    CACHE_TAGS.flashcardReviews,
    CACHE_TAGS.dashboardStats,
    CACHE_TAGS.readinessScore,
    CACHE_TAGS.masteryRadar,
    CACHE_TAGS.dashboardActivity,
    CACHE_TAGS.analytics,
    CACHE_TAGS.chapterPerformance,
    CACHE_TAGS.taskQueue,
    CACHE_TAGS.plannerToday,
    CACHE_TAGS.gamification,
    CACHE_TAGS.xp,
    CACHE_TAGS.streak,
  ]);

  revalidatePath("/flashcards");
  revalidatePath("/flashcards/review");
  revalidatePath("/");
}

export function revalidateAfterExamComplete() {
  revalidateTags([
    CACHE_TAGS.exams,
    CACHE_TAGS.examSessions,
    CACHE_TAGS.examResults,
    CACHE_TAGS.dashboardStats,
    CACHE_TAGS.readinessScore,
    CACHE_TAGS.masteryRadar,
    CACHE_TAGS.dashboardActivity,
    CACHE_TAGS.dashboardRecommendations,
    CACHE_TAGS.analytics,
    CACHE_TAGS.weakAreas,
    CACHE_TAGS.chapterPerformance,
    CACHE_TAGS.accuracyTrend,
    CACHE_TAGS.gamification,
    CACHE_TAGS.xp,
    CACHE_TAGS.achievements,
  ]);

  revalidatePath("/analytics");
  revalidatePath("/history");
  revalidatePath("/");
}

export function revalidateAfterImport() {
  revalidateTags([
    CACHE_TAGS.sidebar,
    CACHE_TAGS.navigation,
    CACHE_TAGS.chapterList,
    CACHE_TAGS.notes,
    CACHE_TAGS.noteDocuments,
    CACHE_TAGS.questions,
    CACHE_TAGS.questionBank,
    CACHE_TAGS.flashcards,
    CACHE_TAGS.dashboardStats,
  ]);

  revalidatePath("/import");
  revalidatePath("/notebooks");
  revalidatePath("/qbank");
  revalidatePath("/flashcards");
  revalidatePath("/");
}

export function revalidateAfterReadingProgress() {
  revalidateTags([
    CACHE_TAGS.noteProgress,
    CACHE_TAGS.readingProgress,
    CACHE_TAGS.dashboardStats,
    CACHE_TAGS.analytics,
    CACHE_TAGS.readinessScore,
  ]);
}

export function revalidateAfterTaskComplete() {
  revalidateTags([
    CACHE_TAGS.plannerTasks,
    CACHE_TAGS.plannerToday,
    CACHE_TAGS.planner,
    CACHE_TAGS.taskQueue,
    CACHE_TAGS.dashboardStats,
    CACHE_TAGS.gamification,
    CACHE_TAGS.xp,
  ]);

  revalidatePath("/planner");
  revalidatePath("/");
}

export function revalidateAfterQuestionAttempt() {
  revalidateTags([
    CACHE_TAGS.analytics,
    CACHE_TAGS.chapterPerformance,
    CACHE_TAGS.weakAreas,
  ]);
}

export function revalidateAfterNoteChange() {
  revalidateTags([
    CACHE_TAGS.notes,
    CACHE_TAGS.noteDocuments,
    CACHE_TAGS.sidebar,
    CACHE_TAGS.dashboardActivity,
  ]);
}

export function revalidateDashboardFull() {
  revalidateTags([
    CACHE_TAGS.dashboard,
    CACHE_TAGS.dashboardStats,
    CACHE_TAGS.dashboardActivity,
    CACHE_TAGS.dashboardRecommendations,
    CACHE_TAGS.readinessScore,
    CACHE_TAGS.masteryRadar,
  ]);
  revalidatePath("/");
}

export function revalidateEverything() {
  revalidateTags(Object.values(CACHE_TAGS));
  revalidatePath("/", "layout");
}
