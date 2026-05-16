"use client";

import React from "react";
import { isStarshipMediaReaderEnabled } from "@/lib/starship-media/flag";
import { resolveMediaAsset } from "@/lib/starship-media/resolveMediaAsset";
import type { MediaAsset } from "@/lib/starship-media/types";
import {
  MediaRefDispatchContext,
  MediaRefRenderContext,
  type MediaRefDispatch,
  type MediaRefOpenPayload,
  type MediaRefRenderScope,
} from "./MediaRefContext";
import { MediaLightbox } from "./MediaLightbox";
import {
  fetchMediaRegistryForChapter,
  useMediaRegistry,
} from "./useMediaRegistry";

interface MediaRefProviderProps {
  /**
   * Optional override for tests / dev tools. When omitted, reads
   * `isStarshipMediaReaderEnabled()` from the env+localStorage gate.
   * The value is sampled ONCE on mount; flipping the flag at runtime
   * requires a remount, which is intentional — we don't want the
   * Reader's anchor surface to flicker on/off mid-session.
   */
  enabled?: boolean;
  /**
   * Owning chapter number. When provided, the provider fetches the
   * read-only manifest from `/api/media-registry/:chapter` once and
   * caches it for the lifetime of the page. When `null` / omitted,
   * the registry is empty and every click falls through to the
   * existing "Image not imported yet" dialog.
   */
  chapterNo?: number | null;
  /**
   * Test / probe injection. When provided, bypasses the network fetch
   * entirely and seeds the in-memory registry with this array. The
   * dev probe and the integration test both rely on this.
   */
  assets?: readonly MediaAsset[] | null;
  children: React.ReactNode;
}

/**
 * Top-level provider. Mounts the lightbox singleton, fetches the
 * per-chapter media registry, and supplies the `open()` dispatcher
 * to every <MediaRefAnchor> nested below.
 *
 * Click flow:
 *   anchor.onClick → dispatch.open({ ref, chapterNo, segmentId })
 *     → provider runs `resolveMediaAsset(ref, ctx, registry)`
 *     → MediaLightbox receives the resolved asset (or null) and renders
 *       either the populated view or the existing fallback view
 *
 * The registry is the only IO performed; resolution itself is a pure,
 * synchronous in-memory match.
 */
export function MediaRefProvider({
  enabled,
  chapterNo,
  assets,
  children,
}: MediaRefProviderProps) {
  const [resolvedEnabled, setResolvedEnabled] = React.useState<boolean>(
    () => enabled ?? false,
  );
  React.useEffect(() => {
    if (enabled !== undefined) return;
    setResolvedEnabled(isStarshipMediaReaderEnabled());
  }, [enabled]);

  // Always call the hook so React's hook-order rules hold even when the
  // flag is off (the hook is cheap when chapterNo===null or override
  // supplied — it never fires fetch in either case).
  const registry = useMediaRegistry(
    resolvedEnabled ? chapterNo ?? null : null,
    assets ?? undefined,
  );

  const [open, setOpen] = React.useState(false);
  const [payload, setPayload] = React.useState<MediaRefOpenPayload | null>(
    null,
  );
  const hasAssetOverride = assets !== undefined;

  // Keep a ref to the latest registry so the dispatch closure stays
  // stable across registry refetches (no anchor re-render storms).
  const registryRef = React.useRef(registry);
  React.useEffect(() => {
    registryRef.current = registry;
  }, [registry]);

  const dispatch = React.useMemo<MediaRefDispatch>(
    () => ({
      open: ({ ref, chapterNo: cn, segmentId }) => {
        const openWithRegistry = (registry: readonly MediaAsset[]) => {
          const asset = resolveMediaAsset(
            ref,
            { chapterNo: cn, segmentId },
            registry,
          );
          setPayload({ ref, chapterNo: cn, segmentId, asset });
          setOpen(true);
        };

        const current = registryRef.current;
        if (current.length > 0 || cn === null || hasAssetOverride) {
          openWithRegistry(current);
          return;
        }

        void fetchMediaRegistryForChapter(cn)
          .then((next) => {
            registryRef.current = next;
            openWithRegistry(next);
          })
          .catch(() => openWithRegistry(current));
      },
    }),
    [hasAssetOverride],
  );

  if (!resolvedEnabled) {
    return <>{children}</>;
  }

  return (
    <MediaRefDispatchContext.Provider value={dispatch}>
      {children}
      <MediaLightbox
        open={open}
        onOpenChange={setOpen}
        payload={payload}
        assets={registry}
      />
    </MediaRefDispatchContext.Provider>
  );
}

interface MediaRefSegmentScopeProps {
  chapterNo: number | null;
  segmentId: string | null;
  children: React.ReactNode;
}

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
