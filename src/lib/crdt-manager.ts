/**
 * crdt-manager.ts
 * BROWSER-ONLY. Never import in Server Components or API Routes.
 *
 * CRDT_CHOICE: Yjs (^13.6.30) via y-indexeddb persistence.
 * Decision: neither yjs nor loro-crdt was present in package.json at time of
 * implementation (May 15 2026). Yjs chosen because:
 *   1. Pure JS — no WASM cold-start latency
 *   2. y-indexeddb: battle-tested IndexedDB persistence
 *   3. Largest ecosystem (y-websocket, y-webrtc for future providers)
 *
 * FUTURE_MIGRATION: Document ID is `outliner:${segmentId}`.
 * When auth exposes a stable userId client-side, change to:
 *   `outliner:${userId}:${segmentId}`
 *
 * SYNC_PROVIDER: Attach WebsocketProvider when sync server is available:
 *   import { WebsocketProvider } from 'y-websocket';
 *   const wsProvider = new WebsocketProvider(WS_URL, docId, ydoc);
 *
 * ── CRDT-not-ready safety ────────────────────────────────────────────────────
 * All public op methods (addAnnotation, updateAnnotation, …) are safe to call
 * before init() resolves. Calls are queued in `pendingOps` and flushed
 * automatically when init() completes. This prevents the divergence scenario:
 *   PGLite write succeeds → CRDT not ready → op lost permanently.
 *
 * Queue is cleared on segment change (re-init) to avoid applying stale ops
 * from segment A into segment B's document. PGLite remains the source of truth
 * in that edge case; hydratePGLiteFromCRDT re-applies the reverse direction on
 * next load.
 *
 * ── Stroke blob policy (v1) ──────────────────────────────────────────────────
 * Raw StrokePoint[] arrays are NOT stored in yStrokes in v1.
 * Rationale: a 200-point stroke serializes to ~10 KB JSON. Yjs stores deltas
 * in its internal journal, multiplying storage over time.
 * v1: CRDT stores StrokeAnnotationMetadata (bounds, color, strokeBlobRef) only.
 *     Stroke blobs live in OPFS/localStorage managed by annotation-repository.
 * TODO (v2): Implement chunked stroke blob sync via binary attachments or
 *     a dedicated y-websocket binary message protocol.
 *
 * ── Source of truth contract ─────────────────────────────────────────────────
 * - Normal writes: applyAnnotationOp → PGLite (primary) + CRDT (sync layer).
 * - Segment init: CRDT hydrates PGLite only for rows where CRDT.updatedAt >
 *   PGLite.updatedAt (checked in upsertAnnotationMeta). Newer local PGLite
 *   rows are never overwritten by older CRDT data.
 *
 * ── Map structure ────────────────────────────────────────────────────────────
 *  yAnnotations : Y.Map<string>   annotationId → JSON(Annotation metadata)
 *  yStrokes     : Y.Map<string>   RESERVED — not populated in v1 (see above)
 *  yBookmarks   : Y.Map<boolean>  objectId → true (absent = not bookmarked)
 *  yMarkers     : Y.Map<string>   objectId → 'important' | 'resolved'
 *  yCompletion  : Y.Map<boolean>  surfaceId → true
 *  yFocusPaths  : Y.Map<string[]> key → nodeId[]
 */

import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";

import type { Annotation, StrokePoint } from "@/types/annotation";

class CRDTManager {
  private ydoc: Y.Doc | null = null;
  private persistence: IndexeddbPersistence | null = null;
  private _segmentId: string | null = null;
  private _ready = false;

  // ── Pending-op queue ──────────────────────────────────────────────────────
  // Ops that arrive before init() resolves are queued here and flushed when
  // the Yjs doc is ready. Cleared on segment change to prevent cross-segment
  // contamination.
  private pendingOps: Array<() => void> = [];

  private enqueueOrRun(op: () => void): void {
    if (this._ready && this.ydoc) {
      op();
    } else {
      this.pendingOps.push(op);
    }
  }

  private flushPending(): void {
    const ops = this.pendingOps.splice(0);
    for (const op of ops) {
      try {
        op();
      } catch (err) {
        console.warn("[CRDTManager] pending op flush error:", err);
      }
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  async init(segmentId: string): Promise<void> {
    if (typeof window === "undefined") return;

    // Skip re-init for the same segment (idempotent)
    if (this._segmentId === segmentId && this._ready) return;

    // Tear down: clear queue before destroying old doc to prevent stale ops
    // from a previous segment being applied to the new segment's doc.
    this._ready = false;
    this.pendingOps = [];

    if (this.persistence) {
      try { await this.persistence.destroy(); } catch { /* ignore */ }
      this.persistence = null;
    }
    if (this.ydoc) {
      try { this.ydoc.destroy(); } catch { /* ignore */ }
      this.ydoc = null;
    }

    this._segmentId = segmentId;
    const docId = `outliner:${segmentId}`;

    try {
      this.ydoc = new Y.Doc();
      this.persistence = new IndexeddbPersistence(docId, this.ydoc);

      // Wait for IndexedDB to load persisted state (max 5s fallback)
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          console.warn("[CRDTManager] IndexedDB sync timeout — proceeding without persisted state");
          resolve();
        }, 5000);
        this.persistence!.once("synced", () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this._ready = true;
      // Flush any annotation ops that arrived during init
      this.flushPending();
    } catch (err) {
      console.warn("[CRDTManager] init failed — CRDT disabled for this session:", err);
      this._ready = false;
      this.pendingOps = []; // discard — can't apply without a doc
    }
  }

  isReady(): boolean {
    return this._ready && this.ydoc !== null;
  }

  getSegmentId(): string | null {
    return this._segmentId;
  }

  // ── Private map accessors ─────────────────────────────────────────────────
  // Only call from within an enqueueOrRun closure (ydoc is guaranteed non-null)

  private yAnnotations(): Y.Map<string> {
    return this.ydoc!.getMap("annotations");
  }

  // yStrokes is reserved for v2 chunked sync — not populated in v1
  // private yStrokes(): Y.Map<string> { return this.ydoc!.getMap("strokes"); }

  private yBookmarks(): Y.Map<boolean> {
    return this.ydoc!.getMap("bookmarks");
  }

  private yMarkers(): Y.Map<string> {
    return this.ydoc!.getMap("markers");
  }

  private yCompletion(): Y.Map<boolean> {
    return this.ydoc!.getMap("completion");
  }

  private yFocusPaths(): Y.Map<string[]> {
    return this.ydoc!.getMap("focusPaths");
  }

  // ── Annotation ops ────────────────────────────────────────────────────────

  addAnnotation(annotation: Annotation): void {
    this.enqueueOrRun(() => {
      this.ydoc!.transact(() => {
        this.yAnnotations().set(annotation.id, JSON.stringify(annotation));
      });
    });
  }

  updateAnnotation(id: string, patch: Partial<Record<string, unknown>>): void {
    this.enqueueOrRun(() => {
      const existing = this.yAnnotations().get(id);
      if (!existing) return;
      this.ydoc!.transact(() => {
        try {
          const parsed = JSON.parse(existing) as Record<string, unknown>;
          this.yAnnotations().set(
            id,
            JSON.stringify({ ...parsed, ...patch, updatedAt: Date.now() }),
          );
        } catch { /* corrupt entry — skip */ }
      });
    });
  }

  deleteAnnotation(id: string): void {
    this.enqueueOrRun(() => {
      this.ydoc!.transact(() => {
        this.yAnnotations().delete(id);
      });
    });
  }

  // ── Stroke blob ops — DISABLED in v1 ─────────────────────────────────────
  // Raw StrokePoint[] are not stored in Yjs in v1 (see module header).
  // These methods are no-ops. Stroke data lives in OPFS only.
  // TODO (v2): implement chunked binary attachment sync here.

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  addStroke(_id: string, _points: StrokePoint[]): void {
    // v1 no-op: stroke points stay in OPFS, not Yjs
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  deleteStroke(_id: string): void {
    // v1 no-op: deletion is handled by deleteAnnotation (metadata) + OPFS cleanup
  }

  // ── Bookmark ops ──────────────────────────────────────────────────────────

  setBookmark(objectId: string, value: boolean): void {
    this.enqueueOrRun(() => {
      this.ydoc!.transact(() => {
        if (value) {
          this.yBookmarks().set(objectId, true);
        } else {
          this.yBookmarks().delete(objectId);
        }
      });
    });
  }

  // ── Marker ops ────────────────────────────────────────────────────────────

  setMarker(objectId: string, value: "important" | "resolved" | null): void {
    this.enqueueOrRun(() => {
      this.ydoc!.transact(() => {
        if (value === null) {
          this.yMarkers().delete(objectId);
        } else {
          this.yMarkers().set(objectId, value);
        }
      });
    });
  }

  // ── Completion ops ────────────────────────────────────────────────────────

  setSurfaceComplete(surfaceId: string, value: boolean): void {
    this.enqueueOrRun(() => {
      this.ydoc!.transact(() => {
        if (value) {
          this.yCompletion().set(surfaceId, true);
        } else {
          this.yCompletion().delete(surfaceId);
        }
      });
    });
  }

  // ── Focus path ops ────────────────────────────────────────────────────────

  saveFocusPath(key: string, nodeIds: string[]): void {
    this.enqueueOrRun(() => {
      this.ydoc!.transact(() => {
        this.yFocusPaths().set(key, nodeIds);
      });
    });
  }

  deleteFocusPath(key: string): void {
    this.enqueueOrRun(() => {
      this.ydoc!.transact(() => {
        this.yFocusPaths().delete(key);
      });
    });
  }

  // ── Bulk reads (for hydration) ────────────────────────────────────────────

  getAllAnnotations(): Map<string, Annotation> {
    if (!this.isReady()) return new Map();
    const result = new Map<string, Annotation>();
    this.yAnnotations().forEach((value: string, key: string) => {
      try {
        result.set(key, JSON.parse(value) as Annotation);
      } catch { /* skip corrupt entries */ }
    });
    return result;
  }

  // ── Change observers ──────────────────────────────────────────────────────

  onAnnotationsChange(
    cb: (annotations: Map<string, Annotation>) => void,
  ): () => void {
    if (!this.isReady()) return () => {};
    const handler = () => cb(this.getAllAnnotations());
    this.yAnnotations().observe(handler);
    return () => this.yAnnotations().unobserve(handler);
  }

  onCompletionChange(
    cb: (completion: Map<string, boolean>) => void,
  ): () => void {
    if (!this.isReady()) return () => {};
    const handler = () => {
      const map = new Map<string, boolean>();
      this.yCompletion().forEach((v: boolean, k: string) => map.set(k, v));
      cb(map);
    };
    this.yCompletion().observe(handler);
    return () => this.yCompletion().unobserve(handler);
  }

  // ── Snapshot / debug ──────────────────────────────────────────────────────

  getStateVector(): Uint8Array {
    if (!this.ydoc) return new Uint8Array();
    return Y.encodeStateVector(this.ydoc);
  }

  applyRemoteUpdate(update: Uint8Array): void {
    if (!this.ydoc) return;
    Y.applyUpdate(this.ydoc, update);
  }

  exportSnapshot(): Uint8Array {
    if (!this.ydoc) return new Uint8Array();
    return Y.encodeStateAsUpdate(this.ydoc);
  }

  getDocSizeBytes(): number {
    return this.exportSnapshot().byteLength;
  }
}

export const crdtManager = new CRDTManager();
