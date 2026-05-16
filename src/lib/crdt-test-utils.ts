/**
 * crdt-test-utils.ts
 * Dev-only CRDT merge simulation utilities.
 * Import this module lazily (dynamic import) to exclude from production bundles.
 *
 * Usage:
 *   const { simulateTwoClientMerge } = await import('@/lib/crdt-test-utils');
 *   await simulateTwoClientMerge();
 */

import * as Y from "yjs";
import type { BookmarkAnnotation } from "@/types/annotation";

/**
 * simulateTwoClientMerge()
 * ─────────────────────────
 * Creates two independent Y.Doc instances (docA and docB), each adding a
 * different annotation, then merges docB's changes into docA.
 *
 * Acceptance criterion: after merge, both annotations appear in docA — the
 * LWW / concurrent-insert invariant of Yjs Y.Map.
 *
 * Steps:
 *  1. docA adds annotation "ann-client-A"
 *  2. Capture docA state vector (fork point)
 *  3. docB receives docA's full state
 *  4. docB adds annotation "ann-client-B" independently
 *  5. docB's delta (since fork) is applied to docA
 *  6. Assert both annotations present in docA
 */
export async function simulateTwoClientMerge(): Promise<void> {
  // ── Step 1: docA adds its annotation ────────────────────────────────────────
  const docA = new Y.Doc();
  const mapA = docA.getMap<string>("annotations");

  const annA: BookmarkAnnotation = {
    id: "ann-client-A",
    type: "bookmark",
    target: {
      segmentId: "test-segment",
      kind: "surface",
      surfaceId: "surface-1",
      objectId: "surface-1",
    },
    createdAt: Date.now(),
  };
  docA.transact(() => {
    mapA.set(annA.id, JSON.stringify(annA));
  });

  // ── Step 2: Capture docA state vector before docB diverges ──────────────────
  const stateVectorA = Y.encodeStateVector(docA);
  const snapshotA = Y.encodeStateAsUpdate(docA);

  // ── Step 3: docB starts from docA's full state ───────────────────────────────
  const docB = new Y.Doc();
  Y.applyUpdate(docB, snapshotA);
  const mapB = docB.getMap<string>("annotations");

  // ── Step 4: docB adds its own annotation independently ───────────────────────
  const annB: BookmarkAnnotation = {
    id: "ann-client-B",
    type: "bookmark",
    target: {
      segmentId: "test-segment",
      kind: "surface",
      surfaceId: "surface-1",
      objectId: "surface-1",
    },
    createdAt: Date.now() + 1,
  };
  docB.transact(() => {
    mapB.set(annB.id, JSON.stringify(annB));
  });

  // ── Step 5: Merge docB's delta (since fork) into docA ────────────────────────
  // encodeStateAsUpdate(docB, stateVectorA) returns only what docB added after fork
  const deltaFromB = Y.encodeStateAsUpdate(docB, stateVectorA);
  Y.applyUpdate(docA, deltaFromB);

  // ── Step 6: Assert both annotations present ──────────────────────────────────
  const hasA = mapA.has("ann-client-A");
  const hasB = mapA.has("ann-client-B");
  const total = mapA.size;

  const result = {
    "ann-client-A present": hasA,
    "ann-client-B present": hasB,
    "total annotations in merged docA": total,
    passed: hasA && hasB && total === 2,
  };

  console.log("[CRDT test] simulateTwoClientMerge result:", result);

  if (!result.passed) {
    throw new Error(
      `[CRDT test] merge failed — expected both annotations, got ${total}. ` +
        `hasA=${String(hasA)}, hasB=${String(hasB)}`,
    );
  }

  // Clean up
  docA.destroy();
  docB.destroy();
}
