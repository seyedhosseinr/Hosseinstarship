'use client'

import { useEffect, useRef } from 'react'

export interface MCQTopic {
  chapter: string
  accuracyPct: number  // clamped to 0–100
}

interface Props {
  topics: MCQTopic[]
}

function Bar({ chapter, rawPct, index }: { chapter: string; rawPct: number; index: number }) {
  const pct = Math.min(100, Math.max(0, rawPct))
  const barRef = useRef<SVGRectElement>(null)
  const W_TOTAL = 200
  const BAR_H = 16

  useEffect(() => {
    const el = barRef.current
    if (!el) return
    const delay = index * 30
    const duration = 600
    let raf: number
    let start: number | null = null

    function tick(now: number) {
      if (!start) start = now
      const elapsed = now - start - delay
      if (elapsed < 0) { raf = requestAnimationFrame(tick); return }
      const progress = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      el.setAttribute('width', String(Math.round(eased * (pct / 100) * W_TOTAL)))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }

    el.setAttribute('width', '0')
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [pct, index])

  const barColor =
    pct >= 70 ? 'var(--accent)' :
    pct >= 50 ? 'var(--accent-amber)' :
    'var(--accent-red)'

  return (
    <g>
      {/* Background track */}
      <rect x={0} y={0} width={W_TOTAL} height={BAR_H}
        rx={4} fill="var(--ring-bg)" />
      {/* Animated bar */}
      <rect ref={barRef} x={0} y={0} width={0} height={BAR_H}
        rx={4} fill={barColor} opacity="0.85" />
    </g>
  )
}

export default function MCQChart({ topics }: Props) {
  const sorted = [...topics].sort((a, b) => b.accuracyPct - a.accuracyPct)
  const W_TOTAL = 200
  const BAR_H = 16
  const ROW_GAP = 10
  const LABEL_W = 90
  const PCT_W = 36

  const totalW = LABEL_W + 8 + W_TOTAL + 8 + PCT_W
  const totalH = sorted.length * (BAR_H + ROW_GAP) - ROW_GAP + 24 // extra for axis

  // 70% goal X position
  const goalX = LABEL_W + 8 + (70 / 100) * W_TOTAL

  return (
    <div
      className="anim-mcq"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* Header */}
      <div style={{ padding: '16px 16px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
          عملکرد MCQ
        </span>
      </div>

      <div style={{ padding: '18px 16px', overflowX: 'auto' }}>
        <svg
          width={totalW}
          height={totalH}
          aria-label="نمودار عملکرد MCQ به تفکیک فصل"
          style={{ display: 'block', minWidth: totalW }}
        >
          {/* Dashed goal line at 70% */}
          <line
            x1={goalX} y1={0}
            x2={goalX} y2={totalH - 20}
            stroke="var(--accent-amber)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            opacity="0.7"
          />
          <text
            x={goalX + 4}
            y={totalH - 6}
            style={{ fontSize: 10, fill: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}
          >
            هدف: ۷۰٪
          </text>

          {sorted.map((topic, i) => {
            const pct = Math.min(100, Math.max(0, topic.accuracyPct))
            const y = i * (BAR_H + ROW_GAP)

            return (
              <g key={topic.chapter} transform={`translate(0, ${y})`}>
                {/* Chapter label */}
                <text
                  x={LABEL_W}
                  y={BAR_H / 2 + 4}
                  textAnchor="end"
                  style={{
                    fontSize: 11,
                    fill: 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 500,
                  }}
                  dir="ltr"
                >
                  {topic.chapter}
                </text>

                {/* Bar */}
                <g transform={`translate(${LABEL_W + 8}, 0)`}>
                  <Bar chapter={topic.chapter} rawPct={pct} index={i} />
                </g>

                {/* Percentage label */}
                <text
                  x={LABEL_W + 8 + W_TOTAL + 8}
                  y={BAR_H / 2 + 4}
                  style={{
                    fontSize: 11,
                    fill: pct >= 70 ? 'var(--accent)' : pct >= 50 ? 'var(--accent-amber)' : 'var(--accent-red)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {pct}%
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
