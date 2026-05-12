'use client'

import { useMemo } from 'react'
import { BookOpen, Check, Play } from 'lucide-react'
import {
  KnowledgeSphere,
  buildKnowledgeSphereData,
} from '@/components/dashboard/knowledge-sphere'
import type {
  ChapterKnowledgeInput,
  McqKnowledgeInput,
  FlashcardKnowledgeInput,
  ReaderKnowledgeInput,
} from '@/components/dashboard/knowledge-sphere'

interface FSRSCard {
  id: string
  topic: string
  chapter: string
  dueLabel: string
  retention: number
  yield: number
  isOverdue: boolean
  href?: string
}

interface ChapterStat {
  chapter: string
  accuracy: number
  href?: string
  readerHref?: string
}

interface HeatmapDay {
  date: string
  count: number
}

interface ActivityItem {
  id: string
  type?: 'card_review' | 'mcq_block' | 'chapter_read' | string
  timeAgo: string
  action: string
  detail: string
  href?: string
  disabledReason?: string
}

interface StudyCockpitPanelsProps {
  sphereChapters: ChapterKnowledgeInput[]
  sphereMcqStats: McqKnowledgeInput[]
  sphereFlashcardStats: FlashcardKnowledgeInput[]
  sphereReaderStats: ReaderKnowledgeInput[]
  fsrsQueue: FSRSCard[]
  chapterStats: ChapterStat[]
  heatmapDays: HeatmapDay[]
  activityFeed: ActivityItem[]
  onStartReview?: () => void
}

const FALLBACK_PANEL_PROPS: Omit<StudyCockpitPanelsProps, 'onStartReview'> & {
  onStartReview?: () => void
} = {
  sphereChapters: [],
  sphereMcqStats: [],
  sphereFlashcardStats: [],
  sphereReaderStats: [],
  fsrsQueue: [],
  chapterStats: [],
  heatmapDays: [],
  activityFeed: [],
  onStartReview: undefined,
}


function extractChapterNo(value: string | number | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.floor(value)
  const text = String(value ?? '').trim()
  if (!text) return null
  const plain = Number(text)
  if (Number.isFinite(plain) && plain > 0) return Math.floor(plain)
  const tagged = text.match(/(?:^|[^a-z0-9])ch(?:apter)?[-_\s]*0*(\d{1,3})(?:\D|$)/i)
  if (tagged) return Number(tagged[1])
  const trailing = text.match(/(?:^|[-_\s])0*(\d{1,3})(?:\D*)$/)
  return trailing ? Number(trailing[1]) : null
}

function chapterFilterValue(chapterId: string | number | null | undefined): string | null {
  const chapterNo = extractChapterNo(chapterId)
  if (chapterNo != null) return `ch-${chapterNo}`
  const text = String(chapterId ?? '').trim()
  return text ? text : null
}

function hrefWithQuery(path: string, params: Record<string, string | null | undefined>) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value)
  })
  const qs = query.toString()
  return qs ? `${path}?${qs}` : path
}

function readerHref(chapterId: string | number | null | undefined) {
  const chapterNo = extractChapterNo(chapterId)
  return chapterNo != null ? `/library/campbell/chapter/${chapterNo}` : '/library'
}

function qbankHref(chapterId: string | number | null | undefined) {
  return hrefWithQuery('/qbank', { chapter: chapterFilterValue(chapterId) })
}

function YieldDots({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(5, value))

  return (
    <div className="flex gap-0.5" dir="ltr" aria-label={`بازده ${clamped} از 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          className={`h-2 w-2 rounded-full ${index < clamped ? 'bg-[var(--accent)]' : 'border border-[var(--text-muted)] bg-transparent'}`}
        />
      ))}
    </div>
  )
}

function DueChip({ label, isOverdue }: { label: string; isOverdue: boolean }) {
  const className = isOverdue
    ? 'bg-red-100 text-red-700'
    : label === 'امروز' || label === 'سررسید'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-[var(--ring-bg)] text-[var(--text-secondary)]'

  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${className}`}>{label}</span>
}

function FsrsQueuePanel({ cards, onStartReview }: { cards: FSRSCard[]; onStartReview?: () => void }) {
  const empty = cards.length === 0

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
      <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">صف مرور FSRS</h3>

      {empty ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ring-bg)]">
            <Check className="h-6 w-6 text-[var(--accent)]" />
          </div>
          <p className="text-sm text-[var(--text-muted)]">صف مرور فعلا خالی است.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {cards.map((card) => (
            <a key={card.id} href={card.href ?? '/flashcards/review'} className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-[var(--bg-card-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]">
              <YieldDots value={card.yield} />
              <div className="min-w-0 flex-1">
                <div dir="ltr" className="truncate text-sm text-[var(--text-primary)]">{card.topic}</div>
                <div className="text-xs text-[var(--text-muted)]">{card.chapter}</div>
              </div>
              <DueChip label={card.dueLabel} isOverdue={card.isOverdue} />
              <span dir="ltr" className="w-11 text-left text-sm font-mono text-[var(--text-secondary)]">{card.retention}%</span>
            </a>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onStartReview}
        className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        style={{ background: 'var(--accent)' }}
      >
        <Play className="h-4 w-4" />
        <span>{empty ? 'رفتن به فلش‌کارت‌ها' : 'شروع مرور'}</span>
      </button>
    </div>
  )
}

function McqChart({ stats }: { stats: ChapterStat[] }) {
  const sorted = [...stats].sort((a, b) => b.accuracy - a.accuracy)

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
      <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">عملکرد MCQ</h3>
      <div className="space-y-3">
        {sorted.length === 0 ? (
          <div className="text-sm text-[var(--text-muted)]">داده‌ای برای نمایش وجود ندارد.</div>
        ) : (
          sorted.map((item) => (
            <div key={item.chapter} className="group/mcq-item relative rounded-lg px-2 py-1 transition hover:bg-[var(--bg-card-hover)] focus-within:ring-2 focus-within:ring-[var(--accent)]">
              <div className="mb-1 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-xs text-[var(--text-secondary)]">{item.chapter}</span>
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/mcq-item:opacity-100">
                    <a href={item.href ?? '/qbank'} className="rounded-full p-1 hover:bg-[var(--ring-bg)]" title="شروع تست"><Play className="h-3 w-3" /></a>
                    {item.readerHref && (
                      <a href={item.readerHref} className="rounded-full p-1 hover:bg-[var(--ring-bg)]" title="مطالعه فصل"><BookOpen className="h-3 w-3" /></a>
                    )}
                  </div>
                </div>
                <a href={item.href ?? '/qbank'} className="block">
                  <span dir="ltr" className="font-mono text-xs text-[var(--text-primary)]">
                    {item.accuracy}%
                  </span>
                </a>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--ring-bg)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(0, Math.min(100, item.accuracy))}%`,
                    background: item.accuracy >= 70 ? 'var(--accent)' : 'var(--accent-red)',
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function StudyHeatmap({ days }: { days: HeatmapDay[] }) {
  const weeks = Array.from({ length: 5 }, (_, index) => days.slice(index * 7, (index + 1) * 7))
  const labels = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']

  const cellClass = (count: number) => {
    if (count === 0) return 'bg-[var(--ring-bg)]'
    if (count <= 2) return 'bg-teal-100'
    if (count <= 4) return 'bg-teal-300'
    return 'bg-teal-500'
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
      <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">نقشه فعالیت</h3>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {labels.map((label) => (
          <div key={label} className="flex min-h-[20px] items-center justify-center text-[10px] text-[var(--text-muted)]">
            {label}
          </div>
        ))}
      </div>
      {days.length === 0 ? (
        <div className="text-sm text-[var(--text-muted)]">فعالیتی برای نقشه ثبت نشده است.</div>
      ) : (
        <div className="space-y-1">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-1">
              {week.map((day, dayIndex) => (
                <a key={`${weekIndex}-${dayIndex}`} href="/history" className={`block min-h-[32px] rounded-md ${cellClass(day.count)} focus:outline-none focus:ring-2 focus:ring-[var(--accent)]`} title={`${day.date}: ${day.count}`} />
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-[var(--text-muted)]">
        <span>کم</span>
        <div className="h-3 w-3 rounded-sm bg-[var(--ring-bg)]" />
        <div className="h-3 w-3 rounded-sm bg-teal-100" />
        <div className="h-3 w-3 rounded-sm bg-teal-300" />
        <div className="h-3 w-3 rounded-sm bg-teal-500" />
        <span>زیاد</span>
      </div>
    </div>
  )
}

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
      <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">فعالیت اخیر</h3>
      <div className="space-y-0">
        {items.length === 0 ? (
          <div className="text-sm text-[var(--text-muted)]">فعالیتی ثبت نشده است.</div>
        ) : (
          items.map((item, index) => (
            <a
              key={item.id}
              href={item.disabledReason ? undefined : item.href ?? '/history'}
              aria-disabled={item.disabledReason ? "true" : undefined}
              className={`flex gap-3 rounded-lg py-2 transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${
                item.disabledReason ? 'cursor-not-allowed opacity-60' : 'hover:bg-[var(--bg-card-hover)]'
              }`}
              title={item.disabledReason}
            >
              <div className="flex flex-col items-center pr-2">
                <div className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                {index < items.length - 1 ? <div className="mt-1 w-0.5 flex-1 bg-[var(--accent)]" /> : null}
              </div>
              <div className="min-w-0 flex-1 pl-2">
                <div className="mb-0.5 text-xs text-[var(--text-muted)]">{item.timeAgo}</div>
                <div className="text-sm text-[var(--text-primary)]">{item.action}</div>
                <div dir="ltr" className="mt-0.5 text-xs font-mono text-[var(--text-secondary)]">{item.detail}</div>
                {item.disabledReason ? (
                  <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{item.disabledReason}</div>
                ) : null}
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  )
}

export function StudyCockpitPanels(props: Partial<StudyCockpitPanelsProps> = {}) {
  const {
    sphereChapters,
    sphereMcqStats,
    sphereFlashcardStats,
    sphereReaderStats,
    fsrsQueue,
    chapterStats,
    heatmapDays,
    activityFeed,
    onStartReview,
  } = { ...FALLBACK_PANEL_PROPS, ...props }

  const sphereData = useMemo(
    () =>
      buildKnowledgeSphereData({
        chapters: sphereChapters,
        mcqStats: sphereMcqStats,
        flashcardStats: sphereFlashcardStats,
        readerStats: sphereReaderStats,
        includeTopicNodes: false,
        includeUnknownNodes: true,
        routes: {
          openReader: (node) => readerHref(node.chapterId),
          startMcq: (node) => qbankHref(node.chapterId),
          reviewFlashcards: (node) => hrefWithQuery('/flashcards/review', { chapter: extractChapterNo(node.chapterId)?.toString() ?? chapterFilterValue(node.chapterId) }),
          reviewWrongMcqs: (node) => hrefWithQuery('/qbank', { chapter: chapterFilterValue(node.chapterId), mode: 'wrong' }),
        },
      }),
    [sphereChapters, sphereMcqStats, sphereFlashcardStats, sphereReaderStats],
  )

  return (
    <div className="space-y-4" dir="rtl">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FsrsQueuePanel cards={fsrsQueue} onStartReview={onStartReview} />
        <KnowledgeSphere data={sphereData} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <McqChart stats={chapterStats} />
        <StudyHeatmap days={heatmapDays} />
        <ActivityFeed items={activityFeed} />
      </div>
    </div>
  )
}

export default StudyCockpitPanels
