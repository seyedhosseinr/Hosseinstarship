import Link from "next/link";
import { CalendarDays, CircleDot, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { HeroModel } from "./dashboard-types";
import { toneClasses } from "./dashboard-utils";
import { cn } from "@/lib/utils";

type DashboardHeroProps = {
  hero: HeroModel;
  theme: "light" | "dark";
  onToggleTheme: () => void;
};

export function DashboardHero({ hero, theme, onToggleTheme }: DashboardHeroProps) {
  const statusTone = toneClasses[hero.statusTone];
  const PrimaryIcon = hero.primaryAction.icon;
  const SecondaryIcon = hero.secondaryAction.icon;

  return (
    <header className="rounded-b-[2rem] border-b border-border bg-card/80 px-4 py-5 shadow-sm backdrop-blur-sm sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-5 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant="mastery" className="gap-1.5 py-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {hero.jalaliDate}
            </Badge>
            <Badge variant="outline" className={cn("gap-1.5 py-1", statusTone.text)}>
              <span className={cn("h-2 w-2 rounded-full", statusTone.bg)} />
              {hero.status}
            </Badge>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold text-muted-foreground">Mission Control</p>
              <h1 className="mt-1 text-2xl font-black leading-tight tracking-normal text-foreground sm:text-3xl">
                {hero.greeting} حسین
              </h1>
              <p className="mt-3 text-lg font-bold text-foreground">{hero.title}</p>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">{hero.reason}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="clinical" size="lg" className="min-h-touch px-5">
                <Link href={hero.primaryAction.href}>
                  {PrimaryIcon ? <PrimaryIcon className="h-5 w-5" /> : null}
                  {hero.primaryAction.label}
                </Link>
              </Button>
              <Button asChild variant="clinicalSoft" size="lg" className="min-h-touch px-4">
                <Link href={hero.secondaryAction.href}>
                  {SecondaryIcon ? <SecondaryIcon className="h-5 w-5" /> : null}
                  {hero.secondaryAction.label}
                </Link>
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghostClinical"
                      size="icon"
                      className="min-h-touch min-w-touch"
                      onClick={onToggleTheme}
                      aria-label="تغییر حالت روشن و تاریک"
                    >
                      {theme === "dark" ? <Sparkles className="h-5 w-5" /> : <CircleDot className="h-5 w-5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>تغییر تم</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:w-[560px]">
          {hero.summaries.map((item) => {
            const Icon = item.icon;
            const tone = toneClasses[item.tone];
            return (
              <Card key={item.key} variant="clinical" className="rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-muted-foreground">{item.label}</span>
                    <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tone.soft, tone.text)}>
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <p className={cn("mt-3 text-2xl font-black tabular-nums tracking-normal", tone.text)}>{item.value}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{item.helper}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </header>
  );
}
