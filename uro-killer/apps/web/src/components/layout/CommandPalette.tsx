"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useStore";
import { useTheme } from "next-themes";
import {
  Search, LayoutDashboard, PlusCircle, History, BarChart2,
  Layers, BookOpen, Download, Settings, Moon, Sun, X, Sparkles
} from "lucide-react";

const COMMANDS = [
  { id: "home", title: "داشبورد اصلی", icon: LayoutDashboard, route: "/", cat: "صفحات" },
  { id: "create", title: "ساخت آزمون جدید", icon: PlusCircle, route: "/create", cat: "صفحات" },
  { id: "history", title: "آزمون‌های قبلی", icon: History, route: "/history", cat: "صفحات" },
  { id: "analytics", title: "آنالیتیکس", icon: BarChart2, route: "/analytics", cat: "صفحات" },
  { id: "flashcards", title: "فلش‌کارت‌ها", icon: Layers, route: "/flashcards", cat: "مطالعه" },
  { id: "notebooks", title: "جزوه‌ها", icon: BookOpen, route: "/notebooks", cat: "مطالعه" },
  { id: "import", title: "ایمپورت", icon: Download, route: "/import", cat: "سیستم" },
  { id: "settings", title: "تنظیمات", icon: Settings, route: "/settings", cat: "سیستم" },
];

export default function CommandPalette() {
  const { cmdOpen, setCmdOpen } = useAppStore();
  const { setTheme } = useTheme();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setCmdOpen(!cmdOpen); }
      if (e.key === "Escape") setCmdOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [cmdOpen, setCmdOpen]);

  const filtered = useMemo(() => {
    if (!search) return COMMANDS;
    const s = search.toLowerCase();
    return COMMANDS.filter(c => c.title.toLowerCase().includes(s) || c.cat.toLowerCase().includes(s));
  }, [search]);

  useEffect(() => { setSelectedIdx(0); }, [filtered]);

  const runCommand = (cmd: typeof COMMANDS[0]) => {
    setCmdOpen(false);
    setSearch("");
    router.push(cmd.route);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && filtered[selectedIdx]) { runCommand(filtered[selectedIdx]); }
  };

  if (!cmdOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[18vh]">
      <div className="fixed inset-0 bg-background/60 backdrop-blur-sm" onClick={() => setCmdOpen(false)} />
      <div
        className="relative w-[92vw] max-w-lg overflow-hidden rounded-2xl border border-border/50 bg-card shadow-2xl animate-fade-in"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو در صفحات..."
            className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          <button
            onClick={() => setCmdOpen(false)}
            className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="max-h-[300px] overflow-y-auto p-2 custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-muted-foreground">
              <Sparkles className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">نتیجه‌ای یافت نشد</p>
            </div>
          ) : (
            filtered.map((cmd, idx) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.id}
                  onClick={() => runCommand(cmd)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors",
                    idx === selectedIdx
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-accent"
                  )}
                >
                  <Icon className="h-[18px] w-[18px] opacity-60" />
                  <span className="font-medium">{cmd.title}</span>
                  <span className="mr-auto text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{cmd.cat}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}