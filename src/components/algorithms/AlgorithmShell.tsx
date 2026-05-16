"use client";

import { useCallback, useMemo, useState } from "react";
import { AlgorithmTopBar } from "./AlgorithmTopBar";
import { AlgorithmSurfaceSelector } from "./AlgorithmSurfaceSelector";
import { AlgorithmSurfaceHeader } from "./AlgorithmSurfaceHeader";
import { AlgorithmPathNavigator } from "./AlgorithmPathNavigator";
import { AlgorithmCanvas } from "./AlgorithmCanvas";
import { AlgorithmStepPanel } from "./AlgorithmStepPanel";
import { AlgorithmDetailsPanel } from "./AlgorithmDetailsPanel";
import { AlgorithmEmptyState } from "./AlgorithmEmptyState";
import {
  getAlgorithmShortTitle,
  type AlgorithmIRV4,
  type AlgorithmSurfaceV4,
} from "@/types/algorithm-ir-v4";

interface AlgorithmShellProps {
  ir: Readonly<AlgorithmIRV4>;
}

function findEntryNode(surface: AlgorithmSurfaceV4): string | null {
  const entry = surface.nodes.find((n) => n.nodeType === "entry");
  return entry?.nodeId ?? surface.nodes[0]?.nodeId ?? null;
}

export function AlgorithmShell({ ir }: AlgorithmShellProps) {
  const surfaces = ir.surfaces;
  const shortTitle = useMemo(() => getAlgorithmShortTitle(ir), [ir]);

  const [selectedSurfaceId, setSelectedSurfaceId] = useState<string>(
    surfaces[0]?.surfaceId ?? "",
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(() => {
    const first = surfaces[0];
    return first ? findEntryNode(first) : null;
  });
  const [visitedPath, setVisitedPath] = useState<string[]>(() => {
    const first = surfaces[0];
    const entry = first ? findEntryNode(first) : null;
    return entry ? [entry] : [];
  });

  const selectedSurface = useMemo(
    () => surfaces.find((s) => s.surfaceId === selectedSurfaceId) ?? surfaces[0],
    [surfaces, selectedSurfaceId],
  );

  const handleSelectSurface = useCallback(
    (surfaceId: string) => {
      const surface = surfaces.find((s) => s.surfaceId === surfaceId);
      if (!surface) return;
      const entry = findEntryNode(surface);
      setSelectedSurfaceId(surfaceId);
      setSelectedNodeId(entry);
      setVisitedPath(entry ? [entry] : []);
    },
    [surfaces],
  );

  const handleSelectNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setVisitedPath((prev) => {
      if (prev.includes(nodeId)) return prev;
      return [...prev, nodeId];
    });
  }, []);

  const handleBack = useCallback(() => {
    setVisitedPath((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.slice(0, -1);
      setSelectedNodeId(next[next.length - 1] ?? null);
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    if (!selectedSurface) return;
    const entry = findEntryNode(selectedSurface);
    setSelectedNodeId(entry);
    setVisitedPath(entry ? [entry] : []);
  }, [selectedSurface]);

  if (surfaces.length === 0) {
    return <AlgorithmEmptyState />;
  }

  if (!selectedSurface) {
    return <AlgorithmEmptyState />;
  }

  return (
    <div
      dir="rtl"
      lang="fa"
      className="flex h-screen flex-col bg-slate-950 text-slate-100 overflow-hidden"
      style={{ fontFamily: "var(--font-vazir), Vazirmatn, Tahoma, sans-serif" }}
    >
      {/* Top bar */}
      <AlgorithmTopBar ir={ir} />

      {/* Body: sidebar + main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left rail (right side in RTL) */}
        <AlgorithmSurfaceSelector
          surfaces={surfaces}
          selectedSurfaceId={selectedSurfaceId}
          onSelect={handleSelectSurface}
          shortTitle={shortTitle}
        />

        {/* Main canvas area — canvas-first layout */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Compact surface header — single line, expandable */}
          <div className="shrink-0 border-b border-slate-700/40 bg-slate-900/60 px-4 py-2.5">
            <AlgorithmSurfaceHeader surface={selectedSurface} />
          </div>

          {/* Path navigator — slim bar */}
          <AlgorithmPathNavigator
            surface={selectedSurface}
            selectedNodeId={selectedNodeId}
            visitedPath={visitedPath}
            onSelectNode={handleSelectNode}
            onReset={handleReset}
            onBack={handleBack}
          />

          {/* Canvas — takes all remaining space */}
          <div className="flex-1 overflow-auto p-4">
            <AlgorithmCanvas
              surface={selectedSurface}
              selectedNodeId={selectedNodeId}
              visitedPath={visitedPath}
              onSelectNode={handleSelectNode}
            />
          </div>

          {/* Bottom panels — collapsed by default, shrink-0 so they don't push canvas */}
          <div className="shrink-0">
            <AlgorithmStepPanel
              surface={selectedSurface}
              selectedNodeId={selectedNodeId}
              onSelectNode={handleSelectNode}
              onReset={handleReset}
            />
            <AlgorithmDetailsPanel surface={selectedSurface} />
          </div>
        </main>
      </div>
    </div>
  );
}
