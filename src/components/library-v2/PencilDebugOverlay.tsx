"use client";

import { useEffect, useState } from "react";

interface PencilDebugOverlayProps {
  mode: "select" | "draw";
}

type Phase = "idle" | "down" | "move" | "up" | "cancel";

interface SampleState {
  pointerType: string;
  pointerId: number | null;
  pressure: number;
  tiltX: number;
  tiltY: number;
  layer: string;
  phase: Phase;
}

const INITIAL: SampleState = {
  pointerType: "—",
  pointerId: null,
  pressure: 0,
  tiltX: 0,
  tiltY: 0,
  layer: "—",
  phase: "idle",
};

/**
 * Floating pointer/pressure inspector. Mount only when URL has
 * ?debug=pencil. Useful for verifying pen-selection + drawing flow on a
 * real iPad without devtools.
 */
export function PencilDebugOverlay({ mode }: PencilDebugOverlayProps) {
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState<SampleState>(INITIAL);
  const [activePenId, setActivePenId] = useState<number | null>(null);
  const [selLen, setSelLen] = useState(0);
  const [selSource, setSelSource] = useState<string>("—");
  const [watcherState, setWatcherState] = useState<
    "idle" | "pending-settle" | "suppressed"
  >("idle");
  const [paintStats, setPaintStats] = useState<{
    painted: number;
    viaOffsets: number;
    viaQuote: number;
    missed: number;
    fallback: boolean;
  } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") === "pencil") setEnabled(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const describeLayer = (t: EventTarget | null): string => {
      if (!(t instanceof Element)) return "—";
      if (t.closest("canvas")) return "canvas";
      if (t.closest("[data-reader-content]")) return "reader-content";
      if (t.closest("[data-reader-stage]")) return "reader-stage";
      return t.tagName.toLowerCase();
    };

    const snap = (e: PointerEvent, phase: Phase) => ({
      pointerType: e.pointerType,
      pointerId: e.pointerId,
      pressure: e.pressure,
      tiltX: e.tiltX,
      tiltY: e.tiltY,
      layer: describeLayer(e.target),
      phase,
    });

    let lastSource: "pointer" | "keyboard" | "other" = "other";
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "pen") setActivePenId(e.pointerId);
      setState(snap(e, "down"));
      lastSource = "pointer";
      const target = e.target as Element | null;
      if (target?.closest("[data-reader-content]")) {
        setWatcherState("suppressed");
      }
    };
    const onMove = (e: PointerEvent) => {
      setState(snap(e, "move"));
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType === "pen") setActivePenId(null);
      setState(snap(e, e.type === "pointercancel" ? "cancel" : "up"));
      // After pointerup the watcher schedules its 120ms trailing settle.
      setWatcherState((s) => (s === "suppressed" ? "pending-settle" : s));
    };
    const onSelChange = () => {
      const len = window.getSelection()?.toString().length ?? 0;
      setSelLen(len);
      setSelSource(lastSource);
      lastSource = "other";
    };
    const onKeyDown = () => {
      lastSource = "keyboard";
    };
    const onSettled = () => {
      setWatcherState("idle");
    };
    const onCleared = () => {
      setWatcherState("idle");
    };
    const onPainted = (e: Event) => {
      const detail = (e as CustomEvent<{
        painted: number;
        viaOffsets: number;
        viaQuote: number;
        missed: number;
        fallback: boolean;
      }>).detail;
      if (detail) setPaintStats(detail);
    };

    document.addEventListener("pointerdown", onDown);
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    document.addEventListener("selectionchange", onSelChange);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("reader:selection-settled", onSettled);
    document.addEventListener("reader:selection-cleared", onCleared);
    document.addEventListener("reader:highlights-painted", onPainted);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      document.removeEventListener("selectionchange", onSelChange);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("reader:selection-settled", onSettled);
      document.removeEventListener("reader:selection-cleared", onCleared);
      document.removeEventListener("reader:highlights-painted", onPainted);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 left-4 z-50 rounded-md bg-black/85 px-3 py-2 font-mono text-[10.5px] leading-snug text-white shadow-lg"
      style={{ direction: "ltr" }}
    >
      <div>mode: <b>{mode}</b></div>
      <div>phase: <b>{state.phase}</b></div>
      <div>type: <b>{state.pointerType}</b></div>
      <div>activePen: <b>{activePenId ?? "—"}</b></div>
      <div>pressure: <b>{state.pressure.toFixed(3)}</b></div>
      <div>tilt: <b>{state.tiltX}°, {state.tiltY}°</b></div>
      <div>layer: <b>{state.layer}</b></div>
      <div>sel: <b>{selLen} ch</b></div>
      <div>selSrc: <b>{selSource}</b></div>
      <div>watcher: <b>{watcherState}</b></div>
      <div>
        paint:{" "}
        <b>
          {paintStats
            ? `${paintStats.painted}✓ ${paintStats.missed}✗ ${
                paintStats.fallback ? "fb" : "css"
              } (${paintStats.viaOffsets}/${paintStats.viaQuote})`
            : "—"}
        </b>
      </div>
    </div>
  );
}
