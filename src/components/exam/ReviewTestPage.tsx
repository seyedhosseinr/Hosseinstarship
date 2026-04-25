"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  Flag,
  Clock,
  CheckCircle2,
  XCircle,
  MinusCircle,
  FileText,
  BarChart3,
  StickyNote,
  BookOpen,
  ZoomIn,
  ZoomOut,
  GraduationCap,
  LogOut,
  History,
  CreditCard,
} from "lucide-react";
import { C } from "./exam-tokens";
import type { ExamScore, QuestionResult } from "@/types/exam";
import type { ExamMode } from "@/types/exam";
import { motion, AnimatePresence } from "framer-motion";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

type ReviewFilter = "all" | "incorrect" | "correct" | "marked" | "omitted";

interface ReviewTestPageProps {
  results: QuestionResult[];
  questionTimes?: number[];
  score: ExamScore;
  mode?: ExamMode;
  testId?: string | null;
  currentIndex: number;
  onGoToQuestion: (idx: number) => void;
  onExit: () => void;
  onShowResults: () => void;
  onShowAnalysis: () => void;
  /** Learning integration callbacks */
  onOpenNotes?: (questionId: string, questionLabel: string) => void;
  onCreateFlashcard?: (questionId: string) => void;
  onAddToNotebook?: (questionId: string) => void;
  /** Set of questionIds that have notes */
  notedQuestionIds?: Set<string>;
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m > 0) return `${m}\u062F ${sec}\u062B`;
  return `${sec}\u062B`;
}

/* ================================================================== */
/*  Main Component                                                     */
/* ================================================================== */

export default function ReviewTestPage({
  results,
  questionTimes,
  score,
  mode,
  testId,
  currentIndex,
  onGoToQuestion,
  onExit,
  onShowResults,
  onShowAnalysis,
  onOpenNotes,
  onCreateFlashcard,
  onAddToNotebook,
  notedQuestionIds,
}: ReviewTestPageProps) {
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [showNav, setShowNav] = useState(true);
  const [fontSize, setFontSize] = useState(15);

  /* ── Filtered indices ── */
  const filteredIndices = useMemo(() => {
    return results
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => {
        switch (filter) {
          case "incorrect":
            return !r.isCorrect && r.userAnswer !== null;
          case "correct":
            return r.isCorrect;
          case "marked":
            return r.flagged;
          case "omitted":
            return r.userAnswer === null;
          default:
            return true;
        }
      })
      .map(({ i }) => i);
  }, [results, filter]);

  /* ── Filter counts ── */
  const counts = useMemo(
    () => ({
      all: results.length,
      incorrect: results.filter(
        (r) => !r.isCorrect && r.userAnswer !== null,
      ).length,
      correct: results.filter((r) => r.isCorrect).length,
      marked: results.filter((r) => r.flagged).length,
      omitted: results.filter((r) => r.userAnswer === null).length,
    }),
    [results],
  );

  const filterPos = filteredIndices.indexOf(currentIndex);

  /* ── Filtered navigation ── */
  const goNext = useCallback(() => {
    const pos = filteredIndices.indexOf(currentIndex);
    if (pos >= 0 && pos < filteredIndices.length - 1) {
      onGoToQuestion(filteredIndices[pos + 1]);
    }
  }, [filteredIndices, currentIndex, onGoToQuestion]);

  const goPrev = useCallback(() => {
    const pos = filteredIndices.indexOf(currentIndex);
    if (pos > 0) {
      onGoToQuestion(filteredIndices[pos - 1]);
    }
  }, [filteredIndices, currentIndex, onGoToQuestion]);

  /* ── Keyboard ── */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goNext();
      if (e.key === "ArrowRight") goPrev();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [goNext, goPrev]);

  /* ── Jump to first filtered when filter excludes current ── */
  useEffect(() => {
    if (filteredIndices.length > 0 && !filteredIndices.includes(currentIndex)) {
      onGoToQuestion(filteredIndices[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  /* ── Font ── */
  const bumpFont = useCallback(
    (d: number) => setFontSize((s) => Math.min(22, Math.max(13, s + d))),
    [],
  );

  const r = results[currentIndex];
  if (!r) return null;

  const qTime = questionTimes?.[currentIndex];

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: C.bg,
        overflow: "hidden",
      }}
    >
      {/* ────────────────── Header ────────────────── */}
      <header
        dir="rtl"
        style={{
          background: "#1E293B",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          height: 48,
          gap: 8,
          flexShrink: 0,
        }}
      >
        {/* Sidebar toggle */}
        <IconBtn
          onClick={() => setShowNav((v) => !v)}
          icon={<Menu style={{ width: 18, height: 18 }} />}
        />

        {/* Title + badges */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}>
            {"\u0645\u0631\u0648\u0631 \u0622\u0632\u0645\u0648\u0646"}
          </span>
          {testId && (
            <span
              style={{
                fontSize: 10,
                padding: "2px 7px",
                borderRadius: 3,
                background: "rgba(255,255,255,0.12)",
                fontWeight: 500,
                letterSpacing: 0.3,
              }}
            >
              {testId.slice(0, 8)}
            </span>
          )}
          {mode && (
            <span
              style={{
                fontSize: 10,
                padding: "2px 7px",
                borderRadius: 3,
                background:
                  mode === "tutor"
                    ? "rgba(45,212,191,0.2)"
                    : mode === "timed"
                      ? "rgba(249,115,22,0.2)"
                      : "rgba(255,255,255,0.1)",
                color:
                  mode === "tutor"
                    ? "#5EEAD4"
                    : mode === "timed"
                      ? "#FB923C"
                      : "rgba(255,255,255,0.7)",
                fontWeight: 500,
              }}
            >
              {mode === "tutor"
                ? "\u0622\u0645\u0648\u0632\u0634\u06CC"
                : mode === "timed"
                  ? "\u0632\u0645\u0627\u0646\u200C\u062F\u0627\u0631"
                  : "\u0622\u0632\u0627\u062F"}
            </span>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* Counter + nav arrows */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <IconBtn
            onClick={goPrev}
            icon={<ChevronRight style={{ width: 16, height: 16 }} />}
            disabled={filterPos <= 0}
          />
          <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap" }}>
            {"\u0633\u0648\u0627\u0644"} {currentIndex + 1}{" "}
            {"\u0627\u0632"} {results.length}
          </span>
          <IconBtn
            onClick={goNext}
            icon={<ChevronLeft style={{ width: 16, height: 16 }} />}
            disabled={filterPos < 0 || filterPos >= filteredIndices.length - 1}
          />
        </div>

        <div style={{ flex: 1 }} />

        {/* Font size */}
        <div style={{ display: "flex", gap: 2 }}>
          <IconBtn
            onClick={() => bumpFont(-1)}
            icon={<ZoomOut style={{ width: 14, height: 14 }} />}
          />
          <IconBtn
            onClick={() => bumpFont(1)}
            icon={<ZoomIn style={{ width: 14, height: 14 }} />}
          />
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 4 }}>
          <HBtn
            icon={
              <span style={{ position: "relative", display: "inline-flex" }}>
                <StickyNote style={{ width: 13, height: 13 }} />
                {notedQuestionIds?.has(r.questionId) && (
                  <span
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -3,
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "#F59E0B",
                    }}
                  />
                )}
              </span>
            }
            label={"\u06CC\u0627\u062F\u062F\u0627\u0634\u062A\u200C\u0647\u0627"}
            onClick={() =>
              onOpenNotes?.(r.questionId, `\u0633\u0648\u0627\u0644 ${currentIndex + 1}`)
            }
            disabled={!onOpenNotes}
          />
          <HBtn
            icon={<History style={{ width: 13, height: 13 }} />}
            label={
              "\u0622\u0632\u0645\u0648\u0646\u200C\u0647\u0627\u06CC \u0642\u0628\u0644\u06CC"
            }
            disabled
          />
          <HBtn
            icon={<FileText style={{ width: 13, height: 13 }} />}
            label={"\u0646\u062A\u0627\u06CC\u062C"}
            onClick={onShowResults}
          />
          <HBtn
            icon={<BarChart3 style={{ width: 13, height: 13 }} />}
            label={"\u062A\u062D\u0644\u06CC\u0644"}
            onClick={onShowAnalysis}
          />
        </div>

        {/* Divider + End Review */}
        <div
          style={{
            width: 1,
            height: 20,
            background: "rgba(255,255,255,0.15)",
            margin: "0 4px",
          }}
        />
        <HBtn
          icon={<LogOut style={{ width: 13, height: 13 }} />}
          label={
            "\u067E\u0627\u06CC\u0627\u0646 \u0645\u0631\u0648\u0631"
          }
          onClick={onExit}
        />
      </header>

      {/* ────────────────── Body ────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* ── Sidebar ── */}
        <AnimatePresence>
          {showNav && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              style={{
                flexShrink: 0,
                background: C.surface,
                borderRight: `1px solid ${C.border}`,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
              dir="rtl"
            >
              {/* Filter pills */}
              <div
                style={{
                  padding: "10px 10px 8px",
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 4,
                  }}
                >
                  {(
                    [
                      { key: "all", label: "\u0647\u0645\u0647" },
                      {
                        key: "incorrect",
                        label: "\u0646\u0627\u062F\u0631\u0633\u062A",
                      },
                      {
                        key: "correct",
                        label: "\u0635\u062D\u06CC\u062D",
                      },
                      {
                        key: "marked",
                        label:
                          "\u0646\u0634\u0627\u0646\u200C\u062F\u0627\u0631",
                      },
                      {
                        key: "omitted",
                        label:
                          "\u0628\u06CC\u200C\u067E\u0627\u0633\u062E",
                      },
                    ] as const
                  ).map((f) => (
                    <FilterPill
                      key={f.key}
                      label={f.label}
                      count={counts[f.key]}
                      active={filter === f.key}
                      onClick={() => setFilter(f.key)}
                    />
                  ))}
                </div>
              </div>

              {/* Summary strip */}
              <div
                style={{
                  padding: "7px 12px",
                  fontSize: 11,
                  color: C.textMuted,
                  borderBottom: `1px solid ${C.border}`,
                  display: "flex",
                  gap: 12,
                }}
              >
                <span style={{ color: C.success }}>
                  {score.correct} \u2713
                </span>
                <span style={{ color: C.danger }}>
                  {score.incorrect} \u2717
                </span>
                <span>{score.unanswered} \u2298</span>
                <span
                  style={{
                    marginRight: "auto",
                    fontWeight: 600,
                    color: C.accent,
                  }}
                >
                  {score.percentage}%
                </span>
              </div>

              {/* Question grid */}
              <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 4,
                  }}
                >
                  {filteredIndices.map((idx) => {
                    const qr = results[idx];
                    const cur = idx === currentIndex;

                    let bg = C.surface;
                    let bc = C.border;
                    let tc = C.text;

                    if (cur) {
                      bg = C.accent;
                      bc = C.accent;
                      tc = "#fff";
                    } else if (qr.isCorrect) {
                      bg = "rgba(22,163,74,0.06)";
                      bc = "rgba(22,163,74,0.25)";
                    } else if (qr.userAnswer === null) {
                      bg = C.surfaceSubtle;
                      tc = C.textMuted;
                    } else {
                      bg = "rgba(220,38,38,0.04)";
                      bc = "rgba(220,38,38,0.25)";
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => onGoToQuestion(idx)}
                        style={{
                          position: "relative",
                          width: "100%",
                          aspectRatio: "1",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 5,
                          border: `1.5px solid ${bc}`,
                          background: bg,
                          color: tc,
                          fontSize: 12,
                          fontWeight: cur ? 700 : 500,
                          cursor: "pointer",
                          transition: "all 0.12s",
                        }}
                      >
                        {idx + 1}
                        {/* Status dot */}
                        {!cur && (
                          <span
                            style={{
                              position: "absolute",
                              top: 2,
                              left: 2,
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background:
                                qr.userAnswer === null
                                  ? C.textMuted
                                  : qr.isCorrect
                                    ? C.success
                                    : C.danger,
                            }}
                          />
                        )}
                        {/* Flag indicator */}
                        {qr.flagged && (
                          <Flag
                            style={{
                              position: "absolute",
                              bottom: 1,
                              right: 1,
                              width: 8,
                              height: 8,
                              color: cur ? "#fff" : C.warning,
                            }}
                          />
                        )}
                        {/* Note indicator */}
                        {notedQuestionIds?.has(qr.questionId) && (
                          <span
                            style={{
                              position: "absolute",
                              top: 1,
                              right: 1,
                              width: 5,
                              height: 5,
                              borderRadius: "50%",
                              background: cur ? "#fff" : C.warning,
                            }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
                {filteredIndices.length === 0 && (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "24px 16px",
                      color: C.textMuted,
                      fontSize: 13,
                    }}
                  >
                    {"\u0633\u0648\u0627\u0644\u06CC \u0628\u0627 \u0627\u06CC\u0646 \u0641\u06CC\u0644\u062A\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F"}
                  </div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* ── Content: Question + Explanation ── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* ── Question Pane ── */}
          <div
            dir="rtl"
            style={{
              flex: 1,
              overflowY: "auto",
            }}
          >
            <div
              style={{
                maxWidth: 700,
                margin: "0 auto",
                padding: "20px 28px 28px",
              }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentIndex}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.12 }}
                >
                  {/* ── Meta row ── */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 14,
                      flexWrap: "wrap",
                    }}
                  >
                    <Chip
                      bg={C.surfaceSubtle}
                      border={C.border}
                      color={C.textSoft}
                      bold
                    >
                      {"\u0633\u0648\u0627\u0644"} {currentIndex + 1}
                    </Chip>
                    {r.subject && (
                      <Chip
                        bg="rgba(14,165,164,0.06)"
                        border={C.accentBorder}
                        color={C.accent}
                      >
                        {r.subject}
                      </Chip>
                    )}
                    {r.difficulty && (
                      <Chip
                        bg={C.surfaceSubtle}
                        border={C.border}
                        color={C.textMuted}
                      >
                        {r.difficulty}
                      </Chip>
                    )}
                    {r.flagged && (
                      <Flag
                        style={{ width: 14, height: 14, color: C.warning }}
                      />
                    )}
                    <div style={{ flex: 1 }} />
                    <StatusBadge result={r} />
                  </div>

                  {/* ── Question stem ── */}
                  <div
                    style={{
                      fontSize,
                      lineHeight: 1.85,
                      color: C.text,
                      marginBottom: 20,
                      whiteSpace: "pre-wrap",
                    }}
                    dangerouslySetInnerHTML={{ __html: r.stemHtml }}
                  />

                  {/* ── Answer choices ── */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    {r.options.map((opt, idx) => {
                      const isCorr = idx === r.correctIndex;
                      const isSel = opt.id === r.selectedOptionId;
                      const isWrong = isSel && !isCorr;

                      let bg = C.surface;
                      let bc = C.border;
                      let lBg = C.surfaceSubtle;
                      let lC = C.textSoft;

                      if (isCorr) {
                        bg = "rgba(22,163,74,0.04)";
                        bc = C.success;
                        lBg = C.success;
                        lC = "#fff";
                      } else if (isWrong) {
                        bg = "rgba(220,38,38,0.03)";
                        bc = C.danger;
                        lBg = C.danger;
                        lC = "#fff";
                      }

                      return (
                        <div
                          key={idx}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 14px",
                            borderRadius: 8,
                            border: `1.5px solid ${bc}`,
                            background: bg,
                            fontSize: fontSize - 1,
                          }}
                        >
                          {/* Letter badge */}
                          <span
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 5,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              fontSize: 12,
                              background: lBg,
                              color: lC,
                              flexShrink: 0,
                            }}
                          >
                            {LETTERS[idx]}
                          </span>

                          {/* Text */}
                          <span
                            style={{
                              flex: 1,
                              color: C.text,
                              lineHeight: 1.6,
                            }}
                            dangerouslySetInnerHTML={{ __html: opt.contentHtml }}
                          />

                          {/* Status icon */}
                          {isCorr && (
                            <CheckCircle2
                              style={{
                                width: 16,
                                height: 16,
                                color: C.success,
                                flexShrink: 0,
                              }}
                            />
                          )}
                          {isWrong && (
                            <XCircle
                              style={{
                                width: 16,
                                height: 16,
                                color: C.danger,
                                flexShrink: 0,
                              }}
                            />
                          )}

                          {/* Inline badges */}
                          <div
                            style={{
                              display: "flex",
                              gap: 4,
                              flexShrink: 0,
                            }}
                          >
                            {isCorr && (
                              <MicroBadge bg={C.success} color="#fff">
                                {"\u067E\u0627\u0633\u062E \u0635\u062D\u06CC\u062D"}
                              </MicroBadge>
                            )}
                            {isSel && (
                              <MicroBadge
                                bg={
                                  isCorr
                                    ? "rgba(22,163,74,0.15)"
                                    : C.danger
                                }
                                color={isCorr ? C.success : "#fff"}
                              >
                                {"\u0627\u0646\u062A\u062E\u0627\u0628 \u0634\u0645\u0627"}
                              </MicroBadge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* ── Explanation Pane ── */}
          <div
            dir="rtl"
            style={{
              width: 400,
              flexShrink: 0,
              borderRight: `1px solid ${C.border}`,
              overflowY: "auto",
              background: C.surface,
            }}
          >
            <div style={{ padding: "20px 24px 28px" }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                >
                  {/* ── Status banner ── */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "14px 16px",
                      borderRadius: 8,
                      background:
                        r.userAnswer === null
                          ? C.surfaceSubtle
                          : r.isCorrect
                            ? "rgba(22,163,74,0.06)"
                            : "rgba(220,38,38,0.06)",
                      border: `1px solid ${
                        r.userAnswer === null
                          ? C.border
                          : r.isCorrect
                            ? C.success
                            : C.danger
                      }`,
                      marginBottom: 16,
                    }}
                  >
                    {r.userAnswer === null ? (
                      <MinusCircle
                        style={{
                          width: 22,
                          height: 22,
                          color: C.textMuted,
                          flexShrink: 0,
                        }}
                      />
                    ) : r.isCorrect ? (
                      <CheckCircle2
                        style={{
                          width: 22,
                          height: 22,
                          color: C.success,
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <XCircle
                        style={{
                          width: 22,
                          height: 22,
                          color: C.danger,
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 15,
                          color:
                            r.userAnswer === null
                              ? C.textMuted
                              : r.isCorrect
                                ? C.success
                                : C.danger,
                        }}
                      >
                        {r.userAnswer === null
                          ? "\u0628\u062F\u0648\u0646 \u067E\u0627\u0633\u062E"
                          : r.isCorrect
                            ? "\u067E\u0627\u0633\u062E \u0635\u062D\u06CC\u062D!"
                            : "\u067E\u0627\u0633\u062E \u0627\u0634\u062A\u0628\u0627\u0647"}
                      </div>
                      {!r.isCorrect && r.correctIndex >= 0 && (
                        <div
                          style={{
                            fontSize: 13,
                            color: C.textSoft,
                            marginTop: 2,
                          }}
                        >
                          {"\u067E\u0627\u0633\u062E \u0635\u062D\u06CC\u062D: "}
                          <b style={{ color: C.success }}>
                            {LETTERS[r.correctIndex]}.{" "}
                            <span dangerouslySetInnerHTML={{ __html: r.options[r.correctIndex]?.contentHtml ?? "" }} />
                          </b>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Stats chips ── */}
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginBottom: 20,
                      flexWrap: "wrap",
                    }}
                  >
                    {qTime != null && qTime > 0 && (
                      <StatChip
                        icon={<Clock style={{ width: 13, height: 13 }} />}
                        label={fmtTime(qTime)}
                        color={C.textSoft}
                      />
                    )}
                    {r.subject && (
                      <StatChip
                        icon={<BookOpen style={{ width: 13, height: 13 }} />}
                        label={r.subject}
                        color={C.accent}
                      />
                    )}
                    {r.difficulty && (
                      <StatChip
                        icon={<BarChart3 style={{ width: 13, height: 13 }} />}
                        label={r.difficulty}
                        color={C.textMuted}
                      />
                    )}
                    {r.flagged && (
                      <StatChip
                        icon={<Flag style={{ width: 13, height: 13 }} />}
                        label={"\u0646\u0634\u0627\u0646\u200C\u062F\u0627\u0631"}
                        color={C.warning}
                      />
                    )}
                  </div>

                  {/* ── Answer key ── */}
                  <div style={{ marginBottom: 20 }}>
                    <SectionHead>
                      {"\u06A9\u0644\u06CC\u062F \u067E\u0627\u0633\u062E"}
                    </SectionHead>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      {r.options.map((opt, idx) => {
                        const isCorr = idx === r.correctIndex;
                        const isSel = opt.id === r.selectedOptionId;
                        let bg = "transparent";
                        let bc = C.border;

                        if (isCorr) {
                          bg = "rgba(22,163,74,0.04)";
                          bc = C.success;
                        } else if (isSel && !isCorr) {
                          bg = "rgba(220,38,38,0.04)";
                          bc = C.danger;
                        }

                        return (
                          <div
                            key={idx}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "7px 10px",
                              borderRadius: 6,
                              border: `1px solid ${bc}`,
                              background: bg,
                              fontSize: fontSize - 2,
                            }}
                          >
                            <span
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: 4,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: 10,
                                background: isCorr
                                  ? C.success
                                  : isSel
                                    ? C.danger
                                    : C.surfaceSubtle,
                                color:
                                  isCorr || isSel ? "#fff" : C.textSoft,
                                flexShrink: 0,
                              }}
                            >
                              {LETTERS[idx]}
                            </span>
                            <span
                              style={{
                                flex: 1,
                                color: C.text,
                                lineHeight: 1.5,
                              }}
                              dangerouslySetInnerHTML={{ __html: opt.contentHtml }}
                            />
                            {isCorr && (
                              <CheckCircle2
                                style={{
                                  width: 13,
                                  height: 13,
                                  color: C.success,
                                  flexShrink: 0,
                                }}
                              />
                            )}
                            {isSel && !isCorr && (
                              <XCircle
                                style={{
                                  width: 13,
                                  height: 13,
                                  color: C.danger,
                                  flexShrink: 0,
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Explanation text ── */}
                  {r.explanationHtml && (
                    <div style={{ marginBottom: 20 }}>
                      <SectionHead>
                        {"\u062A\u0648\u0636\u06CC\u062D"}
                      </SectionHead>
                      <div
                        style={{
                          padding: "14px 16px",
                          borderRadius: 8,
                          background: C.surfaceSubtle,
                          border: `1px solid ${C.border}`,
                          color: C.text,
                          fontSize: fontSize - 1,
                          lineHeight: 1.85,
                        }}
                        dangerouslySetInnerHTML={{ __html: r.explanationHtml }}
                      />
                    </div>
                  )}

                  {/* ── Educational objective ── */}
                  {r.subject && (
                    <div>
                      <SectionHead>
                        {"\u0647\u062F\u0641 \u0622\u0645\u0648\u0632\u0634\u06CC"}
                      </SectionHead>
                      <div
                        style={{
                          padding: "12px 16px",
                          borderRadius: 8,
                          background: "rgba(14,165,164,0.04)",
                          border: `1px solid ${C.accentBorder}`,
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                        }}
                      >
                        <GraduationCap
                          style={{
                            width: 18,
                            height: 18,
                            color: C.accent,
                            flexShrink: 0,
                            marginTop: 2,
                          }}
                        />
                        <div>
                          <div
                            style={{
                              fontWeight: 600,
                              color: C.accent,
                              fontSize: 13,
                              marginBottom: 4,
                            }}
                          >
                            {r.subject}
                          </div>
                          <div
                            style={{ fontSize: 12, color: C.textSoft }}
                          >
                            {"\u062A\u0633\u0644\u0637 \u0628\u0631 \u0645\u0641\u0627\u0647\u06CC\u0645 \u0627\u06CC\u0646 \u062D\u0648\u0632\u0647 \u0628\u0631\u0627\u06CC \u0645\u0648\u0641\u0642\u06CC\u062A \u062F\u0631 \u0622\u0632\u0645\u0648\u0646 \u0628\u0648\u0631\u062F \u0636\u0631\u0648\u0631\u06CC \u0627\u0633\u062A."}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Learning actions ── */}
                  {(onCreateFlashcard || onAddToNotebook || onOpenNotes) && (
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        marginTop: 18,
                        paddingTop: 14,
                        borderTop: `1px solid ${C.border}`,
                        flexWrap: "wrap",
                      }}
                    >
                      {onOpenNotes && (
                        <RvActionBtn
                          icon={<StickyNote style={{ width: 12, height: 12 }} />}
                          label={
                            notedQuestionIds?.has(r.questionId)
                              ? "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u06CC\u0627\u062F\u062F\u0627\u0634\u062A"
                              : "\u06CC\u0627\u062F\u062F\u0627\u0634\u062A"
                          }
                          onClick={() =>
                            onOpenNotes(r.questionId, `\u0633\u0648\u0627\u0644 ${currentIndex + 1}`)
                          }
                          color={
                            notedQuestionIds?.has(r.questionId)
                              ? C.warning
                              : C.textSoft
                          }
                        />
                      )}
                      {onCreateFlashcard && (
                        <RvActionBtn
                          icon={<CreditCard style={{ width: 12, height: 12 }} />}
                          label={"\u0641\u0644\u0634\u200C\u06A9\u0627\u0631\u062A"}
                          onClick={() => onCreateFlashcard(r.questionId)}
                          color={C.accent}
                        />
                      )}
                      {onAddToNotebook && (
                        <RvActionBtn
                          icon={<BookOpen style={{ width: 12, height: 12 }} />}
                          label={"\u0627\u0641\u0632\u0648\u062F\u0646 \u0628\u0647 \u062F\u0641\u062A\u0631\u0686\u0647"}
                          onClick={() => onAddToNotebook(r.questionId)}
                          color={C.accent}
                        />
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Sub-components                                                     */
/* ================================================================== */

function IconBtn({
  icon,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "none",
        border: "none",
        color: disabled ? "rgba(255,255,255,0.3)" : "#fff",
        cursor: disabled ? "default" : "pointer",
        padding: 6,
        borderRadius: 4,
        display: "flex",
        alignItems: "center",
        opacity: disabled ? 0.4 : 1,
        transition: "background 0.12s",
      }}
      onMouseEnter={(e) =>
        !disabled &&
        (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
    >
      {icon}
    </button>
  );
}

function HBtn({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: 5,
        background: "rgba(255,255,255,0.08)",
        color: disabled
          ? "rgba(255,255,255,0.3)"
          : "rgba(255,255,255,0.85)",
        border: "none",
        cursor: disabled ? "default" : "pointer",
        fontSize: 12,
        fontWeight: 500,
        transition: "background 0.15s",
        whiteSpace: "nowrap" as const,
      }}
      onMouseEnter={(e) =>
        !disabled &&
        (e.currentTarget.style.background = "rgba(255,255,255,0.15)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = "rgba(255,255,255,0.08)")
      }
    >
      {icon}
      {label}
    </button>
  );
}

function FilterPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 9px",
        borderRadius: 5,
        fontSize: 11,
        fontWeight: active ? 600 : 400,
        background: active ? C.accent : "transparent",
        color: active ? "#fff" : C.textSoft,
        border: active ? "none" : `1px solid ${C.border}`,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 4,
        transition: "all 0.15s",
      }}
    >
      {label}
      <span
        style={{
          background: active
            ? "rgba(255,255,255,0.25)"
            : C.surfaceSubtle,
          borderRadius: 3,
          padding: "1px 5px",
          fontSize: 10,
          fontWeight: 600,
        }}
      >
        {count}
      </span>
    </button>
  );
}

function StatChip({
  icon,
  label,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 10px",
        borderRadius: 4,
        background: C.surfaceSubtle,
        color,
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      {icon}
      {label}
    </div>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: C.textMuted,
        marginBottom: 8,
        letterSpacing: 0.5,
      }}
    >
      {children}
    </div>
  );
}

function Chip({
  children,
  bg,
  border,
  color,
  bold,
}: {
  children: React.ReactNode;
  bg: string;
  border: string;
  color: string;
  bold?: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 10px",
        borderRadius: 4,
        background: bg,
        border: `1px solid ${border}`,
        fontSize: 12,
        fontWeight: bold ? 600 : 500,
        color,
      }}
    >
      {children}
    </span>
  );
}

function StatusBadge({ result: r }: { result: QuestionResult }) {
  const omitted = r.userAnswer === null;
  const bg = omitted
    ? C.surfaceSubtle
    : r.isCorrect
      ? "rgba(22,163,74,0.06)"
      : "rgba(220,38,38,0.04)";
  const bc = omitted ? C.border : r.isCorrect ? C.success : C.danger;
  const tc = omitted ? C.textMuted : r.isCorrect ? C.success : C.danger;
  const Icon = omitted
    ? MinusCircle
    : r.isCorrect
      ? CheckCircle2
      : XCircle;
  const text = omitted
    ? "\u0628\u06CC\u200C\u067E\u0627\u0633\u062E"
    : r.isCorrect
      ? "\u0635\u062D\u06CC\u062D"
      : "\u0646\u0627\u062F\u0631\u0633\u062A";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 10px",
        borderRadius: 4,
        background: bg,
        border: `1px solid ${bc}`,
        fontSize: 12,
        fontWeight: 600,
        color: tc,
      }}
    >
      <Icon style={{ width: 12, height: 12 }} />
      {text}
    </span>
  );
}

function MicroBadge({
  children,
  bg,
  color,
}: {
  children: React.ReactNode;
  bg: string;
  color: string;
}) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        padding: "2px 6px",
        borderRadius: 3,
        background: bg,
        color,
        whiteSpace: "nowrap" as const,
      }}
    >
      {children}
    </span>
  );
}

function RvActionBtn({
  icon,
  label,
  onClick,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "6px 12px",
        borderRadius: 6,
        border: `1px solid ${color}25`,
        background: `${color}08`,
        color,
        fontSize: 11,
        fontWeight: 500,
        cursor: "pointer",
        transition: "all 0.12s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `${color}15`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = `${color}08`;
      }}
    >
      {icon}
      {label}
    </button>
  );
}
