import React from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FrameViewModel } from "@/lib/contract/note-viewer.types";
import { FrameBody } from "@/components/note-viewer/FrameBody";
import { FrameMermaid } from "@/components/note-viewer/FrameMermaid";
import { FrameAlgorithmGraph } from "@/components/note-viewer/FrameAlgorithmGraph";
import { FrameCallouts } from "./FrameCallouts";
import { FrameTable } from "./FrameTable";
import { proseStyle } from "./frameStyles";
import type { FrameCardV2Props } from "./frameTypes";

type FrameRichContentProps = Pick<FrameCardV2Props, "annotations" | "highlightsVisible"> & {
  frame: FrameViewModel;
  isParentCallout: boolean;
  onMediaRefClick?: (label: string) => void;
};

export function FrameRichContent({
  frame,
  isParentCallout,
  onMediaRefClick,
}: FrameRichContentProps) {
  const hasInteractive = Boolean(frame.interactiveData);
  const body = frame.content || frame.body;

  return (
    <>
      {frame.mermaid && !hasInteractive && <FrameMermaid code={frame.mermaid} />}

      {hasInteractive && <FrameAlgorithmGraph data={frame.interactiveData!} />}

      {hasInteractive && frame.mermaid && (
        <details
          data-mermaid-fallback="true"
          className="mt-2.5 rounded-[10px] border border-lib-border/50 bg-lib-surface/50 dark:bg-lib-surface/20"
        >
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-[12px] font-[650] text-lib-text-muted transition hover:text-lib-text [&::-webkit-details-marker]:hidden">
            <span>Diagram overview</span>
            <ArrowRight
              aria-hidden="true"
              className="ms-auto h-3 w-3 opacity-60 rtl:rotate-180"
            />
          </summary>
          <div className="border-t border-lib-border/40 p-2">
            <FrameMermaid code={frame.mermaid} />
          </div>
        </details>
      )}

      <FrameTable tableData={frame.tableData} onMediaRefClick={onMediaRefClick} />

      {frame.listItems?.length ? (
        <ul
          className={cn(
            "mx-auto mt-3 max-w-[var(--reader-prose-w,70ch)] list-disc space-y-2 ps-6",
            "text-[15.5px] leading-[1.75] text-lib-text/90 marker:text-lib-text-muted/50",
            "[&_strong]:font-[800] [&_strong]:text-lib-text",
            "[&_em]:[font-style:oblique_12deg]",
          )}
          style={proseStyle}
        >
          {frame.listItems.map((item, index) => (
            <li key={index}>
              <FrameBody body={item} compact onMediaRefClick={onMediaRefClick} />
            </li>
          ))}
        </ul>
      ) : null}

      {body?.trim() ? (
        <div
          data-anchor-surface="canonical"
          data-content-hash={frame.contentHash ?? undefined}
          className="[&_p]:leading-[1.9]"
        >
          <FrameBody
            body={body}
            anchorPrimary={!frame.hasStructuralReformat}
            onMediaRefClick={onMediaRefClick}
          />
        </div>
      ) : null}

      <FrameCallouts
        variant={isParentCallout ? "inline" : "card"}
        callouts={frame.v8Display?.callouts}
        onMediaRefClick={onMediaRefClick}
      />
    </>
  );
}
