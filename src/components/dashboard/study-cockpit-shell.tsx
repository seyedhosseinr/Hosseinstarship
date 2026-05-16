'use client'

import { type ReactNode, useEffect, useMemo, useState } from 'react'
import {
  Hexagon,
  Play,
  PlusCircle,
  RefreshCw,
  Settings,
  BookOpen,
  Brain,
  BarChart3,
} from 'lucide-react'

export interface CRDTConflict {
  id: string
  topic: string
  field: string
  localValue: string
  remoteValue: string
  autoResolved: boolean
}

type FsrsStatsByChapter = {
  chapterId: string
  totalCards: number
  avgRetention: number | null
}

export interface StudyCockpitShellProps {
  syncState: 'synced' | 'syncing' | 'offline'
  lastSyncLabel: string
  pendingCrdtOps: CRDTConflict[]
  storageUsedMB: number
  storagePercent: number
  isOpfsHydrating: boolean
  dueCardsCount: number
  mcqThisWeek: number
  overallAccuracy: number
  studyStreakDays: number
  /** When set, the study-streak KPI shows this text instead of a numeric streak (planner unavailable). */
  plannerKpiValueText?: string | null
  weekNumber: number
  totalWeeks: number
  daysUntilBoard: number
  focusTopic: string
  fsrsStatsByChapter: FsrsStatsByChapter[]
  onNavChange?: (id: string) => void
  onOpenSettings?: () => void
  onStartStudy?: () => void
  onCreateMCQ?: () => void
  children?: ReactNode
}

const FALLBACK_PROPS: Omit<StudyCockpitShellProps, 'children'> = {
  syncState: 'synced',
  lastSyncLabel: 'لحظاتی پیش',
  pendingCrdtOps: [],
  storageUsedMB: 0,
  storagePercent: 0,
  isOpfsHydrating: false,
  dueCardsCount: 0,
  mcqThisWeek: 0,
  overallAccuracy: 0,
  studyStreakDays: 0,
  plannerKpiValueText: null,
  weekNumber: 1,
  totalWeeks: 24,
  daysUntilBoard: 0,
  focusTopic: 'داده واقعی هنوز ثبت نشده',
  fsrsStatsByChapter: [],
  onNavChange: undefined,
  onOpenSettings: undefined,
  onStartStudy: undefined,
  onCreateMCQ: undefined,
}

function formatPersianDate() {
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date())
  } catch {
    try {
      return new Date().toLocaleDateString()
    } catch {
      return ''
    }
  }
}

function storageBarColor(percent: number) {
  if (percent > 95) return 'var(--accent-red)'
  if (percent > 80) return 'var(--accent-amber)'
  return 'var(--accent)'
}

function SyncStatusLabel({ syncState, lastSyncLabel }: { syncState: StudyCockpitShellProps['syncState']; lastSyncLabel: string }) {
  const label = syncState === 'offline'
    ? 'offline'
    : syncState === 'syncing'
      ? 'syncing...'
      : 'synced'

  return (
    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
      <RefreshCw className={`h-4 w-4 ${syncState === 'syncing' ? 'animate-spin' : ''}`} />
      <span>{label}</span>
      <span>{lastSyncLabel}</span>
    </div>
  )
}

function DecayCurvesSVG({
  best, mid, critical, hasRealData
}: {
  best: number; mid: number; critical: number; hasRealData: boolean
}) {
  const W = 240, H = 110
  const padL = 32, padB = 24, padT = 10, padR = 12
  const plotW = W - padL - padR
  const plotH = H - padB - padT

  const toX = (day: number) => padL + (day / 14) * plotW
  const toY = (ret: number) => padT + (1 - ret / 100) * plotH

  // Generate polyline points for R(t) = e^(-t/S) * 100
  const curve = (S: number) =>
    Array.from({ length: 29 }, (_, i) => {
      const t = (i / 28) * 14
      const r = Math.exp(-t / S) * 100
      return `${toX(t).toFixed(1)},${toY(Math.max(0, r)).toFixed(1)}`
    }).join(' ')

  const thresh70Y = toY(70)
  const todayX = toX(0)

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={W} height={H}
        viewBox={`0 0 ${W} ${H}`}
        aria-label="منحنی فراموشی FSRS"
        className="overflow-visible"
      >
        {[0, 25, 50, 75, 100].map(r => (
          <g key={r}>
            <line
              x1={padL} y1={toY(r)}
              x2={W - padR} y2={toY(r)}
              stroke="var(--border)" strokeWidth="0.5"
            />
            <text
              x={padL - 3} y={toY(r) + 3}
              fill="var(--text-muted)"
              fontSize="6"
              textAnchor="end"
              fontFamily="'JetBrains Mono', monospace"
            >{r}</text>
          </g>
        ))}

        {[0, 7, 14].map(d => (
          <text
            key={d}
            x={toX(d)} y={H - 6}
            fill="var(--text-muted)"
            fontSize="6"
            textAnchor="middle"
            fontFamily="'JetBrains Mono', monospace"
          >{d}d</text>
        ))}

        <rect
          x={padL} y={thresh70Y}
          width={plotW} height={padT + plotH - thresh70Y}
          fill="#B91C1C" opacity="0.05"
        />

        <line
          x1={padL} y1={thresh70Y}
          x2={W - padR} y2={thresh70Y}
          stroke="#B91C1C" strokeWidth="0.6"
          strokeDasharray="3 2"
        />
        <text
          x={W - padR + 2} y={thresh70Y + 3}
          fill="#B91C1C" fontSize="5"
          fontFamily="'JetBrains Mono', monospace"
        >70</text>

        <line
          x1={todayX} y1={padT}
          x2={todayX} y2={H - padB}
          stroke="var(--text-muted)"
          strokeWidth="0.8" strokeDasharray="3 2"
        />

        <polyline
          points={curve(critical)}
          fill="none" stroke="#B91C1C" strokeWidth="1.5"
          strokeLinecap="round"
        />
        <polyline
          points={curve(mid)}
          fill="none" stroke="var(--accent-amber)" strokeWidth="1.5"
          strokeLinecap="round"
        />
        <polyline
          points={curve(best)}
          fill="none" stroke="var(--accent)" strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>

      <div
        className="flex items-center gap-3 text-[10px]"
        style={{ color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}
      >
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-[2px] bg-[var(--accent)] rounded" />
          بهترین
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-3 h-[2px] rounded"
            style={{ background: 'var(--accent-amber)' }}
          />
          متوسط
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-[2px] bg-red-600 rounded" />
          بحرانی
        </span>
        {!hasRealData && (
          <span className="opacity-50">(نمونه)</span>
        )}
      </div>

      <div
        className="text-[9px] text-center"
        style={{ color: 'var(--text-muted)', fontFamily: 'Vazirmatn, sans-serif' }}
      >
        منحنی فراموشی ابینگهاوس · FSRS
      </div>
    </div>
  )
}


function KpiActionCard({
  label,
  value,
  valueText,
  suffix,
  color,
  onClick,
  hint,
}: {
  label: string
  value?: number
  valueText?: string | null
  suffix?: string
  color: string
  onClick?: () => void
  hint: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="animate-fade-slide-up group rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-right transition hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--bg-card-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="h-2 w-10 rounded-full" style={{ background: color }} />
        <span className="text-[10px] font-medium text-[var(--text-muted)] opacity-0 transition group-hover:opacity-100">
          باز کردن
        </span>
      </div>
      <div dir="auto" className="text-2xl font-bold text-[var(--text-primary)]">
        {valueText != null && valueText !== '' ? (
          <span className="block text-right text-[13px] font-semibold leading-snug text-[var(--text-secondary)]">
            {valueText}
          </span>
        ) : (
          <>
            {value ?? 0}
            {suffix ?? ''}
          </>
        )}
      </div>
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      <div className="mt-2 text-[11px] text-[var(--text-secondary)]">{hint}</div>
    </button>
  )
}

export function StudyCockpitShell(props: Partial<StudyCockpitShellProps> = {}) {
  const {
    syncState,
    lastSyncLabel,
    pendingCrdtOps,
    storageUsedMB,
    storagePercent,
    isOpfsHydrating,
    dueCardsCount,
    mcqThisWeek,
    overallAccuracy,
    studyStreakDays,
    plannerKpiValueText,
    weekNumber,
    totalWeeks,
    daysUntilBoard,
    focusTopic,
    fsrsStatsByChapter,
    onNavChange,
    onOpenSettings,
    onStartStudy,
    onCreateMCQ,
    children,
  } = { ...FALLBACK_PROPS, ...props }

  const [showPendingPanel, setShowPendingPanel] = useState(false)
  const [persianDate, setPersianDate] = useState('')

  useEffect(() => {
    setPersianDate(formatPersianDate())
  }, [])

  const pendingCount = pendingCrdtOps.filter((item) => !item.autoResolved).length
  const barColor = storageBarColor(storagePercent)

  // Derive stability S from avgRetention: R = e^(-1/S) -> S = -1/ln(R/100)
  // avgRetention is retention at t=1 day after review
  const curveStabilities = useMemo(() => {
    const withRetention = (fsrsStatsByChapter ?? [])
      .filter(c => c.avgRetention !== null && c.avgRetention > 0)
      .map(c => {
        const R = Math.min(99, Math.max(1, c.avgRetention!)) / 100
        const S = -1 / Math.log(R)
        return { chapterId: c.chapterId, S: Math.max(0.5, S) }
      })
      .sort((a, b) => b.S - a.S)

    if (!withRetention.length) {
      return { best: 15, mid: 7, critical: 3, hasRealData: false }
    }

    const best = withRetention[0].S
    const mid = withRetention[Math.floor(withRetention.length / 2)].S
    const critical = withRetention[withRetention.length - 1].S
    return { best, mid, critical, hasRealData: true }
  }, [fsrsStatsByChapter])

  const quickNavItems = [
    { id: 'library', label: 'Reader / Notes', icon: BookOpen },
    { id: 'mcq', label: 'QBank', icon: PlusCircle },
    { id: 'flashcard', label: 'Flashcards', icon: Play },
    { id: 'analytics', label: 'Analytics', icon: Brain },
    { id: 'planner', label: 'Planner', icon: RefreshCw },
  ]

  return (
    <div
      dir="rtl"
      className="study-cockpit-root relative z-10 min-h-screen bg-[var(--bg-root)] text-[var(--text-primary)]"
      style={{ backgroundColor: 'var(--bg-root)' }}
    >
      <header className="animate-fade-slide-up sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg-card)]">
        <div className="flex h-16 items-center justify-between gap-4 px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <Hexagon className="h-7 w-7 text-[var(--accent)]" />
            <div>
              <div dir="ltr" className="text-sm font-bold tracking-tight text-[var(--accent)]">
                STUDY COCKPIT
              </div>
              <div className="text-xs text-[var(--text-muted)]">کنترل مرکزی مطالعه</div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--ring-bg)] px-4 py-2">
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--accent)]" />
              <span dir="ltr" className="font-mono">PGlite · OPFS</span>
            </div>

            <div className="w-24">
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
                <div
                  className={isOpfsHydrating ? 'animate-shimmer h-full rounded-full' : 'h-full rounded-full'}
                  style={{
                    width: `${Math.max(0, Math.min(100, storagePercent))}%`,
                    background: isOpfsHydrating ? undefined : barColor,
                  }}
                />
              </div>
            </div>

            <div className="text-xs text-[var(--text-muted)]">
              <span dir="ltr" className="font-mono">{Number.isFinite(storageUsedMB) ? storageUsedMB.toFixed(1) : '0.0'} MB</span>
            </div>

            <div className="relative">
              <button
                onClick={() => setShowPendingPanel((open) => !open)}
                className="flex min-h-[44px] items-center gap-1 rounded-lg px-3 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]"
                aria-label="تغییرات محلی در انتظار"
              >
                <span className="text-[var(--accent)]">⊕</span>
                <span dir="ltr" className="font-mono">{pendingCount}</span>
                <span>pending</span>
              </button>

              {showPendingPanel ? (
                <div className="absolute left-0 top-full z-40 mt-2 w-72 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3 shadow-lg">
                  <div className="mb-2 text-sm font-semibold text-[var(--text-primary)]">تغییرات محلی</div>
                  {pendingCount === 0 ? (
                    <div className="text-xs text-[var(--text-muted)]">موردی برای همگام‌سازی در صف نیست.</div>
                  ) : (
                    <div className="space-y-2">
                      {pendingCrdtOps.filter((item) => !item.autoResolved).map((item) => (
                        <div key={item.id} className="rounded-lg border border-[var(--border)] bg-[var(--bg-root)] p-2 text-xs">
                          <div className="font-medium text-[var(--text-primary)]">{item.topic}</div>
                          <div className="mt-1 text-[var(--text-muted)]">{item.field}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <SyncStatusLabel syncState={syncState} lastSyncLabel={lastSyncLabel} />
            <div className="hidden lg:block h-4 w-px bg-[var(--border)]" />
            <span className="hidden lg:block text-xs text-[var(--text-muted)]">{persianDate}</span>
            <button
              onClick={onOpenSettings}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg hover:bg-[var(--bg-card-hover)]"
              aria-label="تنظیمات"
            >
              <Settings className="h-5 w-5 text-[var(--text-secondary)]" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        <main className="flex-1 space-y-4 p-4 lg:space-y-6 lg:p-6">
          <section className="animate-fade-slide-up rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
            <div className="flex flex-col gap-6 lg:flex-row">
              <div className="flex-1 lg:w-[60%]">
                <h1 className="mb-2 text-2xl font-bold text-[var(--text-primary)]">ماموریت امروز</h1>
                <p className="mb-4 text-sm text-[var(--text-secondary)]">
                  <span>هفته </span>
                  <span dir="ltr" className="font-mono">{weekNumber}</span>
                  <span> از </span>
                  <span dir="ltr" className="font-mono">{totalWeeks}</span>
                  <span> · </span>
                  <span dir="ltr" className="font-mono">{daysUntilBoard}</span>
                  <span> روز تا بورد</span>
                </p>

                <div className="mb-6 flex flex-wrap gap-2">
                  <span className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[var(--ring-bg)] px-3 text-sm">
                    <span dir="ltr" className="font-mono">{dueCardsCount}</span>
                    <span>کارت FSRS سررسید</span>
                  </span>
                  <span className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[var(--ring-bg)] px-3 text-sm">
                    <span dir="ltr" className="font-mono">{mcqThisWeek}</span>
                    <span>سوال MCQ</span>
                  </span>
                  <span className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[var(--ring-bg)] px-3 text-sm">
                    <span>{focusTopic}</span>
                  </span>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={onStartStudy}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-5 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    style={{ background: 'var(--accent)' }}
                  >
                    <Play className="h-4 w-4" />
                    <span>شروع مطالعه</span>
                  </button>
                  <button
                    type="button"
                    onClick={onCreateMCQ}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[var(--border-strong)] px-5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  >
                    <PlusCircle className="h-4 w-4" />
                    <span>ساخت بلوک MCQ</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-center lg:w-[40%]">
                <button
                  type="button" // The FSRS curve should link to SRS stats, not the general (and disabled) analytics page.
                  onClick={() => onNavChange?.('srs-stats')}
                  className="group w-full max-w-[320px] rounded-2xl border border-[var(--border)] bg-[var(--bg-root)] p-4 text-right transition hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--bg-card-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">نماگر آمادگی</div>
                    <span className="text-[10px] font-medium text-[var(--text-muted)] opacity-0 transition group-hover:opacity-100">
                      مشاهده آمار
                    </span>
                  </div>
                  <DecayCurvesSVG
                    best={curveStabilities.best}
                    mid={curveStabilities.mid}
                    critical={curveStabilities.critical}
                    hasRealData={curveStabilities.hasRealData}
                  />
                </button>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" aria-label="کارت‌های عملیاتی داشبورد">
            <KpiActionCard
              label="کارت‌های سررسید"
              value={dueCardsCount}
              color="var(--accent)"
              hint="ورود مستقیم به صف مرور واقعی"
              onClick={() => onNavChange?.('dueCards')}
            />
            <KpiActionCard
              label="MCQ این هفته"
              value={mcqThisWeek}
              color="var(--accent-blue)"
              hint="باز کردن بانک سوالات با داده واقعی"
              onClick={() => onNavChange?.('mcq')}
            />
            <KpiActionCard
              label="دقت کلی"
              value={overallAccuracy}
              suffix="%"
              color="#16A34A"
              hint="تحلیل عملکرد و تاریخچه آزمون"
              onClick={() => onNavChange?.('analytics')}
            />
            <KpiActionCard
              label="رشته مطالعه"
              value={studyStreakDays}
              valueText={plannerKpiValueText}
              suffix=" روز"
              color="var(--accent-amber)"
              hint="باز کردن برنامه مطالعه"
              onClick={() => onNavChange?.('planner')}
            />
          </section>

          <nav className="grid grid-cols-2 gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="میانبرهای واقعی داشبورد">
            {quickNavItems.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavChange?.(item.id)}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-root)] px-3 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>

          {children}
        </main>
      </div>
    </div>
  )
}

export default StudyCockpitShell
