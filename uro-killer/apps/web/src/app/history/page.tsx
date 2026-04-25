"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, ChevronLeft, Calendar, CheckCircle, XCircle, BarChart3 } from "lucide-react";
import Link from "next/link";

const HISTORY = [
  { id: 1, title: "\u0633\u0646\u06AF\u200C\u0647\u0627\u06CC \u0627\u062F\u0631\u0627\u0631\u06CC", date: "\u06F1\u06F4\u06F0\u06F4/\u06F1\u06F2/\u06F0\u06F5", score: 85, total: 40, correct: 34, time: "32 \u062F\u0642\u06CC\u0642\u0647" },
  { id: 2, title: "\u0627\u0646\u062F\u0648\u06CC\u0648\u0631\u0648\u0644\u0648\u0698\u06CC", date: "\u06F1\u06F4\u06F0\u06F4/\u06F1\u06F2/\u06F0\u06F3", score: 72, total: 30, correct: 22, time: "28 \u062F\u0642\u06CC\u0642\u0647" },
  { id: 3, title: "BPH \u0648 \u067E\u0631\u0648\u0633\u062A\u0627\u062A", date: "\u06F1\u06F4\u06F0\u06F4/\u06F1\u06F1/\u06F2\u06F8", score: 91, total: 25, correct: 23, time: "20 \u062F\u0642\u06CC\u0642\u0647" },
  { id: 4, title: "\u0627\u0646\u06A9\u0648\u0644\u0648\u0698\u06CC \u0627\u0648\u0631\u0648\u0644\u0648\u0698\u06CC", date: "\u06F1\u06F4\u06F0\u06F4/\u06F1\u06F1/\u06F2\u06F0", score: 68, total: 35, correct: 24, time: "35 \u062F\u0642\u06CC\u0642\u0647" },
];

export default function HistoryPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-black flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10"><Clock className="h-5 w-5 text-blue-500" /></div>
            {"\u062A\u0627\u0631\u06CC\u062E\u0686\u0647 \u0622\u0632\u0645\u0648\u0646\u200C\u0647\u0627"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{"\u0645\u0631\u0648\u0631 \u0622\u0632\u0645\u0648\u0646\u200C\u0647\u0627\u06CC \u0642\u0628\u0644\u06CC"}</p>
        </div>
        <Link href="/"><Button variant="ghost" size="sm" className="gap-1">{"\u0628\u0627\u0632\u06AF\u0634\u062A"}<ChevronLeft className="h-4 w-4" /></Button></Link>
      </div>

      <div className="space-y-4">
        {HISTORY.map((item) => (
          <Card key={item.id} className="card-hover">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className={"flex h-14 w-14 items-center justify-center rounded-xl font-black text-lg " + (item.score >= 80 ? "bg-emerald-500/10 text-emerald-500" : item.score >= 60 ? "bg-amber-500/10 text-amber-500" : "bg-red-500/10 text-red-500")}>{item.score}%</div>
                <div className="flex-1">
                  <h3 className="font-bold text-base mb-1">{item.title}</h3>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{item.date}</span>
                    <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-emerald-500" />{item.correct} {"\u0635\u062D\u06CC\u062D"}</span>
                    <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-red-500" />{item.total - item.correct} {"\u063A\u0644\u0637"}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{item.time}</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="gap-1"><BarChart3 className="h-4 w-4" />{"\u062C\u0632\u0626\u06CC\u0627\u062A"}</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}