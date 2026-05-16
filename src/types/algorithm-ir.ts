import type { AlgorithmIRV4, AlgorithmSurfaceV4, AlgorithmNodeV4, AlgorithmEdgeV4, ThresholdV4, GateV4, DecisionMatrixV4, BoardTrapV4, CheckpointV4 } from "./algorithm-ir-v4";

export type AlgorithmRecord = Record<string, unknown> & {
  id?: string;
  nodeId?: string;
  edgeId?: string;
  thresholdId?: string;
  gateId?: string;
  matrixId?: string;
  trapId?: string;
  checkpointId?: string;
  title?: string;
  label?: string;
  detail?: string;
  linkedBlockIds?: string[];
};

export type AlgorithmNode = AlgorithmNodeV4 & AlgorithmRecord & { id: string };
export type AlgorithmEdge = AlgorithmEdgeV4 & AlgorithmRecord & { id: string };
export type AlgorithmThreshold = ThresholdV4 & AlgorithmRecord & { id?: string };
export type AlgorithmGate = GateV4 & AlgorithmRecord & { id?: string };
export type AlgorithmMatrix = DecisionMatrixV4 & AlgorithmRecord & { id?: string };
export type AlgorithmBoardTrap = BoardTrapV4 & AlgorithmRecord & { id?: string };
export type AlgorithmCheckpoint = CheckpointV4 & AlgorithmRecord & { id?: string };

export type AlgorithmSurface = Omit<AlgorithmSurfaceV4, "nodes" | "edges" | "thresholds" | "gates" | "matrices" | "boardTraps" | "checkpoints"> & {
  id: string;
  nodes: AlgorithmNode[];
  edges: AlgorithmEdge[];
  thresholds?: AlgorithmThreshold[];
  gates?: AlgorithmGate[];
  matrices?: AlgorithmMatrix[];
  boardTraps?: AlgorithmBoardTrap[];
  checkpoints?: AlgorithmCheckpoint[];
  mediaRefs?: AlgorithmRecord[];
};

export type AlgorithmIR = Omit<AlgorithmIRV4, "surfaces"> & {
  surfaces: AlgorithmSurface[];
};

function withId<T extends Record<string, unknown>>(item: T, keys: string[], fallback: string): T & { id: string } {
  const id = keys.map((key) => item[key]).find((value): value is string => typeof value === "string" && value.length > 0) ?? fallback;
  return { ...item, id };
}

export function normalizeAlgorithmIR(input: AlgorithmIRV4 | AlgorithmIR): AlgorithmIR {
  return {
    ...input,
    surfaces: (input.surfaces ?? []).map((surface, surfaceIndex) => {
      const normalizedSurface = withId(surface as unknown as Record<string, unknown>, ["id", "surfaceId"], `surface-${surfaceIndex + 1}`) as unknown as AlgorithmSurface;
      return {
        ...normalizedSurface,
        nodes: (surface.nodes ?? []).map((node, nodeIndex) => withId(node as unknown as Record<string, unknown>, ["id", "nodeId"], `${normalizedSurface.id}-node-${nodeIndex + 1}`) as AlgorithmNode),
        edges: (surface.edges ?? []).map((edge, edgeIndex) => withId(edge as unknown as Record<string, unknown>, ["id", "edgeId"], `${normalizedSurface.id}-edge-${edgeIndex + 1}`) as AlgorithmEdge),
        thresholds: (surface.thresholds ?? []).map((item, index) => withId(item as unknown as Record<string, unknown>, ["id", "thresholdId"], `${normalizedSurface.id}-threshold-${index + 1}`) as AlgorithmThreshold),
        gates: (surface.gates ?? []).map((item, index) => withId(item as unknown as Record<string, unknown>, ["id", "gateId"], `${normalizedSurface.id}-gate-${index + 1}`) as AlgorithmGate),
        matrices: (surface.matrices ?? []).map((item, index) => withId(item as unknown as Record<string, unknown>, ["id", "matrixId"], `${normalizedSurface.id}-matrix-${index + 1}`) as AlgorithmMatrix),
        boardTraps: (surface.boardTraps ?? []).map((item, index) => withId(item as unknown as Record<string, unknown>, ["id", "trapId"], `${normalizedSurface.id}-trap-${index + 1}`) as AlgorithmBoardTrap),
        checkpoints: (surface.checkpoints ?? []).map((item, index) => withId(item as unknown as Record<string, unknown>, ["id", "checkpointId"], `${normalizedSurface.id}-checkpoint-${index + 1}`) as AlgorithmCheckpoint),
      };
    }),
  };
}
