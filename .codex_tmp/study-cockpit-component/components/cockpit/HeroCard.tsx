'use client'

import { Play, ArrowLeft } from 'lucide-react'

export interface HeroCardProps {
  weekCurrent: number
  weekTotal: number
  daysUntilBoard: number
  fsrsCount: number
  mcqCount: number
  criticalTopic: string
  onStartStudy: () => void
  onBuildMCQ: () => void
}

/* ── FSRS Decay Curves — Pure inline SVG ─────────────────────────── */
function DecayCurves() {
  const W = 280
  const H = 120
  const padL = 28
  const padB = 24
  const padT = 8
  const padR = 8

  const innerW = W - padL - padR
  const innerH = H - padT - padB

  // R(t) = e^(-t/S) approximated via cubic bezier
  // S values: teal=14 (retained), amber=7 (mid), red=3 (critical)
  // x: 0..14 days, y: 0..100%
  const toX = (day: number) => padL + (day / 14) * innerW
  const toY = (retention: number) => padT + (1 - retention / 100) * innerH

  // Build exponential path from day 0..14 sampled at many points
  function buildPath(S: number): string {
    const pts: [number, number][] = []
    for (let d = 0; d <= 14; d += 0.5) {
      const r = Math.exp(-d / S) * 100
      pts.push([toX(d), toY(r)])
    }
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  }

  const tealPath  = buildPath(14)
  const amberPath = buildPath(7)
  const redPath   = buildPath(3)

  // Today = day 4
  const todayX = toX(4)

  // 70% threshold y
  const threshold70Y = toY(70)

  // X-axis labels
  const xLabels = [0, 2, 4, 7, 10, 14]
  // Y-axis labels
  const yLabels = [100, 70, 40, 0]

  return (
    <div style={{ position: 'relative' }} aria-label="منحنی فراموشی · ۳ کارت بحرانی">
      <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
        {/* Shaded zone below 70% */}
        <clipPath id="below70clip">
          <rect x={padL} y={threshold70Y} width={innerW} height={H - padB - threshold70Y + padT} />
        </clipPath>
        <rect
          x={padL} y={threshold70Y}
          width={innerW} height={H - padB - threshold70Y + padT}
          fill="var(--accent-red)" opacity="0.06" rx="2"
        />

        {/* 70% dashed line */}
        <line
          x1={padL} y1={threshold70Y}
          x2={padL + innerW} y2={threshold70Y}
          stroke="var(--accent-red)" strokeWidth="1"
          strokeDasharray="4 3" opacity="0.5"
        />
        <text x={padL + innerW + 3} y={threshold70Y + 4}
          style={{ fontSize: 9, fill: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>
          ۷۰٪
        </text>

        {/* Today vertical line */}
        <line
          x1={todayX} y1={padT}
          x2={todayX} y2={H - padB}
          stroke="var(--text-muted)" strokeWidth="1"
          strokeDasharray="3 3" opacity="0.5"
        />
        <text x={todayX - 2} y={H - padB + 13}
          style={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAnchor: 'middle' }}>
          امروز
        </text>

        {/* Decay curves */}
        <path d={tealPath}  fill="none" stroke="var(--accent)"       strokeWidth="1.8" strokeLinecap="round" />
        <path d={amberPath} fill="none" stroke="var(--accent-amber)"  strokeWidth="1.8" strokeLinecap="round" />
        <path d={redPath}   fill="none" stroke="var(--accent-red)"    strokeWidth="1.8" strokeLinecap="round" />

        {/* X-axis */}
        <line x1={padL} y1={H - padB} x2={padL + innerW} y2={H - padB}
          stroke="var(--border)" strokeWidth="1" />
        {xLabels.map(d => (
          <text key={d}
            x={toX(d)} y={H - padB + 13}
            style={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAnchor: 'middle' }}>
            {d}
          </text>
        ))}

        {/* Y-axis */}
        <line x1={padL} y1={padT} x2={padL} y2={H - padB}
          stroke="var(--border)" strokeWidth="1" />
        {yLabels.map(r => (
          <text key={r}
            x={padL - 4} y={toY(r) + 3}
            style={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAnchor: 'end' }}>
            {r}
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginTop: 4,
          justifyContent: 'flex-end',
        }}
      >
        {[
          { color: 'var(--accent)',       label: 'تسلط بالا' },
          { color: 'var(--accent-amber)', label: 'نیاز به مرور' },
          { color: 'var(--accent-red)',   label: 'بحرانی' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1">
            <div style={{ width: 16, height: 2, borderRadius: 1, background: l.color }} />
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{l.label}</span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
        منحنی فراموشی · ۳ کارت بحرانی
      </p>
    </div>
  )
}

/* ── HeroCard ─────────────────────────────────────────────────────── */
export default function HeroCard({
  weekCurrent,
  weekTotal,
  daysUntilBoard,
  fsrsCount,
  mcqCount,
  criticalTopic,
  onStartStudy,
  onBuildMCQ,
}: HeroCardProps) {
  const queueEmpty = fsrsCount === 0 && mcqCount === 0

  return (
    <div
      className="anim-hero"
      style={{
        background: 'var(--bg-card)',
        borderRadius: 18,
        border: '1px solid var(--border)',
        borderRight: '5px solid var(--accent)',
        padding: '28px 28px 28px 24px',
        display: 'flex',
        gap: 28,
        alignItems: 'flex-start',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
      }}
    >
      {/* Left 60% — Mission */}
      <div style={{ flex: '0 0 58%', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            ماموریت امروز
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, margin: '6px 0 0' }}>
            هفته {weekCurrent} از {weekTotal} · {daysUntilBoard} روز تا بورد
          </p>
        </div>

        {/* Chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[
            { icon: '🃏', label: `${fsrsCount} کارت FSRS سررسید`, color: 'var(--accent)' },
            { icon: '❓', label: `${mcqCount} سوال MCQ`, color: 'var(--accent-blue)' },
            { icon: '🎯', label: criticalTopic, color: 'var(--accent-amber)' },
          ].map(chip => (
            <span
              key={chip.label}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 12px',
                minHeight: 44,
                borderRadius: 10,
                border: `1px solid color-mix(in srgb, ${chip.color} 30%, transparent)`,
                background: `color-mix(in srgb, ${chip.color} 10%, transparent)`,
                color: chip.color,
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              <span>{chip.icon}</span>
              <span>{chip.label}</span>
            </span>
          ))}
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={onStartStudy}
            disabled={queueEmpty}
            aria-label="شروع مطالعه"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 24px',
              minHeight: 48,
              minWidth: 44,
              borderRadius: 12,
              border: 'none',
              background: queueEmpty ? 'var(--ring-bg)' : 'var(--accent)',
              color: queueEmpty ? 'var(--text-muted)' : '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: queueEmpty ? 'not-allowed' : 'pointer',
              opacity: queueEmpty ? 0.5 : 1,
              pointerEvents: queueEmpty ? 'none' : 'auto',
              transition: 'all 0.18s ease',
              fontFamily: 'var(--font-sans)',
              letterSpacing: '0.01em',
              boxShadow: queueEmpty ? 'none' : '0 4px 12px rgba(13, 122, 114, 0.25)',
            }}
            onMouseEnter={e => {
              if (!queueEmpty) {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 20px rgba(13, 122, 114, 0.35)'
              }
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
              ;(e.currentTarget as HTMLButtonElement).style.boxShadow = queueEmpty ? 'none' : '0 4px 12px rgba(13, 122, 114, 0.25)'
            }}
          >
            <Play size={15} />
            شروع مطالعه
          </button>

          <button
            onClick={onBuildMCQ}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 16px',
              minHeight: 44,
              borderRadius: 10,
              border: '1px solid var(--border-strong)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.12s ease',
              fontFamily: 'var(--font-sans)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card-hover)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
            }}
          >
            ساخت بلوک MCQ
            <ArrowLeft size={13} />
          </button>
        </div>
      </div>

      {/* Right 40% — Decay curves */}
      <div style={{ flex: '0 0 40%' }}>
        <DecayCurves />
      </div>
    </div>
  )
}
