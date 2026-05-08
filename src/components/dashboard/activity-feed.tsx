"use client"

import { useMemo, useState } from "react"
import {
  CreditCard,
  FileText,
  Sparkles,
  Target,
  Upload,
  ChevronLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ActivityItem } from "./types"

const TYPE_CFG: Record<
  ActivityItem["type"],
  { icon: React.ComponentType<{ size?: number; className?: string }>; tone: string; bg: string }
> = {
  mcq: {
    icon: Target,
    tone: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  fsrs: {
    icon: CreditCard,
    tone: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
  },
  note: {
    icon: FileText,
    tone: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-500/10",
  },
  sync: {
    icon: Upload,
    tone: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-500/10",
  },
  ai: {
    icon: Sparkles,
    tone: "text-primary",
    bg: "bg-primary/10",
  },
}

const FILTERS = [
  { id: "all", label: "همه" },
  { id: "mcq", label: "MCQ" },
  { id: "fsrs", label: "FSRS" },
  { id: "note", label: "یادداشت" },
] as const

const GROUP_LABEL: Record<ActivityItem["group"], string> = {
  today: "امروز",
  yesterday: "دیروز",
  earlier: "قبل‌تر",
}

export function ActivityFeed({
  items,
  onOpenAll,
}: {
  items: ActivityItem[]
  onOpenAll?: () => void
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all")

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.type === filter)),
    [items, filter],
  )

  const grouped = useMemo(() => {
    const map: Record<ActivityItem["group"], ActivityItem[]> = {
      today: [],
      yesterday: [],
      earlier: [],
    }
    filtered.forEach((i) => map[i.group].push(i))
    return map
  }, [filtered])

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col">
      <div className="flex items-start justify-between mb-3 gap-2">
        <div>
          <p className="text-[13px] font-semibold tracking-tight">فعالیت اخیر</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            تمام جلسات مطالعه، MCQ و تغییرات local-first
          </p>
        </div>
        <button
          onClick={onOpenAll}
          className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
        >
          همه
          <ChevronLeft size={11} />
        </button>
      </div>

      <div className="flex items-center gap-1 rounded-lg bg-muted/60 p-0.5 self-start mb-3">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "px-2.5 py-1 rounded-md text-[10.5px] font-medium transition",
              filter === f.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 flex-1">
        {(["today", "yesterday", "earlier"] as const).map((g) => {
          const list = grouped[g]
          if (list.length === 0) return null
          return (
            <div key={g}>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                {GROUP_LABEL[g]}
              </p>
              <ul className="space-y-2">
                {list.map((act) => {
                  const cfg = TYPE_CFG[act.type]
                  const Icon = cfg.icon
                  return (
                    <li key={act.id} className="flex items-start gap-2.5 group">
                      <span
                        className={cn(
                          "shrink-0 w-7 h-7 rounded-md flex items-center justify-center",
                          cfg.bg,
                          cfg.tone,
                        )}
                      >
                        <Icon size={13} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11.5px] leading-snug">{act.text}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground">
                          <span>{act.timeAgo}</span>
                          {act.meta && (
                            <>
                              <span className="opacity-50">·</span>
                              <span className="tnum">{act.meta}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="text-center text-[11px] text-muted-foreground py-8">
            فعالیتی برای این فیلتر یافت نشد.
          </div>
        )}
      </div>
    </div>
  )
}
