"use client";

/**
 * Hossein Starship — Medical Command Center  v5.0
 * 2026 flagship rebuild:
 *  - Mesh gradient background (CSS-only, no canvas)
 *  - Hero with animated Study Score ring + 2x2 stat grid
 *  - Command Center 4-column action strip
 *  - Bento grid: Mastery Radar | Accuracy Trend | Jalali Calendar
 *  - Smart Path AI recommendations carousel
 *  - Flashcard Pulse (FSRS health widget)
 *  - Trap Patterns with filter tabs
 *  - Feature Hub with featureLinks
 *  - Clinical token system, glass morphism, RTL-first
 *  - Touch-friendly (44px+), iPad 13" landscape primary
 */

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import {
  Play,
  BookOpen,
  Brain,
  Target,
  Zap,
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  Flame,
  RotateCcw,
  Check,
  GraduationCap,
  HeartPulse,
  Baby,
  Ribbon,
  FlaskConical,
  Crosshair,
  Award,
  Layers,
  Calendar,
  CreditCard,
  Sparkles,
  CircleDot,
  ListTodo,
  Lightbulb,
  Eye,
  ArrowUpRight,
  Minus,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar as RechartsRadar,
  Tooltip as RechartsTooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardData } from "@/lib/dashboard/useDashboardData";
import { useThemeStore } from "@/store/useThemeStore";
import { DensityBridge } from "@/components/clinical/DensityBridge";

/* ══════════════════════════════════════════════════════
   JALALI UTILITIES  (inline — no external dependency)
══════════════════════════════════════════════════════ */

interface JalaliDate { jy: number; jm: number; jd: number }

const JALALI_MONTHS = [
  "فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور",
  "مهر","آبان","آذر","دی","بهمن","اسفند",
] as const;

const JALALI_WD_SHORT = ["ش","ی","د","س","چ","پ","ج"] as const;

function toJalali(date: Date): JalaliDate {
  let gy = date.getFullYear(), gm = date.getMonth() + 1, gd = date.getDate();
  const gDaysInMonth = [31,28,31,30,31,30,31,31,30,31,30,31];
  const jDaysInMonth = [31,31,31,31,31,31,30,30,30,30,30,29];
  gy -= 1600; gm -= 1; gd -= 1;
  let gDNo = 365*gy + Math.floor((gy+3)/4) - Math.floor((gy+99)/100) + Math.floor((gy+399)/400);
  for (let i=0;i<gm;i++) gDNo += gDaysInMonth[i];
  if (gm>1 && ((gy%4===0&&gy%100!==0)||gy%400===0)) gDNo++;
  gDNo += gd;
  let jDNo = gDNo - 79;
  const jNp = Math.floor(jDNo/12053); jDNo %= 12053;
  let jy = 979 + 33*jNp + 4*Math.floor(jDNo/1461);
  jDNo %= 1461;
  if (jDNo >= 366) { jy += Math.floor((jDNo-1)/365); jDNo = (jDNo-1)%365; }
  let i=0;
  for (;i<11&&jDNo>=jDaysInMonth[i];i++) jDNo -= jDaysInMonth[i];
  return { jy, jm: i+1, jd: jDNo+1 };
}

function toGregorian(jy: number, jm: number, jd: number): Date {
  jy -= 979; jm -= 1; jd -= 1;
  let jDayNo = 365*jy + Math.floor(jy/33)*8 + Math.floor(((jy%33)+3)/4);
  for (let i=0;i<jm;i++) jDayNo += [31,31,31,31,31,31,30,30,30,30,30,29][i];
  jDayNo += jd;
  let gDayNo = jDayNo + 79;
  let gy = 1600 + 400*Math.floor(gDayNo/146097);
  gDayNo %= 146097;
  let leap = true;
  if (gDayNo >= 36525) {
    gDayNo--; gy += 100*Math.floor(gDayNo/36524); gDayNo %= 36524;
    if (gDayNo >= 365) gDayNo++; else leap = false;
  }
  gy += 4*Math.floor(gDayNo/1461); gDayNo %= 1461;
  if (gDayNo >= 366) { leap = false; gDayNo--; gy += Math.floor(gDayNo/365); gDayNo %= 365; }
  const gDIM = [31,29,31,30,31,30,31,31,30,31,30,31];
  let ii=0;
  for (;gDayNo>=gDIM[ii]+(ii===1&&leap?1:0);ii++) gDayNo -= gDIM[ii]+(ii===1&&leap?1:0);
  return new Date(gy, ii, gDayNo+1);
}

function jalaliMonthDays(jy:number, jm:number): number {
  if (jm<=6) return 31; if (jm<=11) return 30;
  return ((jy%33)%4===1 || [1,5,9,13,17,22,26,30].includes(jy%33)) ? 30 : 29;
}

function jalaliMonthStart(jy:number, jm:number): number {
  const g = toGregorian(jy,jm,1);
  return (g.getDay()+1)%7;
}

function todayJalali(): JalaliDate { return toJalali(new Date()); }

/* ══════════════════════════════════════════════════════
   THEME + DATA CONTEXTS
══════════════════════════════════════════════════════ */

type Theme = "light" | "dark";
const ThemeCtx = createContext<{ theme: Theme; toggle: ()=>void }>({
  theme: "light", toggle: ()=>{},
});
const useTheme = () => useContext(ThemeCtx);

type DashboardLiveData = ReturnType<typeof useDashboardData>;
const DashboardDataCtx = createContext<DashboardLiveData | null>(null);
const useLiveData = () => useContext(DashboardDataCtx);

/* ══════════════════════════════════════════════════════
   CSS VARIABLES (clinical token bridge)
══════════════════════════════════════════════════════ */

const LIGHT_VARS = `
  --bg-base:      hsl(var(--c-surface-canvas,  165 18% 96%));
  --bg-surface:   hsl(var(--c-surface-raised,    0  0% 100%));
  --bg-panel:     hsl(var(--c-surface-panel,   165 14% 97%));
  --bg-hover:     hsl(var(--c-surface-panel,   165 12% 94%));
  --border:       hsl(var(--c-border-hairline,    168 14% 88%));
  --border-strong:hsl(var(--c-border-structural,  168 12% 76%));
  --text-1:       hsl(var(--c-text-primary,    200 60% 8%));
  --text-2:       hsl(var(--c-text-secondary,  200 22% 22%));
  --text-3:       hsl(var(--c-text-tertiary,   200 12% 42%));
  --accent:       hsl(var(--c-accent,          166 90% 26%));
  --accent-dim:   hsl(var(--c-accent-muted,    166 55% 88%));
  --accent-glow:  color-mix(in srgb, hsl(var(--c-accent, 166 90% 26%)) 28%, transparent);
  --accent-2:     hsl(38 92% 50%);
  --shadow:       var(--c-shadow-md,   0 1px 2px rgba(12,30,24,0.05), 0 4px 14px rgba(12,30,24,0.06));
  --shadow-lg:    var(--c-shadow-lg,   0 4px 10px rgba(12,30,24,0.07), 0 14px 34px rgba(12,30,24,0.09));
  --glass-bg:     #ffffff;
  --glass-border: hsl(168 14% 88%);
  --glass-blur:   none;
  --card-shine:   #ffffff;
  --blue:        #0369A1; --blue-dim:    #bae6fd;
  --violet:      #0D9488; --violet-dim:  #99f6e4;
  --cyan:        #0891B2; --cyan-dim:    #a5f3fc;
  --amber:       #D97706; --amber-dim:   #fde68a;
  --emerald:     #047857; --emerald-dim: #a7f3d0;
  --rose:        #BE123C; --rose-dim:    #fecdd3;
`;

const DARK_VARS = `
  --bg-base:      hsl(var(--c-surface-canvas,  195 22% 5%));
  --bg-surface:   hsl(var(--c-surface-raised,  190 22% 9%));
  --bg-panel:     hsl(var(--c-surface-panel,   190 20% 7%));
  --bg-hover:     hsl(var(--c-surface-overlay, 190 16% 12%));
  --border:       hsl(var(--c-border-hairline,    190 14% 16%));
  --border-strong:hsl(var(--c-border-structural,  190 10% 26%));
  --text-1:       hsl(var(--c-text-primary,    170 16% 96%));
  --text-2:       hsl(var(--c-text-secondary,  170 10% 74%));
  --text-3:       hsl(var(--c-text-tertiary,   170 8%  56%));
  --accent:       hsl(var(--c-accent,          172 72% 46%));
  --accent-dim:   hsl(var(--c-accent-muted,    172 40% 12%));
  --accent-glow:  color-mix(in srgb, hsl(var(--c-accent, 172 72% 46%)) 32%, transparent);
  --accent-2:     hsl(38 88% 58%);
  --shadow:       var(--c-shadow-md,   0 1px 2px rgba(0,0,0,0.35), 0 6px 18px rgba(0,0,0,0.32));
  --shadow-lg:    var(--c-shadow-lg,   0 4px 10px rgba(0,0,0,0.40), 0 14px 36px rgba(0,0,0,0.48));
  --glass-bg:     hsl(190 22% 9%);
  --glass-border: hsl(190 14% 16%);
  --glass-blur:   none;
  --card-shine:   hsl(190 22% 9%);
  --blue:        #22D3EE; --blue-dim:    rgba(34,211,238,0.15);
  --violet:      #2DD4BF; --violet-dim:  rgba(45,212,191,0.15);
  --cyan:        #67E8F9; --cyan-dim:    rgba(103,232,249,0.13);
  --amber:       #FBBF24; --amber-dim:   rgba(251,191,36,0.15);
  --emerald:     #34D399; --emerald-dim: rgba(52,211,153,0.15);
  --rose:        #FB7185; --rose-dim:    rgba(251,113,133,0.15);
`;

/* ══════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════ */

interface RadarDomain {
  domain: string; you: number; avg: number;
  icon: ReactNode; color: string;
}
interface AccuracyPoint { day: string; accuracy: number; }
interface Recommendation {
  id: string; title: string; subtitle: string;
  accuracy: number; duration: string; mcqCount: number;
  reason: string; alert?: string; icon: ReactNode; color: string;
  href?: string; type?: string;
}

/* ══════════════════════════════════════════════════════
   HELPER FUNCTIONS
══════════════════════════════════════════════════════ */

const ROUTES = {
  dashboard: "/",
  library: "/library",
  review: "/flashcards/review",
  flashcards: "/flashcards",
  planner: "/planner",
  qbank: "/qbank",
  history: "/history",
  examBuilder: "/exam/builder",
  settings: "/settings",
} as const;

function isoDayLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  const labels = ["ی", "د", "س", "چ", "پ", "ج", "ش"];
  return labels[date.getDay()] ?? "؟";
}

function timeAgo(ts: number | null): string {
  if (!ts) return "اکنون";
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "اکنون";
  if (m < 60) return `${m} دقیقه پیش`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ساعت پیش`;
  const d = Math.floor(h / 24);
  return `${d} روز پیش`;
}

function buildRadarData(liveData: DashboardLiveData | null): RadarDomain[] {
  const domainMastery = liveData?.serverStats?.domainMastery ?? [];
  const icons = [
    <Ribbon key="r" className="w-4 h-4"/>, <Baby key="b" className="w-4 h-4"/>,
    <FlaskConical key="f" className="w-4 h-4"/>, <Crosshair key="c" className="w-4 h-4"/>,
    <AlertTriangle key="a" className="w-4 h-4"/>, <HeartPulse key="h" className="w-4 h-4"/>,
  ];
  const colors = ["var(--rose)","var(--violet)","var(--cyan)","var(--amber)","var(--emerald)","var(--blue)"];
  if (domainMastery.length) {
    return domainMastery.slice(0, 6).map((d, i) => {
      const you = Math.max(0, Math.min(100, Math.round(Number(d.masteryScore) || 0)));
      const confidence = Math.max(0, Math.min(100, Math.round(Number(d.confidence) || 0)));
      const avg = Math.max(0, Math.min(100, Math.round((you + confidence) / 2)));
      return { domain: d.domain || `Domain ${i + 1}`, you, avg, icon: icons[i % icons.length], color: colors[i % colors.length] };
    });
  }
  const perf = liveData?.serverStats?.chapterPerformance ?? [];
  if (!perf.length) return [];
  return perf.slice(0, 6).map((p, i) => {
    const you = Math.max(0, Math.min(100, Math.round(Number(p.accuracy) || 0)));
    const delta = Math.max(-12, Math.min(12, Math.round((Number(p.total) || 0) / 8) - 6));
    const avg = Math.max(0, Math.min(100, you + delta));
    return { domain: p.chapterTitle || `Chapter ${i + 1}`, you, avg, icon: icons[i % icons.length], color: colors[i % colors.length] };
  });
}

function buildAccuracyData(liveData: DashboardLiveData | null): AccuracyPoint[] {
  const weekly = liveData?.serverStats?.weeklyActivity ?? [];
  if (!weekly.length) return [];
  const sorted = [...weekly].sort((a, b) => a.day.localeCompare(b.day));
  return sorted.map((p) => ({
    day: isoDayLabel(p.day),
    accuracy: p.count > 0 ? Math.round((p.correct / p.count) * 100) : 0,
  }));
}

function recommendationVisual(type: string, idx: number): { icon: ReactNode; color: string } {
  if (type === "review") return { icon: <RotateCcw className="w-5 h-5"/>, color: "var(--violet)" };
  if (type === "weak_area") return { icon: <AlertTriangle className="w-5 h-5"/>, color: "var(--rose)" };
  if (type === "new_content") return { icon: <BookOpen className="w-5 h-5"/>, color: "var(--blue)" };
  return idx % 2 === 0 ? { icon: <Target className="w-5 h-5"/>, color: "var(--emerald)" } : { icon: <Layers className="w-5 h-5"/>, color: "var(--cyan)" };
}

function buildRecommendations(liveData: DashboardLiveData | null): Recommendation[] {
  const backendRecs = liveData?.dashboardRecommendations ?? [];
  if (backendRecs.length) {
    return backendRecs.slice(0, 4).map((rec, idx) => {
      const visual = recommendationVisual(rec.type, idx);
      return { id: rec.id, title: rec.title, subtitle: rec.subtitle, accuracy: rec.accuracy, duration: rec.duration, mcqCount: rec.mcqCount, reason: rec.reason, alert: rec.alert, icon: visual.icon, color: visual.color, href: rec.href || ROUTES.review, type: rec.type };
    });
  }
  const radar = buildRadarData(liveData);
  const weak = [...radar].sort((a, b) => a.you - b.you).slice(0, 2);
  const dueToday = liveData?.dueToday ?? 0;
  const recs: Recommendation[] = [];
  weak.forEach((w, i) => {
    recs.push({ id: `live-rec-${i}`, title: `${w.domain} Focus Session`, subtitle: "Targeted review", accuracy: w.you, duration: "20 min", mcqCount: 12 + i * 4, reason: `Current accuracy ${w.you}% in this domain`, alert: w.you < 65 ? "Weakness detected" : undefined, icon: w.icon, color: w.color, href: ROUTES.library, type: "weak_area" });
  });
  if (dueToday > 0) {
    recs.push({ id: "live-rec-review", title: "SRS Review Session", subtitle: "Spaced repetition", accuracy: Math.max(40, Math.min(100, liveData?.serverStats?.accuracy ?? 0)), duration: `${Math.max(8, Math.ceil(dueToday * 0.6))} min`, mcqCount: dueToday, reason: `${dueToday} cards are due today`, icon: <RotateCcw className="w-5 h-5"/>, color: "var(--violet)", href: ROUTES.review, type: "review" });
  }
  return recs.slice(0, 3);
}

function buildActivityFeed(liveData: DashboardLiveData | null): Array<{id:string;text:string;time:string;tone:string}> {
  const activity = liveData?.activityFeed ?? [];
  if (activity.length) return activity.slice(0, 5).map((a) => ({ id: a.id, text: a.text, time: a.time, tone: a.tone }));
  const recent = liveData?.serverStats?.recentExams ?? [];
  if (!recent.length) return [];
  return recent.slice(0, 5).map((e, i) => ({
    id: e.id || `exam-${i}`, text: `${e.title || "Exam"} — ${e.scorePercent ?? 0}% accuracy`,
    time: timeAgo(e.completedAt), tone: (e.scorePercent ?? 0) >= 70 ? "emerald" : "rose",
  }));
}

const FEATURE_ICONS: Record<string, ReactNode> = {
  review: <RotateCcw size={20}/>,
  qbank: <Brain size={20}/>,
  flashcards: <CreditCard size={20}/>,
  notebooks: <BookOpen size={20}/>,
  planner: <Calendar size={20}/>,
  history: <Clock size={20}/>,
  analytics: <Activity size={20}/>,
  "exam-builder": <Layers size={20}/>,
  "exam-active": <Play size={20}/>,
  import: <ArrowUpRight size={20}/>,
  "srs-insights": <Eye size={20}/>,
  settings: <CircleDot size={20}/>,
};

/* ══════════════════════════════════════════════════════
   UI PRIMITIVES
══════════════════════════════════════════════════════ */

function GlassCard({ children, className="", style={}, onClick }:
  { children:ReactNode; className?:string; style?:React.CSSProperties; onClick?:()=>void }) {
  return (
    <div className={`hs-glass ${className}`} style={style} onClick={onClick}>
      {children}
    </div>
  );
}

function SectionHead({ icon, title, sub, eyebrow, action }:
  { icon:ReactNode; title:string; sub?:string; eyebrow?:string; action?:ReactNode }) {
  return (
    <div className="hs-section-head">
      <div className="hs-section-icon">{icon}</div>
      <div style={{flex:1,minWidth:0}}>
        {eyebrow && <div className="hs-section-eyebrow">{eyebrow}</div>}
        <div className="hs-section-title">{title}</div>
        {sub && <div className="hs-section-sub">{sub}</div>}
      </div>
      {action}
    </div>
  );
}

function Chip({ label, color }: { label:string; color:string }) {
  return (
    <span style={{
      padding:"3px 10px", borderRadius:"20px", fontSize:"11px", fontWeight:600,
      background:`color-mix(in srgb, ${color} 12%, transparent)`, color,
      border:`1px solid color-mix(in srgb, ${color} 25%, transparent)`, whiteSpace:"nowrap",
    }}>{label}</span>
  );
}

function ProgressBar({ pct, color="var(--accent)", height=6 }:
  { pct:number; color?:string; height?:number }) {
  return (
    <div style={{width:"100%",height,borderRadius:99,background:"var(--border)",overflow:"hidden"}}>
      <motion.div
        initial={{width:0}} animate={{width:`${Math.min(pct,100)}%`}}
        transition={{duration:0.8,ease:"easeOut"}}
        style={{height:"100%",borderRadius:99,background:color,
          boxShadow:`0 0 12px ${color}55`}}
      />
    </div>
  );
}

function Ring({ value, size=52, stroke=4, color="var(--accent)", glow=false, children }:
  { value:number; size?:number; stroke?:number; color?:string; glow?:boolean; children?:ReactNode }) {
  const r=(size-stroke)/2, circ=2*Math.PI*r, off=circ*(1-Math.min(value/100,1));
  return (
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} opacity={0.5}/>
        <motion.circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round"
          initial={{strokeDasharray:circ, strokeDashoffset:circ}}
          animate={{strokeDashoffset:off}}
          transition={{duration:1.2,ease:"easeOut",delay:0.2}}
          style={{filter:glow?`drop-shadow(0 0 6px ${color}80)`:undefined}}/>
      </svg>
      {children && (
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column"}}>
          {children}
        </div>
      )}
    </div>
  );
}

function TrendArrow({ trend }: { trend:string }) {
  if (trend === "improving") return <TrendingUp size={14} style={{color:"var(--emerald)"}}/>;
  if (trend === "declining") return <TrendingDown size={14} style={{color:"var(--rose)"}}/>;
  return <Minus size={14} style={{color:"var(--text-3)"}}/>;
}

function AnimatedNumber({ value, duration=1000 }: { value:number; duration?:number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value, duration]);
  return <>{display}</>;
}

/* ══════════════════════════════════════════════════════
   SATURN SVG
══════════════════════════════════════════════════════ */

function SaturnIcon({ size=32, animated=false }: { size?:number; animated?:boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none"
      style={{ filter:"drop-shadow(0 0 8px rgba(10,166,184,0.55))", flexShrink:0,
               animation: animated ? "satFloat 6s ease-in-out infinite" : undefined }}>
      <defs>
        <radialGradient id="sb" cx="38%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#b2eef4"/>
          <stop offset="50%" stopColor="#0AA6B8"/>
          <stop offset="100%" stopColor="#047A88"/>
        </radialGradient>
        <linearGradient id="sr" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#0AA6B8" stopOpacity="0"/>
          <stop offset="30%"  stopColor="#7DD8E3" stopOpacity="0.9"/>
          <stop offset="50%"  stopColor="#ffffff" stopOpacity="1"/>
          <stop offset="70%"  stopColor="#7DD8E3" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#0AA6B8" stopOpacity="0"/>
        </linearGradient>
        <radialGradient id="sg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0AA6B8" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#0AA6B8" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="url(#sg)"/>
      <ellipse cx="32" cy="34" rx="27" ry="7" stroke="url(#sr)" strokeWidth="2.5" fill="none" opacity="0.45" transform="rotate(-18,32,34)"/>
      <circle cx="32" cy="32" r="13" fill="url(#sb)"/>
      <ellipse cx="28" cy="27" rx="5" ry="3" fill="rgba(255,255,255,0.22)" transform="rotate(-15,28,27)"/>
      <ellipse cx="32" cy="34" rx="27" ry="7" stroke="url(#sr)" strokeWidth="2.5" fill="none" strokeDasharray="0 42 44 0" transform="rotate(-18,32,34)"/>
    </svg>
  );
}

/* ══════════════════════════════════════════════════════
   HERO SECTION — Full-width glass bar
══════════════════════════════════════════════════════ */

function HeroSection() {
  const router = useRouter();
  const liveData = useLiveData();
  const { theme, toggle } = useTheme();

  const readinessScore = liveData?.readinessScore;
  const readiness = readinessScore?.score ?? 0;
  const readinessLevel = readinessScore?.level ?? "not_ready";
  const streak = liveData?.streak ?? 0;
  const dueToday = liveData?.dueToday ?? 0;
  const etaMin = liveData?.etaMinutes ?? 0;
  const accuracy = liveData?.serverStats?.accuracy ?? 0;
  const daysToExam = liveData?.plannerDetailedStats?.daysToExam ?? null;
  const greeting = liveData?.greeting ?? "";

  const { jy, jm, jd } = todayJalali();
  const jalaliDate = `${jd} ${JALALI_MONTHS[jm - 1]} ${jy}`;

  const readinessLabel =
    readinessLevel === "ready"
      ? "آماده"
      : readinessLevel === "proficient"
      ? "مسلط"
      : readinessLevel === "developing"
      ? "در حال رشد"
      : readinessLevel === "needs_work"
      ? "نیازمند کار"
      : "شروع";

  const contextLine = (() => {
    if (daysToExam != null && daysToExam >= 0 && daysToExam <= 7) {
      return {
        text: daysToExam === 0 ? "امروز آزمون است" : `${daysToExam} روز تا آزمون`,
        color: "var(--rose)",
      };
    }
    if (dueToday > 0) {
      return {
        text: `${dueToday} کارت آماده مرور · ${etaMin} دقیقه`,
        color: "var(--violet)",
      };
    }
    if (streak >= 3) {
      return {
        text: `استریک ${streak} روزه`,
        color: "var(--amber)",
      };
    }
    return {
      text: "Mission control for today",
      color: "var(--accent)",
    };
  })();

  const summaryItems = [
    {
      key: "readiness",
      eyebrow: "READINESS",
      value: `${readiness}%`,
      meta: readinessLabel,
      color: readiness >= 75 ? "var(--emerald)" : readiness >= 55 ? "var(--amber)" : "var(--rose)",
      icon: <Activity size={14} />,
    },
    {
      key: "due",
      eyebrow: "DUE TODAY",
      value: `${dueToday}`,
      meta: dueToday > 0 ? `${etaMin} دقیقه` : "آزاد",
      color: "var(--violet)",
      icon: <RotateCcw size={14} />,
    },
    {
      key: "streak",
      eyebrow: "STREAK",
      value: `${streak}`,
      meta: "روز متوالی",
      color: "var(--amber)",
      icon: <Flame size={14} />,
    },
    {
      key: "exam",
      eyebrow: "EXAM",
      value:
        daysToExam == null
          ? "—"
          : daysToExam === 0
          ? "امروز"
          : `${daysToExam} روز`,
      meta: "تا آزمون",
      color:
        daysToExam == null
          ? "var(--text-3)"
          : daysToExam <= 7
          ? "var(--rose)"
          : daysToExam <= 30
          ? "var(--amber)"
          : "var(--emerald)",
      icon: <GraduationCap size={14} />,
    },
  ];

  const primaryHref = dueToday > 0 ? ROUTES.review : ROUTES.planner;
  const primaryLabel = dueToday > 0 ? "شروع مرور" : "ادامه برنامه";

  return (
    <div className="hs-top-strip-wrap">
      <div className="hs-top-strip">
        <div className="hs-top-strip-intro">
          <div className="hs-top-strip-eyebrow">MISSION CONTROL</div>
          <div className="hs-top-strip-title">
            {greeting || "سلام"} <span style={{ color: "var(--accent)" }}>حسین</span>
          </div>
          <div className="hs-top-strip-meta">
            <span className="hs-inline-meta">
              <Calendar size={12} />
              {jalaliDate}
            </span>
            <span
              className="hs-inline-badge"
              style={{ "--badge-tone": contextLine.color } as React.CSSProperties}
            >
              {contextLine.text}
            </span>
          </div>
        </div>

        <div className="hs-top-strip-stats">
          {summaryItems.map((item) => (
            <div
              key={item.key}
              className="hs-summary-chip"
              style={{ "--chip-tone": item.color } as React.CSSProperties}
            >
              <div className="hs-summary-chip-icon">{item.icon}</div>
              <div className="hs-summary-chip-body">
                <div className="hs-summary-chip-eyebrow">{item.eyebrow}</div>
                <div className="hs-summary-chip-row">
                  <span className="hs-summary-chip-value" style={{ color: item.color }}>
                    {item.value}
                  </span>
                  <span className="hs-summary-chip-meta">{item.meta}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="hs-top-strip-actions">
          <button className="hs-btn-primary" onClick={() => router.push(primaryHref)}>
            <Play size={14} />
            {primaryLabel}
          </button>

          <div className="hs-top-strip-actions-row">
            <button className="hs-btn-ghost" onClick={() => router.push(ROUTES.planner)}>
              <Calendar size={14} />
              برنامه امروز
            </button>

            <button className="hs-theme-toggle" onClick={toggle} title="Toggle theme">
              {theme === "dark" ? <Sparkles size={15} /> : <CircleDot size={15} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   COMMAND CENTER — 4-column action grid
══════════════════════════════════════════════════════ */

function CommandCenter() {
  const router = useRouter();
  const liveData = useLiveData();

  const dueToday = liveData?.dueToday ?? 0;
  const eta = liveData?.etaMinutes ?? 0;
  const overdue = liveData?.planner?.overdueTasks ?? 0;
  const todayTasks = liveData?.planner?.todayTasks ?? 0;
  const completedToday = liveData?.planner?.completedToday ?? 0;
  const completionPct =
    todayTasks > 0 ? Math.round((completedToday / todayTasks) * 100) : 0;

  const weakSpots = liveData?.weakSpots ?? [];
  const weakest =
    weakSpots.length > 0
      ? weakSpots.reduce((a, b) => (a.accuracy < b.accuracy ? a : b))
      : null;

  const commands = [
    {
      key: "review",
      eyebrow: "REVIEW LOAD",
      title: "مرور امروز",
      value: `${dueToday}`,
      meta: dueToday > 0 ? `${eta} دقیقه · آماده شروع` : "چیزی برای مرور نداری",
      cta: "شروع مرور",
      href: ROUTES.review,
      color: "var(--violet)",
      icon: <RotateCcw size={16} />,
    },
    {
      key: "plan",
      eyebrow: "TODAY PLAN",
      title: "پیشرفت امروز",
      value: `${completionPct}%`,
      meta: `${completedToday} از ${todayTasks} تسک`,
      cta: "دیدن برنامه",
      href: ROUTES.planner,
      color: "var(--emerald)",
      icon: <ListTodo size={16} />,
    },
    {
      key: "weak",
      eyebrow: "WEAK DOMAIN",
      title: weakest ? weakest.domain : "بدون ضعف فعال",
      value: weakest ? `${weakest.accuracy}%` : "—",
      meta: weakest ? "نیازمند تمرین هدفمند" : "وضعیت پایدار",
      cta: "شروع تمرین",
      href: ROUTES.qbank,
      color: weakest ? "var(--rose)" : "var(--blue)",
      icon: <Target size={16} />,
    },
    {
      key: "backlog",
      eyebrow: "RECOVERY QUEUE",
      title: "تسک عقب‌مانده",
      value: `${overdue}`,
      meta: overdue > 0 ? "نیازمند catch-up" : "صف پاک است",
      cta: "مدیریت",
      href: ROUTES.planner,
      color: overdue > 0 ? "var(--amber)" : "var(--accent)",
      icon: <AlertTriangle size={16} />,
    },
  ];

  return (
    <div className="hs-op-zone">
      <div className="hs-op-grid">
        {commands.map((cmd) => (
          <div
            key={cmd.key}
            className="hs-op-card"
            style={{ "--op-tone": cmd.color } as React.CSSProperties}
          >
            <div className="hs-op-head">
              <div className="hs-op-eyebrow">{cmd.eyebrow}</div>
              <div className="hs-op-icon">{cmd.icon}</div>
            </div>

            <div className="hs-op-main">
              <div className="hs-op-title">{cmd.title}</div>
              <div className="hs-op-value" style={{ color: cmd.color }}>
                {cmd.value}
              </div>
            </div>

            <div className="hs-op-sub">{cmd.meta}</div>

            <button className="hs-op-cta" onClick={() => router.push(cmd.href)}>
              {cmd.cta}
              <ArrowUpRight size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SMART ACTION BANNER — "What should I do right now?"
   2027: animated conic-gradient border via @property
══════════════════════════════════════════════════════ */

function SmartActionBanner() {
  const liveData = useLiveData();
  const router = useRouter();

  const due   = liveData?.dueToday ?? 0;
  const eta   = liveData?.etaMinutes ?? 0;
  const weak  = liveData?.weakSpots ?? [];
  const weakest = weak.length > 0 ? weak.reduce((a, b) => a.accuracy < b.accuracy ? a : b) : null;
  const recs  = liveData?.dashboardRecommendations ?? [];

  type BannerAction = { title: string; sub: string; cta: string; href: string; color: string; icon: ReactNode };
  let action: BannerAction | null = null;

  if (due > 0) {
    action = {
      title: `${due} فلش‌کارت برای مرور`,
      sub: `حدود ${eta} دقیقه · بازیابی قبل از فراموشی`,
      cta: "شروع مرور",
      href: ROUTES.review,
      color: "var(--violet)",
      icon: <RotateCcw size={22}/>,
    };
  } else if (weakest && weakest.accuracy < 65) {
    action = {
      title: `تمرکز روی ${weakest.domain}`,
      sub: `دقت فعلی ${weakest.accuracy}% · ۱۰ سؤال هدفمند`,
      cta: "شروع تمرین",
      href: ROUTES.qbank,
      color: "var(--rose)",
      icon: <Target size={22}/>,
    };
  } else if (recs.length > 0) {
    const top = recs[0];
    action = {
      title: top.title,
      sub: top.subtitle + (top.duration ? ` · ${top.duration}` : ""),
      cta: "شروع",
      href: top.href || ROUTES.qbank,
      color: "var(--blue)",
      icon: <Sparkles size={22}/>,
    };
  }

  if (!action) return null;

  return (
    <motion.div className="hs-smart-banner"
      style={{ "--banner-color": action.color } as React.CSSProperties}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}>
      <div className="hs-smart-banner-glow"/>
      <div className="hs-smart-banner-inner">
        <div className="hs-smart-banner-icon">{action.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="hs-smart-banner-title">{action.title}</div>
          <div className="hs-smart-banner-sub">{action.sub}</div>
        </div>
        <button className="hs-smart-banner-cta" onClick={() => router.push(action!.href)}>
          <Play size={14}/> {action.cta}
        </button>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════
   EXAM COUNTDOWN BAR
══════════════════════════════════════════════════════ */

function ExamCountdownBar() {
  const liveData = useLiveData();
  const daysToExam = liveData?.plannerDetailedStats?.daysToExam;
  const readiness  = liveData?.readinessScore?.score ?? 0;

  if (daysToExam == null || daysToExam < 0) return null;

  const urgencyColor = daysToExam <= 7 ? "var(--rose)" : daysToExam <= 30 ? "var(--amber)" : "var(--emerald)";
  const label = daysToExam === 0 ? "امروز آزمون!" : daysToExam === 1 ? "فردا آزمون!" : `${daysToExam} روز تا آزمون`;
  const readinessLabel = readiness >= 80 ? "آماده‌ای" : readiness >= 60 ? "در مسیری" : readiness >= 40 ? "تلاش بیشتر" : "عقب‌مانده‌ای";

  return (
    <motion.div className="hs-exam-bar"
      style={{ "--exam-color": urgencyColor } as React.CSSProperties}
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}>
      <div className="hs-exam-bar-inner">
        <GraduationCap size={16} style={{ color: urgencyColor, flexShrink: 0 }}/>
        <span className="hs-exam-bar-label">{label}</span>
        <div className="hs-exam-bar-track">
          <motion.div className="hs-exam-bar-fill"
            initial={{ width: 0 }} animate={{ width: `${Math.min(readiness, 100)}%` }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.4 }}
            style={{ background: `linear-gradient(90deg, ${urgencyColor}, color-mix(in srgb, ${urgencyColor} 60%, var(--accent)))` }}/>
        </div>
        <span className="hs-exam-bar-readiness" style={{ color: urgencyColor }}>
          {readiness}% {readinessLabel}
        </span>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════
   MASTERY RADAR
══════════════════════════════════════════════════════ */

function MasteryRadar() {
  const { theme } = useTheme();
  const liveData = useLiveData();
  const gridColor = theme==="dark"?"rgba(10,166,184,0.1)":"rgba(4,122,136,0.08)";
  const tickColor = theme==="dark"?"#505f79":"#8993a4";
  const tooltipBg = theme==="dark"?"rgba(4,46,52,0.95)":"rgba(255,255,255,0.97)";
  const tooltipBorder = theme==="dark"?"rgba(10,166,184,0.25)":"rgba(4,122,136,0.2)";
  const finalData = useMemo(() => buildRadarData(liveData), [liveData]);

  if (!finalData.length) {
    return (
      <GlassCard className="hs-panel-compact">
        <SectionHead icon={<GraduationCap size={18} style={{color:"var(--violet)"}}/>}
          eyebrow="ANALYTICS"
          title="Mastery Radar" sub="رادار تسلط حوزه‌ها"/>
        <div style={{textAlign:"center",padding:"40px 0",color:"var(--text-3)"}}>
          <Brain size={36} style={{opacity:0.3,margin:"0 auto 12px"}}/>
          <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>هنوز داده‌ای نیست</div>
          <div style={{fontSize:12}}>با شروع مطالعه و آزمون، رادار تسلط‌تان شکل می‌گیرد</div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="hs-panel-compact">
      <SectionHead
  icon={<GraduationCap size={18} style={{ color: "var(--violet)" }} />}
  eyebrow="ANALYTICS"
  title="Mastery Radar"
  sub="رادار تسلط حوزه‌ها"
/>
      <div style={{width:"100%",height:260}}>
        <ResponsiveContainer>
          <RechartsRadarChart cx="50%" cy="50%" outerRadius="68%"
            data={finalData.map(d=>({subject:d.domain,you:d.you,avg:d.avg}))}>
            <PolarGrid stroke={gridColor} gridType="polygon"/>
            <PolarAngleAxis dataKey="subject"
              tick={{fill:tickColor,fontSize:11,fontFamily:"inherit"}}/>
            <PolarRadiusAxis domain={[0,100]} axisLine={false}
              tick={{fill:tickColor,fontSize:9,fontFamily:"inherit"}}/>
            <RechartsRadar name="You" dataKey="you" stroke="var(--blue)"
              fill="var(--blue)" fillOpacity={0.25} strokeWidth={2}
              dot={{r:3,fill:"var(--blue)",stroke:"var(--bg-surface)",strokeWidth:1.5}}/>
            <RechartsRadar name="Avg" dataKey="avg" stroke="var(--text-3)"
              fill="var(--text-3)" fillOpacity={0.1} strokeWidth={1.5} strokeDasharray="4 2"/>
            <RechartsTooltip contentStyle={{background:tooltipBg,border:`1px solid ${tooltipBorder}`,
              borderRadius:12,fontSize:12,fontFamily:"inherit",color:"var(--text-1)"}}
              formatter={(v:number,n:string)=>[`${v}%`,n==="you"?"شما":"میانگین"]}/>
          </RechartsRadarChart>
        </ResponsiveContainer>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:6}}>
        {finalData.map(d=>(
          <div key={d.domain} style={{display:"flex",alignItems:"center",gap:6,
            padding:"6px 10px",borderRadius:10,background:"var(--bg-hover)"}}>
            <span style={{color:d.color,flexShrink:0}}>{d.icon}</span>
            <span style={{fontSize:12,color:"var(--text-2)",flex:1,minWidth:0,
              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.domain}</span>
            <span style={{fontSize:12,fontWeight:700,fontVariantNumeric:"tabular-nums",
              color:d.you>=80?"var(--emerald)":d.you>=60?"var(--amber)":"var(--rose)"}}>{d.you}%</span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

/* ══════════════════════════════════════════════════════
   ACCURACY TREND (7-day area chart)
══════════════════════════════════════════════════════ */

function AccuracyTrend() {
  const { theme } = useTheme();
  const liveData = useLiveData();
  const accuracyData = useMemo(() => buildAccuracyData(liveData), [liveData]);
  const gridColor = theme==="dark"?"rgba(10,166,184,0.07)":"rgba(4,122,136,0.06)";
  const tickColor = theme==="dark"?"#505f79":"#8993a4";
  const tooltipBg = theme==="dark"?"rgba(4,46,52,0.95)":"rgba(255,255,255,0.97)";

  if (!accuracyData.length) {
    return (
      <GlassCard className="hs-bento-wide hs-panel-insight">
        <SectionHead icon={<TrendingUp size={18} style={{color:"var(--emerald)"}}/>}
          eyebrow="INSIGHT"
          title="Accuracy Trend" sub="عملکرد هفته جاری"/>
        <div style={{textAlign:"center",padding:"40px 0",color:"var(--text-3)"}}>
          <Activity size={36} style={{opacity:0.3,margin:"0 auto 12px"}}/>
          <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>هنوز فعالیتی این هفته نداشتید</div>
          <div style={{fontSize:12}}>اولین آزمون را بزنید تا روند دقت‌تان ثبت شود</div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="hs-bento-wide hs-panel-insight">
      <SectionHead
  icon={<TrendingUp size={18} style={{ color: "var(--emerald)" }} />}
  eyebrow="INSIGHT"
  title="Accuracy Trend"
  sub="عملکرد هفته جاری"
/>
      <div style={{width:"100%",height:240}}>
        <ResponsiveContainer>
          <AreaChart data={accuracyData} margin={{top:8,right:4,left:-18,bottom:0}}>
            <defs>
              <linearGradient id="accGrad4" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor="var(--emerald)" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="var(--emerald)" stopOpacity={0.02}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 6" stroke={gridColor} vertical={false}/>
            <XAxis dataKey="day" tick={{fill:tickColor,fontSize:11,fontFamily:"inherit"}}
              axisLine={{stroke:gridColor}} tickLine={false}/>
            <YAxis domain={[0,100]} tick={{fill:tickColor,fontSize:10,fontFamily:"inherit"}}
              axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`}/>
            <RechartsTooltip contentStyle={{background:tooltipBg,border:"1px solid var(--border-strong)",
              borderRadius:12,fontSize:12,fontFamily:"inherit"}}
              formatter={(v:number)=>[`${v}%`,"دقت"]}/>
            <Area type="monotone" dataKey="accuracy" stroke="var(--emerald)" strokeWidth={2.5}
              fill="url(#accGrad4)" dot={{r:4,fill:"var(--emerald)",stroke:"var(--bg-surface)",strokeWidth:2}}
              activeDot={{r:7,fill:"var(--emerald)",stroke:"var(--bg-surface)",strokeWidth:2}}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}

/* ══════════════════════════════════════════════════════
   JALALI MINI-CALENDAR
══════════════════════════════════════════════════════ */

function useStudyMap(jy:number, jm:number) {
  const liveData = useLiveData();
  return useMemo(()=>{
    const map = new Map<number,number>();
    const total = jalaliMonthDays(jy,jm);
    const monthly = liveData?.monthlyActivity ?? [];
    if (monthly.length) {
      const byIso = new Map<string, number>();
      monthly.forEach((m) => {
        const intensity = (Number(m.questionsAnswered) || 0) * 2 + (Number(m.cardsReviewed) || 0);
        byIso.set(m.date, intensity);
      });
      for(let d=1;d<=total;d++){
        const g = toGregorian(jy, jm, d);
        const iso = `${g.getFullYear()}-${String(g.getMonth()+1).padStart(2,"0")}-${String(g.getDate()).padStart(2,"0")}`;
        const count = byIso.get(iso) || 0;
        if (count > 0) map.set(d, Math.min(80, count * 3));
      }
      if (map.size > 0) return map;
    }
    const weekly = liveData?.serverStats?.weeklyActivity ?? [];
    if (!weekly.length) return map;
    const byIso = new Map<string, number>();
    weekly.forEach((w) => byIso.set(w.day, Number(w.count) || 0));
    for(let d=1;d<=total;d++){
      const g = toGregorian(jy, jm, d);
      const iso = `${g.getFullYear()}-${String(g.getMonth()+1).padStart(2,"0")}-${String(g.getDate()).padStart(2,"0")}`;
      const count = byIso.get(iso) || 0;
      if (count > 0) map.set(d, Math.min(80, count * 8));
    }
    return map;
  },[jy,jm,liveData]);
}

function JalaliMiniCalendar() {
  const today = todayJalali();
  const [view, setView] = useState({jy:today.jy, jm:today.jm});
  const studyMap = useStudyMap(view.jy, view.jm);
  const prevMonth = ()=> setView(v=> v.jm===1?{jy:v.jy-1,jm:12}:{...v,jm:v.jm-1});
  const nextMonth = ()=> setView(v=> v.jm===12?{jy:v.jy+1,jm:1}:{...v,jm:v.jm+1});
  const totalDays = jalaliMonthDays(view.jy, view.jm);
  const startOff  = jalaliMonthStart(view.jy, view.jm);
  const cells: {d:number; current:boolean}[] = [];
  const prevTotal = jalaliMonthDays(view.jm===1?view.jy-1:view.jy, view.jm===1?12:view.jm-1);
  for(let i=startOff-1;i>=0;i--) cells.push({d:prevTotal-i,current:false});
  for(let d=1;d<=totalDays;d++) cells.push({d,current:true});
  while(cells.length<35) cells.push({d:cells.length-totalDays-startOff+1,current:false});
  const intensityColor = (cards:number)=>{
    if(!cards) return "transparent";
    const p = Math.min(cards/80,1);
    if(p<0.2) return "color-mix(in srgb, var(--accent) 14%, transparent)";
    if(p<0.45) return "color-mix(in srgb, var(--accent) 32%, transparent)";
    if(p<0.7)  return "color-mix(in srgb, var(--accent) 55%, transparent)";
    return "var(--accent)";
  };
  const isCurrentMonth = view.jy===today.jy && view.jm===today.jm;
  const activeDays = studyMap.size;
  const totalInMonth = totalDays;

  return (
    <GlassCard className="hs-panel-calendar">
      <div className="hs-cal-head">
        <div className="hs-cal-head-titles">
          <span className="hs-cal-eyebrow">STUDY MAP</span>
          <span className="hs-cal-month">
            {JALALI_MONTHS[view.jm-1]} {view.jy}
          </span>
          <span className="hs-cal-meta">
            {isCurrentMonth ? "ماه جاری" : "مرور ماه"}
            {activeDays > 0 && (
              <> · <span style={{color:"var(--accent)",fontWeight:800,fontVariantNumeric:"tabular-nums"}}>
                {activeDays}/{totalInMonth}
              </span> روز فعال</>
            )}
          </span>
        </div>
        <div className="hs-cal-nav">
          {!isCurrentMonth && (
            <button className="hs-touch-btn" onClick={()=>setView({jy:today.jy,jm:today.jm})}
              style={{fontSize:11,padding:"6px 10px",width:"auto",fontWeight:700}}>امروز</button>
          )}
          <button className="hs-touch-btn" onClick={nextMonth} aria-label="ماه بعد">&rsaquo;</button>
          <button className="hs-touch-btn" onClick={prevMonth} aria-label="ماه قبل">&lsaquo;</button>
        </div>
      </div>
      <div className="hs-cal-weekrow" dir="rtl">
        {JALALI_WD_SHORT.map((d,i)=>(
          <div key={i} className="hs-cal-weekday" data-weekend={i===6?"true":undefined}>{d}</div>
        ))}
      </div>
      <div className="hs-cal-grid" dir="rtl">
        {cells.map((cell,idx)=>{
          const cards = cell.current ? (studyMap.get(cell.d)||0) : 0;
          const isToday = cell.current&&view.jy===today.jy&&view.jm===today.jm&&cell.d===today.jd;
          return (
            <div key={idx} className="hs-cal-cell"
              data-current={cell.current?"true":undefined}
              data-out={cell.current?undefined:"true"}
              data-today={isToday?"true":undefined}
              style={{background: !isToday && cards>0 ? intensityColor(cards) : undefined}}>
              <span className="hs-cal-day-num">{cell.d}</span>
              {cards>0 && !isToday && <span className="hs-cal-day-dot"/>}
            </div>
          );
        })}
      </div>
      <div className="hs-cal-legend">
        <span>کم</span>
        <div className="hs-cal-legend-swatches">
          {[0.14, 0.32, 0.55, 1].map((op,i)=>(
            <span key={i} className="hs-cal-legend-swatch"
              style={{background: op===1 ? "var(--accent)" : `color-mix(in srgb, var(--accent) ${op*100}%, transparent)`}}/>
          ))}
        </div>
        <span>زیاد</span>
        <span className="hs-cal-legend-meta">{activeDays} / {totalInMonth}</span>
      </div>
    </GlassCard>
  );
}

/* ══════════════════════════════════════════════════════
   SMART PATH — AI Recommendations Carousel
══════════════════════════════════════════════════════ */

function SmartPath() {
  const router = useRouter();
  const liveData = useLiveData();
  const recommendations = useMemo(() => buildRecommendations(liveData), [liveData]);
  const [idx, setIdx] = useState(0);
  useEffect(() => { if (idx >= recommendations.length && recommendations.length > 0) setIdx(0); }, [idx, recommendations.length]);

  if (!recommendations.length) {
    return (
      <GlassCard className="hs-bento-wide hs-panel-priority">
        <SectionHead icon={<Sparkles size={18} style={{color:"var(--accent)"}}/>}
          eyebrow="STUDY PATH"
          title="Smart Path" sub="مسیر هوشمند مطالعه"/>
        <div style={{textAlign:"center",padding:"32px 0",color:"var(--text-3)"}}>
          <Lightbulb size={40} style={{opacity:0.25,margin:"0 auto 12px"}}/>
          <div style={{fontSize:14,fontWeight:600,marginBottom:6}}>مسیر هوشمند در حال یادگیری شماست</div>
          <div style={{fontSize:12}}>چند آزمون بزنید تا پیشنهاد شخصی‌سازی‌شده دریافت کنید</div>
        </div>
      </GlassCard>
    );
  }

  const rec = recommendations[idx] ?? recommendations[0];
  const canPrev = idx > 0;
  const canNext = idx < recommendations.length - 1;

  return (
    <GlassCard className="hs-bento-wide">
      <SectionHead
        icon={<Sparkles size={18} style={{color:"var(--accent)"}}/>}
        eyebrow="STUDY PATH"
        title="Smart Path" sub="مسیر هوشمند مطالعه"
        action={
          <div style={{display:"flex",gap:4}}>
            <button className="hs-touch-btn" onClick={()=>setIdx(i=>Math.max(0,i-1))}
              disabled={!canPrev} style={{opacity:canPrev?1:0.3}}>
              <ChevronRight size={14}/>
            </button>
            <button className="hs-touch-btn" onClick={()=>setIdx(i=>Math.min(recommendations.length-1,i+1))}
              disabled={!canNext} style={{opacity:canNext?1:0.3}}>
              <ChevronLeft size={14}/>
            </button>
          </div>
        }
      />

      <AnimatePresence mode="wait">
        <motion.div key={rec.id}
          initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}}
          transition={{duration:0.25}}
          className="hs-smart-card"
          style={{"--card-accent": rec.color} as React.CSSProperties}>
          {rec.alert && (
            <div className="hs-smart-alert">
              <AlertTriangle size={13}/>
              <span>{rec.alert}</span>
            </div>
          )}
          <div style={{fontWeight:700,fontSize:16,color:"var(--text-1)",marginBottom:4}}>{rec.title}</div>
          <div style={{fontSize:12,color:"var(--text-3)",marginBottom:4}}>{rec.subtitle}</div>
          <div style={{fontSize:13,color:"var(--text-2)",marginBottom:12}}>{rec.reason}</div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:14}}>
            <Chip label={rec.duration} color="var(--blue)"/>
            <Chip label={`${rec.mcqCount} MCQs`} color="var(--violet)"/>
            <Chip label={`${rec.accuracy}%`} color={rec.accuracy<70?"var(--rose)":"var(--emerald)"}/>
          </div>
          <button className="hs-btn-primary" onClick={()=>router.push(rec.href || ROUTES.review)}>
            <Play size={14}/> شروع
          </button>
        </motion.div>
      </AnimatePresence>

      {/* Dots indicator */}
      <div style={{display:"flex",justifyContent:"center",gap:6,marginTop:14}}>
        {recommendations.map((r,i)=>(
          <button key={r.id} onClick={()=>setIdx(i)}
            style={{width:i===idx?24:8,height:8,borderRadius:99,border:"none",cursor:"pointer",
              background:i===idx?"var(--accent)":"var(--border-strong)",transition:"all 0.2s"}}/>
        ))}
      </div>
    </GlassCard>
  );
}

/* ══════════════════════════════════════════════════════
   DAILY MISSIONS (goals)
══════════════════════════════════════════════════════ */

function DailyMissions() {
  const liveData = useLiveData();
  const ps = liveData?.serverStats?.plannerStats;
  const plannerDetailed = liveData?.plannerDetailedStats;
  const completedToday = plannerDetailed?.completedToday ?? ps?.completedTasks ?? 0;
  const todayTasks = plannerDetailed?.todayTasks ?? ps?.todayTasks ?? 0;
  const completionRate = ps?.completionRate ?? 0;
  const overdueTasks = plannerDetailed?.overdueTasks ?? ps?.overdueTasks ?? 0;
  const studyHours = (liveData?.serverStats?.studyTimeToday ?? 0) / 3600;
  const dailyGoalMinutes = plannerDetailed?.dailyGoalMinutes ?? 0;
  const targetStudyHours = dailyGoalMinutes > 0 ? dailyGoalMinutes / 60 : 4;
  const dueToday = liveData?.fsrsStats?.dueToday ?? liveData?.dueToday ?? 0;
  const reviewedToday = liveData?.fsrsStats?.reviewedToday ?? 0;

  const goals = [
    { label:"تسک امروز", cur: completedToday, target: Math.max(todayTasks, 1), color:"var(--violet)", icon:<ListTodo size={14}/> },
    { label:"مرور SRS", cur: reviewedToday, target: Math.max(dueToday, 1), color:"var(--blue)", icon:<RotateCcw size={14}/> },
    { label:"تسک عقب\u200Cمانده", cur: overdueTasks, target: overdueTasks, color:"var(--rose)", icon:<AlertTriangle size={14}/> },
    { label:"ساعت مطالعه", cur: Math.round(studyHours * 10) / 10, target: Math.max(0.5, Math.round(targetStudyHours * 10) / 10), color:"var(--emerald)", icon:<Clock size={14}/> },
  ];

  return (
    <GlassCard className="hs-panel-compact">
      <SectionHead icon={<Flame size={18} style={{color:"var(--amber)"}}/>}
        eyebrow="TODAY FOCUS"
        title="Daily Missions" sub="پیشرفت امروز"/>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {goals.map((g,i)=>{
          const pct = g.target > 0 ? Math.min(g.cur/g.target*100,100) : (g.cur > 0 ? 100 : 0);
          return (
            <motion.div key={g.label} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}
              transition={{delay:i*0.06}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",gap:6,fontSize:13,color:"var(--text-2)"}}>
                  <span style={{color:g.color,opacity:0.7}}>{g.icon}</span>
                  <span>{g.label}</span>
                </div>
                <span style={{fontWeight:700,fontVariantNumeric:"tabular-nums",fontSize:13,
                  color:pct>=100?"var(--emerald)":g.color}}>
                  {g.cur}/{g.target}
                </span>
              </div>
              <ProgressBar pct={pct} color={g.color} height={6}/>
            </motion.div>
          );
        })}
      </div>
    </GlassCard>
  );
}

/* ══════════════════════════════════════════════════════
   WEAK AREAS
══════════════════════════════════════════════════════ */

function WeakAreas() {
  const liveData = useLiveData();
  const detailedWeak = liveData?.serverStats?.detailedWeakAreas ?? [];
  const weakSpots = liveData?.weakSpots ?? [];

  const areas = useMemo(() => {
    if (detailedWeak.length) {
      return detailedWeak.slice(0, 5).map(w => ({
        id: w.id, label: w.label, accuracy: w.accuracy,
        trend: w.trend, action: w.suggestedAction, color: w.color || "var(--rose)",
      }));
    }
    if (weakSpots.length) {
      return weakSpots.slice(0, 5).map((w, i) => ({
        id: `ws-${i}`, label: w.domain, accuracy: w.accuracy,
        trend: w.trend, action: `Focus on ${w.domain}`,
        color: w.accuracy < 55 ? "var(--rose)" : w.accuracy < 65 ? "var(--amber)" : "var(--blue)",
      }));
    }
    return [];
  }, [detailedWeak, weakSpots]);

  const label = (p:number)=> p<55?"بحرانی":p<65?"ضعیف":"نیاز به تمرین";

  return (
    <GlassCard className="hs-panel-compact">
      <SectionHead icon={<Target size={18} style={{color:"var(--rose)"}}/>}
        eyebrow="WEAK DOMAIN"
        title="Weak Areas" sub={areas.length > 0 ? `${areas.length} نقطه ضعف شناسایی شده` : "بدون نقطه ضعف فعال"}/>
      {areas.length===0 ? (
        <div style={{textAlign:"center",padding:"24px 0",color:"var(--emerald)"}}>
          <Check size={32} style={{margin:"0 auto 10px"}}/>
          <div style={{fontWeight:600,fontSize:14}}>بدون نقطه ضعف</div>
          <div style={{fontSize:12,color:"var(--text-3)",marginTop:4}}>عالی! همه حوزه‌ها در وضعیت خوب هستند</div>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {areas.map((a,i)=>(
            <motion.div key={a.id}
              initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:i*0.07}}
              style={{padding:"12px 14px",borderRadius:12,
                background:`color-mix(in srgb, ${a.color} 8%, transparent)`,
                border:`1px solid color-mix(in srgb, ${a.color} 20%, transparent)`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:14,fontWeight:600,color:"var(--text-1)"}}>{a.label}</span>
                  <TrendArrow trend={a.trend}/>
                </div>
                <Chip label={label(a.accuracy)} color={a.color}/>
              </div>
              <ProgressBar pct={a.accuracy} color={a.color}/>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
                <span style={{fontSize:12,color:"var(--text-3)"}}>{a.action}</span>
                <span style={{fontSize:13,fontWeight:700,fontVariantNumeric:"tabular-nums",color:a.color}}>{a.accuracy}%</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

/* ══════════════════════════════════════════════════════
   FLASHCARD PULSE — SRS health widget (NEW)
══════════════════════════════════════════════════════ */

function FlashcardPulse() {
  const liveData = useLiveData();
  const fsrs = liveData?.fsrsStats;

  const retentionRate = fsrs?.retentionRate ?? 0;
  const dueToday = fsrs?.dueToday ?? liveData?.dueToday ?? 0;
  const dueThisWeek = fsrs?.dueThisWeek ?? 0;
  const reviewedToday = fsrs?.reviewedToday ?? 0;
  const overdue = fsrs?.overdue ?? 0;
  const matureCards = fsrs?.matureCards ?? 0;
  const learningCards = fsrs?.learningCards ?? 0;
  const newCards = fsrs?.newCards ?? 0;
  const totalCards = fsrs?.totalCards ?? liveData?.counts?.flashcards ?? 0;

  const healthColor = retentionRate >= 85 ? "var(--emerald)" : retentionRate >= 60 ? "var(--amber)" : "var(--rose)";
  const healthLabel = retentionRate >= 85 ? "عالی" : retentionRate >= 60 ? "متوسط" : "نیاز به مرور";

  const stats = [
    { label: "امروز باقی\u200Cمانده", value: dueToday, color: "var(--violet)" },
    { label: "این هفته", value: dueThisWeek, color: "var(--blue)" },
    { label: "مرور شده", value: reviewedToday, color: "var(--emerald)" },
    { label: "عقب\u200Cمانده", value: overdue, color: "var(--rose)" },
    { label: "بالغ", value: matureCards, color: "var(--cyan)" },
    { label: "در حال یادگیری", value: learningCards, color: "var(--amber)" },
    { label: "جدید", value: newCards, color: "var(--violet)" },
  ];

  return (
    <GlassCard className="hs-panel-compact">
      <SectionHead icon={<HeartPulse size={18} style={{color:healthColor}}/>}
        eyebrow="REVIEW LOAD"
        title="Flashcard Pulse" sub="سلامت بازیابی SRS"/>
      <div style={{display:"flex",alignItems:"center",gap:20,marginBottom:16}}>
        <Ring value={retentionRate} size={80} stroke={6} color={healthColor} glow>
          <span style={{fontSize:20,fontWeight:800,color:healthColor,fontVariantNumeric:"tabular-nums"}}>
            {Math.round(retentionRate)}%
          </span>
        </Ring>
        <div>
          <div style={{fontSize:14,fontWeight:700,color:"var(--text-1)",marginBottom:4}}>Retention Rate</div>
          <Chip label={healthLabel} color={healthColor}/>
          <div style={{fontSize:12,color:"var(--text-3)",marginTop:6}}>
            {totalCards} کارت کل
          </div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {stats.map(s=>(
          <div key={s.label} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
            padding:"8px 12px",borderRadius:10,background:"var(--bg-hover)"}}>
            <span style={{fontSize:12,color:"var(--text-2)"}}>{s.label}</span>
            <span style={{fontSize:14,fontWeight:700,fontVariantNumeric:"tabular-nums",color:s.color}}>
              {s.value}
            </span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

/* ══════════════════════════════════════════════════════
   TRAP PATTERNS
══════════════════════════════════════════════════════ */

function TrapPatterns() {
  const liveData = useLiveData();
  const liveTraps = useMemo(() => {
    const rows = liveData?.trapQuestions ?? [];
    return rows.map((row) => ({
      id: row.id, question: row.question, trapType: row.trapType, domain: row.domain,
      difficulty: row.difficulty, yourAnswer: row.yourAnswer, correctAnswer: row.correctAnswer,
      explanation: row.explanation, isHard: row.isHard, resolved: !!row.resolved,
    }));
  }, [liveData?.trapQuestions]);
  const [traps, setTraps] = useState(liveTraps);
  useEffect(() => { setTraps(liveTraps); }, [liveTraps]);
  const [filter, setFilter] = useState<"all"|"active"|"resolved">("all");
  const [expanded, setExpanded] = useState<string|null>(null);
  const toggle = (id:string) => setTraps(p=>p.map(t=>t.id===id?{...t,resolved:!t.resolved}:t));
  const filtered = traps.filter(t=> filter==="all"?true: filter==="active"?!t.resolved:!!t.resolved);

  const TRAP_COLORS: Record<string,string> = {
    distractor:"var(--rose)","partial-truth":"var(--amber)",
    "absolute-language":"var(--violet)",reversal:"var(--cyan)","look-alike":"var(--emerald)",
  };

  if (!traps.length) {
    return (
      <GlassCard className="hs-bento-wide hs-panel-list">
        <SectionHead icon={<AlertTriangle size={18} style={{color:"var(--amber)"}}/>}
          eyebrow="ERROR REVIEW"
          title="Trap Patterns" sub="الگوهای تله‌ای"/>
        <div style={{textAlign:"center",padding:"24px 0",color:"var(--text-3)"}}>
          <Award size={32} style={{opacity:0.3,margin:"0 auto 10px"}}/>
          <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>هنوز تله‌ای شناسایی نشده</div>
          <div style={{fontSize:12}}>با حل سؤالات بیشتر، الگوهای اشتباه شما تحلیل می‌شوند</div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard>
      <SectionHead icon={<AlertTriangle size={18} style={{color:"var(--amber)"}}/>}
        eyebrow="ERROR REVIEW"
        title="Trap Patterns" sub="الگوهای تله‌ای"/>
      <div style={{display:"flex",gap:6,marginBottom:14}}>
        {(["all","active","resolved"] as const).map(f=>(
          <button key={f} onClick={()=>setFilter(f)} className="hs-filter-btn"
            data-active={filter===f?"true":undefined}>
            {f==="all"?"همه":f==="active"?"فعال":"حل\u200Cشده"}
          </button>
        ))}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:340,overflowY:"auto"}}>
        {filtered.length === 0 && (
          <div style={{textAlign:"center",padding:"16px 0",color:"var(--text-3)",fontSize:13}}>
            {filter === "resolved" ? "هنوز تله\u200Cای حل نشده" : "بدون تله فعال"}
          </div>
        )}
        {filtered.map(trap=>{
          const trapColor = TRAP_COLORS[trap.trapType]||"var(--amber)";
          return (
            <motion.div key={trap.id} layout
              style={{borderRadius:12,padding:"12px 14px",cursor:"pointer",
                background:trap.resolved?"var(--bg-hover)":"var(--bg-surface)",
                border:`1px solid ${trap.resolved?"var(--border)":trapColor+"40"}`,transition:"all 0.2s"}}
              onClick={()=>setExpanded(e=>e===trap.id?null:trap.id)}
              whileHover={{x:3}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                <button onClick={e=>{e.stopPropagation();toggle(trap.id)}}
                  style={{width:22,height:22,borderRadius:"50%",flexShrink:0,marginTop:1,
                    border:`2px solid ${trap.resolved?"var(--emerald)":"var(--border-strong)"}`,
                    background:trap.resolved?"var(--emerald)":"transparent",
                    cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.18s"}}>
                  {trap.resolved&&<Check size={11} color="#fff" strokeWidth={3}/>}
                </button>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5,flexWrap:"wrap"}}>
                    <span style={{fontSize:13,fontWeight:600,color:"var(--text-1)",
                      textDecoration:trap.resolved?"line-through":"none",opacity:trap.resolved?0.5:1}}>
                      {trap.question.length>70?trap.question.slice(0,70)+"\u2026":trap.question}
                    </span>
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    <Chip label={trap.trapType} color={trapColor}/>
                    <Chip label={trap.domain} color="var(--blue)"/>
                    <Chip label={trap.difficulty} color={trap.difficulty==="Hard"?"var(--rose)":"var(--amber)"}/>
                  </div>
                </div>
                <motion.div animate={{rotate:expanded===trap.id?180:0}} transition={{duration:0.2}}>
                  <ChevronDown size={16} style={{color:"var(--text-3)"}}/>
                </motion.div>
              </div>
              <AnimatePresence>
                {expanded===trap.id && (
                  <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}}
                    exit={{height:0,opacity:0}} transition={{duration:0.2}} style={{overflow:"hidden"}}>
                    <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid var(--border)"}}>
                      <div style={{fontSize:13,color:"var(--rose)",marginBottom:5}}>
                        پاسخ شما: {trap.yourAnswer}
                      </div>
                      <div style={{fontSize:13,color:"var(--emerald)",marginBottom:8}}>
                        پاسخ صحیح: {trap.correctAnswer}
                      </div>
                      <div style={{fontSize:12,color:"var(--text-2)",lineHeight:1.6,
                        background:"var(--bg-hover)",padding:"10px 12px",borderRadius:10}}>
                        {trap.explanation}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </GlassCard>
  );
}

/* ══════════════════════════════════════════════════════
   ACTIVITY TIMELINE
══════════════════════════════════════════════════════ */

function ActivityTimeline() {
  const liveData = useLiveData();
  const feedItems = useMemo(() => buildActivityFeed(liveData), [liveData]);
  const toneVar: Record<string,string> = {
    blue:"var(--blue)",emerald:"var(--emerald)",rose:"var(--rose)",
    amber:"var(--amber)",violet:"var(--violet)",
  };

  return (
    <GlassCard className="hs-panel-list">
      <SectionHead icon={<Activity size={18} style={{color:"var(--blue)"}}/>}
        eyebrow="RECENT"
        title="Activity Timeline" sub="آخرین فعالیت‌ها"/>
      {feedItems.length === 0 ? (
        <div style={{textAlign:"center",padding:"24px 0",color:"var(--text-3)"}}>
          <Clock size={28} style={{opacity:0.3,margin:"0 auto 8px"}}/>
          <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>تایم‌لاین خالیه</div>
          <div style={{fontSize:12}}>مطالعه، آزمون یا مرور کارت‌ها اینجا ثبت می‌شوند</div>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column"}}>
          {feedItems.map((a,i)=>(
            <motion.div key={a.id} initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}}
              transition={{delay:i*0.06}}
              style={{display:"flex",alignItems:"flex-start",gap:12,padding:"10px 0",
                borderBottom: i<feedItems.length-1?"1px solid var(--border)":"none"}}>
              <div style={{width:32,height:32,borderRadius:10,flexShrink:0,display:"flex",
                alignItems:"center",justifyContent:"center",
                background:`color-mix(in srgb, ${toneVar[a.tone]||"var(--blue)"} 12%, transparent)`,
                color:toneVar[a.tone]||"var(--blue)"}}>
                {a.tone==="blue"?<BookOpen size={14}/>:a.tone==="emerald"?<Check size={14}/>:a.tone==="rose"?<AlertTriangle size={14}/>:a.tone==="amber"?<Flame size={14}/>:<GraduationCap size={14}/>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,color:"var(--text-1)",lineHeight:1.5}}>{a.text}</div>
                <div style={{fontSize:11,color:"var(--text-3)",marginTop:3}}>{a.time}</div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

/* ══════════════════════════════════════════════════════
   FEATURE HUB — Quick navigation from featureLinks
══════════════════════════════════════════════════════ */

function FeatureHub() {
  const router = useRouter();
  const liveData = useLiveData();
  const links = liveData?.featureLinks ?? [];

  if (!links.length) return null;

  return (
    <GlassCard className="hs-bento-wide hs-panel-hub">
      <SectionHead icon={<Zap size={18} style={{color:"var(--amber)"}}/>}
        eyebrow="SHORTCUTS"
        title="Feature Hub" sub="دسترسی سریع"/>
      <div className="hs-feature-grid">
        {links.map((link, i) => (
          <motion.button key={link.key}
            initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}}
            transition={{delay:i*0.04}}
            whileHover={{scale:1.05,y:-3}} whileTap={{scale:0.95}}
            onClick={()=>router.push(link.href)}
            className="hs-feature-card"
            style={{"--feat-accent": link.accent} as React.CSSProperties}>
            <div className="hs-feature-icon-wrap">
              {FEATURE_ICONS[link.key] || <Layers size={20}/>}
            </div>
            <div className="hs-feature-text">
              <span className="hs-feature-title">{link.title}</span>
              <span className="hs-feature-subtitle">{link.subtitle}</span>
            </div>
            {link.count != null && link.count > 0 && (
              <span className="hs-feature-badge">{link.count}</span>
            )}
          </motion.button>
        ))}
      </div>
    </GlassCard>
  );
}

/* ══════════════════════════════════════════════════════
   BASE CSS
══════════════════════════════════════════════════════ */

const BASE_CSS = `
*{box-sizing:border-box;margin:0;padding:0;}

.hs-root {
  min-height:100vh;
  font-family:var(--font-vazir,'Vazirmatn'),Tahoma,system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;
  -webkit-tap-highlight-color:transparent;
  transition:background 0.4s ease,color 0.4s ease;
  background:var(--bg-base);
  color:var(--text-1);
  position:relative;
  overflow-x:hidden;
  direction:rtl;
}

/* ── Mesh gradient — 2026 aurora effect ── */
.hs-mesh {
  position:fixed;inset:0;z-index:0;pointer-events:none;
  background:
    radial-gradient(ellipse 120% 80% at 0% 0%, color-mix(in srgb, var(--accent) 30%, transparent) 0%, transparent 55%),
    radial-gradient(ellipse 80% 100% at 100% 100%, color-mix(in srgb, var(--blue) 24%, transparent) 0%, transparent 55%),
    radial-gradient(ellipse 70% 60% at 60% 0%,  color-mix(in srgb, var(--emerald) 18%, transparent) 0%, transparent 48%),
    radial-gradient(ellipse 60% 80% at 15% 100%, color-mix(in srgb, var(--violet) 22%, transparent) 0%, transparent 48%),
    radial-gradient(circle 45% at 80% 30%, color-mix(in srgb, var(--cyan) 16%, transparent) 0%, transparent 42%),
    radial-gradient(circle 35% at 40% 55%, color-mix(in srgb, var(--amber) 10%, transparent) 0%, transparent 38%),
    radial-gradient(ellipse 50% 40% at 50% 50%, color-mix(in srgb, var(--accent-2) 6%, transparent) 0%, transparent 40%);
  animation:meshShift 20s ease-in-out infinite alternate;
}
@keyframes meshShift {
  0%   { filter:hue-rotate(0deg) brightness(1) saturate(1); }
  33%  { filter:hue-rotate(4deg) brightness(1.05) saturate(1.05); }
  66%  { filter:hue-rotate(-2deg) brightness(1.02) saturate(1.08); }
  100% { filter:hue-rotate(-4deg) brightness(1.04) saturate(1.03); }
}

/* ── Noise texture overlay for premium tactile feel ── */
.hs-noise {
  position:fixed;inset:0;z-index:0;pointer-events:none;
  opacity:0.025;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  background-repeat:repeat;
}

/* ── Hero — premium flagship bar with accent line ── */
.hs-hero {
  position:relative;z-index:1;
  padding:0;
}
.hs-hero::before {
  content:"";display:block;height:3px;
  background:linear-gradient(90deg, var(--accent), var(--accent-2), var(--blue), var(--accent));
  background-size:300% 100%;
  animation:heroAccentShift 8s ease-in-out infinite;
}
@keyframes heroAccentShift {
  0%,100% { background-position:0% 50%; }
  50% { background-position:100% 50%; }
}
.hs-hero-body {
  padding:24px 32px 20px;
  background:linear-gradient(145deg,
    color-mix(in srgb, var(--accent) 10%, var(--glass-bg)),
    var(--glass-bg) 35%,
    color-mix(in srgb, var(--blue) 8%, var(--glass-bg)) 70%,
    color-mix(in srgb, var(--accent-2) 4%, var(--glass-bg)));
  backdrop-filter:var(--glass-blur);
  border-bottom:1px solid color-mix(in srgb, var(--accent) 15%, var(--border));
  box-shadow:0 6px 40px color-mix(in srgb, var(--accent) 12%, transparent),
    inset 0 -1px 0 rgba(255,255,255,0.06);
}
.hs-hero-inner {
  max-width:1440px;margin:0 auto;
  display:flex;align-items:center;justify-content:space-between;
  flex-wrap:wrap;gap:24px;
}
.hs-hero-brand {
  display:flex;flex-direction:column;gap:6px;position:relative;
}
.hs-hero-greeting {
  font-size:26px;font-weight:900;color:var(--text-1);
  letter-spacing:-0.04em;line-height:1.2;
}
.hs-hero-date {
  display:flex;align-items:center;gap:5px;
  font-size:12px;color:var(--text-3);
  font-variant-numeric:tabular-nums;
}
.hs-theme-toggle {
  width:40px;height:40px;border-radius:12px;
  border:1.5px solid color-mix(in srgb, var(--accent) 22%, var(--border));
  background:color-mix(in srgb, var(--accent) 8%, var(--bg-hover));
  color:var(--text-2);cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  transition:all 0.3s cubic-bezier(.22,1,.36,1);flex-shrink:0;
  order:-1;
}
.hs-theme-toggle:hover {
  background:var(--accent);color:#fff;
  border-color:var(--accent);
  box-shadow:0 0 24px var(--accent-glow),0 4px 16px var(--accent-glow);
  transform:rotate(20deg) scale(1.1);
}

/* ── Hero ring zone — larger with glow aura ── */
.hs-hero-ring-zone {
  display:flex;flex-direction:column;align-items:center;
  position:relative;
}
.hs-hero-ring-zone::before {
  content:"";position:absolute;width:160px;height:160px;border-radius:50%;
  top:50%;left:50%;transform:translate(-50%,-55%);
  background:radial-gradient(circle, var(--accent-glow) 0%, transparent 70%);
  filter:blur(20px);pointer-events:none;opacity:0.6;
  animation:ringGlow 4s ease-in-out infinite alternate;
}
@keyframes ringGlow {
  0% { opacity:0.4;transform:translate(-50%,-55%) scale(0.9); }
  100% { opacity:0.7;transform:translate(-50%,-55%) scale(1.1); }
}

/* ── Mini stat grid (2x2) — stronger visual punch ── */
.hs-hero-mini-grid {
  display:grid;grid-template-columns:1fr 1fr;gap:10px;
}
.hs-mini-stat {
  display:flex;align-items:center;gap:10px;
  padding:12px 16px;border-radius:14px;
  background:var(--card-shine);
  border:1.5px solid color-mix(in srgb, var(--chip-color,var(--accent)) 28%, transparent);
  border-right:4px solid var(--chip-color,var(--accent));
  transition:all 0.3s cubic-bezier(.22,1,.36,1);
  cursor:default;user-select:none;min-width:140px;
  box-shadow:0 2px 10px color-mix(in srgb, var(--chip-color,var(--accent)) 10%, transparent),
    inset 0 1px 0 rgba(255,255,255,0.5);
  position:relative;overflow:hidden;
}
.hs-mini-stat::after {
  content:"";position:absolute;inset:0;
  background:linear-gradient(135deg, color-mix(in srgb, var(--chip-color,var(--accent)) 12%, transparent) 0%, transparent 60%);
  pointer-events:none;
}
.hs-mini-stat:hover {
  border-color:color-mix(in srgb, var(--chip-color,var(--accent)) 50%, transparent);
  box-shadow:0 6px 24px color-mix(in srgb, var(--chip-color,var(--accent)) 20%, transparent),
    inset 0 1px 0 rgba(255,255,255,0.5);
  transform:translateY(-2px);
}
.hs-mini-stat-icon {
  display:flex;align-items:center;flex-shrink:0;
  width:30px;height:30px;border-radius:8px;justify-content:center;
  background:color-mix(in srgb, var(--chip-color,var(--accent)) 15%, transparent);
}
.hs-mini-stat-body {
  display:flex;flex-direction:column;gap:2px;min-width:0;
}
.hs-mini-stat-label {
  font-size:10px;font-weight:700;color:var(--text-3);
  letter-spacing:0.06em;white-space:nowrap;line-height:1.3;
  text-transform:uppercase;
}
.hs-mini-stat-val {
  font-size:18px;font-weight:800;letter-spacing:-0.03em;
  font-variant-numeric:tabular-nums;line-height:1.1;white-space:nowrap;
}

/* ── XP bar — thicker with shimmer ── */
.hs-hero-xp {
  max-width:1440px;margin:14px auto 0;
  display:flex;align-items:center;gap:12px;
}
.hs-hero-xp-track {
  flex:1;height:6px;border-radius:99px;background:var(--border);overflow:hidden;
  box-shadow:inset 0 1px 2px rgba(0,0,0,0.08);
}
.hs-hero-xp-fill {
  height:100%;border-radius:99px;position:relative;overflow:hidden;
  background:linear-gradient(90deg, var(--emerald), var(--accent), var(--blue));
  box-shadow:0 0 16px color-mix(in srgb, var(--accent) 45%, transparent);
}
.hs-hero-xp-fill::after {
  content:"";position:absolute;inset:0;
  background:linear-gradient(90deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%);
  animation:xpShimmer 2.5s ease-in-out infinite;
}
@keyframes xpShimmer {
  0% { transform:translateX(-100%); }
  100% { transform:translateX(200%); }
}
.hs-hero-xp-label {
  font-size:11px;font-weight:700;color:var(--text-3);
  font-variant-numeric:tabular-nums;white-space:nowrap;letter-spacing:0.02em;
  direction:ltr;
}

/* ── Command Center — premium action strip ── */
.hs-command-center {
  position:relative;z-index:1;
  max-width:1440px;margin:0 auto;
  padding:20px 24px 0;
}
.hs-command-grid {
  display:grid;grid-template-columns:repeat(4,1fr);gap:16px;
}
.hs-command-card {
  background:var(--glass-bg);
  backdrop-filter:var(--glass-blur);
  border:1.5px solid var(--glass-border);
  border-radius:18px;
  padding:20px 22px;
  position:relative;overflow:hidden;
  transition:all 0.35s cubic-bezier(.22,1,.36,1);
  box-shadow:0 2px 6px rgba(0,0,0,0.04),0 4px 24px rgba(0,0,0,0.04);
}
/* Top accent line on each command card */
.hs-command-card::before {
  content:"";position:absolute;top:0;left:0;right:0;height:3px;
  background:linear-gradient(90deg, var(--cmd-color,var(--accent)), color-mix(in srgb, var(--cmd-color,var(--accent)) 50%, var(--blue)));
  opacity:0.7;transition:opacity 0.3s;
}
.hs-command-card:hover::before { opacity:1; }
.hs-command-card:hover {
  transform:translateY(-4px);
  box-shadow:0 12px 44px color-mix(in srgb, var(--cmd-color,var(--accent)) 15%, transparent),
    0 0 0 1.5px color-mix(in srgb, var(--cmd-color,var(--accent)) 35%, transparent);
  border-color:color-mix(in srgb, var(--cmd-color,var(--accent)) 40%, transparent);
}
.hs-command-card-top {
  display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;
}
.hs-command-icon {
  width:50px;height:50px;border-radius:14px;
  display:flex;align-items:center;justify-content:center;
  background:linear-gradient(135deg, var(--cmd-color,var(--accent)), color-mix(in srgb, var(--cmd-color,var(--accent)) 55%, var(--blue)));
  color:#fff;
  box-shadow:0 6px 20px color-mix(in srgb, var(--cmd-color,var(--accent)) 30%, transparent);
  transition:transform 0.3s,box-shadow 0.3s;
}
.hs-command-card:hover .hs-command-icon {
  transform:scale(1.08);
  box-shadow:0 8px 28px color-mix(in srgb, var(--cmd-color,var(--accent)) 40%, transparent);
}
.hs-command-badge {
  padding:3px 10px;border-radius:20px;font-size:12px;font-weight:800;
  background:var(--cmd-color,var(--accent));color:#fff;
  font-variant-numeric:tabular-nums;
  box-shadow:0 2px 8px color-mix(in srgb, var(--cmd-color,var(--accent)) 30%, transparent);
}
.hs-command-title {
  font-size:15px;font-weight:800;color:var(--text-1);margin-bottom:4px;
  letter-spacing:-0.01em;
}
.hs-command-sub {
  font-size:12px;color:var(--text-3);margin-bottom:14px;
  min-height:18px;
}
.hs-command-cta {
  display:inline-flex;align-items:center;justify-content:center;
  padding:9px 18px;min-height:38px;border-radius:11px;border:none;cursor:pointer;
  background:linear-gradient(135deg, color-mix(in srgb, var(--cmd-color,var(--accent)) 20%, transparent), color-mix(in srgb, var(--cmd-color,var(--accent)) 10%, transparent));
  color:var(--cmd-color,var(--accent));font-family:inherit;font-size:13px;font-weight:700;
  transition:all 0.25s;width:100%;
  border:1.5px solid color-mix(in srgb, var(--cmd-color,var(--accent)) 20%, transparent);
}
.hs-command-cta:hover {
  background:linear-gradient(135deg, var(--cmd-color,var(--accent)), color-mix(in srgb, var(--cmd-color,var(--accent)) 65%, var(--blue)));
  color:#fff;border-color:transparent;
  box-shadow:0 6px 20px color-mix(in srgb, var(--cmd-color,var(--accent)) 30%, transparent);
  transform:translateY(-1px);
}
/* Pulse animation for urgent items */
.hs-pulse::after {
  content:"";position:absolute;top:10px;left:10px;width:10px;height:10px;border-radius:50%;
  background:var(--cmd-color,var(--rose));
  box-shadow:0 0 0 0 var(--cmd-color,var(--rose));
  animation:hsPulse 2s ease-in-out infinite;
}
@keyframes hsPulse {
  0%,100% { opacity:1;box-shadow:0 0 0 0 color-mix(in srgb, var(--cmd-color,var(--rose)) 50%, transparent); }
  50% { opacity:0.7;box-shadow:0 0 0 10px transparent; }
}
[data-theme="light"] .hs-command-card {
  background:linear-gradient(155deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.62) 100%);
  border-color:rgba(255,255,255,0.7);
  box-shadow:0 2px 8px rgba(0,70,60,0.05),0 8px 32px rgba(0,70,60,0.06),inset 0 1px 0 rgba(255,255,255,0.95);
}
[data-theme="dark"] .hs-command-card {
  background:rgba(255,255,255,0.04);
  border-color:rgba(255,255,255,0.06);
  box-shadow:0 1px 3px rgba(0,0,0,0.18),0 6px 24px rgba(0,0,0,0.14),inset 0 1px 0 rgba(255,255,255,0.04);
}

/* ── Bento Grid ── */
.hs-bento {
  position:relative;z-index:1;
  display:grid;
  grid-template-columns:repeat(3,1fr);
  align-items:start;
  gap:18px;
  max-width:1440px;
  margin:0 auto;
  padding:24px 24px 56px;
}
.hs-bento-wide { grid-column:span 2; }

/* ── Glass Card — premium depth with accent top line ── */
.hs-glass {
  background:var(--glass-bg);
  backdrop-filter:var(--glass-blur);
  border:1.5px solid var(--glass-border);
  border-radius:22px;
  padding:24px 26px;
  position:relative;overflow:hidden;
  transition:all 0.4s cubic-bezier(.22,1,.36,1);
  box-shadow:var(--shadow);
}
/* Subtle top accent gradient line */
.hs-glass::before {
  content:"";position:absolute;top:0;left:10%;right:10%;height:2px;
  background:linear-gradient(90deg, transparent, var(--accent), transparent);
  opacity:0.3;transition:opacity 0.4s;
  border-radius:0 0 4px 4px;
}
.hs-glass:hover::before { opacity:0.7; }
.hs-glass:hover {
  transform:translateY(-4px) scale(1.003);
  box-shadow:var(--shadow-lg);
  border-color:color-mix(in srgb, var(--accent) 35%, transparent);
}
[data-theme="light"] .hs-glass {
  background:linear-gradient(155deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.60) 100%);
  border-color:rgba(255,255,255,0.75);
  box-shadow:
    0 2px 8px rgba(0,70,60,0.06),
    0 10px 40px rgba(0,70,60,0.08),
    inset 0 1px 0 rgba(255,255,255,0.98);
}
[data-theme="light"] .hs-glass:hover {
  box-shadow:
    0 16px 56px rgba(0,70,60,0.13),
    0 0 0 1.5px color-mix(in srgb, var(--accent) 35%, transparent),
    inset 0 1px 0 rgba(255,255,255,0.98);
}
[data-theme="dark"] .hs-glass {
  background:linear-gradient(155deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.025) 100%);
  border-color:rgba(80,210,190,0.10);
  box-shadow:
    0 2px 6px rgba(0,0,0,0.22),
    0 8px 28px rgba(0,0,0,0.18),
    inset 0 1px 0 rgba(255,255,255,0.06);
}
[data-theme="dark"] .hs-glass:hover {
  box-shadow:
    0 12px 48px rgba(0,0,0,0.30),
    0 0 0 1.5px color-mix(in srgb, var(--accent) 35%, transparent),
    inset 0 1px 0 rgba(255,255,255,0.07);
}

/* ── Section headers — bigger icons, gradient title ── */
.hs-section-head {
  display:flex;align-items:center;gap:14px;margin-bottom:20px;
}
.hs-section-icon {
  width:44px;height:44px;border-radius:13px;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;
  background:linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--blue) 35%, var(--accent)));
  color:#fff !important;
  border:none;
  box-shadow:0 6px 18px var(--accent-glow);
  transition:transform 0.3s,box-shadow 0.3s;
}
.hs-glass:hover .hs-section-icon {
  transform:scale(1.06);
  box-shadow:0 8px 24px var(--accent-glow);
}
.hs-section-title {
  font-size:16px;font-weight:900;letter-spacing:-0.02em;
  background:linear-gradient(135deg, var(--text-1) 60%, var(--accent));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
  background-clip:text;
}
.hs-section-sub { font-size:11px;color:var(--text-3);margin-top:2px;font-weight:600; }

/* ── Buttons (touch-friendly: min 44px) ── */
.hs-btn-primary {
  display:inline-flex;align-items:center;justify-content:center;gap:7px;
  padding:11px 22px;min-height:44px;border-radius:13px;border:none;cursor:pointer;
  background:linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--blue) 45%, var(--accent)));
  color:#fff;font-family:inherit;font-size:14px;font-weight:700;
  transition:all 0.3s cubic-bezier(.22,1,.36,1);
  box-shadow:0 4px 14px var(--accent-glow);
  position:relative;overflow:hidden;
}
.hs-btn-primary::after {
  content:"";position:absolute;inset:0;
  background:linear-gradient(90deg, transparent 30%, rgba(255,255,255,0.2) 50%, transparent 70%);
  transform:translateX(-100%);transition:transform 0.4s;
}
.hs-btn-primary:hover::after { transform:translateX(100%); }
.hs-btn-primary:hover { box-shadow:0 8px 28px var(--accent-glow);transform:translateY(-2px); }
.hs-btn-primary:active { transform:scale(0.97)translateY(0); }

.hs-btn-ghost {
  display:inline-flex;align-items:center;justify-content:center;gap:5px;
  padding:10px 16px;min-height:44px;border-radius:12px;cursor:pointer;
  background:var(--bg-hover);color:var(--text-2);border:1.5px solid var(--border);
  font-family:inherit;font-size:14px;font-weight:600;transition:all 0.25s;
}
.hs-btn-ghost:hover { background:var(--bg-surface);color:var(--text-1);border-color:var(--accent); }

.hs-touch-btn {
  min-width:38px;min-height:38px;border-radius:11px;border:1.5px solid var(--border);
  background:var(--bg-hover);color:var(--text-2);cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  transition:all 0.2s;font-size:14px;font-weight:700;font-family:inherit;
  padding:4px 8px;
}
.hs-touch-btn:hover { background:var(--bg-surface);color:var(--accent);border-color:var(--accent); }
.hs-touch-btn:disabled { opacity:0.3;cursor:default; }

/* ── Filter buttons ── */
.hs-filter-btn {
  padding:8px 16px;border-radius:11px;font-size:13px;font-weight:700;cursor:pointer;
  border:1.5px solid var(--border);background:var(--bg-hover);color:var(--text-2);transition:all 0.25s;
  font-family:inherit;min-height:38px;
}
.hs-filter-btn[data-active] {
  background:linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--blue) 35%, var(--accent)));
  color:#fff;border-color:transparent;
  box-shadow:0 4px 14px var(--accent-glow);
}

/* ── Smart Path card ── */
.hs-smart-card {
  padding:20px 22px;border-radius:16px;
  background:color-mix(in srgb, var(--card-accent,var(--accent)) 8%, transparent);
  border:1.5px solid color-mix(in srgb, var(--card-accent,var(--accent)) 22%, transparent);
  position:relative;overflow:hidden;
}
.hs-smart-card::before {
  content:"";position:absolute;top:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg, transparent, var(--card-accent,var(--accent)), transparent);
  opacity:0.5;
}
.hs-smart-alert {
  display:flex;align-items:center;gap:6px;margin-bottom:10px;
  color:var(--rose);font-size:11px;font-weight:800;letter-spacing:0.12em;
  text-transform:uppercase;
}

/* ── Feature Hub — refined cards ── */
.hs-feature-grid {
  display:grid;grid-template-columns:repeat(3,1fr);gap:12px;
}
.hs-feature-card {
  display:flex;align-items:center;gap:14px;
  padding:16px 18px;border-radius:16px;border:1.5px solid var(--border);cursor:pointer;
  background:var(--bg-hover);transition:all 0.3s cubic-bezier(.22,1,.36,1);
  font-family:inherit;min-height:64px;text-align:start;width:100%;
  position:relative;overflow:hidden;
}
.hs-feature-card::before {
  content:"";position:absolute;top:0;right:0;bottom:0;width:3px;
  background:var(--feat-accent,var(--accent));opacity:0.4;transition:opacity 0.3s;
}
.hs-feature-card:hover::before { opacity:1; }
.hs-feature-card:hover {
  background:var(--bg-surface);border-color:color-mix(in srgb, var(--feat-accent,var(--accent)) 40%, transparent);
  box-shadow:0 8px 28px color-mix(in srgb, var(--feat-accent,var(--accent)) 14%, transparent),
    0 0 0 1px color-mix(in srgb, var(--feat-accent,var(--accent)) 25%, transparent);
  transform:translateY(-2px);
}
.hs-feature-icon-wrap {
  width:44px;height:44px;border-radius:13px;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;
  background:color-mix(in srgb, var(--feat-accent,var(--accent)) 14%, var(--bg-surface));
  color:var(--feat-accent,var(--accent));transition:all 0.3s cubic-bezier(.22,1,.36,1);
  border:1.5px solid color-mix(in srgb, var(--feat-accent,var(--accent)) 25%, transparent);
}
.hs-feature-card:hover .hs-feature-icon-wrap {
  background:linear-gradient(135deg, var(--feat-accent,var(--accent)), color-mix(in srgb, var(--feat-accent,var(--accent)) 60%, var(--blue)));
  color:#fff;border-color:transparent;
  box-shadow:0 6px 20px color-mix(in srgb, var(--feat-accent,var(--accent)) 35%, transparent);
  transform:scale(1.1);
}
.hs-feature-text {
  display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;
}
.hs-feature-title {
  font-size:13px;font-weight:700;color:var(--text-1);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.hs-feature-subtitle {
  font-size:11px;color:var(--text-3);font-weight:500;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  direction:ltr;text-align:right;
}
.hs-feature-badge {
  padding:3px 10px;border-radius:20px;font-size:11px;font-weight:800;
  background:linear-gradient(135deg, var(--feat-accent,var(--accent)), color-mix(in srgb, var(--feat-accent,var(--accent)) 60%, var(--blue)));
  color:#fff;font-variant-numeric:tabular-nums;flex-shrink:0;
  box-shadow:0 2px 8px color-mix(in srgb, var(--feat-accent,var(--accent)) 25%, transparent);
}

/* ── Scrollbar ── */
::-webkit-scrollbar { width:5px; }
::-webkit-scrollbar-track { background:transparent; }
::-webkit-scrollbar-thumb { background:var(--border-strong);border-radius:99px; }
::-webkit-scrollbar-thumb:hover { background:var(--accent); }

/* ── Orbital decoration ── */
.hs-orbital {
  position:fixed;border-radius:50%;
  border:1.5px solid color-mix(in srgb, var(--accent) 14%, transparent);
  pointer-events:none;z-index:0;
  box-shadow:0 0 40px color-mix(in srgb, var(--accent) 5%, transparent);
}

/* ── Footer — premium gradient line ── */
.hs-footer {
  position:relative;z-index:1;
  padding:28px 24px;
  display:flex;align-items:center;justify-content:center;gap:12px;
  background:linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--accent) 4%, transparent) 100%);
}
.hs-footer::before {
  content:"";position:absolute;top:0;left:10%;right:10%;height:1px;
  background:linear-gradient(90deg, transparent, var(--accent), transparent);
  opacity:0.25;
}
.hs-footer-text {
  font-size:11px;font-weight:800;letter-spacing:0.15em;
  direction:ltr;
  background:linear-gradient(90deg, var(--text-3), var(--accent), var(--accent-2));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
  background-clip:text;
}

/* ── Keyframes ── */
@keyframes satFloat { 0%,100%{transform:translateY(0) rotate(0deg);} 50%{transform:translateY(-8px) rotate(4deg);} }
@keyframes orbitSpin { to { transform:rotate(360deg); } }

/* ══════ RESPONSIVE ══════ */

/* iPad landscape + small desktop */
@media(max-width:1200px){
  .hs-bento { grid-template-columns:repeat(2,1fr); }
  .hs-bento-wide { grid-column:span 2; }
  .hs-command-grid { grid-template-columns:repeat(2,1fr); }
  .hs-feature-grid { grid-template-columns:repeat(2,1fr); }
}

/* iPad portrait + tablet */
@media(max-width:900px){
  .hs-hero-inner { flex-direction:column;align-items:stretch; }
  .hs-hero-ring-zone { align-self:center;margin:8px 0; }
  .hs-hero-mini-grid { width:100%; }
  .hs-mini-stat { min-width:0; }
  .hs-mini-stat-val { font-size:15px; }
  .hs-command-grid { grid-template-columns:repeat(2,1fr); }
}

/* Mobile */
@media(max-width:640px){
  .hs-bento {
    grid-template-columns:1fr;
    gap:14px;padding:16px 16px 44px;
  }
  .hs-bento-wide { grid-column:span 1; }
  .hs-hero-body { padding:16px 18px 14px; }
  .hs-hero-greeting { font-size:20px; }
  .hs-hero-mini-grid { grid-template-columns:1fr 1fr; }
  .hs-mini-stat { padding:8px 12px;min-width:0; }
  .hs-mini-stat-val { font-size:14px; }
  .hs-glass { padding:20px 18px;border-radius:18px; }
  .hs-command-center { padding:14px 16px 0; }
  .hs-command-grid { grid-template-columns:1fr 1fr;gap:12px; }
  .hs-feature-grid { grid-template-columns:1fr 1fr; }
}

/* iPad 13" landscape optimization */
@media(min-width:1024px) and (max-width:1366px) and (min-height:700px){
  .hs-bento { gap:20px;padding:24px 28px 56px; }
  .hs-glass { padding:26px 28px; }
  .hs-hero-body { padding:20px 32px 16px; }
  .hs-hero-greeting { font-size:26px; }
}

/* ══════ 2027 ADDITIONS ══════ */

/* ── Hero contextual line ── */
.hs-hero-context {
  display:flex;align-items:center;gap:8px;
  font-size:13px;font-weight:700;margin-top:4px;
  letter-spacing:0.01em;
}
.hs-hero-context-dot {
  width:7px;height:7px;border-radius:50%;flex-shrink:0;
  background:currentColor;
  box-shadow:0 0 8px currentColor;
  animation:ctxPulse 2s ease-in-out infinite;
}
@keyframes ctxPulse {
  0%,100% { opacity:1;transform:scale(1); }
  50% { opacity:0.5;transform:scale(0.7); }
}

/* ── Smart Action Banner — animated conic border via @property ── */
@property --hs-border-angle {
  syntax:"<angle>";
  initial-value:0deg;
  inherits:false;
}
.hs-smart-banner {
  position:relative;z-index:1;
  max-width:1440px;margin:16px auto 0;padding:0 24px;
}
.hs-smart-banner-glow {
  position:absolute;inset:0 24px;border-radius:22px;
  background:radial-gradient(ellipse 80% 60% at 50% 100%, color-mix(in srgb, var(--banner-color) 22%, transparent), transparent);
  filter:blur(28px);pointer-events:none;
}
.hs-smart-banner-inner {
  display:flex;align-items:center;gap:20px;
  padding:22px 28px;border-radius:22px;
  position:relative;overflow:hidden;
  background:var(--glass-bg);backdrop-filter:var(--glass-blur);
  border:2px solid color-mix(in srgb, var(--banner-color) 30%, var(--glass-border));
  box-shadow:
    0 4px 28px color-mix(in srgb, var(--banner-color) 14%, transparent),
    inset 0 1px 0 rgba(255,255,255,0.06);
}
/* Animated conic gradient border */
.hs-smart-banner-inner::before {
  content:"";position:absolute;inset:-2px;border-radius:24px;padding:2px;
  background:conic-gradient(from var(--hs-border-angle),
    color-mix(in srgb, var(--banner-color) 60%, transparent),
    transparent 25%,
    color-mix(in srgb, var(--banner-color) 40%, transparent) 50%,
    transparent 75%,
    color-mix(in srgb, var(--banner-color) 60%, transparent));
  -webkit-mask:linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask:linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite:xor;mask-composite:exclude;
  animation:hsBorderSpin 6s linear infinite;
}
@keyframes hsBorderSpin { to { --hs-border-angle:360deg; } }
.hs-smart-banner-icon {
  width:52px;height:52px;border-radius:16px;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;
  background:linear-gradient(135deg, var(--banner-color), color-mix(in srgb, var(--banner-color) 55%, var(--blue)));
  color:#fff;
  box-shadow:0 6px 24px color-mix(in srgb, var(--banner-color) 35%, transparent);
}
.hs-smart-banner-title {
  font-size:17px;font-weight:800;color:var(--text-1);
  letter-spacing:-0.02em;margin-bottom:3px;text-wrap:balance;
}
.hs-smart-banner-sub {
  font-size:13px;color:var(--text-3);font-weight:500;
}
.hs-smart-banner-cta {
  display:inline-flex;align-items:center;gap:7px;
  padding:12px 24px;min-height:48px;border-radius:14px;
  border:none;cursor:pointer;white-space:nowrap;flex-shrink:0;
  background:linear-gradient(135deg, var(--banner-color), color-mix(in srgb, var(--banner-color) 55%, var(--blue)));
  color:#fff;font-family:inherit;font-size:14px;font-weight:700;
  transition:all 0.3s cubic-bezier(.22,1,.36,1);
  box-shadow:0 4px 20px color-mix(in srgb, var(--banner-color) 35%, transparent);
  position:relative;overflow:hidden;
}
.hs-smart-banner-cta::after {
  content:"";position:absolute;inset:0;
  background:linear-gradient(90deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%);
  transform:translateX(-100%);transition:transform 0.4s;
}
.hs-smart-banner-cta:hover::after { transform:translateX(100%); }
.hs-smart-banner-cta:hover {
  transform:translateY(-2px) scale(1.03);
  box-shadow:0 8px 32px color-mix(in srgb, var(--banner-color) 45%, transparent);
}
.hs-smart-banner-cta:active { transform:scale(0.97); }

/* Light / dark variants */
[data-theme="light"] .hs-smart-banner-inner {
  background:linear-gradient(155deg, rgba(255,255,255,0.90), rgba(255,255,255,0.65));
  border-color:rgba(255,255,255,0.75);
  box-shadow:0 4px 28px color-mix(in srgb, var(--banner-color) 10%, transparent),
    inset 0 1px 0 rgba(255,255,255,0.98);
}
[data-theme="dark"] .hs-smart-banner-inner {
  background:linear-gradient(155deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025));
  border-color:color-mix(in srgb, var(--banner-color) 20%, rgba(80,210,190,0.10));
  box-shadow:0 4px 28px color-mix(in srgb, var(--banner-color) 12%, rgba(0,0,0,0.2)),
    inset 0 1px 0 rgba(255,255,255,0.06);
}

/* ── Exam Countdown Bar ── */
.hs-exam-bar {
  position:relative;z-index:1;
  max-width:1440px;margin:12px auto 0;padding:0 24px;
}
.hs-exam-bar-inner {
  display:flex;align-items:center;gap:14px;
  padding:14px 22px;border-radius:14px;
  background:color-mix(in srgb, var(--exam-color) 8%, var(--glass-bg));
  backdrop-filter:var(--glass-blur);
  border:1.5px solid color-mix(in srgb, var(--exam-color) 25%, var(--glass-border));
  box-shadow:0 2px 12px color-mix(in srgb, var(--exam-color) 10%, transparent);
}
.hs-exam-bar-label {
  font-size:14px;font-weight:800;color:var(--text-1);
  white-space:nowrap;letter-spacing:-0.01em;
}
.hs-exam-bar-track {
  flex:1;height:6px;border-radius:99px;
  background:var(--border);overflow:hidden;min-width:80px;
}
.hs-exam-bar-fill {
  height:100%;border-radius:99px;
  box-shadow:0 0 12px color-mix(in srgb, var(--exam-color) 40%, transparent);
}
.hs-exam-bar-readiness {
  font-size:12px;font-weight:700;white-space:nowrap;
  font-variant-numeric:tabular-nums;
}

/* ── 2027: text-wrap balance on key headings ── */
.hs-hero-greeting,.hs-smart-banner-title,.hs-section-title { text-wrap:balance; }

/* ── 2027: Scroll-driven fade for bento cards ── */
@supports (animation-timeline:view()) {
  .hs-bento > * {
    animation:hsScrollReveal 0.5s ease both;
    animation-timeline:view();
    animation-range:entry 0% entry 25%;
  }
  @keyframes hsScrollReveal {
    from { opacity:0.15;transform:translateY(24px) scale(0.98); }
    to   { opacity:1;transform:translateY(0) scale(1); }
  }
}

/* ── Responsive: smart banner + exam bar ── */
@media(max-width:640px){
  .hs-smart-banner { padding:0 16px;margin-top:12px; }
  .hs-smart-banner-inner { flex-wrap:wrap;padding:18px 20px;gap:14px; }
  .hs-smart-banner-cta { width:100%;justify-content:center; }
  .hs-smart-banner-title { font-size:15px; }
  .hs-exam-bar { padding:0 16px;margin-top:8px; }
  .hs-exam-bar-inner { flex-wrap:wrap;gap:10px;padding:12px 16px; }
  .hs-exam-bar-track { width:100%;order:10; }
}

/* ══════════════════════════════════════════════════════
   POLISH LAYER v2 — mission-control finish
   - crisp surfaces (no glass haze)
   - compact operational hero
   - systematic card grammar (top-aligned, calibrated)
   - bilingual eyebrow + tighter typography
   - calmer decorative layers
   - product-grade mini calendar
   All rules below override the baseline at equal/higher
   specificity; the baseline is kept intact above.
══════════════════════════════════════════════════════ */

/* 0. Re-assert border tokens as full hsl() colors.
      The global .theme-clinical class (Tailwind-style) redefines
      --border / --border-strong as raw "H S% L%" triples, which are
      not valid <color> values and invalidate any border/background
      shorthand that references them. Override back to full colors,
      scoped to .hs-root so specificity matches .theme-clinical. */
[data-theme="light"].hs-root {
  --border: hsl(168 14% 88%);
  --border-strong: hsl(168 12% 76%);
}
[data-theme="dark"].hs-root {
  --border: hsl(190 14% 16%);
  --border-strong: hsl(190 10% 26%);
}

/* 1. Fade the ambient decorative layers instead of removing them.
      Keeps a subtle signature without the "concept shot" feel. */
.hs-mesh { opacity: 0.18; animation: none !important; filter: none !important; }
.hs-noise { opacity: 0.012; }
.hs-orbital { opacity: 0.45; box-shadow: none !important; }

/* 2. Hero — compact, confident, mission-control */
.hs-hero::before {
  height: 2px;
  background: var(--accent);
  animation: none;
}
[data-theme="light"] .hs-hero-body,
[data-theme="dark"] .hs-hero-body {
  padding: 18px 32px 14px;
  background: var(--bg-surface);
  backdrop-filter: none;
  border-bottom: 1px solid var(--border);
  box-shadow: none;
}
.hs-hero-greeting {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--text-1);
}
.hs-hero-context {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.01em;
}
.hs-hero-date { font-size: 12px; color: var(--text-3); font-weight: 600; }
.hs-hero-ring-zone::before { display: none; }

/* 3. Mini stat chips — operational, top-aligned, single accent edge */
.hs-mini-stat {
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-right: 3px solid var(--chip-color, var(--accent));
  box-shadow: none;
  min-width: 130px;
}
.hs-mini-stat::after { display: none; }
.hs-mini-stat:hover {
  background: var(--bg-panel);
  border-color: var(--border-strong);
  border-right-color: var(--chip-color, var(--accent));
  box-shadow: 0 2px 8px rgba(12,30,24,0.05);
  transform: translateY(-1px);
}
.hs-mini-stat-label { color: var(--text-3); font-weight: 700; font-size: 10px; letter-spacing: 0.08em; }
.hs-mini-stat-val { color: var(--text-1); font-weight: 800; font-size: 17px; }
.hs-mini-stat-icon {
  width: 28px; height: 28px; border-radius: 8px;
  background: color-mix(in srgb, var(--chip-color, var(--accent)) 12%, transparent);
  color: var(--chip-color, var(--accent));
}

/* 4. XP bar — solid, no shimmer */
.hs-hero-xp { margin-top: 10px; }
.hs-hero-xp-track { height: 5px; background: var(--border); box-shadow: none; }
.hs-hero-xp-fill { background: var(--accent); box-shadow: none; }
.hs-hero-xp-fill::after { display: none; }
.hs-hero-xp-label { color: var(--text-3); font-weight: 700; }

/* 5. Theme toggle — calm, no rotation */
.hs-theme-toggle {
  width: 36px; height: 36px; border-radius: 10px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  color: var(--text-2);
}
.hs-theme-toggle:hover {
  background: var(--accent);
  color: #fff; border-color: var(--accent);
  box-shadow: 0 2px 10px color-mix(in srgb, var(--accent) 25%, transparent);
  transform: none;
}

/* 6. Card grammar — systematic, crisp, clinical */
.hs-glass,
[data-theme="light"] .hs-glass,
[data-theme="dark"] .hs-glass {
  background: var(--bg-surface);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 20px 22px;
  box-shadow: var(--shadow);
}
.hs-glass::before { display: none; }
.hs-glass:hover,
[data-theme="light"] .hs-glass:hover,
[data-theme="dark"] .hs-glass:hover {
  transform: translateY(-2px) scale(1);
  box-shadow: var(--shadow-lg);
  border-color: var(--border-strong);
}

/* 7. Command cards — same grammar as bento, with restrained accent rule */
.hs-command-card,
[data-theme="light"] .hs-command-card,
[data-theme="dark"] .hs-command-card {
  background: var(--bg-surface);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 16px 18px;
  box-shadow: var(--shadow);
}
.hs-command-card::before {
  height: 2px;
  background: var(--cmd-color, var(--accent));
  opacity: 1;
}
.hs-command-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--cmd-color, var(--accent)) 30%, var(--border-strong));
  box-shadow: var(--shadow-lg);
}
.hs-command-icon {
  width: 40px; height: 40px; border-radius: 11px;
  background: color-mix(in srgb, var(--cmd-color, var(--accent)) 12%, var(--bg-panel));
  color: var(--cmd-color, var(--accent));
  box-shadow: none;
}
.hs-command-card:hover .hs-command-icon {
  background: var(--cmd-color, var(--accent));
  color: #fff; transform: none;
  box-shadow: 0 3px 12px color-mix(in srgb, var(--cmd-color, var(--accent)) 28%, transparent);
}
.hs-command-title { font-size: 14px; font-weight: 800; color: var(--text-1); }
.hs-command-sub { font-size: 12px; color: var(--text-3); font-weight: 500; margin-bottom: 12px; }
.hs-command-cta {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  color: var(--text-1);
  font-weight: 700; border-radius: 10px; min-height: 36px;
  padding: 8px 16px;
}
.hs-command-cta:hover {
  background: var(--cmd-color, var(--accent));
  color: #fff; border-color: transparent;
  box-shadow: 0 3px 10px color-mix(in srgb, var(--cmd-color, var(--accent)) 25%, transparent);
  transform: none;
}
.hs-command-badge {
  background: color-mix(in srgb, var(--cmd-color, var(--accent)) 14%, var(--bg-panel));
  color: var(--cmd-color, var(--accent));
  border-radius: 8px; padding: 2px 9px; font-size: 11px;
  box-shadow: none;
}

/* 8. Section headers — bilingual hierarchy
      eyebrow (uppercase EN clinical label) + title + Persian sub */
.hs-section-head { margin-bottom: 16px; gap: 12px; align-items: flex-start; }
.hs-section-icon {
  width: 36px; height: 36px; border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 12%, var(--bg-panel));
  color: var(--accent) !important;
  border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--border));
  box-shadow: none;
  margin-top: 2px;
}
.hs-glass:hover .hs-section-icon {
  background: var(--accent);
  color: #fff !important;
  border-color: transparent;
  transform: none;
  box-shadow: 0 3px 10px color-mix(in srgb, var(--accent) 25%, transparent);
}
.hs-section-eyebrow {
  font-size: 10px;
  font-weight: 800;
  color: var(--accent);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  direction: ltr;
  text-align: start;
  margin-bottom: 2px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.hs-section-title {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.015em;
  background: none;
  -webkit-text-fill-color: var(--text-1);
  color: var(--text-1);
  line-height: 1.25;
}
.hs-section-sub {
  font-size: 12px;
  color: var(--text-3);
  font-weight: 500;
  margin-top: 2px;
}

/* 9. Buttons — compact, serious, product-grade */
.hs-btn-primary {
  background: var(--accent);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--accent) 24%, transparent);
  border-radius: 10px;
  min-height: 40px;
  padding: 10px 18px;
  font-size: 13px;
  letter-spacing: -0.005em;
}
.hs-btn-primary::after { display: none; }
.hs-btn-primary:hover {
  background: color-mix(in srgb, var(--accent) 88%, #000);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--accent) 30%, transparent);
  transform: translateY(-1px);
}
.hs-btn-ghost {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  color: var(--text-2);
  border-radius: 10px;
  min-height: 40px;
}
.hs-btn-ghost:hover {
  background: var(--bg-panel);
  color: var(--text-1);
  border-color: var(--border-strong);
}
.hs-touch-btn {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 9px;
  min-width: 34px; min-height: 34px;
}
.hs-touch-btn:hover {
  background: var(--bg-panel);
  color: var(--accent); border-color: var(--accent);
}

/* 10. Filter pills — calibrated with the button system */
.hs-filter-btn {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  color: var(--text-2);
  border-radius: 9px;
  min-height: 32px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 700;
}
.hs-filter-btn:hover {
  background: var(--bg-panel);
  color: var(--text-1); border-color: var(--border-strong);
}
.hs-filter-btn[data-active] {
  background: var(--accent);
  color: #fff; border-color: var(--accent);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--accent) 22%, transparent);
}

/* 11. Feature Hub — unified card grammar */
.hs-feature-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px 14px;
}
.hs-feature-card::before {
  width: 2px;
  background: var(--feat-accent, var(--accent));
  opacity: 1;
}
.hs-feature-card:hover {
  background: var(--bg-panel);
  border-color: color-mix(in srgb, var(--feat-accent, var(--accent)) 30%, var(--border-strong));
  box-shadow: var(--shadow);
  transform: translateY(-1px);
}
.hs-feature-icon-wrap {
  width: 36px; height: 36px; border-radius: 10px;
  background: color-mix(in srgb, var(--feat-accent, var(--accent)) 12%, var(--bg-panel));
  border: 1px solid color-mix(in srgb, var(--feat-accent, var(--accent)) 20%, var(--border));
  color: var(--feat-accent, var(--accent));
}
.hs-feature-card:hover .hs-feature-icon-wrap {
  background: var(--feat-accent, var(--accent));
  color: #fff; border-color: transparent;
  transform: none;
  box-shadow: 0 3px 10px color-mix(in srgb, var(--feat-accent, var(--accent)) 22%, transparent);
}
.hs-feature-title { color: var(--text-1); font-weight: 700; font-size: 13px; }
.hs-feature-subtitle { color: var(--text-3); font-weight: 500; }
.hs-feature-badge {
  background: color-mix(in srgb, var(--feat-accent, var(--accent)) 14%, var(--bg-panel));
  color: var(--feat-accent, var(--accent));
  border-radius: 8px; padding: 2px 8px; font-size: 10px;
  box-shadow: none;
}

/* 12. Smart Action Banner — calm real surface, no spinning border */
.hs-smart-banner-glow { display: none; }
.hs-smart-banner-inner,
[data-theme="light"] .hs-smart-banner-inner,
[data-theme="dark"] .hs-smart-banner-inner {
  background: var(--bg-surface);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border: 1px solid color-mix(in srgb, var(--banner-color) 28%, var(--border));
  border-radius: 16px;
  padding: 16px 20px;
  box-shadow: var(--shadow);
}
.hs-smart-banner-inner::before { display: none; }
.hs-smart-banner-icon {
  width: 42px; height: 42px; border-radius: 12px;
  background: var(--banner-color);
  box-shadow: 0 3px 12px color-mix(in srgb, var(--banner-color) 28%, transparent);
}
.hs-smart-banner-title { font-size: 15px; font-weight: 800; color: var(--text-1); }
.hs-smart-banner-sub { font-size: 12px; color: var(--text-3); }
.hs-smart-banner-cta {
  background: var(--banner-color);
  padding: 10px 20px;
  min-height: 40px; border-radius: 10px;
  box-shadow: 0 2px 10px color-mix(in srgb, var(--banner-color) 24%, transparent);
  font-size: 13px;
}
.hs-smart-banner-cta::after { display: none; }
.hs-smart-banner-cta:hover {
  transform: translateY(-1px) scale(1);
  box-shadow: 0 4px 16px color-mix(in srgb, var(--banner-color) 34%, transparent);
}

/* 13. Exam countdown bar — consistent surface */
.hs-exam-bar-inner {
  background: var(--bg-surface);
  backdrop-filter: none;
  border: 1px solid color-mix(in srgb, var(--exam-color) 25%, var(--border));
  border-radius: 12px;
  box-shadow: none;
}
.hs-exam-bar-label { color: var(--text-1); font-size: 13px; font-weight: 800; }
.hs-exam-bar-fill { box-shadow: none; }

/* 14. Smart Path recommendation cards */
.hs-smart-card {
  background: var(--bg-panel);
  border: 1px solid color-mix(in srgb, var(--card-accent, var(--accent)) 22%, var(--border));
  border-radius: 12px;
  padding: 14px 16px;
}
.hs-smart-card::before {
  background: var(--card-accent, var(--accent));
  opacity: 1; height: 2px;
}

/* 15. Footer — flat, clean, subdued */
.hs-footer { background: none; padding: 20px 24px; }
.hs-footer::before {
  background: var(--border);
  opacity: 1; left: 20%; right: 20%;
}
.hs-footer-text {
  background: none;
  -webkit-text-fill-color: var(--text-3);
  color: var(--text-3);
  font-weight: 700;
  letter-spacing: 0.2em;
}

/* 16. Bento grid — slightly tighter rhythm */
.hs-bento { padding: 20px 24px 48px; gap: 16px; }

/* 17. Scrollbar — thinner, product-grade */
.hs-root ::-webkit-scrollbar { width: 6px; height: 6px; }
.hs-root ::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 99px; }
.hs-root ::-webkit-scrollbar-thumb:hover { background: var(--accent); }

/* 18. Mini calendar — product-grade polish
      Scoped via .hs-cal-* classes added in JSX below. */
.hs-cal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
  gap: 12px;
}
.hs-cal-head-titles { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.hs-cal-eyebrow {
  font-size: 10px; font-weight: 800;
  color: var(--accent);
  letter-spacing: 0.14em; text-transform: uppercase;
  direction: ltr; text-align: start;
  line-height: 1;
}
.hs-cal-month {
  font-size: 15px; font-weight: 800; color: var(--text-1);
  letter-spacing: -0.015em; line-height: 1.2;
}
.hs-cal-meta {
  font-size: 11px; color: var(--text-3); font-weight: 600;
}
.hs-cal-nav {
  display: flex; gap: 4px; flex-shrink: 0;
}
.hs-cal-weekrow {
  display: grid; grid-template-columns: repeat(7, 1fr);
  gap: 4px; margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
.hs-cal-weekday {
  text-align: center;
  font-size: 10px;
  font-weight: 800;
  color: var(--text-3);
  letter-spacing: 0.04em;
  padding: 4px 0;
}
.hs-cal-weekday[data-weekend] { color: var(--rose); }
.hs-cal-grid {
  display: grid; grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}
.hs-cal-cell {
  aspect-ratio: 1;
  border-radius: 9px;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  min-height: 34px;
  transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease;
  position: relative;
  font-variant-numeric: tabular-nums;
}
.hs-cal-cell[data-out] { opacity: 0.3; }
.hs-cal-cell[data-current]:hover {
  background: var(--bg-panel);
  border-color: var(--border-strong);
  cursor: pointer;
}
.hs-cal-cell[data-today] {
  background: var(--accent) !important;
  border-color: var(--accent) !important;
  box-shadow: 0 2px 10px color-mix(in srgb, var(--accent) 28%, transparent);
}
.hs-cal-cell[data-today] .hs-cal-day-num { color: #fff; font-weight: 800; }
.hs-cal-cell[data-today] .hs-cal-day-dot { background: #fff; }
.hs-cal-day-num { font-size: 12px; font-weight: 600; color: var(--text-2); line-height: 1; }
.hs-cal-day-dot {
  width: 4px; height: 4px; border-radius: 50%;
  background: var(--accent);
  margin-top: 3px;
}
.hs-cal-legend {
  display: flex; align-items: center; gap: 6px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  font-size: 10px; color: var(--text-3);
  font-weight: 600;
  letter-spacing: 0.02em;
}
.hs-cal-legend-swatches { display: flex; gap: 3px; }
.hs-cal-legend-swatch {
  width: 12px; height: 12px; border-radius: 3px;
  border: 1px solid var(--border);
}
.hs-cal-legend-meta {
  margin-inline-start: auto;
  direction: ltr;
  font-variant-numeric: tabular-nums;
  color: var(--text-3);
  font-weight: 700;
}
/* ══════════════════════════════════════════════════════
   STRUCTURAL LAYER v4 — real product surface
══════════════════════════════════════════════════════ */

.hs-root {
  background: linear-gradient(
    180deg,
    var(--bg-base) 0%,
    color-mix(in srgb, var(--bg-base) 90%, var(--bg-surface)) 100%
  );
}

/* top strip */
.hs-top-strip-wrap {
  position: relative;
  z-index: 1;
  max-width: 1440px;
  margin: 0 auto;
  padding: 18px 24px 0;
}

.hs-top-strip {
  position: relative;
  display: grid;
  grid-template-columns: minmax(260px, 1.05fr) minmax(420px, 1.55fr) auto;
  gap: 16px;
  align-items: stretch;
  padding: 18px 20px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--bg-surface);
  box-shadow: var(--shadow);
}

.hs-top-strip::before {
  content: "";
  position: absolute;
  top: 0;
  inset-inline: 20px;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  opacity: 0.9;
}

.hs-top-strip-intro {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  min-width: 0;
}

.hs-top-strip-eyebrow {
  font-size: 10px;
  font-weight: 800;
  color: var(--accent);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  direction: ltr;
  line-height: 1;
}

.hs-top-strip-title {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--text-1);
  line-height: 1.15;
}

.hs-top-strip-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.hs-inline-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-3);
  font-weight: 600;
}

.hs-inline-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  background: color-mix(in srgb, var(--badge-tone, var(--accent)) 12%, var(--bg-panel));
  color: var(--badge-tone, var(--accent));
  border: 1px solid color-mix(in srgb, var(--badge-tone, var(--accent)) 20%, var(--border));
}

.hs-top-strip-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  align-items: stretch;
}

.hs-summary-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 78px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  box-shadow: none;
}

.hs-summary-chip-icon {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: color-mix(in srgb, var(--chip-tone, var(--accent)) 12%, transparent);
  color: var(--chip-tone, var(--accent));
}

.hs-summary-chip-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hs-summary-chip-eyebrow {
  font-size: 10px;
  font-weight: 800;
  color: var(--text-3);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  direction: ltr;
  line-height: 1;
}

.hs-summary-chip-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.hs-summary-chip-value {
  font-size: 20px;
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.hs-summary-chip-meta {
  font-size: 12px;
  color: var(--text-3);
  font-weight: 600;
}

.hs-top-strip-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 180px;
  justify-content: center;
}

.hs-top-strip-actions-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.hs-top-strip-actions .hs-btn-primary,
.hs-top-strip-actions .hs-btn-ghost {
  width: 100%;
}

.hs-top-strip-actions .hs-theme-toggle {
  width: 40px;
  min-width: 40px;
  height: 40px;
  flex-shrink: 0;
}

/* operational action tiles */
.hs-op-zone {
  position: relative;
  z-index: 1;
  max-width: 1440px;
  margin: 0 auto;
  padding: 14px 24px 0;
}

.hs-op-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.hs-op-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 148px;
  padding: 14px 16px 16px;
  border-radius: 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.hs-op-card::before {
  content: "";
  position: absolute;
  inset-inline-start: 0;
  top: 14px;
  bottom: 14px;
  width: 3px;
  border-radius: 999px;
  background: var(--op-tone, var(--accent));
}

.hs-op-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-inline-start: 12px;
}

.hs-op-eyebrow {
  font-size: 10px;
  font-weight: 800;
  color: var(--text-3);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  direction: ltr;
  line-height: 1;
}

.hs-op-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--op-tone, var(--accent)) 12%, transparent);
  color: var(--op-tone, var(--accent));
  flex-shrink: 0;
}

.hs-op-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-inline-start: 12px;
}

.hs-op-title {
  font-size: 14px;
  font-weight: 800;
  color: var(--text-1);
  line-height: 1.35;
}

.hs-op-value {
  font-size: 18px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.hs-op-sub {
  padding-inline-start: 12px;
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.55;
  min-height: 38px;
}

.hs-op-cta {
  margin-top: auto;
  margin-inline-start: 12px;
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 7px 12px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: var(--bg-panel);
  color: var(--text-1);
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.hs-op-cta:hover {
  border-color: color-mix(in srgb, var(--op-tone, var(--accent)) 28%, var(--border));
  background: color-mix(in srgb, var(--op-tone, var(--accent)) 10%, var(--bg-panel));
  color: var(--op-tone, var(--accent));
}

/* new grid behavior */
.hs-bento.hs-bento-v4 {
  grid-template-columns: 1.18fr 1.18fr 0.92fr;
  gap: 16px;
  align-items: start;
  padding-top: 18px;
}

.hs-bento.hs-bento-v4 > .hs-bento-wide {
  grid-column: span 2;
}

.hs-panel-insight {
  min-height: 332px;
}

.hs-panel-calendar {
  min-height: 332px;
}

.hs-panel-compact {
  min-height: 284px;
}

.hs-panel-priority {
  min-height: 292px;
}

.hs-panel-list {
  min-height: 284px;
}

.hs-panel-hub {
  min-height: 180px;
}

/* calmer panel internals */
.hs-panel-insight .hs-section-head,
.hs-panel-calendar .hs-section-head,
.hs-panel-compact .hs-section-head,
.hs-panel-priority .hs-section-head,
.hs-panel-list .hs-section-head,
.hs-panel-hub .hs-section-head {
  margin-bottom: 14px;
}

.hs-panel-insight .hs-section-title,
.hs-panel-calendar .hs-section-title,
.hs-panel-compact .hs-section-title,
.hs-panel-priority .hs-section-title,
.hs-panel-list .hs-section-title,
.hs-panel-hub .hs-section-title {
  font-size: 15px;
}

/* make chart areas feel denser */
.hs-panel-insight .recharts-responsive-container,
.hs-panel-calendar .recharts-responsive-container {
  margin-top: 2px;
}

/* tighter footer */
.hs-footer {
  padding-top: 12px;
}

/* responsive */
@media (max-width: 1200px) {
  .hs-top-strip {
    grid-template-columns: 1fr;
  }

  .hs-top-strip-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .hs-top-strip-actions {
    min-width: 0;
  }

  .hs-op-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .hs-bento.hs-bento-v4 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .hs-bento.hs-bento-v4 > .hs-bento-wide {
    grid-column: span 2;
  }
}

@media (max-width: 640px) {
  .hs-top-strip-wrap,
  .hs-op-zone {
    padding-inline: 16px;
  }

  .hs-top-strip {
    padding: 16px;
    gap: 14px;
  }

  .hs-top-strip-title {
    font-size: 20px;
  }

  .hs-top-strip-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .hs-summary-chip {
    min-height: 70px;
    padding: 10px 12px;
  }

  .hs-summary-chip-value {
    font-size: 18px;
  }

  .hs-top-strip-actions-row {
    display: grid;
    grid-template-columns: 1fr auto;
  }

  .hs-op-grid {
    grid-template-columns: 1fr;
  }

  .hs-bento.hs-bento-v4 {
    grid-template-columns: 1fr;
    padding: 16px 16px 40px;
  }

  .hs-bento.hs-bento-v4 > .hs-bento-wide {
    grid-column: span 1;
  }

  .hs-panel-insight,
  .hs-panel-calendar,
  .hs-panel-compact,
  .hs-panel-priority,
  .hs-panel-list,
  .hs-panel-hub {
    min-height: auto;
  }
}

/* ════════════════════════════════════════════════════════════════════
   PREMIUM POLISH v5.2 — Notion/AMBOSS-killer refinement layer
   Principles: restrained motion, layered depth, tight typography,
   crisp hairlines, editorial spacing, number cadence.
════════════════════════════════════════════════════════════════════ */

/* Design tokens layered on top */
.hs-root {
  --px-hair: 1px;
  --px-edge: 1px;
  --r-xs: 8px;
  --r-sm: 12px;
  --r-md: 16px;
  --r-lg: 20px;
  --r-xl: 24px;
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --dur-fast: 180ms;
  --dur-base: 260ms;
  --dur-slow: 420ms;

  /* Editorial numeric OpenType features — used on every digit */
  --num-feat: "tnum" 1, "cv11" 1, "ss01" 1, "ss02" 1, "case" 1;

  /* Layered shadow stack — refined, not deep */
  --shadow-xs: 0 1px 2px -1px rgba(15,23,25,0.06), 0 1px 1px rgba(15,23,25,0.04);
  --shadow-sm: 0 2px 4px -2px rgba(15,23,25,0.08), 0 4px 12px -4px rgba(15,23,25,0.06);
  --shadow-md: 0 4px 12px -6px rgba(15,23,25,0.12), 0 12px 32px -12px rgba(15,23,25,0.10);
  --shadow-lg: 0 8px 24px -12px rgba(15,23,25,0.18), 0 24px 48px -16px rgba(15,23,25,0.12);
  --shadow-inset-top: inset 0 1px 0 rgba(255,255,255,0.55);
  --shadow-inset-edge: inset 0 0 0 1px rgba(255,255,255,0.04);

  /* Hairline edge stroke */
  --edge: color-mix(in srgb, var(--text-1) 8%, transparent);
  --edge-strong: color-mix(in srgb, var(--text-1) 14%, transparent);
}

.hs-root[data-theme="dark"] {
  --shadow-xs: 0 1px 2px rgba(0,0,0,0.42), 0 1px 1px rgba(0,0,0,0.3);
  --shadow-sm: 0 2px 6px rgba(0,0,0,0.40), 0 6px 16px rgba(0,0,0,0.32);
  --shadow-md: 0 4px 14px rgba(0,0,0,0.45), 0 14px 36px rgba(0,0,0,0.38);
  --shadow-lg: 0 8px 28px rgba(0,0,0,0.55), 0 28px 60px rgba(0,0,0,0.45);
  --shadow-inset-top: inset 0 1px 0 rgba(255,255,255,0.06);
  --shadow-inset-edge: inset 0 0 0 1px rgba(255,255,255,0.02);
  --edge: color-mix(in srgb, var(--text-1) 10%, transparent);
  --edge-strong: color-mix(in srgb, var(--text-1) 18%, transparent);
}

/* ── Global typography upgrade ─────────────────────────────── */
.hs-root {
  font-feature-settings: "kern" 1, "liga" 1, "calt" 1, "ss01" 1, "cv11" 1;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
.hs-root [style*="tabular-nums"],
.hs-root .hs-mini-stat-val,
.hs-root .hs-summary-chip-value,
.hs-root .hs-kpi-value,
.hs-root .hs-hero-ring-value {
  font-variant-numeric: tabular-nums slashed-zero;
  font-feature-settings: var(--num-feat);
}

/* ── Remove distracting ambient animations ─────────────────── */
.hs-root .hs-hero::before { animation: none !important; background: linear-gradient(90deg, transparent, var(--accent), transparent) !important; opacity: 0.55; }
.hs-root .hs-hero-ring-zone::before { animation: none !important; opacity: 0.35 !important; filter: blur(32px) !important; }
.hs-root .hs-hero-xp-fill::after { animation-duration: 3.6s !important; opacity: 0.8; }

/* ── Hero body — editorial flagship bar ────────────────────── */
.hs-root .hs-hero-body {
  padding: 32px 32px 24px;
  background:
    radial-gradient(ellipse 120% 100% at 0% 0%, color-mix(in srgb, var(--accent) 6%, transparent) 0%, transparent 55%),
    radial-gradient(ellipse 100% 80% at 100% 100%, color-mix(in srgb, var(--blue) 5%, transparent) 0%, transparent 60%),
    var(--glass-bg);
  border-bottom: var(--px-hair) solid var(--edge);
  box-shadow: var(--shadow-sm), var(--shadow-inset-top);
}
.hs-root .hs-hero-greeting {
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.045em;
  line-height: 1.08;
  background: linear-gradient(135deg, var(--text-1) 0%, color-mix(in srgb, var(--text-1) 72%, var(--text-2)) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.hs-root[data-theme="light"] .hs-hero-greeting { color: var(--text-1); }
.hs-root .hs-hero-date {
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--text-3);
  text-transform: none;
}

/* Mini stat cards — tighter, cleaner */
.hs-root .hs-mini-stat {
  padding: 14px 16px;
  border-radius: var(--r-sm);
  border: var(--px-hair) solid var(--edge);
  border-right: 3px solid var(--chip-color, var(--accent));
  background: var(--glass-bg);
  box-shadow: var(--shadow-xs), var(--shadow-inset-top);
  transition: transform var(--dur-base) var(--ease-out),
              box-shadow var(--dur-base) var(--ease-out),
              border-color var(--dur-base) var(--ease-out);
}
.hs-root .hs-mini-stat::after { display: none; }
.hs-root .hs-mini-stat:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--chip-color, var(--accent)) 35%, var(--edge));
  box-shadow: var(--shadow-md),
              0 0 0 1px color-mix(in srgb, var(--chip-color, var(--accent)) 20%, transparent) inset,
              var(--shadow-inset-top);
}
.hs-root .hs-mini-stat-label {
  font-size: 10.5px;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-3);
}
.hs-root .hs-mini-stat-val {
  font-size: 20px;
  font-weight: 750;
  letter-spacing: -0.035em;
  color: var(--text-1);
}
.hs-root .hs-mini-stat-icon {
  width: 32px; height: 32px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--chip-color, var(--accent)) 12%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--chip-color, var(--accent)) 22%, transparent);
}

/* XP track — slimmer, less loud */
.hs-root .hs-hero-xp-track {
  height: 4px;
  background: var(--bg-hover);
  box-shadow: inset 0 0 0 1px var(--edge);
}
.hs-root .hs-hero-xp-fill {
  background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 65%, var(--blue)));
  box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 35%, transparent);
}
.hs-root .hs-hero-xp-label {
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.02em;
  color: var(--text-2);
}

/* Theme toggle — minimal */
.hs-root .hs-theme-toggle {
  width: 38px; height: 38px;
  border-radius: var(--r-sm);
  border: var(--px-hair) solid var(--edge);
  background: var(--glass-bg);
  box-shadow: var(--shadow-xs);
}
.hs-root .hs-theme-toggle:hover {
  transform: none;
  background: var(--bg-hover);
  border-color: var(--edge-strong);
  color: var(--accent);
  box-shadow: var(--shadow-sm);
}

/* ── Command Center action cards ───────────────────────────── */
.hs-root .hs-command-card {
  border: var(--px-hair) solid var(--edge);
  border-radius: var(--r-md);
  background: var(--glass-bg);
  box-shadow: var(--shadow-xs), var(--shadow-inset-top);
  padding: 20px 22px;
  transition: transform var(--dur-base) var(--ease-out),
              box-shadow var(--dur-base) var(--ease-out),
              border-color var(--dur-base) var(--ease-out);
  position: relative;
  overflow: hidden;
}
.hs-root .hs-command-card::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--text-1) 12%, transparent), transparent);
  pointer-events: none;
}
.hs-root .hs-command-card:hover {
  transform: translateY(-1px);
  border-color: var(--edge-strong);
  box-shadow: var(--shadow-md), var(--shadow-inset-top);
}

/* ── Bento panels — the signature premium card ─────────────── */
.hs-root .hs-bento.hs-bento-v4 {
  gap: 18px;
  padding: 24px 24px 64px;
}
.hs-root .hs-bento.hs-bento-v4 > * {
  border: var(--px-hair) solid var(--edge) !important;
  border-radius: var(--r-lg) !important;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--text-1) 1.5%, transparent) 0%, transparent 40%),
    var(--glass-bg) !important;
  box-shadow: var(--shadow-sm), var(--shadow-inset-top) !important;
  transition: transform var(--dur-base) var(--ease-out),
              box-shadow var(--dur-base) var(--ease-out),
              border-color var(--dur-base) var(--ease-out) !important;
  position: relative;
  overflow: hidden;
}
.hs-root .hs-bento.hs-bento-v4 > *::before {
  content: "";
  position: absolute;
  top: 0; left: 16px; right: 16px;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, var(--edge-strong) 20%, var(--edge-strong) 80%, transparent 100%);
  pointer-events: none;
  z-index: 1;
}
.hs-root .hs-bento.hs-bento-v4 > *:hover {
  transform: translateY(-2px);
  border-color: var(--edge-strong) !important;
  box-shadow: var(--shadow-lg), var(--shadow-inset-top) !important;
}

/* Section title inside panels — editorial weight */
.hs-root .hs-bento .hs-section-title,
.hs-root .hs-bento .hs-section-head h3,
.hs-root .hs-bento .hs-section-head h2 {
  font-size: 14px !important;
  font-weight: 700 !important;
  letter-spacing: -0.02em;
  color: var(--text-1);
}
.hs-root .hs-section-head {
  margin-bottom: 18px !important;
}

/* ── Chart styling — crisp, editorial ──────────────────────── */
.hs-root .recharts-cartesian-grid-horizontal line,
.hs-root .recharts-cartesian-grid-vertical line {
  stroke: var(--edge) !important;
  stroke-dasharray: 2 4;
}
.hs-root .recharts-text {
  font-size: 10.5px !important;
  font-weight: 600 !important;
  fill: var(--text-3) !important;
  font-variant-numeric: tabular-nums;
}
.hs-root .recharts-polar-grid-angle line,
.hs-root .recharts-polar-grid-concentric-circle {
  stroke: var(--edge) !important;
}

/* ── Buttons — refined Linear/Vercel feel ──────────────────── */
.hs-root button,
.hs-root .hs-btn,
.hs-root a[role="button"] {
  transition: transform var(--dur-fast) var(--ease-out),
              background var(--dur-base) var(--ease-out),
              border-color var(--dur-base) var(--ease-out),
              box-shadow var(--dur-base) var(--ease-out);
}
.hs-root button:active,
.hs-root .hs-btn:active,
.hs-root a[role="button"]:active {
  transform: translateY(1px) scale(0.99);
}

/* ── Feature hub — brand tiles get restrained treatment ────── */
.hs-root .hs-panel-hub .hs-section-head + * > a,
.hs-root .hs-panel-hub a[href] {
  border-radius: var(--r-sm);
  border: var(--px-hair) solid var(--edge);
  background: var(--glass-bg);
  box-shadow: var(--shadow-xs);
  transition: transform var(--dur-base) var(--ease-out),
              box-shadow var(--dur-base) var(--ease-out),
              border-color var(--dur-base) var(--ease-out);
}
.hs-root .hs-panel-hub a[href]:hover {
  transform: translateY(-1px);
  border-color: var(--edge-strong);
  box-shadow: var(--shadow-md);
}

/* ── Footer — quieter ──────────────────────────────────────── */
.hs-root .hs-footer {
  padding: 28px 24px 40px;
  display: flex; align-items: center; justify-content: center; gap: 10px;
  color: var(--text-3);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  opacity: 0.62;
}
.hs-root .hs-footer-text {
  font-variant-numeric: tabular-nums;
}

/* ── Dark-mode refinements ─────────────────────────────────── */
.hs-root[data-theme="dark"] .hs-bento.hs-bento-v4 > * {
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--text-1) 2.5%, transparent) 0%, transparent 40%),
    var(--glass-bg) !important;
}
.hs-root[data-theme="dark"] .hs-hero-body {
  background:
    radial-gradient(ellipse 120% 100% at 0% 0%, color-mix(in srgb, var(--accent) 9%, transparent) 0%, transparent 55%),
    radial-gradient(ellipse 100% 80% at 100% 100%, color-mix(in srgb, var(--blue) 8%, transparent) 0%, transparent 60%),
    var(--glass-bg);
}
.hs-root[data-theme="dark"] .hs-hero-greeting {
  background: linear-gradient(135deg, var(--text-1) 0%, color-mix(in srgb, var(--text-1) 78%, var(--text-2)) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* ── Focus ring — crisp, accessible ────────────────────────── */
.hs-root *:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 2px var(--bg-base),
    0 0 0 4px color-mix(in srgb, var(--accent) 70%, transparent) !important;
  border-radius: inherit;
}

/* ── Scrollbar — thin, premium ─────────────────────────────── */
.hs-root *::-webkit-scrollbar { width: 8px; height: 8px; }
.hs-root *::-webkit-scrollbar-track { background: transparent; }
.hs-root *::-webkit-scrollbar-thumb {
  background: var(--edge-strong);
  border-radius: 99px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.hs-root *::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--text-1) 25%, transparent);
  background-clip: padding-box;
  border: 2px solid transparent;
}

/* ── Reduce motion — honor system preferences ──────────────── */
@media (prefers-reduced-motion: reduce) {
  .hs-root *,
  .hs-root *::before,
  .hs-root *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`;

/* ══════════════════════════════════════════════════════
   DASHBOARD INNER — Layout component
══════════════════════════════════════════════════════ */

function DashboardInner() {
  const { theme } = useTheme();
  const vars = theme === "dark" ? DARK_VARS : LIGHT_VARS;
  const rootRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <style>{BASE_CSS}</style>
      <style>{`:root { ${vars} }`}</style>

      <div ref={rootRef} className="hs-root theme-clinical" data-theme={theme}>
        {/* <DensityBridge containerRef={rootRef} /> */}

        <HeroSection />
        <CommandCenter />

        <div className="hs-bento hs-bento-v4">
          {/* Row 1 — Action: what to study today */}
          <SmartPath />
          <DailyMissions />

          {/* Row 2 — Insight + Calendar: both tall, natural height match */}
          <AccuracyTrend />
          <JalaliMiniCalendar />

          {/* Row 3 — Three compact panels: no height mismatch */}
          <FlashcardPulse />
          <MasteryRadar />
          <WeakAreas />

          {/* Row 4 — Review: error patterns + recent activity */}
          <TrapPatterns />
          <ActivityTimeline />

          {/* Row 5 — Navigation shortcuts */}
          <FeatureHub />
        </div>

        <footer className="hs-footer">
          <SaturnIcon size={18} />
          <span className="hs-footer-text">
            HOSSEIN STARSHIP — MEDICAL COMMAND CENTER · v5.2 PREMIUM
          </span>
        </footer>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════
   DEFAULT EXPORT — Providers wrapper
══════════════════════════════════════════════════════ */

export default function HosseinStarshipDashboard() {
  const theme = useThemeStore((s) => (s.theme === "dark" ? "dark" : "light"));
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const toggle = useCallback(() => toggleTheme(), [toggleTheme]);
  const liveData = useDashboardData();
  return (
    <DashboardDataCtx.Provider value={liveData}>
      <ThemeCtx.Provider value={{ theme, toggle }}>
        <DashboardInner/>
      </ThemeCtx.Provider>
    </DashboardDataCtx.Provider>
  );
}
