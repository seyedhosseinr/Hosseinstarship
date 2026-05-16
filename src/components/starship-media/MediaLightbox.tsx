"use client";

import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Hash,
  ImageIcon,
  ImageOff,
  Sparkles,
  X,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { MediaAsset } from "@/lib/starship-media/types";
import type { MediaRefOpenPayload } from "./MediaRefContext";

interface MediaLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: MediaRefOpenPayload | null;
  assets?: readonly MediaAsset[];
}

const KIND_BADGE: Record<MediaAsset["kind"], string> = {
  figure: "Figure",
  image: "Image",
  table: "Table",
};

export function MediaLightbox({
  open,
  onOpenChange,
  payload,
  assets = [],
}: MediaLightboxProps) {
  const ref = payload?.ref;
  const gallery = React.useMemo(
    () => assets.filter((asset) => asset.kind !== "table" || asset.storagePath),
    [assets],
  );
  const [activeAssetId, setActiveAssetId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setActiveAssetId(payload?.asset?.id ?? null);
  }, [open, payload?.asset?.id]);

  const activeIndex = activeAssetId
    ? gallery.findIndex((asset) => asset.id === activeAssetId)
    : -1;
  const activeAsset = activeIndex >= 0 ? gallery[activeIndex] : null;
  const canBrowse = gallery.length > 0;

  const goToIndex = React.useCallback(
    (index: number) => {
      if (gallery.length === 0) return;
      const next = ((index % gallery.length) + gallery.length) % gallery.length;
      setActiveAssetId(gallery[next]?.id ?? null);
    },
    [gallery],
  );

  const goPrevious = React.useCallback(() => {
    goToIndex(activeIndex >= 0 ? activeIndex - 1 : gallery.length - 1);
  }, [activeIndex, gallery.length, goToIndex]);

  const goNext = React.useCallback(() => {
    goToIndex(activeIndex >= 0 ? activeIndex + 1 : 0);
  }, [activeIndex, goToIndex]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrevious();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrevious, open]);

  const shownAsset = activeAsset ?? payload?.asset ?? null;
  const showingFallback = !shownAsset;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="ltr"
        className={cn(
          "left-0 top-0 h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0",
          "grid grid-rows-[minmax(0,1fr)] gap-0 overflow-hidden rounded-none border-0 bg-[#080b10] p-0 text-white shadow-none sm:rounded-none",
          "lg:grid-cols-[390px_minmax(0,1fr)]",
          "[&>button:last-child]:hidden",
        )}
      >
        <DescriptionPanel
          asset={shownAsset}
          payload={payload}
          fallback={showingFallback}
          galleryCount={gallery.length}
        />

        <main
          className={cn(
            "relative min-h-0 overflow-hidden bg-[#090b0e]",
            "lg:col-start-2 lg:row-start-1",
          )}
          data-testid="media-viewer-stage"
        >
          <ViewerHeader
            label={shownAsset?.figureLabel ?? ref?.label ?? "Media reference"}
            index={activeIndex}
            count={gallery.length}
            onClose={() => onOpenChange(false)}
          />

          <div className="absolute inset-0 flex min-h-0 items-center justify-center px-3 pb-[132px] pt-[58px] sm:px-6 sm:pb-[144px] lg:px-8">
            {shownAsset?.storagePath ? (
              <div
                className="flex h-full w-full items-center justify-center bg-[#f3f4f4] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                data-testid="media-image-frame"
              >
                <img
                  src={shownAsset.storagePath}
                  alt={shownAsset.caption ?? shownAsset.figureLabel ?? "media asset"}
                  data-testid="media-image"
                  className="h-full w-full select-none object-contain"
                  loading="eager"
                  decoding="async"
                />
              </div>
            ) : (
              <FallbackStage payload={payload} galleryCount={gallery.length} />
            )}
          </div>

          {canBrowse && (
            <>
              <NavButton
                direction="previous"
                onClick={goPrevious}
                className="left-3 sm:left-5"
              />
              <NavButton
                direction="next"
                onClick={goNext}
                className="right-3 sm:right-5"
              />
            </>
          )}

          <ThumbnailRail
            assets={gallery}
            activeAssetId={activeAssetId}
            onSelect={setActiveAssetId}
          />
        </main>
      </DialogContent>
    </Dialog>
  );
}

function ViewerHeader({
  label,
  index,
  count,
  onClose,
}: {
  label: string;
  index: number;
  count: number;
  onClose: () => void;
}) {
  return (
    <header className="absolute inset-x-0 top-0 z-30 flex min-h-[56px] items-center gap-3 bg-gradient-to-b from-black/80 via-black/34 to-transparent px-3 py-3 sm:px-5">
      <div className="min-w-0 flex-1">
        <div
          dir="auto"
          className="truncate text-[15px] font-[720] leading-tight text-white"
          style={{ unicodeBidi: "isolate" }}
        >
          {label}
        </div>
        {count > 0 && (
          <div className="mt-0.5 font-mono text-[11px] tabular-nums text-white/58">
            {index >= 0 ? index + 1 : 0} / {count}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close media viewer"
        data-testid="media-viewer-close"
        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black/70 text-white ring-1 ring-white/30 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur transition hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <X className="h-6 w-6" aria-hidden="true" />
      </button>
    </header>
  );
}

function DescriptionPanel({
  asset,
  payload,
  fallback,
  galleryCount,
}: {
  asset: MediaAsset | null;
  payload: MediaRefOpenPayload | null;
  fallback: boolean;
  galleryCount: number;
}) {
  const ref = payload?.ref;
  const title = asset?.figureLabel ?? ref?.label ?? "Media reference";

  return (
    <aside
      dir="ltr"
      className={cn(
        "hidden overflow-y-auto border-e border-white/10 bg-[#151919] px-6 py-7 shadow-[12px_0_36px_rgba(0,0,0,0.28)]",
        "lg:block lg:col-start-1 lg:row-start-1",
      )}
      data-testid="media-description-panel"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-sky-400/12 text-sky-200 ring-1 ring-sky-300/20">
          {fallback ? (
            <ImageOff className="h-5 w-5" aria-hidden="true" />
          ) : (
            <ImageIcon className="h-5 w-5" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              dir="auto"
              className="text-[18px] font-[760] leading-snug text-white"
              style={{ unicodeBidi: "isolate" }}
            >
              {title}
            </h2>
            {asset && (
              <span
                dir="ltr"
                className="inline-flex rounded-[4px] border border-white/12 bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-[760] uppercase tracking-[0.08em] text-white/70"
                data-testid="media-kind-badge"
              >
                {KIND_BADGE[asset.kind]}
              </span>
            )}
            {asset?.highYield && (
              <span
                dir="ltr"
                className="inline-flex items-center gap-1 rounded-[4px] border border-amber-300/25 bg-amber-300/10 px-1.5 py-0.5 text-[10px] font-[760] uppercase tracking-[0.08em] text-amber-200"
                data-testid="media-high-yield-badge"
              >
                <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                High yield
              </span>
            )}
          </div>
          <p className="mt-1 text-[12px] text-white/54">
            {fallback ? "Image not imported yet" : "Imported asset"}
          </p>
        </div>
      </div>

      {fallback ? (
        <div className="mt-5 rounded-[10px] border border-dashed border-white/16 bg-white/[0.045] p-4">
          <p className="text-[14px] font-[650] text-white">
            Image not imported yet
          </p>
          <p className="mt-2 text-[13px] leading-6 text-white/68">
            This reference does not currently match an imported asset. You can
            still browse the other imported media for this chapter below.
          </p>
        </div>
      ) : asset?.caption ? (
        <p
          dir="auto"
          className="mt-5 text-[14.5px] leading-7 text-white/82"
          data-testid="media-caption"
        >
          {asset.caption}
        </p>
      ) : (
        <p className="mt-5 text-[13.5px] leading-6 text-white/54">
          No caption is available for this imported media item.
        </p>
      )}

      <dl className="mt-6 grid grid-cols-1 gap-2 text-[12px] text-white/68">
        <MetaRow
          icon={<Hash className="h-3.5 w-3.5" aria-hidden="true" />}
          label="Chapter"
          value={payload?.chapterNo ?? asset?.chapterNumber ?? "N/A"}
        />
        <MetaRow
          icon={<Hash className="h-3.5 w-3.5" aria-hidden="true" />}
          label="Segment"
          value={asset?.segmentId ?? payload?.segmentId ?? "N/A"}
          mono
        />
        {asset?.sourcePage !== null && asset?.sourcePage !== undefined && (
          <MetaRow
            icon={<FileText className="h-3.5 w-3.5" aria-hidden="true" />}
            label="Page"
            value={asset.sourcePage}
          />
        )}
        <MetaRow
          icon={<Hash className="h-3.5 w-3.5" aria-hidden="true" />}
          label="Ref ID"
          value={asset?.refId ?? ref?.refId ?? "N/A"}
          mono
        />
        {asset?.mediaId && (
          <MetaRow
            icon={<ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />}
            label="Media ID"
            value={asset.mediaId}
            mono
          />
        )}
      </dl>

      {asset?.tags?.length ? (
        <div className="mt-5 flex flex-wrap gap-1.5">
          {asset.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[11px] font-[620] text-white/68 ring-1 ring-white/10"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <p className="mt-6 text-[11px] leading-5 text-white/42">
        {galleryCount > 0
          ? `${galleryCount} imported chapter media item${galleryCount === 1 ? "" : "s"} available.`
          : "No imported chapter media is available yet."}
      </p>
    </aside>
  );
}

function MetaRow({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[18px_78px_minmax(0,1fr)] items-start gap-2 rounded-[6px] bg-white/[0.035] px-2.5 py-2">
      <dt className="mt-0.5 text-white/38">{icon}</dt>
      <dt className="font-[720] uppercase tracking-[0.08em] text-white/42">
        {label}
      </dt>
      <dd
        dir="auto"
        className={cn("break-words text-white/78", mono && "font-mono text-[11px]")}
      >
        {value}
      </dd>
    </div>
  );
}

function FallbackStage({
  payload,
  galleryCount,
}: {
  payload: MediaRefOpenPayload | null;
  galleryCount: number;
}) {
  return (
    <div
      className="mx-auto max-w-md rounded-[12px] border border-white/12 bg-white/[0.045] p-6 text-center shadow-2xl"
      data-testid="media-fallback-state"
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.07] text-white/70 ring-1 ring-white/12">
        <ImageOff className="h-7 w-7" aria-hidden="true" />
      </div>
      <p className="mt-4 text-[17px] font-[760] text-white">
        Image not imported yet
      </p>
      <p className="mt-2 text-[13.5px] leading-6 text-white/64">
        {payload?.ref?.label ?? "This media reference"} has no matched asset in
        the chapter registry.
      </p>
      <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-left text-[12px] text-white/68">
        <dt className="font-[720] uppercase tracking-[0.08em] text-white/38">
          Chapter
        </dt>
        <dd>{payload?.chapterNo ?? "N/A"}</dd>
        <dt className="font-[720] uppercase tracking-[0.08em] text-white/38">
          Segment
        </dt>
        <dd className="font-mono text-[11px]">{payload?.segmentId ?? "N/A"}</dd>
        <dt className="font-[720] uppercase tracking-[0.08em] text-white/38">
          Ref ID
        </dt>
        <dd className="font-mono text-[11px]">{payload?.ref?.refId ?? "N/A"}</dd>
      </dl>
      {galleryCount > 0 && (
        <p className="mt-5 text-[12px] text-white/46">
          Choose a thumbnail below to browse imported chapter media.
        </p>
      )}
    </div>
  );
}

function NavButton({
  direction,
  onClick,
  className,
}: {
  direction: "previous" | "next";
  onClick: () => void;
  className?: string;
}) {
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "previous" ? "Previous media" : "Next media"}
      className={cn(
        "absolute top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full",
        "bg-black/38 text-white ring-1 ring-white/16 backdrop-blur transition",
        "hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:inline-flex",
        className,
      )}
    >
      <Icon className="h-6 w-6" aria-hidden="true" />
    </button>
  );
}

function ThumbnailRail({
  assets,
  activeAssetId,
  onSelect,
}: {
  assets: readonly MediaAsset[];
  activeAssetId: string | null;
  onSelect: (assetId: string) => void;
}) {
  return (
    <footer className="absolute inset-x-0 bottom-0 z-30 min-h-[118px] border-t border-white/12 bg-black/56 px-4 py-3 backdrop-blur-md">
      {assets.length === 0 ? (
        <div className="flex h-[86px] items-center justify-center rounded-[10px] border border-dashed border-white/12 text-[13px] text-white/45">
          No imported chapter media available.
        </div>
      ) : (
        <div
          className="mx-auto flex max-w-[calc(100vw-32px)] justify-start gap-3 overflow-x-auto overscroll-x-contain pb-1 sm:justify-center [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,.28)_transparent]"
          data-testid="media-thumbnail-rail"
        >
          {assets.map((asset, index) => {
            const active = asset.id === activeAssetId;
            return (
              <button
                key={asset.id}
                type="button"
                onClick={() => onSelect(asset.id)}
                data-testid="media-thumbnail"
                data-active={active ? "true" : "false"}
                className={cn(
                  "group flex min-h-[92px] w-[144px] shrink-0 flex-col overflow-hidden rounded-[8px] border bg-white/[0.04] text-left transition",
                  "touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
                  active
                    ? "border-sky-300 shadow-[0_0_0_2px_rgba(125,211,252,0.42),0_0_24px_rgba(56,189,248,0.32)]"
                    : "border-white/12 hover:border-white/28",
                )}
                aria-label={`Open ${asset.figureLabel ?? asset.mediaId}`}
              >
                <div className="flex h-[64px] items-center justify-center bg-black/45">
                  {asset.storagePath ? (
                    <img
                      src={asset.storagePath}
                      alt=""
                      className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <ImageOff className="h-5 w-5 text-white/45" aria-hidden="true" />
                  )}
                </div>
                <div className="flex min-w-0 items-center gap-2 px-2 py-1.5">
                  <span className="font-mono text-[10px] tabular-nums text-white/38">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span
                    dir="auto"
                    className="truncate text-[11.5px] font-[680] text-white/74"
                    style={{ unicodeBidi: "isolate" }}
                  >
                    {asset.figureLabel ?? asset.mediaId}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </footer>
  );
}
