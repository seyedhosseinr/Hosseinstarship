"use client"

import { useEffect, useState } from "react"
import {
  AlertCircle,
  Bell,
  ChevronDown,
  Cloud,
  Command,
  Moon,
  RefreshCw,
  Search,
  Sun,
} from "lucide-react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"
import { SYNC_CONFIG } from "./utils"
import type { SyncStatus } from "./types"

function SyncBadge({ status }: { status: SyncStatus }) {
  const cfg = SYNC_CONFIG[status]
  const Icon =
    status === "synced"
      ? Cloud
      : status === "syncing"
        ? RefreshCw
        : status === "error"
          ? AlertCircle
          : Cloud

  return (
    <span
      className={cn(
        "hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium",
        cfg.bg,
        cfg.text,
      )}
    >
      <Icon size={12} className={status === "syncing" ? "animate-spin" : ""} />
      {cfg.label}
    </span>
  )
}

export function Topbar({
  onOpenCommand,
  syncStatus = "synced",
  onOpenHistory,
  onOpenSettings,
}: {
  onOpenCommand?: () => void
  syncStatus?: SyncStatus
  onOpenHistory?: () => void
  onOpenSettings?: () => void
}) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = mounted && (resolvedTheme ?? theme) === "dark"

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-background/80 border-b border-border">
      <div className="flex items-center gap-3 px-4 md:px-6 h-14">
        <button
          onClick={onOpenCommand}
          className="flex-1 max-w-xl flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/40 hover:bg-muted hover:border-foreground/20 transition text-right group"
          aria-label="جست وجو در URO-ZERO"
        >
          <Search size={14} className="text-muted-foreground shrink-0" />
          <span className="flex-1 text-[12px] text-muted-foreground truncate">
            جست وجو در فصل ها، کارت ها و یادداشت ها...
          </span>
          <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground ltr">
            <Command size={9} />K
          </kbd>
        </button>

        <div className="flex-1 hidden md:block" />

        <SyncBadge status={syncStatus} />

        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="w-9 h-9 rounded-lg border border-border hover:bg-muted flex items-center justify-center transition"
          aria-label="تغییر حالت روشن/تاریک"
        >
          {mounted ? isDark ? <Sun size={15} /> : <Moon size={15} /> : <Moon size={15} />}
        </button>

        <button
          onClick={onOpenHistory}
          className="relative w-9 h-9 rounded-lg border border-border hover:bg-muted flex items-center justify-center transition"
          aria-label="اعلان ها"
        >
          <Bell size={15} />
          <span className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-rose-500" />
        </button>

        <button
          onClick={onOpenSettings}
          className="hidden sm:flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg border border-border hover:bg-muted transition"
        >
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-primary to-sky-600 text-primary-foreground flex items-center justify-center text-[11px] font-semibold ltr">
            DR
          </div>
          <div className="text-right hidden lg:block">
            <p className="text-[11.5px] font-medium leading-none">Hossein Starship</p>
            <p className="text-[9.5px] text-muted-foreground mt-0.5 leading-none">
              Local-first active
            </p>
          </div>
          <ChevronDown size={12} className="text-muted-foreground" />
        </button>
      </div>
    </header>
  )
}
