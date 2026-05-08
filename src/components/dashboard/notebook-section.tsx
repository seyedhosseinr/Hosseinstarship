"use client"

import { Pin, Plus, NotebookPen, ChevronLeft } from "lucide-react"
import type { NotebookItem } from "./types"

export function NotebookSection({
  notes,
  onCreateNote,
  onOpenAll,
  onOpenNote,
}: {
  notes: NotebookItem[]
  onCreateNote?: () => void
  onOpenAll?: () => void
  onOpenNote?: (id: string) => void
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <NotebookPen size={14} className="text-violet-600 dark:text-violet-400" />
            <p className="text-[13px] font-semibold tracking-tight">یادداشت‌های بالینی</p>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            مرتب بر اساس آخرین ویرایش · با AI لینک شده
          </p>
        </div>
        <button
          onClick={onCreateNote}
          aria-label="یادداشت جدید"
          className="w-7 h-7 rounded-md border border-border hover:bg-muted flex items-center justify-center transition text-muted-foreground hover:text-foreground"
        >
          <Plus size={13} />
        </button>
      </div>

      <ul className="flex flex-col gap-2 flex-1">
        {notes.length === 0 ? (
          <li className="rounded-lg border border-dashed border-border p-8 text-center text-[11px] text-muted-foreground">
            یادداشت واقعی برای نمایش در داشبورد وجود ندارد.
          </li>
        ) : notes.map((n) => (
          <li key={n.id}>
            <button
              onClick={() => onOpenNote?.(n.id)}
              className="w-full text-right group p-3 rounded-lg border border-border hover:border-foreground/20 hover:bg-muted/40 transition-all"
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {n.pinned && (
                      <Pin size={10} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    )}
                    <p className="text-[12px] font-medium truncate group-hover:text-primary transition">
                      {n.title}
                    </p>
                  </div>
                  <p className="text-[10.5px] text-muted-foreground mt-1 leading-snug line-clamp-2 ltr text-left">
                    {n.excerpt}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-[9.5px] text-muted-foreground">
                    <span className="px-1.5 py-0.5 rounded bg-muted ltr">{n.chapterFa}</span>
                    <span>·</span>
                    <span>{n.updatedFa}</span>
                  </div>
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>

      <button
        onClick={onOpenAll}
        className="mt-3 text-[11px] text-primary hover:underline font-medium flex items-center gap-0.5 self-start"
      >
        همه یادداشت‌ها
        <ChevronLeft size={11} />
      </button>
    </div>
  )
}
