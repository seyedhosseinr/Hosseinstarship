"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3, TrendingUp, Target, Clock, Brain, Zap,
  Calendar, Award, BookOpen, ChevronLeft, ArrowUp, ArrowDown
} from "lucide-react";
import Link from "next/link";

const WEEKLY_DATA = [
  { day: "\u0634\u0646\u0628\u0647", questions: 45, correct: 38 },
  { day: "\u06CC\u06A9\u200C\u0634\u0646\u0628\u0647", questions: 62, correct: 51 },
  { day: "\u062F\u0648\u0634\u0646\u0628\u0647", questions: 38, correct: 30 },
  { day: "\u0633\u0647\u200C\u0634\u0646\u0628\u0647", questions: 55, correct: 47 },
  { day: "\u0686\u0647\u0627\u0631\u0634\u0646\u0628\u0647", questions: 70, correct: 59 },
  { day: "\u067E\u0646\u062C\u200C\u0634\u0646\u0628\u0647", questions: 80, correct: 68 },
  { day: "\u062C\u0645\u0639\u0647", questions: 30, correct: 25 },
];

const TOPIC_STATS = [
  { name: "\u0633\u0646\u06AF\u200C\u0647\u0627\u06CC \u0627\u062F\u0631\u0627\u0631\u06CC", score: 85, total: 120, trend: "up" },
  { name: "\u0627\u0646\u062F\u0648\u06CC\u0648\u0631\u0648\u0644\u0648\u0698\u06CC", score: 72, total: 95, trend: "up" },
  { name: "\u0627\u0646\u06A9\u0648\u0644\u0648\u0698\u06CC", score: 68, total: 110, trend: "down" },
  { name: "\u0646\u0627\u0628\u0627\u0631\u0648\u0631\u06CC \u0645\u0631\u062F\u0627\u0646", score: 91, total: 80, trend: "up" },
  { name: "\u0639\u0641\u0648\u0646\u062A\u200C\u0647\u0627\u06CC \u0627\u062F\u0631\u0627\u0631\u06CC", score: 78, total: 75, trend: "up" },
  { name: "\u0627\u0648\u0631\u0648\u0644\u0648\u0698\u06CC \u0627\u0637\u0641\u0627\u0644", score: 55, total: 65, trend: "down" },
];

export default function AnalyticsPage() {
  const totalQuestions = WEEKLY_DATA.reduce((s, d) => s + d.questions, 0);
  const totalCorrect = WEEKLY_DATA.reduce((s, d) => s + d.correct, 0);
  const avgScore = Math.round((totalCorrect / totalQuestions) * 100);
  const maxBar = Math.max(...WEEKLY_DATA.map(d => d.questions));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-black flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
              <BarChart3 className="h-5 w-5 text-violet-500" />
            </div>
            {"\u0622\u0646\u0627\u0644\u06CC\u0632 \u0639\u0645\u0644\u06A9\u0631\u062F"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{"\u0628\u0631\u0631\u0633\u06CC \u067E\u06CC\u0634\u0631\u0641\u062A \u0648 \u0646\u0642\u0627\u0637 \u0636\u0639\u0641 \u0648 \u0642\u0648\u062A"}</p>
        </div>
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-1">
            {"\u0628\u0627\u0632\u06AF\u0634\u062A"}
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "\u06A9\u0644 \u0633\u0648\u0627\u0644\u0627\u062A", value: totalQuestions.toString(), icon: BookOpen, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "\u0645\u06CC\u0627\u0646\u06AF\u06CC\u0646 \u0646\u0645\u0631\u0647", value: avgScore + "%", icon: Target, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "\u0631\u0648\u0632\u0647\u0627\u06CC \u0641\u0639\u0627\u0644", value: "7", icon: Calendar, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "\u0631\u062A\u0628\u0647", value: "\u06F1\u06F2", icon: Award, color: "text-violet-500", bg: "bg-violet-500/10" },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={"flex h-10 w-10 items-center justify-center rounded-xl " + stat.bg}>
                    <Icon className={"h-5 w-5 " + stat.color} />
                  </div>
                  <div>
                    <p className="text-2xl font-black">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Weekly Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {"\u0639\u0645\u0644\u06A9\u0631\u062F \u0647\u0641\u062A\u06AF\u06CC"}
          </CardTitle>
          <CardDescription>{"\u062A\u0639\u062F\u0627\u062F \u0633\u0648\u0627\u0644\u0627\u062A \u067E\u0627\u0633\u062E \u062F\u0627\u062F\u0647 \u0634\u062F\u0647 \u062F\u0631 \u0647\u0631 \u0631\u0648\u0632"}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between gap-2 h-48">
            {WEEKLY_DATA.map((d, i) => {
              const height = (d.questions / maxBar) * 100;
              const correctHeight = (d.correct / maxBar) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs font-semibold">{d.questions}</span>
                  <div className="w-full relative" style={{ height: height + "%" }}>
                    <div className="absolute bottom-0 w-full bg-primary/20 rounded-t-md" style={{ height: "100%" }} />
                    <div className="absolute bottom-0 w-full bg-primary rounded-t-md" style={{ height: correctHeight + "%" }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{d.day}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-6 mt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-primary/20" />
              {"\u06A9\u0644 \u0633\u0648\u0627\u0644\u0627\u062A"}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-primary" />
              {"\u067E\u0627\u0633\u062E \u0635\u062D\u06CC\u062D"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Topic Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            {"\u0639\u0645\u0644\u06A9\u0631\u062F \u0628\u0647 \u062A\u0641\u06A9\u06CC\u06A9 \u0645\u0648\u0636\u0648\u0639"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {TOPIC_STATS.map((topic, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{topic.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{topic.score}%</span>
                  {topic.trend === "up" ? (
                    <ArrowUp className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <ArrowDown className="h-3 w-3 text-red-500" />
                  )}
                </div>
              </div>
              <Progress value={topic.score} size="sm" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}