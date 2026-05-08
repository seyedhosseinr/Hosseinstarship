import React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { FrameBody } from "@/components/note-viewer/FrameBody";

export function PearlTail({
  variant = "card",
  pearl,
  onMediaRefClick,
}: {
  variant?: "card" | "inline";
  pearl: string | null | undefined;
  onMediaRefClick?: (label: string) => void;
}) {
  if (!pearl?.trim()) return null;

  const isInline = variant === "inline";

  return (
    <div
      data-frame-pearl="true"
      data-frame-pearl-variant={variant}
      dir="rtl"
      className={cn(
        "mt-3 flex gap-2.5",
        isInline
          ? "border-t border-lib-border/60 pt-2.5"
          : "rounded-[8px] border border-amber-300/30 bg-amber-50/35 px-3 py-2.5 dark:border-amber-700/25 dark:bg-amber-950/10",
      )}
    >
      <Sparkles
        className={cn(
          "mt-[0.45em] h-3.5 w-3.5 shrink-0",
          isInline
            ? "text-lib-text-muted/60"
            : "text-amber-500/75 dark:text-amber-400/75",
        )}
        aria-hidden="true"
      />
      <div
        className={cn(
          "min-w-0 flex-1",
          isInline
            ? "text-[13.5px] leading-[1.78] text-lib-text/80"
            : "text-[13.5px] leading-[1.72] text-lib-text/90",
        )}
      >
        <FrameBody body={pearl} compact onMediaRefClick={onMediaRefClick} />
      </div>
    </div>
  );
}

export function MarginTail({
  note,
  onMediaRefClick,
}: {
  note: string | null | undefined;
  onMediaRefClick?: (label: string) => void;
}) {
  if (!note?.trim()) return null;

  return (
    <div
      data-frame-margin-note="true"
      dir="rtl"
      className="mt-3 border-t border-lib-border/50 pt-2.5 text-[13.5px] leading-[1.7] text-lib-text/80"
    >
      <FrameBody body={note} compact onMediaRefClick={onMediaRefClick} />
    </div>
  );
}
