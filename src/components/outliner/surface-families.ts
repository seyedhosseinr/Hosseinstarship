import type { AlgorithmRecord, AlgorithmSurface } from "@/types/algorithm-ir";

export type SurfaceFamily = "chain" | "flat" | "dag" | "trap" | "matrix";

export function readString(record: unknown, keys: string[]): string | null {
  if (!record || typeof record !== "object") return null;
  const obj = record as Record<string, unknown>;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function titleOf(record: AlgorithmRecord | null | undefined, _fallback?: string): string {
  return readString(record, ["title", "label", "trapTitle", "prompt", "condition", "variable", "decision"]) ?? "Clinical item";
}

export function linkedBlockIds(record: unknown): string[] {
  if (!record || typeof record !== "object") return [];
  const value = (record as Record<string, unknown>).linkedBlockIds;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function familyOfSurface(surface: AlgorithmSurface): SurfaceFamily {
  const shape = `${surface.algorithmShape ?? ""} ${surface.surfaceType ?? ""}`.toLowerCase();
  if (shape.includes("trap")) return "trap";
  if (shape.includes("matrix")) return "matrix";
  if (shape.includes("chain") || shape.includes("linear")) return "chain";
  if ((surface.nodes?.length ?? 0) <= 3 && (surface.edges?.length ?? 0) <= 2) return "flat";
  return "dag";
}

export function isTrapSurface(surface: AlgorithmSurface): boolean {
  return familyOfSurface(surface) === "trap" || (surface.boardTraps?.length ?? 0) > 0 || surface.nodes?.some((node) => `${node.memoryRole ?? ""} ${node.sourceTextRole ?? ""}`.toLowerCase().includes("trap"));
}

export function listSurfaceObjects(surface: AlgorithmSurface): AlgorithmRecord[] {
  return [
    ...(surface.nodes ?? []),
    ...(surface.edges ?? []),
    ...(surface.thresholds ?? []),
    ...(surface.gates ?? []),
    ...(surface.matrices ?? []),
    ...(surface.boardTraps ?? []),
    ...(surface.checkpoints ?? []),
  ] as AlgorithmRecord[];
}
