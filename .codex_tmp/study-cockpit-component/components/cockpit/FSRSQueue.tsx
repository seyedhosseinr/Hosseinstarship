'use client'

import { CheckCircle2, Play } from 'lucide-react'

export interface FSRSCard {
  id: string
  topic: string
  chapter: string
  dueLabel: string        // e.g. 'سررسید' | '۲ روز' | '۱ هفته'
  dueType: 'overdue' | 'today' | 'future'
  yieldScore: number      // 0–100
  yieldDots: number       // filled dots 0–5
}

interface Props {
  cards: FSRSCard[]
  onStartReview: () => void
}

function DueChip({ type, label }: { type: FSRSCard['dueType']; label: string }) {
  const styles: Record<FSRSCard['dueType'], { bg: string; color: string }> = {
    overdue: { bg: 'color-mix(in srgb, var(--accent-red) 12%, transparent)',  color: 'var(--accent-red)' },
    today:   { bg: 'color-mix(in srgb, var(--accent-amber) 12%, transparent)', color: 'var(--accent-amber)' },
    future:  { bg: 'var(--ring-bg)', color: 'var(--text-muted)' },
  }
  const s = styles[type]
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        background: s.bg,
        color: s.color,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

function YieldDots({ filled, score }: { filled: number; score: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`yield score: ${score}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: i < filled ? 'var(--accent)' : 'transparent',
            border: `1.5px solid ${i < filled ? 'var(--accent)' : 'var(--border-strong)'}`,
          }}
        />
      ))}
      <span
        style={{
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)',
          marginRight: 2,
        }}
      >
        {score}
      </span>
    </div>
  )
}

export default function FSRSQueue({ cards, onStartReview }: Props) {
  const isEmpty = cards.length === 0

  return (
    <div
      className="anim-fsrs"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          صف مرور FSRS
        </span>
        <span
          style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            padding: '2px 8px',
            borderRadius: 6,
            background: 'var(--ring-bg)',
          }}
        >
          {cards.length} کارت
        </span>
      </div>

      {/* Cards list */}
      {isEmpty ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 16px',
            gap: 10,
          }}
        >
          <CheckCircle2 size={36} style={{ color: 'var(--accent)', opacity: 0.6 }} />
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, textAlign: 'center' }}>
            صف مطالعه خالی است
          </p>
        </div>
      ) : (
        <div style={{ flex: 1 }}>
          {cards.map((card, i) => (
            <div
              key={card.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px',
                minHeight: 44,
                borderBottom: i < cards.length - 1 ? '1px solid var(--border)' : 'none',
                gap: 12,
                transition: 'background 0.12s ease',
                cursor: 'default',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-card-hover)'}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
            >
              {/* Topic */}
              <span
                dir="ltr"
                style={{
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  flex: '0 0 auto',
                  maxWidth: 140,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {card.topic}
              </span>

              {/* Chapter */}
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  flex: 1,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {card.chapter}
              </span>

              <DueChip type={card.dueType} label={card.dueLabel} />
              <YieldDots filled={card.yieldDots} score={card.yieldScore} />
            </div>
          ))}
        </div>
      )}

      {/* Footer CTA */}
      <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={onStartReview}
          disabled={isEmpty}
          style={{
            width: '100%',
            minHeight: 46,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            borderRadius: 10,
            border: 'none',
            background: isEmpty ? 'var(--ring-bg)' : 'var(--accent)',
            color: isEmpty ? 'var(--text-muted)' : '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: isEmpty ? 'not-allowed' : 'pointer',
            opacity: isEmpty ? 0.5 : 1,
            pointerEvents: isEmpty ? 'none' : 'auto',
            transition: 'all 0.15s ease',
            fontFamily: 'var(--font-sans)',
            boxShadow: isEmpty ? 'none' : '0 4px 12px rgba(13, 122, 114, 0.2)',
            letterSpacing: '0.01em',
          }}
          onMouseEnter={e => {
            if (!isEmpty) {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'
              ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 16px rgba(13, 122, 114, 0.3)'
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = isEmpty ? 'none' : '0 4px 12px rgba(13, 122, 114, 0.2)'
          }}
        >
          <Play size={14} />
          شروع مرور
        </button>
      </div>
    </div>
  )
}
