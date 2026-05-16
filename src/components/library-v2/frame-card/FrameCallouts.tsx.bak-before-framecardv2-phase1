import React from "react";
import { cn } from "@/lib/utils";
import type { CalloutV8 } from "@/lib/contract/note-v8.types";
import { FrameBody } from "@/components/note-viewer/FrameBody";
import { CALLOUT_TONE } from "./frameStyles";

export function FrameCallouts({
  variant = "card",
  callouts,
  onMediaRefClick,
}: {
  variant?: "card" | "inline";
  callouts: CalloutV8[] | null | undefined;
  onMediaRefClick?: (label: string) => void;
}) {
  if (!callouts?.length) return null;

  const isInline = variant === "inline";

  return (
    <div
      data-frame-callouts-variant={variant}
      className={cn(
        isInline
          ? "mt-3 space-y-2 border-t border-lib-border/60 pt-2.5"
          : "mt-3 space-y-2",
      )}
    >
      {callouts.map((callout, index) => {
        const tone = CALLOUT_TONE[callout.kind] ?? CALLOUT_TONE.tip;

        return (
          <div
            key={String(callout.kind) + "-" + String(callout.order) + "-" + String(index)}
            data-callout-kind={callout.kind}
            dir="rtl"
            className={cn(
              "flex gap-2.5",
              isInline
                ? "px-0 py-0"
                : "rounded-[8px] border border-lib-border/45 bg-lib-surface/45 px-3 py-2",
            )}
          >
            <span
              aria-hidden="true"
              className={cn("mt-[0.7em] h-1.5 w-1.5 shrink-0 rounded-full", tone.dot)}
            />
            <div
              className={cn(
                "min-w-0 flex-1",
                isInline
                  ? "text-[13.5px] leading-[1.78] text-lib-text/80"
                  : "text-[13.5px] leading-[1.72] text-lib-text/90",
                tone.text,
              )}
            >
              <FrameBody body={callout.text} compact onMediaRefClick={onMediaRefClick} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
