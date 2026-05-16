'use client'

import { LayoutDashboard, CreditCard, HelpCircle, BookOpen, CalendarDays, BarChart2 } from 'lucide-react'

export interface SidebarProps {
  activeNav: string
  onNavChange: (id: string) => void
  storageUsedMB: number
  storageTotalMB: number
  lastSyncedMs: number | null
  pendingCRDT: number
  isHydrating: boolean
  fsrsCount: number
  mcqCount: number
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
  { id: 'flashcards', label: 'فلش‌کارت', icon: CreditCard, badge: 47 },
  { id: 'mcq', label: 'بانک سوال', icon: HelpCircle, badge: 12 },
  { id: 'library', label: 'کتابخانه', icon: BookOpen },
  { id: 'planner', label: 'برنامه‌ریز', icon: CalendarDays },
  { id: 'history', label: 'تاریخچه', icon: BarChart2 },
]

function relativeTime(ms: number | null): string {
  if (!ms) return 'هرگز'
  const diff = Math.floor((Date.now() - ms) / 1000)
  if (diff < 60) return `${diff}ث پیش`
  if (diff < 3600) return `${Math.floor(diff / 60)} دقیقه پیش`
  return `${Math.floor(diff / 3600)} ساعت پیش`
}

export default function Sidebar({
  activeNav,
  onNavChange,
  storageUsedMB,
  storageTotalMB,
  lastSyncedMs,
  pendingCRDT,
  isHydrating,
  fsrsCount,
  mcqCount,
}: SidebarProps) {
  const pct = Math.min(100, Math.max(0, (storageUsedMB / storageTotalMB) * 100))
  const barColor = pct > 95 ? 'var(--accent-red)' : pct > 80 ? 'var(--accent-amber)' : 'var(--accent)'

  return (
    <aside
      style={{
        width: 210,
        flexShrink: 0,
        background: 'var(--bg-card)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '1rem 0',
      }}
    >
      {/* Nav */}
      <nav aria-label="منوی اصلی" style={{ flex: 1 }}>
        {NAV_ITEMS.map(item => {
          const Icon = item.icon
          const isActive = activeNav === item.id
          // override badge count from props
          const badgeCount =
            item.id === 'flashcards' ? fsrsCount :
            item.id === 'mcq' ? mcqCount :
            item.badge

          return (
            <button
              key={item.id}
              onClick={() => onNavChange(item.id)}
              aria-current={isActive ? 'page' : undefined}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px',
                minHeight: 44,
                border: 'none',
                borderRight: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                background: isActive
                  ? 'color-mix(in srgb, var(--accent) 6%, transparent)'
                  : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: 13,
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
                transition: 'all 0.16s cubic-bezier(0.22, 1, 0.36, 1)',
                textAlign: 'right',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--ring-bg)'
                  ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
                }
              }}
            >
              <div className="flex items-center gap-2.5">
                <Icon size={15} />
                <span>{item.label}</span>
              </div>
              {badgeCount != null && (
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    padding: '2px 6px',
                    borderRadius: 8,
                    background: isActive
                      ? 'color-mix(in srgb, var(--accent) 14%, transparent)'
                      : 'var(--border)',
                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                    minWidth: 22,
                    textAlign: 'center',
                    fontWeight: 500,
                  }}
                >
                  {badgeCount}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Local State Panel */}
      <div
        style={{
          margin: '0 12px',
          padding: '12px',
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: 'var(--ring-bg)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* Storage */}
        <div>
          <div className="flex justify-between items-center" style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
              حافظه محلی
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {storageUsedMB.toFixed(1)} MB
            </span>
          </div>
          <div
            style={{
              height: 4,
              borderRadius: 2,
              background: 'var(--border)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {isHydrating ? (
              <div className="shimmer" style={{ position: 'absolute', inset: 0 }} />
            ) : (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  height: '100%',
                  width: `${pct}%`,
                  background: barColor,
                  borderRadius: 2,
                  transition: 'width 0.6s ease',
                }}
              />
            )}
          </div>
          {isHydrating && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>در حال کش کردن...</span>
          )}
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            OPFS · PGlite
          </span>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)' }} />

        {/* Last sync */}
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 2 }}>
            آخرین sync
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {relativeTime(lastSyncedMs)}
          </div>
        </div>

        {/* Pending CRDT */}
        {pendingCRDT > 0 && (
          <div
            style={{
              padding: '6px 8px',
              borderRadius: 6,
              background: 'color-mix(in srgb, var(--accent-amber) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-amber) 25%, transparent)',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--accent-amber)', fontWeight: 600 }}>
              ⊕ {pendingCRDT} تغییر محلی
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>در انتظار sync</div>
          </div>
        )}
      </div>
    </aside>
  )
}
