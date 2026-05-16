"use client";

/**
 * ReaderReferenceRail — slim right-side navigation minimap.
 *
 * Desktop: hover dot → preview card, click → jump.
 * iPad / touch: tap dot → preview card, tap "پرش" button → jump.
 * Preview auto-dismisses after 3 s on touch devices.
 *
 * Visible from md (768 px) — covers iPad portrait.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { NoteViewerModel } from "@/lib/contract/note-viewer.types";
import { cn } from "@/lib/utils";

/* ─── Types ─────────────────────────────────────────────── */

type RailMarkerKind =
  | "section"
  | "keypoint"
  | "high-yield"
  | "pearl"
  | "warning"
  | "algorithm"
  | "clinical-decision"
  | "question-link"
  | "threshold"
  | "differential"
  | "complication";

interface RailMarker {
  id: string;
  targetId: string;
  targetAttr: "id" | "frame";
  kind: RailMarkerKind;
  title: string;
  snippet?: string;
  percent: number;
}

/* ─── Kind config ────────────────────────────────────────── */

const KIND_CFG: Record<
  RailMarkerKind,
  { color: string; label: string; icon: string }
> = {
  section:             { color: "#94A3B8", label: "بخش",              icon: "≡"  },
  keypoint:            { color: "#4D9375", label: "نکته کلیدی",       icon: "★"  },
  "high-yield":        { color: "#C8923D", label: "پربازده",          icon: "⚡" },
  pearl:               { color: "#3B93A0", label: "نکته بالینی",      icon: "◈"  },
  warning:             { color: "#BF5050", label: "هشدار",            icon: "⚠"  },
  algorithm:           { color: "#7760C4", label: "الگوریتم",         icon: "⊡"  },
  "clinical-decision": { color: "#3A9E8F", label: "تصمیم بالینی",     icon: "◉"  },
  "question-link":     { color: "#4A87C4", label: "منبع سؤال",        icon: "?"  },
  threshold:           { color: "#C4784A", label: "آستانه بالینی",    icon: "▲"  },
  differential:        { color: "#5C72C4", label: "تشخیص افتراقی",   icon: "±"  },
  complication:        { color: "#B05070", label: "عارضه",            icon: "!"  },
};

/* ─── Build markers from note data ───────────────────────── */

type RawMarker = Omit<RailMarker, "percent">;

function buildRawMarkers(notes: NoteViewerModel[]): RawMarker[] {
  const out: RawMarker[] = [];
  let seq = 0;

  for (const note of notes) {
    for (const section of note.sections) {
      out.push({
        id: `rail-s${seq++}`,
        targetId: section.id,
        targetAttr: "id",
        kind: "section",
        title: section.title,
      });

      for (const frame of section.frames) {
        const fk = frame.kind;
        let kind: RailMarkerKind | null = null;

        if (fk === "keypoint") kind = "keypoint";
        else if (fk === "high_yield" || frame.highYield === true || frame.v8Flags?.highYield === true) kind = "high-yield";
        else if (fk === "pearl") kind = "pearl";
        else if (fk === "warning" || fk === "pitfall" || fk === "trap") kind = "warning";
        else if (fk === "algorithm") kind = "algorithm";
        else if (fk === "clinical_decision") kind = "clinical-decision";
        else if (fk === "threshold" || fk === "indication") kind = "threshold";
        else if (fk === "differential") kind = "differential";
        else if (fk === "complication" || fk === "follow_up") kind = "complication";
        else if ((frame.linkedQuestions?.length ?? 0) > 0) kind = "question-link";

        if (!kind) continue;

        const raw = frame.summary ?? frame.body;
        out.push({
          id: `rail-f${seq++}`,
          targetId: frame.id,
          targetAttr: "frame",
          kind,
          title: frame.title,
          snippet: raw.length > 100 ? raw.slice(0, 100) + "…" : raw,
        });
      }
    }
  }

  return out;
}

/* ─── DOM position helper ────────────────────────────────── */

function elementPercent(m: RawMarker, scrollEl: HTMLElement): number {
  const sh = scrollEl.scrollHeight;
  if (sh <= 0) return -1;

  const target =
    m.targetAttr === "id"
      ? document.getElementById(m.targetId)
      : document.querySelector<HTMLElement>(`[data-frame-id="${CSS.escape(m.targetId)}"]`);
  if (!target) return -1;

  let top = 0;
  let node: HTMLElement | null = target;
  while (node && node !== scrollEl) {
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return Math.max(0, Math.min(97, (top / sh) * 100));
}

/* ─── Preview card ───────────────────────────────────────── */

function PreviewCard({
  marker,
  onJump,
  onDismiss,
  isTouch,
}: {
  marker: RailMarker;
  onJump: () => void;
  onDismiss: () => void;
  isTouch: boolean;
}) {
  const cfg = KIND_CFG[marker.kind];

  return (
    <div
      dir="rtl"
      role="tooltip"
      className={cn(
        "pointer-events-auto absolute right-full z-50",
        "mr-3 w-56",
        "-translate-y-1/2",
        "rounded-2xl border border-lib-border/50",
        "bg-lib-glass/98 backdrop-blur-2xl",
        "shadow-[0_12px_40px_-8px_hsl(var(--foreground)/0.18),0_2px_8px_-2px_hsl(var(--foreground)/0.08)]",
        "px-3.5 py-3",
        "animate-in fade-in slide-in-from-right-2 duration-150",
      )}
      style={{ top: `${marker.percent}%` }}
    >
      {/* Kind badge */}
      <div className="mb-2 flex items-center gap-1.5">
        <span
          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white"
          style={{ backgroundColor: cfg.color }}
        >
          {cfg.icon}
        </span>
        <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-lib-text-muted">
          {cfg.label}
        </span>
      </div>

      {/* Title */}
      <p className="line-clamp-2 text-[12.5px] font-semibold leading-snug text-lib-text">
        {marker.title}
      </p>

      {/* Snippet */}
      {marker.snippet && (
        <p className="mt-1.5 line-clamp-3 text-[11px] leading-relaxed text-lib-text-secondary">
          {marker.snippet}
        </p>
      )}

      {/* Actions */}
      <div className="mt-2.5 flex items-center gap-1.5">
        <button
          type="button"
          onPointerDown={(e) => { e.stopPropagation(); onJump(); }}
          className={cn(
            "flex-1 rounded-xl py-2 text-center",
            "bg-lib-accent text-lib-accent-fg",
            "text-[11px] font-semibold",
            "active:opacity-80 transition-opacity",
            "min-h-[40px]",
          )}
        >
          پرش به این بخش
        </button>
        {isTouch && (
          <button
            type="button"
            onPointerDown={(e) => { e.stopPropagation(); onDismiss(); }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lib-border/50 text-lib-text-muted transition-colors active:bg-lib-hover"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Legend tooltip ─────────────────────────────────────── */

function LegendDot({ kind }: { kind: RailMarkerKind }) {
  const cfg = KIND_CFG[kind];
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-[2.5px] w-3 rounded-[1px]" style={{ backgroundColor: cfg.color }} />
      <span className="text-[9px] text-lib-text-muted">{cfg.label}</span>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────── */

interface ReaderReferenceRailProps {
  notes: NoteViewerModel[];
  scrollRef: RefObject<HTMLDivElement | null>;
  annotationsPanelOpen?: boolean;
  spineOpen?: boolean;
}

export function ReaderReferenceRail({
  notes,
  scrollRef,
  annotationsPanelOpen = false,
  spineOpen = false,
}: ReaderReferenceRailProps) {
  const rawMarkers = useMemo(() => buildRawMarkers(notes), [notes]);

  const [percents, setPercents] = useState<number[]>(() => rawMarkers.map(() => 0));
  const rerafRef = useRef(0);

  const recompute = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (rerafRef.current) cancelAnimationFrame(rerafRef.current);
    rerafRef.current = requestAnimationFrame(() => {
      setPercents(rawMarkers.map((m) => elementPercent(m, el)));
    });
  }, [rawMarkers, scrollRef]);

  useEffect(() => {
    recompute();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    window.addEventListener("resize", recompute, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
      cancelAnimationFrame(rerafRef.current);
    };
  }, [recompute, scrollRef]);

  const [scrollPct, setScrollPct] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const sh = el.scrollHeight;
        setScrollPct(sh > 0 ? (el.scrollTop / sh) * 100 : 0);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrollRef]);

  const markers = useMemo<RailMarker[]>(
    () =>
      rawMarkers
        .map((m, i) => ({ ...m, percent: percents[i] ?? 0 }))
        .filter((m) => m.percent >= 0),
    [rawMarkers, percents],
  );

  const activeId = useMemo(() => {
    let best: RailMarker | null = null;
    for (const m of markers) {
      if (m.percent <= scrollPct + 8 && (!best || m.percent > best.percent)) best = m;
    }
    return best?.id ?? null;
  }, [markers, scrollPct]);

  // preview state — separate hover (mouse) and pinned (touch)
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const touchDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch(typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0));
  }, []);

  const previewId = pinnedId ?? hoveredId;
  const previewMarker = useMemo(
    () => markers.find((m) => m.id === previewId) ?? null,
    [markers, previewId],
  );

  const handleMarkerPointerDown = useCallback(
    (m: RailMarker, e: React.PointerEvent) => {
      if (e.pointerType === "touch" || e.pointerType === "pen") {
        e.preventDefault();
        if (m.kind === "section") {
          // Section: jump directly on touch
          const target =
            m.targetAttr === "id"
              ? document.getElementById(m.targetId)
              : document.querySelector<HTMLElement>(`[data-frame-id="${CSS.escape(m.targetId)}"]`);
          if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
            target.classList.add("reader-anchor-flash");
            window.setTimeout(() => target.classList.remove("reader-anchor-flash"), 1800);
          }
          setPinnedId(null);
          return;
        }
        // Non-section: toggle preview card
        setPinnedId((prev) => (prev === m.id ? null : m.id));
        if (touchDismissTimer.current) clearTimeout(touchDismissTimer.current);
        touchDismissTimer.current = setTimeout(() => setPinnedId(null), 4000);
      }
    },
    [],
  );

  const jumpTo = useCallback((marker: RailMarker) => {
    const target =
      marker.targetAttr === "id"
        ? document.getElementById(marker.targetId)
        : document.querySelector<HTMLElement>(`[data-frame-id="${CSS.escape(marker.targetId)}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.classList.add("reader-anchor-flash");
    window.setTimeout(() => target.classList.remove("reader-anchor-flash"), 1800);
    setHoveredId(null);
    setPinnedId(null);
  }, []);

  const [showLegend, setShowLegend] = useState(false);
  const legendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const legendKinds = useMemo(
    () => [...new Set(markers.filter((m) => m.kind !== "section").map((m) => m.kind))],
    [markers],
  );

  if (markers.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed right-3 z-20",
        // Show from md (768px) — covers iPad portrait
        "top-16 bottom-20",
        "hidden md:block",
        // 28px wide: 4px track + invisible touch padding on each side
        "w-7",
        "transition-opacity duration-200",
        annotationsPanelOpen || spineOpen ? "opacity-0 pointer-events-none" : "opacity-100",
      )}
    >
      {/* ── Track ── */}
      <div
        className="pointer-events-auto relative mx-auto h-full w-[3px] cursor-default rounded-full bg-lib-border/20"
        onMouseEnter={() => {
          if (legendTimer.current) clearTimeout(legendTimer.current);
          legendTimer.current = setTimeout(() => setShowLegend(true), 600);
        }}
        onMouseLeave={() => {
          if (legendTimer.current) clearTimeout(legendTimer.current);
          setShowLegend(false);
          setHoveredId(null);
        }}
      >
        {/* Progress fill */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 rounded-full bg-lib-accent/40 transition-[height] duration-100"
          style={{ height: `${scrollPct}%` }}
        />

        {/* Marker dots */}
        {markers.map((m) => {
          const cfg = KIND_CFG[m.kind];
          const isSection = m.kind === "section";
          const isActive = m.id === activeId;
          const hasPreview = previewId === m.id;

          return (
            <button
              key={m.id}
              type="button"
              aria-label={`${cfg.label}: ${m.title}`}
              /* Large invisible touch target (44×44) centred on the dot */
              className={cn(
                "absolute -left-[18px] -translate-y-1/2",
                "flex h-[44px] w-[44px] items-center justify-center",
                "focus:outline-none",
                "cursor-pointer",
              )}
              style={{ top: `${m.percent}%` }}
              onClick={(e) => {
                if ((e.nativeEvent as PointerEvent).pointerType !== "touch") jumpTo(m);
              }}
              onPointerDown={(e) => handleMarkerPointerDown(m, e)}
              onMouseEnter={() => setHoveredId(m.id)}
              onMouseLeave={() => setHoveredId((id) => (id === m.id ? null : id))}
              onFocus={() => setHoveredId(m.id)}
              onBlur={() => setHoveredId((id) => (id === m.id ? null : id))}
            >
              {/* Visible tick — all markers are horizontal lines */}
              {isSection ? (
                /* Section: wide dim dash */
                <span
                  className={cn(
                    "block rounded-[1px] transition-all duration-200",
                    "h-[1.5px]",
                    isActive || hasPreview
                      ? "w-5 bg-lib-accent/75"
                      : "w-3.5 bg-lib-border/45",
                  )}
                />
              ) : (
                /* Content marker: short colored tick */
                <span
                  className={cn(
                    "block rounded-[1px] transition-all duration-150",
                    isActive || hasPreview
                      ? "h-[3px] w-[14px] opacity-100"
                      : "h-[2.5px] w-[10px] opacity-40 hover:opacity-75 hover:w-[12px]",
                  )}
                  style={{ backgroundColor: cfg.color }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend — appears on long hover over track */}
      {showLegend && legendKinds.length > 0 && (
        <div
          dir="rtl"
          className={cn(
            "pointer-events-none absolute right-full top-1/2 -translate-y-1/2",
            "mr-3 w-36 rounded-xl border border-lib-border/40",
            "bg-lib-glass/95 backdrop-blur-xl px-3 py-2.5",
            "shadow-[0_4px_16px_-4px_hsl(var(--foreground)/0.12)]",
            "space-y-1.5",
            "animate-in fade-in duration-200",
          )}
        >
          <p className="mb-2 text-[9px] font-semibold uppercase tracking-widest text-lib-text-muted">
            راهنما
          </p>
          {legendKinds.map((k) => <LegendDot key={k} kind={k} />)}
        </div>
      )}

      {/* Preview card */}
      {previewMarker && (
        <PreviewCard
          marker={previewMarker}
          onJump={() => jumpTo(previewMarker)}
          onDismiss={() => setPinnedId(null)}
          isTouch={isTouch}
        />
      )}
    </div>
  );
}
