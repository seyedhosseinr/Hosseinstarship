import {
  Activity,
  AlertTriangle,
  Baby,
  BookOpen,
  Brain,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Crosshair,
  Eye,
  FileClock,
  Flame,
  FlaskConical,
  GraduationCap,
  HeartPulse,
  Layers,
  ListTodo,
  Play,
  RotateCcw,
  Settings,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import type {
  AccuracyPoint,
  ActivityItem,
  CalendarCell,
  ClinicalTone,
  CommandMetric,
  DashboardData,
  FeatureLinkModel,
  FlashcardPulseModel,
  HeroModel,
  Mission,
  RadarDomain,
  SmartPathStep,
  TrapPattern,
  WeakArea,
} from "./dashboard-types";

export const ROUTES = {
  dashboard: "/dashboard",
  home: "/",
  library: "/library",
  review: "/flashcards/review",
  flashcards: "/flashcards",
  notebooks: "/notebooks",
  planner: "/planner",
  qbank: "/qbank",
  history: "/history",
  analytics: "/analytics",
  examBuilder: "/exam/builder",
  examActive: "/exam/active",
  import: "/import",
  srsInsights: "/srs/insights",
  settings: "/settings",
} as const;

export interface JalaliDate {
  jy: number;
  jm: number;
  jd: number;
}

export const JALALI_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
] as const;

export const JALALI_WD_SHORT = ["ش", "ی", "د", "س", "چ", "پ", "ج"] as const;

export const toneClasses: Record<
  ClinicalTone,
  {
    text: string;
    bg: string;
    border: string;
    progress: string;
    soft: string;
  }
> = {
  primary: {
    text: "text-primary",
    bg: "bg-primary",
    border: "border-primary/25",
    progress: "[&>div]:bg-primary",
    soft: "bg-primary/10",
  },
  success: {
    text: "text-success",
    bg: "bg-success",
    border: "border-success/25",
    progress: "[&>div]:bg-success",
    soft: "bg-success/10",
  },
  warning: {
    text: "text-warning",
    bg: "bg-warning",
    border: "border-warning/25",
    progress: "[&>div]:bg-warning",
    soft: "bg-warning/10",
  },
  danger: {
    text: "text-danger",
    bg: "bg-danger",
    border: "border-danger/25",
    progress: "[&>div]:bg-danger",
    soft: "bg-danger/10",
  },
  info: {
    text: "text-info",
    bg: "bg-info",
    border: "border-info/25",
    progress: "[&>div]:bg-info",
    soft: "bg-info/10",
  },
  muted: {
    text: "text-muted-foreground",
    bg: "bg-muted-foreground",
    border: "border-border",
    progress: "[&>div]:bg-muted-foreground",
    soft: "bg-muted",
  },
};

export function pct(value: number, max = 100) {
  return Math.max(0, Math.min(max, Math.round(Number(value) || 0)));
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("fa-IR").format(Number(value) || 0);
}

export function formatPercent(value: number) {
  return `${formatNumber(pct(value))}%`;
}

export function toJalali(date: Date): JalaliDate {
  let gy = date.getFullYear();
  let gm = date.getMonth() + 1;
  let gd = date.getDate();
  const gDaysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const jDaysInMonth = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];
  gy -= 1600;
  gm -= 1;
  gd -= 1;
  let gDNo =
    365 * gy +
    Math.floor((gy + 3) / 4) -
    Math.floor((gy + 99) / 100) +
    Math.floor((gy + 399) / 400);
  for (let i = 0; i < gm; i++) gDNo += gDaysInMonth[i];
  if (gm > 1 && ((gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0)) gDNo++;
  gDNo += gd;
  let jDNo = gDNo - 79;
  const jNp = Math.floor(jDNo / 12053);
  jDNo %= 12053;
  let jy = 979 + 33 * jNp + 4 * Math.floor(jDNo / 1461);
  jDNo %= 1461;
  if (jDNo >= 366) {
    jy += Math.floor((jDNo - 1) / 365);
    jDNo = (jDNo - 1) % 365;
  }
  let i = 0;
  for (; i < 11 && jDNo >= jDaysInMonth[i]; i++) jDNo -= jDaysInMonth[i];
  return { jy, jm: i + 1, jd: jDNo + 1 };
}

export function toGregorian(jy: number, jm: number, jd: number): Date {
  jy -= 979;
  jm -= 1;
  jd -= 1;
  const monthDays = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];
  let jDayNo = 365 * jy + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4);
  for (let i = 0; i < jm; i++) jDayNo += monthDays[i];
  jDayNo += jd;
  let gDayNo = jDayNo + 79;
  let gy = 1600 + 400 * Math.floor(gDayNo / 146097);
  gDayNo %= 146097;
  let leap = true;
  if (gDayNo >= 36525) {
    gDayNo--;
    gy += 100 * Math.floor(gDayNo / 36524);
    gDayNo %= 36524;
    if (gDayNo >= 365) gDayNo++;
    else leap = false;
  }
  gy += 4 * Math.floor(gDayNo / 1461);
  gDayNo %= 1461;
  if (gDayNo >= 366) {
    leap = false;
    gDayNo--;
    gy += Math.floor(gDayNo / 365);
    gDayNo %= 365;
  }
  const gDim = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let ii = 0;
  for (; gDayNo >= gDim[ii] + (ii === 1 && leap ? 1 : 0); ii++) {
    gDayNo -= gDim[ii] + (ii === 1 && leap ? 1 : 0);
  }
  return new Date(gy, ii, gDayNo + 1);
}

export function todayJalali(): JalaliDate {
  return toJalali(new Date());
}

export function jalaliMonthDays(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return (jy % 33) % 4 === 1 || [1, 5, 9, 13, 17, 22, 26, 30].includes(jy % 33) ? 30 : 29;
}

export function jalaliMonthStart(jy: number, jm: number): number {
  const g = toGregorian(jy, jm, 1);
  return (g.getDay() + 1) % 7;
}

function readinessLabel(level?: string) {
  if (level === "ready") return "آماده";
  if (level === "proficient") return "مسلط";
  if (level === "developing") return "در حال رشد";
  if (level === "needs_work") return "نیازمند کار";
  return "شروع";
}

function toneFromScore(score: number): ClinicalTone {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "danger";
}

function toneFromActivityTone(tone: string): ClinicalTone {
  if (tone === "emerald") return "success";
  if (tone === "rose") return "danger";
  if (tone === "amber") return "warning";
  if (tone === "violet") return "primary";
  return "info";
}

export function buildHeroModel(data: DashboardData): HeroModel {
  const readiness = pct(data.readinessScore?.score ?? 0);
  const dueToday = Math.max(0, Number(data.dueToday) || 0);
  const etaMin = Math.max(0, Number(data.etaMinutes) || 0);
  const streak = Math.max(0, Number(data.streak) || 0);
  const daysToExam = data.plannerDetailedStats?.daysToExam ?? null;
  const today = todayJalali();

  const urgentExam = daysToExam != null && daysToExam >= 0 && daysToExam <= 7;
  const primaryAction =
    dueToday > 0
      ? { label: "شروع مرور", href: ROUTES.review, icon: RotateCcw }
      : urgentExam
        ? { label: "تمرین هدفمند", href: ROUTES.qbank, icon: Target }
        : { label: "ادامه برنامه", href: ROUTES.planner, icon: Play };

  const status = urgentExam
    ? daysToExam === 0
      ? "امروز آزمون است"
      : `${formatNumber(daysToExam)} روز تا آزمون`
    : dueToday > 0
      ? `${formatNumber(dueToday)} کارت آماده مرور`
      : "بار امروز سبک است";

  return {
    greeting: data.greeting || "سلام",
    jalaliDate: `${formatNumber(today.jd)} ${JALALI_MONTHS[today.jm - 1]} ${formatNumber(today.jy)}`,
    status,
    statusTone: urgentExam ? "danger" : dueToday > 0 ? "primary" : "success",
    title: dueToday > 0 ? "بهترین حرکت امروز: مرور قبل از فراموشی" : "بهترین حرکت امروز: پیشروی آرام و منظم",
    reason:
      dueToday > 0
        ? `حدود ${formatNumber(etaMin)} دقیقه مرور، بیشترین اثر را روی نگهداشت امروز دارد.`
        : "هیچ مرور فوری عقب نمانده؛ برنامه امروز را با تمرین یا مطالعه ادامه بده.",
    primaryAction,
    secondaryAction: { label: "برنامه امروز", href: ROUTES.planner, icon: Calendar },
    summaries: [
      {
        key: "readiness",
        label: "آمادگی",
        value: formatPercent(readiness),
        helper: readinessLabel(data.readinessScore?.level),
        tone: toneFromScore(readiness),
        icon: Activity,
      },
      {
        key: "due",
        label: "مرور امروز",
        value: formatNumber(dueToday),
        helper: dueToday > 0 ? `${formatNumber(etaMin)} دقیقه` : "آزاد",
        tone: "primary",
        icon: RotateCcw,
      },
      {
        key: "streak",
        label: "استریک",
        value: formatNumber(streak),
        helper: "روز متوالی",
        tone: "warning",
        icon: Flame,
      },
      {
        key: "exam",
        label: "آزمون",
        value: daysToExam == null ? "—" : daysToExam === 0 ? "امروز" : `${formatNumber(daysToExam)} روز`,
        helper: "زمان باقی‌مانده",
        tone: daysToExam == null ? "muted" : daysToExam <= 7 ? "danger" : daysToExam <= 30 ? "warning" : "success",
        icon: GraduationCap,
      },
    ],
  };
}

export function buildCommandMetrics(data: DashboardData): CommandMetric[] {
  const dueToday = Math.max(0, Number(data.dueToday) || 0);
  const eta = Math.max(0, Number(data.etaMinutes) || 0);
  const plannerDetailed = data.plannerDetailedStats;
  const todayTasks = plannerDetailed?.todayTasks ?? data.serverStats?.plannerStats?.todayTasks ?? data.planner?.todayTasks ?? 0;
  const completedToday = plannerDetailed?.completedToday ?? data.serverStats?.plannerStats?.completedTasks ?? data.planner?.completedToday ?? 0;
  const overdue = plannerDetailed?.overdueTasks ?? data.serverStats?.plannerStats?.overdueTasks ?? data.planner?.overdueTasks ?? 0;
  const weakAreas = buildWeakAreas(data);
  const weakest = weakAreas[0];

  return [
    {
      key: "review",
      label: "مرور امروز",
      value: formatNumber(dueToday),
      helper: dueToday > 0 ? `${formatNumber(eta)} دقیقه آماده شروع` : "فعلا مروری باقی نمانده",
      href: ROUTES.review,
      actionLabel: "شروع مرور",
      tone: dueToday > 0 ? "primary" : "success",
      icon: RotateCcw,
    },
    {
      key: "tasks",
      label: "بار امروز",
      value: `${formatNumber(completedToday)}/${formatNumber(todayTasks)}`,
      helper: todayTasks > 0 ? "پیشرفت برنامه روز" : "برنامه روز خالی است",
      href: ROUTES.planner,
      actionLabel: "دیدن برنامه",
      tone: todayTasks > 0 && completedToday >= todayTasks ? "success" : "info",
      icon: ListTodo,
    },
    {
      key: "weak",
      label: "ضعف فعال",
      value: weakest ? formatPercent(weakest.accuracy) : "—",
      helper: weakest ? weakest.label : "ضعف معنادار ثبت نشده",
      href: ROUTES.qbank,
      actionLabel: "تمرین هدفمند",
      tone: weakest ? weakest.tone : "muted",
      icon: Target,
    },
    {
      key: "overdue",
      label: "عقب‌مانده",
      value: formatNumber(overdue),
      helper: overdue > 0 ? "بار pending، نه پیشرفت کامل" : "صف بازیابی پاک است",
      href: ROUTES.planner,
      actionLabel: "مدیریت",
      tone: overdue > 0 ? "warning" : "success",
      icon: AlertTriangle,
    },
  ];
}

export function buildSmartPath(data: DashboardData): SmartPathStep[] {
  const backendRecs = data.dashboardRecommendations ?? [];
  if (backendRecs.length) {
    return backendRecs.slice(0, 3).map((rec, index) => ({
      id: rec.id,
      title: rec.title,
      subtitle: rec.subtitle,
      reason: rec.reason,
      href: rec.href || ROUTES.review,
      duration: rec.duration,
      mcqCount: Number(rec.mcqCount) || 0,
      accuracy: pct(rec.accuracy),
      alert: rec.alert,
      tone: rec.type === "review" ? "primary" : rec.type === "weak_area" ? "danger" : index === 0 ? "info" : "success",
      icon: rec.type === "review" ? RotateCcw : rec.type === "weak_area" ? AlertTriangle : rec.type === "new_content" ? BookOpen : Target,
    }));
  }

  const steps: SmartPathStep[] = [];
  const dueToday = Math.max(0, Number(data.dueToday) || 0);
  const weak = buildWeakAreas(data).slice(0, 2);
  if (dueToday > 0) {
    steps.push({
      id: "review-due",
      title: "مرور SRS",
      subtitle: "بازیابی زمان‌بندی‌شده",
      reason: `${formatNumber(dueToday)} کارت امروز موعد مرور دارد.`,
      href: ROUTES.review,
      duration: `${formatNumber(data.etaMinutes)} دقیقه`,
      mcqCount: dueToday,
      accuracy: pct(data.serverStats?.accuracy ?? 0),
      tone: "primary",
      icon: RotateCcw,
    });
  }
  weak.forEach((area, index) => {
    steps.push({
      id: `weak-${area.id}`,
      title: `تمرکز روی ${area.label}`,
      subtitle: "تمرین هدفمند",
      reason: area.action,
      href: ROUTES.qbank,
      duration: index === 0 ? "۲۰ دقیقه" : "۱۵ دقیقه",
      mcqCount: index === 0 ? 12 : 8,
      accuracy: area.accuracy,
      tone: area.tone,
      icon: Target,
    });
  });
  return steps.slice(0, 3);
}

export function buildMissions(data: DashboardData): Mission[] {
  const plannerDetailed = data.plannerDetailedStats;
  const ps = data.serverStats?.plannerStats;
  const completedToday = plannerDetailed?.completedToday ?? ps?.completedTasks ?? 0;
  const todayTasks = plannerDetailed?.todayTasks ?? ps?.todayTasks ?? 0;
  const overdueTasks = plannerDetailed?.overdueTasks ?? ps?.overdueTasks ?? 0;
  const studyHours = Math.round(((data.serverStats?.studyTimeToday ?? 0) / 3600) * 10) / 10;
  const targetStudyHours = plannerDetailed?.dailyGoalMinutes ? Math.max(0.5, Math.round((plannerDetailed.dailyGoalMinutes / 60) * 10) / 10) : 4;
  const dueToday = data.fsrsStats?.dueToday ?? data.dueToday ?? 0;
  const reviewedToday = data.fsrsStats?.reviewedToday ?? 0;

  return [
    {
      id: "tasks",
      label: "تسک امروز",
      current: completedToday,
      target: Math.max(todayTasks, 1),
      progress: todayTasks > 0 ? pct((completedToday / todayTasks) * 100) : 0,
      tone: "primary",
      icon: ListTodo,
    },
    {
      id: "srs",
      label: "مرور SRS",
      current: reviewedToday,
      target: Math.max(dueToday, 1),
      progress: dueToday > 0 ? pct((reviewedToday / dueToday) * 100) : reviewedToday > 0 ? 100 : 0,
      tone: "info",
      icon: RotateCcw,
    },
    {
      id: "overdue",
      label: "تسک عقب‌مانده",
      current: overdueTasks,
      target: 0,
      progress: overdueTasks > 0 ? 0 : 100,
      tone: overdueTasks > 0 ? "warning" : "success",
      icon: AlertTriangle,
      warning: overdueTasks > 0 ? "نیازمند بازیابی؛ پیشرفت ۱۰۰٪ نیست" : undefined,
    },
    {
      id: "study",
      label: "ساعت مطالعه",
      current: studyHours,
      target: targetStudyHours,
      progress: pct((studyHours / targetStudyHours) * 100),
      suffix: "ساعت",
      tone: "success",
      icon: Clock,
    },
  ];
}

export function buildWeakAreas(data: DashboardData): WeakArea[] {
  const detailedWeak = data.serverStats?.detailedWeakAreas ?? [];
  if (detailedWeak.length) {
    return detailedWeak.slice(0, 5).map((w) => ({
      id: w.id,
      label: w.label,
      accuracy: pct(w.accuracy),
      trend: w.trend,
      action: w.suggestedAction || "تمرین هدفمند",
      href: ROUTES.qbank,
      tone: pct(w.accuracy) < 55 ? "danger" : pct(w.accuracy) < 65 ? "warning" : "info",
    }));
  }

  const weakSpots = data.weakSpots ?? [];
  return weakSpots.slice(0, 5).map((w, index) => ({
    id: `weak-${index}`,
    label: w.domain,
    accuracy: pct(w.accuracy),
    trend: w.trend,
    action: `تمرکز روی ${w.domain}`,
    href: ROUTES.qbank,
    tone: pct(w.accuracy) < 55 ? "danger" : pct(w.accuracy) < 65 ? "warning" : "info",
  }));
}

export function buildRadarData(data: DashboardData): RadarDomain[] {
  const domainMastery = data.serverStats?.domainMastery ?? [];
  const icons = [FlaskConical, Baby, Crosshair, HeartPulse, AlertTriangle, Brain];
  const tones: ClinicalTone[] = ["danger", "primary", "info", "warning", "success", "primary"];

  if (domainMastery.length) {
    return domainMastery.slice(0, 6).map((d, i) => {
      const you = pct(d.masteryScore);
      const confidence = pct(d.confidence);
      const Icon = icons[i % icons.length];
      return {
        domain: d.domain || `Domain ${i + 1}`,
        you,
        baseline: pct((you + confidence) / 2),
        tone: tones[i % tones.length],
        icon: Icon,
      };
    });
  }

  const perf = data.serverStats?.chapterPerformance ?? [];
  return perf.slice(0, 6).map((p, i) => {
    const you = pct(p.accuracy);
    const delta = Math.max(-12, Math.min(12, Math.round((Number(p.total) || 0) / 8) - 6));
    const Icon = icons[i % icons.length];
    return {
      domain: p.chapterTitle || `Chapter ${i + 1}`,
      you,
      baseline: pct(you + delta),
      tone: tones[i % tones.length],
      icon: Icon,
    };
  });
}

export function buildAccuracyData(data: DashboardData): AccuracyPoint[] {
  const weekly = data.serverStats?.weeklyActivity ?? [];
  const labels = ["ی", "د", "س", "چ", "پ", "ج", "ش"];
  return [...weekly]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((point) => {
      const date = new Date(`${point.day}T00:00:00`);
      return {
        day: labels[date.getDay()] ?? "؟",
        accuracy: point.count > 0 ? pct((point.correct / point.count) * 100) : 0,
      };
    });
}

export function buildCalendarCells(data: DashboardData, jy: number, jm: number): CalendarCell[] {
  const totalDays = jalaliMonthDays(jy, jm);
  const startOff = jalaliMonthStart(jy, jm);
  const today = todayJalali();
  const intensity = new Map<number, number>();
  const monthly = data.monthlyActivity ?? [];

  if (monthly.length) {
    const byIso = new Map<string, number>();
    monthly.forEach((item) => {
      byIso.set(item.date, (Number(item.questionsAnswered) || 0) * 2 + (Number(item.cardsReviewed) || 0));
    });
    for (let day = 1; day <= totalDays; day++) {
      const g = toGregorian(jy, jm, day);
      const iso = `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, "0")}-${String(g.getDate()).padStart(2, "0")}`;
      intensity.set(day, Math.min(100, (byIso.get(iso) || 0) * 4));
    }
  } else {
    const byIso = new Map<string, number>();
    (data.serverStats?.weeklyActivity ?? []).forEach((item) => byIso.set(item.day, Number(item.count) || 0));
    for (let day = 1; day <= totalDays; day++) {
      const g = toGregorian(jy, jm, day);
      const iso = `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, "0")}-${String(g.getDate()).padStart(2, "0")}`;
      intensity.set(day, Math.min(100, (byIso.get(iso) || 0) * 10));
    }
  }

  const cells: CalendarCell[] = [];
  const prevTotal = jalaliMonthDays(jm === 1 ? jy - 1 : jy, jm === 1 ? 12 : jm - 1);
  for (let i = startOff - 1; i >= 0; i--) {
    cells.push({ key: `prev-${i}`, day: prevTotal - i, current: false, today: false, intensity: 0 });
  }
  for (let day = 1; day <= totalDays; day++) {
    cells.push({
      key: `day-${day}`,
      day,
      current: true,
      today: jy === today.jy && jm === today.jm && day === today.jd,
      intensity: intensity.get(day) || 0,
    });
  }
  while (cells.length < 35) {
    const day = cells.length - totalDays - startOff + 1;
    cells.push({ key: `next-${day}`, day, current: false, today: false, intensity: 0 });
  }
  return cells;
}

export function buildActivityFeed(data: DashboardData): ActivityItem[] {
  const activity = data.activityFeed ?? [];
  if (activity.length) {
    return activity.slice(0, 6).map((item) => ({
      id: item.id,
      text: item.text,
      time: item.time,
      tone: toneFromActivityTone(item.tone),
    }));
  }

  const recent = data.serverStats?.recentExams ?? [];
  return recent.slice(0, 6).map((exam, index) => ({
    id: exam.id || `exam-${index}`,
    text: `${exam.title || "آزمون"} — ${formatPercent(exam.scorePercent ?? 0)} دقت`,
    time: timeAgo(exam.completedAt),
    tone: (exam.scorePercent ?? 0) >= 70 ? "success" : "danger",
  }));
}

export function buildFlashcardPulse(data: DashboardData): FlashcardPulseModel {
  const fsrs = data.fsrsStats;
  return {
    retentionRate: pct(fsrs?.retentionRate ?? 0),
    dueToday: fsrs?.dueToday ?? data.dueToday ?? 0,
    dueThisWeek: fsrs?.dueThisWeek ?? 0,
    reviewedToday: fsrs?.reviewedToday ?? 0,
    overdue: fsrs?.overdue ?? 0,
    matureCards: fsrs?.matureCards ?? 0,
    learningCards: fsrs?.learningCards ?? 0,
    newCards: fsrs?.newCards ?? 0,
    totalCards: fsrs?.totalCards ?? data.counts?.flashcards ?? 0,
  };
}

export function buildTrapPatterns(data: DashboardData): TrapPattern[] {
  return (data.trapQuestions ?? []).slice(0, 8).map((trap) => ({
    id: trap.id,
    question: trap.question,
    trapType: trap.trapType,
    domain: trap.domain,
    difficulty: trap.difficulty,
    yourAnswer: trap.yourAnswer,
    correctAnswer: trap.correctAnswer,
    explanation: trap.explanation,
    resolved: !!trap.resolved,
  }));
}

const FEATURE_ICONS = {
  review: RotateCcw,
  qbank: Brain,
  flashcards: CreditCard,
  notebooks: BookOpen,
  planner: Calendar,
  history: Clock,
  analytics: Activity,
  "exam-builder": Layers,
  "exam-active": Play,
  import: Zap,
  "srs-insights": Eye,
  settings: Settings,
} as const;

export function buildFeatureLinks(data: DashboardData): FeatureLinkModel[] {
  return (data.featureLinks ?? []).map((link) => ({
    key: link.key,
    title: link.title,
    subtitle: link.subtitle,
    href: link.href,
    count: link.count,
    icon: FEATURE_ICONS[link.key as keyof typeof FEATURE_ICONS] ?? Layers,
  }));
}

export function timeAgo(ts: number | null): string {
  if (!ts) return "اکنون";
  const diff = Math.max(0, Date.now() - ts);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "اکنون";
  if (minutes < 60) return `${formatNumber(minutes)} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${formatNumber(hours)} ساعت پیش`;
  return `${formatNumber(Math.floor(hours / 24))} روز پیش`;
}

export const statusIcons = {
  activity: Activity,
  alert: AlertTriangle,
  book: BookOpen,
  check: CheckCircle2,
  clock: FileClock,
  heart: HeartPulse,
  sparkles: Sparkles,
};
