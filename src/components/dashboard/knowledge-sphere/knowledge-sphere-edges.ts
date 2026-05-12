import type { KnowledgeEdge, KnowledgeNode } from "./knowledge-sphere.types";
import { clampUnit } from "./knowledge-sphere-metrics";

export interface ManualKnowledgeEdgeInput {
  sourceId: string;
  targetId: string;
  kind: "prerequisite_manual" | "shared_tag" | "same_chapter";
  weight?: number;
}

export interface CoMissedKnowledgeEdgeInput {
  sourceId: string;
  targetId: string;
  count: number;
  weight?: number;
}

export interface KnowledgeEdgeBuildOptions {
  manualEdges?: ManualKnowledgeEdgeInput[];
  coMissedPairs?: CoMissedKnowledgeEdgeInput[];
  maxSharedTagEdges?: number;
  maxTotalEdges?: number;
}

export function buildKnowledgeEdges(
  nodes: KnowledgeNode[],
  options: KnowledgeEdgeBuildOptions = {}
): KnowledgeEdge[] {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges: KnowledgeEdge[] = [];

  edges.push(...buildCurriculumOrderEdges(nodes));
  edges.push(...buildSameChapterEdges(nodes));
  edges.push(...buildSharedTagEdges(nodes, options.maxSharedTagEdges ?? 36));
  edges.push(...buildCoMissedEdges(options.coMissedPairs ?? [], nodeIds));
  edges.push(...buildManualEdges(options.manualEdges ?? [], nodeIds));

  return dedupeEdges(edges)
    .filter((edge) => edge.sourceId !== edge.targetId && edge.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, options.maxTotalEdges ?? 90);
}

function buildCurriculumOrderEdges(nodes: KnowledgeNode[]): KnowledgeEdge[] {
  const chapterNodes = nodes
    .filter((node) => node.kind === "chapter")
    .filter((node) => typeof node.order === "number")
    .sort(compareStableNodes);

  const edges: KnowledgeEdge[] = [];

  for (let i = 0; i < chapterNodes.length - 1; i += 1) {
    const source = chapterNodes[i];
    const target = chapterNodes[i + 1];

    edges.push({
      id: `curriculum:${source.id}:${target.id}`,
      sourceId: source.id,
      targetId: target.id,
      kind: "curriculum_order",
      weight: 0.32,
    });
  }

  return edges;
}

function buildSameChapterEdges(nodes: KnowledgeNode[]): KnowledgeEdge[] {
  const topicsByChapter = new Map<string, KnowledgeNode[]>();

  for (const node of nodes) {
    if (node.kind !== "topic" || !node.chapterId) continue;
    const bucket = topicsByChapter.get(node.chapterId) ?? [];
    bucket.push(node);
    topicsByChapter.set(node.chapterId, bucket);
  }

  const edges: KnowledgeEdge[] = [];

  for (const topicNodes of topicsByChapter.values()) {
    const sorted = [...topicNodes].sort(compareStableNodes);

    // Sequential links avoid the old clique explosion: 20 topics => 19 edges, not 190.
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const source = sorted[i];
      const target = sorted[i + 1];
      edges.push({
        id: `same-chapter:${source.id}:${target.id}`,
        sourceId: source.id,
        targetId: target.id,
        kind: "same_chapter",
        weight: 0.38,
      });
    }
  }

  return edges;
}

function buildSharedTagEdges(nodes: KnowledgeNode[], maxEdges: number): KnowledgeEdge[] {
  const eligibleNodes = nodes.filter((node) => node.tags.length > 0 && node.metrics.hasRealSignal);
  const candidates: KnowledgeEdge[] = [];

  for (let i = 0; i < eligibleNodes.length; i += 1) {
    for (let j = i + 1; j < eligibleNodes.length; j += 1) {
      const source = eligibleNodes[i];
      const target = eligibleNodes[j];
      const sharedTags = source.tags.filter((tag) => target.tags.includes(tag));

      if (sharedTags.length === 0) continue;

      const bothWeak =
        source.metrics.mastery < 65 ||
        target.metrics.mastery < 65 ||
        source.metrics.wrongMcqCount > 0 ||
        target.metrics.wrongMcqCount > 0;

      candidates.push({
        id: `tag:${source.id}:${target.id}:${sharedTags.sort().join("-")}`,
        sourceId: source.id,
        targetId: target.id,
        kind: "shared_tag",
        weight: Math.min(1, 0.18 + sharedTags.length * 0.12 + (bothWeak ? 0.12 : 0)),
      });
    }
  }

  return candidates.sort((a, b) => b.weight - a.weight).slice(0, maxEdges);
}

function buildCoMissedEdges(
  pairs: CoMissedKnowledgeEdgeInput[],
  nodeIds: Set<string>
): KnowledgeEdge[] {
  // Important: this is now explicit input only. We no longer fake co_missed from weak+sharedTag.
  return pairs
    .filter((pair) => nodeIds.has(pair.sourceId) && nodeIds.has(pair.targetId) && pair.count > 0)
    .map((pair) => ({
      id: `co-missed:${pair.sourceId}:${pair.targetId}`,
      sourceId: pair.sourceId,
      targetId: pair.targetId,
      kind: "co_missed",
      weight: pair.weight ?? Math.min(1, 0.45 + Math.log1p(pair.count) / 5),
    }));
}

function buildManualEdges(
  manualEdges: ManualKnowledgeEdgeInput[],
  nodeIds: Set<string>
): KnowledgeEdge[] {
  return manualEdges
    .filter((edge) => nodeIds.has(edge.sourceId) && nodeIds.has(edge.targetId))
    .map((edge) => ({
      id: `manual:${edge.kind}:${edge.sourceId}:${edge.targetId}`,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      kind: edge.kind,
      weight: clampUnit(edge.weight ?? 0.75),
    }));
}

function dedupeEdges(edges: KnowledgeEdge[]): KnowledgeEdge[] {
  const seen = new Set<string>();
  const result: KnowledgeEdge[] = [];

  for (const edge of edges) {
    const orderedPair = [edge.sourceId, edge.targetId].sort().join(":");
    const key = `${edge.kind}:${orderedPair}`;

    if (seen.has(key)) continue;

    seen.add(key);
    result.push(edge);
  }

  return result;
}

function compareStableNodes(a: KnowledgeNode, b: KnowledgeNode): number {
  const orderA = typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
  const orderB = typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;

  if (orderA !== orderB) return orderA - orderB;
  return a.id.localeCompare(b.id, "en");
}
