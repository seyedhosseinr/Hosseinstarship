'use client'

export interface HeatmapDay {
  date: string   // YYYY-MM-DD
  count: number  // sessions that day
}

interface Props {
  days: HeatmapDay[]  // exactly 35 entries (5 weeks), most recent last
}

const DAY_HEADERS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']

function intensityColor(count: number, isDark = false): string {
  if (count === 0) return 'var(--ring-bg)'
  if (count <= 2)  return isDark ? '#134e4a' : '#ccfbf1'
  if (count <= 4)  return isDark ? '#0f766e' : '#5eead4'
  return isDark ? '#14b8a6' : '#0d9488'
}

export default function StudyHeatmap({ days }: Props) {
  // Pad to 35 cells
  const cells: HeatmapDay[] = Array.from({ length: 35 }, (_, i) => {
    return days[i] ?? { date: '', count: 0 }
  })

  // 5 rows × 7 columns
  const weeks: HeatmapDay[][] = Array.from({ length: 5 }, (_, w) =>
    cells.slice(w * 7, w * 7 + 7)
  )

  return (
    <div
      className="anim-heatmap"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* Header */}
      <div style={{ padding: '16px 16px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
          نقشه مطالعه — ۳۵ روز
        </span>
      </div>

      <div style={{ padding: '18px 16px' }}>
        {/* Day headers */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 4,
            marginBottom: 4,
          }}
        >
          {DAY_HEADERS.map(h => (
            <div
              key={h}
              style={{
                textAlign: 'center',
                fontSize: 11,
                color: 'var(--text-muted)',
                fontWeight: 600,
              }}
            >
              {h}
            </div>
          ))}
        </div>

        {/* Heatmap grid — 5 rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {weeks.map((week, wi) => (
            <div
              key={wi}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 4,
              }}
            >
              {week.map((day, di) => {
                const label = day.date
                  ? `${day.date}: ${day.count} جلسه مطالعه`
                  : 'بدون داده'

                return (
                  <div
                    key={`${wi}-${di}`}
                    title={label}
                    role="img"
                    aria-label={label}
                    style={{
                      minWidth: 32,
                      minHeight: 32,
                      borderRadius: 6,
                      background: intensityColor(day.count),
                      border: '1px solid color-mix(in srgb, var(--border) 60%, transparent)',
                      transition: 'all 0.12s cubic-bezier(0.22, 1, 0.36, 1)',
                      cursor: day.date ? 'default' : 'default',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.15)'
                      ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'
                      ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 12,
            justifyContent: 'flex-end',
          }}
        >
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>کمتر</span>
          {[0, 1, 3, 5].map(c => (
            <div
              key={c}
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: intensityColor(c),
                border: '1px solid color-mix(in srgb, var(--border) 60%, transparent)',
              }}
            />
          ))}
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>بیشتر</span>
        </div>
      </div>
    </div>
  )
}
