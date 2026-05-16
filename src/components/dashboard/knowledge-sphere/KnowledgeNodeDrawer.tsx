"use client";

import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import type { KnowledgeNode, KnowledgeNodeStatus } from "./knowledge-sphere.types";

interface KnowledgeNodeDrawerProps {
  node: KnowledgeNode | null;
  onClose: () => void;
}

const STATUS_LABELS: Record<KnowledgeNodeStatus, string> = {
  mastered: "مسلط",
  stable: "پایدار",
  needs_review: "نیازمند مرور",
  weak: "ضعیف",
  critical: "بحرانی",
  unknown: "داده ناکافی",
};

function nfFormat(value: number): string {
  try {
    return new Intl.NumberFormat("fa-IR").format(value);
  } catch {
    return String(value);
  }
}

export function KnowledgeNodeDrawer({ node, onClose }: KnowledgeNodeDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!node) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [node, onClose]);

  if (!node) return null;

  const recommendedAction = node.actions.find((action) => action.recommended && !action.disabled);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/28 backdrop-blur-sm"
      dir="rtl"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="knowledge-node-drawer-title"
        className="h-full w-full max-w-[430px] overflow-y-auto border-r border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
        onKeyDown={(event) => trapFocusWithinDialog(event, dialogRef.current)}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {node.kind === "chapter" ? "فصل" : "مبحث"}
            </p>
            <h3
              id="knowledge-node-drawer-title"
              className="mt-1 text-xl font-black text-slate-950 dark:text-slate-50"
            >
              {node.titleFa}
            </h3>
            {node.titleEn ? (
              <p dir="ltr" className="mt-1 text-left text-xs text-slate-500 dark:text-slate-400">
                {node.titleEn}
              </p>
            ) : null}
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:hover:bg-slate-900"
            aria-label="بستن نقشه دانش"
          >
            بستن
          </button>
        </div>

        <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex items-center justify-between gap-3">
            <span
              className="rounded-full px-3 py-1 text-xs font-bold text-slate-900"
              style={{ background: node.visual.colorToken }}
            >
              {STATUS_LABELS[node.visual.status]}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              اطمینان داده: {formatPercent(node.metrics.confidence)}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Metric label="Mastery" value={formatPercent(node.metrics.mastery)} />
            <Metric label="Priority" value={formatPercent(node.metrics.priorityScore)} />
            <Metric label="MCQ accuracy" value={formatNullablePercent(node.metrics.mcqAccuracy)} />
            <Metric label="MCQ score" value={formatNullablePercent(node.metrics.mcqScore)} />
            <Metric label="اشتباهات MCQ" value={nfFormat(node.metrics.wrongMcqCount)} />
            <Metric label="Flashcard score" value={formatNullablePercent(node.metrics.flashcardScore)} />
            <Metric label="Retention واقعی" value={formatNullablePercent(node.metrics.flashcardRetention)} />
            <Metric label="Retrievability" value={formatNullablePercent(node.metrics.flashcardRetrievability)} />
            <Metric label="فلش‌کارت موعددار" value={nfFormat(node.metrics.dueFlashcardCount)} />
            <Metric label="پوشش Reader" value={formatPercent(node.metrics.readerCoverage)} />
            <Metric
              label="زمان پیشنهادی"
              value={node.metrics.estimatedReviewMinutes ? `${nfFormat(node.metrics.estimatedReviewMinutes)} دقیقه` : "—"}
            />
            <Metric label="آخرین مطالعه" value={formatLastStudied(node.metrics.daysSinceLastStudy)} />
          </div>
        </div>

        {!node.metrics.hasRealSignal ? (
          <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-7 text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
            برای این گره هنوز سیگنال واقعی از Reader، MCQ یا Flashcard وجود ندارد. این وضعیت را به‌عنوان ضعف قطعی تفسیر نکن.
          </div>
        ) : null}

        {recommendedAction ? (
          <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-200">
              اقدام پیشنهادی بعدی
            </p>
            <a
              href={recommendedAction.href}
              className="mt-2 inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
            >
              {recommendedAction.label}
              {typeof recommendedAction.count === "number" && recommendedAction.count > 0
                ? ` (${nfFormat(recommendedAction.count)})`
                : ""}
            </a>
          </div>
        ) : null}

        <div className="mt-5 space-y-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            مسیرهای سریع
          </p>
          {node.actions.map((action) => (
            <a
              key={`${action.kind}:${action.href}`}
              href={action.disabled ? undefined : action.href}
              aria-disabled={action.disabled ? "true" : undefined}
              className={`flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium dark:border-slate-800 dark:bg-slate-950 ${
                action.disabled
                  ? "pointer-events-none text-slate-400 opacity-60 dark:text-slate-600"
                  : "text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:text-slate-200 dark:hover:bg-slate-900"
              }`}
            >
              <span>{action.label}</span>
              {typeof action.count === "number" ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                  {nfFormat(action.count)}
                </span>
              ) : null}
            </a>
          ))}
        </div>
      </aside>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-1 text-base font-bold text-slate-950 dark:text-slate-50">{value}</dd>
    </div>
  );
}

function formatPercent(value: number): string {
  return `${nfFormat(Math.round(value))}٪`;
}

function formatNullablePercent(value: number | null): string {
  return value === null ? "—" : formatPercent(value);
}

function formatLastStudied(days: number | null): string {
  if (days === null) return "—";
  if (days === 0) return "امروز";
  if (days === 1) return "دیروز";
  return `${nfFormat(days)} روز پیش`;
}

function trapFocusWithinDialog(event: KeyboardEvent<HTMLElement>, dialog: HTMLDivElement | null) {
  if (event.key !== "Tab" || !dialog) return;

  const focusable = Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hasAttribute("disabled") && element.getAttribute("aria-disabled") !== "true");

  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
