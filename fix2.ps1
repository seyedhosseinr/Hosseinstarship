$content = @"
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
  { id: "oncology", name: "انکولوژی", count: 320, color: "bg-red-500/10 text-red-500 border-red-500/20" },
  { id: "stones", name: "سنگ ادراری", count: 180, color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  { id: "bph", name: "BPH", count: 150, color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  { id: "infections", name: "عفونت", count: 200, color: "bg-green-500/10 text-green-500 border-green-500/20" },
  { id: "andrology", name: "آندرولوژی", count: 120, color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  { id: "pediatric", name: "اورو-پدیاتری", count: 100, color: "bg-pink-500/10 text-pink-500 border-pink-500/20" },
  { id: "trauma", name: "تروما", count: 90, color: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  { id: "anatomy", name: "آناتومی", count: 140, color: "bg-teal-500/10 text-teal-500 border-teal-500/20" },
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
      toast.error("لطفا حداقل یک مبحث انتخاب کنید");
      return;
    }

    setLoading(true);

    const examId = generateId();
    const exam = {
      id: examId,
      title: "آزمون " + new Date().toLocaleDateString("fa-IR"),
      questionIds: [],
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
    toast.success("آزمون ساخته شد!");

    setTimeout(() => {
      router.push("/test/" + examId);
    }, 800);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-black tracking-tight">ساخت آزمون جدید</h1>
        <p className="text-muted-foreground mt-2">
          تنظیمات دلخواه را انتخاب کنید و آزمون خود را بسازید.
        </p>
      </div>

      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            انتخاب مبحث
          </CardTitle>
          <CardDescription>
            مباحث مورد نظر خود را انتخاب کنید (حداقل یک مبحث)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {TOPICS.map((topic) => (
              <button
                key={topic.id}
                onClick={() => toggleTopic(topic.id)}
                className={"p-3 rounded-xl border-2 transition-all text-right " +
                  (selectedTopics.includes(topic.id)
                    ? topic.color + " border-current shadow-md"
                    : "border-border/50 hover:border-border text-muted-foreground hover:text-foreground")
                }
              >
                <div className="flex items-center justify-between mb-1">
                  <CheckSquare
                    className={"h-4 w-4 " +
                      (selectedTopics.includes(topic.id) ? "opacity-100" : "opacity-20")
                    }
                  />
                </div>
                <p className="font-bold text-sm">{topic.name}</p>
                <p className="text-xs opacity-60 mt-0.5">{topic.count} سوال</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            تنظیمات آزمون
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-bold flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              تعداد سوالات
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

          <div className="space-y-3">
            <label className="text-sm font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              محدودیت زمانی
            </label>
            <div className="flex items-center gap-4">
              <Button
                variant={timedMode ? "default" : "outline"}
                size="sm"
                onClick={() => setTimedMode(true)}
              >
                با زمان
              </Button>
              <Button
                variant={!timedMode ? "default" : "outline"}
                size="sm"
                onClick={() => setTimedMode(false)}
              >
                بدون زمان
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
                  <span className="text-sm text-muted-foreground">دقیقه</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-bold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              سطح سختی
            </label>
            <div className="flex gap-2">
              {[
                { value: "all", label: "همه" },
                { value: "easy", label: "آسان" },
                { value: "medium", label: "متوسط" },
                { value: "hard", label: "سخت" },
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

          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
            <div className="flex items-center gap-2">
              <Shuffle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">ترتیب تصادفی سوالات</span>
            </div>
            <button
              onClick={() => setShuffleQuestions(!shuffleQuestions)}
              className={"w-11 h-6 rounded-full transition-colors " +
                (shuffleQuestions ? "bg-primary" : "bg-muted") +
                " relative"
              }
            >
              <div
                className={"w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 transition-all " +
                  (shuffleQuestions ? "left-0.5" : "left-[22px]")
                }
              />
            </button>
          </div>
        </CardContent>
      </Card>

      <Card variant="gradient">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="info">
                {questionCount} سوال
              </Badge>
              <Badge variant={timedMode ? "warning" : "ghost"}>
                {timedMode ? timeLimit + " دقیقه" : "بدون زمان"}
              </Badge>
              <Badge variant="success">
                {selectedTopics.length} مبحث
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
              {loading ? "در حال ساخت..." : "شروع آزمون"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
"@

$path = "src/app/create/page.tsx"
$utf8 = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($path, $content, $utf8)
Write-Host "FILE WRITTEN SUCCESSFULLY - $((Get-Item $path).Length) bytes" -ForegroundColor Green
