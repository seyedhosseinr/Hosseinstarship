"use client";

import type { ReactNode } from "react";
import type { AlgorithmIR } from "@/types/algorithm-ir";
import type { SearchResult } from "@/components/outliner/outliner-store";
import { useOutlinerStore } from "@/components/outliner/outliner-store";
import { SP_ROOT_VARS } from "@/components/outliner/study-player/tokens";
import { StudyTopBar } from "@/components/outliner/study-player/StudyTopBar";
import { SurfaceHeader } from "@/components/outliner/study-player/SurfaceHeader";
import { LearningPanel, LearningPanelBottomSheet } from "@/components/outliner/study-player/LearningPanel";
import { AlgorithmNavigatorDrawer } from "@/components/outliner/study-player/AlgorithmNavigatorDrawer";
import { ImmersiveHUD } from "@/components/outliner/study-player/ImmersiveHUD";
import { StepwiseDecisionPlayer } from "@/components/outliner/study-player/StepwiseDecisionPlayer";

interface StudyPlayerShellProps {
  ir: AlgorithmIR;
  graphSlot: ReactNode;
  openSearchResult?: (r: SearchResult) => void;
  onBlockClick?: (blockId: string) => void;
}

export function StudyPlayerShell({ ir: _ir, graphSlot, openSearchResult, onBlockClick }: StudyPlayerShellProps) {
  const surfaces            = useOutlinerStore((s) => s.surfaces);
  const currentSurfaceIndex = useOutlinerStore((s) => s.currentSurfaceIndex);
  const isFocusMode         = useOutlinerStore((s) => s.isFocusMode);
  const selectedNodeId      = useOutlinerStore((s) => s.focusedNodeId);
  const isImmersive         = useOutlinerStore((s) => s.isImmersive);
  const toggleImmersive     = useOutlinerStore((s) => s.toggleImmersive);
  const mode                = useOutlinerStore((s) => s.mode);

  const currentSurface = surfaces[currentSurfaceIndex] ?? null;
  const isStepwise = mode === "stepwise";

  return (
    <div
      data-outliner="study-player"
      data-outliner-immersive={isImmersive ? "true" : undefined}
      className="flex min-h-[calc(100vh-32px)] flex-col overflow-hidden"
      style={SP_ROOT_VARS}
    >
      {/* CSS-only chrome hiding for immersive mode — keeps WebGL canvas alive */}
      <style>{`
        [data-outliner-immersive="true"] [data-outliner-topbar] { display: none !important; }
        [data-outliner-immersive="true"] [data-outliner-surface-header] { display: none !important; }
        [data-outliner-immersive="true"] [data-outliner-navigator-drawer] { display: none !important; }
        [data-outliner-immersive="true"] [data-outliner-learning-panel] { display: none !important; }
      `}</style>

      {/* ── Top bar ── */}
      <StudyTopBar openSearchResult={openSearchResult} />

      {/* ── Main study area ── */}
      <main className="flex flex-1 flex-col overflow-hidden" style={{ background: "var(--sp-canvas-bg)" }}>

        {/* Surface header — hidden in focus mode */}
        {!isFocusMode && currentSurface && (
          <SurfaceHeader surface={currentSurface} />
        )}

        {/* ── Stepwise layout: compact graph context + dominant Decision Player ── */}
        {isStepwise && !isFocusMode ? (
          <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
            {/* Compact graph — supporting context only */}
            <div
              className="shrink-0 overflow-auto h-[240px] lg:h-auto lg:w-72"
              style={{ background: "var(--sp-canvas-bg)" }}
              onDoubleClick={() => { if (isImmersive) toggleImmersive(); }}
            >
              {graphSlot}
            </div>
            {/* Clinical Decision Player — dominant */}
            <div
              className="flex-1 overflow-y-auto border-t lg:border-t-0 lg:border-l"
              style={{ background: "white", borderColor: "var(--sp-border)" }}
            >
              {currentSurface ? (
                <StepwiseDecisionPlayer surface={currentSurface} onBlockClick={onBlockClick} />
              ) : (
                <div className="flex items-center justify-center h-full p-8">
                  <p dir="rtl" lang="fa" style={{ color: "var(--sp-text-muted)", fontSize: 13 }}>
                    الگوریتمی انتخاب نشده است.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── Normal layout: full graph + side LearningPanel ── */
          <div className="flex flex-1 overflow-hidden">
            <div
              className="relative min-w-0 flex-1 overflow-auto"
              style={{ background: "var(--sp-canvas-bg)" }}
              onDoubleClick={() => { if (isImmersive) toggleImmersive(); }}
            >
              {graphSlot}
            </div>
            {!isFocusMode && selectedNodeId && (
              <LearningPanel onBlockClick={onBlockClick} />
            )}
            {(!selectedNodeId || isFocusMode) && (
              <aside data-outliner-learning-panel aria-hidden="true" className="hidden" />
            )}
          </div>
        )}
      </main>

      {/* Mobile learning panel bottom sheet — only in non-stepwise modes */}
      {!isFocusMode && !isImmersive && !isStepwise && (
        <LearningPanelBottomSheet onBlockClick={onBlockClick} />
      )}

      {/* ── Navigator drawer ── */}
      <AlgorithmNavigatorDrawer />

      {/* ── Immersive HUD ── */}
      <ImmersiveHUD onBlockClick={onBlockClick} />
    </div>
  );
}
