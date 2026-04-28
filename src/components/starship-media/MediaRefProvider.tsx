"use client";

import React from "react";
import { isStarshipMediaReaderEnabled } from "@/lib/starship-media/flag";
import {
  MediaRefDispatchContext,
  MediaRefRenderContext,
  type MediaRefDispatch,
  type MediaRefOpenPayload,
  type MediaRefRenderScope,
} from "./MediaRefContext";
import { MediaLightbox } from "./MediaLightbox";

interface MediaRefProviderProps {
  /**
   * Optional override for tests / dev tools. When omitted, reads
   * `isStarshipMediaReaderEnabled()` from the env+localStorage gate.
   * The value is sampled ONCE on mount; flipping the flag at runtime
   * requires a remount, which is intentional — we don't want the
   * Reader's anchor surface to flicker on/off mid-session.
   */
  enabled?: boolean;
  children: React.ReactNode;
}

/**
 * Top-level provider. Mounts the lightbox singleton and supplies the
 * `open()` dispatcher to every <MediaRefAnchor> nested below.
 *
 * The render-side context (chapterNo + segmentId) is supplied per
 * <SegmentRenderer> via <MediaRefSegmentScope>, NOT here — one chapter
 * page contains many segments, each with a distinct id.
 */
export function MediaRefProvider({
  enabled,
  children,
}: MediaRefProviderProps) {
  const [resolvedEnabled, setResolvedEnabled] = React.useState<boolean>(
    () => enabled ?? false,
  );
  // Resolve env+localStorage on the client only. SSR returns false from
  // isStarshipMediaReaderEnabled() (no window), so skipping it server-side
  // means the anchor surface mounts identically on hydrate.
  React.useEffect(() => {
    if (enabled !== undefined) return;
    setResolvedEnabled(isStarshipMediaReaderEnabled());
  }, [enabled]);

  const [open, setOpen] = React.useState(false);
  const [payload, setPayload] = React.useState<MediaRefOpenPayload | null>(
    null,
  );

  const dispatch = React.useMemo<MediaRefDispatch>(
    () => ({
      open: (next) => {
        setPayload(next);
        setOpen(true);
      },
    }),
    [],
  );

  // If the flag is OFF, we render children with NO dispatch context, so
  // <MediaLeaf> short-circuits to plain text (the kill-switch). The
  // lightbox is also not mounted, costing nothing.
  if (!resolvedEnabled) {
    return <>{children}</>;
  }

  return (
    <MediaRefDispatchContext.Provider value={dispatch}>
      {children}
      <MediaLightbox open={open} onOpenChange={setOpen} payload={payload} />
    </MediaRefDispatchContext.Provider>
  );
}

interface MediaRefSegmentScopeProps {
  chapterNo: number | null;
  segmentId: string | null;
  children: React.ReactNode;
}

/**
 * Per-segment render scope. Wraps a single <SegmentRenderer> output and
 * supplies the (chapterNo, segmentId) tuple every <MediaLeaf> below
 * needs to attribute matched references.
 *
 * Stable scope reference — only re-publishes when the tuple changes,
 * which means React.memo'd descendants don't re-render.
 *
 * Cheaply tolerates a missing dispatch context (no <MediaRefProvider>
 * upstream): the render scope's `enabled` flips off automatically.
 */
export function MediaRefSegmentScope({
  chapterNo,
  segmentId,
  children,
}: MediaRefSegmentScopeProps) {
  const dispatch = React.useContext(MediaRefDispatchContext);
  const scope = React.useMemo<MediaRefRenderScope>(
    () => ({
      enabled: dispatch !== null,
      chapterNo,
      segmentId,
    }),
    [dispatch, chapterNo, segmentId],
  );
  return (
    <MediaRefRenderContext.Provider value={scope}>
      {children}
    </MediaRefRenderContext.Provider>
  );
}
