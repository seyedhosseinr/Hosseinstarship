"use client";

/**
 * FlashcardHub  v4.0 — Flagship 2026
 * Main /flashcards page — browse, search, navigate to review.
 * Same design DNA as Library v4.0, QBank v4.0 & Dashboard v5.0.
 * CSS-in-JSX pattern, FC-* classes, fully Persian.
 */

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Brain, Search, BookOpen, LayoutGrid,
  Layers, Hash, BarChart3, Clock3,
  AlertTriangle, CreditCard, ChevronLeft,
  Sparkles, TrendingUp,
} from "lucide-react";
import { BidiText } from "@/components/shared/BidiText";

/* ── Type shims matching flashcard-service return shapes ── */
export interface FCStats {
  total: number;
  due: number;
  reviewed: number;
  learning: number;
  leech: number;
  hardReviews: number;
  hardReviews7d: number;
  difficultCards: number;
  avgDifficulty: number;
  newCount: number;
  suspended: number;
  deckCount: number;
  recentReviewCount: number;
  recentActivity: Array<{ id: string; flashcardFrontHtml: string; reviewedAt: number; rating: 1|2|3|4 }>;
}

export interface FCCard {
  id: string;
  frontHtml: string;
  backHtml: string;
  cardType: string;
  chapterNo: number | null;
  chapterTitle: string | null;
  deck: string | null;
  isLeech: boolean;
  isSuspended: boolean;
  fsrsState: string;
  fsrsDue: number | null;
  sourceDocId: string | null;
  sourceFrameId: string | null;
}

/* ════════════════════════════════════════
   CSS — Dashboard-aligned design language (mesh gradient, glass, accent lines)
════════════════════════════════════════ */
const CSS = `
.FC*,.FC*::before,.FC*::after{box-sizing:border-box;margin:0;padding:0;}

/* ══ Tokens — Light (aligned with HosseinStarshipDashboard v5) ══ */
.FC{
  --a:         hsl(166 90% 26%);
  --a2:        hsl(38  92% 50%);
  --a3:        hsl(213 94% 57%);
  --a-glow:    color-mix(in srgb,hsl(166 90% 26%) 28%,transparent);
  --a-dim:     color-mix(in srgb,hsl(166 90% 26%) 10%,transparent);
  --a-dim2:    color-mix(in srgb,hsl(166 90% 26%) 17%,transparent);
  --blue:      #0369A1; --teal:#0D9488; --emerald:#047857;
  --rose:      #BE123C; --amber:#D97706; --violet:#7C3AED; --sky:#0284C7; --cyan:#0891B2;
  --bg:        hsl(165 18% 96%);
  --surface:   linear-gradient(155deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.60) 100%);
  --surface-solid: #ffffff;
  --solid:     hsl(168 20% 98%);
  --hover:     hsl(168 16% 94%);
  --bd:        hsl(168 14% 88%);
  --bd-s:      hsl(168 12% 91%);
  --bd-glass:  rgba(255,255,255,0.75);
  --t1:        hsl(200 60% 8%);
  --t2:        hsl(200 22% 22%);
  --t3:        hsl(200 12% 42%);
  --blur:      none;
  --sh:        0 2px 8px rgba(0,70,60,.06),0 10px 40px rgba(0,70,60,.08),inset 0 1px 0 rgba(255,255,255,0.98);
  --sh-lg:     0 16px 56px rgba(0,70,60,.13),0 0 0 1.5px color-mix(in srgb,var(--a) 35%,transparent),inset 0 1px 0 rgba(255,255,255,0.98);
  --noise:     url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
}
/* ══ Tokens — Dark ══ */
.dark .FC{
  --a:hsl(172 72% 46%); --a2:hsl(38 88% 58%); --a3:hsl(213 80% 65%);
  --a-glow:color-mix(in srgb,hsl(172 72% 46%) 32%,transparent);
  --a-dim:color-mix(in srgb,hsl(172 72% 46%) 13%,transparent);
  --a-dim2:color-mix(in srgb,hsl(172 72% 46%) 20%,transparent);
  --blue:#22D3EE; --teal:#2DD4BF; --emerald:#34D399;
  --rose:#FB7185; --amber:#FBBF24; --violet:#A78BFA; --sky:#38BDF8; --cyan:#67E8F9;
  --bg:hsl(195 22% 5%);
  --surface:linear-gradient(155deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.025) 100%);
  --surface-solid:hsl(190 22% 9%);
  --solid:hsl(195 22% 8%); --hover:hsl(195 16% 12%);
  --bd:hsl(190 14% 16%); --bd-s:hsl(190 12% 13%);
  --bd-glass:rgba(80,210,190,0.10);
  --t1:hsl(170 16% 96%); --t2:hsl(170 10% 74%); --t3:hsl(170 8% 56%);
  --sh:0 2px 6px rgba(0,0,0,.22),0 8px 28px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.06);
  --sh-lg:0 12px 48px rgba(0,0,0,.30),0 0 0 1.5px color-mix(in srgb,var(--a) 35%,transparent),inset 0 1px 0 rgba(255,255,255,.07);
}

/* ══ ROOT ══ */
.FC{
  display:flex; flex-direction:column; min-height:100dvh;
  font-family:var(--font-vazir,'Vazirmatn'),Tahoma,system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;
  background:var(--bg); color:var(--t1);
  position:relative; direction:rtl; overflow-x:hidden;
}

/* ══ Background — mesh gradient aurora (matches dashboard hs-mesh) ══ */
.FC-bg{ position:fixed; inset:0; z-index:0; pointer-events:none; overflow:hidden; }
.FC-mesh{
  position:absolute; inset:0; pointer-events:none;
  background:
    radial-gradient(ellipse 120% 80% at 0% 0%, color-mix(in srgb, var(--a) 28%, transparent) 0%, transparent 55%),
    radial-gradient(ellipse 80% 100% at 100% 100%, color-mix(in srgb, var(--blue) 22%, transparent) 0%, transparent 55%),
    radial-gradient(ellipse 70% 60% at 60% 0%, color-mix(in srgb, var(--emerald) 16%, transparent) 0%, transparent 48%),
    radial-gradient(ellipse 60% 80% at 15% 100%, color-mix(in srgb, var(--violet) 22%, transparent) 0%, transparent 48%),
    radial-gradient(circle 45% at 80% 30%, color-mix(in srgb, var(--cyan) 14%, transparent) 0%, transparent 42%),
    radial-gradient(circle 35% at 40% 55%, color-mix(in srgb, var(--amber) 9%, transparent) 0%, transparent 38%);
  animation:fcMesh 20s ease-in-out infinite alternate;
}
@keyframes fcMesh{
  0%{ filter:hue-rotate(0deg) saturate(1); }
  50%{ filter:hue-rotate(4deg) saturate(1.06); }
  100%{ filter:hue-rotate(-4deg) saturate(1.03); }
}
.FC-noise{
  position:absolute; inset:0; pointer-events:none;
  opacity:.025; background-image:var(--noise); background-repeat:repeat;
}

/* ══ HEADER — accent gradient line + glass bar ══ */
.FC-header{ position:sticky; top:0; z-index:20; flex-shrink:0; }
.FC-header::before{
  content:""; display:block; height:3px;
  background:linear-gradient(90deg,var(--a),var(--a2),var(--blue),var(--a));
  background-size:300% 100%; animation:fcHeroAccent 8s ease-in-out infinite;
}
@keyframes fcHeroAccent{ 0%,100%{background-position:0% 50%;} 50%{background-position:100% 50%;} }

.FC-hbar{
  display:flex; align-items:center; gap:10px; height:60px; padding:0 24px;
  background:linear-gradient(145deg,
    color-mix(in srgb, var(--a) 8%, var(--surface-solid)),
    var(--surface-solid) 45%,
    color-mix(in srgb, var(--blue) 6%, var(--surface-solid)));
  border-bottom:1px solid color-mix(in srgb, var(--a) 15%, var(--bd));
  box-shadow:0 6px 40px color-mix(in srgb, var(--a) 10%, transparent),inset 0 -1px 0 rgba(255,255,255,.06);
}
.FC-brand{ display:flex; align-items:center; gap:12px; flex-shrink:0; }
.FC-brand-icon{
  width:40px; height:40px; border-radius:12px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
  background:linear-gradient(135deg,var(--a),color-mix(in srgb,var(--blue) 35%,var(--a)));
  color:#fff; box-shadow:0 6px 18px var(--a-glow);
  transition:transform .3s,box-shadow .3s;
}
.FC-brand:hover .FC-brand-icon{ transform:scale(1.06); box-shadow:0 8px 24px var(--a-glow); }
.FC-brand-text{ display:flex; flex-direction:column; gap:2px; }
.FC-brand-title{
  font-size:14px; font-weight:900; letter-spacing:-.02em; line-height:1.2;
  background:linear-gradient(135deg, var(--t1) 60%, var(--a));
  -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
}
.FC-brand-sub{
  font-size:9.5px; font-weight:800; letter-spacing:.14em; text-transform:uppercase;
  background:linear-gradient(90deg,var(--t3),var(--a),var(--a2));
  -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
}
.FC-nav-tabs{
  display:flex; align-items:center; gap:2px;
  padding:0 4px; margin:0 12px;
  flex-shrink:0;
}
.FC-nav-tab{
  display:inline-flex; align-items:center; gap:5px;
  padding:6px 14px; min-height:34px; border-radius:10px;
  border:1.5px solid transparent; background:transparent;
  color:var(--t3); font-size:12px; font-weight:700; font-family:inherit;
  cursor:pointer; transition:all .22s cubic-bezier(.22,1,.36,1);
}
.FC-nav-tab:hover{ background:var(--hover); color:var(--t2); border-color:var(--bd); }
.FC-nav-tab.on{
  background:var(--a-dim); color:var(--t1);
  border-color:transparent;
}
.FC-sp{ flex:1; }
.FC-hsr{
  display:none; align-items:center; gap:8px;
  padding:7px 14px; border-radius:10px;
  border:1.5px solid var(--bd); background:var(--hover);
  cursor:text; transition:all .2s; min-width:180px;
}
@media(min-width:1024px){ .FC-hsr{ display:flex; } }
.FC-hsr:focus-within{ border-color:var(--a); box-shadow:0 0 0 3px var(--a-dim); background:var(--solid); }
.FC-hsr input{ border:none; outline:none; background:transparent; font-size:12px; font-weight:500; color:var(--t1); font-family:inherit; direction:rtl; width:100%; }
.FC-hsr input::placeholder{ color:var(--t3); }
.FC-dash-btn{
  display:inline-flex; align-items:center; gap:6px;
  padding:8px 14px; min-height:38px;
  border:1.5px solid var(--bd);
  border-radius:12px; background:var(--hover); color:var(--t2);
  font-size:12px; font-weight:700; font-family:inherit;
  cursor:pointer; transition:all .25s cubic-bezier(.22,1,.36,1); flex-shrink:0;
}
.FC-dash-btn:hover{ background:var(--surface-solid); color:var(--a); border-color:var(--a); transform:translateY(-1px); }
.FC-review-btn{
  display:inline-flex; align-items:center; gap:7px;
  padding:10px 20px; min-height:42px;
  border:none; border-radius:13px;
  background:linear-gradient(135deg,var(--a),color-mix(in srgb,var(--blue) 45%,var(--a)));
  color:#fff; font-size:13px; font-weight:800; font-family:inherit;
  cursor:pointer; flex-shrink:0; white-space:nowrap;
  box-shadow:0 4px 14px var(--a-glow);
  transition:all .3s cubic-bezier(.22,1,.36,1);
  position:relative; overflow:hidden;
}
.FC-review-btn::after{
  content:""; position:absolute; inset:0;
  background:linear-gradient(90deg,transparent 30%,rgba(255,255,255,.22) 50%,transparent 70%);
  transform:translateX(-100%); transition:transform .4s;
}
.FC-review-btn:hover::after{ transform:translateX(100%); }
.FC-review-btn:hover{ box-shadow:0 8px 28px var(--a-glow); transform:translateY(-2px); }
.FC-review-btn:active{ transform:scale(.97) translateY(0); }
@media(max-width:639px){ .FC-brand-text,.FC-nav-tabs,.FC-hsr{ display:none; } }

/* ══ PAGE BODY ══ */
.FC-body{ position:relative; z-index:2; flex:1; padding:28px 28px 56px; max-width:1280px; margin:0 auto; width:100%; }
@media(max-width:767px){ .FC-body{ padding:18px 16px 44px; } }

/* ══ STATS SECTION — dashboard op-card style ══ */
.FC-stats{ display:grid; grid-template-columns:repeat(5,1fr); gap:14px; margin-bottom:28px; }
@media(max-width:1023px){ .FC-stats{ grid-template-columns:repeat(3,1fr); } }
@media(max-width:639px){ .FC-stats{ grid-template-columns:1fr 1fr; } }

.FC-stat{
  display:flex; flex-direction:column; gap:10px;
  padding:18px 20px; border-radius:18px;
  border:1.5px solid var(--bd-glass);
  background:var(--surface);
  box-shadow:var(--sh);
  position:relative; overflow:hidden;
  transition:all .35s cubic-bezier(.22,1,.36,1);
}
.FC-stat::before{
  content:""; position:absolute; top:0; left:0; right:0; height:3px;
  background:linear-gradient(90deg, currentColor, color-mix(in srgb, currentColor 55%, var(--blue)));
  opacity:.7; transition:opacity .3s;
}
.FC-stat:hover::before{ opacity:1; }
.FC-stat:hover{
  transform:translateY(-4px);
  box-shadow:var(--sh-lg);
  border-color:color-mix(in srgb, currentColor 35%, transparent);
}
.FC-stat-icon{
  width:36px; height:36px; border-radius:10px;
  display:flex; align-items:center; justify-content:center;
  background:color-mix(in srgb, currentColor 14%, transparent);
  color:currentColor;
  border:1.5px solid color-mix(in srgb, currentColor 22%, transparent);
  transition:all .3s cubic-bezier(.22,1,.36,1);
}
.FC-stat:hover .FC-stat-icon{
  background:linear-gradient(135deg, currentColor, color-mix(in srgb, currentColor 60%, var(--blue)));
  color:#fff; border-color:transparent;
  box-shadow:0 6px 18px color-mix(in srgb, currentColor 28%, transparent);
  transform:scale(1.08);
}
.FC-stat-n{ font-size:30px; font-weight:900; letter-spacing:-.04em; font-variant-numeric:tabular-nums; line-height:1; color:currentColor; }
.FC-stat-l{ font-size:10.5px; font-weight:700; color:var(--t3); letter-spacing:.08em; text-transform:uppercase; }

.FC-stat-total{ color:var(--a); }
.FC-stat-due{   color:var(--emerald); }
.FC-stat-rev{   color:var(--sky); }
.FC-stat-learn{ color:var(--amber); }
.FC-stat-leech{ color:var(--rose); }

/* ══ SECTION HEADER — dashboard style with icon badge ══ */
.FC-sh{
  display:flex; align-items:center; justify-content:space-between;
  gap:14px; margin-bottom:18px; flex-wrap:wrap;
}
.FC-sh-left{ display:flex; align-items:center; gap:14px; flex:1; min-width:0; }
.FC-sh-icon{
  width:44px; height:44px; border-radius:13px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
  background:linear-gradient(135deg, var(--a), color-mix(in srgb, var(--blue) 35%, var(--a)));
  color:#fff;
  box-shadow:0 6px 18px var(--a-glow);
}
.FC-sh-eyebrow{
  font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase;
  color:var(--t3);
}
.FC-sh-title{
  font-size:16px; font-weight:900; letter-spacing:-.02em;
  background:linear-gradient(135deg, var(--t1) 60%, var(--a));
  -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
}
.FC-sh-sub{ font-size:11.5px; font-weight:600; color:var(--t3); margin-top:2px; }

/* Mobile search */
.FC-msearch{
  display:flex; align-items:center; gap:8px;
  padding:10px 14px; border-radius:12px;
  border:1.5px solid var(--bd); background:var(--solid);
  transition:all .2s; margin-bottom:16px;
}
@media(min-width:1024px){ .FC-msearch{ display:none; } }
.FC-msearch:focus-within{ border-color:var(--a); box-shadow:0 0 0 3px var(--a-dim); }
.FC-msearch input{ flex:1; border:none; outline:none; background:transparent; font-size:13px; color:var(--t1); font-family:inherit; direction:rtl; }
.FC-msearch input::placeholder{ color:var(--t3); }

/* ══ CARD LIST — glass with accent line ══ */
.FC-cards{ display:flex; flex-direction:column; gap:10px; }

.FC-card{
  display:flex; align-items:flex-start; gap:14px;
  padding:18px 22px;
  border-radius:18px;
  border:1.5px solid var(--bd-glass);
  background:var(--surface);
  box-shadow:var(--sh);
  transition:all .35s cubic-bezier(.22,1,.36,1);
  text-decoration:none; color:inherit;
  direction:rtl; cursor:default;
  position:relative; overflow:hidden;
}
.FC-card::before{
  content:""; position:absolute; top:0; left:10%; right:10%; height:2px;
  background:linear-gradient(90deg,transparent,var(--a),transparent);
  opacity:.25; transition:opacity .4s; border-radius:0 0 4px 4px;
}
.FC-card:hover::before{ opacity:.7; }
.FC-card:hover{
  border-color:color-mix(in srgb,var(--a) 35%,transparent);
  box-shadow:var(--sh-lg);
  transform:translateY(-3px);
}
.FC-card-idx{
  width:40px; height:40px; border-radius:12px; flex-shrink:0; margin-top:2px;
  display:flex; align-items:center; justify-content:center;
  font-size:13px; font-weight:900; font-variant-numeric:tabular-nums;
  background:linear-gradient(135deg,var(--a),color-mix(in srgb,var(--blue) 35%,var(--a)));
  color:#fff;
  box-shadow:0 6px 18px var(--a-glow);
}
.FC-card-body{ flex:1; min-width:0; }
.FC-card-meta{
  display:flex; align-items:center; flex-wrap:wrap; gap:5px;
  margin-bottom:8px;
}
.FC-card-chip{
  display:inline-flex; align-items:center; gap:4px;
  padding:2px 9px; border-radius:20px;
  font-size:10px; font-weight:700; letter-spacing:.04em;
}
.FC-chip-ch{  background:var(--a-dim);  color:var(--a);       border:1px solid color-mix(in srgb,var(--a) 22%,transparent); }
.FC-chip-dk{  background:color-mix(in srgb,var(--violet) 10%,transparent); color:var(--violet); border:1px solid color-mix(in srgb,var(--violet) 22%,transparent); }
.FC-chip-leech{ background:color-mix(in srgb,var(--rose) 10%,transparent); color:var(--rose); border:1px solid color-mix(in srgb,var(--rose) 22%,transparent); }
.FC-chip-susp{ background:color-mix(in srgb,var(--amber) 10%,transparent); color:var(--amber); border:1px solid color-mix(in srgb,var(--amber) 22%,transparent); }
.FC-chip-new{  background:color-mix(in srgb,var(--sky) 10%,transparent);   color:var(--sky);   border:1px solid color-mix(in srgb,var(--sky) 22%,transparent); }
.FC-chip-rev{  background:color-mix(in srgb,var(--emerald) 10%,transparent); color:var(--emerald); border:1px solid color-mix(in srgb,var(--emerald) 22%,transparent); }
.FC-chip-lrn{  background:color-mix(in srgb,var(--amber) 10%,transparent); color:var(--amber); border:1px solid color-mix(in srgb,var(--amber) 22%,transparent); }

.FC-card-front{
  font-size:14px; font-weight:700; color:var(--t1); line-height:1.4;
  margin-bottom:5px; letter-spacing:-.01em;
  overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
}
.FC-card-back{
  font-size:12px; font-weight:400; color:var(--t3); line-height:1.55;
  overflow:hidden; display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical;
}
.FC-card-right{
  display:flex; flex-direction:column; align-items:flex-end; gap:8px; flex-shrink:0;
}
.FC-due-badge{
  display:flex; flex-direction:column; align-items:flex-end; gap:1px;
  padding:6px 12px; border-radius:10px;
  background:var(--solid); border:1.5px solid var(--bd-s);
}
.FC-due-label{ font-size:9px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--t3); }
.FC-due-val{ font-size:12px; font-weight:800; color:var(--t1); font-variant-numeric:tabular-nums; }
.FC-src-btn{
  display:inline-flex; align-items:center; gap:5px;
  padding:5px 12px; border-radius:8px; min-height:30px;
  border:1.5px solid var(--bd); background:var(--hover);
  color:var(--t2); font-size:11px; font-weight:700;
  text-decoration:none; transition:all .18s;
}
.FC-src-btn:hover{ background:var(--a-dim); border-color:var(--a); color:var(--a); }

/* Empty state */
.FC-empty{
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  padding:60px 24px; gap:14px; text-align:center;
}
.FC-empty-icon{
  width:80px; height:80px; border-radius:24px;
  display:flex; align-items:center; justify-content:center;
  background:linear-gradient(135deg,var(--a-dim2),var(--a-dim));
  color:var(--a); opacity:.65; box-shadow:0 8px 24px var(--a-glow);
  animation:fc-pulse 4s ease-in-out infinite alternate;
}
@keyframes fc-pulse{ 0%{ box-shadow:0 8px 24px var(--a-glow); } 100%{ box-shadow:0 14px 40px var(--a-glow); } }
.FC-empty-title{ font-size:16px; font-weight:800; color:var(--t2); max-width:260px; line-height:1.4; }
.FC-empty-sub{ font-size:12px; font-weight:500; color:var(--t3); max-width:240px; line-height:1.6; }

/* ══ STATS TAB — glass op-cards ══ */
.FC-stats-grid{ display:grid; grid-template-columns:repeat(2,1fr); gap:14px; }
@media(min-width:768px){ .FC-stats-grid{ grid-template-columns:repeat(3,1fr); } }
@media(min-width:1024px){ .FC-stats-grid{ grid-template-columns:repeat(4,1fr); } }

.FC-scard{
  display:flex; flex-direction:column; gap:12px;
  padding:22px 22px; border-radius:20px;
  border:1.5px solid var(--bd-glass);
  background:var(--surface);
  box-shadow:var(--sh); transition:all .35s cubic-bezier(.22,1,.36,1); position:relative; overflow:hidden;
}
.FC-scard::before{
  content:""; position:absolute; top:0; left:0; right:0; height:3px;
  background:linear-gradient(90deg, currentColor, color-mix(in srgb, currentColor 55%, var(--blue)));
  opacity:.7; transition:opacity .3s;
}
.FC-scard:hover::before{ opacity:1; }
.FC-scard:hover{
  transform:translateY(-4px);
  box-shadow:var(--sh-lg);
  border-color:color-mix(in srgb, currentColor 40%, transparent);
}
.FC-scard-head{ display:flex; align-items:center; gap:10px; }
.FC-scard-icon{
  width:36px; height:36px; border-radius:11px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
  background:color-mix(in srgb, currentColor 14%, transparent);
  color:currentColor;
  border:1.5px solid color-mix(in srgb, currentColor 22%, transparent);
  transition:all .3s cubic-bezier(.22,1,.36,1);
}
.FC-scard:hover .FC-scard-icon{
  background:linear-gradient(135deg, currentColor, color-mix(in srgb, currentColor 60%, var(--blue)));
  color:#fff; border-color:transparent; transform:scale(1.08);
  box-shadow:0 6px 18px color-mix(in srgb, currentColor 28%, transparent);
}
.FC-scard-label{ font-size:11px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:var(--t3); }
.FC-scard-n{ font-size:34px; font-weight:900; letter-spacing:-.04em; font-variant-numeric:tabular-nums; color:currentColor; }

.FC-sc-total{ color:var(--a); }
.FC-sc-due{   color:var(--emerald); }
.FC-sc-rev{   color:var(--sky); }
.FC-sc-7d{    color:var(--teal); }
.FC-sc-learn{ color:var(--amber); }
.FC-sc-new{   color:var(--blue); }
.FC-sc-susp{  color:var(--t3); }
.FC-sc-deck{  color:var(--violet); }
.FC-sc-leech{ color:var(--rose); }

/* Recent reviews */
.FC-reviews{ display:flex; flex-direction:column; gap:10px; margin-top:28px; }
.FC-reviews-title{
  font-size:15px; font-weight:900; margin-bottom:6px; letter-spacing:-.02em;
  background:linear-gradient(135deg, var(--t1) 60%, var(--a));
  -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
}
.FC-review-row{
  display:flex; align-items:center; gap:12px;
  padding:14px 18px; border-radius:14px;
  border:1.5px solid var(--bd-glass); background:var(--surface);
  box-shadow:var(--sh);
  transition:all .3s cubic-bezier(.22,1,.36,1);
}
.FC-review-row:hover{ transform:translateY(-2px); box-shadow:var(--sh-lg); border-color:color-mix(in srgb,var(--a) 30%,transparent); }
.FC-review-front{ flex:1; font-size:13px; font-weight:600; color:var(--t2); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.FC-review-time{ font-size:11px; color:var(--t3); flex-shrink:0; font-variant-numeric:tabular-nums; }
.FC-rtag{
  display:inline-flex; padding:3px 10px; border-radius:20px;
  font-size:10px; font-weight:800; letter-spacing:.05em; flex-shrink:0;
}
.FC-rtag-1{ background:color-mix(in srgb,var(--rose) 12%,transparent);    color:var(--rose); }
.FC-rtag-2{ background:color-mix(in srgb,var(--amber) 12%,transparent);   color:var(--amber); }
.FC-rtag-3{ background:color-mix(in srgb,var(--sky) 12%,transparent);     color:var(--sky); }
.FC-rtag-4{ background:color-mix(in srgb,var(--emerald) 12%,transparent); color:var(--emerald); }
`;

/* ── Helpers ── */
function strip(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function fmtDue(v: number | null) {
  if (!v) return "کارت جدید";
  const d = new Date(v);
  const now = new Date();
  const diff = Math.floor((d.getTime() - now.getTime()) / 86400000);
  if (diff <= 0) return "امروز";
  if (diff === 1) return "فردا";
  if (diff < 7) return `${diff} روز دیگر`;
  return d.toLocaleDateString("fa-IR", { month: "short", day: "numeric" });
}
function fmtTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString("fa-IR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
const RATING_FA: Record<number, string> = { 1: "دوباره", 2: "سخت", 3: "خوب", 4: "آسان" };
const STATE_CHIP: Record<string, string> = {
  new: "FC-chip-new", review: "FC-chip-rev", learning: "FC-chip-lrn",
};

interface FlashcardHubProps {
  stats: FCStats;
  cards: FCCard[];
  query?: string;
}

export function FlashcardHub({ stats, cards, query = "" }: FlashcardHubProps) {
  const router = useRouter();
  const [tab, setTab]     = useState<"cards" | "stats">("cards");
  const [search, setSearch] = useState(query);

  const filtered = useMemo(() => {
    if (!search.trim()) return cards;
    const q = search.toLowerCase();
    return cards.filter(c =>
      strip(c.frontHtml).toLowerCase().includes(q) ||
      strip(c.backHtml).toLowerCase().includes(q) ||
      (c.deck ?? "").toLowerCase().includes(q) ||
      String(c.chapterNo ?? "").includes(q)
    );
  }, [cards, search]);

  return (
    <div className="FC" dir="rtl">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Background — mesh gradient aurora + noise (matches dashboard). */}
      <div className="FC-bg">
        <div className="FC-mesh" />
        <div className="FC-noise" />
      </div>

      {/* Header */}
      <header className="FC-header">
        <div className="FC-hbar">
          <div className="FC-brand">
            <div className="FC-brand-icon"><Brain size={16} /></div>
            <div className="FC-brand-text">
              <span className="FC-brand-title">فلش‌کارت‌ها</span>
              <span className="FC-brand-sub">SRS — Campbell Urology</span>
            </div>
          </div>

          <div className="FC-nav-tabs">
            <button type="button" className={`FC-nav-tab ${tab === "cards" ? "on" : ""}`} onClick={() => setTab("cards")}>
              <CreditCard size={12} /> کارت‌ها
            </button>
            <button type="button" className={`FC-nav-tab ${tab === "stats" ? "on" : ""}`} onClick={() => setTab("stats")}>
              <BarChart3 size={12} /> آمار
            </button>
          </div>

          <div className="FC-sp" />

          <div className="FC-hsr">
            <Search size={13} style={{ color: "var(--t3)", flexShrink: 0 }} />
            <input placeholder="جستجو در کارت‌ها…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <button type="button" className="FC-dash-btn" onClick={() => router.push("/flashcards/library")}>
            <BookOpen size={13} /> کتابخانه فصل‌ها
          </button>

          <button type="button" className="FC-dash-btn" onClick={() => router.push("/dashboard")}>
            <LayoutGrid size={13} /> داشبورد
          </button>

          <button type="button" className="FC-review-btn" onClick={() => router.push("/flashcards/review")}>
            <Brain size={13} />
            مرور کارت‌ها
            {stats.due > 0 && (
              <span style={{
                background: "rgba(255,255,255,0.22)", borderRadius: "20px",
                padding: "1px 8px", fontSize: "11px", fontWeight: 900, fontVariantNumeric: "tabular-nums",
              }}>{stats.due}</span>
            )}
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="FC-body">

        {/* Stats row — always visible */}
        <div className="FC-stats">
          <div className="FC-stat FC-stat-total">
            <div className="FC-stat-icon"><Layers size={16} /></div>
            <span className="FC-stat-n">{stats.total}</span>
            <span className="FC-stat-l">کل کارت‌ها</span>
          </div>
          <div className="FC-stat FC-stat-due">
            <div className="FC-stat-icon"><Brain size={16} /></div>
            <span className="FC-stat-n">{stats.due}</span>
            <span className="FC-stat-l">موعد امروز</span>
          </div>
          <div className="FC-stat FC-stat-rev">
            <div className="FC-stat-icon"><TrendingUp size={16} /></div>
            <span className="FC-stat-n">{stats.reviewed}</span>
            <span className="FC-stat-l">مرور شده</span>
          </div>
          <div className="FC-stat FC-stat-learn">
            <div className="FC-stat-icon"><Clock3 size={16} /></div>
            <span className="FC-stat-n">{stats.learning}</span>
            <span className="FC-stat-l">در یادگیری</span>
          </div>
          <div className="FC-stat FC-stat-leech">
            <div className="FC-stat-icon"><AlertTriangle size={16} /></div>
            <span className="FC-stat-n">{stats.leech}</span>
            <span className="FC-stat-l">دشوار</span>
          </div>
        </div>

        {/* ── Tab: Cards ── */}
        {tab === "cards" && (
          <>
            <div className="FC-sh">
              <div className="FC-sh-left">
                <div className="FC-sh-icon"><CreditCard size={18} /></div>
                <div style={{ minWidth: 0 }}>
                  <div className="FC-sh-eyebrow">FLASHCARDS</div>
                  <div className="FC-sh-title">مرور کارت‌ها</div>
                  <div className="FC-sh-sub">{filtered.length} کارت{search ? " (نتیجه جستجو)" : ""}</div>
                </div>
              </div>
            </div>

            {/* Mobile search */}
            <div className="FC-msearch">
              <Search size={14} style={{ color: "var(--t3)", flexShrink: 0 }} />
              <input placeholder="جستجو در کارت‌ها…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            <div className="FC-cards">
              {filtered.length === 0 ? (
                <div className="FC-empty">
                  <div className="FC-empty-icon"><Sparkles size={32} /></div>
                  <p className="FC-empty-title">کارتی یافت نشد</p>
                  <p className="FC-empty-sub">
                    {search
                      ? "جستجو را تغییر دهید"
                      : "از ریدر متن برای ساخت اولین فلش‌کارت استفاده کنید"}
                  </p>
                </div>
              ) : (
                filtered.map((card, i) => (
                  <div key={card.id} className="FC-card">
                    <span className="FC-card-idx">{i + 1}</span>
                    <div className="FC-card-body">
                      <div className="FC-card-meta">
                        {card.chapterNo && (
                          <span className="FC-card-chip FC-chip-ch">
                            <Hash size={9} /> فصل {card.chapterNo}
                          </span>
                        )}
                        {card.deck && (
                          <span className="FC-card-chip FC-chip-dk">{card.deck}</span>
                        )}
                        {card.isLeech && (
                          <span className="FC-card-chip FC-chip-leech"><AlertTriangle size={9} /> دشوار</span>
                        )}
                        {card.isSuspended && (
                          <span className="FC-card-chip FC-chip-susp">معلق</span>
                        )}
                        <span className={`FC-card-chip ${STATE_CHIP[card.fsrsState] ?? "FC-chip-rev"}`}>
                          {card.fsrsState === "new" ? "جدید" : card.fsrsState === "review" ? "مرور" : "یادگیری"}
                        </span>
                      </div>
                      <div className="FC-card-front" dir="rtl" lang="fa" data-bidi-text="flashcard"><BidiText text={strip(card.frontHtml)} /></div>
                      <div className="FC-card-back" dir="rtl" lang="fa" data-bidi-text="flashcard"><BidiText text={strip(card.backHtml)} /></div>
                    </div>
                    <div className="FC-card-right">
                      <div className="FC-due-badge">
                        <span className="FC-due-label">موعد</span>
                        <span className="FC-due-val">{fmtDue(card.fsrsDue)}</span>
                      </div>
                      {card.sourceDocId && (
                        <Link
                          href={`/notes/${card.sourceDocId}${card.sourceFrameId ? `?frame=${card.sourceFrameId}` : ""}`}
                          className="FC-src-btn"
                        >
                          <BookOpen size={11} /> منبع
                        </Link>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* ── Tab: Stats ── */}
        {tab === "stats" && (
          <>
            <div className="FC-sh">
              <div className="FC-sh-left">
                <div className="FC-sh-icon"><BarChart3 size={18} /></div>
                <div style={{ minWidth: 0 }}>
                  <div className="FC-sh-eyebrow">ANALYTICS</div>
                  <div className="FC-sh-title">آمار فلش‌کارت‌ها</div>
                  <div className="FC-sh-sub">وضعیت فعلی صف مرور</div>
                </div>
              </div>
            </div>

            <div className="FC-stats-grid">
              <div className="FC-scard FC-sc-total">
                <div className="FC-scard-head"><div className="FC-scard-icon"><Layers size={16} /></div><span className="FC-scard-label">کل</span></div>
                <div className="FC-scard-n">{stats.total}</div>
              </div>
              <div className="FC-scard FC-sc-due">
                <div className="FC-scard-head"><div className="FC-scard-icon"><Brain size={16} /></div><span className="FC-scard-label">موعد امروز</span></div>
                <div className="FC-scard-n">{stats.due}</div>
              </div>
              <div className="FC-scard FC-sc-rev">
                <div className="FC-scard-head"><div className="FC-scard-icon"><TrendingUp size={16} /></div><span className="FC-scard-label">مرور شده</span></div>
                <div className="FC-scard-n">{stats.reviewed}</div>
              </div>
              <div className="FC-scard FC-sc-7d">
                <div className="FC-scard-head"><div className="FC-scard-icon"><BarChart3 size={16} /></div><span className="FC-scard-label">۷ روز اخیر</span></div>
                <div className="FC-scard-n">{stats.recentReviewCount}</div>
              </div>
              <div className="FC-scard FC-sc-new">
                <div className="FC-scard-head"><div className="FC-scard-icon"><Sparkles size={16} /></div><span className="FC-scard-label">جدید</span></div>
                <div className="FC-scard-n">{stats.newCount}</div>
              </div>
              <div className="FC-scard FC-sc-learn">
                <div className="FC-scard-head"><div className="FC-scard-icon"><Clock3 size={16} /></div><span className="FC-scard-label">در یادگیری</span></div>
                <div className="FC-scard-n">{stats.learning}</div>
              </div>
              <div className="FC-scard FC-sc-susp">
                <div className="FC-scard-head"><div className="FC-scard-icon"><AlertTriangle size={16} /></div><span className="FC-scard-label">معلق</span></div>
                <div className="FC-scard-n">{stats.suspended}</div>
              </div>
              <div className="FC-scard FC-sc-deck">
                <div className="FC-scard-head"><div className="FC-scard-icon"><Layers size={16} /></div><span className="FC-scard-label">دسته‌ها</span></div>
                <div className="FC-scard-n">{stats.deckCount}</div>
              </div>
              <div className="FC-scard FC-sc-leech">
                <div className="FC-scard-head"><div className="FC-scard-icon"><AlertTriangle size={16} /></div><span className="FC-scard-label">دشوار</span></div>
                <div className="FC-scard-n">{stats.leech}</div>
              </div>
            </div>

            {/* Recent reviews */}
            {stats.recentActivity.length > 0 && (
              <div className="FC-reviews">
                <div className="FC-reviews-title">آخرین مرورها</div>
                {stats.recentActivity.map((r) => (
                  <div key={r.id} className="FC-review-row">
                    <span className="FC-review-front" dir="rtl" lang="fa" data-bidi-text="flashcard"><BidiText text={strip(r.flashcardFrontHtml)} /></span>
                    <span className="FC-review-time">{fmtTime(r.reviewedAt)}</span>
                    <span className={`FC-rtag FC-rtag-${r.rating}`}>{RATING_FA[r.rating]}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
