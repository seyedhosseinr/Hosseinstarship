"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Settings2,
  Clock,
  Hash,
  Shuffle,
  BookOpen,
  CheckSquare,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { generateId } from "@/lib/utils";
import { useExamStore } from "@/store/main-store";

const TOPICS = [
  { id: "oncology", name: "Ø§Ù†Ú©ÙˆÙ„ÙˆÚ˜ÛŒ", count: 320, color: "bg-red-500/10 text-red-500 border-red-500/20" },
  { id: "stones", name: "Ø³Ù†Ú¯â€ŒÙ‡Ø§ÛŒ Ø§Ø¯Ø±Ø§Ø±ÛŒ", count: 180, color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  { id: "bph", name: "BPH", count: 150, color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  { id: "infections", name: "Ø¹ÙÙˆÙ†Øªâ€ŒÙ‡Ø§", count: 200, color: "bg-green-500/10 text-green-500 border-green-500/20" },
  { id: "andrology", name: "Ø¢Ù†Ø¯Ø±ÙˆÙ„ÙˆÚ˜ÛŒ", count: 120, color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  { id: "pediatric", name: "Ø§ÙˆØ±Ùˆ-Ù¾Ø¯ÛŒØ§ØªØ±ÛŒ", count: 100, color: "bg-pink-500/10 text-pink-500 border-pink-500/20" },
  { id: "trauma", name: "ØªØ±ÙˆÙ…Ø§", count: 90, color: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  { id: "anatomy", name: "Ø¢Ù†Ø§ØªÙˆÙ…ÛŒ", count: 140, color: "bg-teal-500/10 text-teal-500 border-teal-500/20" },
];

export default function CreateExamPage() {
  const router = useRouter();
  const { startExam } = useExamStore();
  const [loading, setLoading] = useState(false);
  const [questionCount, setQuestionCount] = useState(20);
  const [timeLimit, setTimeLimit] = useState(30);
  const [timedMode, setTimedMode] = useState(true);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<"all" | "easy" | "medium" | "hard">("all");

  const toggleTopic = (id: string) => {
    setSelectedTopics((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const handleStart = () => {
    if (selectedTopics.length === 0) {
      toast.error("Ù„Ø·ÙØ§ Ø­Ø¯Ø§Ù‚Ù„ ÛŒÚ© Ù…Ø¨Ø­Ø« Ø§Ù†ØªØ®Ø§Ø¨ Ú©Ù†ÛŒØ¯");
      return;
    }

    setLoading(true);

    // Create exam object
    const examId = generateId();
    const exam = {
      id: examId,
      title: `Ø¢Ø²Ù…ÙˆÙ† ${new Date().toLocaleDateString("fa-IR")}`,
      questionIds: [], // Will be populated from question bank
      settings: {
        questionCount,
        timeLimit: timedMode ? timeLimit : undefined,
        shuffle: shuffleQuestions,
        showExplanation: true,
        allowBack: true,
        topics: selectedTopics,
        difficulty: difficulty === "all" ? undefined : difficulty,
      },
      status: "not_started" as const,
      createdAt: new Date().toISOString(),
    };

    startExam(exam);
    toast.success("Ø¢Ø²Ù…ÙˆÙ† Ø³Ø§Ø®ØªÙ‡ Ø´Ø¯!");

    setTimeout(() => {
      router.push(`/test/${examId}`);
    }, 800);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Ø³Ø§Ø®Øª Ø¢Ø²Ù…ÙˆÙ† Ø¬Ø¯ÛŒØ¯</h1>
        <p className="text-muted-foreground mt-2">
          ØªÙ†Ø¸ÛŒÙ…Ø§Øª Ø¯Ù„Ø®ÙˆØ§Ù‡ Ø±Ø§ Ø§Ù†ØªØ®Ø§Ø¨ Ú©Ù†ÛŒØ¯ Ùˆ Ø¢Ø²Ù…ÙˆÙ† Ø®ÙˆØ¯ Ø±Ø§ Ø¨Ø³Ø§Ø²ÛŒØ¯.
        </p>
      </div>

      {/* Topics Selection */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Ø§Ù†ØªØ®Ø§Ø¨ Ù…Ø¨Ø­Ø«
          </CardTitle>
          <CardDescription>
            Ù…Ø¨Ø§Ø­Ø« Ù…ÙˆØ±Ø¯ Ù†Ø¸Ø± Ø®ÙˆØ¯ Ø±Ø§ Ø§Ù†ØªØ®Ø§Ø¨ Ú©Ù†ÛŒØ¯ (Ø­Ø¯Ø§Ù‚Ù„ ÛŒÚ© Ù…Ø¨Ø­Ø«)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {TOPICS.map((topic) => (
              <button
                key={topic.id}
                onClick={() => toggleTopic(topic.id)}
                className={`p-3 rounded-xl border-2 transition-all text-right ${
                  selectedTopics.includes(topic.id)
                    ? `${topic.color} border-current shadow-md`
                    : "border-border/50 hover:border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <CheckSquare
                    className={`h-4 w-4 ${
                      selectedTopics.includes(topic.id) ? "opacity-100" : "opacity-20"
                    }`}
                  />
                </div>
                <p className="font-bold text-sm">{topic.name}</p>
                <p className="text-xs opacity-60 mt-0.5">{topic.count} Ø³ÙˆØ§Ù„</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            ØªÙ†Ø¸ÛŒÙ…Ø§Øª Ø¢Ø²Ù…ÙˆÙ†
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Question Count */}
          <div className="space-y-3">
            <label className="text-sm font-bold flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              ØªØ¹Ø¯Ø§Ø¯ Ø³ÙˆØ§Ù„Ø§Øª
            </label>
            <div className="flex gap-2 flex-wrap">
              {[10, 20, 40, 60, 80, 100].map((n) => (
                <Button
                  key={n}
                  variant={questionCount === n ? "default" : "outline"}
                  size="sm"
                  onClick={() => setQuestionCount(n)}
                  className="min-w-[48px]"
                >
                  {n}
                </Button>
              ))}
              <Input
                type="number"
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-24"
                inputSize="sm"
                min={1}
                max={200}
              />
            </div>
          </div>

          {/* Time Limit */}
          <div className="space-y-3">
            <label className="text-sm font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Ù…Ø­Ø¯ÙˆØ¯ÛŒØª Ø²Ù…Ø§Ù†ÛŒ
            </label>
            <div className="flex items-center gap-4">
              <Button
                variant={timedMode ? "default" : "outline"}
                size="sm"
                onClick={() => setTimedMode(true)}
              >
                Ø¨Ø§ Ø²Ù…Ø§Ù†
              </Button>
              <Button
                variant={!timedMode ? "default" : "outline"}
                size="sm"
                onClick={() => setTimedMode(false)}
              >
                Ø¨Ø¯ÙˆÙ† Ø²Ù…Ø§Ù†
              </Button>
              {timedMode && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(Number(e.target.value))}
                    className="w-20"
                    inputSize="sm"
                    min={5}
                    max={180}
                  />
                  <span className="text-sm text-muted-foreground">Ø¯Ù‚ÛŒÙ‚Ù‡</span>
                </div>
              )}
            </div>
          </div>

          {/* Difficulty */}
          <div className="space-y-3">
            <label className="text-sm font-bold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              Ø³Ø·Ø­ Ø³Ø®ØªÛŒ
            </label>
            <div className="flex gap-2">
              {[
                { value: "all", label: "Ù‡Ù…Ù‡" },
                { value: "easy", label: "Ø¢Ø³Ø§Ù†" },
                { value: "medium", label: "Ù…ØªÙˆØ³Ø·" },
                { value: "hard", label: "Ø³Ø®Øª" },
              ].map((d) => (
                <Button
                  key={d.value}
                  variant={difficulty === d.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDifficulty(d.value as typeof difficulty)}
                >
                  {d.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Shuffle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
            <div className="flex items-center gap-2">
              <Shuffle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">ØªØ±ØªÛŒØ¨ ØªØµØ§Ø¯ÙÛŒ Ø³ÙˆØ§Ù„Ø§Øª</span>
            </div>
            <button
              onClick={() => setShuffleQuestions(!shuffleQuestions)}
              className={`w-11 h-6 rounded-full transition-colors ${
                shuffleQuestions ? "bg-primary" : "bg-muted"
              } relative`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 transition-all ${
                  shuffleQuestions ? "left-0.5" : "left-[22px]"
                }`}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Summary & Start */}
      <Card variant="gradient">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="info">
                {questionCount} Ø³ÙˆØ§Ù„
              </Badge>
              <Badge variant={timedMode ? "warning" : "ghost"}>
                {timedMode ? `${timeLimit} Ø¯Ù‚ÛŒÙ‚Ù‡` : "Ø¨Ø¯ÙˆÙ† Ø²Ù…Ø§Ù†"}
              </Badge>
              <Badge variant="success">
                {selectedTopics.length} Ù…Ø¨Ø­Ø«
              </Badge>
              {difficulty !== "all" && (
                <Badge variant="default">{difficulty}</Badge>
              )}
            </div>

            <Button
              size="lg"
              onClick={handleStart}
              loading={loading}
              className="px-8 gap-2 min-w-[200px]"
              leftIcon={<Sparkles className="h-5 w-5" />}
            >
              {loading ? "Ø¯Ø± Ø­Ø§Ù„ Ø³Ø§Ø®Øª..." : "Ø´Ø±ÙˆØ¹ Ø¢Ø²Ù…ÙˆÙ†"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}