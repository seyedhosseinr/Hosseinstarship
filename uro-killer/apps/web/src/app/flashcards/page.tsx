"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Layers, RotateCcw, ThumbsUp, ThumbsDown, Eye, Brain, Zap, ChevronLeft } from "lucide-react";
import Link from "next/link";

const CARDS = [
  { id: 1, front: "\u0634\u0627\u06CC\u0639\u200C\u062A\u0631\u06CC\u0646 \u0646\u0648\u0639 \u0633\u0646\u06AF \u06A9\u0644\u06CC\u0647 \u0686\u06CC\u0633\u062A\u061F", back: "\u0633\u0646\u06AF\u200C\u0647\u0627\u06CC \u06A9\u0644\u0633\u06CC\u0645 \u0627\u06AF\u0632\u0627\u0644\u0627\u062A (\u062D\u062F\u0648\u062F \u06F8\u06F0\u066A)", topic: "\u0633\u0646\u06AF\u200C\u0647\u0627\u06CC \u0627\u062F\u0631\u0627\u0631\u06CC", diff: "easy" },
  { id: 2, front: "\u0627\u0646\u062F\u06CC\u06A9\u0627\u0633\u06CC\u0648\u0646\u200C\u0647\u0627\u06CC \u0645\u0637\u0644\u0642 \u0646\u0641\u0631\u06A9\u062A\u0648\u0645\u06CC \u062F\u0631 \u062A\u0631\u0648\u0645\u0627\u061F", back: "\u06F1. \u0622\u0633\u06CC\u0628 \u0639\u0631\u0648\u0642 \u06A9\u0644\u06CC\u0648\u06CC \u0627\u0635\u0644\u06CC\n\u06F2. \u0628\u06CC\u200C\u062B\u0628\u0627\u062A\u06CC \u0647\u0645\u0648\u062F\u06CC\u0646\u0627\u0645\u06CC\u06A9\n\u06F3. \u062A\u0631\u0648\u0645\u0627 Grade V", topic: "\u062A\u0631\u0648\u0645\u0627", diff: "hard" },
  { id: 3, front: "\u062F\u0631\u0645\u0627\u0646 \u062E\u0637 \u0627\u0648\u0644 BPH \u062E\u0641\u06CC\u0641 \u062A\u0627 \u0645\u062A\u0648\u0633\u0637\u061F", back: "\u0622\u0644\u0641\u0627 \u0628\u0644\u0627\u06A9\u0631\u0647\u0627 (\u062A\u0627\u0645\u0633\u0648\u0644\u0648\u0633\u06CC\u0646) \u06CC\u0627 \u0645\u0647\u0627\u0631\u06A9\u0646\u0646\u062F\u0647\u200C\u0647\u0627\u06CC \u06F5-\u0622\u0644\u0641\u0627 \u0631\u062F\u0648\u06A9\u062A\u0627\u0632", topic: "BPH", diff: "medium" },
  { id: 4, front: "\u0645\u0639\u06CC\u0627\u0631\u0647\u0627\u06CC \u062A\u0634\u062E\u06CC\u0635\u06CC \u0648\u0627\u0631\u06CC\u06A9\u0648\u0633\u0644 \u0628\u0627\u0644\u06CC\u0646\u06CC\u061F", back: "Grade I: \u0641\u0642\u0637 \u0628\u0627 \u0648\u0627\u0644\u0633\u0627\u0644\u0648\u0627 \u0644\u0645\u0633 \u0645\u06CC\u200C\u0634\u0648\u062F\nGrade II: \u0628\u062F\u0648\u0646 \u0648\u0627\u0644\u0633\u0627\u0644\u0648\u0627 \u0644\u0645\u0633 \u0645\u06CC\u200C\u0634\u0648\u062F\nGrade III: \u0642\u0627\u0628\u0644 \u0645\u0634\u0627\u0647\u062F\u0647", topic: "\u0646\u0627\u0628\u0627\u0631\u0648\u0631\u06CC", diff: "medium" },
];

const diffColors = { easy: "success", medium: "warning", hard: "destructive" } as const;
const diffLabels = { easy: "\u0622\u0633\u0627\u0646", medium: "\u0645\u062A\u0648\u0633\u0637", hard: "\u0633\u062E\u062A" };

export default function FlashcardsPage() {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [scores, setScores] = useState({ know: 0, dontKnow: 0, again: 0 });
  const card = CARDS[idx];
  const total = CARDS.length;

  const next = (type: "know" | "dontKnow" | "again") => {
    setScores(s => ({ ...s, [type]: s[type] + 1 }));
    setFlipped(false);
    setIdx((prev) => (prev + 1) % total);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
              <Layers className="h-5 w-5 text-amber-500" />
            </div>
            {"\u0641\u0644\u0634\u200C\u06A9\u0627\u0631\u062A\u200C\u0647\u0627"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{"\u0645\u0631\u0648\u0631 \u0647\u0648\u0634\u0645\u0646\u062F \u0628\u0627 \u0627\u0644\u06AF\u0648\u0631\u06CC\u062A\u0645 FSRS"}</p>
        </div>
        <Link href="/"><Button variant="ghost" size="sm" className="gap-1">{"\u0628\u0627\u0632\u06AF\u0634\u062A"}<ChevronLeft className="h-4 w-4" /></Button></Link>
      </div>

      <div className="flex items-center gap-4">
        <Progress value={((idx + 1) / total) * 100} className="flex-1" />
        <Badge variant="secondary"><Brain className="h-3 w-3 ml-1" />{idx + 1} / {total}</Badge>
        <Badge variant={diffColors[card.diff as keyof typeof diffColors]}>{diffLabels[card.diff as keyof typeof diffLabels]}</Badge>
      </div>

      <div onClick={() => setFlipped(!flipped)} className="cursor-pointer group">
        <Card className="min-h-[320px] flex flex-col overflow-hidden transition-all duration-300 hover:shadow-lg">
          <CardHeader className="pb-2"><Badge variant="outline" className="w-fit text-xs">{card.topic}</Badge></CardHeader>
          <CardContent className="flex-1 flex items-center justify-center p-8">
            {!flipped ? (
              <div className="text-center space-y-4">
                <p className="text-xl font-bold leading-relaxed">{card.front}</p>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Eye className="h-4 w-4" /><span>{"\u06A9\u0644\u06CC\u06A9 \u06A9\u0646\u06CC\u062F \u0628\u0631\u0627\u06CC \u062F\u06CC\u062F\u0646 \u062C\u0648\u0627\u0628"}</span></div>
              </div>
            ) : (
              <div className="text-center space-y-2 animate-fade-in">
                <Zap className="h-6 w-6 text-primary mx-auto mb-3" />
                <p className="text-lg leading-relaxed whitespace-pre-line">{card.back}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Button variant="destructive" className="h-12 gap-2" onClick={() => next("dontKnow")}><ThumbsDown className="h-4 w-4" />{"\u0646\u0645\u06CC\u200C\u062F\u0648\u0646\u0645"}</Button>
        <Button variant="outline" className="h-12 gap-2" onClick={() => next("again")}><RotateCcw className="h-4 w-4" />{"\u062F\u0648\u0628\u0627\u0631\u0647"}</Button>
        <Button className="h-12 gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => next("know")}><ThumbsUp className="h-4 w-4" />{"\u0628\u0644\u062F \u0628\u0648\u062F\u0645"}</Button>
      </div>

      <Card>
        <CardContent className="p-4 flex items-center justify-around text-center">
          <div><p className="text-lg font-black text-emerald-500">{scores.know}</p><p className="text-[10px] text-muted-foreground">{"\u0628\u0644\u062F \u0628\u0648\u062F\u0645"}</p></div>
          <div className="h-8 w-px bg-border" />
          <div><p className="text-lg font-black text-muted-foreground">{scores.again}</p><p className="text-[10px] text-muted-foreground">{"\u062F\u0648\u0628\u0627\u0631\u0647"}</p></div>
          <div className="h-8 w-px bg-border" />
          <div><p className="text-lg font-black text-destructive">{scores.dontKnow}</p><p className="text-[10px] text-muted-foreground">{"\u0646\u0645\u06CC\u200C\u062F\u0648\u0646\u0645"}</p></div>
        </CardContent>
      </Card>
    </div>
  );
}