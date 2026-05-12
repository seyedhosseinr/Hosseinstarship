const now = new Date("2026-05-10T12:00:00.000Z").getTime();

export const syntheticChapters = [
  {
    chapterId: "dashboard-smoke-ch-strong",
    titleFa: "Synthetic Strong Chapter",
    titleEn: "Synthetic Strong Chapter",
    order: 1,
  },
  {
    chapterId: "dashboard-smoke-ch-weak",
    titleFa: "Synthetic Weak Chapter",
    titleEn: "Synthetic Weak Chapter",
    order: 2,
  },
  {
    chapterId: "dashboard-smoke-ch-overdue",
    titleFa: "Synthetic Overdue Chapter",
    titleEn: "Synthetic Overdue Chapter",
    order: 3,
  },
  {
    chapterId: "dashboard-smoke-ch-sparse",
    titleFa: "Synthetic Sparse Chapter",
    titleEn: "Synthetic Sparse Chapter",
    order: 4,
  },
];

export const syntheticMcqStats = [
  { chapterId: syntheticChapters[0].chapterId, total: 12, correct: 11, wrong: 1 },
  { chapterId: syntheticChapters[1].chapterId, total: 10, correct: 4, wrong: 6 },
  { chapterId: syntheticChapters[2].chapterId, total: 8, correct: 3, wrong: 5 },
];

export const syntheticFlashcardStats = [
  {
    chapterId: syntheticChapters[0].chapterId,
    total: 8,
    due: 0,
    reviewed: 8,
    retention: 94,
    lastReviewedAt: String(now - 86_400_000),
  },
  {
    chapterId: syntheticChapters[1].chapterId,
    total: 7,
    due: 4,
    reviewed: 5,
    retention: 58,
    lastReviewedAt: String(now - 3 * 86_400_000),
  },
  {
    chapterId: syntheticChapters[2].chapterId,
    total: 6,
    due: 5,
    reviewed: 4,
    retention: 45,
    lastReviewedAt: String(now - 9 * 86_400_000),
  },
];

export const syntheticReaderStats = [
  { chapterId: syntheticChapters[0].chapterId, totalFrames: 100, openedFrames: 92, lastOpenedAt: String(now) },
  { chapterId: syntheticChapters[1].chapterId, totalFrames: 100, openedFrames: 28, lastOpenedAt: String(now - 2 * 86_400_000) },
  { chapterId: syntheticChapters[2].chapterId, totalFrames: 100, openedFrames: 12, lastOpenedAt: String(now - 8 * 86_400_000) },
];

export const syntheticFsrsQueue = [
  {
    id: "dashboard-smoke-card-overdue",
    topic: "Synthetic overdue retention card",
    chapter: "Synthetic Overdue Chapter",
    dueLabel: "overdue",
    retention: 42,
    yield: 5,
    isOverdue: true,
  },
  {
    id: "dashboard-smoke-card-weak",
    topic: "Synthetic weak-area recall card",
    chapter: "Synthetic Weak Chapter",
    dueLabel: "today",
    retention: 61,
    yield: 4,
    isOverdue: false,
  },
];

export const syntheticChapterStats = [
  { chapter: "Synthetic Weak Chapter", accuracy: 40 },
  { chapter: "Synthetic Strong Chapter", accuracy: 92 },
  { chapter: "Synthetic Overdue Chapter", accuracy: 38 },
];

export const syntheticHeatmapDays = Array.from({ length: 35 }, (_, index) => ({
  date: new Date(now - (34 - index) * 86_400_000).toISOString().slice(0, 10),
  count: index % 7,
}));

export const syntheticActivityFeed = [
  {
    id: "dashboard-smoke-activity-card",
    timeAgo: "5 min ago",
    action: "Synthetic overdue retention card reviewed",
    detail: "+1 card",
  },
  {
    id: "dashboard-smoke-activity-mcq",
    timeAgo: "20 min ago",
    action: "Synthetic weak MCQ block",
    detail: "4/10",
  },
  {
    id: "dashboard-smoke-activity-reader",
    timeAgo: "1 h ago",
    action: "Synthetic Strong Chapter read",
    detail: "900 seconds",
  },
];

export const syntheticDashboardStatsPayload = {
  accuracy: 67,
  weakAreaCount: 2,
  qbank: {
    totalQuestions: 30,
    attemptedQuestions: 30,
    correctAnswers: 18,
    totalAttempts: 30,
    testCount: 1,
    accuracy: 60,
    usage: 100,
  },
  flashcards: {
    total: 21,
    dueToday: 9,
    mastered: 8,
    dueThisWeek: 12,
    reviewedToday: 3,
    leechCount: 1,
    avgStability: 7,
    avgDifficulty: 6,
    matureCards: 8,
    overdue: 5,
    learningCards: 2,
    newCards: 3,
  },
  fsrsStatsByChapter: syntheticFlashcardStats.map((item) => ({
    chapterId: item.chapterId,
    totalCards: item.total,
    dueCards: item.due,
    reviewedCards: item.reviewed,
    avgRetention: item.retention,
    lastReviewedAt: item.lastReviewedAt,
  })),
  readerStatsByChapter: syntheticReaderStats.map((item) => ({
    chapterId: item.chapterId,
    readPercent: item.openedFrames,
    lastReadAt: item.lastOpenedAt,
  })),
  planner: {
    totalTasks: 4,
    completedTasks: 2,
    completedPlanTasks: 2,
    overdueTasks: 1,
    todayTasks: 3,
    completionRate: 50,
  },
  recentExams: [],
  studyTimeToday: 60,
  weeklyActivity: [
    { day: "2026-05-09", count: 12, correct: 8 },
    { day: "2026-05-10", count: 6, correct: 4 },
  ],
  chapterPerformance: syntheticChapterStats.map((item, index) => ({
    chapterId: syntheticChapters[index].chapterId,
    chapterTitle: item.chapter,
    total: 10,
    correct: Math.round(item.accuracy / 10),
    accuracy: item.accuracy,
  })),
  domainMastery: {
    domainMastery: [
      {
        domain: "dashboard-smoke-retention",
        masteryScore: 58,
        confidence: 80,
        questionAccuracy: 52,
        retentionScore: 55,
        completionScore: 65,
        recencyScore: 70,
        volume: 12,
        sourceCoverage: { qbank: true, srs: true, notes: false, planner: true },
      },
    ],
  },
  analyticsSnapshot: null,
  strengthsAndWeaknesses: {
    strengths: [],
    weaknesses: [
      {
        dimension: "chapter",
        key: "Synthetic Weak Chapter",
        accuracy: 40,
        questionsAnswered: 10,
        recommendedAction: "Review synthetic weak chapter.",
      },
    ],
  },
  readinessScore: {
    score: 64,
    level: "developing" as const,
    factors: { coverage: 52, accuracy: 60, retention: 57, consistency: 76, weakAreas: 76 },
    trend: "stable" as const,
  },
  detailedWeakAreas: [
    {
      id: "dashboard-smoke-weak-area",
      type: "chapter" as const,
      key: "dashboard-smoke-ch-weak",
      label: "Synthetic Weak Chapter",
      accuracy: 40,
      questionsAttempted: 10,
      flashcardRetention: 58,
      masteryScore: 46,
      trend: "stable" as const,
      suggestedAction: "Review synthetic weak chapter.",
      color: "var(--amber)",
    },
  ],
  dashboardRecommendations: [],
  trapQuestions: [],
  studyNotes: [],
  weakSpots: [],
  activityFeed: [
    {
      id: "dashboard-smoke-feed-card",
      type: "card_review" as const,
      entityLabel: "Synthetic overdue retention card",
      detail: "reviewed",
      delta: "+1 card",
      timestamp: String(now),
    },
    {
      id: "dashboard-smoke-feed-mcq",
      type: "mcq_block" as const,
      entityLabel: "Synthetic weak MCQ block",
      detail: "",
      delta: "4/10",
      timestamp: String(now - 1_000),
    },
  ],
  fsrsStats: {
    dueToday: 9,
    dueThisWeek: 12,
    reviewedToday: 3,
    retentionRate: 57,
    leechCount: 1,
    avgStability: 7,
    avgDifficulty: 6,
    matureCards: 8,
    totalCards: 21,
    overdue: 5,
    learningCards: 2,
    newCards: 3,
  },
  plannerDetailedStats: {
    todayTasks: 3,
    completedToday: 2,
    overdueTasks: 1,
    upcomingTasks: [],
    dailyGoalMinutes: 120,
    dailyGoalProgress: 67,
    examDate: "2026-08-27",
    daysToExam: 109,
    studyStreak: 14,
  },
  monthlyActivity: [
    { date: "2026-05-08", questionsAnswered: 3, cardsReviewed: 2, minutesStudied: 40 },
    { date: "2026-05-09", questionsAnswered: 12, cardsReviewed: 4, minutesStudied: 70 },
    { date: "2026-05-10", questionsAnswered: 6, cardsReviewed: 3, minutesStudied: 55 },
  ],
  dashboardSnapshot: null,
  tasks: { today: [], overdue: [] },
  todayTasks: [],
  overdueTasks: [],
  activePlan: null,
};

export const syntheticReviewCards = syntheticFsrsQueue.map((card, index) => ({
  id: card.id,
  frontHtml: `<p>${card.topic}</p>`,
  backHtml: `<p>Synthetic answer ${index + 1}</p>`,
  cardType: "basic",
  chapterNo: 900 + index,
  chapterTitle: card.chapter,
  sourceQuestionId: null,
  sourceDocId: null,
  sourceFrameId: null,
  tags: ["dashboard-smoke"],
  deck: "Dashboard smoke deck",
  dueAt: now - index * 3_600_000,
  state: "review",
  intervalDays: index === 0 ? 9 : 2,
  isLeech: index === 0,
  isSuspended: false,
  predictions: {
    again: { interval: "5m", days: 0 },
    hard: { interval: "1d", days: 1 },
    good: { interval: "3d", days: 3 },
    easy: { interval: "7d", days: 7 },
  },
}));

