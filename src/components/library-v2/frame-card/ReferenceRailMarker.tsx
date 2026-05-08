"use client";

import React from "react";
import { cn } from "@/lib/utils";

export function ReferenceRailMarker({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <button
      type="button"
      data-reader-rail-marker="true"
      aria-label={count + " source references"}
      title={count + " source references"}
      onClick={(event) => {
        const frameEl = event.currentTarget.closest<HTMLElement>("[data-frame-id]");
        const rail = frameEl?.querySelector<HTMLDetailsElement>("[data-reader-reference-rail]");

        if (rail) {
          rail.open = true;
          rail.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
          rail.querySelector<HTMLElement>("summary")?.focus();
        }
      }}
      className={cn(
        "absolute -end-9 top-2 z-10 hidden h-7 w-7 items-center justify-center rounded-full",
        "border border-lib-accent/25 bg-lib-surface text-[11px] font-[700] tabular-nums text-lib-accent",
        "shadow-sm transition hover:border-lib-accent/45 hover:bg-lib-accent-soft focus:outline-none",
        "focus-visible:ring-2 focus-visible:ring-lib-accent/30 md:inline-flex",
      )}
    >
      {count}
    </button>
  );
}
