import type { AlgorithmRecord, AlgorithmSurface } from "@/types/algorithm-ir";

export type SurfaceFamily = "chain" | "flat" | "dag" | "trap" | "matrix";

export type SurfaceObjectGroup =
  | "nodes"
  | "edges"
  | "matrices"
  | "thresholds"
  | "gates"
  | "boardTraps"
  | "followUpRules"
  | "complicationRules"
  | "checkpoints"
  | "mediaLinks"
  | "mermaid";

export type SurfaceRendererKey =
  | "decision_tree"
  | "branching_pathway"
  | "linear_pathway"
  | "matrix"
  | "ladder"
  | "timeline"
  | "contrast_map"
  | "chain"
  | "cluster"
  | "combined"
  | "trap_map"
  | "gate"
  | "follow_up"
  | "complication_escalation"
  | "media_recognition"
  | "generic_graph"
  | "card_grid";

export interface SurfaceObjectGroups {
  nodes: number;
  edges: number;
  matrices: number;
  thresholds: number;
  gates: number;
  boardTraps: number;
  followUpRules: number;
  complicationRules: number;
  checkpoints: number;
  mediaLinks: number;
  mermaid: number;
  majorGroupCount: number;
}

export interface OrderedStudyItem {
  id: string;
  kind: SurfaceObjectGroup | "matrixRow";
  label: string;
  record: AlgorithmRecord;
  nodeId?: string;
}

export function readString(record: unknown, keys: string[]): string | null {
  if (!record || typeof record !== "object") return null;
  const obj = record as Record<string, unknown>;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function titleOf(record: AlgorithmRecord | null | undefined, fallback?: string): string {
  return readString(record, ["title", "label", "trapTitle", "prompt", "condition", "variable", "decision"]) ?? fallback ?? "Clinical item";
}

export function linkedBlockIds(record: unknown): string[] {
  if (!record || typeof record !== "object") return [];
  const value = (record as Record<string, unknown>).linkedBlockIds;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function linkedNodeIds(record: unknown): string[] {
  if (!record || typeof record !== "object") return [];
  const value = (record as Record<string, unknown>).linkedNodeIds;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function recordArray(value: unknown): AlgorithmRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is AlgorithmRecord => Boolean(item) && typeof item === "object")
    : [];
}

export function objectId(record: unknown, fallback: string): string {
  if (!record || typeof record !== "object") return fallback;
  const obj = record as Record<string, unknown>;
  for (const key of ["id", "nodeId", "edgeId", "thresholdId", "gateId", "matrixId", "trapId", "checkpointId", "mediaId"]) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}

export function getSurfaceObjectGroups(surface: AlgorithmSurface): SurfaceObjectGroups {
  const mediaCount = (surface.mediaLinks?.length ?? 0) + recordArray(surface.mediaRefs).length;
  const groups: SurfaceObjectGroups = {
    nodes: surface.nodes?.length ?? 0,
    edges: surface.edges?.length ?? 0,
    matrices: surface.matrices?.length ?? 0,
    thresholds: surface.thresholds?.length ?? 0,
    gates: surface.gates?.length ?? 0,
    boardTraps: surface.boardTraps?.length ?? 0,
    followUpRules: recordArray(surface.followUpRules).length,
    complicationRules: recordArray(surface.complicationRules).length,
    checkpoints: surface.checkpoints?.length ?? 0,
    mediaLinks: mediaCount,
    mermaid: typeof surface.mermaid === "string" && surface.mermaid.trim() ? 1 : 0,
    majorGroupCount: 0,
  };
  groups.majorGroupCount = [
    groups.nodes,
    groups.matrices,
    groups.thresholds,
    groups.gates,
    groups.boardTraps,
    groups.followUpRules,
    groups.complicationRules,
    groups.checkpoints,
    groups.mediaLinks,
    groups.mermaid,
  ].filter((count) => count > 0).length;
  return groups;
}

export function getPrimaryObjectGroup(surface: AlgorithmSurface): SurfaceObjectGroup | null {
  const groups = getSurfaceObjectGroups(surface);
  const entries: Array<[SurfaceObjectGroup, number]> = [
    ["matrices", groups.matrices],
    ["boardTraps", groups.boardTraps],
    ["gates", groups.gates],
    ["thresholds", groups.thresholds],
    ["followUpRules", groups.followUpRules],
    ["complicationRules", groups.complicationRules],
    ["nodes", groups.nodes],
    ["checkpoints", groups.checkpoints],
    ["mediaLinks", groups.mediaLinks],
    ["mermaid", groups.mermaid],
  ];
  return entries.sort((a, b) => b[1] - a[1]).find(([, count]) => count > 0)?.[0] ?? null;
}

function surfaceText(surface: AlgorithmSurface): string {
  return `${surface.surfaceType ?? ""} ${surface.algorithmShape ?? ""} ${surface.semanticRole ?? ""}`.toLowerCase();
}

export function hasDominantMatrix(surface: AlgorithmSurface): boolean {
  const groups = getSurfaceObjectGroups(surface);
  const text = surfaceText(surface);
  return groups.matrices > 0 && (
    text.includes("matrix") ||
    groups.matrices >= Math.max(groups.boardTraps, groups.gates, groups.thresholds, groups.followUpRules, groups.complicationRules)
  );
}

export function hasDominantTrap(surface: AlgorithmSurface): boolean {
  const groups = getSurfaceObjectGroups(surface);
  const text = surfaceText(surface);
  return groups.boardTraps > 0 && (text.includes("trap") || groups.boardTraps >= Math.max(groups.matrices, groups.gates, groups.thresholds));
}

export function hasDominantTimeline(surface: AlgorithmSurface): boolean {
  const groups = getSurfaceObjectGroups(surface);
  const text = surfaceText(surface);
  return groups.followUpRules > 0 || text.includes("timeline") || text.includes("follow_up");
}

export function hasDominantLadder(surface: AlgorithmSurface): boolean {
  const groups = getSurfaceObjectGroups(surface);
  const text = surfaceText(surface);
  const ladderNodes = (surface.nodes ?? []).filter((node) => ["threshold", "risk_group", "classification"].includes(`${node.nodeType ?? ""}`)).length;
  const ladderEdges = (surface.edges ?? []).filter((edge) => `${edge.edgeType ?? ""}`.includes("threshold") || `${edge.edgeType ?? ""}`.includes("risk")).length;
  return text.includes("ladder") || text.includes("risk_stratification") || (groups.thresholds > 0 && ladderNodes + ladderEdges > 0);
}

export function getLinkedObjectsForNode(surface: AlgorithmSurface, node: { nodeId?: string; linkedBlockIds?: string[] }) {
  const nodeId = node.nodeId;
  const blocks = new Set(node.linkedBlockIds ?? []);
  const matches = (record: unknown): boolean => {
    const nodeLinks = linkedNodeIds(record);
    if (nodeId && nodeLinks.includes(nodeId)) return true;
    const blockLinks = linkedBlockIds(record);
    return blockLinks.some((blockId) => blocks.has(blockId));
  };
  const matrixRows = (surface.matrices ?? []).flatMap((matrix, matrixIndex) =>
    (matrix.rows ?? [])
      .filter(matches)
      .map((row, rowIndex) => ({
        ...row,
        id: `${objectId(matrix, `matrix-${matrixIndex + 1}`)}-row-${rowIndex + 1}`,
        title: matrix.title,
      }) as AlgorithmRecord),
  );
  return {
    thresholds: (surface.thresholds ?? []).filter(matches),
    gates: (surface.gates ?? []).filter(matches),
    matrixRows,
    boardTraps: (surface.boardTraps ?? []).filter(matches),
    followUpRules: recordArray(surface.followUpRules).filter(matches),
    complicationRules: recordArray(surface.complicationRules).filter(matches),
    checkpoints: (surface.checkpoints ?? []).filter(matches),
    mediaLinks: [...recordArray(surface.mediaLinks), ...recordArray(surface.mediaRefs)].filter(matches),
  };
}

export function getOrderedStudyItems(surface: AlgorithmSurface): OrderedStudyItem[] {
  const items: OrderedStudyItem[] = [];
  const pushMany = (kind: SurfaceObjectGroup, records: AlgorithmRecord[], keys: string[]) => {
    records.forEach((record, index) => {
      items.push({
        id: objectId(record, `${surface.id}-${kind}-${index + 1}`),
        kind,
        label: readString(record, keys) ?? titleOf(record, `${kind} ${index + 1}`),
        record,
        nodeId: typeof record.nodeId === "string" ? record.nodeId : undefined,
      });
    });
  };
  pushMany("nodes", surface.nodes ?? [], ["label", "title"]);
  pushMany("thresholds", surface.thresholds ?? [], ["variable", "value", "decisionImpact"]);
  pushMany("gates", surface.gates ?? [], ["title", "entryCondition"]);
  (surface.matrices ?? []).forEach((matrix, matrixIndex) => {
    (matrix.rows ?? []).forEach((row, rowIndex) => {
      const record = row as AlgorithmRecord;
      items.push({
        id: `${objectId(matrix, `${surface.id}-matrix-${matrixIndex + 1}`)}-row-${rowIndex + 1}`,
        kind: "matrixRow",
        label: readString(record, ["condition", "decision", "reason"]) ?? `Matrix row ${rowIndex + 1}`,
        record: { ...record, title: matrix.title },
      });
    });
  });
  pushMany("followUpRules", recordArray(surface.followUpRules), ["startPoint", "interval", "monitor", "trigger", "actionIfTriggered", "title"]);
  pushMany("complicationRules", recordArray(surface.complicationRules), ["recognition", "severity", "immediateAction", "escalationPath", "title"]);
  pushMany("boardTraps", surface.boardTraps ?? [], ["trapTitle", "wrongPath", "correctPath"]);
  pushMany("checkpoints", surface.checkpoints ?? [], ["prompt", "answer"]);
  pushMany("mediaLinks", [...recordArray(surface.mediaLinks), ...recordArray(surface.mediaRefs)], ["title", "label", "caption", "uri"]);
  return items;
}

export function familyOfSurface(surface: AlgorithmSurface): SurfaceFamily {
  const shape = `${surface.algorithmShape ?? ""} ${surface.surfaceType ?? ""}`.toLowerCase();
  if (shape.includes("trap")) return "trap";
  if (shape.includes("matrix")) return "matrix";
  if (shape.includes("chain") || shape.includes("linear")) return "chain";
  if ((surface.nodes?.length ?? 0) <= 3 && (surface.edges?.length ?? 0) <= 2) return "flat";
  return "dag";
}

export function getSurfaceRendererKey(surface: AlgorithmSurface): SurfaceRendererKey {
  const surfaceType = `${surface.surfaceType ?? ""}`.toLowerCase();
  const shape = `${surface.algorithmShape ?? ""}`.toLowerCase();
  const text = surfaceText(surface);
  const groups = getSurfaceObjectGroups(surface);

  const bySurfaceType: Partial<Record<string, SurfaceRendererKey>> = {
    diagnostic_pathway: "decision_tree",
    management_pathway: "decision_tree",
    staging_pathway: hasDominantLadder(surface) ? "ladder" : "decision_tree",
    treatment_selection: "decision_tree",
    procedure_selection: "decision_tree",
    postoperative_pathway: hasDominantTimeline(surface) ? "timeline" : "decision_tree",
    failure_pathway: "decision_tree",
    classification_tree: groups.edges > 0 ? "branching_pathway" : "cluster",
    differential_algorithm: hasDominantTrap(surface) ? "contrast_map" : hasDominantMatrix(surface) ? "matrix" : "branching_pathway",
    threshold_ladder: "ladder",
    risk_stratification: "ladder",
    decision_matrix: "matrix",
    board_trap_map: "contrast_map",
    follow_up_pathway: "timeline",
    complication_escalation: "complication_escalation",
    indication_gate: "gate",
    contraindication_gate: "gate",
    eligibility_gate: "gate",
    escalation_gate: "gate",
    deescalation_gate: "gate",
    concept_chain: "linear_pathway",
    mechanism_chain: "linear_pathway",
    recognition_chain: "linear_pathway",
    classification_chain: "linear_pathway",
    board_memory_chain: groups.checkpoints > groups.nodes ? "cluster" : "linear_pathway",
    media_recognition: "media_recognition",
    combined_algorithm: "combined",
  };
  if (bySurfaceType[surfaceType]) return bySurfaceType[surfaceType];

  const byShape: Partial<Record<string, SurfaceRendererKey>> = {
    decision_tree: "decision_tree",
    branching_pathway: "branching_pathway",
    linear_pathway: "linear_pathway",
    matrix: "matrix",
    ladder: "ladder",
    timeline: "timeline",
    contrast_map: "contrast_map",
    chain: "linear_pathway",
    cluster: "cluster",
    combined: "combined",
  };
  if (byShape[shape]) return byShape[shape];

  if (hasDominantMatrix(surface)) return "matrix";
  if (hasDominantTrap(surface)) return "contrast_map";
  if (groups.gates > 0 && groups.gates >= groups.nodes) return "gate";
  if (hasDominantTimeline(surface)) return "timeline";
  if (hasDominantLadder(surface)) return "ladder";
  if (groups.complicationRules > 0 || text.includes("complication")) return "complication_escalation";
  if (groups.mediaLinks > 0 && groups.nodes === 0) return "media_recognition";
  if (groups.majorGroupCount >= 3) return "combined";
  if (shape.includes("chain") || shape.includes("linear")) return "linear_pathway";
  if (groups.nodes > 0 && groups.edges > 0) return "generic_graph";
  if (groups.nodes > 0) return "chain";
  if (groups.matrices > 0) return "matrix";
  if (groups.majorGroupCount > 1) return "combined";
  return "card_grid";
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
    ...recordArray(surface.followUpRules),
    ...recordArray(surface.complicationRules),
    ...(surface.checkpoints ?? []),
    ...recordArray(surface.mediaLinks),
    ...recordArray(surface.mediaRefs),
  ] as AlgorithmRecord[];
}
