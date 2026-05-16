import type { AlgorithmSurface } from "@/types/algorithm-ir";
import { algorithmDisplayTitle, nodeDisplayTitle } from "./navigation-labels";
import type { Checkpoint, SearchResult } from "./outliner-store";

function includes(hay: unknown, needle: string): boolean {
  return typeof hay === "string" && hay.toLowerCase().includes(needle);
}

export function buildSearchResults(surfaces: AlgorithmSurface[], query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: SearchResult[] = [];
  for (const surface of surfaces) {
    const surfaceTitle = algorithmDisplayTitle(surface);
    if (includes(surfaceTitle, q) || includes(surface.clinicalQuestion, q)) {
      results.push({ kind: "surface", surfaceId: surface.id, surfaceTitle, matchField: "title", matchText: surfaceTitle });
    }
    for (const node of surface.nodes ?? []) {
      const title = nodeDisplayTitle(node) ?? "";
      if (includes(title, q) || includes(node.detail, q)) results.push({ kind: "node", surfaceId: surface.id, surfaceTitle, objectId: node.id, matchField: "node", matchText: title });
    }
    for (const threshold of surface.thresholds ?? []) {
      const text = `${threshold.variable ?? ""} ${threshold.value ?? ""} ${threshold.conditionText ?? ""}`;
      if (includes(text, q)) results.push({ kind: "threshold", surfaceId: surface.id, surfaceTitle, objectId: threshold.id, matchField: "threshold", matchText: text });
    }
    for (const trap of surface.boardTraps ?? []) {
      const text = `${trap.trapTitle ?? ""} ${trap.wrongPath ?? ""} ${trap.correctPath ?? ""}`;
      if (includes(text, q)) results.push({ kind: "trap", surfaceId: surface.id, surfaceTitle, objectId: trap.id, matchField: "trap", matchText: text });
    }
    for (const checkpoint of surface.checkpoints ?? []) {
      const text = `${checkpoint.prompt ?? ""} ${checkpoint.answer ?? ""}`;
      if (includes(text, q)) results.push({ kind: "checkpoint", surfaceId: surface.id, surfaceTitle, objectId: checkpoint.id, matchField: "checkpoint", matchText: text });
    }
  }
  return results.slice(0, 80);
}

export function collectCheckpoints(surfaces: AlgorithmSurface[]): Checkpoint[] {
  return surfaces.flatMap((surface) => (surface.checkpoints ?? []).map((checkpoint, index) => ({
    id: checkpoint.id ?? `${surface.id}-checkpoint-${index + 1}`,
    surfaceId: surface.id,
    surfaceTitle: algorithmDisplayTitle(surface),
    prompt: checkpoint.prompt,
    answer: checkpoint.answer,
    whyItMatters: checkpoint.whyItMatters,
  })));
}

export function computeFocusPath(surface: AlgorithmSurface | null | undefined, objectId: string | null | undefined): string[] {
  if (!surface || !objectId) return [];
  const edge = surface.edges?.find((item) => item.id === objectId || item.edgeId === objectId);
  if (edge) return [edge.from, edge.to].filter(Boolean);
  return [objectId];
}
