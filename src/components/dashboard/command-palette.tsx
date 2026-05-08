"use client"

import { useEffect } from "react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import {
  Brain,
  Target,
  BookOpen,
  NotebookPen,
  Plus,
  Settings,
  CalendarDays,
} from "lucide-react"

export function CommandPalette({
  open,
  onOpenChange,
  onAction,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAction?: (id: string) => void
}) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [open, onOpenChange])

  const run = (id: string) => {
    onAction?.(id)
    onOpenChange(false)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="چه کاری انجام دهیم؟ جست‌وجو، اقدام، یا مسیر مطالعه..." />
      <CommandList>
        <CommandEmpty>نتیجه‌ای یافت نشد.</CommandEmpty>

        <CommandGroup heading="اقدامات سریع">
          <CommandItem onSelect={() => run("start-study")}>
            <Brain size={14} />
            <span>شروع جلسه FSRS</span>
            <CommandShortcut className="ltr">⌘ S</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run("mcq-block")}>
            <Target size={14} />
            <span>شروع بلاک MCQ</span>
            <CommandShortcut className="ltr">⌘ M</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run("new-note")}>
            <Plus size={14} />
            <span>یادداشت جدید</span>
            <CommandShortcut className="ltr">⌘ N</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="ناوبری">
          <CommandItem onSelect={() => run("library")}>
            <BookOpen size={14} />
            <span>کتابخانه Campbell-Walsh-Wein</span>
          </CommandItem>
          <CommandItem onSelect={() => run("notes")}>
            <NotebookPen size={14} />
            <span>یادداشت‌های بالینی</span>
          </CommandItem>
          <CommandItem onSelect={() => run("schedule")}>
            <CalendarDays size={14} />
            <span>تقویم مطالعه</span>
          </CommandItem>
          <CommandItem onSelect={() => run("settings")}>
            <Settings size={14} />
            <span>تنظیمات</span>
          </CommandItem>
        </CommandGroup>

      </CommandList>
    </CommandDialog>
  )
}
