"use client"

import { useState } from "react"
import { Sparkles, Send, Mic, Image as ImageIcon, Hash } from "lucide-react"
import { cn } from "@/lib/utils"

const SUGGESTIONS = [
  "خلاصه TNM RCC را بساز",
  "تفاوت α-blocker و 5-ARI",
  "۵ MCQ از Bladder Ca بپرس",
  "فلش‌کارت از این یادداشت بساز",
]

export function AiCapture() {
  const [value, setValue] = useState("")

  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-primary/5 via-card to-card p-4 flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-5 w-5 items-center justify-center rounded-md bg-primary/15">
              <Sparkles size={11} className="text-primary" />
            </span>
            <p className="text-[13px] font-semibold tracking-tight">دستیار URO-AI</p>
            <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium">
              آنلاین
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            مبتنی بر CWW · فلش‌کارت/MCQ تولید می‌کند
          </p>
        </div>
      </div>

      {/* Composer */}
      <div className="rounded-xl border border-border bg-background p-2.5 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15 transition">
        <textarea
          rows={3}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="یک سؤال بپرس، یا یادداشت سریع بنویس… با #فصل به فصل لینک کن"
          className="w-full resize-none bg-transparent text-[12px] leading-relaxed outline-none placeholder:text-muted-foreground/70"
        />
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-0.5 text-muted-foreground">
            <button
              aria-label="افزودن تصویر"
              className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center transition"
            >
              <ImageIcon size={13} />
            </button>
            <button
              aria-label="ضبط صدا"
              className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center transition"
            >
              <Mic size={13} />
            </button>
            <button
              aria-label="افزودن تگ"
              className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center transition"
            >
              <Hash size={13} />
            </button>
          </div>
          <button
            disabled={!value.trim()}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition",
              value.trim()
                ? "bg-primary text-primary-foreground hover:opacity-95"
                : "bg-muted text-muted-foreground cursor-not-allowed",
            )}
          >
            ارسال
            <Send size={11} />
          </button>
        </div>
      </div>

      {/* Quick suggestions */}
      <div className="mt-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
          پیشنهاد
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setValue(s)}
              className="text-[10.5px] px-2 py-1 rounded-md border border-border bg-background hover:bg-muted hover:border-foreground/20 transition"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
