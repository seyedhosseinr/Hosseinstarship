'use client'

import { useEffect, useRef } from 'react'
import { CreditCard, HelpCircle, Target, Flame } from 'lucide-react'

export interface StatRowProps {
  fsrsCount: number
  mcqCount: number
  accuracyPct: number
  streakDays: number
}

interface StatCardProps {
  label: string
  value: number
  suffix: string
  icon: React.ReactNode
  accentColor: string
  animClass: string
}

function StatCard({ label, value, suffix, icon, accentColor, animClass }: StatCardProps) {
  const numRef = useRef<HTMLSpanElement>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const el = numRef.current
    if (!el) return
    const start = performance.now()
    const duration = 700

    function tick(now: number) {
      const p = Math.min(1, (now - start) / duration)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3)
      el!.textContent = String(Math.round(eased * value))
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [value])

  return (
    <div
      className={animClass}
      style={{
        flex: 1,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '20px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        cursor: 'default',
        transition: 'all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px) scale(1.01)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 24px rgba(0,0,0,0.12)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0) scale(1)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)'
      }}
    >
      {/* Accent strip top */}
      <div
        style={{
          position: 'absolute',
          top: 0, right: 0,
          width: '100%', height: 2,
          background: accentColor,
          borderRadius: '12px 12px 0 0',
          opacity: 0.6,
        }}
      />

      <div
        style={{
          width: 34, height: 34,
          borderRadius: 8,
          background: `color-mix(in srgb, ${accentColor} 12%, transparent)`,
          border: `1px solid color-mix(in srgb, ${accentColor} 25%, transparent)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: accentColor,
        }}
      >
        {icon}
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
          <span
            ref={numRef}
            style={{
              fontSize: 26,
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)',
              tabularNums: 'tabular-nums',
            } as React.CSSProperties}
          >
            0
          </span>
          {suffix && (
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{suffix}</span>
          )}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, marginTop: 2 }}>
          {label}
        </p>
      </div>
    </div>
  )
}

export default function StatRow({ fsrsCount, mcqCount, accuracyPct, streakDays }: StatRowProps) {
  const stats = [
    {
      label: 'کارت‌های سررسید',
      value: fsrsCount,
      suffix: '',
      icon: <CreditCard size={16} />,
      accentColor: 'var(--accent)',
      animClass: 'anim-stat-0',
    },
    {
      label: 'MCQ این هفته',
      value: mcqCount,
      suffix: '',
      icon: <HelpCircle size={16} />,
      accentColor: 'var(--accent-blue)',
      animClass: 'anim-stat-1',
    },
    {
      label: 'دقت کلی',
      value: Math.min(100, Math.max(0, accuracyPct)),
      suffix: '%',
      icon: <Target size={16} />,
      accentColor: '#16a34a',
      animClass: 'anim-stat-2',
    },
    {
      label: 'رشته مطالعه',
      value: streakDays,
      suffix: 'روز',
      icon: <Flame size={16} />,
      accentColor: 'var(--accent-amber)',
      animClass: 'anim-stat-3',
    },
  ]

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {stats.map(s => (
        <StatCard key={s.label} {...s} />
      ))}
    </div>
  )
}
