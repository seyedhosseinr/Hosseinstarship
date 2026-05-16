'use client'

import { useRef, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import type { Group } from 'three'
import type { SphereNode } from './KnowledgeSphere'

function masteryColor(mastery: number): string {
  if (mastery > 85) return '#0F766E'
  if (mastery >= 50) return '#B45309'
  if (mastery > 0) return '#B91C1C'
  return '#9E9890'
}

/* Build stable sphere-distributed positions */
function buildPositions(nodes: SphereNode[]): Record<string, [number, number, number]> {
  const pos: Record<string, [number, number, number]> = {}
  nodes.forEach((node, i) => {
    const phi = Math.acos(-1 + (2 * i) / Math.max(nodes.length, 1))
    const theta = Math.sqrt(nodes.length * Math.PI) * phi
    const r = 1.8
    pos[node.id] = [
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi),
    ]
  })
  return pos
}

/* ── Rotating group with nodes + edges ───────────────────────────── */
function SphereGroup({ nodes }: { nodes: SphereNode[] }) {
  const groupRef = useRef<Group>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const lastActivity = useRef(Date.now())

  const positions = useRef(buildPositions(nodes)).current

  useEffect(() => {
    const reset = () => { lastActivity.current = Date.now() }
    window.addEventListener('mousemove', reset, { passive: true })
    window.addEventListener('touchstart', reset, { passive: true })
    return () => {
      window.removeEventListener('mousemove', reset)
      window.removeEventListener('touchstart', reset)
    }
  }, [])

  useFrame((_, delta) => {
    if (!groupRef.current) return
    const idle = Date.now() - lastActivity.current > 60_000
    if (!idle && !document.hidden && hoveredId === null) {
      groupRef.current.rotation.y += delta * 0.22
    }
  })

  return (
    <group ref={groupRef}>
      {/* Edges */}
      {nodes.flatMap(node =>
        node.connections
          .filter(tid => tid > node.id) // draw each edge once
          .map(targetId => {
            const from = positions[node.id]
            const to   = positions[targetId]
            if (!from || !to) return null
            return (
              <Line
                key={`${node.id}-${targetId}`}
                points={[from, to]}
                color="#CFC8BC"
                lineWidth={0.6}
                transparent
                opacity={0.35}
              />
            )
          })
      )}

      {/* Nodes */}
      {nodes.map(node => {
        const pos = positions[node.id]
        if (!pos) return null
        const radius = 0.045 + (node.priorityScore / 100) * 0.11
        const color  = masteryColor(node.mastery)
        const hovered = hoveredId === node.id

        return (
          <mesh
            key={node.id}
            position={pos}
            scale={hovered ? 1.45 : 1}
            onPointerEnter={() => setHoveredId(node.id)}
            onPointerLeave={() => setHoveredId(null)}
          >
            <sphereGeometry args={[radius, 18, 18]} />
            <meshStandardMaterial
              color={color}
              roughness={0.25}
              metalness={0.12}
              emissive={hovered ? color : '#000000'}
              emissiveIntensity={hovered ? 0.35 : 0}
            />
            {hovered && (
              <Html
                position={[0, radius + 0.1, 0]}
                style={{ pointerEvents: 'none' }}
                zIndexRange={[10, 20]}
              >
                <div
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 7,
                    padding: '5px 10px',
                    fontSize: 11,
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    fontFamily: 'var(--font-sans)',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.13)',
                    direction: 'rtl',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{node.chapter}</div>
                  <div
                    style={{
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      marginTop: 2,
                      direction: 'ltr',
                    }}
                  >
                    Retention: {node.mastery}%
                  </div>
                </div>
              </Html>
            )}
          </mesh>
        )
      })}
    </group>
  )
}

/* ── Exported scene ───────────────────────────────────────────────── */
export default function Scene3D({ nodes }: { nodes: SphereNode[] }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 48 }}
      style={{ background: 'transparent', width: '100%', height: '100%' }}
      gl={{ alpha: true, antialias: true }}
      aria-label="نقشه دانش فصل‌های کمپبل"
    >
      <ambientLight intensity={0.65} />
      <pointLight position={[3, 3, 3]} intensity={0.9} />
      <pointLight position={[-3, -2, -2]} intensity={0.3} color="#0F766E" />
      <fogExp2 args={['#F4F2EC', 0.12]} />
      <SphereGroup nodes={nodes} />
    </Canvas>
  )
}
