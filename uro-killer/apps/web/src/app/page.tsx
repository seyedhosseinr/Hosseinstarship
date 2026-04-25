import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Brain, Target, TrendingUp, Clock, Zap, ChevronLeft, Sparkles, GraduationCap, Trophy, Flame } from "lucide-react";
import Link from "next/link";

const QUICK_ACTIONS = [
  { title: "\u0622\u0632\u0645\u0648\u0646 \u062C\u062F\u06CC\u062F", desc: "\u0634\u0631\u0648\u0639 \u06CC\u06A9 \u0622\u0632\u0645\u0648\u0646 \u0633\u0641\u0627\u0631\u0634\u06CC", icon: Zap, href: "/create", color: "bg-primary text-primary-foreground" },
  { title: "\u0641\u0644\u0634\u200C\u06A9\u0627\u0631\u062A", desc: "\u0645\u0631\u0648\u0631 \u06A9\u0627\u0631\u062A\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632", icon: Brain, href: "/flashcards", color: "bg-amber-500/10 text-amber-500" },
  { title: "\u062C\u0632\u0648\u0647\u200C\u0647\u0627", desc: "\u0645\u0646\u0627\u0628\u0639 \u0645\u0637\u0627\u0644\u0639\u0627\u062A\u06CC", icon: BookOpen, href: "/notebooks", color: "bg-pink-500/10 text-pink-500" },
  { title: "\u0622\u0646\u0627\u0644\u06CC\u0632", desc: "\u0628\u0631\u0631\u0633\u06CC \u067E\u06CC\u0634\u0631\u0641\u062A", icon: TrendingUp, href: "/analytics", color: "bg-violet-500/10 text-violet-500" },
];

const RECENT_TESTS = [
  { title: "\u0633\u0646\u06AF\u200C\u0647\u0627\u06CC \u0627\u062F\u0631\u0627\u0631\u06CC", score: 85, questions: 40, date: "\u062F\u06CC\u0631\u0648\u0632" },
  { title: "\u0627\u0646\u062F\u0648\u06CC\u0648\u0631\u0648\u0644\u0648\u0698\u06CC", score: 72, questions: 30, date: "\u06F3 \u0631\u0648\u0632 \u067E\u06CC\u0634" },
  { title: "BPH \u0648 \u067E\u0631\u0648\u0633\u062A\u0627\u062A", score: 91, questions: 25, date: "\u06F1 \u0647\u0641\u062A\u0647 \u067E\u06CC\u0634" },
];

export default function HomePage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-border/50 p-6 md:p-8">
        <div className="relative z-10">
          <Badge variant="secondary" className="mb-4 gap-1.5"><Sparkles className="h-3 w-3" />{"\u062E\u0648\u0634 \u0622\u0645\u062F\u06CC\u062F"}</Badge>
          <h1 className="text-2xl md:text-4xl font-black mb-2">{"\u0633\u0644\u0627\u0645\u060C \u062F\u06A9\u062A\u0631 \u062D\u0633\u06CC\u0646\u06CC"} <span className="inline-block animate-wave">👋</span></h1>
          <p className="text-muted-foreground max-w-lg">{"\u0627\u0645\u0631\u0648\u0632 \u0686\u0647 \u0686\u06CC\u0632\u06CC \u0645\u06CC\u200C\u062E\u0648\u0627\u06CC \u06CC\u0627\u062F \u0628\u06AF\u06CC\u0631\u06CC\u061F"}</p>
        </div>
        <div className="absolute top-0 left-0 w-full h-full bg-grid-white/5 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.href} href={action.href}>
              <Card className="card-hover h-full cursor-pointer group">
                <CardContent className="p-4 flex flex-col h-full">
                  <div className={"flex h-10 w-10 items-center justify-center rounded-xl mb-3 transition-transform group-hover:scale-110 " + action.color}><Icon className="h-5 w-5" /></div>
                  <CardTitle className="text-sm mb-1">{action.title}</CardTitle>
                  <CardDescription className="text-xs">{action.desc}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </section>

      <section className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" />{"\u0622\u0632\u0645\u0648\u0646\u200C\u0647\u0627\u06CC \u0627\u062E\u06CC\u0631"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {RECENT_TESTS.map((test, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-accent/50 hover:bg-accent transition-colors">
                <div className={"flex h-10 w-10 items-center justify-center rounded-xl font-black text-sm " + (test.score >= 80 ? "bg-emerald-500/10 text-emerald-500" : test.score >= 60 ? "bg-amber-500/10 text-amber-500" : "bg-red-500/10 text-red-500")}>{test.score}%</div>
                <div className="flex-1 min-w-0"><p className="font-semibold text-sm truncate">{test.title}</p><p className="text-xs text-muted-foreground">{test.questions} {"\u0633\u0648\u0627\u0644"} • {test.date}</p></div>
                <Button variant="ghost" size="sm" className="gap-1">{"\u0645\u0631\u0648\u0631"}<ChevronLeft className="h-3 w-3" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-4 w-4" />{"\u0647\u062F\u0641 \u0647\u0641\u062A\u06AF\u06CC"}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-4"><div className="text-5xl font-black text-primary mb-1">156</div><p className="text-sm text-muted-foreground">{"\u0633\u0648\u0627\u0644 \u0627\u0632 \u06F2\u06F0\u06F0 \u0647\u062F\u0641"}</p></div>
            <Progress value={78} className="h-2" />
            <div className="flex items-center justify-center gap-2 text-sm"><Flame className="h-4 w-4 text-orange-500" /><span className="font-semibold">{"\u06F7 \u0631\u0648\u0632 \u0645\u062A\u0648\u0627\u0644\u06CC"}</span></div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}