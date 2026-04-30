import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import type { useDashboardData } from "@/lib/dashboard/useDashboardData";

export type DashboardData = ReturnType<typeof useDashboardData>;

export type ClinicalTone =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted";

export type DashboardIcon = ComponentType<LucideProps>;

export type DashboardAction = {
  label: string;
  href: string;
  icon?: DashboardIcon;
};

export type HeroSummary = {
  key: string;
  label: string;
  value: string;
  helper: string;
  tone: ClinicalTone;
  icon: DashboardIcon;
};

export type HeroModel = {
  greeting: string;
  jalaliDate: string;
  status: string;
  statusTone: ClinicalTone;
  title: string;
  reason: string;
  primaryAction: DashboardAction;
  secondaryAction: DashboardAction;
  summaries: HeroSummary[];
};

export type CommandMetric = {
  key: string;
  label: string;
  value: string;
  helper: string;
  href: string;
  actionLabel: string;
  tone: ClinicalTone;
  icon: DashboardIcon;
};

export type SmartPathStep = {
  id: string;
  title: string;
  subtitle: string;
  reason: string;
  href: string;
  duration: string;
  mcqCount: number;
  accuracy: number;
  alert?: string;
  tone: ClinicalTone;
  icon: DashboardIcon;
};

export type Mission = {
  id: string;
  label: string;
  current: number;
  target: number;
  progress: number;
  suffix?: string;
  tone: ClinicalTone;
  icon: DashboardIcon;
  warning?: string;
};

export type WeakArea = {
  id: string;
  label: string;
  accuracy: number;
  trend: "improving" | "stable" | "declining";
  action: string;
  href: string;
  tone: ClinicalTone;
};

export type RadarDomain = {
  domain: string;
  you: number;
  baseline: number;
  tone: ClinicalTone;
  icon: DashboardIcon;
};

export type AccuracyPoint = {
  day: string;
  accuracy: number;
};

export type CalendarCell = {
  key: string;
  day: number;
  current: boolean;
  today: boolean;
  intensity: number;
};

export type ActivityItem = {
  id: string;
  text: string;
  time: string;
  tone: ClinicalTone;
};

export type FlashcardPulseModel = {
  retentionRate: number;
  dueToday: number;
  dueThisWeek: number;
  reviewedToday: number;
  overdue: number;
  matureCards: number;
  learningCards: number;
  newCards: number;
  totalCards: number;
};

export type TrapPattern = {
  id: string;
  question: string;
  trapType: string;
  domain: string;
  difficulty: string;
  yourAnswer: string;
  correctAnswer: string;
  explanation: string;
  resolved: boolean;
};

export type FeatureLinkModel = {
  key: string;
  title: string;
  subtitle: string;
  href: string;
  count?: number;
  icon: DashboardIcon;
};
