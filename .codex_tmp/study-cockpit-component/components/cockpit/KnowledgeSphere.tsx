'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import dynamic from 'next/dynamic'

export interface SphereNode {
  id: string
  chapter: string
  priorityScore: number
  mastery: number
  connections: string[]
}

interface Props {
  nodes: SphereNode[]
}

function masteryColor(mastery: number): string {
  if (mastery > 85) return '#0F766E'
  if (mastery >= 50) return '#B45309'
  if (mastery > 0) return '#B91C1C'
  return '#9E9890'
}

/* ── Lazy-loaded 3D scene — only rendered client-side ─────────────── */
const Scene3D = dynamic(() => import('./KnowledgeSphere3D'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        fontSize: 12,
      }}
    >
      در حال بارگذاری نقشه...
    </div>
  ),
})

/* ── Static 2D fallback ───────────────────────────────────────────── */
function FallbackMap({ nodes }: { nodes: SphereNode[] }) {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 300 300"
      aria-label="نقشه دانش فصل‌های کمپبل"
      style={{ display: 'block' }}
    >
      {/* Center */}
      <circle cx={150} cy={150} r={6} fill="var(--accent)" opacity={0.3} />
      <text
        x={150} y={165}
        textAnchor="middle"
        style={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}
      >
        کمپبل
      </text>

      {/* Edges */}
      {nodes.map((node, i) => {
        const angle = (i / nodes.length) * 2 * Math.PI - Math.PI / 2
        const r = 105
        const cx = 150 + r * Math.cos(angle)
        const cy = 150 + r * Math.sin(angle)
        return (
          <line
            key={`e-${node.id}`}
            x1={150} y1={150}
            x2={cx} y2={cy}
            stroke="var(--border)"
            strokeWidth={1}
            opacity={0.5}
          />
        )
      })}

      {/* Nodes */}
      {nodes.map((node, i) => {
        const angle = (i / nodes.length) * 2 * Math.PI - Math.PI / 2
        const r = 105
        const cx = 150 + r * Math.cos(angle)
        const cy = 150 + r * Math.sin(angle)
        const size = 5 + (node.priorityScore / 100) * 14
        return (
          <g key={node.id}>
            <circle
              cx={cx} cy={cy}
              r={size}
              fill={masteryColor(node.mastery)}
              opacity={0.85}
            />
          </g>
        )
      })}
    </svg>
  )
}

/* ── KnowledgeSphere ─────────────────────────────────────────────── */
export default function KnowledgeSphere({ nodes }: Props) {
  const [mounted, setMounted] = useState(false)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    setMounted(true)
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
  }, [])

  return (
    <div
      className="anim-sphere"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          نقشه دانش — کمپبل
        </span>
      </div>

      {/* Canvas */}
      <div
        style={{ width: '100%', height: 300, position: 'relative', flex: 1 }}
        aria-label="نقشه دانش فصل‌های کمپبل"
      >
        {mounted && !reduced ? (
          <Scene3D nodes={nodes} />
        ) : (
          <FallbackMap nodes={nodes} />
        )}
      </div>

      {/* Legend */}
      <div
        style={{
          padding: '10px 16px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        {[
          { color: '#0F766E', label: 'تسلط بالا' },
          { color: '#B45309', label: 'نیاز به مرور' },
          { color: '#B91C1C', label: 'بحرانی' },
          { color: '#9E9890', label: 'خوانده نشده' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 8, height: 8,
                borderRadius: '50%',
                background: l.color,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
