// Minimal structural interfaces — AlgorithmNode/Edge satisfy both
interface IRNode { nodeId: string }
interface IREdge { from: string; to: string }

/**
 * BFS topological layering.
 * Nodes with multiple parents appear only after all parents are visited.
 * Cycle-safe: remaining unvisited nodes go into a final overflow layer.
 */
export function computeDepthLayers(nodes: IRNode[], edges: IREdge[]): string[][] {
  const adj            = new Map<string, string[]>()
  const parentCount    = new Map<string, number>()
  const visitedParents = new Map<string, Set<string>>()

  for (const n of nodes) {
    adj.set(n.nodeId, [])
    parentCount.set(n.nodeId, 0)
    visitedParents.set(n.nodeId, new Set())
  }
  for (const e of edges) {
    adj.get(e.from)?.push(e.to)
    parentCount.set(e.to, (parentCount.get(e.to) ?? 0) + 1)
  }

  const layers: string[][] = []
  const globalVisited = new Set<string>()
  let frontier = nodes
    .filter(n => (parentCount.get(n.nodeId) ?? 0) === 0)
    .map(n => n.nodeId)
  if (frontier.length === 0) frontier = [nodes[0]?.nodeId].filter((id): id is string => Boolean(id))

  while (frontier.length > 0) {
    layers.push([...frontier])
    frontier.forEach(id => globalVisited.add(id))
    const next: string[] = []
    for (const id of frontier) {
      for (const neighbor of (adj.get(id) ?? [])) {
        if (globalVisited.has(neighbor)) continue
        visitedParents.get(neighbor)?.add(id)
        const ready = (visitedParents.get(neighbor)?.size ?? 0) >= (parentCount.get(neighbor) ?? 1)
        if (ready && !next.includes(neighbor)) next.push(neighbor)
      }
    }
    frontier = next
  }

  const remaining = nodes.map(n => n.nodeId).filter(id => !globalVisited.has(id))
  if (remaining.length > 0) layers.push(remaining)

  return layers
}

export function buildNodeLayerMap(layers: string[][]): Map<string, number> {
  const map = new Map<string, number>()
  layers.forEach((layer, i) => layer.forEach(id => map.set(id, i)))
  return map
}

/**
 * Per-node WebGL depth state float.
 * 0.0 = hidden (not yet reached)
 * 1.0 = visited (past layer, de-emphasized)
 * 2.0 = active (current layer — full color + pulse)
 */
export function computeDepthStates(
  orderedNodeIds: string[],
  nodeLayerMap: Map<string, number>,
  currentDepth: number,
): Float32Array {
  const buf = new Float32Array(orderedNodeIds.length)
  orderedNodeIds.forEach((id, i) => {
    const layer = nodeLayerMap.get(id) ?? -1
    buf[i] = layer < 0             ? 0.0
           : layer < currentDepth  ? 1.0
           : layer === currentDepth ? 2.0
           : 0.0
  })
  return buf
}
