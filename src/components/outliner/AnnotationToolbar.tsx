"use client";

import { useOutlinerStore } from "./outliner-store";

export function AnnotationToolbar() {
  const setAnnotationMode = useOutlinerStore((state) => state.setAnnotationMode);
  return (
    <div className="absolute left-4 top-4 rounded-2xl border border-border/70 bg-card/95 p-2 shadow-lg">
      <button type="button" className="rounded-lg px-3 py-2 text-xs font-semibold" onClick={() => setAnnotationMode(false)}>
        بستن حاشیه‌نویسی
      </button>
    </div>
  );
}
