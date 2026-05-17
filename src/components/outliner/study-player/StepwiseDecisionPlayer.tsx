"use client";

import { useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useOutlinerStore } from "@/components/outliner/outliner-store";
import type { AlgorithmSurface } from "@/types/algorithm-ir";
import type { AlgorithmNodeV4, AlgorithmEdgeV4 } from "@/types/algorithm-ir-v4";
import {
  NODE_TYPE_ROLE_LABELS,
  MEMORY_ROLE_PILLS,
  EDGE_STYLES,
  DEFAULT_EDGE_STYLE,
} from "@/components/outliner/renderers";

// ── Feedback kind ─────────────────────────────────────────────────────────────

type FeedbackKind = "trap" | "exception" | "risk" | "threshold" | "normal";

interface FeedbackTheme {
  bg: string;
  border: string;
  textColor: string;
  pathLabel: string;
  icon: string;
}

const FEEDBACK_THEMES: Record<FeedbackKind, FeedbackTheme> = {
  trap:      { bg: "#FFF1F2", border: "#FDA4AF", textColor: "#BE123C", pathLabel: "این مسیر دام بوردی است",         icon: "⚠" },
  exception: { bg: "#FFF7ED", border: "#FED7AA", textColor: "#C2410C", pathLabel: "این مسیر استثناست",              icon: "⚡" },
  risk:      { bg: "#FAF5FF", border: "#D8B4FE", textColor: "#7E22CE", pathLabel: "این مسیر تقسیم‌بندی ریسک است",  icon: "△" },
  threshold: { bg: "#FFFBEB", border: "#FDE68A", textColor: "#92400E", pathLabel: "این مسیر آستانه عددی دارد",     icon: "#" },
  normal:    { bg: "#F0FDF4", border: "#6EE7B7", textColor: "#065F46", pathLabel: "مسیر مناسب است",                icon: "✓" },
};

function deriveFeedbackKind(edge: AlgorithmEdgeV4, dest: AlgorithmNodeV4 | null): FeedbackKind {
  const et = edge.edgeType ?? "";
  if (et === "trap" || et === "failure_branch" || dest?.nodeType === "trap" || dest?.memoryRole === "trap")
    return "trap";
  if (et === "exception_branch") return "exception";
  if (et === "risk_split") return "risk";
  if (et === "threshold_split") return "threshold";
  return "normal";
}

// ── Small layout helpers ──────────────────────────────────────────────────────

function FbSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: 14 }}>
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748B", marginBottom: 6 }}>
        {label}
      </p>
      {children}
    </div>
  );
}

// ── Current step card ─────────────────────────────────────────────────────────

function CurrentStepCard({
  clinicalQuestion, node, nodeTypeLabel, stepNumber,
  teachingPointRevealed, onRevealTeachingPoint,
}: {
  clinicalQuestion?: string;
  node: AlgorithmNodeV4;
  nodeTypeLabel: string;
  stepNumber: number;
  teachingPointRevealed: boolean;
  onRevealTeachingPoint: () => void;
}) {
  const pill = node.memoryRole ? (MEMORY_ROLE_PILLS[node.memoryRole] ?? null) : null;
  return (
    <div style={{
      background: "white", border: "1px solid #E2E8F0", borderRadius: 16,
      padding: "20px 20px 16px", boxShadow: "0 1px 8px rgba(0,0,0,0.06)", marginBottom: 16,
    }}>
      {/* Step badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{
          borderRadius: 999, padding: "2px 10px", fontSize: 10, fontWeight: 700,
          background: "#EFF6FF", color: "#1D4ED8", letterSpacing: "0.04em",
        }}>
          قدم {stepNumber}
        </span>
        <span style={{ fontSize: 10, color: "#94A3B8" }}>تمرین تصمیم بالینی</span>
      </div>

      {/* Clinical context */}
      {clinicalQuestion && (
        <div style={{
          background: "#F8FAFC", borderRadius: 10, padding: "10px 14px",
          marginBottom: 14, borderRight: "3px solid #CBD5E1",
        }}>
          <p style={{ fontSize: 12, color: "#64748B", lineHeight: 1.6 }}>{clinicalQuestion}</p>
        </div>
      )}

      {/* Node label — main prompt */}
      <p style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", lineHeight: 1.4, marginBottom: 6 }}>
        {node.label}
      </p>

      {/* nodeType role */}
      <p style={{ fontSize: 11, color: "#94A3B8", fontVariant: "small-caps", marginBottom: pill ? 8 : 12 }}>
        {nodeTypeLabel}
      </p>

      {/* memory role pill */}
      {pill && (
        <span style={{
          display: "inline-block", borderRadius: 999, padding: "2px 10px",
          fontSize: 10, fontWeight: 600, background: pill.bg, color: pill.text, marginBottom: 12,
        }}>
          {pill.label}
        </span>
      )}

      {/* detail — secondary context */}
      {node.detail && (
        <p style={{ fontSize: 12, color: "#64748B", lineHeight: 1.6, marginBottom: 8 }}>
          {node.detail}
        </p>
      )}

      {/* testablePoint — hidden / revealable */}
      {node.testablePoint && (
        <div style={{ marginTop: 4 }}>
          {teachingPointRevealed ? (
            <div style={{
              background: "#EFF6FF", borderRight: "3px solid #3B82F6",
              borderRadius: 10, padding: "12px 14px",
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#1D4ED8", marginBottom: 4 }}>نکته آزمونی</p>
              <p style={{ fontSize: 13, color: "#1E3A5F", lineHeight: 1.7 }}>{node.testablePoint}</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={onRevealTeachingPoint}
              style={{
                background: "none", border: "1px dashed #CBD5E1", borderRadius: 10,
                padding: "8px 14px", fontSize: 12, color: "#94A3B8", cursor: "pointer",
                width: "100%", textAlign: "right", minHeight: 44,
              }}
              lang="fa"
            >
              نمایش نکته آزمونی ←
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Choice button ─────────────────────────────────────────────────────────────

function ChoiceButton({
  edge, destNode, isChosen, isOther, onChoose,
}: {
  edge: AlgorithmEdgeV4;
  destNode: AlgorithmNodeV4 | null;
  isChosen: boolean;
  isOther: boolean;
  onChoose: (edgeId: string) => void;
}) {
  const es = EDGE_STYLES[edge.edgeType ?? ""] ?? DEFAULT_EDGE_STYLE;
  const kind = deriveFeedbackKind(edge, destNode);
  const theme = FEEDBACK_THEMES[kind];

  return (
    <button
      type="button"
      onClick={() => { if (!isChosen && !isOther) onChoose(edge.edgeId); }}
      disabled={isOther}
      dir="rtl"
      lang="fa"
      style={{
        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4,
        width: "100%", minHeight: 56, padding: "12px 16px",
        border: `1.5px solid ${isChosen ? theme.border : "#E2E8F0"}`,
        borderRadius: 12,
        background: isChosen ? theme.bg : "white",
        cursor: isOther ? "default" : "pointer",
        opacity: isOther ? 0.35 : 1,
        textAlign: "right",
        transition: "border-color 180ms ease, background 180ms ease",
        marginBottom: 8,
        boxShadow: isChosen ? `0 0 0 2px ${theme.border}` : "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
          background: isChosen ? theme.textColor : es.color,
        }} />
        <span style={{
          fontSize: 14, fontWeight: 600, flex: 1, lineHeight: 1.4,
          color: isChosen ? theme.textColor : "#0F172A",
        }}>
          {edge.condition ?? "ادامه"}
        </span>
        {isChosen && (
          <span style={{ fontSize: 13, fontWeight: 700, color: theme.textColor }}>{theme.icon}</span>
        )}
      </div>
      {destNode && (
        <span style={{ fontSize: 11, color: "#94A3B8", paddingRight: 16 }}>
          ↓ {destNode.label}
        </span>
      )}
    </button>
  );
}

// ── Feedback block ────────────────────────────────────────────────────────────

function FeedbackBlock({
  chosenEdge, destNode, theme, linkedTraps, linkedThresholds, linkedCheckpoints,
  revealedCheckpoints, onRevealCheckpoint,
}: {
  chosenEdge: AlgorithmEdgeV4;
  destNode: AlgorithmNodeV4 | null;
  theme: FeedbackTheme;
  linkedTraps: Array<Record<string, unknown>>;
  linkedThresholds: Array<Record<string, unknown>>;
  linkedCheckpoints: Array<Record<string, unknown>>;
  revealedCheckpoints: Set<string>;
  onRevealCheckpoint: (id: string) => void;
}) {
  const explanation =
    destNode?.testablePoint ??
    destNode?.detail ??
    chosenEdge.condition ??
    "";

  return (
    <div style={{ border: `1.5px solid ${theme.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 16 }}>
      {/* A. نتیجه انتخاب */}
      <div style={{
        background: theme.bg, padding: "12px 16px",
        borderBottom: `1px solid ${theme.border}`,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ fontSize: 18 }}>{theme.icon}</span>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: theme.textColor, marginBottom: 1 }}>نتیجه انتخاب</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: theme.textColor }}>{theme.pathLabel}</p>
        </div>
      </div>

      <div style={{ padding: "14px 16px", background: "white" }}>
        {/* B. چرا؟ */}
        {explanation && (
          <FbSection label="چرا؟">
            <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>{explanation}</p>
          </FbSection>
        )}

        {/* C. دام بوردی */}
        {linkedTraps.length > 0 && (
          <FbSection label="دام بوردی">
            {linkedTraps.map((trap, i) => {
              const trapId       = String(trap.id ?? i);
              const trapTitle    = typeof trap.trapTitle   === "string" ? trap.trapTitle   : "دام بوردی";
              const wrongPath    = typeof trap.wrongPath   === "string" ? trap.wrongPath   : null;
              const correctPath  = typeof trap.correctPath === "string" ? trap.correctPath : null;
              const whyItMatters = typeof trap.whyItMatters === "string" ? trap.whyItMatters : null;
              return (
                <div key={trapId} style={{ border: "1px solid #FDA4AF", borderRadius: 10, overflow: "hidden", marginBottom: 8 }}>
                  <div style={{ background: "#FFF1F2", padding: "8px 12px" }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#BE123C" }}>⚠ {trapTitle}</p>
                  </div>
                  {(wrongPath || correctPath) && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: "1px solid #FEE2E2" }}>
                      {wrongPath && (
                        <div style={{ padding: "8px 10px", borderLeft: "1px solid #FEE2E2" }}>
                          <p style={{ fontSize: 9, fontWeight: 700, color: "#BE123C", marginBottom: 3 }}>✗ اشتباه</p>
                          <p style={{ fontSize: 11, color: "#4B5563" }}>{wrongPath}</p>
                        </div>
                      )}
                      {correctPath && (
                        <div style={{ padding: "8px 10px" }}>
                          <p style={{ fontSize: 9, fontWeight: 700, color: "#065F46", marginBottom: 3 }}>✓ درست</p>
                          <p style={{ fontSize: 11, color: "#4B5563" }}>{correctPath}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {whyItMatters && (
                    <div style={{ borderTop: "1px solid #FEE2E2", padding: "6px 12px", background: "white" }}>
                      <p style={{ fontSize: 11, fontStyle: "italic", color: "#6B7280" }}>{whyItMatters}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </FbSection>
        )}

        {/* D. عدد یا آستانه مهم */}
        {linkedThresholds.length > 0 && (
          <FbSection label="عدد یا آستانه مهم">
            {linkedThresholds.map((t, i) => {
              const thId          = String(t.id ?? i);
              const value         = typeof t.value         === "string" ? t.value         : "—";
              const variable      = typeof t.variable      === "string" ? t.variable      : "";
              const conditionText = typeof t.conditionText === "string" ? t.conditionText : null;
              const memoryAnchor  = typeof t.memoryAnchor  === "string" ? t.memoryAnchor  : null;
              return (
                <div key={thId} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  border: "1px solid #FDE68A", borderRadius: 8, padding: "8px 12px",
                  background: "#FFFBEB", marginBottom: 6,
                }}>
                  <span style={{ fontSize: 20, fontWeight: 900, color: "#D97706", flexShrink: 0 }}>{value}</span>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{variable}</p>
                    {conditionText && <p style={{ fontSize: 11, color: "#6B7280" }}>{conditionText}</p>}
                    {memoryAnchor && <p style={{ fontSize: 11, fontStyle: "italic", color: "#92400E" }}>{memoryAnchor}</p>}
                  </div>
                </div>
              );
            })}
          </FbSection>
        )}

        {/* E. چک‌پوینت */}
        {linkedCheckpoints.length > 0 && (
          <FbSection label="چک‌پوینت">
            {linkedCheckpoints.map((cp, i) => {
              const cpId         = String(cp.id ?? i);
              const prompt       = typeof cp.prompt       === "string" ? cp.prompt       : "—";
              const answer       = typeof cp.answer       === "string" ? cp.answer       : "—";
              const cpWhy        = typeof cp.whyItMatters === "string" ? cp.whyItMatters : null;
              const revealed = revealedCheckpoints.has(cpId);
              return (
                <div key={cpId} style={{ border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden", marginBottom: 8 }}>
                  <div style={{ padding: "10px 12px", background: "#F8FAFC" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{prompt}</p>
                  </div>
                  {revealed ? (
                    <div style={{ padding: "10px 12px", borderTop: "1px solid #E2E8F0", background: "white" }}>
                      <p style={{ fontSize: 12, color: "#374151" }}>{answer}</p>
                      {cpWhy && (
                        <p style={{ fontSize: 11, fontStyle: "italic", color: "#6B7280", marginTop: 4 }}>{cpWhy}</p>
                      )}
                    </div>
                  ) : (
                    <div style={{ padding: "8px 12px", borderTop: "1px solid #E2E8F0", textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => onRevealCheckpoint(cpId)}
                        style={{
                          fontSize: 12, color: "#3B82F6", background: "none",
                          border: "none", cursor: "pointer", fontWeight: 600,
                          minHeight: 36, padding: "4px 12px",
                        }}
                        lang="fa"
                      >
                        نمایش پاسخ
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </FbSection>
        )}
      </div>
    </div>
  );
}

// ── Endpoint state ────────────────────────────────────────────────────────────

function EndpointState({
  canGoBack, onBack, onFreeMode,
}: {
  canGoBack: boolean;
  onBack: () => void;
  onFreeMode: () => void;
}) {
  return (
    <div style={{
      border: "1.5px solid #E2E8F0", borderRadius: 14, padding: "24px 20px",
      background: "#F8FAFC", textAlign: "center", marginBottom: 16,
    }}>
      <p style={{ fontSize: 14, color: "#64748B", marginBottom: 16 }}>
        این مسیر در این نقطه پایان می‌یابد.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        {canGoBack && (
          <button
            type="button"
            onClick={onBack}
            style={{
              minHeight: 44, padding: "10px 20px", border: "1px solid #E2E8F0",
              borderRadius: 10, fontSize: 13, fontWeight: 600, color: "#374151",
              background: "white", cursor: "pointer",
            }}
            lang="fa"
          >
            ← مرحله قبلی
          </button>
        )}
        <button
          type="button"
          onClick={onFreeMode}
          style={{
            minHeight: 44, padding: "10px 20px", border: "1px solid #CBD5E1",
            borderRadius: 10, fontSize: 13, fontWeight: 600, color: "#64748B",
            background: "white", cursor: "pointer",
          }}
          lang="fa"
        >
          بازگشت به مرور آزاد
        </button>
      </div>
    </div>
  );
}

// ── Continue / nav controls ───────────────────────────────────────────────────

function ControlRow({
  destNodeLabel, canGoBack, onContinue, onBack, onRestart, onExit,
}: {
  destNodeLabel: string;
  canGoBack: boolean;
  onContinue: () => void;
  onBack: () => void;
  onRestart: () => void;
  onExit: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button
        type="button"
        onClick={onContinue}
        lang="fa"
        style={{
          minHeight: 52, padding: "12px 24px", borderRadius: 12, border: "none",
          background: "#0F172A", color: "white", fontSize: 14, fontWeight: 700,
          cursor: "pointer", width: "100%",
        }}
      >
        ادامه به: {destNodeLabel} ←
      </button>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {canGoBack && (
          <button
            type="button"
            onClick={onBack}
            lang="fa"
            style={{
              minHeight: 44, padding: "10px 16px", border: "1px solid #E2E8F0",
              borderRadius: 10, fontSize: 12, fontWeight: 600, color: "#374151",
              background: "white", cursor: "pointer",
            }}
          >
            ← مرحله قبلی
          </button>
        )}
        <button
          type="button"
          onClick={onRestart}
          lang="fa"
          style={{
            minHeight: 44, padding: "10px 16px", border: "1px solid #E2E8F0",
            borderRadius: 10, fontSize: 12, fontWeight: 600, color: "#64748B",
            background: "white", cursor: "pointer",
          }}
        >
          شروع دوباره
        </button>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={onExit}
          lang="fa"
          style={{
            minHeight: 44, padding: "10px 16px", border: "1px solid #CBD5E1",
            borderRadius: 10, fontSize: 12, fontWeight: 500, color: "#94A3B8",
            background: "white", cursor: "pointer",
          }}
        >
          خروج از قدم‌به‌قدم
        </button>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function StepwiseDecisionPlayer({
  surface,
  onBlockClick,
}: {
  surface: AlgorithmSurface;
  onBlockClick?: (blockId: string) => void;
}) {
  const selectedNodeId    = useOutlinerStore((s) => s.focusedNodeId);
  const setSelectedNodeId = useOutlinerStore((s) => s.setSelectedNodeId);
  const setMode           = useOutlinerStore((s) => s.setMode);
  const selectedSurfaceId = useOutlinerStore((s) => s.selectedSurfaceId);

  // Session state — reset when surface or mode changes (component unmounts/remounts on mode change)
  const [chosenEdgeId,          setChosenEdgeId]          = useState<string | null>(null);
  const [feedbackShown,         setFeedbackShown]         = useState(false);
  const [stepHistory,           setStepHistory]           = useState<string[]>([]);
  const [revealedCheckpoints,   setRevealedCheckpoints]   = useState<Set<string>>(new Set());
  const [teachingPointRevealed, setTeachingPointRevealed] = useState(false);

  const v4nodes = useMemo(() => surface.nodes as unknown as AlgorithmNodeV4[], [surface.nodes]);
  const v4edges = useMemo(() => surface.edges as unknown as AlgorithmEdgeV4[], [surface.edges]);
  const nodeById = useMemo(() => new Map(v4nodes.map((n) => [n.nodeId, n])), [v4nodes]);
  const edgeById = useMemo(() => new Map(v4edges.map((e) => [e.edgeId, e])), [v4edges]);

  // Entry node preference: entry_anchor → entry → first
  const entryNode = useMemo(
    () =>
      v4nodes.find((n) => n.memoryRole === "entry_anchor") ??
      v4nodes.find((n) => n.nodeType === "entry") ??
      v4nodes[0] ??
      null,
    [v4nodes],
  );

  // Reset session state when the user switches surface
  const prevSurfaceRef = useRef(selectedSurfaceId);
  useEffect(() => {
    if (prevSurfaceRef.current === selectedSurfaceId) return;
    prevSurfaceRef.current = selectedSurfaceId;
    setChosenEdgeId(null);
    setFeedbackShown(false);
    setStepHistory([]);
    setRevealedCheckpoints(new Set());
    setTeachingPointRevealed(false);
  }, [selectedSurfaceId]);

  // Reset teaching point when node changes externally (graph click)
  const prevNodeRef = useRef(selectedNodeId);
  useEffect(() => {
    if (prevNodeRef.current === selectedNodeId) return;
    prevNodeRef.current = selectedNodeId;
    setTeachingPointRevealed(false);
    setChosenEdgeId(null);
    setFeedbackShown(false);
  }, [selectedNodeId]);

  // Auto-select entry node when nothing is selected
  useEffect(() => {
    if (!selectedNodeId && entryNode) {
      setSelectedNodeId(entryNode.nodeId);
    }
  }, [selectedNodeId, entryNode, setSelectedNodeId]);

  const currentNode   = selectedNodeId ? (nodeById.get(selectedNodeId) ?? null) : null;
  const outgoingEdges = useMemo(
    () => (selectedNodeId ? v4edges.filter((e) => e.from === selectedNodeId) : []),
    [v4edges, selectedNodeId],
  );
  const isEndpoint = outgoingEdges.length === 0;

  const chosenEdge  = chosenEdgeId ? (edgeById.get(chosenEdgeId) ?? null) : null;
  const destNode    = chosenEdge   ? (nodeById.get(chosenEdge.to) ?? null) : null;
  const feedbackKind  = chosenEdge ? deriveFeedbackKind(chosenEdge, destNode) : null;
  const feedbackTheme = feedbackKind ? FEEDBACK_THEMES[feedbackKind] : null;

  // Linked items keyed to destination node (for feedback sections)
  const linkedTraps = useMemo(() => {
    if (!destNode) return [];
    return (surface.boardTraps ?? []).filter((trap) => {
      const lnids = (trap as Record<string, unknown>).linkedNodeIds as string[] | undefined;
      return lnids?.includes(destNode.nodeId) || destNode.nodeType === "trap" || destNode.memoryRole === "trap";
    }) as Array<Record<string, unknown>>;
  }, [surface.boardTraps, destNode]);

  const linkedThresholds = useMemo(() => {
    if (!destNode) return [];
    return (surface.thresholds ?? []).filter((t) => {
      const lnids = (t as Record<string, unknown>).linkedNodeIds as string[] | undefined;
      return lnids?.includes(destNode.nodeId) || destNode.nodeType === "threshold" || chosenEdge?.edgeType === "threshold_split";
    }) as Array<Record<string, unknown>>;
  }, [surface.thresholds, destNode, chosenEdge]);

  const linkedCheckpoints = useMemo(() => {
    if (!destNode) return [];
    return (surface.checkpoints ?? []).filter((cp) => {
      const lnids = (cp as Record<string, unknown>).linkedNodeIds as string[] | undefined;
      return lnids?.includes(destNode.nodeId);
    }) as Array<Record<string, unknown>>;
  }, [surface.checkpoints, destNode]);

  function handleChooseEdge(edgeId: string) {
    setChosenEdgeId(edgeId);
    setFeedbackShown(true);
  }

  function handleContinue() {
    if (!chosenEdge || !currentNode) return;
    setStepHistory((prev) => [...prev, currentNode.nodeId]);
    setSelectedNodeId(chosenEdge.to);
    setChosenEdgeId(null);
    setFeedbackShown(false);
    setRevealedCheckpoints(new Set());
    setTeachingPointRevealed(false);
  }

  function handlePrev() {
    if (stepHistory.length === 0) return;
    const prevId = stepHistory[stepHistory.length - 1];
    setStepHistory((prev) => prev.slice(0, -1));
    setSelectedNodeId(prevId);
    setChosenEdgeId(null);
    setFeedbackShown(false);
    setTeachingPointRevealed(false);
  }

  function handleRestart() {
    if (!entryNode) return;
    setStepHistory([]);
    setSelectedNodeId(entryNode.nodeId);
    setChosenEdgeId(null);
    setFeedbackShown(false);
    setRevealedCheckpoints(new Set());
    setTeachingPointRevealed(false);
  }

  if (!currentNode) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <p dir="rtl" lang="fa" style={{ color: "#94A3B8", fontSize: 13 }}>در حال بارگذاری مسیر بالینی...</p>
      </div>
    );
  }

  const nodeTypeLabel   = NODE_TYPE_ROLE_LABELS[currentNode.nodeType] ?? currentNode.nodeType;
  const clinicalQuestion = surface.clinicalQuestion;

  // Linked block IDs on current node for "بازگشت به جزوه"
  const currentLinkedBlocks = (currentNode as unknown as Record<string, unknown>).linkedBlockIds as string[] | undefined;

  return (
    <div dir="rtl" lang="fa" style={{ padding: "20px 20px 40px", maxWidth: 640, margin: "0 auto" }}>
      {/* ── Current step card ── */}
      <CurrentStepCard
        clinicalQuestion={clinicalQuestion}
        node={currentNode}
        nodeTypeLabel={nodeTypeLabel}
        stepNumber={stepHistory.length + 1}
        teachingPointRevealed={teachingPointRevealed}
        onRevealTeachingPoint={() => setTeachingPointRevealed(true)}
      />

      {/* ── Choice phase ── */}
      {!feedbackShown ? (
        isEndpoint ? (
          <EndpointState
            canGoBack={stepHistory.length > 0}
            onBack={handlePrev}
            onFreeMode={() => setMode("free")}
          />
        ) : (
          <div>
            <p style={{
              fontSize: 11, fontWeight: 700, color: "#64748B",
              textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10,
            }}>
              تصمیم می‌گیرید:
            </p>
            {outgoingEdges.map((edge) => (
              <ChoiceButton
                key={edge.edgeId}
                edge={edge}
                destNode={nodeById.get(edge.to) ?? null}
                isChosen={false}
                isOther={false}
                onChoose={handleChooseEdge}
              />
            ))}
          </div>
        )
      ) : (
        /* ── Feedback phase ── */
        <>
          {/* Choice summary — chosen highlighted, others faded */}
          <div style={{ marginBottom: 12 }}>
            <p style={{
              fontSize: 11, fontWeight: 700, color: "#64748B",
              textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10,
            }}>
              انتخاب شما:
            </p>
            {outgoingEdges.map((edge) => (
              <ChoiceButton
                key={edge.edgeId}
                edge={edge}
                destNode={nodeById.get(edge.to) ?? null}
                isChosen={edge.edgeId === chosenEdgeId}
                isOther={edge.edgeId !== chosenEdgeId}
                onChoose={() => { /* no-op while feedback shown */ }}
              />
            ))}
          </div>

          {/* Feedback block */}
          {chosenEdge && feedbackTheme && feedbackKind && (
            <FeedbackBlock
              chosenEdge={chosenEdge}
              destNode={destNode}
              theme={feedbackTheme}
              linkedTraps={linkedTraps}
              linkedThresholds={linkedThresholds}
              linkedCheckpoints={linkedCheckpoints}
              revealedCheckpoints={revealedCheckpoints}
              onRevealCheckpoint={(id) => setRevealedCheckpoints((prev) => new Set([...prev, id]))}
            />
          )}

          {/* Continue / nav controls */}
          {destNode && (
            <ControlRow
              destNodeLabel={destNode.label}
              canGoBack={stepHistory.length > 0}
              onContinue={handleContinue}
              onBack={handlePrev}
              onRestart={handleRestart}
              onExit={() => setMode("free")}
            />
          )}

          {/* بازگشت به جزوه — if current node has linked blocks */}
          {(currentLinkedBlocks?.length ?? 0) > 0 && onBlockClick && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #E2E8F0" }}>
              <button
                type="button"
                onClick={() => onBlockClick(currentLinkedBlocks![0])}
                lang="fa"
                style={{
                  width: "100%", padding: "10px", borderRadius: 8,
                  border: "1px solid #CBD5E1", background: "white",
                  fontSize: 13, fontWeight: 600, color: "#0F172A",
                  cursor: "pointer", minHeight: 44,
                }}
              >
                بازگشت به جزوه
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
