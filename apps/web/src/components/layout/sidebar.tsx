"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  History,
  BarChart3,
  CreditCard,
  BookOpen,
  FileDown,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAppStore } from "@/store/useStore";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/",          label: "\u062F\u0634\u0628\u0648\u0631\u062F",        icon: LayoutDashboard },
  { href: "/create",    label: "\u0633\u0627\u062E\u062A \u0622\u0632\u0645\u0648\u0646",   icon: PlusCircle },
  { href: "/history",   label: "\u062A\u0627\u0631\u06CC\u062E\u0686\u0647",        icon: History },
  { href: "/analytics", label: "\u0622\u0646\u0627\u0644\u06CC\u062A\u06CC\u06A9\u0633",     icon: BarChart3 },
  { href: "/flashcards",label: "\u0641\u0644\u0634\u200C\u06A9\u0627\u0631\u062A\u200C\u0647\u0627",  icon: CreditCard },
  { href: "/notebooks", label: "\u062C\u0632\u0648\u0647\u200C\u0647\u0627",       icon: BookOpen },
  { href: "/import",    label: "\u0627\u06CC\u0645\u067E\u0648\u0631\u062A",        icon: FileDown },
  { href: "/settings",  label: "\u062A\u0646\u0638\u06CC\u0645\u0627\u062A",        icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useAppStore();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 right-0 z-40 flex flex-col border-l border-white/10 bg-black/60 backdrop-blur-xl transition-all duration-300",
        sidebarOpen ? "w-56" : "w-16"
      )}
    >
      {/* Brand */}
      <div className="flex h-14 items-center justify-center border-b border-white/10 px-3">
        <Link href="/" className="text-lg font-black tracking-tight text-white">
          {sidebarOpen ? "URO-OMEGA" : "U"}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={active ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 transition-colors",
                  active
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {sidebarOpen && <span className="truncate">{item.label}</span>}
              </Button>
            </Link>
          );
        })}
      </nav>

      {/* Toggle */}
      <div className="border-t border-white/10 p-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="w-full text-zinc-400 hover:text-white"
        >
          {sidebarOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}

// IMPORTANT: both named AND default export so any import style works
export default Sidebar;