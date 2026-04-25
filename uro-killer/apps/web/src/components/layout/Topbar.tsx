"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Search, Bell, Menu, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAppStore, useGamificationStore } from "@/store/main-store";
import { useIsMobile } from "@/hooks";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export default function TopBar() {
  const { theme, setTheme } = useTheme();
  const { setCommandPaletteOpen, setSidebarOpen } = useAppStore();
  const { xp, level, streak } = useGamificationStore();
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <header className="h-14 bg-background/80 backdrop-blur-xl border-b border-border/50 sticky top-0 z-30 flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3">
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => setCommandPaletteOpen(true)}
          className={cn(
            "justify-start gap-2 text-muted-foreground",
            isMobile ? "w-10 px-0 justify-center" : "w-72"
          )}
        >
          <Search className="h-4 w-4 shrink-0" />
          {!isMobile && (
            <>
              <span className="text-sm">{"\u062C\u0633\u062A\u062C\u0648 \u06CC\u0627 \u067E\u0631\u0633\u0634 \u0627\u0632 Grok..."}</span>
              <kbd className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded border font-mono">Ctrl+K</kbd>
            </>
          )}
        </Button>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {!isMobile && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-bold text-primary">{"\u0633\u0637\u062D"} {level}</span>
            <div className="h-3 w-px bg-border" />
            <span className="text-xs text-muted-foreground">{xp.toLocaleString("fa-IR")} XP</span>
          </div>
        )}
        {streak > 0 && (
          <Badge variant="secondary" className="gap-1">
            {"\uD83D\uDD25"} {streak}
          </Badge>
        )}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive" />
        </Button>
        {mounted && (
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
        )}
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">DR</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}