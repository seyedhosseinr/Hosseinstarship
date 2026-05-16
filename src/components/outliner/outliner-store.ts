"use client";

import { create } from "zustand";
import type { AlgorithmSurface } from "@/types/algorithm-ir";
import type { StrokeAnnotationMetadata, StrokePoint } from "@/types/annotation";

export interface SearchResult {
  kind: "surface" | "node" | "edge" | "matrix_row" | "threshold" | "trap" | "checkpoint" | "blockId";
  surfaceId: string;
  surfaceTitle: string;
  objectId?: string;
  matchField: string;
  matchText: string;
}

export interface Checkpoint extends Record<string, unknown> { id: string; surfaceId: string; surfaceTitle?: string; prompt: string; answer?: string; whyItMatters?: string }

type AnnotationOp =
  | { op: "addStroke"; payload: StrokeAnnotationMetadata; points: StrokePoint[] }
  | { op: "deleteStroke"; id: string; segmentId: string };

interface OutlinerState {
  segmentId: string | null;
  surfaces: AlgorithmSurface[];
  selectedSurfaceId: string | null;
  focusedNodeId: string | null;
  trapModeActive: boolean;
  thresholdModeActive: boolean;
  checkpointModeActive: boolean;
  focusPathActive: boolean;
  searchQuery: string;
  searchResults: SearchResult[];
  activeSearchIndex: number;
  completedSurfaceIds: Set<string>;
  surfaceTrail: string[];
  checkpointQueue: Checkpoint[];
  checkpointIndex: number;
  revealedCheckpoints: Set<string>;
  annotationMode: boolean;
  activeAnnotationType: "stroke" | "arrow" | "comment" | "delete";
  activeColor: string;
  activeWidth: number;
  loadedAnnotations: Map<string, StrokeAnnotationMetadata[]>;
  zoomLevel: number;
  setSegment: (segmentId: string, surfaces: AlgorithmSurface[]) => void;
  selectSurface: (surfaceId: string, nodeId?: string | null) => void;
  setSearch: (value: string) => void;
  setSearchResults: (results: SearchResult[]) => void;
  moveSearchCursor: (delta: number) => void;
  setFocusPath: (nodeIds: string[]) => void;
  activateFocusPath: (nodeId?: string) => void;
  exitFocusPath: () => void;
  setTrapMode: (value: boolean) => void;
  setThresholdMode: (value: boolean) => void;
  setCheckpointMode: (value: boolean) => void;
  setCheckpointQueue: (items: Checkpoint[]) => void;
  revealCheckpoint: (id: string) => void;
  nextCheckpoint: () => void;
  prevCheckpoint: () => void;
  resetFocus: () => void;
  markSurfaceComplete: (surfaceId: string) => void;
  resetCompletedForSegment: () => void;
  setAnnotationMode: (value: boolean) => void;
  loadAnnotationsForSurface: (segmentId: string, surfaceId: string) => Promise<void>;
  initCRDTForSegment: (segmentId: string) => Promise<void>;
  applyOp: (op: AnnotationOp) => Promise<void>;
  setZoom: (value: number) => void;
}

export const useOutlinerStore = create<OutlinerState>((set, get) => ({
  segmentId: null,
  surfaces: [],
  selectedSurfaceId: null,
  focusedNodeId: null,
  trapModeActive: false,
  thresholdModeActive: false,
  checkpointModeActive: false,
  focusPathActive: false,
  searchQuery: "",
  searchResults: [],
  activeSearchIndex: 0,
  completedSurfaceIds: new Set<string>(),
  surfaceTrail: [],
  checkpointQueue: [],
  checkpointIndex: 0,
  revealedCheckpoints: new Set<string>(),
  annotationMode: false,
  activeAnnotationType: "stroke",
  activeColor: "#0f766e",
  activeWidth: 3,
  loadedAnnotations: new Map(),
  zoomLevel: 1,
  setSegment: (segmentId, surfaces) => set((state) => ({
    segmentId,
    surfaces,
    selectedSurfaceId: state.segmentId === segmentId ? state.selectedSurfaceId ?? surfaces[0]?.id ?? null : surfaces[0]?.id ?? null,
    focusedNodeId: null,
    searchResults: [],
    activeSearchIndex: 0,
    surfaceTrail: [],
  })),
  selectSurface: (surfaceId, nodeId = null) => set((state) => ({
    selectedSurfaceId: surfaceId,
    focusedNodeId: nodeId,
    surfaceTrail: [surfaceId, ...state.surfaceTrail.filter((id) => id !== surfaceId)].slice(0, 8),
  })),
  setSearch: (value) => set({ searchQuery: value, activeSearchIndex: 0 }),
  setSearchResults: (results) => set({ searchResults: results, activeSearchIndex: 0 }),
  moveSearchCursor: (delta) => set((state) => ({ activeSearchIndex: state.searchResults.length ? (state.activeSearchIndex + delta + state.searchResults.length) % state.searchResults.length : 0 })),
  setFocusPath: () => set({ focusPathActive: true }),
  activateFocusPath: (nodeId) => set((state) => ({ focusPathActive: true, focusedNodeId: nodeId ?? state.focusedNodeId })),
  exitFocusPath: () => set({ focusPathActive: false }),
  setTrapMode: (value) => set({ trapModeActive: value, thresholdModeActive: value ? false : get().thresholdModeActive, checkpointModeActive: value ? false : get().checkpointModeActive }),
  setThresholdMode: (value) => set({ thresholdModeActive: value, trapModeActive: value ? false : get().trapModeActive, checkpointModeActive: value ? false : get().checkpointModeActive }),
  setCheckpointMode: (value) => set({ checkpointModeActive: value, trapModeActive: value ? false : get().trapModeActive, thresholdModeActive: value ? false : get().thresholdModeActive }),
  setCheckpointQueue: (items) => set({ checkpointQueue: items, checkpointIndex: 0, revealedCheckpoints: new Set<string>() }),
  revealCheckpoint: (id) => set((state) => ({ revealedCheckpoints: new Set([...state.revealedCheckpoints, id]) })),
  nextCheckpoint: () => set((state) => ({ checkpointIndex: state.checkpointQueue.length ? (state.checkpointIndex + 1) % state.checkpointQueue.length : 0 })),
  prevCheckpoint: () => set((state) => ({ checkpointIndex: state.checkpointQueue.length ? (state.checkpointIndex - 1 + state.checkpointQueue.length) % state.checkpointQueue.length : 0 })),
  resetFocus: () => set({ focusedNodeId: null, focusPathActive: false, trapModeActive: false, thresholdModeActive: false, checkpointModeActive: false }),
  markSurfaceComplete: (surfaceId) => set((state) => ({ completedSurfaceIds: new Set([...state.completedSurfaceIds, surfaceId]) })),
  resetCompletedForSegment: () => set({ completedSurfaceIds: new Set<string>() }),
  setAnnotationMode: (value) => set({ annotationMode: value }),
  loadAnnotationsForSurface: async () => undefined,
  initCRDTForSegment: async () => undefined,
  applyOp: async (op) => {
    if (op.op === "addStroke") {
      set((state) => {
        const surfaceId = op.payload.target.surfaceId ?? state.selectedSurfaceId ?? "surface";
        const next = new Map(state.loadedAnnotations);
        next.set(surfaceId, [...(next.get(surfaceId) ?? []), op.payload]);
        return { loadedAnnotations: next };
      });
    }
  },
  setZoom: (value) => set({ zoomLevel: Math.max(0.5, Math.min(1.5, value)) }),
}));
