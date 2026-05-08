"use client"

import { useMemo, useState } from "react"
import { Network } from "lucide-react"
import type { GraphEdge, GraphNode } from "./types"

const GROUP_COLORS: Record<GraphNode["group"], string> = {
  renal: "hsl(var(--chart-1))",
  bladder: "hsl(var(--chart-2))",
  prostate: "hsl(var(--chart-3))",
  testis: "hsl(var(--chart-4))",
  adrenal: "hsl(var(--chart-5))",
  general: "hsl(var(--muted-foreground))",
}

const GROUP_LABEL: Record<GraphNode["group"], string> = {
  renal: "کلیه",
  bladder: "مثانه",
  prostate: "پروستات",
  testis: "بیضه",
  adrenal: "آدرنال",
  general: "عمومی",
}

interface Positioned extends GraphNode {
  x: number
  y: number
}

/**
 * Deterministic radial layout — groups nodes by category onto a sun pattern.
 * No animation/sim — keeps SSR safe and consistent.
 */
function layoutNodes(nodes: GraphNode[], W = 360, H = 240): Positioned[] {
  const groups = Array.from(new Set(nodes.map((n) => n.group)))
  const groupAngle = (i: number) => (i / groups.length) * Math.PI * 2

  const cx = W / 2
  const cy = H / 2
  const R = Math.min(W, H) * 0.36

  return nodes.map((n) => {
    const gIdx = groups.indexOf(n.group)
    const angleBase = groupAngle(gIdx)
    const peers = nodes.filter((x) => x.group === n.group)
    const pIdx = peers.findIndex((x) => x.id === n.id)
    const spread = (pIdx - (peers.length - 1) / 2) * 0.28
    const angle = angleBase + spread
    // Vary radius slightly by node size for visual interest
    const r = R + (n.size - 18) * 1.2
    return {
      ...n,
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
    }
  })
}

export function KnowledgeGraph({
  nodes,
  edges,
}: {
  nodes: GraphNode[]
  edges: GraphEdge[]
}) {
  const [hovered, setHovered] = useState<string | null>(null)
  const W = 360
  const H = 240

  const positioned = useMemo(() => layoutNodes(nodes, W, H), [nodes])
  const byId = useMemo(
    () => Object.fromEntries(positioned.map((n) => [n.id, n])),
    [positioned],
  )

  const groups = Array.from(new Set(nodes.map((n) => n.group)))

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-1.5">
            <Network size={14} className="text-primary" />
            <p className="text-[13px] font-semibold tracking-tight">نقشه دانش</p>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            ارتباط مفاهیم پر‌تکرار در منابع CWW
          </p>
        </div>
      </div>

      {nodes.length === 0 ? (
        <div className="flex-1 min-h-[240px] rounded-lg border border-dashed border-border flex items-center justify-center text-[11px] text-muted-foreground">
          داده کافی برای ساخت نقشه دانش وجود ندارد.
        </div>
      ) : (
      <div className="flex-1 -mx-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height="100%"
          className="overflow-visible"
          role="img"
          aria-label="نمودار شبکه‌ای ارتباط مفاهیم بالینی"
        >
          {/* Edges */}
          <g>
            {edges.map((e) => {
              const a = byId[e.source]
              const b = byId[e.target]
              if (!a || !b) return null
              const active = hovered === e.source || hovered === e.target
              return (
                <line
                  key={`${e.source}-${e.target}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="currentColor"
                  strokeOpacity={active ? 0.6 : 0.18}
                  strokeWidth={active ? e.weight * 0.8 + 0.5 : e.weight * 0.5 + 0.3}
                  className="transition-all"
                />
              )
            })}
          </g>

          {/* Nodes */}
          <g>
            {positioned.map((n) => {
              const isHovered = hovered === n.id
              const fill = GROUP_COLORS[n.group]
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x}, ${n.y})`}
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered(null)}
                  className="cursor-pointer"
                >
                  <circle
                    r={n.size / 2 + 6}
                    fill={fill}
                    fillOpacity={isHovered ? 0.18 : 0}
                    className="transition-all"
                  />
                  <circle
                    r={n.size / 2}
                    fill={fill}
                    fillOpacity={isHovered ? 1 : 0.85}
                    stroke="hsl(var(--card))"
                    strokeWidth={1.5}
                  />
                  <text
                    fontSize="9"
                    textAnchor="middle"
                    dy="2"
                    fill="white"
                    fontWeight="600"
                    style={{ pointerEvents: "none" }}
                    className="ltr"
                  >
                    {n.label.length > 6 ? n.label.slice(0, 5) + "…" : n.label}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>
      </div>
      )}

      {/* Legend */}
      {groups.length > 0 && (
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {groups.map((g) => (
          <span key={g} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: GROUP_COLORS[g] }}
            />
            {GROUP_LABEL[g]}
          </span>
        ))}
      </div>
      )}
    </div>
  )
}
