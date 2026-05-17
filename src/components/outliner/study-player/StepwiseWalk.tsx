"use client";

import { useState, useEffect, useMemo } from "react";
import { useOutlinerStore } from "@/components/outliner/outliner-store";
import { toFa } from "@/components/outliner/study-player/tokens";
import { MEMORY_ROLE_PILLS, EDGE_STYLES, DEFAULT_EDGE_STYLE } from "@/components/outliner/renderers";
import type { AlgorithmNode, AlgorithmEdge } from "@/types/algorithm-ir";

// ── Node-type icon map ────────────────────────────────────────────────────────
const NODE_ICONS: Record<string, string> = {
  entry:          "◎",
  question:       "؟",
  finding:        "◆",
  test:           "⊞",
  threshold:      "#",
  treatment:      "✚",
  escalation:     "⚡",
  endpoint:       "●",
  trap:           "⚠",
  exception:      "↗",
  mechanism:      "⟳",
  clinical_effect:"→",
  classification: "≡",
};

// ── CSS animation injected once ───────────────────────────────────────────────
const ANIM_CSS = `
@keyframes stepwise-enter {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-stepwise-enter {
  animation: stepwise-enter 220ms ease forwards;
}
@keyframes flow {
  to { stroke-dashoffset: -12; }
}
`;

// ── Small helpers ─────────────────────────────────────────────────────────────

function edgeColor(edgeType?: string): string {
  return (EDGE_STYLES[edgeType ?? ""] ?? DEFAULT_EDGE_STYLE).color as string;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ThresholdCard({ threshold }: { threshold: Record<string, unknown> }) {
  const value         = typeof threshold.value         === "string" ? threshold.value         : "—";
  const variable      = typeof threshold.variable      === "string" ? threshold.variable      : "";
  const conditionText = typeof threshold.conditionText === "string" ? threshold.conditionText : null;
  const memoryAnchor  = typeof threshold.memoryAnchor  === "string" ? threshold.memoryAnchor  : null;
  return (
    <div style={{
      background: "#FFFBEB", borderRight: "3px solid #F59E0B",
      borderRadius: 8, padding: "10px 14px", marginBottom: 8,
      display: "flex", alignItems: "flex-start", gap: 10,
    }}>
      <span style={{ fontSize: 18, fontWeight: 900, color: "#D97706", flexShrink: 0 }}>⚡ {value}</span>
      <div>
        {variable && <p style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", marginBottom: 2 }}>{variable}</p>}
        {conditionText && <p style={{ fontSize: 11, color: "#6B7280" }}>{conditionText}</p>}
        {memoryAnchor  && <p style={{ fontSize: 11, fontStyle: "italic", color: "#92400E", marginTop: 2 }}>{memoryAnchor}</p>}
      </div>
    </div>
  );
}

function TrapCard({ trap }: { trap: Record<string, unknown> }) {
  const trapTitle   = typeof trap.trapTitle   === "string" ? trap.trapTitle   : "دام بوردی";
  const wrongPath   = typeof trap.wrongPath   === "string" ? trap.wrongPath   : null;
  const correctPath = typeof trap.correctPath === "string" ? trap.correctPath : null;
  return (
    <div style={{
      background: "#FFF1F2", borderRight: "3px solid #F43F5E",
      borderRadius: 8, padding: "10px 14px", marginBottom: 8,
    }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: "#BE123C", marginBottom: 6 }}>⚠ {trapTitle}</p>
      {(wrongPath || correctPath) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {wrongPath && (
            <div>
              <p style={{ fontSize: 9, fontWeight: 700, color: "#BE123C", marginBottom: 2 }}>✗ اشتباه</p>
              <p style={{ fontSize: 11, color: "#4B5563" }}>{wrongPath}</p>
            </div>
          )}
          {correctPath && (
            <div>
              <p style={{ fontSize: 9, fontWeight: 700, color: "#065F46", marginBottom: 2 }}>✓ درست</p>
              <p style={{ fontSize: 11, color: "#4B5563" }}>{correctPath}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CheckpointCard({
  checkpoint,
  revealed,
  onReveal,
}: {
  checkpoint: Record<string, unknown>;
  revealed: boolean;
  onReveal: () => void;
}) {
  const cpId         = String(checkpoint.id ?? checkpoint.checkpointId ?? "cp");
  const prompt       = typeof checkpoint.prompt       === "string" ? checkpoint.prompt       : "—";
  const answer       = typeof checkpoint.answer       === "string" ? checkpoint.answer       : "—";
  const whyItMatters = typeof checkpoint.whyItMatters === "string" ? checkpoint.whyItMatters : null;
  void cpId;
  return (
    <div style={{ border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden", marginBottom: 8 }}>
      <div style={{ padding: "10px 14px", background: "#F0FDF4", display: "flex", gap: 8, alignItems: "flex-start" }}>
        <span style={{ fontSize: 16 }}>💡</span>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", flex: 1 }}>{prompt}</p>
      </div>
      {revealed ? (
        <div style={{ padding: "10px 14px", borderTop: "1px solid #E2E8F0", background: "white" }}>
          <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.7 }}>{answer}</p>
          {whyItMatters && (
            <p style={{ fontSize: 11, fontStyle: "italic", color: "#6B7280", marginTop: 4 }}>{whyItMatters}</p>
          )}
        </div>
      ) : (
        <div style={{ padding: "8px 14px", borderTop: "1px solid #E2E8F0", textAlign: "center" }}>
          <button
            type="button"
            onClick={onReveal}
            lang="fa"
            style={{
              fontSize: 12, color: "#3B82F6", background: "none",
              border: "none", cursor: "pointer", fontWeight: 600, minHeight: 36,
            }}
          >
            نمایش پاسخ
          </button>
        </div>
      )}
    </div>
  );
}

function GateCard({ gate }: { gate: Record<string, unknown> }) {
  const title          = typeof gate.title          === "string" ? gate.title          : "دروازه";
  const entryCondition = typeof gate.entryCondition === "string" ? gate.entryCondition : null;
  const actionIfPass   = typeof gate.actionIfPass   === "string" ? gate.actionIfPass   : null;
  const actionIfFail   = typeof gate.actionIfFail   === "string" ? gate.actionIfFail   : null;
  return (
    <div style={{
      background: "#F8FAFC", borderRight: "3px solid #64748B",
      borderRadius: 8, padding: "10px 14px", marginBottom: 8,
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 4 }}>🔲 دروازه: {title}</p>
      {entryCondition && <p style={{ fontSize: 12, color: "#64748B", marginBottom: 2 }}>شرط ورود: {entryCondition}</p>}
      {actionIfPass   && <p style={{ fontSize: 12, color: "#065F46" }}>✓ گذر: {actionIfPass}</p>}
      {actionIfFail   && <p style={{ fontSize: 12, color: "#BE123C" }}>✗ رد: {actionIfFail}</p>}
    </div>
  );
}

function ActiveNodeCard({
  node,
  activeThresholds,
  activeTraps,
}: {
  node: AlgorithmNode;
  activeThresholds: Array<Record<string, unknown>>;
  activeTraps: Array<Record<string, unknown>>;
}) {
  const pill         = node.memoryRole ? (MEMORY_ROLE_PILLS[node.memoryRole] ?? null) : null;
  const icon         = NODE_ICONS[node.nodeType] ?? "○";
  const isTrapNode   = node.nodeType === "trap" || node.memoryRole === "trap";
  const isThreshold  = node.nodeType === "threshold" || node.memoryRole === "golden_number";

  // Thresholds linked to this node
  const nodeThresholds = activeThresholds.filter(t => {
    const lnids = t.linkedNodeIds as string[] | undefined;
    return !lnids?.length || lnids.includes(node.nodeId);
  });
  // Traps linked to this node
  const nodeTraps = activeTraps.filter(bt => {
    const lnids = bt.linkedNodeIds as string[] | undefined;
    return !lnids?.length || lnids.includes(node.nodeId);
  });

  return (
    <div style={{
      background: "white", border: "1px solid #E2E8F0", borderRadius: 14,
      padding: "16px 18px", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", marginBottom: 10,
    }}>
      {/* Header: icon + label + pill */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 16, color: "#64748B" }}>{icon}</span>
        <p style={{ fontSize: 17, fontWeight: 700, color: "#0F172A", flex: 1, lineHeight: 1.3 }}>
          {node.label}
        </p>
        {pill && (
          <span style={{
            borderRadius: 999, padding: "2px 10px",
            fontSize: 10, fontWeight: 600,
            background: pill.bg, color: pill.text,
            flexShrink: 0,
          }}>
            {pill.label}
          </span>
        )}
      </div>

      {/* testablePoint — primary teaching note */}
      {node.testablePoint && (
        <div style={{
          background: "#EFF6FF", borderRight: "3px solid #3B82F6",
          borderRadius: 8, padding: "10px 12px", marginBottom: 8,
        }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "#1D4ED8", marginBottom: 3 }}>نکته آزمونی</p>
          <p style={{ fontSize: 13, color: "#1E3A5F", lineHeight: 1.7 }}>{node.testablePoint}</p>
        </div>
      )}

      {/* detail — secondary context */}
      {node.detail && (
        <p style={{ fontSize: 12, color: "#64748B", lineHeight: 1.6, marginBottom: 8 }}>
          {node.detail}
        </p>
      )}

      {/* Threshold amber cards */}
      {(isThreshold || nodeThresholds.length > 0) && nodeThresholds.map((t, i) => (
        <ThresholdCard key={String(t.thresholdId ?? i)} threshold={t} />
      ))}

      {/* Trap rose cards */}
      {(isTrapNode || nodeTraps.length > 0) && nodeTraps.map((bt, i) => (
        <TrapCard key={String(bt.trapId ?? i)} trap={bt} />
      ))}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function StepwiseWalk({ onBlockClick }: { onBlockClick?: (blockId: string) => void }) {
  // Store selectors
  const surfaces            = useOutlinerStore(s => s.surfaces);
  const currentSurfaceIndex = useOutlinerStore(s => s.currentSurfaceIndex);
  const stepwiseDepth       = useOutlinerStore(s => s.stepwiseDepth);
  const stepwiseMaxDepth    = useOutlinerStore(s => s.stepwiseMaxDepth);
  const depthLayers         = useOutlinerStore(s => s.depthLayers);
  const stepForward         = useOutlinerStore(s => s.stepForward);
  const stepBackward        = useOutlinerStore(s => s.stepBackward);
  const mode                = useOutlinerStore(s => s.mode);

  const currentSurface = surfaces[currentSurfaceIndex] ?? null;

  // Checkpoint reveal: session-only, reset on surface change
  const [checkpointRevealed, setCheckpointRevealed] = useState<Set<string>>(new Set());
  useEffect(() => {
    setCheckpointRevealed(new Set());
  }, [currentSurfaceIndex]);

  // Keyboard shortcuts — active only when mode=stepwise and no input focused
  useEffect(() => {
    if (mode !== "stepwise") return;
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as Element)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.key === "ArrowRight" || e.key === "l" || e.key === " ") {
        e.preventDefault();
        stepForward();
      } else if (e.key === "ArrowLeft" || e.key === "h") {
        e.preventDefault();
        stepBackward();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mode, stepForward, stepBackward]);

  // ── Data derivation ─────────────────────────────────────────────────────────
  const nodes = useMemo(
    () => (currentSurface?.nodes ?? []) as AlgorithmNode[],
    [currentSurface],
  );
  const edges = useMemo(
    () => (currentSurface?.edges ?? []) as AlgorithmEdge[],
    [currentSurface],
  );
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.nodeId, n])), [nodes]);

  const activeLayerIds = depthLayers[stepwiseDepth] ?? [];
  const prevLayerIds   = depthLayers[stepwiseDepth - 1] ?? [];
  const nextLayerIds   = depthLayers[stepwiseDepth + 1] ?? [];

  const activeNodes = activeLayerIds.map(id => nodeMap.get(id)).filter((n): n is AlgorithmNode => Boolean(n));
  const nextNodes   = nextLayerIds.map(id => nodeMap.get(id)).filter((n): n is AlgorithmNode => Boolean(n));

  // Incoming edges to active layer (for transition reason strip)
  const incomingEdges = useMemo(
    () => edges.filter(e => activeLayerIds.includes(e.to) && prevLayerIds.includes(e.from)),
    [edges, activeLayerIds, prevLayerIds],
  );

  // Checkpoints linked to active layer
  const activeCheckpoints = useMemo(
    () => (currentSurface?.checkpoints ?? []).filter(cp => {
      const lnids = cp.linkedNodeIds;
      return lnids?.some(id => activeLayerIds.includes(id));
    }) as Array<Record<string, unknown>>,
    [currentSurface?.checkpoints, activeLayerIds],
  );

  // Thresholds: linked to active layer nodes, or active layer has threshold/golden_number node
  const activeThresholds = useMemo(() => {
    const thresholds = currentSurface?.thresholds ?? [];
    if (!thresholds.length) return [] as Array<Record<string, unknown>>;
    return thresholds.filter(t => {
      const lnids = (t as Record<string, unknown>).linkedNodeIds as string[] | undefined;
      if (lnids?.length) return activeLayerIds.some(id => lnids.includes(id));
      return activeNodes.some(n => n.nodeType === "threshold" || n.memoryRole === "golden_number");
    }) as Array<Record<string, unknown>>;
  }, [currentSurface?.thresholds, activeLayerIds, activeNodes]);

  // Board traps linked to active layer
  const activeTraps = useMemo(
    () => (currentSurface?.boardTraps ?? []).filter(bt => {
      const lnids = bt.linkedNodeIds;
      if (lnids?.length) return activeLayerIds.some(id => lnids.includes(id));
      return activeNodes.some(n => n.nodeType === "trap" || n.memoryRole === "trap");
    }) as Array<Record<string, unknown>>,
    [currentSurface?.boardTraps, activeLayerIds, activeNodes],
  );

  // Gates: linked via shared linkedBlockIds with active nodes
  const activeBlockIds = useMemo(() => {
    const s = new Set<string>();
    activeNodes.forEach(n => (n.linkedBlockIds ?? []).forEach(bid => s.add(bid)));
    return s;
  }, [activeNodes]);

  const activeGates = useMemo(
    () => (currentSurface?.gates ?? []).filter(gate =>
      (gate.linkedBlockIds ?? []).some(bid => activeBlockIds.has(bid))
    ) as Array<Record<string, unknown>>,
    [currentSurface?.gates, activeBlockIds],
  );

  // Linked block IDs on active nodes (for "بازگشت به جزوه")
  const firstLinkedBlock = useMemo(() => {
    for (const n of activeNodes) {
      if (n.linkedBlockIds?.length) return n.linkedBlockIds[0];
    }
    return null;
  }, [activeNodes]);

  // Navigation boundary flags
  const atFirstStep = stepwiseDepth === 0 && currentSurfaceIndex === 0;
  const atLastStep  = stepwiseDepth === stepwiseMaxDepth && currentSurfaceIndex === surfaces.length - 1;

  // ── Guard: no surface loaded ─────────────────────────────────────────────────
  if (!currentSurface || depthLayers.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <p dir="rtl" lang="fa" style={{ color: "#94A3B8", fontSize: 13 }}>در حال بارگذاری مسیر بالینی...</p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div dir="rtl" lang="fa" style={{ display: "flex", flexDirection: "column", height: "100%", fontSize: 14 }}>
      {/* Inject animation CSS once */}
      <style>{ANIM_CSS}</style>

      {/* ── Progress bar ── */}
      <div style={{
        padding: "10px 16px 8px",
        borderBottom: "1px solid #E2E8F0",
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
      }}>
        <div
          role="progressbar"
          aria-valuenow={stepwiseDepth}
          aria-valuemax={stepwiseMaxDepth}
          style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}
        >
          {depthLayers.map((_, i) => (
            <div
              key={i}
              style={{
                width:        i === stepwiseDepth ? 24 : i < stepwiseDepth ? 16 : 8,
                height:       6,
                borderRadius: 999,
                background:   i === stepwiseDepth ? "#3B82F6"
                            : i < stepwiseDepth   ? "#CBD5E1"
                            :                       "#E2E8F0",
                transition: "width 200ms ease, background 200ms ease",
                flexShrink: 0,
              }}
            />
          ))}
        </div>
        <span style={{
          fontSize: 12, color: "#64748B",
          fontVariantNumeric: "tabular-nums",
          marginRight: "auto",
          fontFeatureSettings: '"tnum"',
        }}>
          {toFa(stepwiseDepth + 1)} / {toFa(stepwiseMaxDepth + 1)}
        </span>
      </div>

      {/* ── Scrollable content ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        {/* Animated container — key forces remount on depth change */}
        <div key={`${currentSurfaceIndex}-${stepwiseDepth}`} className="animate-stepwise-enter">

          {/* ── Transition reason (incoming edge conditions) ── */}
          {stepwiseDepth > 0 && incomingEdges.length > 0 && (
            <div style={{
              background: "#F8FAFC",
              borderRight: `3px solid ${edgeColor(incomingEdges[0].edgeType)}`,
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 14,
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", marginBottom: 4, letterSpacing: "0.05em" }}>
                پیوند منطقی
              </p>
              <p style={{ fontSize: 12, color: "#475569", fontStyle: "italic", lineHeight: 1.6 }}>
                {incomingEdges
                  .map(e => e.condition)
                  .filter(Boolean)
                  .join(" / ") || incomingEdges[0].edgeType}
              </p>
            </div>
          )}

          {/* ── Active layer node cards ── */}
          {activeNodes.map(node => (
            <ActiveNodeCard
              key={node.nodeId}
              node={node}
              activeThresholds={activeThresholds}
              activeTraps={activeTraps}
            />
          ))}

          {/* ── Gate cards (if active layer has linked gates) ── */}
          {activeGates.map((gate, i) => (
            <GateCard key={String(gate.gateId ?? gate.id ?? i)} gate={gate} />
          ))}

          {/* ── Checkpoint quiz ── */}
          {activeCheckpoints.length > 0 && (
            <div style={{ marginTop: 4 }}>
              {activeCheckpoints.map((cp, i) => {
                const cpId = String(cp.id ?? cp.checkpointId ?? i);
                return (
                  <CheckpointCard
                    key={cpId}
                    checkpoint={cp}
                    revealed={checkpointRevealed.has(cpId)}
                    onReveal={() => setCheckpointRevealed(prev => new Set([...prev, cpId]))}
                  />
                );
              })}
            </div>
          )}

          {/* ── Next layer teaser ── */}
          {nextNodes.length > 0 && (
            <div style={{
              padding: "12px 14px",
              borderTop: "1px dashed #E2E8F0",
              marginTop: 8,
            }}>
              <p style={{ fontSize: 10, color: "#CBD5E1", fontWeight: 700, marginBottom: 4, letterSpacing: "0.05em" }}>
                قدم بعدی:
              </p>
              <p style={{ fontSize: 12, color: "#CBD5E1", lineHeight: 1.5 }}>
                {nextNodes.map(n => n.label).join(" · ")}
              </p>
            </div>
          )}

        </div>
      </div>

      {/* ── Nav buttons ── */}
      <div style={{
        borderTop: "1px solid #E2E8F0",
        padding: "12px 16px",
        display: "flex",
        gap: 8,
        background: "white",
      }}>
        <button
          type="button"
          onClick={stepBackward}
          disabled={atFirstStep}
          lang="fa"
          style={{
            flex: 1, minHeight: 44, padding: "10px 16px",
            border: "1px solid #E2E8F0", borderRadius: 10,
            fontSize: 13, fontWeight: 600,
            color: atFirstStep ? "#CBD5E1" : "#374151",
            background: "white",
            cursor: atFirstStep ? "default" : "pointer",
            opacity: atFirstStep ? 0.5 : 1,
          }}
        >
          ← قدم قبلی
        </button>
        <button
          type="button"
          onClick={stepForward}
          disabled={atLastStep}
          lang="fa"
          style={{
            flex: 1, minHeight: 44, padding: "10px 16px",
            border: "none", borderRadius: 10,
            fontSize: 13, fontWeight: 600,
            color: "white",
            background: atLastStep ? "#94A3B8" : "#3B82F6",
            cursor: atLastStep ? "default" : "pointer",
          }}
        >
          قدم بعدی →
        </button>
      </div>

      {/* ── بازگشت به جزوه ── */}
      {firstLinkedBlock && onBlockClick && (
        <div style={{ padding: "0 16px 14px", background: "white" }}>
          <button
            type="button"
            onClick={() => onBlockClick(firstLinkedBlock)}
            lang="fa"
            style={{
              width: "100%", minHeight: 44, padding: "10px 16px",
              border: "1px solid #CBD5E1", borderRadius: 8,
              background: "white", fontSize: 13, fontWeight: 600,
              color: "#0F172A", cursor: "pointer",
            }}
          >
            بازگشت به جزوه
          </button>
        </div>
      )}
    </div>
  );
}
