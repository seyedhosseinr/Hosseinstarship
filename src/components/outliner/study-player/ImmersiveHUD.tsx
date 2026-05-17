"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  useOutlinerStore,
  type OutlinerMode,
} from "@/components/outliner/outliner-store";
import { MODE_LABELS, toFa } from "@/components/outliner/study-player/tokens";
import { LearningPanelBody } from "@/components/outliner/study-player/LearningPanel";
import type { AlgorithmNodeV4 } from "@/types/algorithm-ir-v4";

const MODES: OutlinerMode[] = ["free", "stepwise", "traps", "recall", "exam"];
const FADE_MS = 3000;

export function ImmersiveHUD({ onBlockClick }: { onBlockClick?: (blockId: string) => void }) {
  const isImmersive         = useOutlinerStore((s) => s.isImmersive);
  const setImmersive        = useOutlinerStore((s) => s.setImmersive);
  const surfaces            = useOutlinerStore((s) => s.surfaces);
  const currentSurfaceIndex = useOutlinerStore((s) => s.currentSurfaceIndex);
  const selectedSurfaceId   = useOutlinerStore((s) => s.selectedSurfaceId);
  const gotoNextSurface     = useOutlinerStore((s) => s.gotoNextSurface);
  const gotoPrevSurface     = useOutlinerStore((s) => s.gotoPrevSurface);
  const mode                = useOutlinerStore((s) => s.mode);
  const setMode             = useOutlinerStore((s) => s.setMode);
  const focusedNodeId       = useOutlinerStore((s) => s.focusedNodeId);

  const total   = surfaces.length;
  const atFirst = currentSurfaceIndex <= 0;
  const atLast  = total === 0 || currentSurfaceIndex >= total - 1;

  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bumpVisibility = useCallback(() => {
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), FADE_MS);
  }, []);

  useEffect(() => {
    if (!isImmersive) {
      setVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    bumpVisibility();
    window.addEventListener("pointermove", bumpVisibility, { passive: true });
    window.addEventListener("pointerdown", bumpVisibility, { passive: true });
    window.addEventListener("keydown", bumpVisibility);
    return () => {
      window.removeEventListener("pointermove", bumpVisibility);
      window.removeEventListener("pointerdown", bumpVisibility);
      window.removeEventListener("keydown", bumpVisibility);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isImmersive, bumpVisibility]);

  if (!isImmersive) return null;

  const currentSurface =
    surfaces.find((s) => s.id === selectedSurfaceId) ??
    surfaces[currentSurfaceIndex] ??
    null;
  const selectedNode = currentSurface
    ? (currentSurface.nodes as unknown as AlgorithmNodeV4[]).find(
        (n) => n.nodeId === focusedNodeId,
      )
    : null;

  return (
    <>
      {/* HUD pill — top-center, auto-fades after inactivity */}
      <div
        data-outliner-immersive-hud
        className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex justify-center transition-opacity duration-500"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <div
          className="pointer-events-auto flex items-center gap-1 rounded-full px-3 py-2 shadow-2xl"
          style={{
            background: "rgba(15,23,42,0.88)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
          dir="rtl"
        >
          {/* Prev surface */}
          <button
            type="button"
            onClick={gotoPrevSurface}
            disabled={atFirst}
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/10 disabled:opacity-30"
            style={{ color: "#FFFFFF" }}
            aria-label="الگوریتم قبلی"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* Counter */}
          <span
            className="min-w-[52px] text-center text-[12px] tabular-nums"
            style={{ color: "rgba(255,255,255,0.70)" }}
          >
            {total > 0 ? `${toFa(currentSurfaceIndex + 1)} / ${toFa(total)}` : "—"}
          </span>

          {/* Next surface */}
          <button
            type="button"
            onClick={gotoNextSurface}
            disabled={atLast}
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/10 disabled:opacity-30"
            style={{ color: "#FFFFFF" }}
            aria-label="الگوریتم بعدی"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Divider */}
          <div className="mx-1 h-5 w-px" style={{ background: "rgba(255,255,255,0.15)" }} />

          {/* Mode selector */}
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as OutlinerMode)}
            className="rounded-lg bg-transparent px-2 py-1 text-[11px] font-medium outline-none"
            style={{ color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.15)" }}
            dir="rtl"
            lang="fa"
          >
            {MODES.map((m) => (
              <option key={m} value={m} style={{ background: "#0F172A", color: "#FFFFFF" }}>
                {MODE_LABELS[m]}
              </option>
            ))}
          </select>

          {/* Divider */}
          <div className="mx-1 h-5 w-px" style={{ background: "rgba(255,255,255,0.15)" }} />

          {/* Exit */}
          <button
            type="button"
            onClick={() => setImmersive(false)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium transition hover:bg-white/10"
            style={{ color: "rgba(255,255,255,0.85)" }}
            lang="fa"
          >
            <X className="h-3.5 w-3.5" />
            خروج
          </button>
        </div>
      </div>

      {/* Immersive bottom sheet — node detail panel */}
      {focusedNodeId && selectedNode && currentSurface && (
        <div
          data-outliner-immersive-sheet
          className="fixed inset-x-0 bottom-0 z-[90] max-h-[40vh] overflow-auto rounded-t-2xl shadow-2xl"
          style={{
            background: "var(--sp-surface, #FFFFFF)",
            borderTop: "1px solid var(--sp-border, #E2E8F0)",
          }}
        >
          <div
            className="mx-auto mt-2 h-1 w-10 rounded-full"
            style={{ background: "#E2E8F0" }}
          />
          <LearningPanelBody
            surface={currentSurface}
            node={selectedNode}
            onBlockClick={onBlockClick}
          />
        </div>
      )}
    </>
  );
}
