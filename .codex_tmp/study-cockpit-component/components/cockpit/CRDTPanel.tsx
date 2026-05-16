'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export interface CRDTConflict {
  id: string
  topic: string
  field: string
  localValue: string
  remoteValue: string
  autoResolved: boolean
  resolvedBy?: 'LWW'
}

interface Props {
  conflicts: CRDTConflict[]
  open: boolean
  anchorRef: React.RefObject<HTMLElement | null>
  onClose: () => void
  onResolve: (id: string, choice: 'local' | 'remote') => void
}

export default function CRDTPanel({ conflicts, open, onClose, onResolve }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.addEventListener('mousedown', handleClick)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="تغییرات محلی در انتظار"
      aria-modal="false"
      style={{
        position: 'fixed',
        top: 64,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 320,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-strong)',
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        zIndex: 100,
        overflow: 'hidden',
        animation: 'fadeSlideUp 0.2s ease-out both',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          ⊕ تغییرات محلی در انتظار
        </span>
        <button
          onClick={onClose}
          aria-label="بستن"
          style={{
            width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', background: 'transparent',
            color: 'var(--text-muted)', cursor: 'pointer', borderRadius: 6,
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Conflicts list */}
      <div style={{ maxHeight: 360, overflowY: 'auto' }}>
        {conflicts.length === 0 && (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            هیچ تعارضی وجود ندارد
          </div>
        )}
        {conflicts.map((c, i) => (
          <div
            key={c.id}
            style={{
              padding: '12px 16px',
              borderBottom: i < conflicts.length - 1 ? '1px solid var(--border)' : 'none',
              opacity: c.autoResolved ? 0.55 : 1,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {c.topic}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {c.field}
              </span>
            </div>

            {c.autoResolved ? (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                (auto-resolved via {c.resolvedBy ?? 'LWW'})
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Local: </span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{c.localValue}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Remote: </span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{c.remoteValue}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => onResolve(c.id, 'local')}
                    style={{
                      flex: 1, minHeight: 44,
                      border: '1px solid var(--border-strong)',
                      borderRadius: 8,
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: 12, cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    استفاده از نسخه محلی
                  </button>
                  <button
                    onClick={() => onResolve(c.id, 'remote')}
                    style={{
                      flex: 1, minHeight: 44,
                      border: '1px solid var(--accent)',
                      borderRadius: 8,
                      background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                      color: 'var(--accent)',
                      fontSize: 12, cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 18%, transparent)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 10%, transparent)')}
                  >
                    استفاده از نسخه سرور
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
