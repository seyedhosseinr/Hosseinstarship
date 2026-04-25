"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useExamStore, useGamificationStore } from "@/store/main-store";
import { useCountdown } from "@/hooks";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Loader2,
  Clock,
  Flag,
  BookOpen,
  Pause,
  Play,
  SkipForward,
  AlertTriangle,
} from "lucide-react";

// Mock questions (will be replaced by real data from store/API)
const MOCK_QUESTIONS = [
  {
    id: "q1",
    text: "Ø´Ø§ÛŒØ¹â€ŒØªØ±ÛŒÙ† Ø¹Ù„Øª Ø³Ù†Ú¯ Ú©Ù„ÛŒÙ‡ Ø¯Ø± Ø¨Ø²Ø±Ú¯Ø³Ø§Ù„Ø§Ù† Ú†ÛŒØ³ØªØŸ",
    options: {
      A: "Ø§Ø³ÛŒØ¯ Ø§ÙˆØ±ÛŒÚ©",
      B: "Ú©Ù„Ø³ÛŒÙ… Ø§Ú¯Ø²Ø§Ù„Ø§Øª",
      C: "Ø§Ø³ØªØ±ÙˆÙˆÛŒØª",
      D: "Ø³ÛŒØ³ØªÛŒÙ†",
    },
    correct: "B",
    explanation:
      "Ø­Ø¯ÙˆØ¯ Û¸Û°Ùª Ø§Ø² Ø³Ù†Ú¯â€ŒÙ‡Ø§ÛŒ Ú©Ù„ÛŒÙ‡ Ø§Ø² Ù†ÙˆØ¹ Ú©Ù„Ø³ÛŒÙ… Ø§Ú¯Ø²Ø§Ù„Ø§Øª Ù‡Ø³ØªÙ†Ø¯. Ø³Ù†Ú¯â€ŒÙ‡Ø§ÛŒ Ø§Ø³ÛŒØ¯ Ø§ÙˆØ±ÛŒÚ© Ø­Ø¯ÙˆØ¯ Ûµ-Û±Û°ÙªØŒ Ø§Ø³ØªØ±ÙˆÙˆÛŒØª Ù…Ø±ØªØ¨Ø· Ø¨Ø§ Ø¹ÙÙˆÙ†Øª (Û±Û°-Û±ÛµÙª) Ùˆ Ø³ÛŒØ³ØªÛŒÙ† Ø¨Ø³ÛŒØ§Ø± Ù†Ø§Ø¯Ø± (Û±-Û²Ùª) Ù‡Ø³ØªÙ†Ø¯.",
    topic: "Ø³Ù†Ú¯â€ŒÙ‡Ø§ÛŒ Ø§Ø¯Ø±Ø§Ø±ÛŒ",
    difficulty: "medium" as const,
  },
  {
    id: "q2",
    text: "Ø®Ø· Ø§ÙˆÙ„ Ø¯Ø±Ù…Ø§Ù† Ø¯Ø§Ø±ÙˆÛŒÛŒ Ø¯Ø± BPH Ú©Ø¯Ø§Ù… Ø§Ø³ØªØŸ",
    options: {
      A: "Ù…Ù‡Ø§Ø±Ú©Ù†Ù†Ø¯Ù‡â€ŒÙ‡Ø§ÛŒ 5-Ø¢Ù„ÙØ§ Ø±Ø¯ÙˆÚ©ØªØ§Ø²",
      B: "Ø¢Ù†ØªÛŒâ€ŒÙ…ÙˆØ³Ú©Ø§Ø±ÛŒÙ†ÛŒÚ©â€ŒÙ‡Ø§",
      C: "Ø¢Ù„ÙØ§ Ø¨Ù„Ø§Ú©Ø±Ù‡Ø§",
      D: "Ù…Ù‡Ø§Ø±Ú©Ù†Ù†Ø¯Ù‡â€ŒÙ‡Ø§ÛŒ PDE5",
    },
    correct: "C",
    explanation:
      "Ø¢Ù„ÙØ§ Ø¨Ù„Ø§Ú©Ø±Ù‡Ø§ (Ù…Ø§Ù†Ù†Ø¯ ØªØ§Ù…Ø³ÙˆÙ„ÙˆØ³ÛŒÙ†) Ø®Ø· Ø§ÙˆÙ„ Ø¯Ø±Ù…Ø§Ù† Ø¯Ø§Ø±ÙˆÛŒÛŒ BPH Ù‡Ø³ØªÙ†Ø¯ Ø²ÛŒØ±Ø§ Ø³Ø±ÛŒØ¹â€ŒØªØ±ÛŒÙ† Ø´Ø±ÙˆØ¹ Ø§Ø«Ø± Ø±Ø§ Ø¯Ø§Ø±Ù†Ø¯. Ù…Ù‡Ø§Ø±Ú©Ù†Ù†Ø¯Ù‡â€ŒÙ‡Ø§ÛŒ Ûµ-Ø¢Ù„ÙØ§ Ø±Ø¯ÙˆÚ©ØªØ§Ø² Ø¨ÛŒØ´ØªØ± Ø¨Ø±Ø§ÛŒ Ù¾Ø±ÙˆØ³ØªØ§Øª Ø¨Ø²Ø±Ú¯â€ŒØªØ± Ø§Ø³ØªÙØ§Ø¯Ù‡ Ù…ÛŒâ€ŒØ´ÙˆÙ†Ø¯.",
    topic: "BPH",
    difficulty: "easy" as const,
  },
  {
    id: "q3",
    text: "Ø¯Ø± Ø³Ø±Ø·Ø§Ù† Ù¾Ø±ÙˆØ³ØªØ§ØªØŒ Gleason score 4+3 Ù†Ø´Ø§Ù†â€ŒØ¯Ù‡Ù†Ø¯Ù‡ Ú©Ø¯Ø§Ù… Ú¯Ø±ÛŒØ¯ Ú¯Ø±ÙˆÙ‡ ISUP Ø§Ø³ØªØŸ",
    options: {
      A: "Ú¯Ø±ÛŒØ¯ Ú¯Ø±ÙˆÙ‡ Û±",
      B: "Ú¯Ø±ÛŒØ¯ Ú¯Ø±ÙˆÙ‡ Û²",
      C: "Ú¯Ø±ÛŒØ¯ Ú¯Ø±ÙˆÙ‡ Û³",
      D: "Ú¯Ø±ÛŒØ¯ Ú¯Ø±ÙˆÙ‡ Û´",
    },
    correct: "C",
    explanation:
      "Gleason 4+3=7 Ù…Ø¹Ø§Ø¯Ù„ ISUP Grade Group 3 Ø§Ø³Øª. Ú¯Ø±ÛŒØ¯ Û± (GS 3+3=6)ØŒ Ú¯Ø±ÛŒØ¯ Û² (GS 3+4=7)ØŒ Ú¯Ø±ÛŒØ¯ Û³ (GS 4+3=7)ØŒ Ú¯Ø±ÛŒØ¯ Û´ (GS 4+4=8)ØŒ Ú¯Ø±ÛŒØ¯ Ûµ (GS 9-10).",
    topic: "Ø§Ù†Ú©ÙˆÙ„ÙˆÚ˜ÛŒ",
    difficulty: "hard" as const,
  },
];

export default function TestSession() {
  const router = useRouter();
  const params = useParams();
  const { addXP, incrementStreak } = useGamificationStore();
  const { currentExam, endExam } = useExamStore();

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [showExplanation, setShowExplanation] = useState<Record<string, boolean>>({});
  const [grokResponse, setGrokResponse] = useState<Record<string, string>>({});
  const [grokLoading, setGrokLoading] = useState<Record<string, boolean>>({});

  const questions = MOCK_QUESTIONS;
  const q = questions[current];

  // Countdown timer
  const { formatted: timeFormatted, time, isPaused, pause, resume } = useCountdown({
    initialTime: 30 * 60, // 30 minutes
    autoStart: true,
    onComplete: () => {
      toast.error("Ø²Ù…Ø§Ù† Ø¢Ø²Ù…ÙˆÙ† ØªÙ…Ø§Ù… Ø´Ø¯!");
      handleFinish();
    },
  });

  // Submit answer
  const handleAnswer = useCallback(
    (key: string) => {
      if (submitted[q.id]) return;
      setAnswers((prev) => ({ ...prev, [q.id]: key }));
    },
    [q.id, submitted]
  );

  const handleSubmit = useCallback(() => {
    if (!answers[q.id]) {
      toast.error("Ù„Ø·ÙØ§ ÛŒÚ© Ú¯Ø²ÛŒÙ†Ù‡ Ø§Ù†ØªØ®Ø§Ø¨ Ú©Ù†ÛŒØ¯");
      return;
    }
    setSubmitted((prev) => ({ ...prev, [q.id]: true }));
    setShowExplanation((prev) => ({ ...prev, [q.id]: true }));

    const isCorrect = answers[q.id] === q.correct;
    if (isCorrect) {
      addXP(25);
      toast.success("Ø¢ÙØ±ÛŒÙ†! Ù¾Ø§Ø³Ø® ØµØ­ÛŒØ­ âœ…", { duration: 2000 });
    } else {
      addXP(5); // XP for attempting
      toast.error("Ù¾Ø§Ø³Ø® Ø§Ø´ØªØ¨Ø§Ù‡ âŒ", { duration: 2000 });
    }
  }, [q, answers, submitted, addXP]);

  // Ask Grok AI
  const askGrok = useCallback(
    async (questionId: string) => {
      const question = questions.find((q) => q.id === questionId);
      if (!question) return;

      setGrokLoading((prev) => ({ ...prev, [questionId]: true }));

      const prompt = `Ø³ÙˆØ§Ù„: ${question.text}\nÚ¯Ø²ÛŒÙ†Ù‡â€ŒÙ‡Ø§:\n${Object.entries(question.options)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")}\nÙ¾Ø§Ø³Ø® ØµØ­ÛŒØ­: ${question.correct}\n\nÙ„Ø·ÙØ§ ØªÙˆØ¶ÛŒØ­ Ø¯Ù‡ÛŒØ¯ Ú†Ø±Ø§ Ù¾Ø§Ø³Ø® ${question.correct} ØµØ­ÛŒØ­ Ø§Ø³Øª Ùˆ Ú†Ø±Ø§ Ø¨Ù‚ÛŒÙ‡ Ú¯Ø²ÛŒÙ†Ù‡â€ŒÙ‡Ø§ Ø§Ø´ØªØ¨Ø§Ù‡ Ù‡Ø³ØªÙ†Ø¯.`;

      try {
        const res = await fetch("/api/grok", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });

        if (!res.ok) throw new Error("API Error");

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fullText += decoder.decode(value, { stream: true });
            setGrokResponse((prev) => ({ ...prev, [questionId]: fullText }));
          }
        }
      } catch (error) {
        setGrokResponse((prev) => ({
          ...prev,
          [questionId]: "Ø®Ø·Ø§ Ø¯Ø± Ø§Ø±ØªØ¨Ø§Ø· Ø¨Ø§ Grok AI. Ù„Ø·ÙØ§ Ø¯ÙˆØ¨Ø§Ø±Ù‡ ØªÙ„Ø§Ø´ Ú©Ù†ÛŒØ¯.",
        }));
      } finally {
        setGrokLoading((prev) => ({ ...prev, [questionId]: false }));
      }
    },
    [questions]
  );

  // Navigation
  const goNext = () => setCurrent((prev) => Math.min(prev + 1, questions.length - 1));
  const goPrev = () => setCurrent((prev) => Math.max(prev - 1, 0));
  const toggleFlag = () => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(q.id)) next.delete(q.id);
      else next.add(q.id);
      return next;
    });
  };

  // Finish exam
  const handleFinish = () => {
    const correct = questions.filter((q) => answers[q.id] === q.correct).length;
    const total = questions.length;
    const accuracy = Math.round((correct / total) * 100);
    incrementStreak();
    endExam();
    toast.success(`Ø¢Ø²Ù…ÙˆÙ† ØªÙ…Ø§Ù… Ø´Ø¯! Ø¯Ù‚Øª: ${accuracy}%`);
    router.push("/history");
  };

  const progressPercent = ((current + 1) / questions.length) * 100;
  const isAnswered = !!answers[q.id];
  const isSubmitted = !!submitted[q.id];
  const isCorrect = isSubmitted && answers[q.id] === q.correct;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1.5 text-base font-bold px-3 py-1">
            {current + 1} / {questions.length}
          </Badge>
          <Badge variant={q.difficulty === "hard" ? "destructive" : q.difficulty === "medium" ? "warning" : "success"} size="sm">
            {q.difficulty === "hard" ? "Ø³Ø®Øª" : q.difficulty === "medium" ? "Ù…ØªÙˆØ³Ø·" : "Ø¢Ø³Ø§Ù†"}
          </Badge>
          <Badge variant="ghost" size="sm">{q.topic}</Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Timer */}
          <Badge
            variant={time < 300 ? "destructive" : "outline"}
            className="gap-1.5 font-mono text-sm px-3 py-1"
          >
            <Clock className="h-3.5 w-3.5" />
            {timeFormatted}
          </Badge>

          <Button variant="ghost" size="icon-sm" onClick={isPaused ? resume : pause}>
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>

          <Button
            variant={flagged.has(q.id) ? "warning" : "ghost"}
            size="icon-sm"
            onClick={toggleFlag}
            title="Ù†Ø´Ø§Ù†â€ŒÚ¯Ø°Ø§Ø±ÛŒ"
          >
            <Flag className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Progress */}
      <Progress value={progressPercent} variant="gradient" size="sm" animated />

      {/* Question */}
      <Card variant="glass">
        <CardContent className="p-6 md:p-8">
          <p className="text-lg md:text-xl font-bold leading-relaxed">{q.text}</p>
        </CardContent>
      </Card>

      {/* Options */}
      <div className="grid gap-3">
        {Object.entries(q.options).map(([key, value]) => {
          let optionClass = "border-border/50 hover:border-primary/50 hover:bg-primary/5";

          if (isSubmitted) {
            if (key === q.correct) {
              optionClass = "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
            } else if (key === answers[q.id] && key !== q.correct) {
              optionClass = "border-destructive bg-destructive/10 text-destructive";
            } else {
              optionClass = "border-border/30 opacity-50";
            }
          } else if (answers[q.id] === key) {
            optionClass = "border-primary bg-primary/10 text-primary shadow-md";
          }

          return (
            <button
              key={key}
              onClick={() => handleAnswer(key)}
              disabled={isSubmitted}
              className={`flex items-center gap-4 p-4 md:p-5 rounded-xl border-2 transition-all text-right ${optionClass}`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-bold text-sm border ${
                  isSubmitted && key === q.correct
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : isSubmitted && key === answers[q.id]
                    ? "bg-destructive text-white border-destructive"
                    : answers[q.id] === key
                    ? "bg-primary text-white border-primary"
                    : "bg-muted/50 border-border"
                }`}
              >
                {isSubmitted && key === q.correct ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : isSubmitted && key === answers[q.id] ? (
                  <XCircle className="h-5 w-5" />
                ) : (
                  key
                )}
              </div>
              <span className="font-medium text-sm md:text-base flex-1">{value}</span>
            </button>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="outline" onClick={goPrev} disabled={current === 0} className="gap-2">
          <ArrowRight className="h-4 w-4" />
          Ù‚Ø¨Ù„ÛŒ
        </Button>

        <div className="flex gap-2">
          {!isSubmitted && (
            <Button onClick={handleSubmit} disabled={!isAnswered} variant="glow" className="gap-2 px-6">
              Ø«Ø¨Øª Ù¾Ø§Ø³Ø®
            </Button>
          )}

          {isSubmitted && (
            <Button
              variant="glass"
              onClick={() => askGrok(q.id)}
              loading={grokLoading[q.id]}
              className="gap-2"
              leftIcon={<Sparkles className="h-4 w-4" />}
            >
              ØªÙˆØ¶ÛŒØ­ Grok AI
            </Button>
          )}
        </div>

        {current < questions.length - 1 ? (
          <Button onClick={goNext} className="gap-2">
            Ø¨Ø¹Ø¯ÛŒ
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleFinish} variant="success" className="gap-2 px-6">
            <CheckCircle2 className="h-4 w-4" />
            Ù¾Ø§ÛŒØ§Ù† Ø¢Ø²Ù…ÙˆÙ†
          </Button>
        )}
      </div>

      {/* Explanation */}
      {showExplanation[q.id] && (
        <Card variant={isCorrect ? "glass" : "glass"} className={`${isCorrect ? "border-emerald-500/30" : "border-amber-500/30"} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-5 w-5 text-primary" />
              ØªÙˆØ¶ÛŒØ­
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {q.explanation}
            </p>

            {/* Grok AI Response */}
            {grokResponse[q.id] && (
              <div className="mt-4 p-4 rounded-xl bg-gradient-to-l from-blue-500/5 to-purple-500/5 border border-blue-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                    Grok AI
                  </span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {grokResponse[q.id]}
                </p>
              </div>
            )}

            {grokLoading[q.id] && (
              <div className="mt-4 flex items-center gap-2 text-blue-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Grok Ø¯Ø± Ø­Ø§Ù„ ØªØ­Ù„ÛŒÙ„...</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Question Navigator */}
      <Card variant="glass">
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3">Ù†Ù…Ø§ÛŒ Ú©Ù„ÛŒ Ø³ÙˆØ§Ù„Ø§Øª</p>
          <div className="flex flex-wrap gap-2">
            {questions.map((question, idx) => (
              <button
                key={question.id}
                onClick={() => setCurrent(idx)}
                className={`h-9 w-9 rounded-lg text-xs font-bold transition-all ${
                  idx === current
                    ? "bg-primary text-white shadow-md"
                    : submitted[question.id]
                    ? answers[question.id] === question.correct
                      ? "bg-emerald-500/20 text-emerald-600 border border-emerald-500/30"
                      : "bg-destructive/20 text-destructive border border-destructive/30"
                    : answers[question.id]
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "bg-muted text-muted-foreground border border-border/50"
                } ${flagged.has(question.id) ? "ring-2 ring-amber-500 ring-offset-1" : ""}`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}