"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { KnowledgeNodeDrawer } from "./KnowledgeNodeDrawer";
import { KnowledgeSphereCanvas } from "./KnowledgeSphereCanvas";
import { KnowledgeSphereEmptyState } from "./KnowledgeSphereEmptyState";
import { KnowledgeSphereLegend } from "./KnowledgeSphereLegend";
import type { KnowledgeNode, KnowledgeSphereData } from "./knowledge-sphere.types";

interface KnowledgeSphereProps {
  data: KnowledgeSphereData;
  title?: string;
  subtitle?: string;
  maxVisibleNodes?: number;
  className?: string;
}

const nf = new Intl.NumberFormat("fa-IR");

export function KnowledgeSphere({
  data,
  title = "نقشه دانش",
  subtitle = "وضعیت زنده دانش براساس Reader، MCQ و Flashcard",
  maxVisibleNodes = 28,
  className = "",
}: KnowledgeSphereProps) {
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);

  useEffect(() => {
    if (!selectedNode) return;
    if (!data.nodes.some((node) => node.id === selectedNode.id)) setSelectedNode(null);
  }, [data.nodes, selectedNode]);

  const topPriorityNodes = useMemo(() => {
    const priorityIds = new Set(data.summary.topPriorityNodeIds);
    return data.nodes
      .filter((node) => priorityIds.has(node.id) && node.metrics.hasRealSignal)
      .sort((a, b) => b.metrics.priorityScore - a.metrics.priorityScore)
      .slice(0, 3);
  }, [data.nodes, data.summary.topPriorityNodeIds]);

  const selectedNodeId = selectedNode?.id ?? null;

  if (!data.nodes.length) {
    return (
      <section className={className} dir="rtl" aria-label="نقشه دانش Starship">
        <KnowledgeSphereStyles />
        <KnowledgeSphereEmptyState />
      </section>
    );
  }

  return (
    <section
      dir="rtl"
      aria-label="نقشه دانش Starship"
      className={`study-knowledge-sphere rounded-[2rem] border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/75 sm:p-5 ${className}`}
      style={knowledgeSphereStyleVars}
    >
      <KnowledgeSphereStyles />

      <header className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Starship Knowledge Map
          </p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950 dark:text-slate-50">
            {title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {subtitle}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[330px]">
          <SummaryPill label="آمادگی" value={`${nf.format(data.summary.averageMastery)}٪`} />
          <SummaryPill label="پوشش داده" value={`${nf.format(data.summary.dataCoverage)}٪`} />
          <SummaryPill label="مرور فوری" value={nf.format(data.summary.dueNowCount)} />
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_270px] xl:items-center">
        <KnowledgeSphereCanvas
          data={data}
          selectedNodeId={selectedNodeId}
          maxVisibleNodes={maxVisibleNodes}
          onSelectNode={setSelectedNode}
        />

        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              ضعیف‌ترین / فوری‌ترین مباحث
            </h3>
            {topPriorityNodes.length ? (
              <div className="mt-3 space-y-2">
                {topPriorityNodes.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => setSelectedNode(node)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-right text-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
                  >
                    <span className="min-w-0 truncate font-semibold text-slate-800 dark:text-slate-100">
                      {node.titleFa}
                    </span>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold text-slate-900"
                      style={{ background: node.visual.colorToken }}
                    >
                      {nf.format(node.metrics.priorityScore)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-7 text-slate-500 dark:text-slate-400">
                فعلاً گره فوری یا ضعیف با داده کافی وجود ندارد.
              </p>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 text-sm leading-7 text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300">
            <strong className="text-slate-900 dark:text-slate-100">تفسیر عدد آمادگی:</strong>{" "}
            میانگین فقط روی گره‌هایی حساب می‌شود که سیگنال واقعی و confidence کافی دارند؛ nodeهای خاکستری در پوشش داده جدا حساب می‌شوند.
          </div>

          <KnowledgeSphereLegend />
        </aside>
      </div>

      <KnowledgeNodeDrawer node={selectedNode} onClose={() => setSelectedNode(null)} />
    </section>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/70">
      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 text-base font-black text-slate-950 dark:text-slate-50">{value}</p>
    </div>
  );
}

const knowledgeSphereStyleVars = {
  "--ks-mastered": "#8EDFC5",
  "--ks-stable": "#90C8FF",
  "--ks-needs-review": "#F6E58D",
  "--ks-weak": "#FFCB8C",
  "--ks-critical": "#FFB3C8",
  "--ks-unknown": "#CBD5E1",
  "--ks-edge": "rgba(100, 116, 139, 0.72)",
  "--ks-orbit": "rgba(148, 163, 184, 0.34)",
  "--ks-ring-track": "rgba(148, 163, 184, 0.28)",
  "--ks-center-bg": "rgba(255,255,255,0.9)",
  "--ks-center-ring": "rgba(15, 23, 42, 0.12)",
  "--ks-selected": "rgba(15, 23, 42, 0.86)",
} as CSSProperties;

function KnowledgeSphereStyles() {
  return (
    <style>{`
      .dark .study-knowledge-sphere {
        --ks-edge: rgba(148, 163, 184, 0.6);
        --ks-orbit: rgba(148, 163, 184, 0.22);
        --ks-ring-track: rgba(148, 163, 184, 0.20);
        --ks-center-bg: rgba(15,23,42,0.92);
        --ks-center-ring: rgba(226,232,240,0.16);
        --ks-selected: rgba(248,250,252,0.92);
      }

      .ks-node:hover circle:last-of-type,
      .ks-node:focus-visible circle:last-of-type {
        filter: brightness(1.04);
      }

      .ks-node:focus-visible circle:last-of-type {
        stroke-width: 4;
      }

      .ks-pulse {
        transform-origin: center;
        animation: ks-pulse-ring 1.9s ease-out infinite;
      }

      @keyframes ks-pulse-ring {
        0% { opacity: 0.75; stroke-width: 2; }
        65% { opacity: 0; stroke-width: 6; }
        100% { opacity: 0; stroke-width: 6; }
      }

      @media (prefers-reduced-motion: reduce) {
        .ks-pulse { animation: none !important; }
      }

      .animations-paused .ks-pulse {
        animation-play-state: paused !important;
      }
    `}</style>
  );
}
