"use client";

import { PageHeader } from "@/components/ui/page-header";
import { Surface } from "@/components/ui/surface";
import { colorLight, colorDark } from "@/lib/theme/tokens";

const PROFILE_STYLES = `
[data-profile] {
${Object.entries(colorLight).map(([k, v]) => `  --pf-${k}: ${v};`).join("\n")}
}
.dark [data-profile] {
${Object.entries(colorDark).map(([k, v]) => `  --pf-${k}: ${v};`).join("\n")}
}
`;
const c = Object.fromEntries(
  Object.keys(colorLight).map((k) => [k, `var(--pf-${k})`]),
) as Record<keyof typeof colorLight, string>;
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  User,
  Award,
  Target,
  Flame,
  Calendar,
  TrendingUp,
  BookOpen,
  Clock,
  Star,
  Zap,
  Trophy,
  GraduationCap,
} from "lucide-react";

const achievements = [
  { icon: Flame, label: "\u0622\u062A\u0634\u200C\u0646\u0634\u0627\u0646", desc: "14 \u0631\u0648\u0632 \u0645\u062A\u0648\u0627\u0644\u06CC", unlocked: true, color: "text-warning bg-warning/10" },
  { icon: Target, label: "\u062A\u06CC\u0631\u0627\u0646\u062F\u0627\u0632", desc: "90% \u062F\u0631 \u06CC\u06A9 \u0622\u0632\u0645\u0648\u0646", unlocked: true, color: "text-success bg-success/10" },
  { icon: Zap, label: "\u0628\u0631\u0642\u200C\u0622\u0633\u0627", desc: "50 \u0633\u0648\u0627\u0644 \u062F\u0631 \u06CC\u06A9 \u0631\u0648\u0632", unlocked: true, color: "text-warning bg-warning/10" },
  { icon: Trophy, label: "\u0642\u0647\u0631\u0645\u0627\u0646", desc: "1000 \u0633\u0648\u0627\u0644 \u067E\u0627\u0633\u062E \u062F\u0627\u062F\u0647", unlocked: false, color: "text-primary bg-primary/10" },
  { icon: GraduationCap, label: "\u0641\u0627\u0631\u063A\u200C\u0627\u0644\u062A\u062D\u0635\u06CC\u0644", desc: "\u062A\u0645\u0627\u0645 \u0641\u0635\u0644\u200C\u0647\u0627", unlocked: false, color: "text-primary bg-primary/10" },
  { icon: Star, label: "\u0633\u062A\u0627\u0631\u0647\u200C\u062F\u0627\u0631", desc: "5 \u0622\u0632\u0645\u0648\u0646 100%", unlocked: false, color: "text-warning bg-warning/10" },
];

const stats = [
  { label: "\u06A9\u0644 \u0633\u0648\u0627\u0644\u0627\u062A", value: "2,480", icon: Target },
  { label: "\u0645\u06CC\u0627\u0646\u06AF\u06CC\u0646 \u0646\u0645\u0631\u0647", value: "74%", icon: TrendingUp },
  { label: "\u0633\u0627\u0639\u062A \u0645\u0637\u0627\u0644\u0639\u0647", value: "86", icon: Clock },
  { label: "\u0631\u0648\u0632 \u0645\u062A\u0648\u0627\u0644\u06CC", value: "14", icon: Flame },
];

export default function ProfilePage() {
  return (
    <div data-profile className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <style dangerouslySetInnerHTML={{ __html: PROFILE_STYLES }} />
      <PageHeader badge="PROFILE" breadcrumb={[{ label: "\u062E\u0627\u0646\u0647", href: "/" }, { label: "\u067E\u0631\u0648\u0641\u0627\u06CC\u0644" }]} title={"\u067E\u0631\u0648\u0641\u0627\u06CC\u0644"} description={"\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u062D\u0633\u0627\u0628 \u06A9\u0627\u0631\u0628\u0631\u06CC"} />
      {/* Profile Header */}
      <Surface radius="xl" className="overflow-hidden">
        <div className="h-24 bg-gradient-to-l from-primary/20 via-primary/10 to-transparent" />
        <div className="relative px-6 pb-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 -mt-12">
            <div className="w-24 h-24 rounded-2xl bg-primary/10 border-4 flex items-center justify-center shadow-xl">
              <User className="h-10 w-10 text-primary" />
            </div>
            <div className="text-center sm:text-right flex-1">
              <h1 className="text-2xl font-black">{"\u062F\u06A9\u062A\u0631 \u062D\u0633\u06CC\u0646\u06CC"}</h1>
              <p className="text-sm" style={{ color: c.textMuted }}>{"\u062F\u0633\u062A\u06CC\u0627\u0631 \u0627\u0648\u0631\u0648\u0644\u0648\u0698\u06CC \u2022 \u0633\u0627\u0644 \u0633\u0648\u0645"}</p>
            </div>
            <Badge className="gap-1 bg-primary/10 text-primary border-primary/20">
              <Award className="h-3.5 w-3.5" />
              {"\u0633\u0637\u062D \u0637\u0644\u0627\u06CC\u06CC"}
            </Badge>
          </div>
        </div>
      </Surface>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <Surface key={stat.label} padding="sm" radius="xl" className="text-center">
              <stat.icon className="h-5 w-5 mx-auto mb-2" style={{ color: c.accent }} />
              <p className="text-2xl font-black">{stat.value}</p>
              <p className="text-xs" style={{ color: c.textMuted }}>{stat.label}</p>
          </Surface>
        ))}
      </div>

      {/* Level Progress */}
      <Surface padding="md" radius="xl">
        <h3 className="text-base font-bold flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5" style={{ color: c.accent }} />
            {"\u0633\u0637\u062D \u067E\u06CC\u0634\u0631\u0641\u062A"}
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">{"\u0633\u0637\u062D 12"}</span>
            <span className="text-sm" style={{ color: c.textMuted }}>2,480 / 3,000 XP</span>
          </div>
          <Progress value={83} className="h-3" />
          <p className="text-xs text-center" style={{ color: c.textMuted }}>
            520 XP {"\u062A\u0627 \u0633\u0637\u062D \u0628\u0639\u062F\u06CC"}
          </p>
        </div>
      </Surface>

      {/* Achievements */}
      <Surface padding="md" radius="xl">
        <h3 className="text-base font-bold flex items-center gap-2 mb-4">
          <Award className="h-5 w-5" style={{ color: c.accent }} />
            {"\u062F\u0633\u062A\u0627\u0648\u0631\u062F\u0647\u0627"}
        </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {achievements.map((ach) => (
              <div
                key={ach.label}
                className={`p-3 rounded-xl border text-center transition-all ${
                  ach.unlocked
                    ? "border-border/50 hover:shadow-md"
                    : "border-border/20 opacity-40 grayscale"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center ${ach.color}`}>
                  <ach.icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-bold">{ach.label}</p>
                <p className="text-[10px]" style={{ color: c.textMuted }}>{ach.desc}</p>
              </div>
            ))}
          </div>
      </Surface>

      {/* Study Activity */}
      <Surface padding="md" radius="xl">
        <h3 className="text-base font-bold flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5" style={{ color: c.accent }} />
            {"\u0641\u0639\u0627\u0644\u06CC\u062A \u0627\u062E\u06CC\u0631"}
        </h3>
          <div className="flex gap-1 flex-wrap justify-center">
            {Array.from({ length: 30 }, (_, i) => {
              const intensity = Math.random();
              const bg =
                intensity > 0.7
                  ? "bg-primary"
                  : intensity > 0.4
                  ? "bg-primary/50"
                  : intensity > 0.1
                  ? "bg-primary/20"
                  : "bg-muted";
              return (
                <div key={i} className={`w-4 h-4 rounded-sm ${bg}`} title={`${"\u0631\u0648\u0632"} ${30 - i}`} />
              );
            })}
          </div>
          <p className="text-xs text-center mt-3" style={{ color: c.textMuted }}>30 {"\u0631\u0648\u0632 \u06AF\u0630\u0634\u062A\u0647"}</p>
      </Surface>
    </div>
  );
}