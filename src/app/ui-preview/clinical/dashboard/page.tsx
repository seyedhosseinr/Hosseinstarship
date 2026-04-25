"use client";

/**
 * Faithful Dashboard Upgrade Preview
 * ───────────────────────────────────
 * Route: /ui-preview/clinical/dashboard
 *
 * Every section, card, widget, and decorative identity element from the
 * real HosseinStarshipDashboard — upgraded ONLY in chrome, typography,
 * spacing, and tokens via the .theme-clinical design system.
 *
 * Nothing removed. Nothing reduced. Same order. Same data. Same interactions.
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
  Plus,
  Search,
  BookOpen,
  Brain,
  CreditCard,
  Target,
  Zap,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Clock,
  TrendingUp,
  Activity,
  Flame,
  RotateCcw,
  Trash2,
  Check,
  X,
  Bell,
  Settings,
  Bookmark,
  GraduationCap,
  HeartPulse,
  Baby,
  Ribbon,
  FlaskConical,
  Crosshair,
  Sun,
  Moon,
  List,
  Award,
  Layers,
  Calendar,
  Wifi,
  WifiOff,
} from "lucide-react";
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

/* ══════════════════════════════════════════════════════
   JALALI UTILITIES (inline — preserved exactly)
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
   THEME CONTEXT
══════════════════════════════════════════════════════ */

type Theme = "light" | "dark";
const ThemeCtx = createContext<{ theme: Theme; toggle: ()=>void }>({
  theme: "dark", toggle: ()=>{},
});
const useTheme = () => useContext(ThemeCtx);

/* ══════════════════════════════════════════════════════
   TYPES (preserved exactly from original)
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
  href?: string;
}
interface StudyNote {
  id: string; title: string; preview: string; detail: string;
  category: string; linkedMCQs: number; linkedFlashcards: number;
  concepts: string[]; createdAt: string;
}
interface TrapQuestion {
  id: string; question: string; trapType: string; domain: string;
  difficulty: "Hard"|"Medium"|"Easy"; yourAnswer: string;
  correctAnswer: string; explanation: string; isHard: boolean;
  resolved?: boolean;
}
interface PriorityItem {
  id: string; title: string; detail: string; eta: string;
  priority: "critical"|"high"|"medium"; done: boolean;
}
interface ActivityItem {
  id: string; text: string; time: string;
  tone: "blue"|"emerald"|"rose"|"amber"|"violet";
}

/* ══════════════════════════════════════════════════════
   MOCK DATA — realistic, matching real data shapes exactly
══════════════════════════════════════════════════════ */

const RADAR_DATA: RadarDomain[] = [
  { domain:"Oncology",      you:78, avg:65, icon:<Ribbon className="w-4 h-4"/>, color:"var(--cd-rose)" },
  { domain:"Pediatrics",    you:62, avg:60, icon:<Baby className="w-4 h-4"/>, color:"var(--cd-violet)" },
  { domain:"Reconstruction",you:85, avg:58, icon:<FlaskConical className="w-4 h-4"/>, color:"var(--cd-cyan)" },
  { domain:"Stones",        you:71, avg:70, icon:<Crosshair className="w-4 h-4"/>, color:"var(--cd-amber)" },
  { domain:"Trauma",        you:55, avg:62, icon:<AlertTriangle className="w-4 h-4"/>, color:"var(--cd-rose)" },
  { domain:"Infertility",   you:69, avg:55, icon:<HeartPulse className="w-4 h-4"/>, color:"var(--cd-emerald)" },
];

const ACCURACY_DATA: AccuracyPoint[] = [
  {day:"ش",accuracy:62},{day:"ی",accuracy:67},{day:"د",accuracy:71},
  {day:"س",accuracy:68},{day:"چ",accuracy:75},{day:"پ",accuracy:79},{day:"ج",accuracy:81},
];

const RECOMMENDATIONS: Recommendation[] = [
  { id:"r1", title:"Urologic Oncology — Renal Cell Carcinoma", subtitle:"High-yield • 20 MCQs",
    accuracy:62, duration:"25 min", mcqCount:20, reason:"Accuracy dropped 8% this week",
    alert:"Weakness detected", icon:<Ribbon className="w-5 h-5"/>, color:"var(--cd-rose)" },
  { id:"r2", title:"Pediatric Urology — VUR & Hydronephrosis", subtitle:"Review • 15 MCQs",
    accuracy:71, duration:"18 min", mcqCount:15, reason:"Spaced repetition due today",
    icon:<Baby className="w-5 h-5"/>, color:"var(--cd-violet)" },
  { id:"r3", title:"Stone Disease — Metabolic Workup", subtitle:"Deep dive • 12 MCQs",
    accuracy:75, duration:"15 min", mcqCount:12, reason:"Frequently tested on ABU",
    icon:<Crosshair className="w-5 h-5"/>, color:"var(--cd-amber)" },
];

const INITIAL_NOTES: StudyNote[] = [
  { id:"n1", title:"RCC Staging & Surgical Approach",
    preview:"T1a ≤4cm → partial nephrectomy preferred…",
    detail:"T1a (≤4cm): Partial nephrectomy gold standard. T1b (4–7cm): PN preferred. T2 (>7cm): Radical nephrectomy. T3a: Perinephric fat or renal vein. T3b: IVC below diaphragm.",
    category:"Oncology", linkedMCQs:8, linkedFlashcards:12,
    concepts:["RCC","Staging","Partial Nephrectomy"], createdAt:"2 days ago" },
  { id:"n2", title:"VUR Grading & Management",
    preview:"Grade I–II: observation + prophylaxis…",
    detail:"Grade I: Ureter only. Grade II–III: Conservative. Grade IV–V or breakthrough UTIs → surgical (reimplantation or STING).",
    category:"Pediatrics", linkedMCQs:5, linkedFlashcards:8,
    concepts:["VUR","Grading","STING"], createdAt:"5 days ago" },
];

const INITIAL_TRAPS: TrapQuestion[] = [
  { id:"t1", question:"Which is the most common histological subtype of RCC?",
    trapType:"distractor", domain:"Oncology", difficulty:"Medium",
    yourAnswer:"Papillary", correctAnswer:"Clear cell (70–80%)",
    explanation:"Papillary is second most common (10–15%). Clear cell dominates.", isHard:false, resolved:false },
  { id:"t2", question:"All patients with VUR Grade III require surgical intervention.",
    trapType:"absolute-language", domain:"Pediatrics", difficulty:"Hard",
    yourAnswer:"True", correctAnswer:"False — Grade III often resolves conservatively",
    explanation:"The word 'All' is the trap. Many Grade III cases resolve spontaneously.", isHard:true, resolved:false },
  { id:"t3", question:"45-year-old with a 2cm renal mass — next step?",
    trapType:"partial-truth", domain:"Oncology", difficulty:"Hard",
    yourAnswer:"Radical nephrectomy", correctAnswer:"Partial nephrectomy (T1a ≤4cm)",
    explanation:"Radical is partially right for larger tumors but PN is standard for T1a.", isHard:true, resolved:true },
];

const INITIAL_QUEUE: PriorityItem[] = [
  { id:"q1", title:"Review Due Cards", detail:"47 cards due", eta:"28 min", priority:"critical", done:false },
  { id:"q2", title:"Planner Tasks", detail:"2/5 done today", eta:"20 min", priority:"high", done:false },
  { id:"q3", title:"Overdue Follow-up", detail:"3 overdue tasks", eta:"10 min", priority:"critical", done:false },
  { id:"q4", title:"Weak Spot Drill", detail:"2 weak domains", eta:"15 min", priority:"medium", done:false },
];

const ACTIVITY_FEED: ActivityItem[] = [
  { id:"a1", text:"Completed Oncology MCQ block — 78% accuracy", time:"10m ago", tone:"blue" },
  { id:"a2", text:"Reviewed 12 Pediatrics flashcards", time:"45m ago", tone:"emerald" },
  { id:"a3", text:"Flagged 2 trap questions for re-test", time:"1h ago", tone:"rose" },
  { id:"a4", text:"Created note: RCC Staging & Surgical Approach", time:"2h ago", tone:"violet" },
  { id:"a5", text:"Started Stone Disease deep dive", time:"3h ago", tone:"amber" },
];

const KPI_READINESS = 73;
const KPI_ACCURACY  = 81;
const KPI_STREAK    = 12;
const KPI_XP_TODAY  = 340;
const KPI_XP_GOAL   = 500;
const KPI_WEAK      = 2;

/* ══════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════ */

const uid = () => Math.random().toString(36).slice(2,9);

function useClickOutside(ref: React.RefObject<HTMLElement|null>, fn: ()=>void) {
  useEffect(()=>{
    const h = (e:MouseEvent|TouchEvent)=>{
      if (!ref.current||ref.current.contains(e.target as Node)) return;
      fn();
    };
    document.addEventListener("mousedown",h);
    document.addEventListener("touchstart",h);
    return ()=>{ document.removeEventListener("mousedown",h); document.removeEventListener("touchstart",h); };
  },[ref,fn]);
}

/* ══════════════════════════════════════════════════════
   STAR FIELD (preserved exactly)
══════════════════════════════════════════════════════ */

function StarField() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    let id: number;
    const stars: {x:number;y:number;r:number;a:number;da:number;hue:string}[] = [];
    const resize = ()=>{
      c.width=window.innerWidth; c.height=window.innerHeight;
      stars.length=0;
      for(let i=0;i<160;i++) stars.push({
        x:Math.random()*c.width, y:Math.random()*c.height,
        r:Math.random()*1.4+0.3, a:Math.random(),
        da:(Math.random()*0.008+0.003)*(Math.random()<0.5?1:-1),
        hue: Math.random()<0.25?"180,220,255":"255,255,255",
      });
    };
    const draw = ()=>{
      ctx.clearRect(0,0,c.width,c.height);
      for(const s of stars){
        s.a+=s.da; if(s.a>1||s.a<0) s.da*=-1;
        ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
        ctx.fillStyle=`rgba(${s.hue},${s.a})`; ctx.fill();
      }
      id=requestAnimationFrame(draw);
    };
    resize(); draw();
    window.addEventListener("resize",resize);
    return ()=>{ cancelAnimationFrame(id); window.removeEventListener("resize",resize); };
  },[]);
  return <canvas ref={ref} className="fixed inset-0 pointer-events-none" style={{zIndex:0}}/>;
}

/* ══════════════════════════════════════════════════════
   SATURN SVG (preserved exactly)
══════════════════════════════════════════════════════ */

function SaturnIcon({ size=32, animated=false }: { size?:number; animated?:boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none"
      style={{ filter:"drop-shadow(0 0 8px rgba(76,154,255,0.55))", flexShrink:0,
               animation: animated ? "satFloat 6s ease-in-out infinite" : undefined }}
    >
      <defs>
        <radialGradient id="sb" cx="38%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#bfdbfe"/>
          <stop offset="50%" stopColor="#3b82f6"/>
          <stop offset="100%" stopColor="#1e3a5f"/>
        </radialGradient>
        <linearGradient id="sr" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#3b82f6" stopOpacity="0"/>
          <stop offset="30%"  stopColor="#93c5fd" stopOpacity="0.9"/>
          <stop offset="50%"  stopColor="#ffffff" stopOpacity="1"/>
          <stop offset="70%"  stopColor="#93c5fd" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/>
        </linearGradient>
        <radialGradient id="sg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/>
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
   SYNC STATUS BADGE (clinical shell chrome)
══════════════════════════════════════════════════════ */

type SyncStatus = "local" | "synced";
function SyncStatusBadge({ status }: { status: SyncStatus }) {
  const cfg = status === "synced"
    ? { color: "var(--cd-emerald)", label: "Synced", icon: <Wifi size={10}/> }
    : { color: "var(--cd-amber)", label: "Local", icon: <WifiOff size={10}/> };
  return (
    <div style={{display:"inline-flex",alignItems:"center",gap:4,
      padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:600,
      fontFamily:"var(--cd-font-ui)",letterSpacing:"0.04em",
      color:cfg.color,background:`color-mix(in srgb, ${cfg.color} 12%, transparent)`,
      border:`1px solid color-mix(in srgb, ${cfg.color} 20%, transparent)`}}>
      {cfg.icon}
      <span>{cfg.label}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MEDICAL TERM WRAPPER
══════════════════════════════════════════════════════ */

function MedicalTerm({ children, abbr }: { children: ReactNode; abbr?: boolean }) {
  return (
    <bdi style={{
      fontFamily: "var(--cd-font-latin-prose)",
      fontWeight: 600,
      fontSize: "0.9375rem",
      unicodeBidi: "isolate",
      direction: "ltr",
      letterSpacing: abbr ? "0.04em" : "0.01em",
      fontFeatureSettings: abbr ? '"smcp","c2sc"' : undefined,
      transition: "color 120ms ease",
    }}>{children}</bdi>
  );
}

/* ══════════════════════════════════════════════════════
   SHARED UI PRIMITIVES (upgraded chrome)
══════════════════════════════════════════════════════ */

function Card({ children, className="", style={}, noPad=false, onClick, elevation="base" }:
  { children:ReactNode; className?:string; style?:React.CSSProperties; noPad?:boolean; onClick?:()=>void; elevation?: "base"|"raised" }) {
  return (
    <div className={`cd-card ${noPad?"":"cd-card-pad"} ${elevation==="raised"?"cd-card-raised":""} ${className}`}
      style={style} onClick={onClick}>
      {children}
    </div>
  );
}

function SectionHead({ icon, title, sub, action }:
  { icon:ReactNode; title:string; sub?:string; action?:ReactNode }) {
  return (
    <div className="cd-section-head">
      <div className="cd-section-icon">{icon}</div>
      <div style={{flex:1,minWidth:0}}>
        <div className="cd-section-title">{title}</div>
        {sub && <div className="cd-section-sub">{sub}</div>}
      </div>
      {action}
    </div>
  );
}

function Chip({ label, color }: { label:string; color:string }) {
  return (
    <span style={{
      padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:600,
      fontFamily:"var(--cd-font-ui)", letterSpacing:"0.02em",
      background:`color-mix(in srgb, ${color} 12%, transparent)`, color,
      border:`1px solid color-mix(in srgb, ${color} 20%, transparent)`, whiteSpace:"nowrap",
    }}>{label}</span>
  );
}

function ProgressBar({ pct, color="var(--cd-accent)", height=5 }:
  { pct:number; color?:string; height?:number }) {
  return (
    <div style={{width:"100%",height,borderRadius:99,background:"var(--cd-border)",overflow:"hidden"}}>
      <motion.div
        initial={{width:0}} animate={{width:`${Math.min(pct,100)}%`}}
        transition={{duration:0.8,ease:"easeOut"}}
        style={{height:"100%",borderRadius:99,background:color,
          boxShadow:`0 0 6px color-mix(in srgb, ${color} 40%, transparent)`}}
      />
    </div>
  );
}

function Ring({ value, size=52, stroke=3.5, color="var(--cd-accent)", children }:
  { value:number; size?:number; stroke?:number; color?:string; children?:ReactNode }) {
  const r=(size-stroke)/2, circ=2*Math.PI*r, off=circ*(1-Math.min(value/100,1));
  return (
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--cd-border)" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off}
          style={{transition:"stroke-dashoffset 0.9s ease", filter:`drop-shadow(0 0 4px color-mix(in srgb, ${color} 50%, transparent))`}}/>
      </svg>
      {children && (
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   JALALI MINI-CALENDAR
══════════════════════════════════════════════════════ */

function useStudyMap(jy:number, jm:number) {
  return useMemo(()=>{
    const map = new Map<number,number>();
    const total = jalaliMonthDays(jy,jm);
    const today = todayJalali();
    for(let d=1;d<=total;d++){
      if (jy===today.jy && jm===today.jm && d<=today.jd) {
        const intensity = Math.floor(Math.random()*60) + (d%3===0 ? 30 : 5);
        if (intensity > 15) map.set(d, intensity);
      }
    }
    return map;
  },[jy,jm]);
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
    if(p<0.2) return "var(--cd-accent-dim)";
    if(p<0.45) return "color-mix(in srgb, var(--cd-accent) 28%, transparent)";
    if(p<0.7)  return "color-mix(in srgb, var(--cd-accent) 50%, transparent)";
    return "var(--cd-accent)";
  };

  const isCurrentMonth = view.jy===today.jy && view.jm===today.jm;

  return (
    <Card>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div>
          <div style={{fontWeight:700,fontSize:14,fontFamily:"var(--cd-font-body)",color:"var(--cd-text-1)"}}>
            {JALALI_MONTHS[view.jm-1]} {view.jy}
          </div>
          {isCurrentMonth && (
            <div style={{fontSize:10,color:"var(--cd-accent)",marginTop:2,fontFamily:"var(--cd-font-body)"}}>ماه جاری</div>
          )}
        </div>
        <div style={{display:"flex",gap:4}}>
          {!isCurrentMonth && (
            <button className="cd-icon-btn" onClick={()=>setView({jy:today.jy,jm:today.jm})}
              style={{fontSize:10,padding:"3px 8px",width:"auto",fontFamily:"var(--cd-font-body)"}}>
              امروز
            </button>
          )}
          <button className="cd-icon-btn" onClick={nextMonth}>&rsaquo;</button>
          <button className="cd-icon-btn" onClick={prevMonth}>&lsaquo;</button>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}} dir="rtl">
        {JALALI_WD_SHORT.map((d,i)=>(
          <div key={i} style={{
            textAlign:"center",fontSize:10,fontWeight:700,
            fontFamily:"var(--cd-font-body)",
            color: i===6?"var(--cd-rose)":"var(--cd-text-3)",
            padding:"2px 0",
          }}>{d}</div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}} dir="rtl">
        {cells.map((cell,idx)=>{
          const cards = cell.current ? (studyMap.get(cell.d)||0) : 0;
          const isToday = cell.current&&view.jy===today.jy&&view.jm===today.jm&&cell.d===today.jd;
          return (
            <div key={idx} style={{
              aspectRatio:"1",borderRadius:5,
              display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
              background: isToday?"var(--cd-accent)": cards>0?intensityColor(cards):"transparent",
              opacity: cell.current?1:0.2,
              cursor: cell.current?"pointer":"default",
              position:"relative",
              border: isToday?"2px solid var(--cd-accent)":"2px solid transparent",
              transition:"transform 150ms ease",
            }}
              onMouseEnter={e=>{if(cell.current)(e.currentTarget as HTMLElement).style.transform="scale(1.15)"}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.transform="scale(1)"}}
            >
              <span style={{
                fontSize:11, fontWeight:600, fontVariantNumeric:"tabular-nums",
                color: isToday||cards>50?"#ffffff":"var(--cd-text-2)",
              }}>{cell.d}</span>
              {cards>0 && !isToday && (
                <span style={{width:3,height:3,borderRadius:"50%",background:"var(--cd-accent)",marginTop:1}}/>
              )}
            </div>
          );
        })}
      </div>

      <div style={{display:"flex",alignItems:"center",gap:4,marginTop:10,fontSize:10,
        color:"var(--cd-text-3)",fontFamily:"var(--cd-font-body)"}}>
        <span>کم</span>
        {["var(--cd-accent-dim)","color-mix(in srgb, var(--cd-accent) 28%, transparent)",
          "color-mix(in srgb, var(--cd-accent) 50%, transparent)","var(--cd-accent)"].map((c,i)=>(
          <span key={i} style={{width:12,height:12,borderRadius:3,background:c,display:"inline-block"}}/>
        ))}
        <span>زیاد</span>
      </div>
    </Card>
  );
}

/* ══════════════════════════════════════════════════════
   NAVBAR (upgraded typography + SyncStatusBadge)
══════════════════════════════════════════════════════ */

function Navbar() {
  const { theme, toggle } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  useClickOutside(searchRef, ()=>setSearchOpen(false));

  return (
    <nav className="cd-navbar">
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <SaturnIcon size={34} animated/>
        <div>
          <div className="cd-logo-text">Hossein Starship</div>
          <div style={{fontSize:10,color:"var(--cd-text-3)",letterSpacing:"0.08em",marginTop:1,
            fontFamily:"var(--cd-font-ui)"}}>
            MISSION CONTROL
          </div>
        </div>
      </div>

      <div className="cd-nav-links">
        {(["Dashboard","Library","Flashcards","Review","Planner","History","Settings"] as const).map((l) => (
          <span key={l} className={`cd-nav-link${l === "Dashboard" ? " active" : ""}`}>{l}</span>
        ))}
      </div>

      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <SyncStatusBadge status="local"/>

        <div ref={searchRef} style={{position:"relative"}}>
          <AnimatePresence>
            {searchOpen ? (
              <motion.div initial={{width:36,opacity:0.5}} animate={{width:240,opacity:1}}
                exit={{width:36,opacity:0.5}} transition={{duration:0.25}}
                style={{display:"flex",alignItems:"center",gap:8,padding:"6px 12px",
                  borderRadius:8,background:"var(--cd-bg-hover)",border:"1px solid var(--cd-border-strong)"}}>
                <Search size={14} style={{color:"var(--cd-text-3)",flexShrink:0}}/>
                <input autoFocus placeholder="جستجو…" className="cd-search-input"/>
              </motion.div>
            ) : (
              <button className="cd-icon-btn" onClick={()=>setSearchOpen(true)}>
                <Search size={16}/>
              </button>
            )}
          </AnimatePresence>
        </div>

        <div className="cd-streak">
          <Flame size={13} style={{color:"var(--cd-amber)"}}/>
          <span>{KPI_STREAK} روز</span>
        </div>

        <button className="cd-icon-btn" onClick={toggle} title="تغییر تم">
          {theme==="dark" ? <Sun size={16}/> : <Moon size={16}/>}
        </button>

        <button className="cd-icon-btn"><Bell size={16}/></button>
        <button className="cd-icon-btn"><Settings size={16}/></button>

        <div className="cd-avatar">H</div>
      </div>
    </nav>
  );
}

/* ══════════════════════════════════════════════════════
   KPI ROW (upgraded: tabular-nums, clearer hierarchy)
══════════════════════════════════════════════════════ */

function KPIRow() {
  const kpis = [
    { label:"Readiness Score", value:`${KPI_READINESS}%`, sub:"Plan progress", color:"var(--cd-violet)", ring:KPI_READINESS },
    { label:"Accuracy Rate",   value:`${KPI_ACCURACY}%`,  sub:"Last 200 Qs",     color:"var(--cd-blue)",   ring:KPI_ACCURACY  },
    { label:"Study Streak",    value:`${KPI_STREAK}d`,    sub:"Consecutive days", color:"var(--cd-amber)"              },
    { label:"XP امروز",        value:KPI_XP_TODAY,        sub:`از ${KPI_XP_GOAL} هدف`, color:"var(--cd-emerald)", ring:Math.round(KPI_XP_TODAY/KPI_XP_GOAL*100) },
    { label:"Weak Spots",      value:KPI_WEAK,            sub:"نیاز به مرور",   color:"var(--cd-rose)"              },
  ];
  return (
    <div className="cd-kpi-row">
      {kpis.map((k,i)=>(
        <motion.div key={k.label} className="cd-kpi-card"
          initial={{opacity:0,y:18}} animate={{opacity:1,y:0}}
          transition={{delay:0.08*i,duration:0.45}}>
          <div style={{position:"absolute",top:0,right:0,width:80,height:80,borderRadius:"50%",
            background:k.color, opacity:0.05, filter:"blur(20px)", pointerEvents:"none"}}/>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <span style={{fontSize:10,fontWeight:600,color:"var(--cd-text-3)",letterSpacing:"0.08em",
              textTransform:"uppercase",fontFamily:"var(--cd-font-ui)"}}>{k.label}</span>
            {k.ring!==undefined && (
              <Ring value={k.ring} size={38} stroke={3} color={k.color}>
                <span style={{fontSize:9,fontWeight:700,color:k.color,fontVariantNumeric:"tabular-nums"}}>{k.ring}%</span>
              </Ring>
            )}
          </div>
          <div style={{fontSize:28,fontWeight:800,color:k.color,letterSpacing:"-0.02em",lineHeight:1,
            fontVariantNumeric:"tabular-nums",fontFamily:"var(--cd-font-ui)"}}>
            {k.value}
          </div>
          <div style={{fontSize:11,color:"var(--cd-text-3)",marginTop:6,fontFamily:"var(--cd-font-body)"}}>{k.sub}</div>
        </motion.div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   NEXT RECOMMENDED
══════════════════════════════════════════════════════ */

function NextRecommended() {
  const [idx, setIdx] = useState(0);
  const recommendations = RECOMMENDATIONS;
  const rec = recommendations[idx] ?? recommendations[0];
  return (
    <Card>
      <SectionHead icon={<Layers size={16} style={{color:"var(--cd-accent)"}}/>}
        title="Next Recommended" sub="AI-curated study path"/>
      <AnimatePresence mode="wait">
        <motion.div key={rec.id}
          initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}
          transition={{duration:0.25}}
          style={{padding:"14px 16px",borderRadius:10,marginBottom:12,
            background:`color-mix(in srgb, ${rec.color} 8%, transparent)`,
            border:`1px solid color-mix(in srgb, ${rec.color} 18%, transparent)`}}>
          {rec.alert && (
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
              <AlertTriangle size={12} style={{color:"var(--cd-rose)"}}/>
              <span style={{fontSize:10,fontWeight:700,color:"var(--cd-rose)",textTransform:"uppercase",
                letterSpacing:"0.1em",fontFamily:"var(--cd-font-ui)"}}>{rec.alert}</span>
            </div>
          )}
          <div style={{fontWeight:700,fontSize:14,color:"var(--cd-text-1)",marginBottom:4}}>
            <MedicalTerm>{rec.title}</MedicalTerm>
          </div>
          <div style={{fontSize:12,color:"var(--cd-text-2)",marginBottom:8,fontFamily:"var(--cd-font-body)"}}>{rec.reason}</div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <Chip label={rec.duration} color="var(--cd-blue)"/>
            <Chip label={`${rec.mcqCount} MCQs`} color="var(--cd-violet)"/>
            <Chip label={`${rec.accuracy}% accuracy`} color={rec.accuracy<70?"var(--cd-rose)":"var(--cd-emerald)"}/>
          </div>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button className="cd-btn-primary">
              <Play size={13}/> شروع Session
            </button>
            <button className="cd-btn-ghost"
              onClick={()=>setIdx(i=>(i+1)%Math.max(1,recommendations.length))}>
              بعدی →
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
      <div style={{display:"flex",flexDirection:"column",gap:4}}>
        {recommendations.map((r,i)=>(
          <div key={r.id} onClick={()=>setIdx(i)}
            style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:8,cursor:"pointer",
              background:i===idx?"var(--cd-accent-dim)":"transparent",
              border:`1px solid ${i===idx?"var(--cd-accent)":"transparent"}`,transition:"all 150ms ease"}}>
            <div style={{width:20,height:20,borderRadius:6,display:"flex",alignItems:"center",
              justifyContent:"center",fontSize:10,fontWeight:700,fontVariantNumeric:"tabular-nums",
              fontFamily:"var(--cd-font-ui)",
              background:i===idx?"var(--cd-accent)":"var(--cd-border)",
              color:i===idx?"#fff":"var(--cd-text-3)"}}>{i+1}</div>
            <span style={{fontSize:12,color:i===idx?"var(--cd-accent)":"var(--cd-text-2)",
              flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
              fontFamily:"var(--cd-font-latin-prose)",fontWeight:500}}>
              {r.title}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ══════════════════════════════════════════════════════
   PRIORITY QUEUE
══════════════════════════════════════════════════════ */

function PriorityQueue() {
  const [items, setItems] = useState(INITIAL_QUEUE);
  const toggle = (id:string) => setItems(p=>p.map(i=>i.id===id?{...i,done:!i.done}:i));
  const pColor: Record<string,string> = {critical:"var(--cd-rose)",high:"var(--cd-amber)",medium:"var(--cd-blue)"};
  return (
    <Card>
      <SectionHead icon={<List size={16} style={{color:"var(--cd-accent)"}}/>}
        title="Priority Queue" sub="Focus on what matters most"
        action={<Chip label={`${items.filter(i=>!i.done).length} remaining`} color="var(--cd-accent)"/>}/>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {items.length === 0 ? (
          <div style={{fontSize:12,color:"var(--cd-text-3)",padding:"12px 0",textAlign:"center",
            fontFamily:"var(--cd-font-body)"}}>بدون تسک برای امروز</div>
        ) : items.map((item)=>(
          <motion.div key={item.id} layout
            onClick={()=>toggle(item.id)}
            style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 12px",borderRadius:8,cursor:"pointer",
              background:item.done?"transparent":"var(--cd-bg-hover)",
              border:`1px solid ${item.done?"var(--cd-border)":"var(--cd-border-strong)"}`,
              opacity:item.done?0.55:1,transition:"all 150ms ease"}}
            whileHover={{x:3}}>
            <div style={{width:18,height:18,borderRadius:5,border:`2px solid ${item.done?"var(--cd-accent)":"var(--cd-border-strong)"}`,
              background:item.done?"var(--cd-accent)":"transparent",display:"flex",alignItems:"center",
              justifyContent:"center",flexShrink:0,marginTop:1,transition:"all 150ms ease"}}>
              {item.done&&<Check size={10} color="#fff" strokeWidth={3}/>}
            </div>
            <div style={{width:8,height:8,borderRadius:"50%",background:pColor[item.priority]||"var(--cd-blue)",
              flexShrink:0,marginTop:5,boxShadow:`0 0 6px color-mix(in srgb, ${pColor[item.priority]} 60%, transparent)`}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:"var(--cd-text-1)",
                textDecoration:item.done?"line-through":"none"}}>{item.title}</div>
              <div style={{fontSize:11,color:"var(--cd-text-3)",marginTop:2,fontVariantNumeric:"tabular-nums"}}>
                {item.detail} · {item.eta}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

/* ══════════════════════════════════════════════════════
   MASTERY RADAR
══════════════════════════════════════════════════════ */

function MasteryRadar() {
  const { theme } = useTheme();
  const gridColor = theme==="dark"?"rgba(76,154,255,0.1)":"rgba(0,82,204,0.08)";
  const tickColor = theme==="dark"?"#505f79":"#8993a4";
  const tooltipBg = theme==="dark"?"rgba(13,27,46,0.95)":"rgba(255,255,255,0.97)";
  const tooltipBorder = theme==="dark"?"rgba(76,154,255,0.25)":"rgba(0,82,204,0.2)";

  return (
    <Card>
      <SectionHead icon={<GraduationCap size={16} style={{color:"var(--cd-violet)"}}/>}
        title="Mastery Radar" sub="Domain proficiency overview"/>
      <div style={{width:"100%",height:260}}>
        <ResponsiveContainer>
          <RechartsRadarChart cx="50%" cy="50%" outerRadius="68%"
            data={RADAR_DATA.map(d=>({subject:d.domain,you:d.you,avg:d.avg}))}>
            <PolarGrid stroke={gridColor} gridType="polygon"/>
            <PolarAngleAxis dataKey="subject"
              tick={{fill:tickColor,fontSize:11,fontFamily:"var(--cd-font-latin-prose)"}}/>
            <PolarRadiusAxis domain={[0,100]} axisLine={false}
              tick={{fill:tickColor,fontSize:9}}/>
            <RechartsRadar name="You" dataKey="you" stroke="var(--cd-blue)"
              fill="var(--cd-blue)" fillOpacity={0.25} strokeWidth={2}
              dot={{r:3,fill:"var(--cd-blue)",stroke:"var(--cd-bg-surface)",strokeWidth:1.5}}/>
            <RechartsRadar name="Avg" dataKey="avg" stroke="var(--cd-text-3)"
              fill="var(--cd-text-3)" fillOpacity={0.1} strokeWidth={1.5} strokeDasharray="4 2"/>
            <RechartsTooltip contentStyle={{background:tooltipBg,border:`1px solid ${tooltipBorder}`,
              borderRadius:8,fontSize:12,fontFamily:"var(--cd-font-body)",color:"var(--cd-text-1)"}}
              formatter={(v:number,n:string)=>[`${v}%`,n==="you"?"شما":"میانگین"]}/>
          </RechartsRadarChart>
        </ResponsiveContainer>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginTop:4}}>
        {RADAR_DATA.map(d=>(
          <div key={d.domain} style={{display:"flex",alignItems:"center",gap:6,
            padding:"5px 8px",borderRadius:6,background:"var(--cd-bg-hover)"}}>
            <span style={{color:d.color,flexShrink:0}}>{d.icon}</span>
            <span style={{fontSize:11,color:"var(--cd-text-2)",flex:1,minWidth:0,
              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
              fontFamily:"var(--cd-font-latin-prose)",fontWeight:500}}>
              <MedicalTerm>{d.domain}</MedicalTerm>
            </span>
            <span style={{fontSize:11,fontWeight:700,fontVariantNumeric:"tabular-nums",
              color:d.you>=80?"var(--cd-emerald)":d.you>=60?"var(--cd-amber)":"var(--cd-rose)"}}>{d.you}%</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ══════════════════════════════════════════════════════
   ACCURACY TREND
══════════════════════════════════════════════════════ */

function AccuracyTrend() {
  const { theme } = useTheme();
  const gridColor = theme==="dark"?"rgba(76,154,255,0.07)":"rgba(0,82,204,0.06)";
  const tickColor = theme==="dark"?"#505f79":"#8993a4";
  const tooltipBg = theme==="dark"?"rgba(13,27,46,0.95)":"rgba(255,255,255,0.97)";
  return (
    <Card>
      <SectionHead icon={<TrendingUp size={16} style={{color:"var(--cd-emerald)"}}/>}
        title="Accuracy Trend" sub="عملکرد هفته جاری"/>
      <div style={{width:"100%",height:220}}>
        <ResponsiveContainer>
          <AreaChart data={ACCURACY_DATA} margin={{top:8,right:4,left:-18,bottom:0}}>
            <defs>
              <linearGradient id="accG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor="var(--cd-emerald)" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="var(--cd-emerald)" stopOpacity={0.02}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 6" stroke={gridColor} vertical={false}/>
            <XAxis dataKey="day" tick={{fill:tickColor,fontSize:11,fontFamily:"var(--cd-font-body)"}}
              axisLine={{stroke:gridColor}} tickLine={false}/>
            <YAxis domain={[50,100]} tick={{fill:tickColor,fontSize:10}}
              axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`}/>
            <RechartsTooltip contentStyle={{background:tooltipBg,border:"1px solid var(--cd-border-strong)",
              borderRadius:8,fontSize:12,fontFamily:"var(--cd-font-body)"}}
              formatter={(v:number)=>[`${v}%`,"دقت"]}/>
            <Area type="monotone" dataKey="accuracy" stroke="var(--cd-emerald)" strokeWidth={2.5}
              fill="url(#accG)" dot={{r:3.5,fill:"var(--cd-emerald)",stroke:"var(--cd-bg-surface)",strokeWidth:2}}
              activeDot={{r:6,fill:"var(--cd-emerald)",stroke:"var(--cd-bg-surface)",strokeWidth:2}}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* ══════════════════════════════════════════════════════
   TRAP QUESTIONS
══════════════════════════════════════════════════════ */

function TrapQuestions() {
  const [traps, setTraps] = useState(INITIAL_TRAPS);
  const [filter, setFilter] = useState<"all"|"active"|"resolved">("all");
  const [expanded, setExpanded] = useState<string|null>(null);
  const toggle = (id:string) => setTraps(p=>p.map(t=>t.id===id?{...t,resolved:!t.resolved}:t));
  const filtered = traps.filter(t=> filter==="all"?true: filter==="active"?!t.resolved:!!t.resolved);
  const TRAP_COLORS: Record<string,string> = {
    distractor:"var(--cd-rose)","partial-truth":"var(--cd-amber)",
    "absolute-language":"var(--cd-violet)",reversal:"var(--cd-cyan)","look-alike":"var(--cd-emerald)",
  };
  return (
    <Card>
      <SectionHead icon={<AlertTriangle size={16} style={{color:"var(--cd-amber)"}}/>}
        title="Trap Questions" sub="Patterns that trick you"/>
      <div style={{display:"flex",gap:6,marginBottom:12}}>
        {(["all","active","resolved"] as const).map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{
            padding:"4px 12px",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",border:"none",
            fontFamily:"var(--cd-font-body)",
            background:filter===f?"var(--cd-accent)":"var(--cd-bg-hover)",
            color:filter===f?"#fff":"var(--cd-text-2)",transition:"all 150ms ease",
          }}>{f==="all"?"همه":f==="active"?"فعال":"حل‌شده"}</button>
        ))}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:320,overflowY:"auto"}}>
        {filtered.map(trap=>{
          const trapColor = TRAP_COLORS[trap.trapType]||"var(--cd-amber)";
          return (
            <motion.div key={trap.id} layout
              style={{borderRadius:8,padding:"10px 12px",cursor:"pointer",
                background:trap.resolved?"var(--cd-bg-hover)":"var(--cd-bg-surface)",
                border:`1px solid ${trap.resolved?"var(--cd-border)":trapColor}`,
                borderLeftWidth:trap.resolved?1:3,
                transition:"all 150ms ease"}}
              onClick={()=>setExpanded(e=>e===trap.id?null:trap.id)}
              whileHover={{x:3}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                <button onClick={e=>{e.stopPropagation();toggle(trap.id)}}
                  style={{width:18,height:18,borderRadius:"50%",flexShrink:0,marginTop:1,
                    border:`2px solid ${trap.resolved?"var(--cd-emerald)":"var(--cd-border-strong)"}`,
                    background:trap.resolved?"var(--cd-emerald)":"transparent",
                    cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 150ms ease"}}>
                  {trap.resolved&&<Check size={10} color="#fff" strokeWidth={3}/>}
                </button>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3,flexWrap:"wrap"}}>
                    <span style={{fontSize:13,fontWeight:600,color:"var(--cd-text-1)",
                      textDecoration:trap.resolved?"line-through":"none",opacity:trap.resolved?0.5:1}}>
                      {trap.question.length>70?trap.question.slice(0,70)+"…":trap.question}
                    </span>
                  </div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    <Chip label={trap.trapType} color={trapColor}/>
                    <Chip label={trap.domain} color="var(--cd-blue)"/>
                    <Chip label={trap.difficulty} color={trap.difficulty==="Hard"?"var(--cd-rose)":"var(--cd-amber)"}/>
                  </div>
                </div>
                <motion.div animate={{rotate:expanded===trap.id?180:0}} transition={{duration:0.15}}>
                  <ChevronDown size={14} style={{color:"var(--cd-text-3)"}}/>
                </motion.div>
              </div>
              <AnimatePresence>
                {expanded===trap.id && (
                  <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}}
                    exit={{height:0,opacity:0}} transition={{duration:0.18}}
                    style={{overflow:"hidden"}}>
                    <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid var(--cd-border)"}}>
                      <div style={{fontSize:12,color:"var(--cd-rose)",marginBottom:4,fontFamily:"var(--cd-font-body)"}}>
                        پاسخ شما: {trap.yourAnswer}
                      </div>
                      <div style={{fontSize:12,color:"var(--cd-emerald)",marginBottom:6,fontFamily:"var(--cd-font-body)"}}>
                        پاسخ صحیح: {trap.correctAnswer}
                      </div>
                      <div style={{fontSize:11,color:"var(--cd-text-2)",lineHeight:1.5,
                        fontFamily:"var(--cd-font-latin-prose)",
                        background:"var(--cd-bg-hover)",padding:"8px 10px",borderRadius:6}}>
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
    </Card>
  );
}

/* ══════════════════════════════════════════════════════
   STUDY NOTES
══════════════════════════════════════════════════════ */

function StudyNotes() {
  const [notes, setNotes] = useState(INITIAL_NOTES);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({title:"",detail:"",category:"General"});
  const [search, setSearch] = useState("");

  const addNote = ()=>{
    if (!form.title.trim()) return;
    setNotes(p=>[{id:uid(),title:form.title,preview:form.detail.slice(0,60)+"…",
      detail:form.detail,category:form.category,linkedMCQs:0,linkedFlashcards:0,
      concepts:[],createdAt:"Just now"},...p]);
    setForm({title:"",detail:"",category:"General"}); setAdding(false);
  };

  const filtered = notes.filter(n=>
    !search||n.title.toLowerCase().includes(search.toLowerCase())||
    n.detail.toLowerCase().includes(search.toLowerCase()));

  const catColor: Record<string,string> = {
    Oncology:"var(--cd-rose)",Pediatrics:"var(--cd-violet)",Stones:"var(--cd-amber)",
    Reconstruction:"var(--cd-cyan)",Trauma:"var(--cd-rose)",Infertility:"var(--cd-emerald)",General:"var(--cd-blue)",
  };

  return (
    <Card>
      <SectionHead icon={<BookOpen size={16} style={{color:"var(--cd-violet)"}}/>}
        title="Study Notes" sub={`${notes.length} یادداشت`}
        action={
          <button onClick={()=>setAdding(a=>!a)}
            style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:6,
              fontSize:11,fontWeight:600,cursor:"pointer",border:"none",fontFamily:"var(--cd-font-body)",
              background:adding?"color-mix(in srgb, var(--cd-rose) 12%, transparent)":"var(--cd-accent-dim)",
              color:adding?"var(--cd-rose)":"var(--cd-accent)",transition:"all 150ms ease"}}>
            {adding?<X size={12}/>:<Plus size={12}/>}
            {adding?"لغو":"Open library"}
          </button>
        }/>

      <AnimatePresence>
        {adding && (
          <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}}
            exit={{height:0,opacity:0}} style={{overflow:"hidden",marginBottom:12}}>
            <div style={{padding:12,borderRadius:8,background:"var(--cd-bg-hover)",
              border:"1px solid var(--cd-border-strong)",display:"flex",flexDirection:"column",gap:8}}>
              <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}
                placeholder="عنوان یادداشت…" className="cd-input"/>
              <textarea value={form.detail} onChange={e=>setForm(f=>({...f,detail:e.target.value}))}
                placeholder="متن یادداشت…" rows={3} className="cd-input" style={{resize:"none"}}/>
              <div style={{display:"flex",gap:8}}>
                <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}
                  className="cd-input" style={{flex:1}}>
                  {Object.keys(catColor).map(c=><option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={addNote} className="cd-btn-primary">ذخیره</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{position:"relative",marginBottom:10}}>
        <Search size={13} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",
          color:"var(--cd-text-3)",pointerEvents:"none"}}/>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="جستجوی یادداشت…" className="cd-input" style={{paddingLeft:30}}/>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:300,overflowY:"auto"}}>
        {filtered.map((note,i)=>(
          <motion.div key={note.id} layout
            initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{delay:i*0.04}}
            style={{padding:"10px 12px",borderRadius:8,
              background:"var(--cd-bg-hover)",border:"1px solid var(--cd-border)",
              cursor:"pointer",transition:"all 150ms ease"}}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--cd-accent)"}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--cd-border)"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                  <span style={{fontSize:13,fontWeight:600,color:"var(--cd-text-1)"}}>
                    <MedicalTerm>{note.title}</MedicalTerm>
                  </span>
                  <Chip label={note.category} color={catColor[note.category]||"var(--cd-blue)"}/>
                </div>
                <p style={{fontSize:11,color:"var(--cd-text-2)",lineHeight:1.45,
                  fontFamily:"var(--cd-font-latin-prose)",
                  overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>
                  {note.preview}
                </p>
                <div style={{display:"flex",gap:10,marginTop:5}}>
                  <span style={{fontSize:10,color:"var(--cd-text-3)",fontFamily:"var(--cd-font-body)"}}>
                    {note.createdAt}
                  </span>
                  <span style={{fontSize:10,color:"var(--cd-blue)",fontVariantNumeric:"tabular-nums"}}>
                    {note.linkedMCQs} <MedicalTerm abbr>MCQ</MedicalTerm>s
                  </span>
                </div>
              </div>
              <button onClick={(e)=>{e.stopPropagation();setNotes(p=>p.filter(n=>n.id!==note.id))}}
                style={{background:"none",border:"none",cursor:"pointer",padding:2,opacity:0,
                  transition:"opacity 150ms ease",borderRadius:4}}
                onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.opacity="1"}}
                onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.opacity="0"}}>
                <Trash2 size={13} style={{color:"var(--cd-rose)"}}/>
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

/* ══════════════════════════════════════════════════════
   WEAK SPOTS
══════════════════════════════════════════════════════ */

function WeakSpots() {
  const weak = RADAR_DATA.filter(d=>d.you<70).sort((a,b)=>a.you-b.you);
  const color = (p:number)=> p<55?"var(--cd-rose)":p<65?"var(--cd-amber)":"var(--cd-blue)";
  const label = (p:number)=> p<55?"Critical":p<65?"Weak":"Needs Work";
  return (
    <Card>
      <SectionHead icon={<Target size={16} style={{color:"var(--cd-rose)"}}/>}
        title="Weak Spots" sub={`${weak.length} domain below 70%`}/>
      {weak.length===0 ? (
        <div style={{textAlign:"center",padding:"20px 0",color:"var(--cd-emerald)"}}>
          <Check size={28} style={{margin:"0 auto 8px"}}/>
          <div style={{fontWeight:600,fontFamily:"var(--cd-font-body)"}}>All domains above 70%</div>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {weak.map((s,i)=>(
            <motion.div key={s.domain}
              initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:i*0.07}}
              style={{padding:"10px 12px",borderRadius:8,
                background:`color-mix(in srgb, ${color(s.you)} 6%, transparent)`,
                border:`1px solid color-mix(in srgb, ${color(s.you)} 15%, transparent)`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontSize:13,fontWeight:600,color:"var(--cd-text-1)"}}>
                  <MedicalTerm>{s.domain}</MedicalTerm>
                </span>
                <Chip label={label(s.you)} color={color(s.you)}/>
              </div>
              <ProgressBar pct={s.you} color={color(s.you)}/>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
                <span style={{fontSize:11,color:"var(--cd-text-3)",fontFamily:"var(--cd-font-body)"}}>شما vs میانگین: {s.avg}%</span>
                <span style={{fontSize:12,fontWeight:700,color:color(s.you),fontVariantNumeric:"tabular-nums"}}>{s.you}%</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ══════════════════════════════════════════════════════
   DAILY GOALS
══════════════════════════════════════════════════════ */

function DailyGoals() {
  const goals = [
    {label:"تسک امروز",      cur:2, target:5, color:"var(--cd-violet)"},
    {label:"پیشرفت کل",      cur:34, target:100, color:"var(--cd-blue)"},
    {label:"تسک عقب‌مانده",  cur:3, target:3, color:"var(--cd-rose)"},
    {label:"ساعت مطالعه",    cur:1.5, target:4, color:"var(--cd-emerald)"},
  ];
  return (
    <Card>
      <SectionHead icon={<Flame size={16} style={{color:"var(--cd-amber)"}}/>}
        title="Daily Goals" sub="پیشرفت امروز"/>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {goals.map((g,i)=>{
          const pct = g.target > 0 ? Math.min(g.cur/g.target*100,100) : (g.cur > 0 ? 100 : 0);
          return (
            <motion.div key={g.label} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}
              transition={{delay:i*0.06}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,
                fontSize:12,color:"var(--cd-text-2)",fontFamily:"var(--cd-font-body)"}}>
                <span>{g.label}</span>
                <span style={{fontWeight:700,fontVariantNumeric:"tabular-nums",
                  color:pct>=100?"var(--cd-emerald)":g.color}}>
                  {g.cur}/{g.target} {pct>=100&&"✓"}
                </span>
              </div>
              <ProgressBar pct={pct} color={g.color} height={5}/>
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}

/* ══════════════════════════════════════════════════════
   QUICK ACTIONS
══════════════════════════════════════════════════════ */

function QuickActions() {
  const actions = [
    {label:"Library",         color:"var(--cd-amber)",  icon:<BookOpen size={16}/>},
    {label:"Weak Spots",      color:"var(--cd-rose)",   icon:<Target size={16}/>},
    {label:"SRS Review",      color:"var(--cd-violet)", icon:<RotateCcw size={16}/>},
    {label:"Flashcards",      color:"var(--cd-blue)",   icon:<CreditCard size={16}/>},
    {label:"History",         color:"var(--cd-emerald)",icon:<Bookmark size={16}/>},
    {label:"Settings",        color:"var(--cd-cyan)",   icon:<Award size={16}/>},
    {label:"Runtime Data",    color:"var(--cd-violet)", icon:<Plus size={16}/>},
    {label:"Planner",         color:"var(--cd-emerald)", icon:<Calendar size={16}/>},
  ];
  return (
    <Card>
      <SectionHead icon={<Zap size={16} style={{color:"var(--cd-amber)"}}/>}
        title="Quick Actions" sub="شروع سریع"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {actions.map((a,i)=>(
          <motion.button key={a.label}
            initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}}
            transition={{delay:i*0.05}}
            whileHover={{scale:1.04,y:-2}} whileTap={{scale:0.96}}
            style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,
              padding:"12px 8px",borderRadius:8,border:"none",cursor:"pointer",
              background:"var(--cd-bg-hover)",transition:"all 150ms ease",
              fontFamily:"var(--cd-font-ui)"}}>
            <div style={{width:36,height:36,borderRadius:8,display:"flex",alignItems:"center",
              justifyContent:"center",background:`color-mix(in srgb, ${a.color} 12%, transparent)`,
              color:a.color}}>{a.icon}</div>
            <span style={{fontSize:11,fontWeight:600,color:"var(--cd-text-2)",textAlign:"center",
              lineHeight:1.3}}>{a.label}</span>
          </motion.button>
        ))}
      </div>
    </Card>
  );
}

/* ══════════════════════════════════════════════════════
   ACTIVITY FEED
══════════════════════════════════════════════════════ */

function ActivityFeed() {
  const toneVar: Record<string,string> = {
    blue:"var(--cd-blue)",emerald:"var(--cd-emerald)",rose:"var(--cd-rose)",
    amber:"var(--cd-amber)",violet:"var(--cd-violet)",
  };
  return (
    <Card>
      <SectionHead icon={<Activity size={16} style={{color:"var(--cd-blue)"}}/>}
        title="Recent Activity" sub="آخرین اقدامات"/>
      <div style={{display:"flex",flexDirection:"column"}}>
        {ACTIVITY_FEED.map((a,i)=>(
          <motion.div key={a.id} initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}}
            transition={{delay:i*0.06}}
            style={{display:"flex",alignItems:"flex-start",gap:10,padding:"8px 0",
              borderBottom: i<ACTIVITY_FEED.length-1?"1px solid var(--cd-border)":"none"}}>
            <div style={{width:28,height:28,borderRadius:6,flexShrink:0,display:"flex",
              alignItems:"center",justifyContent:"center",
              background:`color-mix(in srgb, ${toneVar[a.tone]} 12%, transparent)`,
              color:toneVar[a.tone]}}>
              {a.tone==="blue"?<BookOpen size={12}/>:a.tone==="emerald"?<Check size={12}/>:
                a.tone==="rose"?<AlertTriangle size={12}/>:a.tone==="amber"?<Flame size={12}/>:<Brain size={12}/>}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,color:"var(--cd-text-1)",lineHeight:1.4}}>{a.text}</div>
              <div style={{fontSize:10,color:"var(--cd-text-3)",marginTop:2,fontVariantNumeric:"tabular-nums"}}>{a.time}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

/* ══════════════════════════════════════════════════════
   UPGRADED SKELETON (loading state)
══════════════════════════════════════════════════════ */

function SkeletonBlock({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`cd-skeleton ${className||""}`} style={style}/>;
}

function UpgradedSkeleton() {
  return (
    <div style={{padding:"24px 20px 48px",maxWidth:1440,margin:"0 auto",width:"100%"}}>
      {/* KPI Row skeleton */}
      <div className="cd-kpi-row">
        {Array.from({length:5}).map((_,i) => (
          <div key={i} className="cd-kpi-card" style={{minHeight:110}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
              <SkeletonBlock style={{width:80,height:12,borderRadius:4}}/>
              <SkeletonBlock style={{width:38,height:38,borderRadius:"50%"}}/>
            </div>
            <SkeletonBlock style={{width:60,height:28,borderRadius:4,marginBottom:8}}/>
            <SkeletonBlock style={{width:100,height:10,borderRadius:4}}/>
          </div>
        ))}
      </div>
      {/* Main grid skeleton */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 360px",gap:18,marginTop:18}}>
        <div style={{display:"flex",flexDirection:"column",gap:18}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
            <div className="cd-card cd-card-pad" style={{minHeight:300}}>
              <SkeletonBlock style={{width:140,height:14,borderRadius:4,marginBottom:16}}/>
              <SkeletonBlock style={{width:"100%",height:120,borderRadius:8,marginBottom:12}}/>
              <SkeletonBlock style={{width:"100%",height:32,borderRadius:6}}/>
            </div>
            <div className="cd-card cd-card-pad" style={{minHeight:300}}>
              <SkeletonBlock style={{width:120,height:14,borderRadius:4,marginBottom:16}}/>
              {Array.from({length:4}).map((_,i) => (
                <SkeletonBlock key={i} style={{width:"100%",height:44,borderRadius:6,marginBottom:6}}/>
              ))}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
            <div className="cd-card cd-card-pad" style={{minHeight:340}}>
              <SkeletonBlock style={{width:120,height:14,borderRadius:4,marginBottom:16}}/>
              <SkeletonBlock style={{width:"100%",height:260,borderRadius:8}}/>
            </div>
            <div className="cd-card cd-card-pad" style={{minHeight:340}}>
              <SkeletonBlock style={{width:120,height:14,borderRadius:4,marginBottom:16}}/>
              <SkeletonBlock style={{width:"100%",height:220,borderRadius:8}}/>
            </div>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:18}}>
          {[180,280,200,180,200].map((h,i) => (
            <div key={i} className="cd-card cd-card-pad" style={{minHeight:h}}>
              <SkeletonBlock style={{width:120,height:14,borderRadius:4,marginBottom:16}}/>
              <SkeletonBlock style={{width:"100%",height:h-60,borderRadius:6}}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   CSS — clinical token system + Starship identity preserved
══════════════════════════════════════════════════════ */

const CLINICAL_DASHBOARD_CSS = `
/* ═══ Font face ═══ */
@font-face {
  font-family: 'Vazirmatn';
  src: url('/fonts/Vazirmatn%5Bwght%5D.woff2') format('woff2');
  font-weight: 100 900;
  font-display: swap;
}

/* ═══ Token system: cd- namespace (clinical dashboard) ═══ */

.cd-root {
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  transition: background 0.3s ease, color 0.3s ease;
}

.cd-root[data-theme="light"] {
  /* ── Font stacks ── */
  --cd-font-body:        'Vazirmatn', Tahoma, sans-serif;
  --cd-font-latin-prose: var(--font-preview-serif, 'Source Serif 4'), Georgia, serif;
  --cd-font-ui:          var(--font-preview-sans, 'Inter'), system-ui, sans-serif;

  /* ── Surface ── */
  --cd-bg-base:     #f2f4f7;
  --cd-bg-surface:  #ffffff;
  --cd-bg-panel:    #ffffff;
  --cd-bg-hover:    #f7f8fa;

  /* ── Border ── */
  --cd-border:        #e2e6ed;
  --cd-border-strong: #c8cfd9;

  /* ── Text ── */
  --cd-text-1: #1a2332;
  --cd-text-2: #3d4f66;
  --cd-text-3: #8290a4;

  /* ── Accent: deep teal (clinical) ── */
  --cd-accent:     hsl(181, 68%, 29%);
  --cd-accent-dim: hsl(181, 35%, 94%);
  --cd-accent-glow: hsla(181, 68%, 29%, 0.15);

  /* ── Semantic palette (preserved from original) ── */
  --cd-blue:        #0052cc;
  --cd-blue-dim:    #deebff;
  --cd-violet:      #6554c0;
  --cd-violet-dim:  #eae6ff;
  --cd-cyan:        #0065ff;
  --cd-amber:       #ff991f;
  --cd-amber-dim:   #fff0e6;
  --cd-emerald:     #00875a;
  --cd-emerald-dim: #e3fcef;
  --cd-rose:        #de350b;
  --cd-rose-dim:    #ffebe6;

  /* ── Chrome ── */
  --cd-shadow:    0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.02);
  --cd-shadow-lg: 0 4px 16px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.02);
  --cd-navbar-bg: rgba(255,255,255,0.94);
  --cd-glass-bg:  #ffffff;
  --cd-blur:      blur(20px);

  font-family: var(--cd-font-body);
  background: var(--cd-bg-base);
  color: var(--cd-text-1);
}

.cd-root[data-theme="dark"] {
  /* ── Font stacks ── */
  --cd-font-body:        'Vazirmatn', Tahoma, sans-serif;
  --cd-font-latin-prose: var(--font-preview-serif, 'Source Serif 4'), Georgia, serif;
  --cd-font-ui:          var(--font-preview-sans, 'Inter'), system-ui, sans-serif;

  /* ── Surface ── */
  --cd-bg-base:     #07101f;
  --cd-bg-surface:  #0d1b2e;
  --cd-bg-panel:    rgba(255,255,255,0.055);
  --cd-bg-hover:    rgba(255,255,255,0.07);

  /* ── Border ── */
  --cd-border:        rgba(255,255,255,0.08);
  --cd-border-strong: rgba(255,255,255,0.15);

  /* ── Text ── */
  --cd-text-1: #f0f1f4;
  --cd-text-2: #8290a4;
  --cd-text-3: #505f79;

  /* ── Accent: teal (clinical dark) ── */
  --cd-accent:     hsl(178, 58%, 42%);
  --cd-accent-dim: hsla(178, 28%, 13%, 1);
  --cd-accent-glow: hsla(178, 58%, 42%, 0.25);

  /* ── Semantic palette ── */
  --cd-blue:        #4c9aff;
  --cd-blue-dim:    rgba(76,154,255,0.14);
  --cd-violet:      #998dd9;
  --cd-violet-dim:  rgba(153,141,217,0.14);
  --cd-cyan:        #79e2f2;
  --cd-amber:       #ffab00;
  --cd-amber-dim:   rgba(255,171,0,0.14);
  --cd-emerald:     #57d9a3;
  --cd-emerald-dim: rgba(87,217,163,0.13);
  --cd-rose:        #ff5630;
  --cd-rose-dim:    rgba(255,86,48,0.14);

  /* ── Chrome ── */
  --cd-shadow:    0 1px 4px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.03);
  --cd-shadow-lg: 0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04);
  --cd-navbar-bg: rgba(7,16,31,0.85);
  --cd-glass-bg:  rgba(255,255,255,0.045);
  --cd-blur:      blur(24px) saturate(1.5);

  font-family: var(--cd-font-body);
  background: var(--cd-bg-base);
  color: var(--cd-text-1);
}

/* ═══ Mesh background (dark only, preserved) ═══ */
.cd-mesh {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background:
    radial-gradient(ellipse 80% 60% at 8% 15%, color-mix(in srgb, var(--cd-violet) 12%, transparent) 0%, transparent 60%),
    radial-gradient(ellipse 60% 70% at 92% 80%, color-mix(in srgb, var(--cd-blue) 10%, transparent) 0%, transparent 60%),
    radial-gradient(ellipse 50% 40% at 55% 5%,  color-mix(in srgb, var(--cd-cyan)  8%, transparent) 0%, transparent 50%);
}

/* ═══ Navbar ═══ */
.cd-navbar {
  position: sticky; top: 0; z-index: 100;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 24px; height: 56px;
  background: var(--cd-navbar-bg);
  backdrop-filter: var(--cd-blur);
  border-bottom: 1px solid var(--cd-border);
  box-shadow: var(--cd-shadow);
}
.cd-logo-text {
  font-size: 15px; font-weight: 700; letter-spacing: -0.01em;
  background: linear-gradient(135deg, var(--cd-accent), var(--cd-violet));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}
.cd-nav-links { display: flex; gap: 1px; }
.cd-nav-link {
  padding: 5px 11px; border-radius: 6px; font-size: 12px; font-weight: 500;
  font-family: var(--cd-font-ui);
  color: var(--cd-text-2); cursor: pointer; transition: all 150ms ease;
}
.cd-nav-link:hover, .cd-nav-link.active { background: var(--cd-bg-hover); color: var(--cd-text-1); }
.cd-nav-link.active { color: var(--cd-accent); }
.cd-icon-btn {
  width: 32px; height: 32px; border-radius: 6px; border: 1px solid var(--cd-border);
  background: var(--cd-bg-hover); color: var(--cd-text-2); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 150ms ease; font-size: 11px; font-weight: 600; font-family: var(--cd-font-body);
}
.cd-icon-btn:hover { background: var(--cd-bg-surface); color: var(--cd-text-1); border-color: var(--cd-border-strong); }
.cd-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: linear-gradient(135deg, var(--cd-accent), var(--cd-violet));
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 13px; color: #fff; cursor: pointer;
  box-shadow: 0 0 0 2px var(--cd-accent-dim); transition: all 150ms ease;
}
.cd-avatar:hover { box-shadow: 0 0 0 3px var(--cd-accent); }
.cd-streak {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;
  font-family: var(--cd-font-body);
  color: var(--cd-amber); background: var(--cd-amber-dim);
  border: 1px solid color-mix(in srgb, var(--cd-amber) 20%, transparent);
}
.cd-search-input {
  background: none; border: none; outline: none; font-family: var(--cd-font-body); font-size: 13px;
  color: var(--cd-text-1); width: 100%;
}
.cd-search-input::placeholder { color: var(--cd-text-3); }

/* ═══ Cards — upgraded chrome ═══ */
.cd-card {
  background: var(--cd-glass-bg);
  backdrop-filter: var(--cd-blur);
  border: 1px solid var(--cd-border);
  border-radius: 10px;
  box-shadow: var(--cd-shadow);
  position: relative; overflow: hidden;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.cd-card:hover {
  border-color: var(--cd-border-strong);
  box-shadow: var(--cd-shadow-lg);
}
.cd-card-pad { padding: 18px 20px; }
.cd-card-raised { border-color: var(--cd-border-strong); }
.cd-root[data-theme="light"] .cd-card { background: var(--cd-bg-surface); }

/* ═══ Section headers ═══ */
.cd-section-head {
  display: flex; align-items: center; gap: 10px; margin-bottom: 14px;
}
.cd-section-icon {
  width: 30px; height: 30px; border-radius: 7px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: var(--cd-accent-dim);
  border: 1px solid color-mix(in srgb, var(--cd-accent) 18%, transparent);
}
.cd-section-title {
  font-size: 13px; font-weight: 700; color: var(--cd-text-1);
  letter-spacing: -0.01em; font-family: var(--cd-font-ui);
}
.cd-section-sub {
  font-size: 10px; color: var(--cd-text-3); margin-top: 1px;
  font-family: var(--cd-font-body);
}

/* ═══ KPI row ═══ */
.cd-kpi-row {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px;
}
.cd-kpi-card {
  background: var(--cd-glass-bg); backdrop-filter: var(--cd-blur);
  border: 1px solid var(--cd-border); border-radius: 10px;
  padding: 14px 16px; position: relative; overflow: hidden;
  transition: all 150ms ease; cursor: default;
}
.cd-kpi-card:hover { border-color: var(--cd-border-strong); box-shadow: var(--cd-shadow-lg); transform: translateY(-2px); }
.cd-root[data-theme="light"] .cd-kpi-card { background: var(--cd-bg-surface); }

/* ═══ Buttons ═══ */
.cd-btn-primary {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 14px; border-radius: 6px; border: none; cursor: pointer;
  background: var(--cd-accent); color: #fff; font-family: var(--cd-font-body);
  font-size: 13px; font-weight: 600; transition: all 150ms ease;
}
.cd-btn-primary:hover { opacity: 0.88; box-shadow: 0 4px 12px var(--cd-accent-glow); }
.cd-btn-primary:active {
  box-shadow: 0 0 0 3px var(--cd-accent-glow);
  transition: box-shadow 150ms ease;
}
.cd-btn-ghost {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 7px 12px; border-radius: 6px; cursor: pointer;
  background: var(--cd-bg-hover); color: var(--cd-text-2); border: 1px solid var(--cd-border);
  font-family: var(--cd-font-body); font-size: 13px; font-weight: 500; transition: all 150ms ease;
}
.cd-btn-ghost:hover { background: var(--cd-bg-surface); color: var(--cd-text-1); border-color: var(--cd-border-strong); }

/* ═══ Inputs ═══ */
.cd-input {
  width: 100%; padding: 7px 10px; border-radius: 6px; font-family: var(--cd-font-body); font-size: 12px;
  background: var(--cd-bg-surface); color: var(--cd-text-1);
  border: 1px solid var(--cd-border); outline: none; transition: border-color 150ms ease;
}
.cd-input:focus { border-color: var(--cd-accent); box-shadow: 0 0 0 2px var(--cd-accent-glow); }
.cd-input::placeholder { color: var(--cd-text-3); }

/* ═══ Scrollbar ═══ */
.cd-root ::-webkit-scrollbar { width: 4px; }
.cd-root ::-webkit-scrollbar-track { background: transparent; }
.cd-root ::-webkit-scrollbar-thumb { background: var(--cd-border-strong); border-radius: 99px; }

/* ═══ Skeleton ═══ */
@keyframes cdPulse {
  0%, 100% { opacity: 0.15; }
  50% { opacity: 0.25; }
}
.cd-skeleton {
  background: var(--cd-border);
  animation: cdPulse 1.8s ease-in-out infinite;
}

/* ═══ Named keyframes (preserved from original) ═══ */
@keyframes satFloat {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-6px) rotate(3deg); }
}
@keyframes orbitSpin { to { transform: rotate(360deg); } }

/* ═══ Responsive (preserved) ═══ */
@media (max-width: 1200px) {
  .cd-kpi-row { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 768px) {
  .cd-kpi-row { grid-template-columns: repeat(2, 1fr); }
  .cd-nav-links { display: none; }
}
`;

/* ══════════════════════════════════════════════════════
   ROOT PROVIDER + MAIN EXPORT
══════════════════════════════════════════════════════ */

function DashboardInner() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [showSkeleton, setShowSkeleton] = useState(false);

  return (
    <>
      <style>{CLINICAL_DASHBOARD_CSS}</style>
      <div className="cd-root" data-theme={theme}>
        {/* ── Decorative identity layer (dark only, preserved exactly) ── */}
        {isDark && <>
          <div className="cd-mesh"/>
          <StarField/>
          {/* Orbital ring */}
          <div style={{position:"fixed",top:"-180px",right:"-150px",width:"500px",height:"500px",
            borderRadius:"50%",border:"1px solid rgba(76,154,255,0.05)",
            pointerEvents:"none",zIndex:0,animation:"orbitSpin 80s linear infinite"}}/>
          {/* Large dim Saturn */}
          <div style={{position:"fixed",bottom:"-120px",left:"-140px",opacity:0.04,
            zIndex:0,pointerEvents:"none",animation:"satFloat 18s ease-in-out infinite"}}>
            <SaturnIcon size={460}/>
          </div>
        </>}

        {/* ── Content ── */}
        <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",minHeight:"100vh"}}>
          <Navbar/>

          {showSkeleton ? (
            <UpgradedSkeleton/>
          ) : (
            <main style={{flex:1,maxWidth:1440,margin:"0 auto",width:"100%",
              padding:"24px 20px 48px"}}>

              {/* KPI Row */}
              <KPIRow/>

              {/* Main grid: content + 360px sidebar */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 360px",gap:18,marginTop:18}}>

                {/* ── LEFT COLUMN ── */}
                <div style={{display:"flex",flexDirection:"column",gap:18}}>
                  {/* Row 1: Next Recommended + Priority Queue */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
                    <NextRecommended/>
                    <PriorityQueue/>
                  </div>
                  {/* Row 2: Radar + Accuracy */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
                    <MasteryRadar/>
                    <AccuracyTrend/>
                  </div>
                  {/* Row 3: Traps + Notes */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
                    <TrapQuestions/>
                    <StudyNotes/>
                  </div>
                </div>

                {/* ── RIGHT COLUMN ── */}
                <div style={{display:"flex",flexDirection:"column",gap:18}}>
                  <DailyGoals/>
                  <JalaliMiniCalendar/>
                  <WeakSpots/>
                  <QuickActions/>
                  <ActivityFeed/>
                </div>
              </div>
            </main>
          )}

          {/* Footer */}
          <footer style={{borderTop:"1px solid var(--cd-border)",padding:"16px 24px",
            display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <SaturnIcon size={16}/>
            <span style={{fontSize:10,fontWeight:600,color:"var(--cd-text-3)",letterSpacing:"0.1em",
              fontFamily:"var(--cd-font-ui)"}}>
              HOSSEIN STARSHIP — MEDICAL COMMAND CENTER · v2.0.26
            </span>
          </footer>
        </div>
      </div>
    </>
  );
}

export default function ClinicalDashboardPreview() {
  const [theme, setTheme] = useState<Theme>("dark");
  const toggle = useCallback(() => setTheme(t => t === "dark" ? "light" : "dark"), []);
  return (
    <ThemeCtx.Provider value={{ theme, toggle }}>
      <DashboardInner/>
    </ThemeCtx.Provider>
  );
}
