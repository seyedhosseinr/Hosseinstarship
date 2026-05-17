"use client";

import { useState } from "react";
import { useOutlinerStore } from "@/components/outliner/outliner-store";
import type { AlgorithmNodeV4, AlgorithmEdgeV4 } from "@/types/algorithm-ir-v4";
import type { AlgorithmSurface } from "@/types/algorithm-ir";
import {
  NODE_TYPE_ROLE_LABELS, NODE_COLORS, MEMORY_ROLE_PILLS, EDGE_STYLES, DEFAULT_EDGE_STYLE,
} from "@/components/outliner/renderers";

// ── Helpers ───────────────────────────────────────────────────────────────────

function nodeColorOf(nodeType: string): string {
  return NODE_COLORS[nodeType] ?? "#94A3B8";
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 16 }}>
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748B", marginBottom: 6 }}>
        {title}
      </p>
      {children}
    </div>
  );
}

// ── Decision chip ─────────────────────────────────────────────────────────────

function DecisionChip({ label, edgeType, onClick }: { label: string; edgeType?: string; onClick: () => void }) {
  const es = EDGE_STYLES[edgeType ?? ""] ?? DEFAULT_EDGE_STYLE;
  return (
    <button
      type="button"
      onClick={onClick}
      dir="rtl" lang="fa"
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        border: `1px solid ${es.color}`, borderRadius: 8, padding: "4px 10px",
        fontSize: 12, fontWeight: 500, color: "#0F172A", background: "white", cursor: "pointer",
        transition: "background 120ms",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: es.color, flexShrink: 0 }} />
      {label}
    </button>
  );
}

// ── Trap card ─────────────────────────────────────────────────────────────────

function TrapCard({ trap }: { trap: Record<string, unknown> }) {
  const title = (trap.trapTitle as string | undefined) ?? "دام بوردی";
  const wrong = trap.wrongPath as string | undefined;
  const correct = trap.correctPath as string | undefined;
  const why = trap.whyItMatters as string | undefined;

  return (
    <article style={{ border: "1px solid #FDA4AF", borderRadius: 10, overflow: "hidden", marginBottom: 8 }}>
      <div style={{ background: "#FFF1F2", padding: "8px 12px" }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#BE123C" }}>⚠ {title}</p>
      </div>
      {(wrong || correct) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: "1px solid #FEE2E2" }}>
          {wrong && (
            <div style={{ padding: "8px 10px", borderLeft: "1px solid #FEE2E2" }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: "#BE123C", marginBottom: 4 }}>✗ اشتباه</p>
              <p style={{ fontSize: 11, color: "#4B5563", direction: "rtl" }}>{wrong}</p>
            </div>
          )}
          {correct && (
            <div style={{ padding: "8px 10px" }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: "#065F46", marginBottom: 4 }}>✓ درست</p>
              <p style={{ fontSize: 11, color: "#4B5563", direction: "rtl" }}>{correct}</p>
            </div>
          )}
        </div>
      )}
      {why && (
        <div style={{ borderTop: "1px solid #FEE2E2", padding: "6px 12px", background: "white" }}>
          <p style={{ fontSize: 11, fontStyle: "italic", color: "#6B7280", direction: "rtl" }}>{why}</p>
        </div>
      )}
    </article>
  );
}

// ── RevealBox — testablePoint in exam mode ────────────────────────────────────

function RevealBox({ nodeId, content }: { nodeId: string; content: string }) {
  const revealedTestablePoints = useOutlinerStore((s) => s.revealedTestablePoints);
  const revealTestablePoint    = useOutlinerStore((s) => s.revealTestablePoint);
  const isRevealed = revealedTestablePoints.has(nodeId);

  if (isRevealed) {
    return (
      <div style={{
        background: "var(--sp-accent-soft, #E0F2F1)", borderRight: "3px solid var(--sp-accent, #0F766E)",
        borderRadius: 8, padding: "12px 14px",
      }} dir="rtl" lang="fa">
        <p style={{ fontSize: 13, color: "#0F3F3A", lineHeight: 1.7 }}>{content}</p>
      </div>
    );
  }

  return (
    <div style={{
      background: "var(--sp-surface-alt, #F8FAFC)", border: "1px solid var(--sp-border, #D7E0E5)",
      borderRadius: 8, padding: "12px 14px", textAlign: "center",
    }}>
      <button
        type="button"
        onClick={() => revealTestablePoint(nodeId)}
        style={{
          background: "var(--sp-accent, #0F766E)", color: "white", border: "none", borderRadius: 8,
          padding: "8px 20px", fontSize: 12, fontWeight: 600, cursor: "pointer",
        }}
        lang="fa"
      >
        نمایش پاسخ
      </button>
    </div>
  );
}

// ── LearningPanelBody — the full IR-driven content ────────────────────────────

export function LearningPanelBody({
  surface, node, onBlockClick,
}: {
  surface: AlgorithmSurface;
  node: AlgorithmNodeV4;
  onBlockClick?: (blockId: string) => void;
}) {
  const mode              = useOutlinerStore((s) => s.mode);
  const setSelectedNodeId = useOutlinerStore((s) => s.setSelectedNodeId);
  const [examRevealed, setExamRevealed] = useState(false);

  const color = nodeColorOf(node.nodeType);
  const pill  = node.memoryRole ? MEMORY_ROLE_PILLS[node.memoryRole] : null;
  const v4edges = surface.edges as unknown as AlgorithmEdgeV4[];

  // Outgoing edges and their target nodes
  const outgoingEdges = v4edges.filter((e) => e.from === node.nodeId);
  const nodeById = new Map(
    (surface.nodes as unknown as AlgorithmNodeV4[]).map((n) => [n.nodeId, n]),
  );

  // Linked thresholds
  const linkedThresholds = (surface.thresholds ?? []).filter((t) => {
    const lnids = (t as Record<string, unknown>).linkedNodeIds as string[] | undefined;
    return lnids?.includes(node.nodeId) || node.nodeType === "threshold";
  });

  // Linked boardTraps
  const linkedTraps = (surface.boardTraps ?? []).filter((trap) => {
    const lnids = (trap as Record<string, unknown>).linkedNodeIds as string[] | undefined;
    return lnids?.includes(node.nodeId)
      || node.memoryRole === "trap"
      || node.nodeType === "trap";
  });

  // Linked checkpoints
  const linkedCheckpoints = (surface.checkpoints ?? []).filter((cp) => {
    const lnids = (cp as Record<string, unknown>).linkedNodeIds as string[] | undefined;
    return lnids?.includes(node.nodeId);
  });

  // Linked gates (entry node OR linkedBlockIds overlap)
  const nodeBlockIds = new Set(node.linkedBlockIds ?? []);
  const linkedGates = (surface.gates ?? []).filter((gate) => {
    const gateBlocks = (gate as Record<string, unknown>).linkedBlockIds as string[] | undefined;
    return node.nodeType === "entry"
      || (gateBlocks ?? []).some((b) => nodeBlockIds.has(b));
  });

  // Linked matrices (linkedBlockIds overlap)
  const linkedMatrices = (surface.matrices ?? []).filter((matrix) => {
    const rows = matrix.rows ?? [];
    return rows.some((row) => {
      const rowBlocks = (row as Record<string, unknown>).linkedBlockIds as string[] | undefined;
      return (rowBlocks ?? []).some((b) => nodeBlockIds.has(b));
    });
  });

  return (
    <div style={{ padding: "18px 18px 14px", display: "flex", flexDirection: "column", gap: 0, overflowY: "auto", flex: 1 }} dir="rtl" lang="fa">

      {/* 1. Label with nodeType icon */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
        <p style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", lineHeight: 1.4, flex: 1 }}>
          {node.label}
        </p>
      </div>

      {/* memory role pill */}
      {pill && (
        <span style={{ borderRadius: 999, padding: "2px 8px", fontSize: 10, fontWeight: 600, background: pill.bg, color: pill.text, alignSelf: "flex-start", marginBottom: 4 }}>
          {pill.label}
        </span>
      )}

      {/* 2. nodeType role label */}
      <p style={{ fontSize: 11, color: "#94A3B8", fontVariant: "small-caps", marginBottom: 12 }}>
        {NODE_TYPE_ROLE_LABELS[node.nodeType] ?? node.nodeType}
      </p>

      {/* 3. testablePoint */}
      {node.testablePoint && (
        <div style={{ marginBottom: 12 }}>
          {mode === "exam" ? (
            <RevealBox nodeId={node.nodeId} content={node.testablePoint} />
          ) : mode === "recall" ? null : (
            <div style={{
              background: "var(--sp-accent-soft, #E0F2F1)", borderRight: "3px solid var(--sp-accent, #0F766E)",
              borderRadius: 8, padding: "12px 14px",
            }}>
              <p style={{ fontSize: 13, color: "#0F3F3A", lineHeight: 1.7 }}>{node.testablePoint}</p>
            </div>
          )}
        </div>
      )}

      {/* 4. detail */}
      {node.detail && (
        <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, marginBottom: 12 }}>{node.detail}</p>
      )}

      {/* 5. Outgoing edges — تصمیم بعدی */}
      {outgoingEdges.length > 0 && (
        <Section title="تصمیم بعدی">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {outgoingEdges.map((edge) => {
              const target = nodeById.get(edge.to);
              const chipLabel = edge.condition
                ? `${edge.condition}${target ? ` ← ${target.label}` : ""}`
                : target?.label ?? edge.to;
              return (
                <DecisionChip
                  key={edge.edgeId}
                  label={chipLabel}
                  edgeType={edge.edgeType}
                  onClick={() => setSelectedNodeId(edge.to)}
                />
              );
            })}
          </div>
        </Section>
      )}

      {/* 6. Linked thresholds — آستانه‌های مرتبط */}
      {linkedThresholds.length > 0 && (
        <Section title="آستانه‌های مرتبط">
          {linkedThresholds.map((t, i) => (
            <div key={t.id ?? i} style={{
              display: "flex", alignItems: "center", gap: 10,
              border: "1px solid #FDE68A", borderRadius: 8, padding: "8px 12px",
              background: "#FFFBEB", marginBottom: 6,
            }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: "#D97706", fontVariantNumeric: "tabular-nums" }}>{t.value}</span>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{t.variable}</p>
                {t.conditionText && <p style={{ fontSize: 11, color: "#6B7280" }}>{t.conditionText}</p>}
                {Boolean((t as Record<string, unknown>).memoryAnchor) && (
                  <p style={{ fontSize: 11, fontStyle: "italic", color: "#92400E" }}>{String((t as Record<string, unknown>).memoryAnchor)}</p>
                )}
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* 7. Board traps — چرا بوردی‌ها اشتباه می‌کنند؟ */}
      {linkedTraps.length > 0 && (
        <Section title="چرا بوردی‌ها اشتباه می‌کنند؟">
          {linkedTraps.map((trap, i) => (
            <TrapCard key={trap.id ?? i} trap={trap as Record<string, unknown>} />
          ))}
        </Section>
      )}

      {/* 8. Checkpoints — چک‌پوینت */}
      {linkedCheckpoints.length > 0 && (
        <Section title="چک‌پوینت">
          {linkedCheckpoints.map((cp, i) => (
            <CheckpointCard key={cp.id ?? i} cp={cp as Record<string, unknown>} />
          ))}
        </Section>
      )}

      {/* 9. Gates — دروازه اندیکاسیون */}
      {linkedGates.length > 0 && (
        <Section title="دروازه اندیکاسیون">
          {linkedGates.map((gate, i) => (
            <GateCard key={gate.id ?? i} gate={gate as Record<string, unknown>} />
          ))}
        </Section>
      )}

      {/* 10. Matrices — ماتریس تصمیم */}
      {linkedMatrices.length > 0 && (
        <Section title="ماتریس تصمیم">
          {linkedMatrices.map((matrix, i) => (
            <MatrixCard key={matrix.id ?? i} matrix={matrix as Record<string, unknown>} />
          ))}
        </Section>
      )}

      {/* 11. بازگشت به جزوه */}
      {(node.linkedBlockIds ?? []).length > 0 && onBlockClick && (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #E2E8F0" }}>
          <button
            type="button"
            onClick={() => onBlockClick(node.linkedBlockIds![0])}
            style={{
              width: "100%", padding: "10px", borderRadius: 8,
              border: "1px solid #CBD5E1", background: "white",
              fontSize: 13, fontWeight: 600, color: "#0F172A",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
            lang="fa"
          >
            بازگشت به جزوه
          </button>
        </div>
      )}
    </div>
  );
}

// ── Checkpoint card ───────────────────────────────────────────────────────────

function CheckpointCard({ cp }: { cp: Record<string, unknown> }) {
  const [revealed, setRevealed] = useState(false);
  const prompt = cp.prompt as string | undefined;
  const answer = cp.answer as string | undefined;
  const why    = cp.whyItMatters as string | undefined;

  return (
    <div style={{ border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden", marginBottom: 8 }}>
      <div style={{ padding: "10px 12px", background: "#F8FAFC" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{prompt ?? "—"}</p>
      </div>
      {revealed ? (
        <div style={{ padding: "10px 12px", borderTop: "1px solid #E2E8F0", background: "white" }}>
          <p style={{ fontSize: 12, color: "#374151" }}>{answer ?? "—"}</p>
          {why && <p style={{ fontSize: 11, fontStyle: "italic", color: "#6B7280", marginTop: 4 }}>{why}</p>}
        </div>
      ) : (
        <div style={{ padding: "8px 12px", borderTop: "1px solid #E2E8F0", textAlign: "center" }}>
          <button type="button" onClick={() => setRevealed(true)}
            style={{ fontSize: 11, color: "#3B82F6", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
            lang="fa">
            نمایش پاسخ
          </button>
        </div>
      )}
    </div>
  );
}

// ── Gate card ─────────────────────────────────────────────────────────────────

function GateCard({ gate }: { gate: Record<string, unknown> }) {
  const title    = gate.title as string | undefined;
  const entry    = gate.entryCondition as string | undefined;
  const include  = gate.includeCriteria as string[] | undefined;
  const exclude  = gate.excludeCriteria as string[] | undefined;
  const pass     = gate.actionIfPass as string | undefined;
  const fail     = gate.actionIfFail as string | undefined;

  return (
    <div style={{ border: "1px solid #FDE68A", borderRadius: 10, overflow: "hidden", marginBottom: 8, background: "#FFFBEB" }}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #FDE68A" }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#92400E" }}>{title ?? "دروازه"}</p>
        {entry && <p style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{entry}</p>}
      </div>
      <div style={{ padding: "8px 12px" }}>
        {include && include.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#065F46", marginBottom: 2 }}>✓ شامل می‌شود</p>
            {include.map((c, i) => <p key={i} style={{ fontSize: 11, color: "#374151" }}>• {c}</p>)}
          </div>
        )}
        {exclude && exclude.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#BE123C", marginBottom: 2 }}>✗ شامل نمی‌شود</p>
            {exclude.map((c, i) => <p key={i} style={{ fontSize: 11, color: "#374151" }}>• {c}</p>)}
          </div>
        )}
        {(pass || fail) && (
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            {pass && <span style={{ fontSize: 11, color: "#065F46" }}>✓ {pass}</span>}
            {fail && <span style={{ fontSize: 11, color: "#BE123C" }}>✗ {fail}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Matrix card ───────────────────────────────────────────────────────────────

function MatrixCard({ matrix }: { matrix: Record<string, unknown> }) {
  const title = matrix.title as string | undefined;
  const rows  = matrix.rows as Array<Record<string, unknown>> | undefined ?? [];

  return (
    <div style={{ border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden", marginBottom: 8 }}>
      <div style={{ padding: "8px 12px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{title}</p>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F1F5F9", borderBottom: "1px solid #E2E8F0" }}>
              {["شرط", "تصمیم", "دلیل"].map((h) => (
                <th key={h} style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: "#374151" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                <td style={{ padding: "5px 8px", color: "#6B7280" }} dir="rtl">{String(row.condition ?? "—")}</td>
                <td style={{ padding: "5px 8px", fontWeight: 600, color: "#0F172A" }} dir="rtl">{String(row.decision ?? "—")}</td>
                <td style={{ padding: "5px 8px", color: "#6B7280" }} dir="rtl">{String(row.reason ?? "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 12, padding: "32px 20px", textAlign: "center" }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="10" cy="10" r="9" stroke="#E2E8F0" strokeWidth="1.5" />
          <path d="M10 6v4m0 4h.01" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <p style={{ fontSize: 13, fontWeight: 500, color: "#0F172A" }} dir="rtl" lang="fa">یک کارت الگوریتم را انتخاب کنید</p>
      <p style={{ fontSize: 12, color: "#64748B" }} dir="rtl" lang="fa">تا مسیر بالینی، تصمیم بعدی و دام‌های بوردی نمایش داده شود.</p>
    </div>
  );
}

// ── LearningPanel — desktop side rail ────────────────────────────────────────

export function LearningPanel({ onBlockClick }: { onBlockClick?: (blockId: string) => void }) {
  const focusedNodeId   = useOutlinerStore((s) => s.focusedNodeId);
  const surfaces        = useOutlinerStore((s) => s.surfaces);
  const selectedSurfaceId = useOutlinerStore((s) => s.selectedSurfaceId);

  const currentSurface = surfaces.find((s) => s.id === selectedSurfaceId) ?? surfaces[0] ?? null;
  const selectedNode = currentSurface
    ? (currentSurface.nodes as unknown as AlgorithmNodeV4[]).find((n) => n.nodeId === focusedNodeId)
    : null;

  const isEmpty = !focusedNodeId || !selectedNode;

  return (
    <aside
      data-outliner-learning-panel
      aria-hidden={isEmpty}
      style={{
        borderLeft: "1px solid var(--sp-border, #D7E0E5)",
        background: "var(--sp-surface)",
        display: isEmpty ? "none" : "flex",
        flexDirection: "column",
        width: 340,
        flexShrink: 0,
        overflowY: "auto",
      }}
      className="hidden lg:flex"
    >
      {isEmpty ? (
        <EmptyState />
      ) : (
        <LearningPanelBody
          surface={currentSurface!}
          node={selectedNode!}
          onBlockClick={onBlockClick}
        />
      )}
    </aside>
  );
}

// ── Mobile bottom-sheet variant ───────────────────────────────────────────────

export function LearningPanelBottomSheet({ onBlockClick }: { onBlockClick?: (blockId: string) => void }) {
  const focusedNodeId   = useOutlinerStore((s) => s.focusedNodeId);
  const surfaces        = useOutlinerStore((s) => s.surfaces);
  const selectedSurfaceId = useOutlinerStore((s) => s.selectedSurfaceId);

  const currentSurface = surfaces.find((s) => s.id === selectedSurfaceId) ?? surfaces[0] ?? null;
  const selectedNode = currentSurface
    ? (currentSurface.nodes as unknown as AlgorithmNodeV4[]).find((n) => n.nodeId === focusedNodeId)
    : null;

  if (!focusedNodeId || !selectedNode || !currentSurface) return null;

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-30 flex max-h-[52vh] flex-col rounded-t-lg border-t bg-white shadow-lg lg:hidden"
      style={{ borderColor: "var(--sp-border, #D7E0E5)" }}
    >
      <div className="mx-auto mt-2 h-1 w-10 rounded-full" style={{ background: "#E2E8F0" }} />
      <div style={{ overflowY: "auto", flex: 1 }}>
        <LearningPanelBody
          surface={currentSurface}
          node={selectedNode}
          onBlockClick={onBlockClick}
        />
      </div>
    </div>
  );
}
