"use client"

import { useState } from "react"
import {
  BookOpen,
  Brain,
  CalendarDays,
  ChevronLeft,
  LayoutDashboard,
  NotebookPen,
  Plus,
  Settings,
  Stethoscope,
  Target,
  Trophy,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { toPersianDigits } from "./utils"
import type { SidebarChapter, SidebarCounts } from "./types"

interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  badgeKey?: keyof SidebarCounts
  badgeTone?: "primary" | "amber" | "emerald" | "muted"
}

const PRIMARY_NAV: NavItem[] = [
  { id: "dashboard", label: "داشبورد", icon: LayoutDashboard },
  { id: "study", label: "مطالعه FSRS", icon: Brain, badgeKey: "due", badgeTone: "amber" },
  { id: "mcq", label: "بانک MCQ", icon: Target, badgeKey: "qbank", badgeTone: "muted" },
  { id: "library", label: "کتابخانه CWW", icon: BookOpen },
  { id: "notes", label: "یادداشت ها", icon: NotebookPen, badgeKey: "notes", badgeTone: "muted" },
]

const SECONDARY_NAV: NavItem[] = [
  { id: "schedule", label: "تقویم مطالعه", icon: CalendarDays, badgeKey: "planner", badgeTone: "emerald" },
  { id: "leaderboard", label: "تاریخچه", icon: Trophy },
  { id: "settings", label: "تنظیمات", icon: Settings },
]

function badgeClass(tone: NavItem["badgeTone"]) {
  switch (tone) {
    case "primary":
      return "bg-primary text-primary-foreground"
    case "amber":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300"
    case "emerald":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function Badge({
  item,
  counts,
}: {
  item: NavItem
  counts: SidebarCounts
}) {
  if (!item.badgeKey) return null

  const value = counts[item.badgeKey]
  if (!value) return null

  return (
    <span
      className={cn(
        "text-[9.5px] px-1.5 py-0.5 rounded font-medium ltr min-w-[20px] text-center",
        badgeClass(item.badgeTone),
      )}
    >
      {toPersianDigits(value)}
    </span>
  )
}

export function AppSidebar({
  active = "dashboard",
  counts = { due: 0, qbank: 0, notes: 0, planner: 0 },
  chapters = [],
  onNavigate,
}: {
  active?: string
  counts?: SidebarCounts
  chapters?: SidebarChapter[]
  onNavigate?: (id: string) => void
}) {
  const [chaptersOpen, setChaptersOpen] = useState(true)

  return (
    <aside
      className="hidden lg:flex flex-col w-64 shrink-0 border-l border-sidebar-border bg-sidebar text-sidebar-foreground"
      aria-label="ناوبری اصلی"
    >
      <div className="px-4 py-4 border-b border-sidebar-border flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
          <Stethoscope size={18} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="text-sm font-semibold tracking-tight leading-none">URO-ZERO</h1>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium ltr">
              live
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 leading-none truncate">
            Local-first mission control
          </p>
        </div>
      </div>

      <div className="px-3 pt-3">
        <button
          onClick={() => onNavigate?.("new-note")}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition shadow-sm"
          aria-label="ایجاد سریع"
        >
          <span className="flex items-center gap-2 text-[12px] font-medium">
            <Plus size={14} />
            ایجاد سریع
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary-foreground/15 ltr">
            note
          </span>
        </button>
      </div>

      <nav className="px-2 pt-3 flex-1 overflow-y-auto scrollbar-thin">
        <p className="px-3 mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          اصلی
        </p>
        <ul className="space-y-0.5">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon
            const isActive = active === item.id
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate?.(item.id)}
                  className={cn(
                    "w-full group flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12.5px] transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon
                    size={15}
                    className={cn(
                      "shrink-0",
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                    )}
                  />
                  <span className="flex-1 text-right truncate">{item.label}</span>
                  <Badge item={item} counts={counts} />
                </button>
              </li>
            )
          })}
        </ul>

        <div className="mt-5">
          <button
            onClick={() => setChaptersOpen((open) => !open)}
            className="w-full flex items-center gap-1.5 px-3 mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition"
          >
            <ChevronLeft
              size={11}
              className={cn("transition-transform", chaptersOpen && "-rotate-90")}
            />
            فصل ها
          </button>
          {chaptersOpen && (
            <ul className="space-y-0.5">
              {chapters.length === 0 ? (
                <li className="px-3 py-2 text-[11px] text-muted-foreground">
                  داده فصل ها هنوز ثبت نشده است.
                </li>
              ) : (
                chapters.map((chapter) => (
                  <li key={chapter.id}>
                    <button
                      onClick={() => onNavigate?.("library")}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition"
                    >
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", chapter.color)} />
                      <span className="flex-1 text-right truncate">{chapter.fa}</span>
                      {chapter.count !== undefined && chapter.count > 0 && (
                        <span className="text-[10px] text-muted-foreground tnum ltr">
                          {toPersianDigits(chapter.count)}
                        </span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        <div className="mt-5 pb-2">
          <p className="px-3 mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            ابزارها
          </p>
          <ul className="space-y-0.5">
            {SECONDARY_NAV.map((item) => {
              const Icon = item.icon
              const isActive = active === item.id
              return (
                <li key={item.id}>
                  <button
                    onClick={() => onNavigate?.(item.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12.5px] transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                    )}
                  >
                    <Icon size={15} className="text-muted-foreground shrink-0" />
                    <span className="flex-1 text-right truncate">{item.label}</span>
                    <Badge item={item} counts={counts} />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </nav>

    </aside>
  )
}
