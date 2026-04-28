"use client";

import { ImageIcon, ImageOff, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { MediaAsset } from "@/lib/starship-media/types";
import type { MediaRefOpenPayload } from "./MediaRefContext";

interface MediaLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: MediaRefOpenPayload | null;
}

const KIND_BADGE: Record<MediaAsset["kind"], string> = {
  figure: "Figure",
  image: "Image",
  table: "Table",
};

/**
 * Reader lightbox.
 *
 * Two render branches keyed off `payload.asset`:
 *
 *  1. MATCHED — registry returned a hit. Show the imported image (when
 *     `storagePath` is available), the caption, the kind badge, the
 *     chapter / segment / page metadata, and a high-yield badge if the
 *     row is flagged.
 *
 *  2. UNMATCHED — registry returned `null`. Preserve the Phase-1
 *     "Image not imported yet" fallback exactly: same title shape, same
 *     metadata grid, same reference-breadcrumb explanation.
 *
 * The dialog's outer chrome is identical in both branches so toggling
 * between matched and unmatched references doesn't shift the layout.
 */
export function MediaLightbox({
  open,
  onOpenChange,
  payload,
}: MediaLightboxProps) {
  const ref = payload?.ref;
  const asset = payload?.asset ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // Wider when matched so the image has breathing room; narrow
          // (Phase-1 size) when falling back so the fallback feels light.
          asset ? "max-w-2xl" : "max-w-md",
          "border-lib-border/60 bg-lib-surface/95 backdrop-blur-xl",
        )}
      >
        <DialogHeader>
          <DialogTitle
            className="flex items-center gap-2 text-lib-text"
            style={{ unicodeBidi: "isolate" }}
          >
            {asset ? (
              <ImageIcon className="h-5 w-5 text-lib-text-muted" aria-hidden="true" />
            ) : (
              <ImageOff className="h-5 w-5 text-lib-text-muted" aria-hidden="true" />
            )}
            <span dir="auto" style={{ unicodeBidi: "isolate" }}>
              {asset?.figureLabel ?? ref?.label ?? "Media reference"}
            </span>
            {asset && (
              <span
                dir="ltr"
                className={cn(
                  "ms-1 inline-flex items-center rounded-[4px] px-[6px] py-[1px]",
                  "border border-lib-border/50 bg-lib-surface/75 dark:bg-lib-surface/30",
                  "text-[9.5px] font-[700] leading-[1.6] tracking-[0.08em] uppercase",
                  "text-lib-text-secondary",
                )}
                data-testid="media-kind-badge"
              >
                {KIND_BADGE[asset.kind]}
              </span>
            )}
            {asset?.highYield && (
              <span
                dir="ltr"
                className={cn(
                  "inline-flex items-center gap-1 rounded-[4px] px-[6px] py-[1px]",
                  "border border-amber-500/30 bg-amber-500/[0.08]",
                  "text-[9.5px] font-[700] leading-[1.6] tracking-[0.08em] uppercase",
                  "text-amber-700 dark:text-amber-300",
                )}
                data-testid="media-high-yield-badge"
              >
                <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                <span>High yield</span>
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-lib-text-muted">
            {asset ? "Imported asset" : "Image not imported yet"}
          </DialogDescription>
        </DialogHeader>

        {asset ? <MatchedBody asset={asset} payload={payload} /> : <FallbackBody payload={payload} />}
      </DialogContent>
    </Dialog>
  );
}

function MatchedBody({
  asset,
  payload,
}: {
  asset: MediaAsset;
  payload: MediaRefOpenPayload | null;
}) {
  return (
    <>
      {asset.storagePath ? (
        <div
          className={cn(
            "mt-2 overflow-hidden rounded-[8px] border border-lib-border/40",
            "bg-black/30",
          )}
          data-testid="media-image-frame"
        >
          {/* Plain <img> — the dialog already does the heavy lifting (ESC,
              focus trap, overlay). FigureViewer is the next-phase upgrade
              when zoom/pan is needed. */}
          <img
            src={asset.storagePath}
            alt={asset.caption ?? asset.figureLabel ?? "media asset"}
            data-testid="media-image"
            className="block max-h-[60vh] w-full object-contain"
            loading="lazy"
            decoding="async"
          />
        </div>
      ) : null}

      {asset.caption && (
        <p
          dir="auto"
          className="mt-3 text-[13.5px] leading-[1.6] text-lib-text/90"
          data-testid="media-caption"
        >
          {asset.caption}
        </p>
      )}

      <dl
        dir="ltr"
        className={cn(
          "mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5",
          "text-[12px] tabular-nums",
          "text-lib-text-secondary",
        )}
      >
        <Row label="Chapter" value={payload?.chapterNo ?? asset.chapterNumber} />
        <Row label="Segment" value={asset.segmentId ?? payload?.segmentId ?? "—"} />
        {asset.sourcePage !== null && (
          <Row label="Page" value={asset.sourcePage} />
        )}
        <Row label="Media ID" value={asset.mediaId} mono />
        {asset.refId && <Row label="Ref ID" value={asset.refId} mono />}
        {asset.tags && asset.tags.length > 0 && (
          <Row label="Tags" value={asset.tags.join(", ")} />
        )}
      </dl>
    </>
  );
}

function FallbackBody({ payload }: { payload: MediaRefOpenPayload | null }) {
  const ref = payload?.ref;
  return (
    <>
      <dl
        dir="ltr"
        className={cn(
          "mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2",
          "text-[12.5px] tabular-nums",
          "text-lib-text-secondary",
        )}
      >
        <Row label="Chapter" value={payload?.chapterNo ?? "—"} />
        <Row label="Segment" value={payload?.segmentId ?? "—"} />
        <Row label="Label" value={ref?.label ?? "—"} />
        <Row label="Ref ID" value={ref?.refId ?? "—"} mono />
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
    </>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <>
      <dt className="font-[600] uppercase tracking-[0.08em] text-lib-text-muted/85">
        {label}
      </dt>
      <dd
        className={cn(
          "break-all text-lib-text",
          mono && "font-mono text-[11.5px] text-lib-text-muted",
        )}
      >
        {value}
      </dd>
    </>
  );
}
