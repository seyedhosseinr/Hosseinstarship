"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/main-store";
import { useIsMobile } from "@/hooks";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  PlusCircle,
  History,
  BarChart2,
  Layers,
  BookOpen,
  Download,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  Trophy,
} from "lucide-react";
import { useEffect } from "react";

interface NavItem {
  href?: string;
  label?: string;
  icon?: React.ComponentType<{ className?: string }>;
  divider?: boolean;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "\u062F\u0627\u0634\u0628\u0648\u0631\u062F", icon: LayoutDashboard },
  { href: "/create", label: "\u0633\u0627\u062E\u062A \u0622\u0632\u0645\u0648\u0646", icon: PlusCircle },
  { href: "/history", label: "\u0622\u0632\u0645\u0648\u0646\u200C\u0647\u0627\u06CC \u0642\u0628\u0644\u06CC", icon: History, badge: "3" },
  { href: "/analytics", label: "\u0622\u0646\u0627\u0644\u06CC\u062A\u06CC\u06A9\u0633", icon: BarChart2 },
  { divider: true },
  { href: "/flashcards", label: "\u0641\u0644\u0634\u200C\u06A9\u0627\u0631\u062A\u200C\u0647\u0627", icon: Layers },
  { href: "/notebooks", label: "\u062C\u0632\u0648\u0647\u200C\u0647\u0627", icon: BookOpen },
  { href: "/leaderboard", label: "\u0644\u06CC\u062F\u0631\u0628\u0648\u0631\u062F", icon: Trophy },
  { divider: true },
  { href: "/import", label: "\u0627\u06CC\u0645\u067E\u0648\u0631\u062A", icon: Download },
  { href: "/settings", label: "\u062A\u0646\u0638\u06CC\u0645\u0627\u062A", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const { sidebarOpen, sidebarCollapsed, setSidebarOpen, setSidebarCollapsed } = useAppStore();

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [pathname, isMobile, setSidebarOpen]);

  useEffect(() => {
    if (isMobile) setSidebarCollapsed(false);
  }, [isMobile, setSidebarCollapsed]);

  const isCollapsed = !isMobile && sidebarCollapsed;
  const isOpen = isMobile ? sidebarOpen : true;

  if (!isOpen && isMobile) return null;

  return (
    <>
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 right-0 z-50 h-full bg-card border-l border-border transition-all duration-300",
          isMobile ? "w-64" : isCollapsed ? "w-16" : "w-64",
          isMobile && !sidebarOpen && "translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between px-4 border-b border-border">
          {!isCollapsed && (
            <span className="font-bold text-lg text-primary tracking-wider">URO-KILLER</span>
          )}
          {isMobile ? (
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className={cn("shrink-0", isCollapsed && "mx-auto")}
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              {isCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          )}
        </div>

        <nav className="flex flex-col gap-1 p-2 mt-2">
          {NAV_ITEMS.map((item, idx) => {
            if (item.divider) return <div key={idx} className="my-2 h-px bg-border" />;
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href || "/"}>
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                  title={isCollapsed ? item.label : undefined}
                >
                  {Icon && <Icon className="h-5 w-5 shrink-0" />}
                  {!isCollapsed && <span>{item.label}</span>}
                  {!isCollapsed && item.badge && (
                    <span className="mr-auto rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">
                      {item.badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}