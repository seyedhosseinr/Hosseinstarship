"use client";

import { ImageOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { MediaRefOpenPayload } from "./MediaRefContext";

interface MediaLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: MediaRefOpenPayload | null;
}

/**
 * Phase-1 lightbox — fallback only.
 *
 * The importer lands in a later phase. Until then, every click reaches
 * the "no asset on disk" branch and we render a graceful explanation
 * that names the chapter, the segment id, and the verbatim figure label
 * the user just clicked. This makes future importer testing trivial:
 * the same dialog will keep its shape, only the body swaps to the
 * actual <FigureViewer/> branch.
 */
export function MediaLightbox({
  open,
  onOpenChange,
  payload,
}: MediaLightboxProps) {
  const ref = payload?.ref;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-md border-lib-border/60 bg-lib-surface/95 backdrop-blur-xl",
        )}
      >
        <DialogHeader>
          <DialogTitle
            className="flex items-center gap-2 text-lib-text"
            style={{ unicodeBidi: "isolate" }}
          >
            <ImageOff
              className="h-5 w-5 text-lib-text-muted"
              aria-hidden="true"
            />
            {/* dir="auto" lets the browser pick LTR for English labels
                ("Figure 164.4") and RTL for Persian labels ("شکل ۳")
                based on the first strong character — avoids forcing an
                LTR base direction on Persian and the resulting
                punctuation/numeral position quirks. */}
            <span dir="auto" style={{ unicodeBidi: "isolate" }}>
              {ref?.label ?? "Media reference"}
            </span>
          </DialogTitle>
          <DialogDescription className="text-lib-text-muted">
            Image not imported yet
          </DialogDescription>
        </DialogHeader>

        <dl
          dir="ltr"
          className={cn(
            "mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2",
            "text-[12.5px] tabular-nums",
            "text-lib-text-secondary",
          )}
        >
          <dt className="font-[600] uppercase tracking-[0.08em] text-lib-text-muted/85">
            Chapter
          </dt>
          <dd className="text-lib-text">
            {payload?.chapterNo ?? "—"}
          </dd>

          <dt className="font-[600] uppercase tracking-[0.08em] text-lib-text-muted/85">
            Segment
          </dt>
          <dd className="break-all text-lib-text">
            {payload?.segmentId ?? "—"}
          </dd>

          <dt className="font-[600] uppercase tracking-[0.08em] text-lib-text-muted/85">
            Label
          </dt>
          <dd className="text-lib-text">{ref?.label ?? "—"}</dd>

          <dt className="font-[600] uppercase tracking-[0.08em] text-lib-text-muted/85">
            Ref ID
          </dt>
          <dd className="font-mono text-[11.5px] text-lib-text-muted">
            {ref?.refId ?? "—"}
          </dd>
        </dl>

        <p
          className={cn(
            "mt-4 rounded-[6px] border border-dashed border-lib-border/60",
            "bg-lib-hover/30 px-3 py-2 text-[12.5px] leading-[1.6]",
            "text-lib-text-muted",
          )}
        >
          Once the chapter&rsquo;s media bundle is imported, this dialog will
          show the asset inline. Until then, the reference above is your
          breadcrumb.
        </p>
      </DialogContent>
    </Dialog>
  );
}
