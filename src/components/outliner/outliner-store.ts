"use client";

import { create } from "zustand";
import type { AlgorithmIR, AlgorithmSurface } from "@/types/algorithm-ir";
import type { StrokeAnnotationMetadata, StrokePoint } from "@/types/annotation";
import {
  applyAnnotationOp,
  loadAnnotationsForSurface as repoLoadAnnotations,
  hydratePGLiteFromCRDT,
} from "@/lib/outliner/annotation-repository";
import { crdtManager } from "@/lib/crdt-manager";

// ── Canonical study mode (single source of truth) ────────────────────────────
export type OutlinerMode = "free" | "stepwise" | "traps" | "recall" | "exam";

// Migration map: old StepwiseMode keys → OutlinerMode
const MODE_MIGRATION: Record<string, OutlinerMode> = {
  explore:  "free",
  step:     "stepwise",
  trap:     "traps",
  recall:   "recall",
  exam:     "exam",
  weakness: "recall",
};

// Backward-compat bridge: OutlinerMode → legacy StepwiseMode (for existing renderers)
const MODE_TO_STEPWISE: Record<OutlinerMode, StepwiseMode | null> = {
  free:     null,
  stepwise: "step",
  traps:    "trap",
  recall:   "recall",
  exam:     "exam",
};

// ── Legacy StepwiseMode (kept for backward compat with renderers.tsx) ─────────
export type StepwiseMode = "explore" | "step" | "trap" | "recall" | "exam" | "weakness";

export interface SearchResult {
  kind: "surface" | "node" | "edge" | "matrix_row" | "threshold" | "trap" | "checkpoint" | "blockId";
  surfaceId: string;
  surfaceTitle: string;
  objectId?: string;
  matchField: string;
  matchText: string;
}

export interface Checkpoint extends Record<string, unknown> {
  id: string;
  surfaceId: string;
  surfaceTitle?: string;
  prompt: string;
  answer?: string;
  whyItMatters?: string;
}

type AnnotationOp =
  | { op: "addStroke"; payload: StrokeAnnotationMetadata; points: StrokePoint[] }
  | { op: "deleteStroke"; id: string; segmentId: string };

interface OutlinerState {
  // ── Canonical navigation + mode (Prompt 2) ──────────────────────────────
  mode: OutlinerMode;
  currentSegment: AlgorithmIR | null;
  currentSurfaceIndex: number;
  selectedNodeId: string | null;    // mirrors focusedNodeId; canonical for new components
  isNavigatorOpen: boolean;
  isFocusMode: boolean;

  // ── Existing fields (kept for backward compat) ──────────────────────────
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
  crdtReady: boolean;
  stepwiseMode: StepwiseMode | null;

  // ── Immersive Graph Mode (Prompt 4) ─────────────────────────────────────
  isImmersive: boolean;
  setImmersive: (on: boolean) => void;
  toggleImmersive: () => void;

  // ── Recall / exam session reveal state (not persisted) ──────────────────
  revealedNodeLabels: Set<string>;
  revealedTestablePoints: Set<string>;

  // ── New actions (Prompt 2) ───────────────────────────────────────────────
  setMode: (next: OutlinerMode) => void;
  setSurfaceIndex: (i: number) => void;
  gotoNextSurface: () => void;
  gotoPrevSurface: () => void;
  setSelectedNodeId: (id: string | null) => void;
  setNavigatorOpen: (open: boolean) => void;
  setFocusMode: (on: boolean) => void;

  // ── Existing actions ─────────────────────────────────────────────────────
  setSegment: (segmentId: string, surfaces: AlgorithmSurface[], ir?: AlgorithmIR) => void;
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
  setCrdtReady: (value: boolean) => void;
  applyOp: (op: AnnotationOp) => Promise<void>;
  setZoom: (value: number) => void;
  setStepwiseMode: (mode: StepwiseMode | null) => void;
  revealNodeLabel: (nodeId: string) => void;
  revealTestablePoint: (nodeId: string) => void;
}

export const useOutlinerStore = create<OutlinerState>((set, get) => ({
  // ── New canonical fields ─────────────────────────────────────────────────
  mode: "free",
  currentSegment: null,
  currentSurfaceIndex: 0,
  selectedNodeId: null,
  isNavigatorOpen: false,
  isFocusMode: false,
  isImmersive: false,

  // ── Existing initial state ────────────────────────────────────────────────
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
  crdtReady: false,
  stepwiseMode: null,
  revealedNodeLabels: new Set<string>(),
  revealedTestablePoints: new Set<string>(),

  setSegment: (segmentId, surfaces, ir) =>
    set((state) => {
      const isSameSegment = state.segmentId === segmentId;
      const defaultSurfaceId = surfaces[0]?.id ?? null;
      const newSelectedId = isSameSegment
        ? (state.selectedSurfaceId ?? defaultSurfaceId)
        : defaultSurfaceId;
      const newIndex = isSameSegment
        ? Math.min(state.currentSurfaceIndex, Math.max(0, surfaces.length - 1))
        : 0;
      return {
        segmentId,
        surfaces,
        currentSegment: ir ?? state.currentSegment,
        currentSurfaceIndex: newIndex,
        selectedSurfaceId: newSelectedId,
        focusedNodeId: null,
        selectedNodeId: null,
        searchResults: [],
        activeSearchIndex: 0,
        surfaceTrail: [],
      };
    }),

  selectSurface: (surfaceId, nodeId = null) =>
    set((state) => {
      const idx = state.surfaces.findIndex((s) => s.id === surfaceId);
      return {
        selectedSurfaceId: surfaceId,
        currentSurfaceIndex: idx >= 0 ? idx : state.currentSurfaceIndex,
        focusedNodeId: nodeId,
        selectedNodeId: nodeId,
        surfaceTrail: [surfaceId, ...state.surfaceTrail.filter((id) => id !== surfaceId)].slice(0, 8),
      };
    }),

  // ── New action implementations ────────────────────────────────────────────
  setMode: (next) =>
    set({
      mode: next,
      stepwiseMode: MODE_TO_STEPWISE[next],
      trapModeActive: next === "traps",
      thresholdModeActive: false,
      checkpointModeActive: false,
      revealedNodeLabels: new Set<string>(),
      revealedTestablePoints: new Set<string>(),
    }),

  setSurfaceIndex: (i) =>
    set((state) => {
      const surface = state.surfaces[i];
      if (!surface) return {};
      return {
        currentSurfaceIndex: i,
        selectedSurfaceId: surface.id,
        focusedNodeId: null,
        selectedNodeId: null,
        surfaceTrail: [surface.id, ...state.surfaceTrail.filter((id) => id !== surface.id)].slice(0, 8),
        revealedNodeLabels: new Set<string>(),
        revealedTestablePoints: new Set<string>(),
      };
    }),

  gotoNextSurface: () =>
    set((state) => {
      const next = Math.min(state.currentSurfaceIndex + 1, state.surfaces.length - 1);
      if (next === state.currentSurfaceIndex) return {};
      const surface = state.surfaces[next];
      if (!surface) return {};
      return {
        currentSurfaceIndex: next,
        selectedSurfaceId: surface.id,
        focusedNodeId: null,
        selectedNodeId: null,
        surfaceTrail: [surface.id, ...state.surfaceTrail.filter((id) => id !== surface.id)].slice(0, 8),
        revealedNodeLabels: new Set<string>(),
        revealedTestablePoints: new Set<string>(),
      };
    }),

  gotoPrevSurface: () =>
    set((state) => {
      const prev = Math.max(state.currentSurfaceIndex - 1, 0);
      if (prev === state.currentSurfaceIndex) return {};
      const surface = state.surfaces[prev];
      if (!surface) return {};
      return {
        currentSurfaceIndex: prev,
        selectedSurfaceId: surface.id,
        focusedNodeId: null,
        selectedNodeId: null,
        surfaceTrail: [surface.id, ...state.surfaceTrail.filter((id) => id !== surface.id)].slice(0, 8),
        revealedNodeLabels: new Set<string>(),
        revealedTestablePoints: new Set<string>(),
      };
    }),

  setSelectedNodeId: (id) => set({ focusedNodeId: id, selectedNodeId: id }),

  setNavigatorOpen: (open) => set({ isNavigatorOpen: open }),

  setFocusMode: (on) => set({ isFocusMode: on }),

  setImmersive: (on) => set({ isImmersive: on }),
  toggleImmersive: () => set((state) => ({ isImmersive: !state.isImmersive })),

  // ── Existing actions ─────────────────────────────────────────────────────
  setSearch: (value) => set({ searchQuery: value, activeSearchIndex: 0 }),
  setSearchResults: (results) => set({ searchResults: results, activeSearchIndex: 0 }),
  moveSearchCursor: (delta) =>
    set((state) => ({
      activeSearchIndex: state.searchResults.length
        ? (state.activeSearchIndex + delta + state.searchResults.length) % state.searchResults.length
        : 0,
    })),

  setFocusPath: () => set({ focusPathActive: true }),
  activateFocusPath: (nodeId) =>
    set((state) => ({ focusPathActive: true, focusedNodeId: nodeId ?? state.focusedNodeId })),
  exitFocusPath: () => set({ focusPathActive: false }),

  setTrapMode: (value) =>
    set({
      trapModeActive: value,
      thresholdModeActive: value ? false : get().thresholdModeActive,
      checkpointModeActive: value ? false : get().checkpointModeActive,
    }),
  setThresholdMode: (value) =>
    set({
      thresholdModeActive: value,
      trapModeActive: value ? false : get().trapModeActive,
      checkpointModeActive: value ? false : get().checkpointModeActive,
    }),
  setCheckpointMode: (value) =>
    set({
      checkpointModeActive: value,
      trapModeActive: value ? false : get().trapModeActive,
      thresholdModeActive: value ? false : get().thresholdModeActive,
    }),

  setCheckpointQueue: (items) =>
    set({ checkpointQueue: items, checkpointIndex: 0, revealedCheckpoints: new Set<string>() }),
  revealCheckpoint: (id) =>
    set((state) => ({ revealedCheckpoints: new Set([...state.revealedCheckpoints, id]) })),
  nextCheckpoint: () =>
    set((state) => ({
      checkpointIndex: state.checkpointQueue.length
        ? (state.checkpointIndex + 1) % state.checkpointQueue.length
        : 0,
    })),
  prevCheckpoint: () =>
    set((state) => ({
      checkpointIndex: state.checkpointQueue.length
        ? (state.checkpointIndex - 1 + state.checkpointQueue.length) % state.checkpointQueue.length
        : 0,
    })),

  resetFocus: () =>
    set({
      focusedNodeId: null,
      selectedNodeId: null,
      focusPathActive: false,
      trapModeActive: false,
      thresholdModeActive: false,
      checkpointModeActive: false,
    }),

  markSurfaceComplete: (surfaceId) => {
    // localStorage write is unconditional — persists regardless of CRDT readiness
    const segmentId = get().segmentId;
    if (segmentId) {
      try {
        const key = `outliner:completed:${segmentId}`;
        const prev = JSON.parse(localStorage.getItem(key) ?? "[]") as string[];
        if (!prev.includes(surfaceId)) {
          localStorage.setItem(key, JSON.stringify([...prev, surfaceId]));
        }
      } catch { /* quota exceeded — state still updated in memory */ }
    }
    // CRDT mirror: queued if not ready, fires when init() resolves
    crdtManager.setSurfaceComplete(surfaceId, true);
    set((state) => ({ completedSurfaceIds: new Set([...state.completedSurfaceIds, surfaceId]) }));
  },

  resetCompletedForSegment: () => set({ completedSurfaceIds: new Set<string>() }),
  setAnnotationMode: (value) => set({ annotationMode: value }),

  loadAnnotationsForSurface: async (segmentId, surfaceId) => {
    try {
      const annotations = await repoLoadAnnotations(segmentId, surfaceId);
      const strokes = annotations.filter(
        (a): a is StrokeAnnotationMetadata => a.type === "stroke" || a.type === "arrow",
      );
      set((state) => {
        const next = new Map(state.loadedAnnotations);
        next.set(surfaceId, strokes);
        return { loadedAnnotations: next };
      });
    } catch (err) {
      console.warn("[outliner-store] loadAnnotationsForSurface failed:", err);
    }
  },

  initCRDTForSegment: async (segmentId) => {
    set({ crdtReady: false });
    try {
      await crdtManager.init(segmentId);
      await hydratePGLiteFromCRDT(segmentId);
      set({ crdtReady: crdtManager.isReady() });
    } catch (err) {
      console.warn("[outliner-store] initCRDTForSegment failed:", err);
      set({ crdtReady: false });
    }
  },

  setCrdtReady: (value) => set({ crdtReady: value }),

  applyOp: async (op) => {
    try {
      // Full AnnotationOp goes through the repository (PGLite + CRDT)
      await applyAnnotationOp(op as Parameters<typeof applyAnnotationOp>[0]);
      if (op.op === "addStroke") {
        set((state) => {
          const surfaceId = op.payload.target.surfaceId ?? state.selectedSurfaceId ?? "surface";
          const next = new Map(state.loadedAnnotations);
          next.set(surfaceId, [...(next.get(surfaceId) ?? []), op.payload]);
          return { loadedAnnotations: next };
        });
      }
      if (op.op === "deleteStroke") {
        set((state) => {
          const next = new Map(state.loadedAnnotations);
          for (const [surfaceId, list] of next) {
            next.set(surfaceId, list.filter((a) => a.id !== op.id));
          }
          return { loadedAnnotations: next };
        });
      }
    } catch (err) {
      console.warn("[outliner-store] applyOp failed:", err);
    }
  },

  setZoom: (value) => set({ zoomLevel: Math.max(0.5, Math.min(1.5, value)) }),
  setStepwiseMode: (mode) => set({ stepwiseMode: mode }),
  revealNodeLabel: (nodeId) =>
    set((state) => ({ revealedNodeLabels: new Set([...state.revealedNodeLabels, nodeId]) })),
  revealTestablePoint: (nodeId) =>
    set((state) => ({ revealedTestablePoints: new Set([...state.revealedTestablePoints, nodeId]) })),
}));
