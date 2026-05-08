'use client';

/**
 * DashboardShell.tsx — URO-ZERO v2
 * Medical Command Center · داشبورد بورد ارولوژی
 *
 * Font setup — add ONE of these:
 *
 * Option A (next/font — recommended):
 *   // app/layout.tsx
 *   import { Vazirmatn } from 'next/font/google';
 *   import { IBM_Plex_Mono } from 'next/font/google';
 *   const vazir = Vazirmatn({ subsets: ['arabic'], variable: '--font-vazir' });
 *   const mono  = IBM_Plex_Mono({ weight: ['500','600'], subsets: ['latin'], variable: '--font-mono' });
 *
 * Option B (globals.css):
 *   @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
 */

import { useState, useEffect } from 'react';
import {
  ClipboardCheck as CloudCheck, Cloud, RefreshCw, AlertCircle,
  ChevronLeft, Target, CreditCard, FileText, Upload,
} from 'lucide-react';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type SyncStatus    = 'synced' | 'syncing' | 'error' | 'offline';
export type FsrsCardState = 'new' | 'learning' | 'review' | 'relearning';

export interface FsrsCard {
  id: string;
  /** English clinical concept title */
  title: string;
  /** Persian chapter label */
  chapterFa: string;
  /** 0–10 — your board-relevance signal */
  yieldScore: number;
  /** Human-readable due time in Persian */
  dueIn: string;
  state: FsrsCardState;
  /** FSRS S (stability) parameter */
  stability: number;
  /** FSRS D (difficulty) parameter */
  difficulty: number;
}

export interface McqChapterStat {
  chapterFa: string;
  accuracy: number;   // 0–100
  answered: number;
  total: number;
}

export interface ChapterCoverage {
  sectionName: string;
  cwwRef: string;     // e.g. "Vol I · Ch 1–8"
  pct: number;        // 0–100 mastery
  done: number;
  total: number;
}

export interface ActivityItem {
  id: string;
  type: 'mcq' | 'fsrs' | 'note' | 'sync';
  text: string;
  timeAgo: string;
}

export interface DashboardStats {
  cardsDueToday: number;
  mcqThisWeek: number;
  overallAccuracy: number;  // 0–100
  streakDays: number;
  boardReadinessPct: number; // 0–100
  daysUntilBoard: number;
}

export interface DashboardShellProps {
  stats?: DashboardStats;
  fsrsQueue?: FsrsCard[];
  mcqByChapter?: McqChapterStat[];
  chapterCoverage?: ChapterCoverage[];
  recentActivity?: ActivityItem[];
  syncStatus?: SyncStatus;
  lastSyncedAt?: Date | null;
  /** Navigate to /study */
  onStartStudy?: () => void;
  /** Open FSRS optimizer */
  onOptimizeFsrs?: () => void;
}

// ─────────────────────────────────────────────
// DEMO / FALLBACK DATA
// Swap out for real PGLite queries via useDashboardData()
// ─────────────────────────────────────────────

const DEMO_STATS: DashboardStats = {
  cardsDueToday: 47, mcqThisWeek: 128,
  overallAccuracy: 78, streakDays: 14,
  boardReadinessPct: 55, daysUntilBoard: 84,
};

const DEMO_FSRS: FsrsCard[] = [
  { id:'1', title:'Renal Cell Carcinoma — TNM Staging',          chapterFa:'کلیه',    yieldScore:9.2, dueIn:'اکنون',     state:'review',     stability:12.4, difficulty:0.32 },
  { id:'2', title:'BPH — Alpha-blockers vs 5-ARI Mechanisms',    chapterFa:'پروستات', yieldScore:8.8, dueIn:'۳ دقیقه',  state:'review',     stability:8.7,  difficulty:0.41 },
  { id:'3', title:'Bladder Cancer — BCG Immunotherapy Protocol',  chapterFa:'مثانه',   yieldScore:8.5, dueIn:'۱۵ دقیقه', state:'new',        stability:0,    difficulty:0.30 },
  { id:'4', title:'Ureteroscopy — Intraoperative Complications',  chapterFa:'مجاری',   yieldScore:7.9, dueIn:'۱ ساعت',   state:'review',     stability:21.3, difficulty:0.28 },
  { id:'5', title:'Testicular Torsion — Bell-Clapper Deformity',  chapterFa:'بیضه',    yieldScore:7.4, dueIn:'۳ ساعت',   state:'relearning', stability:2.1,  difficulty:0.58 },
];

const DEMO_MCQ: McqChapterStat[] = [
  { chapterFa:'کلیه',    accuracy:82, answered:45, total:60 },
  { chapterFa:'مجاری',   accuracy:71, answered:32, total:50 },
  { chapterFa:'مثانه',   accuracy:78, answered:28, total:45 },
  { chapterFa:'پروستات', accuracy:65, answered:38, total:70 },
  { chapterFa:'آلت',     accuracy:88, answered:21, total:30 },
  { chapterFa:'بیضه',    accuracy:74, answered:19, total:35 },
  { chapterFa:'آدرنال',  accuracy:69, answered:15, total:25 },
];

const DEMO_COVERAGE: ChapterCoverage[] = [
  { sectionName:'Kidney & Upper Tract',       cwwRef:'Vol I · Ch 1–8',    pct:72, done:86, total:120 },
  { sectionName:'Bladder & Urethra',          cwwRef:'Vol II · Ch 9–15',  pct:58, done:55, total:95  },
  { sectionName:'Prostate',                   cwwRef:'Vol II · Ch 16–21', pct:45, done:50, total:110 },
  { sectionName:'Male Genitalia',             cwwRef:'Vol III · Ch 22–27',pct:83, done:71, total:85  },
  { sectionName:'Adrenal & Retroperitoneum',  cwwRef:'Vol I · Ch 28–31',  pct:35, done:21, total:60  },
  { sectionName:'Pediatric Urology',          cwwRef:'Vol III · Ch 32–38',pct:20, done:28, total:140 },
];

const DEMO_ACTIVITY: ActivityItem[] = [
  { id:'1', type:'mcq',  text:'۱۲ MCQ پاسخ داد — Renal Physiology & Pathology', timeAgo:'۲۰ دقیقه پیش' },
  { id:'2', type:'fsrs', text:'۲۵ کارت FSRS مرور کرد — Prostate & Bladder',     timeAgo:'۱ ساعت پیش'  },
  { id:'3', type:'note', text:'یادداشت: Transitional Cell Carcinoma staging',    timeAgo:'دیروز'        },
  { id:'4', type:'sync', text:'Neon sync — ۳۴۱ رکورد — FK violations: ۰',       timeAgo:'دیروز'        },
];

// ─────────────────────────────────────────────
// DESIGN TOKENS (CSS injected via <style> tag)
// ─────────────────────────────────────────────

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');

.uro-shell {
  --bg:       #07090C;
  --s1:       #0D1117;
  --s2:       #141A22;
  --b1:       rgba(255,255,255,0.07);
  --b2:       rgba(255,255,255,0.13);
  --t1:       #E6E6E0;
  --t2:       #787870;
  --t3:       #38383A;
  --green:    #00D9A8;
  --gd:       rgba(0,217,168,0.10);
  --gd2:      rgba(0,217,168,0.18);
  --amber:    #F59E0B;
  --ad:       rgba(245,158,11,0.10);
  --blue:     #60A5FA;
  --bd:       rgba(96,165,250,0.10);
  --red:      #F87171;
  --rd:       rgba(248,113,113,0.10);

  background: var(--bg);
  color: var(--t1);
  direction: rtl;
  font-family: Vazirmatn, system-ui, sans-serif;
  min-height: 100vh;
  padding: 20px 20px 40px;
}

.uro-shell .mono {
  font-family: 'IBM Plex Mono', monospace;
  font-feature-settings: 'tnum';
}

/* ── Cards ── */
.uro-card {
  background: var(--s1);
  border: 1px solid var(--b1);
  border-radius: 12px;
  padding: 18px 20px;
}
.uro-card-sm {
  background: var(--s1);
  border: 1px solid var(--b1);
  border-radius: 8px;
  padding: 11px 13px;
}

/* ── Progress bar ── */
.uro-track {
  background: var(--s2);
  border-radius: 99px;
  overflow: hidden;
}
.uro-fill {
  height: 100%;
  border-radius: 99px;
}

/* ── Sync badge ── */
.uro-sync {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
}

/* ── Tags ── */
.uro-tag {
  display: inline-flex;
  align-items: center;
  font-size: 9px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.02em;
}

/* ── FSRS rows ── */
.uro-fsrs-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 8px;
  border: 1px solid var(--b1);
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}
.uro-fsrs-row:hover { background: var(--s2); border-color: var(--b2); }
.uro-urgency-strip { width: 3px; border-radius: 2px; align-self: stretch; flex-shrink: 0; }

/* ── Activity icon ── */
.uro-act-icon {
  width: 26px; height: 26px;
  border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

/* ── Button ── */
.uro-btn-primary {
  display: block; width: 100%;
  background: var(--green); color: #000;
  border: none; border-radius: 8px;
  padding: 9px 0;
  font-size: 12px; font-weight: 600;
  font-family: Vazirmatn, system-ui, sans-serif;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.12s;
  letter-spacing: 0.01em;
}
.uro-btn-primary:hover  { opacity: 0.86; transform: translateY(-1px); }
.uro-btn-primary:active { opacity: 1; transform: translateY(0); }

.uro-btn-ghost {
  background: none; border: none; padding: 0;
  color: var(--blue); font-size: 10px;
  font-family: Vazirmatn, system-ui, sans-serif;
  cursor: pointer; opacity: 0.75;
  display: flex; align-items: center; gap: 2px;
  transition: opacity 0.15s;
}
.uro-btn-ghost:hover { opacity: 1; }

/* ── Divider ── */
.uro-divider { border: none; border-top: 1px solid var(--b1); margin: 10px 0; }

/* ── Animations ── */
@keyframes uro-bar-up {
  from { transform: scaleY(0); opacity: 0; }
  to   { transform: scaleY(1); opacity: 1; }
}
.uro-bar {
  transform-origin: bottom;
  animation: uro-bar-up 0.5s cubic-bezier(0.34,1.4,0.64,1) both;
}

@keyframes uro-gauge {
  from { stroke-dashoffset: 220; }
}
.uro-gauge-arc {
  animation: uro-gauge 1.1s cubic-bezier(0.4,0,0.2,1) 0.2s both;
}

@keyframes uro-fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.uro-fade { animation: uro-fade-up 0.4s ease both; }
`;

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────

function accColor(pct: number)    { return pct >= 80 ? '#00D9A8' : pct >= 70 ? '#60A5FA' : '#F59E0B'; }
function covBarColor(pct: number) { return pct >= 70 ? '#00D9A8' : pct >= 50 ? '#60A5FA' : '#F59E0B'; }
function covTxtColor(pct: number) { return pct >= 70 ? '#00D9A8' : pct >= 50 ? '#60A5FA' : '#F59E0B'; }

// ─────────────────────────────────────────────
// CONFIG MAPS
// ─────────────────────────────────────────────

const FSRS_CFG: Record<FsrsCardState, { label:string; color:string; bg:string }> = {
  new:        { label:'جدید',       color:'#60A5FA', bg:'rgba(96,165,250,0.10)'   },
  learning:   { label:'یادگیری',   color:'#F59E0B', bg:'rgba(245,158,11,0.10)'   },
  review:     { label:'مرور',       color:'#00D9A8', bg:'rgba(0,217,168,0.10)'    },
  relearning: { label:'بازیادگیری', color:'#F87171', bg:'rgba(248,113,113,0.10)'  },
};

const SYNC_CFG: Record<SyncStatus, { icon:React.ReactNode; label:string; color:string; bg:string }> = {
  synced:  { icon:<CloudCheck  size={12}/>, label:'همگام‌سازی شد · Neon',     color:'#00D9A8', bg:'rgba(0,217,168,0.10)'   },
  syncing: { icon:<RefreshCw   size={12} className="animate-spin"/>, label:'در حال همگام‌سازی...', color:'#60A5FA', bg:'rgba(96,165,250,0.10)'  },
  error:   { icon:<AlertCircle size={12}/>, label:'خطا در همگام‌سازی',       color:'#F87171', bg:'rgba(248,113,113,0.10)' },
  offline: { icon:<Cloud       size={12}/>, label:'آفلاین · PGLite',          color:'#787870', bg:'rgba(120,120,112,0.10)' },
};

const ACT_CFG: Record<ActivityItem['type'], { icon:React.ReactNode; color:string; bg:string }> = {
  mcq:  { icon:<Target    size={13}/>, color:'#00D9A8', bg:'rgba(0,217,168,0.12)'   },
  fsrs: { icon:<CreditCard size={13}/>, color:'#60A5FA', bg:'rgba(96,165,250,0.12)'  },
  note: { icon:<FileText  size={13}/>, color:'#787870', bg:'rgba(120,120,112,0.10)' },
  sync: { icon:<Upload    size={13}/>, color:'#00D9A8', bg:'rgba(0,217,168,0.12)'   },
};

// ─────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────

/** Count-up animation hook */
function useCountUp(target: number, duration = 700): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start: number | null = null;
    const raf = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setVal(Math.round(p * target));
      if (p < 1) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

/** Radial readiness gauge — 270° arc */
function ReadinessGauge({ pct }: { pct: number }) {
  const R = 44;
  const C = 2 * Math.PI * R;       // full circumference ≈ 276.5
  const ARC = C * 0.75;            // 270° visible arc
  const offset = ARC * (1 - pct / 100);

  return (
    <div style={{ position:'relative', width:128, height:128, flexShrink:0 }}>
      <svg width={128} height={128} viewBox="0 0 128 128" aria-label={`آمادگی بورد: ${pct} درصد`}>
        {/* Track */}
        <circle cx={64} cy={64} r={R} fill="none"
          stroke="rgba(255,255,255,0.06)" strokeWidth={8} strokeLinecap="round"
          strokeDasharray={`${ARC} ${C - ARC}`}
          transform="rotate(135 64 64)"
        />
        {/* Filled arc — animated */}
        <circle cx={64} cy={64} r={R} fill="none"
          stroke="#00D9A8" strokeWidth={8} strokeLinecap="round"
          strokeDasharray={`${ARC} ${C - ARC}`}
          strokeDashoffset={offset}
          transform="rotate(135 64 64)"
          className="uro-gauge-arc"
          style={{ filter:'drop-shadow(0 0 6px rgba(0,217,168,0.4))' } as React.CSSProperties}
        />
      </svg>
      {/* Center */}
      <div style={{
        position:'absolute', inset:0,
        display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
      }}>
        <span className="mono" style={{ fontSize:24, fontWeight:600, color:'#00D9A8', lineHeight:1 }}>
          {pct}٪
        </span>
        <span style={{ fontSize:10, color:'var(--t2)', marginTop:4, lineHeight:1 }}>آمادگی بورد</span>
      </div>
    </div>
  );
}

/** SVG bar chart — no external dependency */
function McqChart({ data }: { data: McqChapterStat[] }) {
  const MIN=50, MAX=100, H=115, BW=28, GAP=16;
  const W = data.length * (BW + GAP) + 26;
  return (
    <div style={{ overflowX:'auto' }}>
      <svg width={W} height={H+40} viewBox={`0 0 ${W} ${H+40}`} style={{ overflow:'visible' }}
        role="img" aria-label="نمودار دقت MCQ به تفکیک فصل">
        {/* Gridlines */}
        {[60,70,80,90].map(v => {
          const y = H - ((v-MIN)/(MAX-MIN))*H;
          return <g key={v}>
            <line x1={20} y1={y} x2={W} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={0.5}/>
            <text x={18} y={y+3} fontSize={7.5} fill="rgba(255,255,255,0.2)" textAnchor="end">{v}</text>
          </g>;
        })}
        {/* Bars */}
        {data.map((d, i) => {
          const x = i*(BW+GAP)+22;
          const bh = ((d.accuracy-MIN)/(MAX-MIN))*H;
          const y = H-bh;
          const c = accColor(d.accuracy);
          return <g key={d.chapterFa}>
            {/* Glow */}
            <rect x={x} y={y} width={BW} height={bh} fill={c} rx={4} opacity={0.15} transform="translate(0,3)"/>
            {/* Bar */}
            <rect x={x} y={y} width={BW} height={bh} fill={c} rx={4}
              className="uro-bar"
              style={{ animationDelay:`${i*0.07}s` } as React.CSSProperties}
            />
            <text x={x+BW/2} y={y-5} fontSize={9} fill={c} textAnchor="middle" fontWeight="600">{d.accuracy}٪</text>
            <text x={x+BW/2} y={H+15} fontSize={9} fill="rgba(255,255,255,0.4)" textAnchor="middle">{d.chapterFa}</text>
            <text x={x+BW/2} y={H+27} fontSize={7} fill="rgba(255,255,255,0.18)" textAnchor="middle">{d.answered}/{d.total}</text>
          </g>;
        })}
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

export function DashboardShell({
  stats           = DEMO_STATS,
  fsrsQueue       = DEMO_FSRS,
  mcqByChapter    = DEMO_MCQ,
  chapterCoverage = DEMO_COVERAGE,
  recentActivity  = DEMO_ACTIVITY,
  syncStatus      = 'synced',
  lastSyncedAt    = null,
  onStartStudy,
  onOptimizeFsrs,
}: DashboardShellProps) {
  const [todayFa, setTodayFa] = useState('');
  const daysLeft = useCountUp(stats.daysUntilBoard);

  useEffect(() => {
    setTodayFa(new Date().toLocaleDateString('fa-IR', { year:'numeric', month:'long', day:'numeric' }));
  }, []);

  const sync          = SYNC_CFG[syncStatus];
  const masteredCount = chapterCoverage.filter(c => c.pct >= 70).length;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }}/>

      <div className="uro-shell">

        {/* ── HEADER ──────────────────────────────── */}
        <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{
              width:36, height:36, borderRadius:10, flexShrink:0,
              background:'rgba(0,217,168,0.08)', border:'1px solid rgba(0,217,168,0.18)',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              {/* Stethoscope icon (inline SVG — no import needed) */}
              <svg width={17} height={17} viewBox="0 0 24 24" fill="none"
                stroke="#00D9A8" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
                <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/>
                <circle cx={20} cy={10} r={2}/>
              </svg>
            </div>
            <div>
              <h1 className="mono" style={{ fontSize:14, fontWeight:600, letterSpacing:'0.06em', margin:0, lineHeight:1 }}>
                URO<span style={{ color:'#00D9A8' }}>-ZERO</span>
              </h1>
              <p style={{ fontSize:10, color:'var(--t3)', margin:'3px 0 0', lineHeight:1 }}>
                پلتفرم جامع بورد ارولوژی · Campbell-Walsh-Wein
              </p>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span className="uro-sync" style={{ background:sync.bg, color:sync.color }}>
              {sync.icon}{sync.label}
            </span>
            {todayFa && <span style={{ fontSize:10, color:'var(--t3)' }}>{todayFa}</span>}
          </div>
        </header>

        {/* ── HERO — Gauge + Stats + Countdown ─────── */}
        <div style={{ display:'grid', gridTemplateColumns:'auto 1fr 120px', gap:12, marginBottom:12, alignItems:'stretch' }}>

          {/* Radial gauge */}
          <div className="uro-card" style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, padding:'20px 26px' }}>
            <ReadinessGauge pct={stats.boardReadinessPct}/>
            <p style={{ fontSize:9.5, color:'var(--t3)', margin:0 }}>
              {masteredCount}/{chapterCoverage.length} فصل تسلط ≥۷۰٪
            </p>
          </div>

          {/* Key stats grid */}
          <div className="uro-card" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {[
              { label:'کارت‌های سررسید FSRS', val:<>{stats.cardsDueToday}<span style={{fontSize:11,color:'var(--t2)',fontFamily:'Vazirmatn,sans-serif',fontWeight:400}}> کارت</span></>, color:'#F59E0B' },
              { label:'MCQ این هفته',          val:<>{stats.mcqThisWeek}<span  style={{fontSize:11,color:'var(--t2)',fontFamily:'Vazirmatn,sans-serif',fontWeight:400}}> سوال</span></>, color:'#60A5FA' },
              { label:'دقت کلی',              val:<>{stats.overallAccuracy}٪</>,                                                                                                     color:'#00D9A8' },
              { label:'رشته مطالعه',          val:<>{stats.streakDays}<span    style={{fontSize:11,color:'var(--t2)',fontFamily:'Vazirmatn,sans-serif',fontWeight:400}}> روز 🔥</span></>, color:'var(--t1)' },
            ].map(s => (
              <div key={String(s.label)} style={{ display:'flex', flexDirection:'column', gap:3 }}>
                <span style={{ fontSize:10, color:'var(--t2)' }}>{s.label}</span>
                <span className="mono uro-fade" style={{ fontSize:22, fontWeight:600, color:s.color, lineHeight:1 }}>
                  {s.val}
                </span>
              </div>
            ))}
            {/* ABU benchmark */}
            <div style={{ gridColumn:'1/-1' }}>
              <hr className="uro-divider"/>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:10, color:'var(--t2)', whiteSpace:'nowrap' }}>ABU Benchmark</span>
                <div className="uro-track" style={{ flex:1, height:3 }}>
                  <div className="uro-fill" style={{ width:`${stats.overallAccuracy}%`, background:'#00D9A8', height:'100%',
                    transition:'width 0.8s cubic-bezier(0.4,0,0.2,1)' }}/>
                </div>
                <span className="mono" style={{ fontSize:10, color:'var(--t3)', minWidth:24, textAlign:'left' }}>70٪</span>
              </div>
            </div>
          </div>

          {/* Countdown */}
          <div className="uro-card" style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', gap:4 }}>
            <span style={{ fontSize:10, color:'var(--t2)' }}>بورد تخصصی</span>
            <span className="mono uro-fade" style={{ fontSize:40, fontWeight:600, color:'var(--t1)', lineHeight:1 }}>{daysLeft}</span>
            <span style={{ fontSize:10, color:'var(--t3)' }}>روز مانده</span>
            <div style={{ width:'100%', marginTop:8 }}>
              <div className="uro-track" style={{ height:3 }}>
                <div className="uro-fill" style={{ width:`${stats.boardReadinessPct}%`, background:'#00D9A8', height:'100%',
                  transition:'width 0.8s cubic-bezier(0.4,0,0.2,1)' }}/>
              </div>
            </div>
          </div>
        </div>

        {/* ── MCQ CHART + FSRS QUEUE ───────────────── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>

          <div className="uro-card">
            <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:10 }}>
              <div>
                <p style={{ fontSize:12, fontWeight:500, margin:0 }}>عملکرد MCQ — به تفکیک فصل</p>
                <p style={{ fontSize:9, color:'var(--t3)', margin:'3px 0 0' }}>Campbell-Walsh-Wein Urology</p>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                {([['≥۸۰٪','#00D9A8'],['۷۰–۷۹','#60A5FA'],['<۷۰','#F59E0B']] as const).map(([l,c]) => (
                  <span key={l} style={{ fontSize:9, color:'var(--t2)', display:'flex', alignItems:'center', gap:3 }}>
                    <span style={{ width:6, height:6, borderRadius:2, background:c, display:'inline-block' }}/>
                    {l}
                  </span>
                ))}
              </div>
            </div>
            <McqChart data={mcqByChapter}/>
          </div>

          <div className="uro-card" style={{ display:'flex', flexDirection:'column' }}>
            <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:10 }}>
              <div>
                <p style={{ fontSize:12, fontWeight:500, margin:0 }}>صف مطالعه FSRS</p>
                <p style={{ fontSize:9, color:'var(--t3)', margin:'3px 0 0' }}>مرتب‌شده بر اساس YIELD Score</p>
              </div>
              {onOptimizeFsrs && (
                <button className="uro-btn-ghost" onClick={onOptimizeFsrs}>
                  بهینه‌سازی <ChevronLeft size={10}/>
                </button>
              )}
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:6, flex:1 }}>
              {fsrsQueue.map((card, i) => {
                const cfg = FSRS_CFG[card.state];
                return (
                  <div key={card.id} className="uro-fsrs-row"
                    style={{ animationDelay:`${i*0.06}s` } as React.CSSProperties}
                  >
                    <div className="uro-urgency-strip" style={{ background:cfg.color, opacity:0.75 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:11, fontWeight:500, margin:0, direction:'ltr', textAlign:'left',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--t1)' }}>
                        {card.title}
                      </p>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                        <span className="uro-tag" style={{ background:cfg.bg, color:cfg.color }}>{cfg.label}</span>
                        <span style={{ fontSize:9, color:'var(--t2)' }}>{card.chapterFa}</span>
                        <span style={{ fontSize:9, color:'var(--t3)' }}>·</span>
                        <span style={{ fontSize:9, color:'var(--t2)' }}>{card.dueIn}</span>
                        {card.stability > 0 && (
                          <span className="mono" style={{ fontSize:8, color:'var(--t3)', marginRight:'auto', direction:'ltr' }}>
                            S:{card.stability.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign:'center', minWidth:34, flexShrink:0 }}>
                      <span className="mono" style={{ fontSize:13, fontWeight:600, color:'#F59E0B', display:'block' }}>
                        {card.yieldScore.toFixed(1)}
                      </span>
                      <span style={{ fontSize:7.5, color:'var(--t3)' }}>YIELD</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {onStartStudy && (
              <button className="uro-btn-primary" onClick={onStartStudy} style={{ marginTop:12 }}>
                شروع مطالعه · {fsrsQueue.length} کارت
              </button>
            )}
          </div>
        </div>

        {/* ── CHAPTER COVERAGE ─────────────────────── */}
        <div className="uro-card" style={{ marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:14 }}>
            <div>
              <p style={{ fontSize:12, fontWeight:500, margin:0 }}>پوشش فصول CWW Urology</p>
              <p style={{ fontSize:9, color:'var(--t3)', margin:'3px 0 0' }}>درصد تسلط بر موضوعات اصلی بورد ABU</p>
            </div>
            <span style={{ fontSize:10, color:'var(--t2)' }}>{masteredCount}/{chapterCoverage.length} فصل ≥۷۰٪</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:8 }}>
            {chapterCoverage.map(ch => (
              <div key={ch.sectionName} className="uro-card-sm">
                <p style={{ fontSize:11, fontWeight:500, margin:'0 0 1px', color:'var(--t1)' }}>{ch.sectionName}</p>
                <p style={{ fontSize:9, color:'var(--t3)', margin:'0 0 8px', direction:'ltr', textAlign:'right' }}>{ch.cwwRef}</p>
                <div className="uro-track" style={{ height:3, marginBottom:5 }}>
                  <div className="uro-fill" style={{ width:`${ch.pct}%`, background:covBarColor(ch.pct), height:'100%',
                    transition:'width 0.7s cubic-bezier(0.4,0,0.2,1)' }}/>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:9 }}>
                  <span style={{ color:'var(--t2)' }}>{ch.done} از {ch.total}</span>
                  <span className="mono" style={{ fontWeight:600, color:covTxtColor(ch.pct) }}>{ch.pct}٪</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── ACTIVITY FEED ────────────────────────── */}
        <div className="uro-card">
          <p style={{ fontSize:12, fontWeight:500, margin:'0 0 14px' }}>فعالیت اخیر</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:'10px 28px' }}>
            {recentActivity.map(act => {
              const cfg = ACT_CFG[act.type];
              return (
                <div key={act.id} style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                  <div className="uro-act-icon" style={{ background:cfg.bg, color:cfg.color }}>{cfg.icon}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:11, margin:0, color:'var(--t1)', lineHeight:1.45 }}>{act.text}</p>
                    <p style={{ fontSize:9, margin:'3px 0 0', color:'var(--t3)' }}>{act.timeAgo}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </>
  );
}