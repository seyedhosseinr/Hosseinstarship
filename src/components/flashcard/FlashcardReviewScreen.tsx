"use client";

/**
 * FlashcardReviewScreen  v4.0 — Flagship 2026
 * Fully Persian, CSS-in-JSX, FR-* classes.
 * All logic (keyboard shortcuts, OPFS fallback, undo, refresh) preserved.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, RotateCcw, HelpCircle, Layers,
  CheckCircle2, BookOpen, Hash, AlertTriangle, Info,
} from "lucide-react";
import { useOptimisticFlashcard } from "@/hooks/useOptimisticFlashcard";
import { getFlashcardsForReview } from "@/hooks/useDb";
import { isLocalFirstEnabled } from "@/lib/local-first/flag";
import { submitReviewLocal } from "@/lib/local-first/flashcard-review-local";
import { buildReaderSourceHref } from "@/lib/reader/anchor-bubble";

/* ════════════════════════════════════════
   CSS — FR-* tokens
════════════════════════════════════════ */
const CSS = `
.FR*,.FR*::before,.FR*::after{box-sizing:border-box;margin:0;padding:0;}

/* ══ Tokens — Light ══ */
.FR{
  --a:         hsl(166 90% 26%);
  --a2:        hsl(38  92% 50%);
  --a3:        hsl(213 94% 57%);
  --a-glow:    color-mix(in srgb,hsl(166 90% 26%) 35%,transparent);
  --a-dim:     color-mix(in srgb,hsl(166 90% 26%) 10%,transparent);
  --a-dim2:    color-mix(in srgb,hsl(166 90% 26%) 17%,transparent);
  --violet:    #7C3AED;
  --blue:      #0369A1; --teal:#0D9488; --sky:#0284C7;
  --emerald:   #047857; --amber:#D97706; --rose:#BE123C;
  --bg:        hsl(168 30% 94%);
  --surface:   rgba(255,255,255,0.86);
  --solid:     hsl(168 20% 98%);
  --hover:     hsl(168 28% 95%);
  --bd:        hsl(170 20% 85%);
  --bd-s:      hsl(170 18% 90%);
  --t1:        hsl(200 80% 5%);
  --t2:        hsl(195 25% 25%);
  --t3:        hsl(195 14% 42%);
  --blur:      blur(32px) saturate(2);
  --sh:        0 2px 8px rgba(0,70,60,.07),0 8px 32px rgba(0,70,60,.06);
  --sh-lg:     0 16px 52px rgba(0,70,60,.13),0 2px 8px rgba(0,70,60,.05);
  --sh-xl:     0 24px 72px rgba(0,70,60,.18),0 4px 16px rgba(0,70,60,.06);
  --noise:     url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
}
/* ══ Tokens — Dark ══ */
.dark .FR{
  --a:hsl(172 72% 46%); --a2:hsl(38 90% 58%); --a3:hsl(213 80% 65%);
  --a-glow:color-mix(in srgb,hsl(172 72% 46%) 40%,transparent);
  --a-dim:color-mix(in srgb,hsl(172 72% 46%) 13%,transparent);
  --a-dim2:color-mix(in srgb,hsl(172 72% 46%) 20%,transparent);
  --violet:#A78BFA;
  --blue:#22D3EE; --teal:#2DD4BF; --sky:#38BDF8;
  --emerald:#34D399; --amber:#FBBF24; --rose:#FB7185;
  --bg:hsl(195 28% 4%); --surface:rgba(255,255,255,0.042); --solid:hsl(195 22% 8%);
  --hover:hsl(195 16% 11%); --bd:hsl(195 14% 14%); --bd-s:hsl(195 12% 11%);
  --t1:hsl(170 20% 95%); --t2:hsl(170 12% 68%); --t3:hsl(170 8% 50%);
  --sh:0 2px 12px rgba(0,0,0,.42),0 6px 28px rgba(0,0,0,.30);
  --sh-lg:0 12px 44px rgba(0,0,0,.52),0 2px 8px rgba(0,0,0,.35);
  --sh-xl:0 20px 64px rgba(0,0,0,.60),0 4px 12px rgba(0,0,0,.38);
}

/* ══ ROOT ══ */
.FR{
  display:flex; flex-direction:column; min-height:100dvh;
  font-family:var(--font-vazir,'Vazirmatn'),Tahoma,system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;
  background:var(--bg); color:var(--t1);
  position:relative; direction:rtl;
}

/* ══ Background ══ */
.FR-bg{ position:fixed; inset:0; z-index:0; pointer-events:none; overflow:hidden; }
.FR-orb{ position:absolute; border-radius:50%; filter:blur(80px); will-change:transform,opacity; }
.FR-orb-1{
  width:700px; height:700px; top:-300px; right:-200px;
  background:radial-gradient(circle,color-mix(in srgb,var(--violet) 24%,transparent) 0%,transparent 65%);
  animation:fr-o1 24s ease-in-out infinite alternate;
}
.FR-orb-2{
  width:600px; height:600px; bottom:-250px; left:-180px;
  background:radial-gradient(circle,color-mix(in srgb,var(--a) 22%,transparent) 0%,transparent 60%);
  animation:fr-o2 30s ease-in-out infinite alternate;
}
@keyframes fr-o1{0%{transform:translate(0,0) scale(1);opacity:.7;}100%{transform:translate(-40px,50px) scale(1.1);opacity:.9;}}
@keyframes fr-o2{0%{transform:translate(0,0) scale(1);opacity:.6;}100%{transform:translate(50px,-40px) scale(.95);opacity:.8;}}
.FR-noise{
  position:absolute; inset:0; pointer-events:none; z-index:1;
  opacity:.025; mix-blend-mode:overlay;
  background-image:var(--noise); background-size:200px 200px;
}

/* ══ TOP BAR ══ */
.FR-topbar{
  position:sticky; top:0; z-index:20; flex-shrink:0;
  display:flex; align-items:center; gap:12px;
  padding:0 20px; height:56px;
  background:var(--surface);
  backdrop-filter:var(--blur); -webkit-backdrop-filter:var(--blur);
  border-bottom:1px solid var(--bd);
  box-shadow:var(--sh);
}
.FR-exit{
  display:inline-flex; align-items:center; gap:7px;
  padding:6px 14px; min-height:34px;
  border:1.5px solid var(--bd); border-radius:10px;
  background:var(--hover); color:var(--t2);
  font-size:12px; font-weight:700; font-family:inherit;
  text-decoration:none; transition:all .2s; flex-shrink:0;
}
.FR-exit:hover{ background:var(--a-dim); border-color:var(--a); color:var(--a); }
.FR-sp{ flex:1; }
.FR-meta{ display:flex; align-items:center; gap:10px; }
.FR-meta-chip{
  display:inline-flex; align-items:center; gap:5px;
  padding:4px 12px; border-radius:20px;
  font-size:11px; font-weight:700; font-variant-numeric:tabular-nums;
  background:var(--a-dim); color:var(--a);
  border:1.5px solid color-mix(in srgb,var(--a) 22%,transparent);
}
.FR-elapsed{ font-size:12px; font-weight:600; color:var(--t3); font-variant-numeric:tabular-nums; }
.FR-shortcut-btn{
  display:inline-flex; align-items:center; gap:5px;
  padding:5px 12px; min-height:30px;
  border:1.5px solid var(--bd); border-radius:8px;
  background:transparent; color:var(--t3);
  font-size:11px; font-weight:700; font-family:inherit;
  cursor:pointer; transition:all .18s;
}
.FR-shortcut-btn:hover{ background:var(--hover); color:var(--t2); }

/* ══ PROGRESS BAR ══ */
.FR-prog-wrap{
  position:relative; z-index:2; height:4px;
  background:var(--bd-s); flex-shrink:0;
}
.FR-prog-fill{
  height:100%;
  background:linear-gradient(90deg,var(--a),var(--a2),var(--a3));
  background-size:300% 100%;
  animation:fr-pg 4s ease-in-out infinite;
  border-radius:0 4px 4px 0;
  transition:width .4s cubic-bezier(.22,1,.36,1);
}
@keyframes fr-pg{0%,100%{background-position:0%;}50%{background-position:100%;}}

/* ══ MAIN ══ */
.FR-main{
  position:relative; z-index:2; flex:1;
  max-width:800px; width:100%; margin:0 auto;
  padding:28px 20px 48px;
  display:flex; flex-direction:column; gap:16px;
}
@media(max-width:639px){ .FR-main{ padding:16px 16px 36px; } }

/* ══ SHORTCUTS PANEL ══ */
.FR-sc-panel{
  padding:16px 20px; border-radius:14px;
  border:1.5px solid var(--bd-s); background:var(--solid);
  display:grid; grid-template-columns:1fr 1fr; gap:8px;
}
@media(max-width:479px){ .FR-sc-panel{ grid-template-columns:1fr; } }
.FR-sc-title{ font-size:13px; font-weight:800; color:var(--t1); margin-bottom:4px; grid-column:1/-1; }
.FR-sc-row{ display:flex; align-items:baseline; gap:8px; font-size:12px; }
.FR-sc-key{
  display:inline-flex; align-items:center; justify-content:center;
  padding:1px 8px; border-radius:6px;
  border:1.5px solid var(--bd); background:var(--hover);
  font-size:11px; font-weight:800; color:var(--t2); flex-shrink:0;
  font-family:ui-monospace,'SF Mono',monospace;
}
.FR-sc-desc{ color:var(--t3); font-weight:500; }

/* ══ CARD ══ */
.FR-card{
  border-radius:20px; overflow:hidden;
  border:1.5px solid var(--bd); background:var(--surface);
  backdrop-filter:var(--blur); -webkit-backdrop-filter:var(--blur);
  box-shadow:var(--sh-lg);
}

/* Card hero (dark cinematic) */
.FR-card-hero{
  position:relative; overflow:hidden;
  padding:28px 28px 24px;
  background:linear-gradient(145deg,
    hsl(265 70% 20%) 0%,
    hsl(200 60% 14%) 55%,
    hsl(166 60% 12%) 100%);
}
.dark .FR-card-hero{
  background:linear-gradient(145deg,
    hsl(265 50% 14%) 0%,
    hsl(200 50% 9%) 55%,
    hsl(166 50% 8%) 100%);
}
/* Grid mesh on hero */
.FR-card-hero::before{
  content:""; position:absolute; inset:0; pointer-events:none;
  background-image:
    linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px);
  background-size:44px 44px;
  mask-image:radial-gradient(ellipse 90% 100% at 50% 0%,black 40%,transparent 100%);
}
/* Scan line */
.FR-card-hero::after{
  content:""; position:absolute; inset:0; pointer-events:none;
  background:linear-gradient(90deg,transparent 44%,rgba(255,255,255,0.04) 50%,transparent 56%);
  animation:fr-scan 8s linear infinite;
}
@keyframes fr-scan{0%{transform:translateX(-120%);}100%{transform:translateX(220%);}}

.FR-card-hero-inner{ position:relative; z-index:1; }
.FR-card-chips{
  display:flex; align-items:center; flex-wrap:wrap; gap:6px;
  margin-bottom:14px;
}
.FR-card-chip{
  display:inline-flex; align-items:center; gap:4px;
  padding:3px 10px; border-radius:20px;
  font-size:10px; font-weight:800; letter-spacing:.07em; text-transform:uppercase;
  background:rgba(255,255,255,0.1); color:rgba(255,255,255,0.72);
  border:1px solid rgba(255,255,255,0.15);
}
.FR-card-chip-leech{
  background:rgba(251,113,133,0.18); color:#fb7185;
  border-color:rgba(251,113,133,0.3);
}
.FR-qlabel{
  font-size:10px; font-weight:800; letter-spacing:.1em; text-transform:uppercase;
  color:rgba(255,255,255,0.45); margin-bottom:10px;
}
.FR-qtext{
  font-size:20px; font-weight:700; line-height:1.45; color:#fff;
  letter-spacing:-.02em;
  text-shadow:0 2px 12px rgba(0,0,0,0.4);
}
@media(max-width:639px){ .FR-qtext{ font-size:17px; } }

/* Answer section (inside card, below hero) */
.FR-card-body{ padding:24px 28px; }
@media(max-width:639px){ .FR-card-body{ padding:18px 20px; } }

.FR-alabel{
  font-size:10px; font-weight:800; letter-spacing:.1em; text-transform:uppercase;
  color:var(--a); margin-bottom:10px;
  display:flex; align-items:center; gap:6px;
}
.FR-atext{
  font-size:16px; line-height:1.7; color:var(--t1);
  white-space:pre-wrap;
}
.FR-adivider{
  height:1px; background:linear-gradient(90deg,var(--a),var(--a2),transparent);
  margin-bottom:20px; opacity:.4;
}
.FR-src-row{ display:flex; flex-wrap:wrap; gap:8px; margin-top:16px; }
.FR-src-btn{
  display:inline-flex; align-items:center; gap:6px;
  padding:7px 14px; border-radius:10px; min-height:34px;
  border:1.5px solid var(--bd); background:var(--hover);
  color:var(--t2); font-size:12px; font-weight:700;
  text-decoration:none; transition:all .18s;
}
.FR-src-btn:hover{ background:var(--a-dim); border-color:var(--a); color:var(--a); }

/* Reveal button */
.FR-reveal{
  display:flex; align-items:center; justify-content:center; gap:10px;
  width:100%; min-height:52px; padding:14px 22px;
  border:none; border-radius:14px; cursor:pointer;
  background:linear-gradient(135deg,var(--violet),color-mix(in srgb,var(--a) 45%,var(--violet)));
  color:#fff; font-size:15px; font-weight:800; font-family:inherit;
  box-shadow:0 6px 22px color-mix(in srgb,var(--violet) 28%,transparent);
  transition:all .3s cubic-bezier(.22,1,.36,1);
  position:relative; overflow:hidden;
}
.FR-reveal::before{
  content:""; position:absolute; inset:0;
  background:linear-gradient(90deg,transparent 25%,rgba(255,255,255,.22) 50%,transparent 75%);
  transform:translateX(-120%); transition:transform .55s;
}
.FR-reveal:hover::before{ transform:translateX(120%); }
.FR-reveal:hover{ box-shadow:0 10px 32px color-mix(in srgb,var(--violet) 36%,transparent); transform:translateY(-2px); }
.FR-reveal:active{ transform:translateY(0); }
.FR-reveal-hint{ font-size:11px; opacity:.65; }

/* ══ STATE INDICATOR + HELPER NOTE ══ */
.FR-state-row{
  display:flex; align-items:center; justify-content:space-between;
  gap:10px; flex-wrap:wrap;
  margin-top:-4px;
}
.FR-state-chip{
  display:inline-flex; align-items:center; gap:6px;
  padding:5px 12px; border-radius:999px;
  font-size:11.5px; font-weight:800; letter-spacing:.01em;
  border:1.5px solid transparent;
  background:var(--hover); color:var(--t2);
}
.FR-state-chip::before{
  content:""; width:6px; height:6px; border-radius:50%;
  background:currentColor; flex-shrink:0;
  box-shadow:0 0 0 3px color-mix(in srgb,currentColor 18%,transparent);
}
.FR-state-new{
  color:var(--violet);
  background:color-mix(in srgb,var(--violet) 10%,transparent);
  border-color:color-mix(in srgb,var(--violet) 26%,transparent);
}
.FR-state-learning{
  color:var(--a2);
  background:color-mix(in srgb,var(--a2) 12%,transparent);
  border-color:color-mix(in srgb,var(--a2) 28%,transparent);
}
.FR-state-review{
  color:var(--emerald);
  background:color-mix(in srgb,var(--emerald) 10%,transparent);
  border-color:color-mix(in srgb,var(--emerald) 26%,transparent);
}
.FR-state-relearning{
  color:var(--rose);
  background:color-mix(in srgb,var(--rose) 10%,transparent);
  border-color:color-mix(in srgb,var(--rose) 28%,transparent);
}
.FR-state-meta{ font-size:11px; color:var(--t3); font-weight:600; }

.FR-helper{
  padding:10px 14px; border-radius:12px;
  border:1px dashed color-mix(in srgb,var(--a) 30%,transparent);
  background:color-mix(in srgb,var(--a) 5%,transparent);
  color:var(--t2);
  font-size:12px; line-height:1.7; font-weight:500;
  display:flex; align-items:flex-start; gap:8px;
}
.FR-helper svg{ color:var(--a); flex-shrink:0; margin-top:2px; }

/* ══ RATING BUTTONS ══ */
.FR-ratings{ display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
@media(max-width:479px){ .FR-ratings{ grid-template-columns:1fr 1fr; } }

.FR-rate{
  display:flex; flex-direction:column; gap:4px;
  padding:14px 12px;
  border-radius:14px; border:1.5px solid transparent;
  cursor:pointer; font-family:inherit;
  transition:all .22s cubic-bezier(.22,1,.36,1);
  position:relative; overflow:hidden; text-align:start;
}
.FR-rate:disabled{ opacity:.55; cursor:not-allowed; transform:none !important; }
.FR-rate:hover:not(:disabled){ transform:translateY(-3px); box-shadow:0 8px 24px var(--rate-glow); }
.FR-rate::before{
  content:""; position:absolute; top:0; left:0; right:0; height:2px;
  background:linear-gradient(90deg,transparent,currentColor,transparent);
  opacity:.4;
}
.FR-rate-label{ font-size:14px; font-weight:900; letter-spacing:-.01em; }
.FR-rate-interval{
  font-size:12px; font-weight:700; opacity:.92;
  font-variant-numeric:tabular-nums;
  display:inline-flex; align-items:center; gap:6px;
}
.FR-rate-eq{
  display:inline-flex; align-items:center;
  padding:1px 7px; border-radius:999px;
  font-size:9.5px; font-weight:800; letter-spacing:.02em;
  background:color-mix(in srgb,currentColor 14%,transparent);
  border:1px solid color-mix(in srgb,currentColor 28%,transparent);
  line-height:1.4;
}
.FR-rate-hint{ font-size:10.5px; font-weight:600; opacity:.72; letter-spacing:-.005em; }
.FR-rate-key{ font-size:10px; font-weight:700; opacity:.5; font-variant-numeric:tabular-nums; margin-top:2px; }

.FR-rate-1{
  --rate-glow: color-mix(in srgb,var(--rose) 30%,transparent);
  background:color-mix(in srgb,var(--rose) 10%,transparent);
  color:var(--rose); border-color:color-mix(in srgb,var(--rose) 25%,transparent);
}
.FR-rate-2{
  --rate-glow: color-mix(in srgb,var(--amber) 30%,transparent);
  background:color-mix(in srgb,var(--amber) 10%,transparent);
  color:var(--amber); border-color:color-mix(in srgb,var(--amber) 25%,transparent);
}
.FR-rate-3{
  --rate-glow: color-mix(in srgb,var(--sky) 30%,transparent);
  background:color-mix(in srgb,var(--sky) 10%,transparent);
  color:var(--sky); border-color:color-mix(in srgb,var(--sky) 25%,transparent);
}
.FR-rate-4{
  --rate-glow: color-mix(in srgb,var(--emerald) 30%,transparent);
  background:color-mix(in srgb,var(--emerald) 10%,transparent);
  color:var(--emerald); border-color:color-mix(in srgb,var(--emerald) 25%,transparent);
}

/* ══ BOTTOM ACTIONS ══ */
.FR-actions{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
.FR-act-btn{
  display:inline-flex; align-items:center; gap:7px;
  padding:9px 18px; min-height:38px;
  border-radius:12px; border:1.5px solid var(--bd);
  background:var(--hover); color:var(--t2);
  font-size:12px; font-weight:700; font-family:inherit;
  cursor:pointer; transition:all .2s;
}
.FR-act-btn:hover{ background:var(--a-dim); border-color:var(--a); color:var(--a); }
.FR-act-btn:disabled{ opacity:.5; cursor:not-allowed; }

/* ══ EMPTY / DONE STATE ══ */
.FR-done{
  flex:1; display:flex; align-items:center; justify-content:center;
  padding:40px 20px; position:relative; z-index:2;
}
.FR-done-inner{ max-width:360px; text-align:center; }
.FR-done-icon{
  width:88px; height:88px; border-radius:26px; margin:0 auto 20px;
  display:flex; align-items:center; justify-content:center;
  background:linear-gradient(135deg,
    color-mix(in srgb,var(--emerald) 18%,transparent),
    color-mix(in srgb,var(--emerald) 8%,transparent));
  border:1.5px solid color-mix(in srgb,var(--emerald) 25%,transparent);
  color:var(--emerald);
  box-shadow:0 10px 32px color-mix(in srgb,var(--emerald) 25%,transparent);
  animation:fr-pulse 4s ease-in-out infinite alternate;
}
@keyframes fr-pulse{ 0%{ box-shadow:0 10px 32px color-mix(in srgb,var(--emerald) 25%,transparent); } 100%{ box-shadow:0 18px 48px color-mix(in srgb,var(--emerald) 35%,transparent); } }
.FR-done-title{ font-size:22px; font-weight:900; letter-spacing:-.03em; color:var(--t1); margin-bottom:8px; }
.FR-done-sub{ font-size:14px; line-height:1.65; color:var(--t3); font-weight:500; margin-bottom:24px; }
.FR-done-btn{
  display:inline-flex; align-items:center; gap:8px;
  padding:12px 28px; min-height:46px;
  border:none; border-radius:14px;
  background:linear-gradient(135deg,var(--a),color-mix(in srgb,var(--blue) 45%,var(--a)));
  color:#fff; font-size:14px; font-weight:800; font-family:inherit;
  cursor:pointer; text-decoration:none;
  box-shadow:0 6px 20px var(--a-glow);
  transition:all .3s cubic-bezier(.22,1,.36,1);
}
.FR-done-btn:hover{ box-shadow:0 12px 32px var(--a-glow); transform:translateY(-2px); }
`;

/* ── Types ── */
interface ReviewCard {
  id: string;
  frontHtml: string;
  backHtml: string;
  cardType: string;
  chapterNo: number | null;
  chapterTitle: string | null;
  sourceQuestionId: string | null;
  sourceDocId: string | null;
  sourceFrameId: string | null;
  tags: string[];
  deck: string | null;
  dueAt: number | null;
  state: string;
  intervalDays: number;
  isLeech: boolean;
  isSuspended: boolean;
  predictions: {
    again: { interval: string; days: number };
    hard:  { interval: string; days: number };
    good:  { interval: string; days: number };
    easy:  { interval: string; days: number };
  };
}

type RatingKey = "again" | "hard" | "good" | "easy";

const RATINGS: Array<{
  value: 1 | 2 | 3 | 4;
  key: RatingKey;
  fa: string;
  hintFa: string;
  class: string;
}> = [
  { value: 1, key: "again", fa: "دوباره", hintFa: "تکرار فوری",   class: "FR-rate-1" },
  { value: 2, key: "hard",  fa: "سخت",    hintFa: "هنوز ناپایدار", class: "FR-rate-2" },
  { value: 3, key: "good",  fa: "خوب",    hintFa: "تثبیت",         class: "FR-rate-3" },
  { value: 4, key: "easy",  fa: "آسان",   hintFa: "جهش به بعد",    class: "FR-rate-4" },
];

/* ── Persian-state + interval helpers ── */
const STATE_LABEL_FA: Record<string, { label: string; cls: string }> = {
  new:        { label: "جدید",           cls: "FR-state-new" },
  learning:   { label: "در حال یادگیری", cls: "FR-state-learning" },
  review:     { label: "مرور",           cls: "FR-state-review" },
  relearning: { label: "بازیادگیری",     cls: "FR-state-relearning" },
};

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
function toFaDigits(s: string) {
  return s.replace(/\d/g, (d) => FA_DIGITS[+d] ?? d);
}

/**
 * Persian-first, precision-preserving interval formatter.
 * Uses the raw `days` number from FSRS (avoids the server-side English
 * `1m` clamp that can flatten sub-minute distinctions). Still rounds
 * for display, but keeps buckets granular: minutes → hours → days → months → years.
 */
function formatIntervalFa(days: number): string {
  if (!Number.isFinite(days) || days <= 0) {
    // Sub-minute or zero — FSRS wants "as soon as possible".
    return "هم‌اکنون";
  }
  if (days < 1 / 24) {
    const m = Math.max(1, Math.round(days * 24 * 60));
    return toFaDigits(`${m} دقیقه`);
  }
  if (days < 1) {
    const h = Math.max(1, Math.round(days * 24));
    return toFaDigits(`${h} ساعت`);
  }
  if (days < 30) return toFaDigits(`${Math.round(days)} روز`);
  if (days < 365) {
    const mo = days / 30;
    return toFaDigits(`${mo < 10 ? mo.toFixed(1) : Math.round(mo)} ماه`);
  }
  const yr = days / 365;
  return toFaDigits(`${yr < 10 ? yr.toFixed(1) : Math.round(yr)} سال`);
}

function strip(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function FlashcardReviewScreen({ initialCards }: { initialCards: ReviewCard[] }) {
  const [cards,    setCards]    = useState(initialCards);
  const [index,    setIndex]    = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [showSC,   setShowSC]   = useState(false);

  const { dueCount, isReviewing, rateCard, setDueCountOptimistic } = useOptimisticFlashcard(initialCards.length);

  const current  = cards[index] ?? null;
  const progress = cards.length > 0 ? ((index + 1) / cards.length) * 100 : 0;

  useEffect(() => { setStartedAt(Date.now()); }, [index]);
  useEffect(() => { setDueCountOptimistic(cards.length); }, [cards.length, setDueCountOptimistic]);

  /* Keyboard shortcuts */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!current) return;
      if (e.key === " ") { e.preventDefault(); setRevealed(v => !v); }
      else if (["1","2","3","4"].includes(e.key) && revealed) {
        e.preventDefault(); void submitRating(Number.parseInt(e.key) as 1|2|3|4);
      } else if ((e.key === "u" || e.key === "U") && cards[index]) {
        e.preventDefault(); void undoRating();
      } else if (e.key === "?") { e.preventDefault(); setShowSC(v => !v); }
      else if (e.key === "Escape") { e.preventDefault(); window.location.href = "/flashcards"; }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cards, current, index, revealed]);

  const elapsedSeconds = useMemo(() => Math.max(1, Math.round((Date.now() - startedAt) / 1000)), [startedAt, index]);

  async function refreshQueue() {
    try {
      const rows = await getFlashcardsForReview(100);
      const next: ReviewCard[] = rows.map(r => ({
        id: r.id, frontHtml: r.front_html, backHtml: r.back_html,
        cardType: r.card_type, chapterNo: r.chapter_no, chapterTitle: null,
        sourceQuestionId: null, sourceDocId: null, sourceFrameId: null,
        tags: r.tags_json ? (JSON.parse(r.tags_json) as string[]) : [],
        deck: r.deck, dueAt: r.fsrs_due, state: r.fsrs_state ?? "new",
        intervalDays: 0, isLeech: (r.fsrs_lapses ?? 0) >= 8, isSuspended: false,
        predictions: {
          again: { interval: "۱۰ دقیقه", days: 0 },
          hard:  { interval: "۱ روز",    days: 1 },
          good:  { interval: "۳ روز",    days: 3 },
          easy:  { interval: "۷ روز",    days: 7 },
        },
      }));
      setCards(next); setDueCountOptimistic(next.length); setIndex(0); setRevealed(false);
    } catch {
      // Offline: gracefully end the session — reviewed cards are already
      // persisted in Dexie via submitReviewLocal and will sync on reconnect.
      if (!navigator.onLine) { setCards([]); setDueCountOptimistic(0); return; }
      try {
        const res  = await fetch("/api/flashcards/review?limit=100", { cache: "no-store" });
        const data = await res.json();
        const next = Array.isArray(data.cards) ? data.cards : [];
        const total = typeof data.totalDue === "number" ? Math.max(0, Math.trunc(data.totalDue)) : next.length;
        setCards(next); setDueCountOptimistic(total); setIndex(0); setRevealed(false);
      } catch {
        // Both paths failed — end session gracefully
        setCards([]); setDueCountOptimistic(0);
      }
    }
  }

  async function submitRating(rating: 1|2|3|4) {
    if (!current || isReviewing) return;
    const result = await rateCard(current.id, rating);
    let localSaved = false;
    if (isLocalFirstEnabled()) {
      // Local-first: enqueue an idempotent review entry so the sync
      // engine can push it once the network is available. This runs
      // regardless of whether rateCard succeeded — if the server call
      // failed (offline), the local Dexie write + outbox entry is the
      // user's only persistence path. If the server call DID succeed,
      // the outbox entry is harmless (server uses ON CONFLICT DO NOTHING).
      try {
        await submitReviewLocal({
          flashcardId: current.id,
          rating,
          reviewedAt: new Date().toISOString(),
          payload: { rating, elapsedSeconds },
        });
        localSaved = true;
      } catch {
        /* Dexie unavailable — fall through to legacy path. */
      }
    }
    // Advance if either the server accepted the review OR local-first
    // persisted it to Dexie. Without this, the user would be stuck on
    // the same card when offline with local-first enabled.
    if (!result.success && !localSaved) return;
    if (index >= cards.length - 1) { await refreshQueue(); return; }
    setIndex(v => v + 1); setRevealed(false);
  }

  async function undoRating() {
    if (!current || isReviewing) return;
    await fetch("/api/flashcards/review", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flashcardId: current.id }),
    });
    await refreshQueue();
  }

  /* ── Done state ── */
  if (!current) {
    return (
      <div className="FR" dir="rtl">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="FR-bg">
          <div className="FR-orb FR-orb-1" />
          <div className="FR-orb FR-orb-2" />
          <div className="FR-noise" />
        </div>
        <div className="FR-done">
          <div className="FR-done-inner">
            <div className="FR-done-icon"><CheckCircle2 size={38} /></div>
            <h1 className="FR-done-title">آفرین! همه کارت‌ها مرور شدند</h1>
            <p className="FR-done-sub">صف مرور امروز خالی شد. فردا کارت‌های جدید در انتظار شما هستند.</p>
            <Link href="/flashcards" className="FR-done-btn">
              <ArrowRight size={18} />
              بازگشت به فلش‌کارت‌ها
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── Review state ── */
  return (
    <div className="FR" dir="rtl">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="FR-bg">
        <div className="FR-orb FR-orb-1" />
        <div className="FR-orb FR-orb-2" />
        <div className="FR-noise" />
      </div>

      {/* Top bar */}
      <div className="FR-topbar">
        <Link href="/flashcards" className="FR-exit">
          <ArrowRight size={14} />
          خروج
        </Link>
        <div className="FR-sp" />
        <div className="FR-meta">
          <span className="FR-meta-chip">{index + 1} / {cards.length}</span>
          <span className="FR-meta-chip" style={{ color: "var(--emerald)", background: "color-mix(in srgb,var(--emerald) 12%,transparent)", borderColor: "color-mix(in srgb,var(--emerald) 25%,transparent)" }}>
            {dueCount} موعد
          </span>
          <span className="FR-elapsed">{elapsedSeconds}ث</span>
          <button type="button" className="FR-shortcut-btn" onClick={() => setShowSC(v => !v)}>
            <HelpCircle size={12} /> میانبرها
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="FR-prog-wrap">
        <div className="FR-prog-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="FR-main">

        {/* Shortcuts panel */}
        {showSC && (
          <div className="FR-sc-panel">
            <div className="FR-sc-title">میانبرهای صفحه‌کلید</div>
            <div className="FR-sc-row"><kbd className="FR-sc-key">Space</kbd><span className="FR-sc-desc">نمایش / مخفی کردن پاسخ</span></div>
            <div className="FR-sc-row"><kbd className="FR-sc-key">1–4</kbd><span className="FR-sc-desc">ارزیابی: دوباره / سخت / خوب / آسان</span></div>
            <div className="FR-sc-row"><kbd className="FR-sc-key">U</kbd><span className="FR-sc-desc">لغو آخرین ارزیابی</span></div>
            <div className="FR-sc-row"><kbd className="FR-sc-key">Esc</kbd><span className="FR-sc-desc">خروج از مرور</span></div>
          </div>
        )}

        {/* Card */}
        <div className="FR-card">
          {/* Hero — front */}
          <div className="FR-card-hero">
            <div className="FR-card-hero-inner">
              <div className="FR-card-chips">
                {current.chapterNo && (
                  <span className="FR-card-chip"><Hash size={9} /> فصل {current.chapterNo}</span>
                )}
                {current.chapterTitle && (
                  <span className="FR-card-chip">{current.chapterTitle}</span>
                )}
                {current.deck && (
                  <span className="FR-card-chip">{current.deck}</span>
                )}
                {current.isLeech && (
                  <span className="FR-card-chip FR-card-chip-leech">
                    <AlertTriangle size={9} /> دشوار
                  </span>
                )}
              </div>
              <div className="FR-qlabel">سوال</div>
              <div className="FR-qtext">{strip(current.frontHtml)}</div>
            </div>
          </div>

          {/* Body — answer or reveal button */}
          <div className="FR-card-body">
            {revealed ? (
              <>
                <div className="FR-adivider" />
                <div className="FR-alabel"><CheckCircle2 size={13} /> پاسخ</div>
                <div className="FR-atext">{strip(current.backHtml)}</div>
                {(current.sourceDocId || current.sourceQuestionId || current.chapterNo != null) && (
                  <div className="FR-src-row">
                    {(() => {
                      const href = buildReaderSourceHref({
                        chapterNo: current.chapterNo,
                        docId: current.sourceDocId,
                        frameId: current.sourceFrameId,
                        kind: "flashcard",
                      });
                      return href ? (
                        <Link href={href} className="FR-src-btn">
                          <BookOpen size={12} /> باز کردن منبع
                        </Link>
                      ) : null;
                    })()}
                  </div>
                )}
              </>
            ) : (
              <button type="button" className="FR-reveal" onClick={() => setRevealed(true)}>
                <Layers size={18} />
                نمایش پاسخ
                <span className="FR-reveal-hint">[فاصله]</span>
              </button>
            )}
          </div>
        </div>

        {/* Rating buttons + SRS state communication */}
        {revealed && (() => {
          const stateKey = (current.state || "new").toLowerCase();
          const stateInfo = STATE_LABEL_FA[stateKey] ?? STATE_LABEL_FA.new!;

          // Persian-formatted intervals derived from raw FSRS days — this is
          // the authoritative display, independent of the engine's English
          // "1m/4d" string (which can clamp sub-minute values).
          const faIntervals: Record<RatingKey, string> = {
            again: formatIntervalFa(current.predictions.again.days),
            hard:  formatIntervalFa(current.predictions.hard.days),
            good:  formatIntervalFa(current.predictions.good.days),
            easy:  formatIntervalFa(current.predictions.easy.days),
          };

          // Detect collisions: when ≥2 of the four displayed intervals are
          // identical, we mark them and show an explanatory note. This is
          // expected in early learning steps, not a bug.
          const counts = new Map<string, number>();
          (Object.values(faIntervals) as string[]).forEach((v) => {
            counts.set(v, (counts.get(v) ?? 0) + 1);
          });
          const hasCollision = Array.from(counts.values()).some((n) => n >= 2);
          const inEarlyLearning = stateKey === "new" || stateKey === "learning" || stateKey === "relearning";

          return (
            <>
              <div className="FR-state-row">
                <span className={`FR-state-chip ${stateInfo.cls}`}>{stateInfo.label}</span>
                <span className="FR-state-meta">
                  {current.intervalDays > 0
                    ? `فاصلهٔ فعلی: ${formatIntervalFa(current.intervalDays)}`
                    : "اولین مواجهه"}
                </span>
              </div>

              {hasCollision && inEarlyLearning && (
                <div className="FR-helper" role="note">
                  <Info size={14} aria-hidden />
                  <span>
                    این کارت هنوز در مرحلهٔ یادگیری اولیه است؛ برای همین چند گزینه فعلاً
                    زمان‌بندی یکسانی نشان می‌دهند. انتخاب شما روی دشواری و پایداری بلندمدت کارت اثر می‌گذارد.
                  </span>
                </div>
              )}

              <div className="FR-ratings">
                {RATINGS.map((r) => {
                  const iv = faIntervals[r.key];
                  const isShared = (counts.get(iv) ?? 0) >= 2;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      className={`FR-rate ${r.class}`}
                      onClick={() => void submitRating(r.value)}
                      disabled={isReviewing}
                      aria-label={`${r.fa} — ${r.hintFa} — ${iv}`}
                    >
                      <span className="FR-rate-label">{r.fa}</span>
                      <span className="FR-rate-interval">
                        {iv}
                        {isShared && inEarlyLearning && (
                          <span className="FR-rate-eq" aria-hidden>هم‌زمان</span>
                        )}
                      </span>
                      <span className="FR-rate-hint">{r.hintFa}</span>
                      <span className="FR-rate-key">{toFaDigits(`کلید ${r.value}`)}</span>
                    </button>
                  );
                })}
              </div>
            </>
          );
        })()}

        {/* Bottom actions */}
        <div className="FR-actions">
          <button
            type="button"
            className="FR-act-btn"
            onClick={() => void refreshQueue()}
            disabled={isReviewing}
          >
            <RotateCcw size={13} />
            بازسازی صف
          </button>
          <button
            type="button"
            className="FR-act-btn"
            onClick={() => void undoRating()}
            disabled={isReviewing}
          >
            لغو آخرین
          </button>
        </div>
      </div>
    </div>
  );
}
