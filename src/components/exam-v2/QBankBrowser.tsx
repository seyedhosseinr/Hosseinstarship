"use client";

/**
 * QBankBrowser  v4.0 — Flagship 2026
 * Same design DNA as Library v4.0 & Hossein Starship Dashboard v5.0.
 * CSS-in-JSX pattern — all QB-* tokens self-contained.
 */

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Play, Menu, Search } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { QBankSidebar, type SidebarSubject } from "./QBankSidebar";
import { QBankCardList } from "./QBankCardList";
import type { QBankQuestion } from "@/lib/qbank/queries";
import { getAllSubjects, getAllChapters } from "@/lib/exam/campbell-exam-builder";
import { useCollections } from "@/hooks/useCollections";

const ALL_SUBJECTS = getAllSubjects();
const ALL_CHAPTERS  = getAllChapters();
const CHAPTER_TITLE_MAP = new Map(ALL_CHAPTERS.map((c) => [c.id, c.title]));

function normalizeChapterId(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const match = text.match(/^(?:ch-)?0*(\d{1,3})$/i);
  if (!match) return text;
  return `ch-${Number(match[1])}`;
}

/* ═══════════════════════════════════════════════════
   ALL CSS  — scoped under .QB
═══════════════════════════════════════════════════ */
export const QB_CSS = `
/* ── Reset ── */
.QB*,.QB*::before,.QB*::after{box-sizing:border-box;margin:0;padding:0;}

/* ══ Token bridge — Light ══ */
.QB{
  --a:         hsl(166 90% 26%);
  --a2:        hsl(38  92% 50%);
  --a3:        hsl(213 94% 57%);
  --a-glow:    color-mix(in srgb,hsl(166 90% 26%) 35%,transparent);
  --a-dim:     color-mix(in srgb,hsl(166 90% 26%) 10%,transparent);
  --a-dim2:    color-mix(in srgb,hsl(166 90% 26%) 17%,transparent);
  --blue:      #0369A1; --teal:#0D9488; --emerald:#047857;
  --rose:      #BE123C; --amber:#D97706; --violet:#7C3AED;
  --bg:        hsl(168 30% 94%);
  --surface:   rgba(255,255,255,0.86);
  --solid:     hsl(168 20% 98%);
  --hover:     hsl(168 28% 95%);
  --active:    color-mix(in srgb,hsl(166 90% 26%) 9%,transparent);
  --bd:        hsl(170 20% 85%);
  --bd-s:      hsl(170 18% 90%);
  --t1:        hsl(200 80% 5%);
  --t2:        hsl(195 25% 25%);
  --t3:        hsl(195 14% 42%);
  --blur:      blur(32px) saturate(2);
  --sh:        0 2px 8px rgba(0,70,60,.07),0 8px 32px rgba(0,70,60,.06);
  --noise:     url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
  --correct:   #047857; --correct-bg:#f0fdf4; --correct-bd:#86efac;
  --wrong:     #be123c; --wrong-bg:#fef2f2;   --wrong-bd:#fca5a5;
}

/* ══ Token bridge — Dark ══ */
.dark .QB{
  --a:       hsl(172 72% 46%);  --a2:hsl(38 90% 58%);  --a3:hsl(213 80% 65%);
  --a-glow:  color-mix(in srgb,hsl(172 72% 46%) 40%,transparent);
  --a-dim:   color-mix(in srgb,hsl(172 72% 46%) 13%,transparent);
  --a-dim2:  color-mix(in srgb,hsl(172 72% 46%) 20%,transparent);
  --blue:#22D3EE; --teal:#2DD4BF; --emerald:#34D399;
  --rose:#FB7185; --amber:#FBBF24; --violet:#A78BFA;
  --bg:      hsl(195 28% 4%);
  --surface: rgba(255,255,255,0.042);
  --solid:   hsl(195 22% 8%);
  --hover:   hsl(195 16% 11%);
  --active:  color-mix(in srgb,hsl(172 72% 46%) 13%,transparent);
  --bd:      hsl(195 14% 14%);
  --bd-s:    hsl(195 12% 11%);
  --t1:hsl(170 20% 95%); --t2:hsl(170 12% 68%); --t3:hsl(170 8% 50%);
  --sh:      0 2px 12px rgba(0,0,0,.42),0 6px 28px rgba(0,0,0,.30);
  --correct:   #34d399; --correct-bg:#052e16; --correct-bd:#166534;
  --wrong:     #fb7185; --wrong-bg:#450a0a;   --wrong-bd:#991b1b;
}

/* ══ ROOT ══ */
.QB{
  display:flex; flex-direction:column; height:100dvh;
  font-family:var(--font-vazir,'Vazirmatn'),Tahoma,system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;
  background:var(--bg); color:var(--t1);
  position:relative; overflow:hidden; direction:rtl;
}

/* ══ Background orbs + noise ══ */
.QB-bg{ position:absolute; inset:0; z-index:0; pointer-events:none; overflow:hidden; }
.QB-orb{ position:absolute; border-radius:50%; filter:blur(72px); will-change:transform,opacity; }
.QB-orb-1{
  width:600px; height:600px; top:-250px; right:-180px;
  background:radial-gradient(circle,color-mix(in srgb,var(--a) 26%,transparent) 0%,transparent 65%);
  animation:qb-orb1 22s ease-in-out infinite alternate;
}
.QB-orb-2{
  width:480px; height:480px; bottom:-180px; left:-120px;
  background:radial-gradient(circle,color-mix(in srgb,var(--blue) 20%,transparent) 0%,transparent 60%);
  animation:qb-orb2 28s ease-in-out infinite alternate;
}
.QB-orb-3{
  width:360px; height:360px; top:38%; left:40%;
  background:radial-gradient(circle,color-mix(in srgb,var(--teal) 13%,transparent) 0%,transparent 55%);
  animation:qb-orb3 17s ease-in-out infinite alternate;
}
@keyframes qb-orb1{0%{transform:translate(0,0) scale(1);opacity:.8;}50%{transform:translate(-50px,35px) scale(1.1);opacity:.9;}100%{transform:translate(25px,-45px) scale(.95);opacity:.7;}}
@keyframes qb-orb2{0%{transform:translate(0,0) scale(1);opacity:.6;}50%{transform:translate(45px,-25px) scale(1.08);opacity:.8;}100%{transform:translate(-35px,55px) scale(.93);opacity:.5;}}
@keyframes qb-orb3{0%{transform:translate(0,0) scale(1);opacity:.4;}100%{transform:translate(70px,-55px) scale(1.18);opacity:.6;}}
.QB-noise{
  position:absolute; inset:0; z-index:1; pointer-events:none;
  opacity:.028; mix-blend-mode:overlay;
  background-image:var(--noise); background-size:200px 200px;
}

/* ══ HEADER ══ */
.QB-header{ position:relative; z-index:20; flex-shrink:0; }
.QB-accent{
  height:3px;
  background:linear-gradient(90deg,var(--a),var(--a2),var(--a3),var(--a));
  background-size:300% 100%;
  animation:qb-accent 7s ease-in-out infinite;
}
@keyframes qb-accent{0%,100%{background-position:0% 50%;}50%{background-position:100% 50%;}}
.QB-hbar{
  display:flex; align-items:center; gap:10px;
  height:56px; padding:0 20px;
  background:var(--surface);
  backdrop-filter:var(--blur);
  -webkit-backdrop-filter:var(--blur);
  border-bottom:1px solid var(--bd);
  box-shadow:var(--sh);
}
.QB-menu{
  width:36px; height:36px; border-radius:10px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
  border:1.5px solid var(--bd); background:var(--hover);
  color:var(--t2); cursor:pointer;
  transition:all .22s cubic-bezier(.22,1,.36,1);
}
.QB-menu:hover{ background:var(--a-dim); border-color:var(--a); color:var(--a); }
.QB-menu.on{
  background:var(--a-dim2); border-color:color-mix(in srgb,var(--a) 35%,transparent);
  color:var(--a);
}
.QB-brand{ display:flex; align-items:center; gap:10px; cursor:default; flex-shrink:0; }
.QB-brand-icon{
  width:36px; height:36px; border-radius:10px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
  background:linear-gradient(135deg,var(--emerald),color-mix(in srgb,var(--a) 60%,var(--emerald)));
  color:#fff; box-shadow:0 4px 14px color-mix(in srgb,var(--emerald) 32%,transparent);
}
.QB-brand-text{ display:flex; flex-direction:column; gap:1px; }
.QB-brand-title{ font-size:13px; font-weight:800; letter-spacing:-.02em; color:var(--t1); line-height:1.2; }
.QB-brand-sub{
  font-size:9px; font-weight:700; letter-spacing:.1em; text-transform:uppercase;
  background:linear-gradient(90deg,var(--t3),var(--a));
  -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
}
.QB-count{
  display:inline-flex; align-items:center; gap:5px;
  padding:4px 12px; border-radius:20px;
  font-size:11px; font-weight:700; font-variant-numeric:tabular-nums;
  background:var(--a-dim); color:var(--a);
  border:1.5px solid color-mix(in srgb,var(--a) 22%,transparent);
}
.QB-sp{ flex:1; }
.QB-hsr{
  display:none; align-items:center; gap:8px;
  padding:7px 14px; border-radius:10px;
  border:1.5px solid var(--bd); background:var(--hover);
  cursor:text; transition:all .2s; min-width:180px;
}
@media(min-width:1024px){.QB-hsr{display:flex;}}
.QB-hsr:focus-within{ border-color:var(--a); box-shadow:0 0 0 3px var(--a-dim); background:var(--solid); }
.QB-hsr input{ border:none; outline:none; background:transparent; font-size:12px; font-weight:500; color:var(--t1); font-family:inherit; direction:rtl; width:100%; }
.QB-hsr input::placeholder{ color:var(--t3); }
.QB-exam-btn{
  display:inline-flex; align-items:center; gap:7px;
  padding:7px 16px; min-height:36px;
  border:none; border-radius:10px;
  background:linear-gradient(135deg,var(--emerald),color-mix(in srgb,var(--a) 50%,var(--emerald)));
  color:#fff; font-size:12px; font-weight:800; font-family:inherit;
  cursor:pointer; flex-shrink:0; white-space:nowrap;
  box-shadow:0 4px 14px color-mix(in srgb,var(--emerald) 30%,transparent);
  transition:all .22s cubic-bezier(.22,1,.36,1);
  position:relative; overflow:hidden;
}
.QB-exam-btn::before{
  content:""; position:absolute; inset:0;
  background:linear-gradient(90deg,transparent 30%,rgba(255,255,255,.22) 50%,transparent 70%);
  transform:translateX(-120%); transition:transform .5s;
}
.QB-exam-btn:hover::before{transform:translateX(120%);}
.QB-exam-btn:hover{ box-shadow:0 8px 24px color-mix(in srgb,var(--emerald) 38%,transparent); transform:translateY(-1px); }

/* ══ BODY LAYOUT ══ */
.QB-body{ position:relative; z-index:2; display:flex; flex:1; min-height:0; overflow:hidden; }

/* ══ SIDEBAR ══ */
.QB-sidebar-wrap{
  flex-shrink:0; overflow:hidden;
  background:var(--surface);
  backdrop-filter:var(--blur);
  -webkit-backdrop-filter:var(--blur);
  border-inline-end:1px solid var(--bd);
}
.QB-sidebar{ height:100%; overflow-y:auto; overflow-x:hidden; width:280px; }
.QB-sidebar::-webkit-scrollbar{ width:4px; }
.QB-sidebar::-webkit-scrollbar-track{ background:transparent; }
.QB-sidebar::-webkit-scrollbar-thumb{ background:var(--bd); border-radius:99px; }
.QB-sidebar::-webkit-scrollbar-thumb:hover{ background:var(--a); }

/* All-questions row */
.QB-all{
  display:flex; align-items:center; justify-content:space-between;
  padding:12px 16px; min-height:46px;
  border:none; border-bottom:1px solid var(--bd-s);
  border-inline-start:3px solid transparent;
  background:transparent; color:var(--t1);
  cursor:pointer; font-family:inherit; width:100%;
  transition:all .18s;
}
.QB-all:hover{ background:var(--hover); border-inline-start-color:color-mix(in srgb,var(--a) 40%,transparent); }
.QB-all.on{
  background:var(--active); color:var(--a);
  border-inline-start-color:var(--a);
  font-weight:700;
}
.QB-all-label{ font-size:12px; font-weight:600; }
.QB-all.on .QB-all-label{ font-weight:800; }

/* Subject row */
.QB-sub{
  display:flex; align-items:center; gap:8px;
  padding:10px 14px; min-height:44px;
  border:none; border-bottom:1px solid var(--bd-s);
  border-inline-start:3px solid transparent;
  background:color-mix(in srgb,var(--solid) 92%,var(--a-dim));
  color:var(--t2); cursor:pointer; font-family:inherit; width:100%;
  transition:all .18s; text-align:start;
}
.QB-sub:hover{ background:color-mix(in srgb,var(--solid) 85%,var(--a-dim2)); border-inline-start-color:color-mix(in srgb,var(--a) 35%,transparent); }
.QB-sub.on{
  background:color-mix(in srgb,var(--a-dim) 55%,var(--solid));
  color:var(--a); border-inline-start-color:var(--a);
}
.QB-sub-name{ flex:1; font-size:11px; font-weight:700; letter-spacing:-.01em; line-height:1.35;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.QB-sub-chev{ flex-shrink:0; color:var(--t3); transition:transform .25s cubic-bezier(.22,1,.36,1),color .18s; }
.QB-sub.on .QB-sub-chev{ transform:rotate(180deg); color:var(--a); }

/* System row */
.QB-sys{
  display:flex; align-items:center; gap:6px;
  padding:8px 14px 8px 24px; min-height:38px;
  border:none; border-bottom:1px solid var(--bd-s);
  border-inline-start:3px solid transparent;
  background:transparent; color:var(--t2);
  cursor:pointer; font-family:inherit; width:100%;
  transition:all .18s; text-align:start;
}
.QB-sys:hover{ background:var(--hover); border-inline-start-color:color-mix(in srgb,var(--a) 30%,transparent); }
.QB-sys.on{ background:var(--active); color:var(--a); border-inline-start-color:color-mix(in srgb,var(--a) 70%,transparent); }
.QB-sys-name{ flex:1; font-size:11px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.QB-sys-chev{ flex-shrink:0; color:var(--t3); transition:transform .22s cubic-bezier(.22,1,.36,1); }
.QB-sys.on .QB-sys-chev, .QB-sys.ex .QB-sys-chev{ transform:rotate(90deg); color:var(--a); }

/* Chapter row */
.QB-ch{
  display:flex; align-items:center; justify-content:space-between;
  padding:7px 14px 7px 36px; min-height:34px;
  border:none; border-bottom:1px solid var(--bd-s);
  border-inline-start:3px solid transparent;
  background:transparent; color:var(--t3);
  cursor:pointer; font-family:inherit; width:100%;
  transition:all .15s; text-align:start;
}
.QB-ch:hover{ background:var(--hover); color:var(--t2); border-inline-start-color:color-mix(in srgb,var(--a) 25%,transparent); }
.QB-ch.on{ background:var(--active); color:var(--a); border-inline-start-color:var(--a); font-weight:700; }
.QB-ch-label{ flex:1; font-size:10px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding-inline-end:6px; }

/* Count badge */
.QB-cnt{
  font-size:10px; font-weight:700; font-variant-numeric:tabular-nums;
  padding:1px 7px; border-radius:20px;
  background:var(--a-dim); color:var(--a); flex-shrink:0;
  transition:background .18s, color .18s;
}
.QB-sub.on .QB-cnt,.QB-all.on .QB-cnt{ background:var(--a); color:#fff; }

/* ══ MAIN AREA ══ */
.QB-main{ flex:1; min-width:0; display:flex; flex-direction:column; overflow:hidden; }

/* Filter bar */
.QB-fbar{
  flex-shrink:0; position:sticky; top:0; z-index:10;
  padding:10px 16px 10px;
  background:var(--surface);
  backdrop-filter:var(--blur);
  -webkit-backdrop-filter:var(--blur);
  border-bottom:1px solid var(--bd);
  box-shadow:0 1px 0 var(--bd);
}
.QB-fsearch{
  display:flex; align-items:center; gap:8px;
  padding:9px 14px; border-radius:12px;
  border:1.5px solid var(--bd); background:var(--solid);
  transition:all .2s; margin-bottom:8px;
}
.QB-fsearch:focus-within{ border-color:var(--a); box-shadow:0 0 0 3px var(--a-dim); }
.QB-fsearch input{ flex:1; border:none; outline:none; background:transparent; font-size:13px; color:var(--t1); font-family:inherit; direction:rtl; }
.QB-fsearch input::placeholder{ color:var(--t3); }
.QB-chips{ display:flex; align-items:center; flex-wrap:wrap; gap:6px; }
.QB-chip{
  display:inline-flex; align-items:center; gap:5px;
  padding:5px 12px; border-radius:20px; min-height:30px;
  border:1.5px solid var(--bd); background:var(--hover);
  color:var(--t3); font-size:11px; font-weight:700; font-family:inherit;
  cursor:pointer; transition:all .18s;
}
.QB-chip:hover{ background:var(--a-dim); border-color:color-mix(in srgb,var(--a) 28%,transparent); color:var(--a); }
.QB-chip.on{ background:var(--a-dim2); border-color:color-mix(in srgb,var(--a) 35%,transparent); color:var(--a); }
.QB-chip-easy.on{ background:color-mix(in srgb,var(--emerald) 12%,transparent); border-color:color-mix(in srgb,var(--emerald) 28%,transparent); color:var(--emerald); }
.QB-chip-med.on{ background:color-mix(in srgb,var(--amber) 12%,transparent); border-color:color-mix(in srgb,var(--amber) 28%,transparent); color:var(--amber); }
.QB-chip-hard.on{ background:color-mix(in srgb,var(--rose) 12%,transparent); border-color:color-mix(in srgb,var(--rose) 28%,transparent); color:var(--rose); }
.QB-chip-bm.on{ background:color-mix(in srgb,var(--violet) 12%,transparent); border-color:color-mix(in srgb,var(--violet) 28%,transparent); color:var(--violet); }
.QB-fcount{ margin-inline-start:auto; font-size:11px; font-weight:700; color:var(--t3); font-variant-numeric:tabular-nums; }

/* Question list */
.QB-qlist{ flex:1; overflow-y:auto; overflow-x:hidden; }
.QB-qlist::-webkit-scrollbar{ width:5px; }
.QB-qlist::-webkit-scrollbar-track{ background:transparent; }
.QB-qlist::-webkit-scrollbar-thumb{ background:var(--bd); border-radius:99px; }
.QB-qlist::-webkit-scrollbar-thumb:hover{ background:var(--a); }

/* Question card */
.QB-card{
  border-bottom:1px solid var(--bd-s);
  transition:background .15s;
}
.QB-card.open{ background:var(--hover); }

/* Card header (click to expand) */
.QB-card-head{
  display:flex; align-items:flex-start; gap:10px;
  padding:12px 16px; min-height:56px;
  border:none; background:transparent;
  cursor:pointer; font-family:inherit; width:100%; text-align:start;
  transition:background .15s;
}
.QB-card:not(.open) .QB-card-head:hover{ background:color-mix(in srgb,var(--hover) 60%,transparent); }

.QB-card-idx{
  width:32px; height:32px; border-radius:9px; flex-shrink:0; margin-top:2px;
  display:flex; align-items:center; justify-content:center;
  font-size:11px; font-weight:800; font-variant-numeric:tabular-nums;
  background:var(--a-dim); color:var(--a);
  border:1.5px solid color-mix(in srgb,var(--a) 20%,transparent);
  transition:all .18s;
}
.QB-card.open .QB-card-idx{
  background:linear-gradient(135deg,var(--a),color-mix(in srgb,var(--blue) 40%,var(--a)));
  color:#fff; border-color:transparent;
  box-shadow:0 4px 10px var(--a-glow);
}

.QB-card-content{ flex:1; min-width:0; }
.QB-card-stem{
  font-size:13px; line-height:1.55; color:var(--t1);
  overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
  text-align:start; margin-bottom:6px;
}
.QB-card-tags{ display:flex; align-items:center; flex-wrap:wrap; gap:5px; }
.QB-diff{
  display:inline-flex; align-items:center;
  padding:2px 8px; border-radius:20px;
  font-size:10px; font-weight:800; letter-spacing:.04em;
}
.QB-diff-easy{ background:color-mix(in srgb,var(--emerald) 12%,transparent); color:var(--emerald); }
.QB-diff-med{  background:color-mix(in srgb,var(--amber) 12%,transparent);   color:var(--amber);   }
.QB-diff-hard{ background:color-mix(in srgb,var(--rose) 12%,transparent);    color:var(--rose);    }
.QB-chtag{
  display:inline-flex; align-items:center;
  padding:2px 8px; border-radius:20px;
  font-size:10px; font-weight:700;
  background:var(--a-dim); color:var(--a);
}

.QB-card-actions{ display:flex; align-items:flex-start; gap:4px; flex-shrink:0; margin-top:2px; }
.QB-bm{
  width:32px; height:32px; border-radius:8px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
  border:none; background:transparent; color:var(--t3);
  cursor:pointer; transition:all .18s;
}
.QB-bm:hover{ background:var(--a-dim); color:var(--a); }
.QB-bm.on{ color:var(--violet); }
.QB-chev{ color:var(--t3); transition:transform .25s cubic-bezier(.22,1,.36,1),color .18s; }
.QB-card.open .QB-chev{ transform:rotate(180deg); color:var(--a); }

/* Expanded body */
.QB-card-body{ padding:0 16px 16px; }
.QB-full-stem{
  font-size:13px; line-height:1.7; color:var(--t1);
  padding:12px 14px; border-radius:10px;
  border:1px solid var(--bd-s); background:var(--solid);
  margin-bottom:10px;
}
.QB-options{ display:flex; flex-direction:column; gap:6px; margin-bottom:10px; }
.QB-opt{
  display:flex; align-items:flex-start; gap:10px;
  padding:10px 14px; border-radius:10px;
  border:1.5px solid var(--bd-s); background:var(--solid);
  font-size:12px; line-height:1.5; color:var(--t1);
  transition:all .18s;
}
.QB-opt.correct{
  border-color:var(--correct-bd) !important;
  background:var(--correct-bg) !important;
  color:var(--correct);
}
.QB-opt-letter{ font-weight:800; color:var(--t3); flex-shrink:0; font-variant-numeric:tabular-nums; transition:color .18s; }
.QB-opt.correct .QB-opt-letter{ color:var(--correct); }
.QB-reveal{
  display:inline-flex; align-items:center; gap:7px;
  padding:8px 16px; border-radius:10px; min-height:36px;
  border:1.5px solid var(--bd); background:var(--hover);
  color:var(--t2); font-size:12px; font-weight:700; font-family:inherit;
  cursor:pointer; transition:all .2s;
}
.QB-reveal:hover{ border-color:var(--a); background:var(--a-dim); color:var(--a); }
.QB-reveal.shown{ border-color:color-mix(in srgb,var(--emerald) 28%,transparent); background:color-mix(in srgb,var(--emerald) 10%,transparent); color:var(--emerald); }
.QB-explanation{
  margin-top:10px; padding:12px 14px; border-radius:10px;
  border:1.5px solid var(--bd-s); background:var(--solid);
  font-size:12px; line-height:1.75; color:var(--t2);
}
.QB-explanation-label{ font-size:10px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:var(--a); margin-bottom:6px; }

/* Empty state */
.QB-empty{
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  padding:64px 24px; gap:14px; text-align:center; color:var(--t3);
}
.QB-empty-icon{
  width:72px; height:72px; border-radius:22px;
  display:flex; align-items:center; justify-content:center;
  background:var(--a-dim2); color:var(--a); opacity:.65;
  box-shadow:0 8px 24px var(--a-glow);
}
.QB-empty-title{ font-size:15px; font-weight:700; color:var(--t2); max-width:220px; line-height:1.5; }
.QB-empty-sub{ font-size:12px; font-weight:500; max-width:200px; line-height:1.6; }

/* Responsive */
@media(max-width:767px){
  .QB-brand-text{display:none;}
  .QB-count{display:none;}
}
`;

export interface QBankBrowserProps {
  questions: QBankQuestion[];
  initialChapterId?: string | null;
  initialMode?: string | null;
}

export function QBankBrowser({
  questions: initialQuestions,
  initialChapterId,
  initialMode,
}: QBankBrowserProps) {
  const router = useRouter();
  const { collections, addItem, isBookmarked: isInCollection } = useCollections();

  const [questions]    = useState<QBankQuestion[]>(initialQuestions);
  const [selSubject,   setSelSubject]   = useState<string | null>(null);
  const [selSystem,    setSelSystem]    = useState<string | null>(null);
  const [selChapter,   setSelChapter]   = useState<string | null>(normalizeChapterId(initialChapterId));
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [headerSearch, setHeaderSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (initialMode) initial.add(initialMode.toLowerCase());
    return initial;
  });

  const hydrated = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("starship:qbank-filters");
      if (!raw) { hydrated.current = true; return; }
      const saved = JSON.parse(raw);
      if (saved.sidebarOpen !== undefined) setSidebarOpen(saved.sidebarOpen);
    } catch { /**/ }
    hydrated.current = true;
  }, []);

  const persistFilters = useCallback(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem("starship:qbank-filters", JSON.stringify({ sidebarOpen }));
    } catch { /**/ }
  }, [sidebarOpen]);
  useEffect(() => { persistFilters(); }, [persistFilters]);

  const toggleFilter = (filter: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      next.has(filter) ? next.delete(filter) : next.add(filter);
      return next;
    });
  };

  const chapterCounts = useMemo(() => {
    const map = new Map<string, number>();
    questions.forEach((q) => {
      (q.tags ?? []).forEach((t) => {
        if (!t.startsWith("ch-")) return;
        const n = parseInt(t.replace(/^ch-0*/i, ""), 10);
        if (isNaN(n)) return;
        const unpadded = `ch-${n}`;
        const padded   = `ch-${String(n).padStart(3, "0")}`;
        map.set(unpadded, (map.get(unpadded) ?? 0) + 1);
        if (padded !== unpadded) map.set(padded, (map.get(padded) ?? 0) + 1);
      });
    });
    return map;
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    let qs = questions;
    if (selChapter) {
      const n = parseInt(selChapter.replace(/^ch-0*/i, ""), 10);
      const tags = isNaN(n) ? [selChapter] : [`ch-${n}`, `ch-${String(n).padStart(3, "0")}`];
      qs = qs.filter((q) => (q.tags ?? []).some((t) => tags.includes(t)));
    } else if (selSystem) {
      const sys = ALL_SUBJECTS.flatMap((s) => s.systems).find((s) => s.id === selSystem);
      if (sys) {
        const cset = new Set(sys.chapterIds);
        qs = qs.filter((q) =>
          (q.tags ?? []).some((t) => {
            if (!t.startsWith("ch-")) return false;
            const n = parseInt(t.replace(/^ch-0*/i, ""), 10);
            return !isNaN(n) && (cset.has(`ch-${n}`) || cset.has(`ch-${String(n).padStart(3, "0")}`));
          })
        );
      }
    }

    if (activeFilters.has("wrong") || activeFilters.has("missed")) {
      // @ts-expect-error - lastOutcome is not in the base type but may exist from query
      qs = qs.filter((q) => q.lastOutcome === "incorrect");
    }
    if (activeFilters.has("bookmarked")) {
      qs = qs.filter((q) => isInCollection(q.id));
    }

    return qs;
  }, [questions, selChapter, selSystem, activeFilters, isInCollection]);

  const handleBookmark = useCallback(
    (questionId: string) => {
      const col = collections[0];
      if (col) addItem(col.id, { type: "question", title: questionId, href: `/qbank?q=${questionId}` });
    },
    [collections, addItem],
  );

  return (
    <div className="QB" dir="rtl">
      <style dangerouslySetInnerHTML={{ __html: QB_CSS }} />

      {/* Background */}
      <div className="QB-bg">
        <div className="QB-orb QB-orb-1" />
        <div className="QB-orb QB-orb-2" />
        <div className="QB-orb QB-orb-3" />
        <div className="QB-noise" />
      </div>

      {/* Header */}
      <header className="QB-header">
        <div className="QB-accent" />
        <div className="QB-hbar">
          <button
            type="button"
            className={`QB-menu ${sidebarOpen ? "on" : ""}`}
            onClick={() => setSidebarOpen((s) => !s)}
          >
            <Menu size={16} />
          </button>

          <div className="QB-brand">
            <div className="QB-brand-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L14 4V8C14 11.31 11.31 14 8 14C4.69 14 2 11.31 2 8V4L8 1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
                <path d="M5.5 8.5L7 10L10.5 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="QB-brand-text">
              <span className="QB-brand-title">بانک سؤالات</span>
              <span className="QB-brand-sub">Campbell Urology</span>
            </div>
          </div>

          <div className="QB-count">
            {filteredQuestions.length} / {questions.length} سؤال
          </div>

          <div className="QB-sp" />

          <div className="QB-hsr">
            <Search size={13} style={{ color: "var(--t3)", flexShrink: 0 }} />
            <input
              placeholder="جستجوی سریع…"
              value={headerSearch}
              onChange={(e) => setHeaderSearch(e.target.value)}
            />
          </div>

          <button type="button" className="QB-exam-btn" onClick={() => router.push("/exam/builder")}>
            <Play size={13} />
            ساخت آزمون
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="QB-body">
        {/* Sidebar with Framer Motion width animation */}
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.div
              key="qb-sidebar"
              className="QB-sidebar-wrap"
              initial={{ width: 0 }}
              animate={{ width: 280 }}
              exit={{ width: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <QBankSidebar
                subjects={ALL_SUBJECTS as SidebarSubject[]}
                chapterCounts={chapterCounts}
                chapterTitleMap={CHAPTER_TITLE_MAP}
                selectedSubjectId={selSubject}
                selectedSystemId={selSystem}
                selectedChapterId={selChapter}
                onSelectSubject={setSelSubject}
                onSelectSystem={setSelSystem}
                onSelectChapter={setSelChapter}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <main className="QB-main">
          <div className="QB-fbar">
            <div className="QB-chips">
              <button
                type="button"
                className={`QB-chip ${
                  activeFilters.has("wrong") || activeFilters.has("missed") ? "on QB-chip-hard" : ""
                }`}
                onClick={() => toggleFilter("wrong")}
              >
                فقط اشتباهات
              </button>
              <button
                type="button"
                className={`QB-chip ${activeFilters.has("bookmarked") ? "on QB-chip-bm" : ""}`}
                onClick={() => toggleFilter("bookmarked")}
              >
                نشان‌شده
              </button>
            </div>
          </div>
          <QBankCardList
            questions={filteredQuestions}
            externalSearch={headerSearch}
            isBookmarked={(id) => isInCollection(id)}
            onToggleBookmark={handleBookmark}
          />
        </main>
      </div>
    </div>
  );
}
