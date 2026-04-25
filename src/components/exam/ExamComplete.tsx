"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2, XCircle, MinusCircle, Clock, BarChart3,
  Eye, RotateCcw, Home, Flag, ChevronDown, ChevronUp,
  FileText, ListChecks,
} from "lucide-react";
import { C } from "./exam-tokens";
import type {
  ExamScore, QuestionResult, SubjectBreakdown,
} from "@/types/exam";
import type { ExamMode } from "@/types/exam";
import { motion, AnimatePresence } from "framer-motion";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

/* ================================================================== */
/*  Props                                                              */
/* ================================================================== */

interface ExamCompleteProps {
  score: ExamScore;
  results: QuestionResult[];
  subjectBreakdown: SubjectBreakdown[];
  timeSpent: number;
  questionTimes?: number[];
  testId?: string | null;
  mode?: ExamMode;
  defaultTab?: "results" | "analysis";
  onReview: () => void;
  onRetry: () => void;
}

type Tab = "results" | "analysis";

/* ================================================================== */
/*  Main Component                                                     */
/* ================================================================== */

export default function ExamComplete({
  score,
  results,
  subjectBreakdown,
  timeSpent,
  questionTimes,
  testId,
  mode,
  defaultTab,
  onReview,
  onRetry,
}: ExamCompleteProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(defaultTab ?? "results");

  useEffect(() => {
    if (defaultTab) setTab(defaultTab);
  }, [defaultTab]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        display: "flex",
        flexDirection: "column",
      }}
      dir="rtl"
    >
      {/* ── Dark top bar ── */}
      <header
        style={{
          height: 48,
          background: "#1E293B",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          flexShrink: 0,
          color: "#CBD5E1",
          fontSize: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontWeight: 600, color: "#F8FAFC", fontSize: 13 }}>
            {"\u0646\u062A\u0627\u06CC\u062C \u0622\u0632\u0645\u0648\u0646"}
          </span>
          {testId && (
            <span style={{ color: "#64748B", fontSize: 11 }}>
              ID: {testId.slice(0, 8)}
            </span>
          )}
          {mode && (
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 3,
                background: "rgba(14,165,164,0.15)",
                color: "#2DD4BF",
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              {mode === "tutor" ? "Tutor" : mode === "timed" ? "Timed" : "Untimed"}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <HBtn
            icon={<Eye style={{ width: 13, height: 13 }} />}
            label={"\u0645\u0631\u0648\u0631"}
            onClick={onReview}
          />
          <HBtn
            icon={<RotateCcw style={{ width: 13, height: 13 }} />}
            label={"\u062C\u062F\u06CC\u062F"}
            onClick={onRetry}
          />
          <HBtn
            icon={<Home style={{ width: 13, height: 13 }} />}
            label={"\u062E\u0627\u0646\u0647"}
            onClick={() => router.push("/")}
          />
        </div>
      </header>

      {/* ── Tab bar ── */}
      <div
        style={{
          display: "flex",
          background: C.surface,
          borderBottom: `1px solid ${C.border}`,
          padding: "0 16px",
          gap: 0,
        }}
      >
        <TabBtn
          active={tab === "results"}
          icon={<ListChecks style={{ width: 14, height: 14 }} />}
          label={"\u0646\u062A\u0627\u06CC\u062C"}
          onClick={() => setTab("results")}
        />
        <TabBtn
          active={tab === "analysis"}
          icon={<BarChart3 style={{ width: 14, height: 14 }} />}
          label={"\u062A\u062D\u0644\u06CC\u0644"}
          onClick={() => setTab("analysis")}
        />
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {tab === "results" ? (
          <ResultsTab
            score={score}
            results={results}
            timeSpent={timeSpent}
            questionTimes={questionTimes}
          />
        ) : (
          <AnalysisTab
            score={score}
            results={results}
            subjectBreakdown={subjectBreakdown}
            timeSpent={timeSpent}
          />
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Results Tab                                                        */
/* ================================================================== */

function ResultsTab({
  score,
  results,
  timeSpent,
  questionTimes,
}: {
  score: ExamScore;
  results: QuestionResult[];
  timeSpent: number;
  questionTimes?: number[];
}) {
  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };
  const fmtQTime = (s: number) => {
    if (s < 60) return `${s}\u062B`;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}\u062F ${sec}\u062B`;
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 20px 40px" }}>
      {/* Score summary cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <SCard
          icon={<CheckCircle2 style={{ width: 16, height: 16 }} />}
          value={score.correct}
          label={"\u0635\u062D\u06CC\u062D"}
          color={C.success}
        />
        <SCard
          icon={<XCircle style={{ width: 16, height: 16 }} />}
          value={score.incorrect}
          label={"\u063A\u0644\u0637"}
          color={C.danger}
        />
        <SCard
          icon={<MinusCircle style={{ width: 16, height: 16 }} />}
          value={score.unanswered}
          label={"\u0628\u06CC\u200C\u067E\u0627\u0633\u062E"}
          color={C.textMuted}
        />
        <SCard
          icon={<Clock style={{ width: 16, height: 16 }} />}
          value={fmtTime(timeSpent)}
          label={"\u0632\u0645\u0627\u0646 \u06A9\u0644"}
          color={C.accent}
          isText
        />
      </div>

      {/* Score bar */}
      <div
        style={{
          background: C.surface,
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 24,
          border: `1px solid ${C.border}`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
            {"\u0627\u0645\u062A\u06CC\u0627\u0632 \u06A9\u0644"}
          </span>
          <span
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: scoreColor(score.percentage),
            }}
          >
            {score.percentage}%
          </span>
        </div>
        <div
          style={{
            height: 10,
            borderRadius: 5,
            background: C.surfaceSubtle,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: 5,
              width: `${score.percentage}%`,
              background: scoreColor(score.percentage),
              transition: "width 0.6s ease",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: 8,
            fontSize: 11,
            color: C.textMuted,
          }}
        >
          <span>
            {score.correct} / {score.total}{" "}
            {"\u0635\u062D\u06CC\u062D"}
          </span>
          <span>
            {"\u0645\u06CC\u0627\u0646\u06AF\u06CC\u0646 \u0632\u0645\u0627\u0646: "}
            {fmtTime(
              score.total > 0 ? Math.round(timeSpent / score.total) : 0
            )}
            {" / \u0633\u0624\u0627\u0644"}
          </span>
        </div>
      </div>

      {/* Question table */}
      <div
        style={{
          background: C.surface,
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          overflow: "hidden",
        }}
      >
        {/* Table header — UWorld style: ID, SUBJECTS, SYSTEMS, TOPICS, STATUS, TIME SPENT */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "60px 30px 1fr 1fr 1fr 70px 65px",
            gap: 0,
            padding: "10px 16px",
            background: C.surfaceSubtle,
            borderBottom: `1px solid ${C.border}`,
            fontSize: 10,
            fontWeight: 700,
            color: C.textMuted,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          <span>ID</span>
          <span></span>
          <span>SUBJECTS</span>
          <span>SYSTEMS</span>
          <span>TOPICS</span>
          <span style={{ textAlign: "center" }}>STATUS</span>
          <span style={{ textAlign: "center" }}>TIME</span>
        </div>

        {/* Rows */}
        {results.map((r, i) => {
          const isOmitted = r.userAnswer === null;
          const qt = questionTimes?.[i] ?? r.timeSpentSeconds ?? 0;

          return (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "60px 30px 1fr 1fr 1fr 70px 65px",
                gap: 0,
                padding: "10px 16px",
                borderBottom:
                  i < results.length - 1
                    ? `1px solid ${C.border}`
                    : "none",
                fontSize: 12,
                color: C.text,
                alignItems: "center",
                background: i % 2 === 0 ? "transparent" : C.surfaceSubtle,
              }}
            >
              {/* ID */}
              <span style={{ color: C.textMuted, fontSize: 11, fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>

              {/* Status icon */}
              <span>
                {isOmitted ? (
                  <MinusCircle style={{ width: 15, height: 15, color: C.textMuted }} />
                ) : r.isCorrect ? (
                  <CheckCircle2 style={{ width: 15, height: 15, color: C.success }} />
                ) : (
                  <XCircle style={{ width: 15, height: 15, color: C.danger }} />
                )}
              </span>

              {/* Subjects (Volume) */}
              <span style={{ fontSize: 12, color: C.textSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.volumeNo ? `Volume ${r.volumeNo}` : r.subject || "\u2014"}
              </span>

              {/* Systems (Part) */}
              <span style={{ fontSize: 12, color: C.textSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.partLabel || "\u2014"}
              </span>

              {/* Topics (Chapter) */}
              <span style={{ fontSize: 12, color: C.textSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.chapterTitle ? `Ch.${r.chapterNo} ${r.chapterTitle}` : "\u2014"}
              </span>

              {/* Status */}
              <span style={{
                textAlign: "center",
                fontSize: 11,
                fontWeight: 600,
                color: isOmitted ? C.textMuted : r.isCorrect ? C.success : C.danger,
              }}>
                {isOmitted ? "Omitted" : r.isCorrect ? "Correct" : "Incorrect"}
              </span>

              {/* Time */}
              <span style={{ textAlign: "center", fontSize: 11, color: C.textMuted, fontVariantNumeric: "tabular-nums" }}>
                {qt > 0 ? `${qt} sec` : "\u2014"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Analysis Tab                                                       */
/* ================================================================== */

function AnalysisTab({
  score,
  results,
  subjectBreakdown,
  timeSpent,
}: {
  score: ExamScore;
  results: QuestionResult[];
  subjectBreakdown: SubjectBreakdown[];
  timeSpent: number;
}) {
  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}\u062F ${sec}\u062B`;
  };

  /* Difficulty breakdown */
  const diffBreakdown = useMemo(() => {
    const map = new Map<string, { correct: number; total: number }>();
    results.forEach((r) => {
      const d = r.difficulty || "\u0646\u0627\u0645\u0634\u062E\u0635";
      const e = map.get(d) || { correct: 0, total: 0 };
      e.total++;
      if (r.isCorrect) e.correct++;
      map.set(d, e);
    });
    return Array.from(map.entries()).map(([diff, data]) => ({
      difficulty: diff,
      label:
        diff === "easy"
          ? "\u0622\u0633\u0627\u0646"
          : diff === "medium"
            ? "\u0645\u062A\u0648\u0633\u0637"
            : diff === "hard"
              ? "\u0633\u062E\u062A"
              : diff,
      ...data,
      percentage: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
    }));
  }, [results]);


  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 20px 40px" }}>
      {/* ── UWorld-style: Score donut + Your Score + Answer Changes ── */}
      <div style={{ display: "flex", gap: 24, marginBottom: 24, flexWrap: "wrap" }}>
        {/* Score donut */}
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: "28px 32px", display: "flex", flexDirection: "column", alignItems: "center", minWidth: 180 }}>
          <div style={{
            width: 130, height: 130, borderRadius: "50%",
            background: `conic-gradient(${scoreColor(score.percentage)} ${score.percentage * 3.6}deg, ${C.surfaceSubtle} 0deg)`,
            display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12,
          }}>
            <div style={{ width: 105, height: 105, borderRadius: "50%", background: C.surface, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: scoreColor(score.percentage) }}>{score.percentage}%</span>
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>Correct</div>
              </div>
            </div>
          </div>
        </div>

        {/* Your Score */}
        <div style={{ flex: 1, background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: "20px 24px", minWidth: 200 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: C.success, marginBottom: 14 }}>Your Score</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {[
                { label: "Total Correct", value: score.correct, color: C.success },
                { label: "Total Incorrect", value: score.incorrect, color: C.danger },
                { label: "Total Omitted", value: score.unanswered, color: C.textMuted },
              ].map((row) => (
                <tr key={row.label}>
                  <td style={{ padding: "6px 0", color: C.text }}>{row.label}</td>
                  <td style={{ padding: "6px 0", textAlign: "right", fontWeight: 700, color: row.color }}>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Stats */}
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: "20px 24px", minWidth: 200 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>Test Stats</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <MiniStat label="Total Time" value={fmtTime(timeSpent)} />
            <MiniStat label="Avg / Question" value={score.total > 0 ? fmtTime(Math.round(timeSpent / score.total)) : "\u2014"} />
            <MiniStat label="Marked" value={String(results.filter((r) => r.flagged).length)} />
            <MiniStat label="Total Questions" value={String(score.total)} />
          </div>
        </div>
      </div>

      {/* ── Difficulty breakdown ── */}
      {diffBreakdown.length > 0 && (
        <div
          style={{
            background: C.surface,
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            padding: "20px 24px",
            marginBottom: 24,
          }}
        >
          <h3
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: C.text,
              marginBottom: 14,
            }}
          >
            {"\u062A\u062D\u0644\u06CC\u0644 \u0628\u0631 \u0627\u0633\u0627\u0633 \u0633\u0637\u062D \u062F\u0634\u0648\u0627\u0631\u06CC"}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {diffBreakdown.map((d) => (
              <BreakdownRow
                key={d.difficulty}
                label={d.label}
                correct={d.correct}
                total={d.total}
                percentage={d.percentage}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Subject breakdown with expandable rows ── */}
      <div
        style={{
          background: C.surface,
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 24px",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <h3 style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
            {"\u062A\u062D\u0644\u06CC\u0644 \u0628\u0631 \u0627\u0633\u0627\u0633 \u0645\u0648\u0636\u0648\u0639"}
          </h3>
        </div>

        {/* UWorld-style table header: NAME, TOTAL Q, CORRECT Q, INCORRECT Q, OMITTED Q */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "32px 1fr 80px 100px 100px 100px 100px",
            gap: 0,
            padding: "8px 24px",
            background: C.surfaceSubtle,
            borderBottom: `1px solid ${C.border}`,
            fontSize: 10,
            fontWeight: 700,
            color: C.textMuted,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          <span />
          <span>NAME</span>
          <span style={{ textAlign: "center" }}>TOTAL Q</span>
          <span style={{ textAlign: "center" }}>CORRECT Q</span>
          <span style={{ textAlign: "center" }}>INCORRECT Q</span>
          <span style={{ textAlign: "center" }}>OMITTED Q</span>
          <span />
        </div>

        {subjectBreakdown.map((sb) => (
          <SubjectRow key={sb.subject} sb={sb} results={results} />
        ))}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  SubjectRow — expandable                                            */
/* ================================================================== */

function SubjectRow({
  sb,
  results,
}: {
  sb: SubjectBreakdown;
  results: QuestionResult[];
}) {
  const [expanded, setExpanded] = useState(false);
  const questions = useMemo(
    () => results.filter((r) => (r.subject || "\u0628\u062F\u0648\u0646 \u0645\u0648\u0636\u0648\u0639") === sb.subject),
    [results, sb.subject],
  );
  const incorrect = sb.incorrect ?? (sb.total - sb.correct - (sb.omitted ?? 0));
  const omitted = sb.omitted ?? (sb.total - sb.correct - incorrect);

  return (
    <>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "grid",
          gridTemplateColumns: "32px 1fr 80px 100px 100px 100px 100px",
          gap: 0,
          padding: "12px 24px",
          borderBottom: `1px solid ${C.border}`,
          fontSize: 13,
          color: C.text,
          cursor: "pointer",
          alignItems: "center",
          background: expanded ? C.surfaceSubtle : "transparent",
          transition: "background 0.1s",
        }}
      >
        <span style={{ color: C.textMuted }}>
          {expanded ? (
            <ChevronUp style={{ width: 14, height: 14 }} />
          ) : (
            <ChevronDown style={{ width: 14, height: 14 }} />
          )}
        </span>
        <span style={{ fontWeight: 500 }}>{sb.label || sb.subject}</span>
        <span style={{ textAlign: "center", color: C.textSoft, fontWeight: 600 }}>
          {sb.total}
        </span>
        <span style={{ textAlign: "center", color: C.success, fontWeight: 600 }}>
          {sb.correct} ({sb.total > 0 ? Math.round((sb.correct / sb.total) * 100) : 0}%)
        </span>
        <span style={{ textAlign: "center", color: C.danger, fontWeight: 600 }}>
          {incorrect} ({sb.total > 0 ? Math.round((incorrect / sb.total) * 100) : 0}%)
        </span>
        <span style={{ textAlign: "center", color: C.textMuted, fontWeight: 600 }}>
          {omitted} ({sb.total > 0 ? Math.round((omitted / sb.total) * 100) : 0}%)
        </span>
        <div style={{ height: 6, borderRadius: 3, background: C.surfaceSubtle, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${sb.percentage}%`, background: scoreColor(sb.percentage), borderRadius: 3, transition: "width 0.4s" }} />
        </div>
      </div>

      {/* Expanded question details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "0 24px 12px 56px" }}>
              {questions.map((q, qi) => {
                const isOmit = q.userAnswer === null;
                return (
                  <div
                    key={qi}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 0",
                      borderBottom:
                        qi < questions.length - 1
                          ? `1px solid ${C.border}`
                          : "none",
                      fontSize: 12,
                    }}
                  >
                    {isOmit ? (
                      <MinusCircle
                        style={{ width: 13, height: 13, color: C.textMuted, flexShrink: 0 }}
                      />
                    ) : q.isCorrect ? (
                      <CheckCircle2
                        style={{ width: 13, height: 13, color: C.success, flexShrink: 0 }}
                      />
                    ) : (
                      <XCircle
                        style={{ width: 13, height: 13, color: C.danger, flexShrink: 0 }}
                      />
                    )}
                    <span
                      style={{
                        flex: 1,
                        color: C.textSoft,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {q.questionText.slice(0, 80)}
                      {q.questionText.length > 80 ? "..." : ""}
                    </span>
                    <span
                      style={{
                        fontWeight: 600,
                        color: isOmit
                          ? C.textMuted
                          : q.isCorrect
                            ? C.success
                            : C.danger,
                        fontSize: 11,
                        minWidth: 50,
                        textAlign: "left",
                      }}
                    >
                      {isOmit
                        ? "\u2014"
                        : q.isCorrect
                          ? "\u0635\u062D\u06CC\u062D"
                          : "\u063A\u0644\u0637"}
                    </span>
                    {q.flagged && (
                      <Flag
                        style={{ width: 12, height: 12, color: C.warning, flexShrink: 0 }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ================================================================== */
/*  Sub-components                                                     */
/* ================================================================== */

function scoreColor(pct: number): string {
  return pct >= 80 ? C.success : pct >= 50 ? C.warning : C.danger;
}

function SCard({
  icon,
  value,
  label,
  color,
  isText,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  color: string;
  isText?: boolean;
}) {
  return (
    <div
      style={{
        background: C.surface,
        borderRadius: 8,
        border: `1px solid ${C.border}`,
        padding: "16px 14px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          color,
          marginBottom: 6,
          display: "flex",
          justifyContent: "center",
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontSize: isText ? 14 : 22,
          fontWeight: 700,
          color: C.text,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

function StackedBar({
  items,
  total,
}: {
  items: { label: string; value: number; color: string }[];
  total: number;
}) {
  return (
    <div>
      {/* Bar */}
      <div
        style={{
          display: "flex",
          height: 14,
          borderRadius: 7,
          overflow: "hidden",
          background: C.surfaceSubtle,
        }}
      >
        {items.map((item, i) => (
          <div
            key={i}
            style={{
              width: total > 0 ? `${(item.value / total) * 100}%` : "0%",
              background: item.color,
              transition: "width 0.5s ease",
            }}
          />
        ))}
      </div>
      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 8,
          fontSize: 12,
        }}
      >
        {items.map((item, i) => (
          <div
            key={i}
            style={{ display: "flex", alignItems: "center", gap: 5 }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: item.color,
              }}
            />
            <span style={{ color: C.textSoft }}>
              {item.label}:{" "}
              <b style={{ color: item.color }}>{item.value}</b>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: 6,
        background: C.surfaceSubtle,
      }}
    >
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{value}</div>
    </div>
  );
}

function BreakdownRow({
  label,
  correct,
  total,
  percentage,
}: {
  label: string;
  correct: number;
  total: number;
  percentage: number;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 4,
          fontSize: 12,
        }}
      >
        <span style={{ color: C.text, fontWeight: 500 }}>{label}</span>
        <span style={{ color: C.textMuted }}>
          {correct}/{total} ({percentage}%)
        </span>
      </div>
      <div
        style={{
          height: 7,
          borderRadius: 4,
          background: C.surfaceSubtle,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${percentage}%`,
            borderRadius: 4,
            background: scoreColor(percentage),
            transition: "width 0.5s ease",
          }}
        />
      </div>
    </div>
  );
}

function HBtn({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 10px",
        borderRadius: 4,
        border: "none",
        background: "transparent",
        color: "#CBD5E1",
        fontSize: 11,
        fontWeight: 500,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "background 0.12s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.07)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function TabBtn({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "10px 20px",
        border: "none",
        borderBottom: active ? `2px solid ${C.accent}` : "2px solid transparent",
        background: "transparent",
        color: active ? C.accent : C.textMuted,
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
