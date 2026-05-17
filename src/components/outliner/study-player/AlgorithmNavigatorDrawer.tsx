"use client";

import { useEffect } from "react";
import { CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOutlinerStore } from "@/components/outliner/outliner-store";
import { algorithmDisplayTitle } from "@/components/outliner/navigation-labels";

export function AlgorithmNavigatorDrawer() {
  const isOpen             = useOutlinerStore((s) => s.isNavigatorOpen);
  const setNavigatorOpen   = useOutlinerStore((s) => s.setNavigatorOpen);
  const surfaces           = useOutlinerStore((s) => s.surfaces);
  const currentSurfaceIndex = useOutlinerStore((s) => s.currentSurfaceIndex);
  const setSurfaceIndex    = useOutlinerStore((s) => s.setSurfaceIndex);
  const completedSurfaceIds = useOutlinerStore((s) => s.completedSurfaceIds);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        setNavigatorOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, setNavigatorOpen]);

  function handleSelect(index: number) {
    setSurfaceIndex(index);
    setNavigatorOpen(false);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={() => setNavigatorOpen(false)}
        className={cn(
          "fixed inset-0 z-30 bg-black/20 transition-opacity duration-200",
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Drawer panel */}
      <div
        data-outliner-navigator-drawer
        data-panel="sidebar"
        role="dialog"
        aria-label="فهرست الگوریتم‌ها"
        aria-modal="true"
        aria-hidden={!isOpen}
        className={cn(
          "fixed inset-y-0 right-0 z-40 flex w-72 flex-col shadow-xl transition-transform duration-200",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
        style={{ background: "var(--sp-surface)", borderLeft: "1px solid var(--sp-border)" }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid var(--sp-border)" }}
        >
          <h2
            className="text-[14px] font-semibold"
            style={{ color: "var(--sp-text)" }}
            dir="rtl"
            lang="fa"
          >
            الگوریتم‌ها
          </h2>
          <button
            type="button"
            onClick={() => setNavigatorOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-gray-100"
            aria-label="بستن فهرست"
          >
            <X className="h-4 w-4" style={{ color: "var(--sp-text-muted)" }} />
          </button>
        </div>

        {/* Algorithm list */}
        <nav
          className="flex-1 space-y-0.5 overflow-y-auto p-2"
          aria-label="فهرست الگوریتم‌ها"
        >
          {surfaces.length === 0 && (
            <p
              className="px-3 py-4 text-center text-[12px]"
              style={{ color: "var(--sp-text-muted)" }}
              dir="rtl"
              lang="fa"
            >
              الگوریتمی یافت نشد.
            </p>
          )}
          {surfaces.map((surface, index) => {
            const selected  = index === currentSurfaceIndex;
            const completed = completedSurfaceIds.has(surface.id);

            return (
              <button
                key={surface.id}
                type="button"
                onClick={() => handleSelect(index)}
                className={cn(
                  "flex min-h-[44px] w-full items-center gap-2 rounded-xl px-3 py-2 text-right transition",
                  selected
                    ? "font-semibold"
                    : "hover:bg-gray-50",
                )}
                style={
                  selected
                    ? { background: "#EFF6FF", color: "var(--sp-text)" }
                    : { color: "var(--sp-text-muted)" }
                }
              >
                <span
                  className="flex-1 truncate text-[13px] leading-snug"
                  dir="rtl"
                  lang="fa"
                >
                  {algorithmDisplayTitle(surface, index)}
                </span>
                {completed && (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
