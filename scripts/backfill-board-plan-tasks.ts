#!/usr/bin/env npx tsx
/**
 * scripts/backfill-board-plan-tasks.ts  — v5 (شروع از فصل 146 ادرنال)
 *
 * ترتیب Pass 1:
 *   ① Ch145-147 Adrenal (شروع اینجا — خواسته کاربر)
 *   ② Ch148-166 Prostate/BPH/PCa
 *   ③ Ch129-135 Bladder Ca
 *   ④ Ch136-144 Renal/UUT
 *   ⑤ Ch101-123 LUTS/Incont/Pelvic
 *   ⑥ Ch95-100  Stones
 *   ⑦ Ch66-87   Andrology/Sexual/Genitalia
 *   ⑧ Ch32-64   Pediatrics
 *   ⑨ Ch2-31    Core/Infections
 *   ⑩ Ch88-94   Renal Physio/Upper Tract
 *
 * ۷ روز/هفته · هر ۱۴ روز Light Day · هر ۷ روز Audit 30min
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { getCampbellChapterMetadata } from "../src/lib/planner/task-title";
import {
  getActivePlan,
  listDaysByPlan,
  countTasksByStatus,
  createTasksBatch,
  recalcDayProgress,
  recalcPlanProgress,
  upsertSettings,
  getSettings,
  type StudyTaskInsert,
} from "@/lib/db/queries/planner";

const ROOT            = resolve(__dirname, "..");
const MANIFEST_PATH   = resolve(ROOT, "data", "campbell-board-2025.json");
const DAILY_GOAL      = 420;
const EFFECTIVE_START = "2026-03-18";

interface Ch {
  chapter:number; volume:number; part:string;
  title:string; start_page:number; end_page:number; included:boolean;
}
interface Sess {
  chapter:number;
  chapterTitle:string;
  topic:string;
  mins:number;
  priority:number;
  partIndex:number;
  partCount:number;
}

function genId(p:string){ return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }

function extractManifest(raw:string): Ch[] {
  const text = raw.replace(/^\uFEFF/,"");
  const s = text.indexOf("[");
  if(s===-1) throw new Error("No JSON array in manifest");
  let d=0, e=-1;
  for(let i=s;i<text.length;i++){
    if(text[i]==="[") d++;
    else if(text[i]==="]"){ d--; if(d===0){e=i;break;} }
  }
  if(e===-1) throw new Error("Unterminated JSON array");
  return JSON.parse(text.slice(s,e+1)) as Ch[];
}

function prio(n:number):number {
  if(n>=129&&n<=145) return 5;
  if(n>=148&&n<=166) return 5;
  if(n>=101&&n<=123) return 5;
  if(n>=95 &&n<=100) return 4;
  if(n>=66 &&n<=87)  return 4;
  if(n>=32 &&n<=64)  return 4;
  if(n>=2  &&n<=31)  return 3;
  if(n>=88 &&n<=94)  return 3;
  return 2;
}

function buildChapterSessionTitle(session:Sess, stage:"pass1"|"pass2"): string {
  const partSuffix = session.partCount > 1 ? ` (Part ${session.partIndex}/${session.partCount})` : "";
  const action = stage === "pass2" ? "Rapid Review" : "Read + Review";
  return `Chapter ${session.chapter} — ${session.chapterTitle}${partSuffix} — ${action}`;
}

function buildSessions(chs:Ch[], pps:number, mpp:number, minM:number, maxM:number): Sess[] {
  const out:Sess[]=[];
  for(const c of chs){
    // Ch146: page range همان 145 است — treat as ~50 page chapter
    const rawPages = c.end_page - c.start_page + 1;
    const pages    = (c.chapter === 146 && rawPages <= 0) ? 50 : Math.max(1, rawPages);
    const parts    = Math.max(1, Math.ceil(pages/pps));
    const est      = Math.min(maxM, Math.max(minM, Math.round((pages/parts)*mpp)));
    const star     = prio(c.chapter)>=5?" ⭐":"";
    const chapterTitle = getCampbellChapterMetadata(c.chapter)?.title ?? c.title;
    for(let i=0;i<parts;i++){
      out.push({
        chapter:c.chapter,
        chapterTitle,
        topic: c.part+star,
        mins:  est,
        priority: prio(c.chapter),
        partIndex: i+1,
        partCount: parts,
      });
    }
  }
  return out;
}

/** ترتیب دستی فصل‌ها: شروع از ادرنال (145-147) سپس بقیه با منطق ABU */
function orderChapters(included: Ch[]): Ch[] {
  // گروه‌بندی بر اساس range
  const groups: [number, number][] = [
    [145, 147],  // ① Adrenal — شروع اینجا
    [148, 166],  // ② Prostate/BPH/PCa
    [129, 135],  // ③ Bladder Ca + Diversion
    [136, 144],  // ④ Renal/UUT/RCC
    [101, 123],  // ⑤ LUTS/Incont/Pelvic Recon
    [95,  100],  // ⑥ Stones
    [66,  87],   // ⑦ Andrology/Sexual/Genitalia
    [32,  64],   // ⑧ Pediatrics
    [2,   31],   // ⑨ Core/Infections/Basics
    [88,  94],   // ⑩ Renal Physio/Upper Tract
  ];

  const result: Ch[] = [];
  const used = new Set<number>();

  for(const [lo, hi] of groups){
    const batch = included
      .filter(c => c.chapter >= lo && c.chapter <= hi && !used.has(c.chapter))
      .sort((a,b) => a.chapter - b.chapter);
    for(const c of batch){ result.push(c); used.add(c.chapter); }
  }

  // هر فصلی که در هیچ گروهی نبود آخر اضافه شود
  for(const c of included){
    if(!used.has(c.chapter)) result.push(c);
  }

  return result;
}

async function main(){
  console.log("\n"+"═".repeat(64));
  console.log("  Board Fighter v5 — شروع از فصل 146 ادرنال");
  console.log("═".repeat(64)+"\n");

  const plan = getActivePlan();
  if(!plan) throw new Error("No active plan.");
  console.log(`✅  Plan: "${plan.title}"\n`);

  const existing = countTasksByStatus(plan.id);
  const tot = Object.values(existing).reduce((a,b)=>a+b,0);
  if(tot>0){
    console.log(`⚠️   ${tot} tasks already exist. Aborting — delete first.\n`);
    process.exit(0);
  }

  const allDays   = listDaysByPlan(plan.id);
  const studyDays = allDays.filter(d => d.date >= EFFECTIVE_START);
  if(!studyDays.length) throw new Error("No days from effective start.");

  console.log(`📅  Study days : ${studyDays.length}  (7 روز/هفته از ${EFFECTIVE_START})\n`);

  if(!existsSync(MANIFEST_PATH)) throw new Error(`Manifest not found:\n  ${MANIFEST_PATH}`);
  const raw   = readFileSync(MANIFEST_PATH,"utf-8");
  const allCh = extractManifest(raw);

  // ── همه فصل‌های included را نگه می‌داریم (از جمله 146) ──────────────────
  const included = allCh.filter(c => c.included);

  // ── ترتیب دستی: شروع از ادرنال ─────────────────────────────────────────
  const ordered = orderChapters(included);

  console.log(`📚  Included chapters : ${ordered.length}`);
  console.log(`   شروع با           : Ch${ordered[0].chapter} — ${ordered[0].title}\n`);

  const SD = studyDays.length;
  const P1 = Math.floor(SD*0.56);
  const P2 = Math.floor(SD*0.81);

  const p1S = buildSessions(ordered, 20, 3.2, 60, 130);
  const p2S = buildSessions(
    ordered.filter(c => prio(c.chapter)>=4),
    32, 2.4, 45, 90
  );

  console.log(`📖  Pass 1: ${p1S.length} sessions  (اولین: ${p1S[0]?.label})`);
  console.log(`📖  Pass 2: ${p2S.length} sessions\n`);

  const now = Date.now();
  const rows: StudyTaskInsert[] = [];
  let p1i=0, p2i=0;

  studyDays.forEach((day, di)=>{
    const dLeft   = SD-1-di;
    const inFin   = dLeft<21;
    const inPre   = dLeft<42;
    const inP1    = di<P1;
    const inP2    = di>=P1&&di<P2;
    const isLight = (di+1)%14===0;
    const isAudit = (di+1)%7===0;
    const dueAt   = new Date(day.date+"T23:59:59").getTime();
    let order=0;

    const add=(taskType:string, title:string, description:string,
               estimatedMinutes:number, priority:number, targetCount?:number)=>{
      rows.push({
        id:genId("task"), planId:plan.id, dayId:day.id,
        sortOrder:order++, status:"pending",
        taskType: taskType as StudyTaskInsert["taskType"],
        title, description, estimatedMinutes, priority,
        targetCount: targetCount??null,
        createdAt:now, updatedAt:now, dueAt,
      } as StudyTaskInsert);
    };

    // ── Light Day ─────────────────────────────────────────────────────────
    if(isLight){
      add("question_block",   "QBank — Weak-Area Review 20Q",  "مرور نقاط ضعف ۱۴ روز اخیر — tutor mode",           45, 2, 20);
      add("flashcard_review", "FSRS — Intensive Catch-up 80",  "تمام کارت‌های due عقب‌افتاده",                      90, 1, 80);
      add("custom_task",      "Light Day — Concept Review",    "مرور مفاهیم چالش‌دار — بدون خواندن جدید",           120, 1);
      return;
    }

    // ── QBank ─────────────────────────────────────────────────────────────
    if(inFin){
      add("question_block","QBank — Timed Exam 30Q",      "شبیه‌سازی واقعی — تایمد — review بعد از اتمام",     65, 2, 30);
    } else if(inPre){
      add("question_block","QBank — Mixed Board 25Q",     "25Q tutor mode — خواندن کامل explanation",           55, 2, 25);
    } else {
      add("question_block","QBank — Daily Block 20Q",     "20Q tutor mode — explanation الزامیه",                45, 2, 20);
    }

    // ── FSRS ──────────────────────────────────────────────────────────────
    if(inFin){
      add("flashcard_review","FSRS — Intensive 80",       "آخرین repetition — کارت‌های interval کوتاه",         80, 1, 80);
    } else {
      add("flashcard_review","FSRS — Daily Due Cards",    "تمام کارت‌های due — skip نشه",                       60, 1, 50);
    }

    // ── Campbell ──────────────────────────────────────────────────────────
    if(inP1 && p1i<p1S.length){
      const s1=p1S[p1i++];
      add("chapter_read",
          buildChapterSessionTitle(s1, "pass1"),
          `${s1.topic} | خواندن دقیق + highlight + یادداشت کلیدی`,
          s1.mins, s1.priority>=5?2:1);

      // session دوم اگر جا داشت
      const used=(inPre?55:45)+60+s1.mins;
      const left=DAILY_GOAL-used-30;
      if(p1i<p1S.length && p1S[p1i].mins<=left+15){
        const s2=p1S[p1i++];
        add("chapter_read",
            buildChapterSessionTitle(s2, "pass1"),
            `${s2.topic} | خواندن دقیق + highlight + یادداشت کلیدی`,
            Math.min(s2.mins, left), s2.priority>=5?2:1);
      }
    } else if(inP2 && p2i<p2S.length){
      const s=p2S[p2i++];
      add("chapter_read",
          buildChapterSessionTitle(s, "pass2"),
          `${s.topic} | مرور سریع — نکات board-targeted — الگوریتم‌ها`,
          s.mins, 2);
    } else {
      add("chapter_read","Rapid Review — High-Yield",
          "Adrenal · Prostate Ca · Bladder Ca · BPH · Stones · LUTS · Andrology | decision points",
          inFin?180:120, 2);
    }

    // ── Weekly Audit 30min ────────────────────────────────────────────────
    if(isAudit && !inFin){
      add("custom_task","⚡ Weekly Audit — 30 min",
          "بررسی پیشرفت · reschedule عقب‌مانده · ثبت gap",30,1);
    }

    // ── Notes ─────────────────────────────────────────────────────────────
    if(!inFin){
      add("custom_task","Note Processing & Import",
          "پردازش یادداشت‌های امروز · ساخت flashcard · import highlight",30,0);
    }
  });

  console.log(`📝  Tasks ready : ${rows.length}\n`);

  const CHUNK=250;
  let ins=0;
  for(let i=0;i<rows.length;i+=CHUNK){
    createTasksBatch(rows.slice(i,i+CHUNK));
    ins+=Math.min(CHUNK,rows.length-i);
    process.stdout.write(`\r   Inserting… ${ins}/${rows.length}`);
  }
  console.log("  ✓");

  process.stdout.write("   Recalculating… ");
  for(const d of allDays) recalcDayProgress(d.id);
  recalcPlanProgress(plan.id);
  console.log("✓");

  const s=getSettings();
  if(!s?.dailyGoalMinutes){
    upsertSettings({ dailyGoalMinutes:DAILY_GOAL, defaultTaskDurationMinutes:45,
                     preferredStartTime:"08:00", autoReschedule:1, notificationsEnabled:0 });
    console.log("   Settings ✓");
  }

  const fc=countTasksByStatus(plan.id);
  const ft=Object.values(fc).reduce((a,b)=>a+b,0);
  console.log("\n"+"═".repeat(64));
  console.log("  ✅  DONE — Board Fighter v5");
  console.log("═".repeat(64));
  console.log(`  Total tasks : ${ft}`);
  console.log(`  Study days  : ${studyDays.length}  (7 روز/هفته)`);
  console.log(`  Pass 1      : ${p1i}/${p1S.length} sessions`);
  console.log(`  Pass 2      : ${p2i}/${p2S.length} sessions`);
  console.log(`  شروع با     : Ch145-147 — Adrenal`);
  console.log("═".repeat(64)+"\n");
}

main().catch(err=>{ console.error("\n❌",(err as Error)?.message??err); process.exit(1); });