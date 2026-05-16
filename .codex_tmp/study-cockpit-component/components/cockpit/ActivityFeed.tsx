'use client'

export interface ActivityItem {
  id: string
  timeLabel: string   // e.g. '۱۰ دقیقه پیش'
  action: string      // e.g. 'مرور شد'
  subject: string     // e.g. 'Gleason Grading'
  meta: string        // e.g. '+12 کارت' or '۸/۱۰' or '۲۴ دقیقه'
  type: 'card' | 'mcq' | 'read'
}

interface Props {
  items: ActivityItem[]
}

const TYPE_ICONS: Record<ActivityItem['type'], { icon: string; color: string }> = {
  card:  { icon: '🃏', color: 'var(--accent)' },
  mcq:   { icon: '❓', color: 'var(--accent-blue)' },
  read:  { icon: '📖', color: 'var(--accent-amber)' },
}

export default function ActivityFeed({ items }: Props) {
  return (
    <div
      className="anim-activity"
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
          فعالیت اخیر
        </span>
      </div>

      {/* Timeline */}
      <div
        style={{
          flex: 1,
          padding: '8px 0',
          overflowY: 'auto',
          position: 'relative',
        }}
      >
        {/* Right border timeline line */}
        <div
          style={{
            position: 'absolute',
            right: 28,
            top: 12,
            bottom: 12,
            width: 2,
            background: 'var(--border)',
            borderRadius: 1,
          }}
        />

        {items.map((item, i) => {
          const typeInfo = TYPE_ICONS[item.type]

          return (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '11px 16px 11px 16px',
                paddingRight: 48,
                position: 'relative',
                transition: 'background 0.15s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-card-hover)'}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
            >
              {/* Timeline dot */}
              <div
                style={{
                  position: 'absolute',
                  right: 22,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: 'var(--bg-card)',
                  border: `2px solid ${typeInfo.color}`,
                  zIndex: 1,
                }}
              />

              {/* Content */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {item.timeLabel}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      color: typeInfo.color,
                      padding: '1px 6px',
                      borderRadius: 5,
                      background: `color-mix(in srgb, ${typeInfo.color} 10%, transparent)`,
                    }}
                  >
                    {item.meta}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    dir="ltr"
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 500,
                  }}
                  >
                    {item.subject}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {item.action}
                  </span>
                </div>
              </div>
            </div>
          )
        })}

        {items.length === 0 && (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            هیچ فعالیتی ثبت نشده است
          </div>
        )}
      </div>
    </div>
  )
}
