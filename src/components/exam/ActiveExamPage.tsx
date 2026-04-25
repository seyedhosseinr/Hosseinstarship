"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  Clock,
  X,
  Check,
  AlertCircle,
  Slash,
  BookOpen,
} from "lucide-react";
import { useExamStore } from "@/store/useExamStore";
import type { ActiveQuestion } from "@/types/exam";
import { StudyPanel } from "./StudyPanel";

/* ─── CSS-variable bridge for automatic dark mode ──────────── */
const EXAM_ACTIVE_STYLES = `
[data-exam-active] {
  --ea-bar: #f8f9fb;       --ea-barBorder: #e2e8f0;
  --ea-barText: #334155;   --ea-barMuted: #94a3b8;
  --ea-navBg: #ffffff;     --ea-navItem: #f1f5f9;
  --ea-navText: #64748b;   --ea-navActive: #0d9488;
  --ea-navCorrect: #16a34a; --ea-navIncorrect: #dc2626;
  --ea-navMarked: #d97706; --ea-navSelected: #0d9488;
  --ea-contentBg: #f1f5f9; --ea-white: #ffffff;
  --ea-border: #e2e8f0;    --ea-text: #1e293b;
  --ea-muted: #64748b;     --ea-faint: #f8fafc;
  --ea-accent: #0d9488;    --ea-correct: #16a34a;
  --ea-correctBg: #f0fdf4; --ea-correctBorder: #86efac;
  --ea-incorrect: #dc2626; --ea-incorrectBg: #fef2f2;
  --ea-incorrectBorder: #fca5a5;
  --ea-marked: #d97706;    --ea-markedBg: #fffbeb;
  --ea-expBg: #ffffff;     --ea-expBorder: #e2e8f0;
}
.dark [data-exam-active] {
  --ea-bar: #111318;       --ea-barBorder: #27272a;
  --ea-barText: #e4e4e7;   --ea-barMuted: #71717a;
  --ea-navBg: #18181b;     --ea-navItem: #1c1c1f;
  --ea-navText: #a1a1aa;   --ea-navActive: #2dd4bf;
  --ea-navCorrect: #22c55e; --ea-navIncorrect: #ef4444;
  --ea-navMarked: #f59e0b; --ea-navSelected: #2dd4bf;
  --ea-contentBg: #0c0e14; --ea-white: #18181b;
  --ea-border: #27272a;    --ea-text: #f4f4f5;
  --ea-muted: #a1a1aa;     --ea-faint: #1c1c1f;
  --ea-accent: #2dd4bf;    --ea-correct: #22c55e;
  --ea-correctBg: #052e16; --ea-correctBorder: #166534;
  --ea-incorrect: #ef4444; --ea-incorrectBg: #450a0a;
  --ea-incorrectBorder: #991b1b;
  --ea-marked: #f59e0b;    --ea-markedBg: #422006;
  --ea-expBg: #18181b;     --ea-expBorder: #27272a;
}
`;

const T = {
  bar: "var(--ea-bar)",
  barBorder: "var(--ea-barBorder)",
  barText: "var(--ea-barText)",
  barMuted: "var(--ea-barMuted)",
  navBg: "var(--ea-navBg)",
  navItem: "var(--ea-navItem)",
  navText: "var(--ea-navText)",
  navActive: "var(--ea-navActive)",
  navCorrect: "var(--ea-navCorrect)",
  navIncorrect: "var(--ea-navIncorrect)",
  navMarked: "var(--ea-navMarked)",
  navSelected: "var(--ea-navSelected)",
  contentBg: "var(--ea-contentBg)",
  white: "var(--ea-white)",
  border: "var(--ea-border)",
  text: "var(--ea-text)",
  muted: "var(--ea-muted)",
  faint: "var(--ea-faint)",
  accent: "var(--ea-accent)",
  correct: "var(--ea-correct)",
  correctBg: "var(--ea-correctBg)",
  correctBorder: "var(--ea-correctBorder)",
  incorrect: "var(--ea-incorrect)",
  incorrectBg: "var(--ea-incorrectBg)",
  incorrectBorder: "var(--ea-incorrectBorder)",
  marked: "var(--ea-marked)",
  markedBg: "var(--ea-markedBg)",
  expBg: "var(--ea-expBg)",
  expBorder: "var(--ea-expBorder)",
};

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

interface ActiveExamPageProps {
  sessionId?: string;
}

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function ActiveExamPage({ sessionId }: ActiveExamPageProps) {
  const router = useRouter();
  const store = useExamStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isStudyMode = store.session?.mode === "study";

  const [showNav, setShowNav] = useState(true);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showStudyPanel, setShowStudyPanel] = useState(false);
  const [fontSize, setFontSize] = useState(15);

  // Auto-open study panel in study mode once session loads
  useEffect(() => {
    if (isStudyMode) setShowStudyPanel(true);
  }, [isStudyMode]);
  const [strikeSet, setStrikeSet] = useState<Record<string, Set<string>>>({});
  const navRef = useRef<HTMLDivElement>(null);

  const {
    phase, questions, currentIndex, timeSpent, isPaused,
    selectAnswer, confirmAnswer, toggleMark, goToQuestion,
    nextQuestion, prevQuestion, tick, togglePause, finishExam,
    isLoading, error,
  } = store;

  /* hydrate session from URL param */
  useEffect(() => {
    if (sessionId && phase === "idle") store.loadSession(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  /* timer */
  useEffect(() => {
    if (phase !== "active") return;
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /* scroll navigator to current question */
  useEffect(() => {
    const el = navRef.current?.querySelector(`[data-qi="${currentIndex}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentIndex]);

  /* keyboard shortcuts */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (phase !== "active") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") nextQuestion();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") prevQuestion();
      if (e.key === "m" || e.key === "M") toggleMark(currentIndex);
      if (e.key === "Enter") {
        const q = questions[currentIndex];
        if (q?.selectedOptionId && !q.isSubmitted) confirmAnswer(currentIndex);
      }
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 8) {
        const q = questions[currentIndex];
        if (q && !q.isSubmitted) selectAnswer(currentIndex, q.options[num - 1]?.id ?? "");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentIndex, questions]);

  /* ── loading / error ── */
  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorScreen error={error} onBack={() => router.push("/qbank")} />;
  if (phase === "idle" || phase === "building") return null;

  const currentQ = questions[currentIndex];
  const total = questions.length;
  const answeredCount = questions.filter((q) => q.isSubmitted).length;
  const markedCount = questions.filter((q) => q.isMarked).length;

  const toggleStrike = (qId: string, optId: string) => {
    setStrikeSet((prev) => {
      const s = new Set(prev[qId] ?? []);
      if (s.has(optId)) s.delete(optId); else s.add(optId);
      return { ...prev, [qId]: s };
    });
  };

  return (
    <div data-exam-active style={{ display: "flex", flexDirection: "column", height: "100vh", background: T.contentBg, fontFamily: "'Segoe UI', system-ui, sans-serif", overflow: "hidden" }}>
      <style dangerouslySetInnerHTML={{ __html: EXAM_ACTIVE_STYLES }} />

      {/* ══════════ TOP BAR ══════════ */}
      <TopBar
        currentIndex={currentIndex}
        total={total}
        answeredCount={answeredCount}
        markedCount={markedCount}
        timeSpent={timeSpent}
        isPaused={isPaused}
        isMarked={currentQ?.isMarked ?? false}
        showNav={showNav}
        showStudyPanel={showStudyPanel}
        fontSize={fontSize}
        isStudyMode={isStudyMode}
        onToggleNav={() => setShowNav((s) => !s)}
        onToggleStudyPanel={() => setShowStudyPanel((s) => !s)}
        onPrev={prevQuestion}
        onNext={nextQuestion}
        onMark={() => currentQ && toggleMark(currentIndex)}
        onTogglePause={togglePause}
        onFontInc={() => setFontSize((s) => Math.min(s + 1, 22))}
        onFontDec={() => setFontSize((s) => Math.max(s - 1, 11))}
        onEndExam={() => setShowFinishModal(true)}
      />

      {/* ══════════ BODY ══════════ */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Left nav rail */}
        <AnimatePresence initial={false}>
          {showNav && (
            <motion.div
              key="nav"
              initial={{ width: 0 }}
              animate={{ width: 200 }}
              exit={{ width: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              style={{ background: T.navBg, flexShrink: 0, overflowY: "auto", overflowX: "hidden", borderRight: `1px solid ${T.border}` }}
              ref={navRef}
            >
              <QuestionNav
                questions={questions}
                currentIndex={currentIndex}
                onSelect={goToQuestion}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main question area + inline explanation */}
        <main style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {isPaused ? (
            <PausedScreen onResume={togglePause} />
          ) : currentQ ? (
            <>
              <QuestionArea
                q={currentQ}
                orderIndex={currentIndex}
                total={total}
                fontSize={fontSize}
                strikeSet={strikeSet[currentQ.questionId] ?? new Set()}
                onSelect={(optId) => selectAnswer(currentIndex, optId)}
                onConfirm={() => confirmAnswer(currentIndex)}
                onStrike={(optId) => toggleStrike(currentQ.questionId, optId)}
              />
              {/* Inline explanation — renders below options after answering */}
              {currentQ.isSubmitted && (
                <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 32px 40px", width: "100%" }}>
                  <ExplanationPanel q={currentQ} fontSize={fontSize} />
                </div>
              )}
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ color: T.muted }}>سوالی موجود نیست</p>
            </div>
          )}
        </main>

        {/* Right study panel — collapsible docked shell */}
        <AnimatePresence initial={false}>
          {showStudyPanel && (
            <motion.div
              key="study-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 380, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              style={{
                background: T.white,
                borderLeft: `1px solid ${T.border}`,
                flexShrink: 0,
                overflowY: "auto",
                overflowX: "hidden",
              }}
            >
              <StudyPanel question={currentQ ?? null} onClose={() => setShowStudyPanel(false)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ══════════ BOTTOM STATUS BAR ══════════ */}
      <BottomBar
        timeSpent={timeSpent}
        currentIndex={currentIndex}
        total={total}
        isSubmitted={currentQ?.isSubmitted ?? false}
        onPrev={prevQuestion}
        onNext={nextQuestion}
        onEndExam={() => setShowFinishModal(true)}
      />

      {/* ══════════ FINISH MODAL ══════════ */}
      <AnimatePresence>
        {showFinishModal && (
          <FinishModal
            total={total}
            answeredCount={answeredCount}
            markedCount={markedCount}
            onCancel={() => setShowFinishModal(false)}
            onConfirm={async () => {
              setShowFinishModal(false);
              await finishExam();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   TOP BAR
═══════════════════════════════════════════════════════════════ */
function TopBar({
  currentIndex, total, answeredCount, markedCount, timeSpent, isPaused,
  isMarked, showNav, showStudyPanel, fontSize, isStudyMode,
  onToggleNav, onToggleStudyPanel, onPrev, onNext, onMark, onTogglePause,
  onFontInc, onFontDec, onEndExam,
}: {
  currentIndex: number; total: number; answeredCount: number; markedCount: number;
  timeSpent: number; isPaused: boolean; isMarked: boolean; showNav: boolean; showStudyPanel: boolean; fontSize: number; isStudyMode: boolean;
  onToggleNav: () => void; onToggleStudyPanel: () => void; onPrev: () => void; onNext: () => void; onMark: () => void;
  onTogglePause: () => void; onFontInc: () => void; onFontDec: () => void; onEndExam: () => void;
}) {
  const fmt = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
    return `${pad(m)}:${pad(sec)}`;
  };
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <header style={{
      minHeight: 52,
      background: T.bar,
      borderBottom: `1px solid ${T.barBorder}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 12px",
      flexShrink: 0,
      zIndex: 100,
      gap: 8,
      flexWrap: "wrap",
    }}>
      {/* ── Left group ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        {/* Nav toggle */}
        <BarBtn onClick={onToggleNav} title="نمایش/مخفی کردن فهرست">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect y="1" width="14" height="2" rx="1" fill={T.barMuted} />
            <rect y="6" width="14" height="2" rx="1" fill={T.barMuted} />
            <rect y="11" width="14" height="2" rx="1" fill={T.barMuted} />
          </svg>
        </BarBtn>

        <div style={{ width: 1, height: 20, background: T.barBorder, margin: "0 6px" }} />

        {/* Prev / counter / Next */}
        <BarBtn onClick={onPrev} disabled={currentIndex === 0} title="سوال قبلی (←)">
          <ChevronLeft size={14} color={T.barMuted} />
        </BarBtn>

        <div style={{ display: "flex", alignItems: "center", gap: 0, background: "rgba(0,0,0,0.04)", borderRadius: 6, padding: "2px 10px" }}>
          <span style={{ color: T.barText, fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            Item {currentIndex + 1} of {total}
          </span>
        </div>

        <BarBtn onClick={onNext} disabled={currentIndex >= total - 1} title="سوال بعدی (→)">
          <ChevronRight size={14} color={T.barMuted} />
        </BarBtn>

        <div style={{ width: 1, height: 20, background: T.barBorder, margin: "0 6px" }} />

        {/* Mark/Flag */}
        <BarBtn
          onClick={onMark}
          title="علامت‌گذاری (M)"
          style={{ background: isMarked ? "rgba(237,137,54,0.2)" : undefined }}
        >
          <Flag size={14} color={isMarked ? "#ed8936" : "#718096"} fill={isMarked ? "#ed8936" : "none"} />
        </BarBtn>
        <span style={{ color: isMarked ? "#ed8936" : "#718096", fontSize: 11, fontWeight: 600 }}>
          Mark
        </span>

        {isStudyMode && (
          <>
            <div style={{ width: 1, height: 20, background: T.barBorder, margin: "0 6px" }} />
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, background: "rgba(13,148,136,0.1)", color: T.accent, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>
              <BookOpen size={12} />
              STUDY
            </span>
          </>
        )}
      </div>

      {/* ── Center: progress indicator ── */}
      <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Clock size={12} color="#64748b" />
          <span style={{
            color: isPaused ? T.marked : T.barMuted,
            fontSize: 12,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 500,
          }}>
            {fmt(timeSpent)}
          </span>
        </div>
        <div style={{ color: T.barMuted, fontSize: 11 }}>
          {answeredCount}/{total} answered
          {markedCount > 0 && <span style={{ color: T.marked, marginLeft: 8 }}>• {markedCount} marked</span>}
        </div>
      </div>

      {/* ── Right group ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        {/* Study panel toggle */}
        <BarBtn
          onClick={onToggleStudyPanel}
          title="پنل مطالعه"
          style={{ background: showStudyPanel ? `${T.accent}18` : undefined }}
        >
          <BookOpen size={14} color={showStudyPanel ? T.accent : T.muted} />
        </BarBtn>

        <div style={{ width: 1, height: 20, background: T.barBorder, margin: "0 4px" }} />

        {/* Font size */}
        <BarBtn onClick={onFontDec} title="کوچکتر کردن متن">
          <span style={{ color: T.muted, fontSize: 10, fontWeight: 700, lineHeight: 1 }}>A-</span>
        </BarBtn>
        <BarBtn onClick={onFontInc} title="بزرگتر کردن متن">
          <span style={{ color: T.barText, fontSize: 12, fontWeight: 700, lineHeight: 1 }}>A+</span>
        </BarBtn>

        <div style={{ width: 1, height: 20, background: T.barBorder, margin: "0 4px" }} />

        {/* Pause */}
        <BarBtn
          onClick={onTogglePause}
          title={isPaused ? "ادامه" : "توقف"}
          style={{ background: isPaused ? "rgba(237,137,54,0.2)" : undefined }}
        >
          <span style={{ color: isPaused ? T.marked : T.muted, fontSize: 13 }}>
            {isPaused ? "▶" : "⏸"}
          </span>
        </BarBtn>

        <div style={{ width: 1, height: 20, background: T.barBorder, margin: "0 4px" }} />

        {/* End exam */}
        <button
          onClick={onEndExam}
          style={{
            minHeight: 44, padding: "8px 16px", borderRadius: 10,
            background: "transparent", color: T.incorrect, border: `1px solid ${T.incorrectBorder}`,
            fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: "0.03em",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          End Block
        </button>
      </div>
    </header>
  );
}

/* ════════════════════════════════════════════════════════════════
   LEFT NAVIGATOR RAIL
═══════════════════════════════════════════════════════════════ */
function QuestionNav({
  questions, currentIndex, onSelect,
}: {
  questions: ActiveQuestion[];
  currentIndex: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div style={{ padding: "10px 0", minWidth: 176 }}>
      <div style={{
        padding: "4px 14px 8px",
        color: "#64748b",
        fontSize: 9,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
      }}>
        Questions
      </div>

      {questions.map((q, idx) => {
        const isCurrent = idx === currentIndex;
        const isAnswered = q.isSubmitted;
        const isMarked = q.isMarked;
        const outcome = q.outcome;

        let dotColor = "#cbd5e1";
        if (isAnswered && outcome === "correct") dotColor = T.navCorrect;
        else if (isAnswered && outcome === "incorrect") dotColor = T.navIncorrect;
        else if (isAnswered && outcome === "omitted") dotColor = "#6b5344";
        else if (q.selectedOptionId && !isAnswered) dotColor = T.navSelected;

        return (
          <button
            key={idx}
            data-qi={idx}
            onClick={() => onSelect(idx)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              minHeight: 44,
              background: isCurrent ? `${T.navActive}12` : "transparent",
              border: "none",
              borderLeft: isCurrent ? `3px solid ${T.navActive}` : "3px solid transparent",
              cursor: "pointer",
              textAlign: "left",
              transition: "background 0.1s",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {/* Status dot */}
            <span style={{
              width: 10, height: 10, borderRadius: "50%",
              background: isAnswered ? dotColor : "transparent",
              border: isAnswered ? "none" : `2px solid ${q.selectedOptionId ? dotColor : "#cbd5e1"}`,
              flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {isAnswered && outcome === "correct" && (
                <svg width="7" height="7" viewBox="0 0 7 7"><polyline points="1,4 3,6 6,1" stroke="white" strokeWidth="1.5" fill="none" /></svg>
              )}
              {isAnswered && outcome === "incorrect" && (
                <svg width="7" height="7" viewBox="0 0 7 7"><line x1="1" y1="1" x2="6" y2="6" stroke="white" strokeWidth="1.5" /><line x1="6" y1="1" x2="1" y2="6" stroke="white" strokeWidth="1.5" /></svg>
              )}
            </span>

            {/* Number */}
            <span style={{
              fontSize: 12,
              fontWeight: isCurrent ? 700 : 400,
              color: isCurrent ? T.text : T.navText,
              flex: 1,
            }}>
              {idx + 1}
            </span>

            {/* Mark flag */}
            {isMarked && <Flag size={11} color={T.navMarked} fill={T.navMarked} />}
          </button>
        );
      })}

      {/* Legend */}
      <div style={{ borderTop: `1px solid ${T.border}`, margin: "8px 14px", paddingTop: 10 }}>
        {[
          { color: "#cbd5e1", label: "Unanswered", dot: true },
          { color: T.navSelected, label: "Selected", dot: true },
          { color: T.navCorrect, label: "Correct", dot: true },
          { color: T.navIncorrect, label: "Incorrect", dot: true },
          { color: T.navMarked, label: "Marked", icon: true },
        ].map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
            {item.icon
              ? <Flag size={9} color={item.color} fill={item.color} />
              : <span style={{ width: 9, height: 9, borderRadius: "50%", background: item.color, flexShrink: 0, display: "inline-block" }} />
            }
            <span style={{ color: "#64748b", fontSize: 10 }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   QUESTION AREA
═══════════════════════════════════════════════════════════════ */
function QuestionArea({
  q, orderIndex, total, fontSize, strikeSet,
  onSelect, onConfirm, onStrike,
}: {
  q: ActiveQuestion;
  orderIndex: number;
  total: number;
  fontSize: number;
  strikeSet: Set<string>;
  onSelect: (optId: string) => void;
  onConfirm: () => void;
  onStrike: (optId: string) => void;
}) {
  const isAnswered = q.isSubmitted;

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px 40px", width: "100%" }}>
      {/* Question header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{
          background: T.accent, color: "#fff",
          borderRadius: 5, padding: "2px 10px",
          fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
        }}>
          Q {orderIndex + 1}
        </span>
        <span style={{ color: T.muted, fontSize: 12 }}>of {total}</span>
        {isAnswered && q.outcome && (
          <span style={{
            marginLeft: "auto",
            display: "flex", alignItems: "center", gap: 4,
            fontSize: 12, fontWeight: 600,
            color: q.outcome === "correct" ? T.correct : T.incorrect,
          }}>
            {q.outcome === "correct"
              ? <><Check size={14} /> Correct</>
              : <><X size={14} /> Incorrect</>
            }
          </span>
        )}
      </div>

      {/* Question stem */}
      <div
        style={{
          fontSize,
          lineHeight: 1.75,
          color: T.text,
          marginBottom: 28,
          userSelect: "text",
        }}
        dangerouslySetInnerHTML={{ __html: q.stemHtml }}
      />

      {/* Options */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
        {q.options.map((opt, idx) => {
          const isSelected = q.selectedOptionId === opt.id;
          const isCorrect = isAnswered && opt.id === q.correctOptionId;
          const isWrong = isAnswered && isSelected && !isCorrect;
          const isStruck = strikeSet.has(opt.id);
          const isQuietWrong = isAnswered && !isCorrect && !isWrong; // non-selected wrong option

          /* ── visual state (no logic change) ── */
          let bg = T.white;
          let borderColor = T.border;
          let textColor = T.text;
          let badgeBg = "#e2e8f0";
          let badgeColor = "#475569";
          let shadow = "none";
          let opacity = 1;
          let leftAccent: string | undefined;

          if (!isAnswered && isSelected) {
            bg = "#f0fdfa"; borderColor = T.accent; badgeBg = T.accent; badgeColor = "#fff";
            shadow = `0 0 0 1px ${T.accent}22`;
            leftAccent = T.accent;
          }
          if (isCorrect) {
            bg = "#f0fdf4"; borderColor = "#86efac"; textColor = "#166534";
            badgeBg = T.correct; badgeColor = "#fff";
            shadow = `0 0 0 1px ${T.correctBorder}`;
            leftAccent = T.correct;
          }
          if (isWrong) {
            bg = "#fef2f2"; borderColor = "#fca5a5"; textColor = "#991b1b";
            badgeBg = T.incorrect; badgeColor = "#fff";
            shadow = `0 0 0 1px ${T.incorrectBorder}`;
            leftAccent = T.incorrect;
          }
          if (isQuietWrong) {
            opacity = 0.55;
          }
          if (isStruck && !isAnswered) {
            textColor = "#94a3b8"; opacity = 0.6;
          }

          return (
            <div
              key={opt.id}
              style={{
                display: "flex", alignItems: "stretch", gap: 0, opacity,
                transition: "opacity 0.2s ease",
              }}
            >
              {/* Option button */}
              <button
                onClick={() => !isAnswered && !isStruck && onSelect(opt.id)}
                disabled={isAnswered}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "12px 16px",
                  borderRadius: isAnswered ? 10 : "10px 0 0 10px",
                  background: bg,
                  borderTop: `1px solid ${borderColor}`,
                  borderBottom: `1px solid ${borderColor}`,
                  borderLeft: leftAccent ? `3px solid ${leftAccent}` : `1px solid ${borderColor}`,
                  borderRight: isAnswered ? `1px solid ${borderColor}` : "none",
                  boxShadow: shadow,
                  cursor: isAnswered ? "default" : isStruck ? "not-allowed" : "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                  outline: "none",
                }}
              >
                {/* Letter badge */}
                <span style={{
                  width: 28, height: 28,
                  borderRadius: 7,
                  flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: badgeBg,
                  color: badgeColor,
                  fontSize: 12,
                  fontWeight: 700,
                  transition: "background 0.15s ease, color 0.15s ease",
                }}>
                  {isCorrect ? <Check size={14} strokeWidth={2.5} /> : isWrong ? <X size={14} strokeWidth={2.5} /> : LETTERS[idx]}
                </span>

                {/* Content */}
                <span
                  style={{
                    flex: 1,
                    fontSize: fontSize - 1,
                    lineHeight: 1.7,
                    color: textColor,
                    textDecoration: isStruck && !isAnswered ? "line-through" : "none",
                    textAlign: "left",
                    transition: "color 0.15s ease",
                  }}
                  dangerouslySetInnerHTML={{ __html: opt.contentHtml }}
                />

                {/* Post-reveal correct badge on wrong-selected row */}
                {isWrong && (
                  <span style={{
                    flexShrink: 0, fontSize: 10, fontWeight: 600, color: T.incorrect,
                    display: "flex", alignItems: "center", gap: 3, marginTop: 2,
                  }}>
                    <X size={11} /> Wrong
                  </span>
                )}
                {isCorrect && (
                  <span style={{
                    flexShrink: 0, fontSize: 10, fontWeight: 600, color: T.correct,
                    display: "flex", alignItems: "center", gap: 3, marginTop: 2,
                  }}>
                    <Check size={11} /> Correct
                  </span>
                )}
              </button>

              {/* Strikethrough toggle (right side) — only before answer */}
              {!isAnswered && (
                <button
                  onClick={() => onStrike(opt.id)}
                  title="خط زدن گزینه"
                  style={{
                    width: 34, minHeight: 48,
                    borderRadius: "0 10px 10px 0",
                    background: isStruck ? "#fef2f2" : T.faint,
                    borderTop: `1px solid ${borderColor}`,
                    borderBottom: `1px solid ${borderColor}`,
                    borderRight: `1px solid ${borderColor}`,
                    borderLeft: "none",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                    transition: "background 0.12s ease",
                  }}
                >
                  <Slash size={12} color={isStruck ? T.incorrect : "#94a3b8"} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirm button */}
      {!isAnswered && q.selectedOptionId && (
        <button
          onClick={onConfirm}
          style={{
            padding: "12px 28px",
            minHeight: 48,
            borderRadius: 12,
            background: T.accent,
            color: "#fff",
            border: "none",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(13,148,136,0.25)",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          Confirm Answer ↵
        </button>
      )}

      {/* In untimed/timed mode — show explanation inline if no right panel visible */}
      {isAnswered && !q.explanationHtml && (
        <div style={{
          marginTop: 24,
          padding: "14px 18px",
          borderRadius: 10,
          background: "#fffbeb",
          border: "1px solid #f6e05e",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertCircle size={16} color="#d69e2e" />
          <p style={{ fontSize: 13, color: "#744210", margin: 0 }}>
            توضیح برای این سوال موجود نیست.
          </p>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   RIGHT EXPLANATION PANEL (UWorld-style with actions)
═══════════════════════════════════════════════════════════════ */
function ExplanationPanel({ q, fontSize }: { q: ActiveQuestion; fontSize: number }) {
  const [fcCreating, setFcCreating] = useState(false);
  const [fcDone, setFcDone] = useState(false);

  const handleCreateFlashcard = async () => {
    if (fcCreating || fcDone) return;
    setFcCreating(true);
    try {
      const correctOpt = q.options.find((o) => o.id === q.correctOptionId);
      const front = q.stemHtml;
      const back = `<p><strong>Answer: ${correctOpt?.key ?? ""}</strong> — ${correctOpt?.contentHtml ?? ""}</p>${q.explanationHtml ? `<hr/>${q.explanationHtml}` : ""}`;
      await fetch("/api/exams/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: q.questionId, front, back }),
      });
      setFcDone(true);
    } catch { /* ignore */ }
    setFcCreating(false);
  };

  const correctOpt = q.options.find((o) => o.id === q.correctOptionId);
  const isCorrect = q.outcome === "correct";

  return (
    <div style={{ display: "flex", flexDirection: "column", borderRadius: 12, border: `1px solid ${T.border}`, background: T.white, overflow: "hidden" }}>

      {/* ── Outcome header ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "12px 20px",
        background: isCorrect ? "#f0fdf4" : "#fef2f2",
        borderBottom: `1px solid ${isCorrect ? "#bbf7d0" : "#fecaca"}`,
      }}>
        <span style={{
          width: 24, height: 24, borderRadius: 6,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: isCorrect ? T.correct : T.incorrect, color: "#fff",
        }}>
          {isCorrect ? <Check size={14} strokeWidth={2.5} /> : <X size={14} strokeWidth={2.5} />}
        </span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: isCorrect ? "#166534" : "#991b1b" }}>
            {isCorrect ? "Correct" : "Incorrect"}
          </div>
          {correctOpt && (
            <div style={{ fontSize: 11, color: isCorrect ? "#15803d" : "#b91c1c", marginTop: 1 }}>
              Answer: <strong>{correctOpt.key}</strong>
            </div>
          )}
        </div>
      </div>

      {/* ── Correct answer callout ── */}
      {correctOpt && (
        <div style={{
          margin: "16px 20px 0",
          padding: "10px 14px",
          borderRadius: 8,
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderLeft: `3px solid ${T.correct}`,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#15803d", marginBottom: 4 }}>
            Correct Answer
          </div>
          <div style={{ fontSize: fontSize - 1, lineHeight: 1.6, color: "#166534" }}>
            <strong>{correctOpt.key}.</strong>{" "}
            <span dangerouslySetInnerHTML={{ __html: correctOpt.contentHtml }} />
          </div>
        </div>
      )}

      {/* ── Explanation body ── */}
      <div style={{ padding: "16px 20px 24px" }}>
        {q.explanationHtml ? (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.muted, marginBottom: 10 }}>
              Explanation
            </div>
            <div
              style={{ fontSize: fontSize - 1, lineHeight: 1.8, color: T.text }}
              className="exam-explanation"
              dangerouslySetInnerHTML={{ __html: q.explanationHtml }}
            />
          </>
        ) : (
          <div style={{ color: T.muted, fontSize: 13, padding: "16px 0" }}>
            No explanation available for this question.
          </div>
        )}
      </div>

      {/* ── Action bar ── */}
      <div style={{
        borderTop: `1px solid ${T.border}`,
        padding: "10px 20px",
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        background: T.faint,
      }}>
        <button
          onClick={handleCreateFlashcard}
          disabled={fcCreating || fcDone}
          style={{
            padding: "6px 14px", borderRadius: 6,
            background: fcDone ? "#f0fdf4" : "transparent",
            border: `1px solid ${fcDone ? "#86efac" : T.accent}`,
            color: fcDone ? T.correct : T.accent,
            fontSize: 11, fontWeight: 600,
            cursor: fcCreating || fcDone ? "default" : "pointer",
            opacity: fcCreating ? 0.6 : 1,
            transition: "all 0.15s ease",
          }}
        >
          {fcDone ? "✓ Flashcard Created" : fcCreating ? "Creating…" : "Create Flashcard"}
        </button>
        <button
          onClick={() => window.open("/library", "_blank")}
          style={{
            padding: "6px 14px", borderRadius: 6,
            background: "transparent",
            border: `1px solid ${T.border}`,
            color: T.muted,
            fontSize: 11, fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          View in Library
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   BOTTOM STATUS BAR
═══════════════════════════════════════════════════════════════ */
function BottomBar({ timeSpent, currentIndex, total, isSubmitted, onPrev, onNext, onEndExam }: {
  timeSpent: number; currentIndex: number; total: number; isSubmitted: boolean;
  onPrev: () => void; onNext: () => void; onEndExam: () => void;
}) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(timeSpent / 3600);
  const m = Math.floor((timeSpent % 3600) / 60);
  const s = timeSpent % 60;
  const elapsed = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  const isFirst = currentIndex === 0;
  const isLast = currentIndex >= total - 1;

  const navBtn = (label: string, icon: "left" | "right", onClick: () => void, disabled: boolean, primary: boolean) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "8px 16px", minHeight: 44, borderRadius: 10,
        fontSize: 13, fontWeight: 600,
        border: primary ? "none" : `1px solid ${T.border}`,
        background: primary ? T.accent : T.white,
        color: primary ? "#fff" : T.text,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.35 : 1,
        transition: "all 0.12s ease",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {icon === "left" && <ChevronLeft size={16} />}
      {label}
      {icon === "right" && <ChevronRight size={16} />}
    </button>
  );

  return (
    <div style={{
      minHeight: 56,
      background: T.white,
      borderTop: `1px solid ${T.border}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "4px 16px",
      flexShrink: 0,
      gap: 8,
    }}>
      {/* Left: exit + timer */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={onEndExam}
          style={{
            fontSize: 12, fontWeight: 700, color: T.incorrect,
            background: "none", border: "none", cursor: "pointer",
            textTransform: "uppercase", letterSpacing: "0.04em",
            minHeight: 44, padding: "8px 4px",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          Exit Session
        </button>
        <span style={{ width: 1, height: 16, background: T.border }} />
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Clock size={11} color={T.muted} />
          <span style={{ fontSize: 11, color: T.muted, fontVariantNumeric: "tabular-nums" }}>
            {elapsed}
          </span>
        </div>
      </div>

      {/* Center: question counter */}
      <span style={{ fontSize: 11, color: T.muted, fontVariantNumeric: "tabular-nums" }}>
        {currentIndex + 1} / {total}
      </span>

      {/* Right: prev / next */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {navBtn("Previous", "left", onPrev, isFirst, false)}
        {navBtn(isSubmitted ? "Next" : "Skip", "right", onNext, isLast, isSubmitted)}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   FINISH MODAL
═══════════════════════════════════════════════════════════════ */
function FinishModal({
  total, answeredCount, markedCount, onCancel, onConfirm,
}: {
  total: number; answeredCount: number; markedCount: number;
  onCancel: () => void; onConfirm: () => void;
}) {
  const unanswered = total - answeredCount;
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
      }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        style={{
          background: "#fff", borderRadius: 14, padding: "32px 36px",
          maxWidth: 420, width: "90%", boxShadow: "0 25px 60px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <AlertCircle size={28} color="#d69e2e" />
          <h3 style={{ fontSize: 18, fontWeight: 700, color: T.text, margin: 0 }}>End Block?</h3>
        </div>

        <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
          {[
            { label: "Answered", value: answeredCount, color: T.correct },
            { label: "Unanswered", value: unanswered, color: unanswered > 0 ? T.incorrect : T.muted },
            { label: "Marked", value: markedCount, color: "#ed8936" },
          ].map((item) => (
            <div key={item.label} style={{
              flex: 1, padding: "12px 8px", borderRadius: 10,
              background: T.faint, textAlign: "center",
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>{item.value}</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{item.label}</div>
            </div>
          ))}
        </div>

        {unanswered > 0 && (
          <p style={{ fontSize: 13, color: T.incorrect, marginBottom: 20, lineHeight: 1.5 }}>
            {unanswered} question{unanswered > 1 ? "s" : ""} will be marked as omitted.
          </p>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{
            padding: "9px 20px", borderRadius: 8,
            border: `1px solid ${T.border}`, background: "#fff",
            fontSize: 13, cursor: "pointer", color: T.text,
          }}>
            Resume
          </button>
          <button onClick={onConfirm} style={{
            padding: "9px 20px", borderRadius: 8,
            background: "#c53030", color: "#fff", border: "none",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>
            End & Submit
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════
   PAUSED SCREEN
═══════════════════════════════════════════════════════════════ */
function PausedScreen({ onResume }: { onResume: () => void }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏸</div>
        <p style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 8 }}>Exam Paused</p>
        <p style={{ color: T.muted, marginBottom: 24, fontSize: 14 }}>Your time is not counting.</p>
        <button
          onClick={onResume}
          style={{
            padding: "12px 32px", borderRadius: 10,
            background: T.accent, color: "#fff", border: "none",
            fontSize: 15, fontWeight: 600, cursor: "pointer",
          }}
        >
          ▶ Resume
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   LOADING / ERROR SCREENS
═══════════════════════════════════════════════════════════════ */
function LoadingScreen() {
  return (
    <div data-exam-active style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: T.contentBg }}>
      <style dangerouslySetInnerHTML={{ __html: EXAM_ACTIVE_STYLES }} />
      <div style={{ textAlign: "center" }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: `3px solid ${T.accent}`, borderTopColor: "transparent", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
        <p style={{ color: T.muted, fontSize: 14 }}>Loading exam...</p>
      </div>
    </div>
  );
}

function ErrorScreen({ error, onBack }: { error: string; onBack: () => void }) {
  return (
    <div data-exam-active style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: T.contentBg }}>
      <style dangerouslySetInnerHTML={{ __html: EXAM_ACTIVE_STYLES }} />
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <AlertCircle style={{ width: 48, height: 48, color: T.incorrect, margin: "0 auto 16px" }} />
        <p style={{ color: T.text, fontSize: 16, marginBottom: 8 }}>Failed to load exam</p>
        <p style={{ color: T.muted, fontSize: 13, marginBottom: 24 }}>{error}</p>
        <button onClick={onBack} style={{ padding: "10px 24px", borderRadius: 10, background: T.accent, color: "#fff", border: "none", fontSize: 14, cursor: "pointer" }}>
          Back to QBank
        </button>
      </div>
    </div>
  );
}

/* ── Shared bar button ── */
function BarBtn({
  children, onClick, disabled, title, style,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        minWidth: 44, minHeight: 44, borderRadius: 8,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "transparent", border: "none",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.35 : 1,
        transition: "background 0.1s",
        WebkitTapHighlightColor: "transparent",
        ...style,
      }}
      onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.05)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = style?.background as string ?? "transparent"; }}
    >
      {children}
    </button>
  );
}
