'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useDashboardData } from '@/lib/dashboard/useDashboardData'

import { StudyCockpitPanels } from './study-cockpit-panels'
import { StudyCockpitShell, type CRDTConflict } from './study-cockpit-shell'
import type {
  ChapterKnowledgeInput,
  McqKnowledgeInput,
  FlashcardKnowledgeInput,
  ReaderKnowledgeInput,
} from '@/components/dashboard/knowledge-sphere'

type ReviewCard = {
  id: string
  frontHtml: string
  chapterNo: number | null
  chapterTitle: string | null
  dueAt: number | null
  intervalDays: number
  isLeech: boolean
  /** Real FSRS retrievability probability (0–1). Null for new/unreviewed cards. */
  retrievability: number | null
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

function toTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value instanceof Date) return value.getTime()

  const text = String(value ?? '').trim()
  if (!text) return Date.now()

  const numeric = Number(text)
  if (Number.isFinite(numeric) && numeric > 0) return numeric

  const parsed = Date.parse(text)
  return Number.isFinite(parsed) ? parsed : Date.now()
}

function formatRelativeLabel(value: unknown): string {
  const ts = toTimestamp(value)
  const minutes = Math.max(0, Math.floor((Date.now() - ts) / 60_000))
  if (minutes < 1) return 'لحظاتی پیش'
  if (minutes < 60) return `${minutes} دقیقه پیش`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ساعت پیش`
  return `${Math.floor(hours / 24)} روز پیش`
}


function extractChapterNo(...values: Array<string | number | null | undefined>): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return Math.floor(value)
    }

    const text = String(value ?? '').trim()
    if (!text) continue

    const plain = Number(text)
    if (Number.isFinite(plain) && plain > 0) {
      return Math.floor(plain)
    }

    const tagged = text.match(/(?:^|[^a-z0-9])ch(?:apter)?[-_\s]*0*(\d{1,3})(?:\D|$)/i)
    if (tagged) return Number(tagged[1])

    const trailing = text.match(/(?:^|[-_\s])0*(\d{1,3})(?:\D*)$/)
    if (trailing) return Number(trailing[1])
  }

  return null
}

function chapterFilterValue(value: string | number | null | undefined): string | null {
  const chapterNo = extractChapterNo(value)
  if (chapterNo != null) return `ch-${chapterNo}`

  const text = String(value ?? '').trim()
  return text ? text : null
}

function buildHref(path: string, params?: Record<string, string | null | undefined>) {
  const query = new URLSearchParams()
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value) query.set(key, value)
  })
  const qs = query.toString()
  return qs ? `${path}?${qs}` : path
}

function readerHrefForChapter(value: string | number | null | undefined): string {
  const chapterNo = extractChapterNo(value)
  return chapterNo != null ? `/library/campbell/chapter/${chapterNo}` : '/library'
}

function qbankHrefForChapter(value: string | number | null | undefined): string {
  return buildHref('/qbank', { chapter: chapterFilterValue(value) })
}


function dueInLabel(dueAt: number | null): string {
  if (!dueAt) return 'سررسید'

  const now = Date.now()
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  if (dueAt < startOfToday.getTime()) return 'سررسید'
  if (dueAt <= startOfToday.getTime() + 86_400_000 - 1) return 'امروز'

  const days = Math.max(1, Math.ceil((dueAt - now) / 86_400_000))
  if (days < 7) return `${days} روز`
  return `${Math.ceil(days / 7)} هفته`
}

function buildHeatmapDays(
  monthly: Array<{ date: string; questionsAnswered: number; cardsReviewed: number; minutesStudied: number }>,
  weekly: Array<{ day: string; count: number }>,
) {
  const byDate = new Map<string, number>()

  for (const item of monthly) {
    byDate.set(
      item.date,
      (byDate.get(item.date) ?? 0)
        + item.questionsAnswered
        + item.cardsReviewed
        + Math.round(item.minutesStudied / 20),
    )
  }

  for (const item of weekly) {
    byDate.set(item.day, (byDate.get(item.day) ?? 0) + item.count)
  }

  const today = new Date()
  today.setHours(12, 0, 0, 0)

  return Array.from({ length: 35 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (34 - index))

    const iso = date.toISOString().slice(0, 10)
    const rawCount = byDate.get(iso) ?? 0

    return {
      date: iso,
      count: Math.max(0, Math.min(7, rawCount)),
    }
  })
}

export default function DashboardClient() {
  const router = useRouter()
  const dashboard = useDashboardData()

  const [reviewCards, setReviewCards] = useState<ReviewCard[]>([])
  const [storage, setStorage] = useState({ used: 0, total: 128 })
  const [pendingOps, setPendingOps] = useState<CRDTConflict[]>([])

  useEffect(() => {
    let cancelled = false

    fetch('/api/flashcards/review?limit=4', { cache: 'no-store' })
      .then((response) => response.json().catch(() => null))
      .then((json) => {
        if (cancelled) return
        if (Array.isArray(json?.cards)) {
          setReviewCards(json.cards)
          console.info('[Dashboard] flashcard fetch ok, cards:', json.cards.length)
        } else {
          console.info('[Dashboard] flashcard fetch returned no cards array')
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setReviewCards([])
          console.error('[Dashboard] flashcard fetch failed:', err instanceof Error ? err.message : err)
        }
      })

    return () => {
      cancelled = true
    }
  }, [dashboard.dueToday])

  useEffect(() => {
    try {
      const isStandalone =
        (typeof window !== 'undefined' && (window.navigator as { standalone?: boolean }).standalone === true) ||
        (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches)

      const hasSwController =
        typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller

      console.info('[Dashboard] boot', {
        isStandalonePWA: isStandalone,
        serviceWorkerActive: hasSwController,
      })
    } catch {
      // diagnostics must never crash the app
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    try {
      if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
        return
      }

      navigator.storage.estimate()
        .then((estimate) => {
          if (!cancelled && estimate) {
            const used = Math.round(((estimate.usage ?? 0) / 1024 / 1024) * 10) / 10
            const total = Math.max(1, Math.round(((estimate.quota ?? 134_217_728) / 1024 / 1024) * 10) / 10)
            setStorage({ used, total })
          }
        })
        .catch(() => {})
    } catch {
      // navigator.storage unavailable in this context
    }

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function fetchPendingOps() {
      try {
        // This is a placeholder. The actual implementation would fetch
        // real CRDT conflicts from the local-first outbox.
        // For example:
        // const { listUnsyncedCRDTs } = await import('@/lib/local-first/outbox-queries-for-ui');
        // if (!cancelled) setPendingOps(await listUnsyncedCRDTs());
      } catch {
        if (!cancelled) setPendingOps([]);
      }
    }
    void fetchPendingOps();
    return () => {
      cancelled = true;
    }
  }, [])

  const qbankStats = dashboard.serverStats.qbankStats
  const fsrsStats = dashboard.fsrsStats
  const plannerStats = dashboard.plannerDetailedStats
  const plannerAvailable = dashboard.serverStats.plannerStats.available === true
  const plannerKpiValueText = plannerAvailable ? null : "داده پلنر موجود نیست"
  const studyStreakDays = plannerAvailable
    ? (plannerStats?.studyStreak ?? dashboard.streak)
    : dashboard.streak
  const targetChapterNo = useMemo(
    () =>
      extractChapterNo(
        dashboard.serverStats.detailedWeakAreas[0]?.key,
        dashboard.serverStats.chapterPerformance[0]?.chapterId,
        dashboard.serverStats.chapterPerformance[0]?.chapterTitle,
      ),
    [dashboard.serverStats.chapterPerformance, dashboard.serverStats.detailedWeakAreas],
  )

  const sphereChapters = useMemo<ChapterKnowledgeInput[]>(
    () =>
      dashboard.serverStats.chapterPerformance
        .filter((item) => item.chapterId)
        .map((item, index) => ({
          chapterId: item.chapterId,
          titleFa: item.chapterTitle || `Chapter ${item.chapterId}`,
          titleEn: item.chapterTitle ?? undefined,
          order: extractChapterNo(item.chapterId, item.chapterTitle) ?? index + 1,
        })),
    [dashboard.serverStats.chapterPerformance],
  )

  const sphereMcqStats = useMemo<McqKnowledgeInput[]>(
    () =>
      dashboard.serverStats.chapterPerformance
        .filter((item) => item.chapterId && item.total > 0)
        .map((item) => ({
          chapterId: item.chapterId,
          total: item.total,
          correct: item.correct,
          wrong: Math.max(0, item.total - item.correct),
        })),
    [dashboard.serverStats.chapterPerformance],
  )

  const sphereFlashcardStats = useMemo<FlashcardKnowledgeInput[]>(
    () =>
      (dashboard.serverStats.fsrsStatsByChapter ?? [])
        .filter((item) => !!item.chapterId)
        .map((item) => ({
          chapterId: item.chapterId,
          total: item.totalCards,
          due: item.dueCards,
          reviewed: item.reviewedCards,
          retention: item.avgRetention ?? null,
          lastReviewedAt: item.lastReviewedAt ?? null,
        })),
    [dashboard.serverStats.fsrsStatsByChapter],
  )
  const sphereReaderStats = useMemo<ReaderKnowledgeInput[]>(
    () =>
      (dashboard.serverStats.readerStatsByChapter ?? [])
        .filter((item) => !!item.chapterId)
        .map((item) => ({
          chapterId: item.chapterId,
          // We only have percentage coverage here, not frame totals/counts.
          // Keep counts honest instead of fabricating a frame denominator.
          totalFrames: 0,
          openedFrames: 0,
          lastOpenedAt: item.lastReadAt ?? null,
        })),
    [dashboard.serverStats.readerStatsByChapter],
  )

  const mcqThisWeek = useMemo(
    () => dashboard.serverStats.weeklyActivity.reduce((sum, item) => sum + item.count, 0),
    [dashboard.serverStats.weeklyActivity],
  )

  const focusTopic = useMemo(
    () =>
      dashboard.serverStats.detailedWeakAreas[0]?.label
      || dashboard.serverStats.strengthsAndWeaknesses.weaknesses[0]?.key
      || 'مرور کارت‌های سررسید',
    [dashboard.serverStats.detailedWeakAreas, dashboard.serverStats.strengthsAndWeaknesses.weaknesses],
  )

  const fsrsQueue = useMemo(() => {
    if (reviewCards.length > 0) {
      return reviewCards.map((card) => {
        const chapterNo = extractChapterNo(card.chapterNo, card.chapterTitle)

        const rawR = card.retrievability
        const hasRetentionData = rawR !== null && Number.isFinite(rawR)
        const retentionPercent = hasRetentionData
          ? Math.max(0, Math.min(100, Math.round((rawR as number) * 100)))
          : null

        return {
          id: card.id,
          topic: stripHtml(card.frontHtml) || 'Flashcard',
          chapter: card.chapterTitle ?? (chapterNo != null ? `فصل ${chapterNo}` : 'عمومی'),
          dueLabel: dueInLabel(card.dueAt),
          retention: retentionPercent,
          hasRetentionData,
          yield: null,
          hasYieldData: false,
          isOverdue: !!card.dueAt && card.dueAt < Date.now(),
          href: buildHref('/flashcards/review', { chapter: chapterNo != null ? String(chapterNo) : null }),
        }
      })
    }

    if (!fsrsStats || dashboard.dueToday === 0) {
      return []
    }

    const rate = fsrsStats.retentionRate
    const hasRate = Number.isFinite(rate) && rate > 0
    return [
      {
        id: 'fsrs-summary',
        topic: 'Due FSRS Queue',
        chapter: 'همه فصل‌ها',
        dueLabel: fsrsStats.overdue > 0 ? 'سررسید' : 'امروز',
        retention: hasRate ? Math.max(0, Math.min(100, Math.round(rate))) : null,
        hasRetentionData: hasRate,
        yield: null,
        hasYieldData: false,
        isOverdue: fsrsStats.overdue > 0,
        href: '/flashcards/review',
      },
    ]
  }, [dashboard.dueToday, fsrsStats, reviewCards])

  const chapterStats = useMemo(() => {
    const rows = dashboard.serverStats.chapterPerformance
      .slice(0, 4)
      .map((item) => ({
        chapter: item.chapterTitle || item.chapterId,
        accuracy: Math.max(0, Math.min(100, Math.round(item.accuracy))),
        href: qbankHrefForChapter(item.chapterId),
        readerHref: readerHrefForChapter(item.chapterId),
      }))

    if (rows.length > 0) {
      return rows
    }

    if (qbankStats.totalAttempts > 0) {
      return [{ chapter: 'همه بانک سوال', accuracy: Math.round(qbankStats.accuracy), href: '/qbank', readerHref: '/library' }]
    }

    return []
  }, [dashboard.serverStats.chapterPerformance, qbankStats])

  const heatmapDays = useMemo(
    () => buildHeatmapDays(dashboard.monthlyActivity, dashboard.serverStats.weeklyActivity),
    [dashboard.monthlyActivity, dashboard.serverStats.weeklyActivity],
  )

  const activityFeed = useMemo(
    () =>
      dashboard.serverStats.activityFeed.slice(0, 6).map((item) => ({
        id: item.id,
        type: item.type,
        timeAgo: formatRelativeLabel(item.timestamp),
        action: [item.entityLabel, item.detail].filter(Boolean).join(' '),
        detail: item.delta,
        href:
          item.type === 'card_review'
            ? buildHref('/flashcards/review', {
                chapter: chapterFilterValue(extractChapterNo(item.entityLabel)),
              })
            : item.type === 'mcq_block'
              ? '/history'
              : item.type === 'chapter_read'
                ? readerHrefForChapter(item.entityLabel)
                : undefined,
        disabledReason:
          item.type === 'card_review' || item.type === 'mcq_block' || item.type === 'chapter_read'
            ? undefined
            : 'مسیر قابل اتکا برای این رویداد هنوز در دسترس نیست.',
      })),
    [dashboard.serverStats.activityFeed],
  )

  const syncState: 'syncing' | 'offline' | 'synced' = dashboard.loading
    ? 'syncing'
    : (() => {
        try {
          return typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'synced'
        } catch {
          return 'synced'
        }
      })()

  const storagePercent = Math.round((storage.used / Math.max(storage.total, 1)) * 100)
  const daysUntilBoard = plannerAvailable ? (plannerStats?.daysToExam ?? 0) : 0
  const weekNumber = daysUntilBoard > 0 ? Math.max(1, 24 - Math.ceil(daysUntilBoard / 7)) : 1

  const handleNavChange = (id: string) => {
    const routeMap: Record<string, string> = {
      dashboard: '/dashboard',
      dueCards: '/flashcards/review',
      flashcard: dashboard.dueToday > 0 ? '/flashcards/review' : '/flashcards',
      mcq: '/qbank',
      library: '/library',
      analytics: '/history',
      'srs-stats': '/flashcards/stats',
      planner: '/planner',
      history: '/history',
      settings: '/settings',
      examBuilder: buildHref('/exam/builder', { chapter: targetChapterNo != null ? `ch-${targetChapterNo}` : null }),
    }

    const href = routeMap[id]
    if (href) {
      router.push(href)
    }
  }

  return (
    <StudyCockpitShell
      syncState={syncState}
      lastSyncLabel={dashboard.loading ? 'در حال همگام‌سازی' : 'لحظاتی پیش'}
      pendingCrdtOps={pendingOps}
      storageUsedMB={storage.used}
      storagePercent={storagePercent}
      isOpfsHydrating={dashboard.loading}
      dueCardsCount={dashboard.dueToday}
      mcqThisWeek={mcqThisWeek}
      overallAccuracy={Math.round(qbankStats.accuracy || 0)}
      studyStreakDays={studyStreakDays}
      plannerKpiValueText={plannerKpiValueText}
      weekNumber={weekNumber}
      totalWeeks={24}
      daysUntilBoard={daysUntilBoard}
      focusTopic={focusTopic}
      fsrsStatsByChapter={dashboard.serverStats.fsrsStatsByChapter}
      onNavChange={handleNavChange}
      onOpenSettings={() => router.push('/settings')}
      onStartStudy={() => {
        if (dashboard.dueToday > 0) {
          router.push('/flashcards/review')
          return
        }
        if (targetChapterNo != null) {
          router.push(`/library/campbell/chapter/${targetChapterNo}`)
          return
        }
        router.push('/library')
      }}
      onCreateMCQ={() =>
        router.push(
          buildHref('/exam/builder', { chapter: targetChapterNo != null ? `ch-${targetChapterNo}` : null }),
        )
      }
    >
      <StudyCockpitPanels
        sphereChapters={sphereChapters}
        sphereMcqStats={sphereMcqStats}
        sphereFlashcardStats={sphereFlashcardStats}
        sphereReaderStats={sphereReaderStats}
        fsrsQueue={fsrsQueue}
        chapterStats={chapterStats}
        heatmapDays={heatmapDays}
        activityFeed={activityFeed}
        onStartReview={() => router.push('/flashcards/review')}
      />
    </StudyCockpitShell>
  )
}
