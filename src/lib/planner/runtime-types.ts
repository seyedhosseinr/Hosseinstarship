import { taskStatus, taskType } from "@/db/schema";

export type TaskTypeValue = (typeof taskType)[keyof typeof taskType];
export type TaskStatusValue = (typeof taskStatus)[keyof typeof taskStatus];

export type SupportedPlannerTask = {
  id: string;
  taskType: TaskTypeValue;
  status: TaskStatusValue;
  title: string;
  description: string | null;
  estimatedMinutes: number;
  actualMinutes: number;
  progressPercent: number;
  targetCount: number | null;
  completedCount: number;
  priority: number;
  scheduledDate: string | null;
  linkedChapter: { id: string; title: string; chapterNo: number } | null;
  linkedChunk: { id: string; title: string | null; chunkIndex: number } | null;
  linkedExamSession: { id: string; title: string | null; status: string } | null;
  linkedDocument: { docId: string; chapterNo: number; chapterTitle: string; chunkIndex: number } | null;
  linkedFrame: { frameId: string; title: string; sectionId: string } | null;
};

export type SupportedPlannerDay = {
  id: string;
  date: string;
  label: string | null;
  isRestDay: number;
};

export type TodayPlanResult = {
  plan: {
    id: string;
    title: string;
    progressPercent: number;
    completedTasks: number;
    totalTasks: number;
    startDate: string;
    endDate: string | null;
    examDate: string | null;
    selectedChapterCount: number;
  };
  day: SupportedPlannerDay | null;
  tasks: SupportedPlannerTask[];
  overdueTasks: SupportedPlannerTask[];
};

export type WeekPlanDay = {
  id: string;
  date: string;
  dayOfWeek: string;
  label: string | null;
  isRestDay: number;
  tasks: SupportedPlannerTask[];
};

export type WeekPlanResult = {
  plan: {
    id: string;
    title: string;
    progressPercent: number;
    completedTasks: number;
    totalTasks: number;
    startDate: string;
    endDate: string | null;
    examDate: string | null;
    selectedChapterCount: number;
  };
  weekStart: string;
  weekEnd: string;
  days: WeekPlanDay[];
  totalTasks: number;
  completedTasks: number;
  overdueTasks: SupportedPlannerTask[];
};

export type MonthPlanDay = {
  id: string;
  date: string;          // YYYY-MM-DD
  dayOfWeek: string;
  label: string | null;
  isRestDay: number;
  inMonth: boolean;      // false for leading/trailing grid cells
  tasks: SupportedPlannerTask[];
};

export type MonthPlanResult = {
  plan: {
    id: string;
    title: string;
    progressPercent: number;
    completedTasks: number;
    totalTasks: number;
    startDate: string;
    endDate: string | null;
    examDate: string | null;
    selectedChapterCount: number;
  };
  year: number;
  month: number;         // 1-12 (Gregorian) or Jalali year/month encoded in caller
  rangeStart: string;    // ISO of first visible cell
  rangeEnd: string;      // ISO of last visible cell
  days: MonthPlanDay[];  // exactly 42 cells (6 weeks × 7 days)
  totalTasks: number;
  completedTasks: number;
};

export type PlannerSummary = {
  plan: {
    id: string;
    title: string;
    progressPercent: number;
    completedTasks: number;
    totalTasks: number;
    startDate: string;
    endDate: string | null;
    examDate: string | null;
    selectedChapterCount: number;
  } | null;
  today: {
    totalTasks: number;
    completedTasks: number;
    progressPercent: number;
    estimatedMinutes: number;
  } | null;
  streak: {
    current: number;
    longest: number;
  };
  overdueTasks: number;
  upcomingTaskCount: number;
  dailyGoalMinutes: number;
};
