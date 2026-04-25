/**
 * use-edge-import.ts — React hook adapter for the edge import worker.
 *
 * WHAT THIS IS
 * ─────────────
 * A thin adapter between any React component and the raw Worker/postMessage
 * protocol in edge-import.worker.ts. Components call useEdgeImport() and
 * receive a stable { start, abort, reset, phase, progress, summary, error }
 * interface. They never touch Worker construction, event wiring, or cleanup.
 *
 * PROGRESS DESIGN
 * ────────────────
 * Worker messages (throttled to 120ms by the worker) → progressRef (no render).
 * requestAnimationFrame tick → reads progressRef → React state (one render/frame).
 * Net: at most 60 renders/second regardless of file size or worker message rate.
 *
 * MEMORY / LIFECYCLE
 * ───────────────────
 * useEffect cleanup terminates the worker on component unmount. start() also
 * terminates any running worker before spawning a new one, so the caller never
 * has to manage the previous run.
 *
 * The hook re-exports the worker message types so callers only need one import.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  WorkerToMain,
  ProgressPayload,
  CompleteSummary,
  InitStreamPayload,
  SerializedWorkerError,
} from "./edge-import.worker";

// Re-export so callers import from one place instead of two.
export type { ProgressPayload, CompleteSummary, InitStreamPayload, SerializedWorkerError };

// ── Phase type ────────────────────────────────────────────────────────────────

/**
 * Lifecycle phases for an import run.
 *
 *  idle → (start called) → initializing → (WORKER_READY) → streaming
 *      → (COMPLETE) → complete
 *      → (ERROR)    → error
 *      → (ABORTED)  → aborted
 *
 * reset() from any phase returns to idle.
 */
export type EdgeImportPhase =
  | "idle"
  | "initializing" // Worker spawned, waiting for WORKER_READY
  | "streaming"    // WORKER_READY received, parse+write in progress
  | "complete"     // COMPLETE received
  | "error"        // ERROR received
  | "aborted";     // ABORTED received (user-initiated cancel)

// ── Hook return type ──────────────────────────────────────────────────────────

export interface UseEdgeImportReturn {
  phase: EdgeImportPhase;
  /** rAF-synced progress — at most one React render per animation frame. */
  progress: ProgressPayload;
  summary: CompleteSummary | null;
  /** Set only in "error" phase. Formatted as "[CODE] message". */
  error: string | null;
  /**
   * Start a new import run.
   * Terminates any running worker first (safe to call without resetting).
   */
  start(file: File, payload: InitStreamPayload): void;
  /**
   * Request cooperative abort. The worker finishes its current batch write,
   * then posts ABORTED and terminates. Phase becomes "aborted".
   */
  abort(): void;
  /**
   * Hard reset to idle. Terminates any running worker immediately.
   * Use this after complete/error/aborted to allow a new run.
   */
  reset(): void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EMPTY_PROGRESS: ProgressPayload = {
  bytesProcessed: 0,
  fileSizeBytes: 1,
  recordsParsed: 0,
  recordsWritten: 0,
  batchesCommitted: 0,
  percent: 0,
};

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * @param onComplete Optional callback fired when COMPLETE is received.
 *                   Use for parent-level side effects (refresh history, toast, etc.)
 */
export function useEdgeImport(onComplete?: () => void): UseEdgeImportReturn {
  const [phase,    setPhase]    = useState<EdgeImportPhase>("idle");
  const [summary,  setSummary]  = useState<CompleteSummary | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressPayload>(EMPTY_PROGRESS);

  // Refs that survive re-renders without causing them.
  const workerRef   = useRef<Worker | null>(null);
  const progressRef = useRef<ProgressPayload>(EMPTY_PROGRESS);
  const rafRef      = useRef<number>(0);

  // ── rAF loop ────────────────────────────────────────────────────────────────

  const startRaf = useCallback(() => {
    const tick = () => {
      setProgress({ ...progressRef.current });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopRaf = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    // Final sync: ensure UI shows exact terminal values.
    setProgress({ ...progressRef.current });
  }, []);

  // ── Cleanup on unmount ───────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      workerRef.current?.terminate();
    };
  }, []);

  // ── start ────────────────────────────────────────────────────────────────────

  const start = useCallback(
    (file: File, payload: InitStreamPayload) => {
      // Terminate any prior run so we never have two workers alive.
      cancelAnimationFrame(rafRef.current);
      workerRef.current?.terminate();

      // Reset transient state.
      const initProgress: ProgressPayload = { ...EMPTY_PROGRESS, fileSizeBytes: file.size };
      progressRef.current = initProgress;
      setProgress(initProgress);
      setSummary(null);
      setError(null);
      setPhase("initializing");

      // Spawn the worker. The bundler (Next.js/webpack/Turbopack) detects this
      // new Worker(new URL(...)) pattern and emits a separate worker chunk.
      const worker = new Worker(
        new URL("./edge-import.worker.ts", import.meta.url),
        { type: "module", name: "edge-import" },
      );
      workerRef.current = worker;

      // ── Message handler ────────────────────────────────────────────────────
      worker.onmessage = (event: MessageEvent<WorkerToMain>) => {
        const msg = event.data;
        switch (msg.type) {
          case "WORKER_READY":
            setPhase("streaming");
            startRaf();
            break;

          case "PROGRESS":
            // Write to ref only — rAF loop propagates to React state.
            progressRef.current = msg.payload;
            break;

          case "COMPLETE":
            stopRaf();
            setSummary(msg.payload);
            setPhase("complete");
            worker.terminate();
            workerRef.current = null;
            onComplete?.();
            break;

          case "ERROR":
            stopRaf();
            setError(`[${msg.code}] ${msg.error.message}`);
            setPhase("error");
            worker.terminate();
            workerRef.current = null;
            break;

          case "ABORTED":
            stopRaf();
            setPhase("aborted");
            worker.terminate();
            workerRef.current = null;
            break;
        }
      };

      // Uncaught worker exceptions (syntax errors, missing modules, etc.)
      worker.onerror = (err) => {
        stopRaf();
        setError(err.message ?? "Worker crashed");
        setPhase("error");
        worker.terminate();
        workerRef.current = null;
      };

      // Transfer the ReadableStream as a Transferable — zero-copy from main thread
      // to worker. After this postMessage call, the main thread can no longer read
      // the stream; the worker owns it.
      // Transfer the ReadableStream as a Transferable — zero-copy.
      // ReadableStream is in the Transferable union (TypeScript DOM lib ≥ 5.0).
      const stream = file.stream();
      worker.postMessage(
        { type: "INIT_STREAM", payload, stream },
        [stream],
      );
    },
    [startRaf, stopRaf, onComplete],
  );

  // ── abort ─────────────────────────────────────────────────────────────────

  const abort = useCallback(() => {
    // Cooperative: worker finishes current batch write, then terminates cleanly.
    workerRef.current?.postMessage({ type: "ABORT", reason: "user_cancel" });
  }, []);

  // ── reset ─────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    workerRef.current?.terminate();
    workerRef.current = null;
    progressRef.current = EMPTY_PROGRESS;
    setPhase("idle");
    setSummary(null);
    setError(null);
    setProgress(EMPTY_PROGRESS);
  }, []);

  return { phase, progress, summary, error, start, abort, reset };
}
