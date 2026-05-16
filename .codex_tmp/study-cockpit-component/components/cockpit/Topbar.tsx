'use client'

import { useEffect, useRef, useState } from 'react'
import { Settings, RefreshCw } from 'lucide-react'

/* ── Types ─────────────────────────────────────────────────────────── */
export interface TopbarProps {
  queryEvents: number[]          // last 10 query timestamps (ms)
  storageUsedMB: number          // e.g. 12.4
  storageTotalMB: number         // e.g. 60
  pendingCRDT: number            // unsynced ops count
  lastSyncedMs: number | null    // timestamp or null if never
  isSyncing: boolean
  isOffline: boolean
  onPendingClick: () => void
  onSettingsClick: () => void
}

/* ── DB Pulse Sparkline ────────────────────────────────────────────── */
function DbPulse({ queryEvents }: { queryEvents: number[] }) {
  const W = 48, H = 20
  const prev = useRef<number[]>([])
  const [dotActive, setDotActive] = useState(false)

  useEffect(() => {
    if (queryEvents.length !== prev.current.length ||
      queryEvents.some((v, i) => v !== prev.current[i])) {
      prev.current = queryEvents
      setDotActive(true)
      const t = setTimeout(() => setDotActive(false), 800)
      return () => clearTimeout(t)
    }
  }, [queryEvents])

  const now = Date.now()
  const windowMs = 10 * 60 * 1000 // 10 min window
  const points = queryEvents.slice(-10)

  const toX = (ts: number) => Math.round(((ts - (now - windowMs)) / windowMs) * W)
  const toY = (i: number, total: number) =>
    total <= 1 ? H / 2 : Math.round(H - (i / (total - 1)) * (H - 4) - 2)

  let pathD = ''
  if (points.length > 1) {
    pathD = points
      .map((ts, i) => `${i === 0 ? 'M' : 'L'}${toX(ts)},${toY(i, points.length)}`)
      .join(' ')
  }

  return (
    <span className="flex items-center gap-1.5">
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: dotActive ? 'var(--accent)' : 'var(--text-muted)',
          display: 'inline-block',
          transition: 'background 0.3s',
          boxShadow: dotActive ? '0 0 6px var(--accent)' : 'none',
        }}
      />
      <svg width={W} height={H} aria-hidden="true" style={{ overflow: 'visible' }}>
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.7"
          />
        )}
        {points.map((ts, i) => (
          <circle
            key={ts}
            cx={toX(ts)}
            cy={toY(i, points.length)}
            r={i === points.length - 1 ? 2.5 : 1.5}
            fill="var(--accent)"
            opacity={i === points.length - 1 ? 1 : 0.4}
          />
        ))}
      </svg>
    </span>
  )
}

/* ── Storage Bar ───────────────────────────────────────────────────── */
function StorageBar({ usedMB, totalMB }: { usedMB: number; totalMB: number }) {
  const pct = Math.min(100, Math.max(0, (usedMB / totalMB) * 100))
  const color = pct > 95 ? 'var(--accent-red)' : pct > 80 ? 'var(--accent-amber)' : 'var(--accent)'

  return (
    <div className="flex flex-col gap-0.5" style={{ minWidth: 120 }}>
      <div
        style={{
          height: 4,
          borderRadius: 2,
          background: 'var(--ring-bg)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            height: '100%',
            width: `${pct}%`,
            background: color,
            borderRadius: 2,
            transition: 'width 0.6s ease',
          }}
        />
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
        {usedMB.toFixed(1)} MB · {Math.round(pct)}%
      </span>
    </div>
  )
}

/* ── Relative time ─────────────────────────────────────────────────── */
function relativeTime(ms: number | null): string {
  if (!ms) return 'هرگز'
  const diff = Math.floor((Date.now() - ms) / 1000)
  if (diff < 60) return `${diff} ثانیه پیش`
  if (diff < 3600) return `${Math.floor(diff / 60)} دقیقه پیش`
  return `${Math.floor(diff / 3600)} ساعت پیش`
}

/* ── Topbar ────────────────────────────────────────────────────────── */
export default function Topbar({
  queryEvents,
  storageUsedMB,
  storageTotalMB,
  pendingCRDT,
  lastSyncedMs,
  isSyncing,
  isOffline,
  onPendingClick,
  onSettingsClick,
}: TopbarProps) {
  const [persianDate, setPersianDate] = useState('')
  const [, forceRender] = useState(0)

  useEffect(() => {
    try {
      const d = new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric', month: 'long', day: 'numeric',
      }).format(new Date())
      setPersianDate(d)
    } catch {
      setPersianDate('')
    }
    // re-render every minute for sync time
    const id = setInterval(() => forceRender(n => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <header
      className="anim-topbar"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.25rem',
        height: 56,
        gap: '1rem',
      }}
    >
      {/* Right — Branding */}
      <div className="flex flex-col justify-center" style={{ lineHeight: 1.2 }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--accent)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          ◆ AUA BOARD PRO
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>پلتفرم اختصاصی بورد اورولوژی</span>
      </div>

      {/* Center — DB Pulse */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          background: 'var(--ring-bg)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '8px 16px',
          flex: 1,
          maxWidth: 480,
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div className="flex items-center gap-2">
          <DbPulse queryEvents={queryEvents} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            PGlite · OPFS
          </span>
        </div>

        <StorageBar usedMB={storageUsedMB} totalMB={storageTotalMB} />

        <button
          onClick={onPendingClick}
          aria-label="تغییرات محلی در انتظار sync"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 10px',
            minWidth: 44,
            minHeight: 44,
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: pendingCRDT > 0 ? 'color-mix(in srgb, var(--accent-amber) 12%, transparent)' : 'transparent',
            color: pendingCRDT > 0 ? 'var(--accent-amber)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: 14 }}>⊕</span>
          <span>{pendingCRDT} pending</span>
        </button>
      </div>

      {/* Left — Sync + Date + Settings */}
      <div className="flex items-center gap-3">
        {/* Offline badge — no banner, just a subtle indicator */}
        {isOffline && (
          <span
            style={{
              fontSize: 11,
              padding: '3px 8px',
              borderRadius: 6,
              background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
              color: 'var(--accent)',
              fontFamily: 'var(--font-mono)',
              border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
            }}
          >
            local
          </span>
        )}

        <div className="flex flex-col items-end" style={{ lineHeight: 1.2 }}>
          <div className="flex items-center gap-1.5">
            <RefreshCw
              size={13}
              style={{
                color: isSyncing ? 'var(--accent)' : 'var(--text-muted)',
                animation: isSyncing ? 'spin 1s linear infinite' : 'none',
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {isSyncing ? 'در حال sync...' : `synced ${relativeTime(lastSyncedMs)}`}
            </span>
          </div>
          {persianDate && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{persianDate}</span>
          )}
        </div>

        <button
          onClick={onSettingsClick}
          aria-label="تنظیمات"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card-hover)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
          }}
        >
          <Settings size={16} />
        </button>
      </div>
    </header>
  )
}
