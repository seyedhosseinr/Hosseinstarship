"use client";

/**
 * ReaderReferenceRail — slim right-side navigation minimap for ChapterReaderV2.
 *
 * Renders a thin vertical rail in the right gutter of the reader.  Small marker
 * dots sit at the proportional scroll-height position of each meaningful frame or
 * section heading.  Hovering a marker opens a compact preview card to the left of
 * the rail; clicking / pressing the "پرش به این بخش" button scrolls the target
 * into view and flashes it with the existing reader-anchor-flash animation.
 *
 * Marker kinds (Phase 1 — data-only, no schema changes):
 *   • section          — every section heading
 *   • keypoint         — kind === "keypoint"
 *   • high-yield       — kind === "high_yield" | highYield | v8Flags.highYield
 *   • pearl            — kind === "pearl"
 *   • warning          — kind === "warning" | "pitfall" | "trap"
 *   • algorithm        — kind === "algorithm"
 *   • clinical-decision — kind === "clinical_decision"
 *   • question-link    — linkedQuestions.length > 0 (other kinds covered above)
 *
 * Layout safety:
 *   • hidden below lg (1024 px) — avoids gutter overlap on narrow screens
 *   • hidden when annotations panel is open (both occupy right side)
 *   • z-20 (below toolbar z-40, below progress pill z-30, above content z-0)
 *   • bottom-16 clears the fixed progress pill (bottom-4 ≈ 16 px + ~28 px height)
 *   • top-16 clears the floating toolbar
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { NoteViewerModel } from "@/lib/contract/note-viewer.types";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────── */

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
  /** id attribute value (sections) or data-frame-id value (frames). */
  targetId: string;
  targetAttr: "id" | "frame";
  kind: RailMarkerKind;
  title: string;
  /** Short content preview shown in the hover card. */
  snippet?: string;
  /** 0–100: position within scrollHeight; -1 = target not found in DOM yet. */
  percent: number;
}

/* ─────────────────────────────────────────────────────────────
   Kind metadata (colour + Persian label)
───────────────────────────────────────────────────────────── */

const KIND_CFG: Record<
  RailMarkerKind,
  { dot: string; ring: string; label: string }
> = {
  section:             { dot: "bg-lib-border",              ring: "ring-lib-border",       label: "بخش"            },
  keypoint:            { dot: "bg-emerald-500",             ring: "ring-emerald-400/60",   label: "نکته کلیدی"     },
  "high-yield":        { dot: "bg-amber-400",               ring: "ring-amber-400/60",     label: "پربازده"         },
  pearl:               { dot: "bg-cyan-400",                ring: "ring-cyan-400/60",      label: "نکته بالینی"    },
  warning:             { dot: "bg-rose-500",                ring: "ring-rose-400/60",      label: "هشدار"           },
  algorithm:           { dot: "bg-violet-500",              ring: "ring-violet-400/60",    label: "الگوریتم"        },
  "clinical-decision": { dot: "bg-teal-400",                ring: "ring-teal-400/60",      label: "تصمیم بالینی"   },
  "question-link":     { dot: "bg-sky-400",                 ring: "ring-sky-400/60",       label: "منبع سؤال"      },
  threshold:           { dot: "bg-orange-400",              ring: "ring-orange-400/60",    label: "آستانه بالینی"  },
  differential:        { dot: "bg-indigo-400",              ring: "ring-indigo-400/60",    label: "تشخیص افتراقی"  },
  complication:        { dot: "bg-rose-400",                ring: "ring-rose-400/60",      label: "عارضه"           },
};

/* ─────────────────────────────────────────────────────────────
   Build raw markers from note data (no DOM access)
───────────────────────────────────────────────────────────── */

type RawMarker = Omit<RailMarker, "percent">;

function buildRawMarkers(notes: NoteViewerModel[]): RawMarker[] {
  const out: RawMarker[] = [];
  let seq = 0;

  for (const note of notes) {
    for (const section of note.sections) {
      // Section heading
      out.push({
        id: `rail-s${seq++}`,
        targetId: section.id,
        targetAttr: "id",
        kind: "section",
        title: section.title,
      });

      // Frames
      for (const frame of section.frames) {
        const fk = frame.kind;
        let kind: RailMarkerKind | null = null;

        if (fk === "keypoint") {
          kind = "keypoint";
        } else if (
          fk === "high_yield" ||
          frame.highYield === true ||
          frame.v8Flags?.highYield === true
        ) {
          kind = "high-yield";
        } else if (fk === "pearl") {
          kind = "pearl";
        } else if (fk === "warning" || fk === "pitfall" || fk === "trap") {
          kind = "warning";
        } else if (fk === "algorithm") {
          kind = "algorithm";
        } else if (fk === "clinical_decision") {
          kind = "clinical-decision";
        } else if (fk === "threshold" || fk === "indication") {
          kind = "threshold";
        } else if (fk === "differential") {
          kind = "differential";
        } else if (fk === "complication" || fk === "follow_up") {
          kind = "complication";
        } else if ((frame.linkedQuestions?.length ?? 0) > 0) {
          kind = "question-link";
        }

        if (!kind) continue;

        const raw = frame.summary ?? frame.body;
        const snippet = raw.length > 90 ? raw.slice(0, 90) + "…" : raw;

        out.push({
          id: `rail-f${seq++}`,
          targetId: frame.id,
          targetAttr: "frame",
          kind,
          title: frame.title,
          snippet,
        });
      }
    }
  }

  return out;
}

/* ─────────────────────────────────────────────────────────────
   DOM position helper
───────────────────────────────────────────────────────────── */

function elementPercent(
  m: RawMarker,
  scrollEl: HTMLElement,
): number {
  const sh = scrollEl.scrollHeight;
  if (sh <= 0) return -1;

  const target =
    m.targetAttr === "id"
      ? document.getElementById(m.targetId)
      : document.querySelector<HTMLElement>(
          `[data-frame-id="${CSS.escape(m.targetId)}"]`,
        );
  if (!target) return -1;

  // Walk offsetParent chain up to the scroll container
  let top = 0;
  let node: HTMLElement | null = target;
  while (node && node !== scrollEl) {
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }

  // Clamp to 0–97 so the last marker doesn't press against the rail bottom
  return Math.max(0, Math.min(97, (top / sh) * 100));
}

/* ─────────────────────────────────────────────────────────────
   Preview card (rendered beside the rail on hover/focus)
───────────────────────────────────────────────────────────── */

function PreviewCard({
  marker,
  onJump,
}: {
  marker: RailMarker;
  onJump: () => void;
}) {
  const cfg = KIND_CFG[marker.kind];

  return (
    <div
      dir="rtl"
      role="tooltip"
      /* Position: to the left of the outer rail container, vertically centred
         on the marker's scroll-percent position.  The outer container is
         `relative` so `absolute right-full` escapes to its left edge. */
      className={cn(
        "pointer-events-auto absolute right-full z-50 mr-2.5",
        "w-48",
        "-translate-y-1/2",
        "rounded-[10px] border border-lib-border/55",
        "bg-lib-glass/95 backdrop-blur-xl",
        "shadow-[0_8px_32px_-10px_hsl(var(--foreground)/0.22)]",
        "px-3 py-2.5",
        "animate-in fade-in slide-in-from-right-1 duration-100",
      )}
      style={{ top: `${marker.percent}%` }}
    >
      {/* Kind badge row */}
      <div className="mb-1 flex items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", cfg.dot)} />
        <span className="text-[9px] font-semibold uppercase tracking-[0.13em] text-lib-text-muted">
          {cfg.label}
        </span>
      </div>

      {/* Title */}
      <p className="line-clamp-2 text-[12px] font-semibold leading-snug text-lib-text">
        {marker.title}
      </p>

      {/* Snippet */}
      {marker.snippet && (
        <p className="mt-1 line-clamp-2 text-[11px] leading-[1.55] text-lib-text-secondary">
          {marker.snippet}
        </p>
      )}

      {/* Jump action */}
      <button
        type="button"
        /* onMouseDown fires before the marker's onMouseLeave, so the card
           doesn't vanish before the click registers. */
        onMouseDown={onJump}
        onClick={onJump}
        className={cn(
          "mt-2 inline-flex items-center rounded-full",
          "border border-lib-accent/30 bg-lib-accent-soft px-2.5 py-[3px]",
          "text-[10.5px] font-semibold text-lib-accent",
          "transition-colors hover:bg-lib-accent/20",
        )}
      >
        پرش به این بخش
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main component
───────────────────────────────────────────────────────────── */

interface ReaderReferenceRailProps {
  notes: NoteViewerModel[];
  scrollRef: RefObject<HTMLDivElement | null>;
  /** Hide when the annotations side panel is open (both on right side). */
  annotationsPanelOpen?: boolean;
}

export function ReaderReferenceRail({
  notes,
  scrollRef,
  annotationsPanelOpen = false,
}: ReaderReferenceRailProps) {
  const rawMarkers = useMemo(() => buildRawMarkers(notes), [notes]);

  // Computed DOM positions (0–100 or -1=missing)
  const [percents, setPercents] = useState<number[]>(() =>
    rawMarkers.map(() => 0),
  );
  const rerafRef = useRef(0);

  const recompute = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (rerafRef.current) cancelAnimationFrame(rerafRef.current);
    rerafRef.current = requestAnimationFrame(() => {
      setPercents(rawMarkers.map((m) => elementPercent(m, el)));
    });
  }, [rawMarkers, scrollRef]);

  // Recompute on mount, resize, and window resize
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

  // Current scroll position as a percentage of scrollHeight
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

  // Merge percents into full markers; drop any that weren't found in the DOM
  const markers = useMemo<RailMarker[]>(
    () =>
      rawMarkers
        .map((m, i) => ({ ...m, percent: percents[i] ?? 0 }))
        .filter((m) => m.percent >= 0),
    [rawMarkers, percents],
  );

  // Active = closest marker at or before current scroll position (+small lead)
  const activeId = useMemo(() => {
    let best: RailMarker | null = null;
    for (const m of markers) {
      if (m.percent <= scrollPct + 8) {
        if (!best || m.percent > best.percent) best = m;
      }
    }
    return best?.id ?? null;
  }, [markers, scrollPct]);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hoveredMarker = useMemo(
    () => markers.find((m) => m.id === hoveredId) ?? null,
    [markers, hoveredId],
  );

  const jumpTo = useCallback((marker: RailMarker) => {
    const target =
      marker.targetAttr === "id"
        ? document.getElementById(marker.targetId)
        : document.querySelector<HTMLElement>(
            `[data-frame-id="${CSS.escape(marker.targetId)}"]`,
          );
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    // Reuse the existing reader-anchor-flash keyframe (reader-anchor.css)
    target.classList.add("reader-anchor-flash");
    window.setTimeout(() => target.classList.remove("reader-anchor-flash"), 1800);
    setHoveredId(null);
  }, []);

  if (markers.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        // Fixed right gutter: hidden on narrow screens, fade out when
        // annotations panel is open.
        "pointer-events-none fixed right-2 z-20",
        "top-16 bottom-16",
        "hidden lg:block",
        "w-5",
        "transition-opacity duration-200",
        annotationsPanelOpen ? "opacity-0" : "opacity-100",
      )}
    >
      {/* Rail track — relative so child absolute positions are contained */}
      <div className="pointer-events-auto relative h-full w-[2px] mx-auto rounded-full bg-lib-border/25">

        {/* Scroll-progress fill (teal, grows downward) */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 rounded-full bg-lib-accent/35 transition-[height] duration-75"
          style={{ height: `${scrollPct}%` }}
        />

        {/* Marker dots */}
        {markers.map((m) => {
          const cfg = KIND_CFG[m.kind];
          const isSection = m.kind === "section";
          const isActive = m.id === activeId;

          return (
            <button
              key={m.id}
              type="button"
              aria-label={`${cfg.label}: ${m.title}`}
              onClick={() => jumpTo(m)}
              onMouseEnter={() => setHoveredId(m.id)}
              onMouseLeave={() => setHoveredId((id) => (id === m.id ? null : id))}
              onFocus={() => setHoveredId(m.id)}
              onBlur={() => setHoveredId((id) => (id === m.id ? null : id))}
              className={cn(
                "absolute left-1/2 -translate-x-1/2 -translate-y-1/2",
                "rounded-full transition-all duration-150",
                "focus:outline-none focus-visible:ring-1 focus-visible:ring-lib-accent/60",
                isSection
                  ? cn(
                      "h-px",
                      isActive
                        ? "w-3.5 bg-lib-text-muted/65"
                        : "w-2.5 bg-lib-border/55 hover:w-3 hover:bg-lib-text-muted/50",
                    )
                  : cn(
                      "h-2 w-2",
                      cfg.dot,
                      isActive
                        ? cn("scale-[1.35] ring-2 ring-offset-[1.5px] ring-offset-lib-bg opacity-100", cfg.ring)
                        : "opacity-45 hover:opacity-90 hover:scale-110",
                    ),
              )}
              style={{ top: `${m.percent}%` }}
            />
          );
        })}
      </div>

      {/* Preview card — child of outer container so `right-full` is relative
          to the 20 px-wide rail container (not the 2 px track). */}
      {hoveredMarker && (
        <PreviewCard marker={hoveredMarker} onJump={() => jumpTo(hoveredMarker)} />
      )}
    </div>
  );
}
