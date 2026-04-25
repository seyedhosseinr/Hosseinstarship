// =============================================================================
// URO-OMEGA KILLER - Core Type Definitions
// =============================================================================

// -----------------------------------------------------------------------------
// Question Types
// -----------------------------------------------------------------------------
export interface Question {
  id: string;
  text: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correct: "A" | "B" | "C" | "D";
  explanation: string;
  topic: string;
  subtopic?: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  imageUrl?: string;
  references?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface QuestionAttempt {
  questionId: string;
  selectedAnswer: "A" | "B" | "C" | "D" | null;
  isCorrect: boolean;
  timeSpent: number; // seconds
  timestamp: string;
  confidence?: 1 | 2 | 3 | 4 | 5;
}

// -----------------------------------------------------------------------------
// Exam Types
// -----------------------------------------------------------------------------
export interface Exam {
  id: string;
  title: string;
  description?: string;
  questionIds: string[];
  settings: ExamSettings;
  status: "draft" | "in_progress" | "completed" | "paused";
  startedAt?: string;
  completedAt?: string;
  results?: ExamResults;
}

export interface ExamSettings {
  mode: "tutor" | "timed" | "untimed";
  timeLimit?: number; // minutes
  questionCount: number;
  topics: string[];
  difficulty: ("easy" | "medium" | "hard")[];
  showExplanations: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
}

export interface ExamResults {
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  skippedQuestions: number;
  accuracy: number;
  timeSpent: number;
  topicBreakdown: Record<string, TopicScore>;
  attempts: QuestionAttempt[];
}

export interface TopicScore {
  topic: string;
  correct: number;
  total: number;
  accuracy: number;
}

// -----------------------------------------------------------------------------
// Flashcard Types (FSRS Compatible)
// -----------------------------------------------------------------------------
export interface Flashcard {
  id: string;
  front: string;
  back: string;
  tags: string[];
  imageUrl?: string;
  audioUrl?: string;
  createdAt: string;
  updatedAt: string;
  // FSRS Fields
  fsrs: FSRSData;
}

export interface FSRSData {
  due: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: CardState;
  lastReview?: string;
}

export type CardState = "new" | "learning" | "review" | "relearning";

export type FSRSRating = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy

export interface FSRSReviewLog {
  cardId: string;
  rating: FSRSRating;
  state: CardState;
  due: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  lastElapsedDays: number;
  scheduledDays: number;
  review: string;
}

// -----------------------------------------------------------------------------
// User & Gamification Types
// -----------------------------------------------------------------------------
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: string;
  settings: UserSettings;
  stats: UserStats;
  gamification: GamificationData;
}

export interface UserSettings {
  theme: "light" | "dark" | "system";
  language: "fa" | "en";
  notifications: {
    email: boolean;
    push: boolean;
    dailyReminder: boolean;
    reminderTime?: string;
  };
  study: {
    dailyGoal: number; // questions per day
    sessionLength: number; // minutes
    autoAdvance: boolean;
    showTimer: boolean;
  };
}

export interface UserStats {
  totalQuestionsSolved: number;
  totalCorrect: number;
  totalIncorrect: number;
  totalTimeSpent: number; // minutes
  averageAccuracy: number;
  currentStreak: number;
  longestStreak: number;
  lastStudyDate?: string;
  topicMastery: Record<string, number>; // 0-100
  weeklyProgress: WeeklyProgress[];
}

export interface WeeklyProgress {
  week: string;
  questionsSolved: number;
  accuracy: number;
  timeSpent: number;
}

export interface GamificationData {
  xp: number;
  level: number;
  rank: string;
  badges: Badge[];
  achievements: Achievement[];
  dailyQuests: DailyQuest[];
  streakFreezes: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  unlockedAt?: string;
  progress?: number;
  maxProgress?: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  xpReward: number;
  unlockedAt: string;
}

export interface DailyQuest {
  id: string;
  title: string;
  description: string;
  type: "questions" | "accuracy" | "time" | "streak";
  target: number;
  current: number;
  xpReward: number;
  completed: boolean;
  expiresAt: string;
}

// -----------------------------------------------------------------------------
// AI & Adaptive Learning Types
// -----------------------------------------------------------------------------
export interface AIExplanation {
  questionId: string;
  explanation: string;
  keyPoints: string[];
  relatedTopics: string[];
  suggestedQuestions: string[];
  confidence: number;
  generatedAt: string;
}

export interface AdaptiveRecommendation {
  questionIds: string[];
  reason: string;
  targetWeakness: string;
  expectedImprovement: number;
}

export interface PerformanceInsight {
  topic: string;
  strength: "weak" | "moderate" | "strong";
  accuracy: number;
  trend: "improving" | "stable" | "declining";
  recommendation: string;
}

// -----------------------------------------------------------------------------
// Analytics Types
// -----------------------------------------------------------------------------
export interface AnalyticsData {
  overview: OverviewStats;
  performance: PerformanceData;
  activity: ActivityData;
  predictions: PredictionData;
}

export interface OverviewStats {
  totalQuestions: number;
  accuracy: number;
  streak: number;
  rank: number;
  percentile: number;
}

export interface PerformanceData {
  byTopic: TopicPerformance[];
  byDifficulty: DifficultyPerformance[];
  byTime: TimePerformance[];
}

export interface TopicPerformance {
  topic: string;
  accuracy: number;
  questionsAttempted: number;
  averageTime: number;
  trend: number;
}

export interface DifficultyPerformance {
  difficulty: "easy" | "medium" | "hard";
  accuracy: number;
  count: number;
}

export interface TimePerformance {
  date: string;
  questionsAttempted: number;
  accuracy: number;
  timeSpent: number;
}

export interface ActivityData {
  dailyActivity: DailyActivity[];
  heatmap: HeatmapData[];
  studyPatterns: StudyPattern;
}

export interface DailyActivity {
  date: string;
  questions: number;
  correct: number;
  minutes: number;
}

export interface HeatmapData {
  date: string;
  value: number;
}

export interface StudyPattern {
  preferredTime: string;
  averageSessionLength: number;
  mostProductiveDay: string;
  consistency: number;
}

export interface PredictionData {
  readinessScore: number;
  predictedAccuracy: number;
  recommendedFocus: string[];
  estimatedTimeToGoal: number;
}

// -----------------------------------------------------------------------------
// Import Types
// -----------------------------------------------------------------------------
export interface ImportResult {
  success: boolean;
  totalItems: number;
  imported: number;
  failed: number;
  errors: ImportError[];
}

export interface ImportError {
  line: number;
  message: string;
  data?: unknown;
}

export type ImportFormat = "json" | "csv" | "anki" | "quizlet" | "pdf" | "image";

// -----------------------------------------------------------------------------
// API Response Types
// -----------------------------------------------------------------------------
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// -----------------------------------------------------------------------------
// Command Palette Types
// -----------------------------------------------------------------------------
export interface Command {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  shortcut?: string;
  category: CommandCategory;
  action: () => void | Promise<void>;
  keywords?: string[];
}

export type CommandCategory = 
  | "navigation"
  | "actions"
  | "settings"
  | "ai"
  | "recent";

// -----------------------------------------------------------------------------
// Notification Types
// -----------------------------------------------------------------------------
export interface Notification {
  id: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  action?: {
    label: string;
    href: string;
  };
}