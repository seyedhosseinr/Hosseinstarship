import type { KnowledgeNodeStatus } from "./knowledge-sphere.types";

const LEGEND_ITEMS: Array<{ status: KnowledgeNodeStatus; label: string; color: string }> = [
  { status: "mastered", label: "مسلط", color: "var(--ks-mastered)" },
  { status: "stable", label: "پایدار", color: "var(--ks-stable)" },
  { status: "needs_review", label: "نیازمند مرور", color: "var(--ks-needs-review)" },
  { status: "weak", label: "ضعیف", color: "var(--ks-weak)" },
  { status: "critical", label: "بحرانی", color: "var(--ks-critical)" },
  { status: "unknown", label: "داده ناکافی", color: "var(--ks-unknown)" },
];

export function KnowledgeSphereLegend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-300">
      {LEGEND_ITEMS.map((item) => (
        <span
          key={item.status}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/70 px-2.5 py-1 dark:border-slate-700 dark:bg-slate-900/70"
        >
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
