"use client";

import {
  Activity,
  CheckCircle2,
  ChevronDown,
  Eye,
  GitBranch,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { useState, type ElementType } from "react";
import { cn } from "@/lib/utils";
import type { AlgorithmSurface } from "@/types/algorithm-ir";

// ── Surface-type → icon ───────────────────────────────────────────────────────
const SURFACE_ICONS: Record<string, ElementType> = {
  recognition_chain:   Eye,
  diagnostic_pathway:  Activity,
  combined_algorithm:  GitBranch,
  management_pathway:  Layers,
  indication_gate:     ShieldCheck,
  treatment_selection: CheckCircle2,
};

// ── Complexity badge labels ───────────────────────────────────────────────────
const COMPLEXITY: Record<string, string> = {
  medium: "متوسط",
  high:   "پیچیده",
  low:    "پایه",
};

interface SurfaceHeaderProps {
  surface: AlgorithmSurface;
}

export function SurfaceHeader({ surface }: SurfaceHeaderProps) {
  const [entryPointsExpanded, setEntryPointsExpanded] = useState(false);

  const surfaceRec = surface as Record<string, unknown>;
  const clinicalQuestion = typeof surfaceRec.clinicalQuestion === "string" ? surfaceRec.clinicalQuestion : null;
  const memoryAnchor     = typeof surfaceRec.memoryAnchor     === "string" ? surfaceRec.memoryAnchor     : null;
  const complexityLevel  = typeof surfaceRec.complexityLevel  === "string" ? surfaceRec.complexityLevel  : null;
  const examEntryPoints  = Array.isArray(surfaceRec.examEntryPoints)
    ? (surfaceRec.examEntryPoints as unknown[]).filter((s): s is string => typeof s === "string")
    : [];
  const surfaceType = typeof surface.surfaceType === "string" ? surface.surfaceType : "";

  const SurfaceIcon = SURFACE_ICONS[surfaceType] ?? GitBranch;
  const complexityLabel = complexityLevel ? (COMPLEXITY[complexityLevel] ?? complexityLevel) : null;

  return (
    <header
      data-outliner-surface-header
      className="border-b px-4 py-3 lg:px-6"
      style={{ background: "var(--sp-surface)", borderColor: "var(--sp-border)" }}
    >
      {/* Title row */}
      <div className="flex flex-wrap items-start gap-3" dir="rtl" lang="fa">
        <SurfaceIcon
          className="mt-0.5 h-5 w-5 shrink-0"
          style={{ color: "var(--sp-text-muted)" }}
          aria-hidden
        />
        <h2
          className="flex-1 text-[17px] font-bold leading-snug lg:text-[18px]"
          style={{ color: "var(--sp-text)", minWidth: 0 }}
        >
          {surface.title}
        </h2>
        {complexityLabel && (
          <span
            className="shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-muted)" }}
          >
            {complexityLabel}
          </span>
        )}
      </div>

      {/* Clinical question */}
      {clinicalQuestion && (
        <p
          className="mt-1.5 text-[13px] leading-relaxed lg:text-[14px]"
          style={{ color: "var(--sp-text-muted)" }}
          dir="rtl"
          lang="fa"
        >
          {clinicalQuestion}
        </p>
      )}

      {/* Memory anchor card */}
      {memoryAnchor && (
        <div
          className="mt-2.5 flex items-start gap-2.5 rounded-lg border px-3 py-2"
          style={{
            background: "var(--sp-amber-bg)",
            borderColor: "var(--sp-amber-border)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0" aria-hidden>
            <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM8 5v3m0 3h.01" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p className="text-[13px] leading-6" style={{ color: "#78350F" }} dir="rtl" lang="fa">
            {memoryAnchor}
          </p>
        </div>
      )}

      {/* Exam entry points — collapsed by default */}
      {examEntryPoints.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setEntryPointsExpanded(!entryPointsExpanded)}
            className="flex items-center gap-1.5 text-[11px] font-semibold"
            style={{ color: "var(--sp-text-muted)" }}
            dir="rtl"
          >
            ورودی‌های بوردی
            <span
              className="rounded-full px-1.5 py-px text-[10px]"
              style={{ background: "var(--sp-shell-bg)", color: "var(--sp-text-muted)" }}
            >
              {examEntryPoints.length}
            </span>
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform duration-150", entryPointsExpanded && "rotate-180")}
              aria-hidden
            />
          </button>
          {entryPointsExpanded && (
            <div className="mt-2 flex flex-wrap gap-1.5" dir="rtl" lang="fa">
              {examEntryPoints.map((ep, i) => (
                <span
                  key={i}
                  className="rounded-full border px-2.5 py-0.5 text-[12px]"
                  style={{ borderColor: "var(--sp-border)", color: "var(--sp-text)" }}
                >
                  {ep}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
