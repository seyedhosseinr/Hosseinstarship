"use client";

import { useId, useMemo } from "react";
import type { KeyboardEvent } from "react";
import type { KnowledgeEdge, KnowledgeNode, KnowledgeSphereData } from "./knowledge-sphere.types";

interface KnowledgeSphereCanvasProps {
  data: KnowledgeSphereData;
  selectedNodeId?: string | null;
  maxVisibleNodes?: number;
  onSelectNode: (node: KnowledgeNode) => void;
}

interface PositionedNode extends KnowledgeNode {
  x: number;
  y: number;
  radius: number;
}

const VIEWBOX_SIZE = 420;
const CENTER = VIEWBOX_SIZE / 2;

export function KnowledgeSphereCanvas({
  data,
  selectedNodeId,
  maxVisibleNodes = 28,
  onSelectNode,
}: KnowledgeSphereCanvasProps) {
  const rawId = useId();
  const filterId = `ks-soft-shadow-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const positioned = useMemo(() => {
    return positionNodes(data.nodes, maxVisibleNodes);
  }, [data.nodes, maxVisibleNodes]);

  const visibleNodeIds = new Set(positioned.map((node) => node.id));
  const visibleEdges = data.edges.filter(
    (edge) => visibleNodeIds.has(edge.sourceId) && visibleNodeIds.has(edge.targetId)
  );

  const nodeMap = new Map(positioned.map((node) => [node.id, node]));

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[520px] overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.92),rgba(248,250,252,0.78))] shadow-inner dark:border-slate-800 dark:bg-[radial-gradient(circle_at_center,rgba(15,23,42,0.95),rgba(2,6,23,0.86))]">
      <svg
        viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
        className="h-full w-full"
        role="img"
        aria-labelledby={`${filterId}-title ${filterId}-desc`}
      >
        <title id={`${filterId}-title`}>نقشه دانش Starship</title>
        <desc id={`${filterId}-desc`}>
          نقشه‌ای شعاعی از فصل‌ها و مباحث؛ رنگ هر گره وضعیت mastery و اندازه آن حجم داده را نشان می‌دهد.
        </desc>

        <defs>
          <filter id={filterId} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="7" stdDeviation="8" floodOpacity="0.12" />
          </filter>
        </defs>

        <circle
          cx={CENTER}
          cy={CENTER}
          r="172"
          fill="none"
          stroke="var(--ks-orbit)"
          strokeDasharray="3 10"
          strokeWidth="1"
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r="116"
          fill="none"
          stroke="var(--ks-orbit)"
          strokeDasharray="2 12"
          strokeWidth="1"
        />

        {visibleEdges.map((edge) => (
          <KnowledgeEdgeLine key={edge.id} edge={edge} nodeMap={nodeMap} />
        ))}

        <g filter={`url(#${filterId})`}>
          <circle cx={CENTER} cy={CENTER} r="48" fill="var(--ks-center-bg)" />
          <circle
            cx={CENTER}
            cy={CENTER}
            r="48"
            fill="none"
            stroke="var(--ks-center-ring)"
            strokeWidth="2"
          />
          <text
            x={CENTER}
            y={CENTER - 8}
            textAnchor="middle"
            className="fill-slate-500 text-[10px] font-medium dark:fill-slate-300"
          >
            آمادگی
          </text>
          <text
            x={CENTER}
            y={CENTER + 16}
            textAnchor="middle"
            className="fill-slate-950 text-[23px] font-black dark:fill-slate-50"
          >
            {toFaDigits(data.summary.averageMastery)}٪
          </text>
          <text
            x={CENTER}
            y={CENTER + 34}
            textAnchor="middle"
            className="fill-slate-400 text-[8px] dark:fill-slate-500"
          >
            پوشش {toFaDigits(data.summary.dataCoverage)}٪
          </text>
        </g>

        {positioned.map((node) => (
          <KnowledgeNodeGlyph
            key={node.id}
            node={node}
            selected={selectedNodeId === node.id}
            filterId={filterId}
            onSelectNode={onSelectNode}
          />
        ))}
      </svg>

      {data.nodes.length > maxVisibleNodes ? (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-full border border-slate-200 bg-white/85 px-3 py-1 text-xs text-slate-500 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-300">
          نمایش {toFaDigits(maxVisibleNodes)} از {toFaDigits(data.nodes.length)} گره؛ جایگاه‌ها با order پایدار می‌مانند
        </div>
      ) : null}
    </div>
  );
}

function KnowledgeEdgeLine({
  edge,
  nodeMap,
}: {
  edge: KnowledgeEdge;
  nodeMap: Map<string, PositionedNode>;
}) {
  const source = nodeMap.get(edge.sourceId);
  const target = nodeMap.get(edge.targetId);

  if (!source || !target) return null;

  const opacity = Math.max(0.12, Math.min(0.48, edge.weight * 0.5));
  const dash = edge.kind === "curriculum_order" ? "4 7" : edge.kind === "co_missed" ? "2 5" : undefined;

  return (
    <line
      x1={source.x}
      y1={source.y}
      x2={target.x}
      y2={target.y}
      stroke="var(--ks-edge)"
      strokeWidth={edge.kind === "co_missed" ? 1.6 : 1}
      strokeOpacity={opacity}
      strokeDasharray={dash}
    />
  );
}

function KnowledgeNodeGlyph({
  node,
  selected,
  filterId,
  onSelectNode,
}: {
  node: PositionedNode;
  selected: boolean;
  filterId: string;
  onSelectNode: (node: KnowledgeNode) => void;
}) {
  const circumference = 2 * Math.PI * (node.radius + 5);
  const dash = (node.visual.ringProgress / 100) * circumference;

  const handleKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectNode(node);
    }
  };

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${node.titleFa}، وضعیت ${node.visual.status}، mastery ${node.metrics.mastery} درصد`}
      className="ks-node cursor-pointer outline-none"
      transform={`translate(${node.x} ${node.y})`}
      onClick={() => onSelectNode(node)}
      onKeyDown={handleKeyDown}
    >
      <title>{`${node.titleFa} — mastery ${node.metrics.mastery}%`}</title>
      {node.visual.pulse ? (
        <circle
          className="ks-pulse"
          r={node.radius + 13}
          fill="none"
          stroke={node.visual.colorToken}
          strokeWidth="2"
          opacity="0.7"
        />
      ) : null}

      <circle
        r={node.radius + 5}
        fill="none"
        stroke="var(--ks-ring-track)"
        strokeWidth="3"
      />
      <circle
        r={node.radius + 5}
        fill="none"
        stroke={node.visual.colorToken}
        strokeWidth="3"
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeLinecap="round"
        transform="rotate(-90)"
      />
      <circle
        r={node.radius}
        fill={node.visual.colorToken}
        opacity={node.visual.opacity}
        stroke={selected ? "var(--ks-selected)" : "rgba(255,255,255,0.78)"}
        strokeWidth={selected ? 3 : 1.5}
        filter={`url(#${filterId})`}
      />
      <text
        y="4"
        textAnchor="middle"
        className="pointer-events-none select-none fill-slate-900 text-[9px] font-bold dark:fill-slate-950"
      >
        {shortLabel(node.titleFa)}
      </text>
    </g>
  );
}

function positionNodes(nodes: KnowledgeNode[], maxVisibleNodes: number): PositionedNode[] {
  const visible = pickVisibleNodes(nodes, maxVisibleNodes).sort(compareStableNodes);
  const total = Math.max(visible.length, 1);

  return visible.map((node, index) => {
    const angle = -Math.PI / 2 + (index / total) * Math.PI * 2;
    const ring = node.kind === "chapter" ? 150 : 112;
    const priorityOffset = Math.min(22, node.metrics.priorityScore / 5);
    const radius = Math.max(82, ring - priorityOffset);

    return {
      ...node,
      x: CENTER + Math.cos(angle) * radius,
      y: CENTER + Math.sin(angle) * radius,
      radius: node.visual.size,
    };
  });
}

function pickVisibleNodes(nodes: KnowledgeNode[], maxVisibleNodes: number): KnowledgeNode[] {
  if (nodes.length <= maxVisibleNodes) return nodes;

  const selected = new Map<string, KnowledgeNode>();

  for (const node of [...nodes].sort((a, b) => b.metrics.priorityScore - a.metrics.priorityScore)) {
    if (node.metrics.hasRealSignal) selected.set(node.id, node);
    if (selected.size >= maxVisibleNodes) break;
  }

  // If the app has many unknown chapter nodes, ensure the graph does not become empty/too narrow.
  for (const node of [...nodes].sort(compareStableNodes)) {
    if (selected.size >= maxVisibleNodes) break;
    selected.set(node.id, node);
  }

  return [...selected.values()];
}

function compareStableNodes(a: KnowledgeNode, b: KnowledgeNode): number {
  const orderA = typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
  const orderB = typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) return orderA - orderB;
  if (a.kind !== b.kind) return a.kind === "chapter" ? -1 : 1;
  return a.id.localeCompare(b.id, "en");
}

function shortLabel(label: string): string {
  const cleaned = label.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 8) return cleaned;
  return `${cleaned.slice(0, 7)}…`;
}

function toFaDigits(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(Math.round(value));
}
