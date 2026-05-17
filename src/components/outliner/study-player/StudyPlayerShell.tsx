"use client";

import type { ReactNode } from "react";
import type { AlgorithmIR } from "@/types/algorithm-ir";
import type { SearchResult } from "@/components/outliner/outliner-store";
import { useOutlinerStore } from "@/components/outliner/outliner-store";
import { SP_ROOT_VARS } from "@/components/outliner/study-player/tokens";
import { StudyTopBar } from "@/components/outliner/study-player/StudyTopBar";
import { SurfaceHeader } from "@/components/outliner/study-player/SurfaceHeader";
import { AlgorithmNavigatorDrawer } from "@/components/outliner/study-player/AlgorithmNavigatorDrawer";
import { ImmersiveHUD } from "@/components/outliner/study-player/ImmersiveHUD";
import { StepwiseWalk } from "@/components/outliner/study-player/StepwiseWalk";

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
  const isImmersive         = useOutlinerStore((s) => s.isImmersive);
  const toggleImmersive     = useOutlinerStore((s) => s.toggleImmersive);
  const mode                = useOutlinerStore((s) => s.mode);

  const currentSurface = surfaces[currentSurfaceIndex] ?? null;
  const isStepwise = mode === "stepwise";

  return (
    <div
      data-outliner="study-player"
      data-outliner-immersive={isImmersive ? "true" : undefined}
      className="flex h-full min-h-0 flex-col overflow-hidden"
      style={{
        ...(SP_ROOT_VARS as React.CSSProperties),
        position: "relative",
        isolation: "isolate",
      }}
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
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ background: "var(--sp-canvas-bg)" }}>

        {/* Surface header — hidden in focus mode */}
        {!isFocusMode && currentSurface && (
          <SurfaceHeader surface={currentSurface} />
        )}

        {/* ── Stepwise layout: compact graph context + Clinical Depth Walk ── */}
        {isStepwise && !isFocusMode ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
            {/* Compact graph — supporting context only */}
            <div
              data-outliner-graph-container
              className="h-[260px] shrink-0 overflow-hidden lg:h-auto lg:w-[360px]"
              style={{ background: "var(--sp-canvas-bg)", isolation: "isolate" }}
              onDoubleClick={() => { if (isImmersive) toggleImmersive(); }}
            >
              {graphSlot}
            </div>
            {/* Clinical Depth Walk — dominant */}
            <div
              data-outliner-stepwise-nav
              className="min-h-0 flex-1 overflow-hidden border-t lg:border-t-0 lg:border-l"
              style={{ background: "white", borderColor: "var(--sp-border)" }}
            >
              <StepwiseWalk onBlockClick={onBlockClick} />
            </div>
          </div>
        ) : (
          /* ── Normal layout: full graph + side LearningPanel ── */
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <div
              data-outliner-graph-container
              className="relative min-w-0 flex-1 overflow-hidden"
              style={{ background: "var(--sp-canvas-bg)", isolation: "isolate" }}
              onDoubleClick={() => { if (isImmersive) toggleImmersive(); }}
            >
              {graphSlot}
            </div>
          </div>
        )}
      </main>

      {/* ── Navigator drawer ── */}
      <AlgorithmNavigatorDrawer />

      {/* ── Immersive HUD ── */}
      <ImmersiveHUD onBlockClick={onBlockClick} />
    </div>
  );
}
