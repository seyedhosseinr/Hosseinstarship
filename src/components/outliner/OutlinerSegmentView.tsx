"use client";

import { useEffect, useState } from "react";

import { OutlinerShell } from "@/components/outliner/OutlinerShell";
import { getOutlinerUserState, patchOutlinerUserState } from "@/lib/local-first/outliner-local";
import type { AlgorithmIR } from "@/types/algorithm-ir";

interface OutlinerSegmentViewProps {
  segmentId: string;
  ir: AlgorithmIR;
  parseWarnings?: string[];
  validationRaw?: unknown;
  mediaRaw?: unknown;
  onFocusModeChange?: (active: boolean) => void;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function stringList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function validationWarnings(input: unknown): string[] {
  if (!isRecord(input)) return [];
  return [...stringList(input.warnings), ...stringList(input.errors)];
}

export function OutlinerSegmentView({ segmentId, ir, parseWarnings = [], validationRaw, onFocusModeChange }: OutlinerSegmentViewProps) {
  const [initialSurfaceId, setInitialSurfaceId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadState() {
      try {
        const state = await getOutlinerUserState(segmentId);
        if (!cancelled) setInitialSurfaceId(state?.lastSurfaceId ?? null);
      } catch {
        if (!cancelled) setInitialSurfaceId(null);
      }
    }
    void loadState();
    return () => {
      cancelled = true;
    };
  }, [segmentId]);

  return (
    <OutlinerShell
      segmentId={segmentId}
      ir={ir}
      initialSurfaceId={initialSurfaceId}
      validationWarnings={[...parseWarnings, ...validationWarnings(validationRaw)]}
      onFocusModeChange={onFocusModeChange}
      onSurfaceSelect={(surfaceId) => {
        void patchOutlinerUserState(segmentId, { lastSurfaceId: surfaceId });
      }}
    />
  );
}

