"use client";

import { createContext, useContext } from "react";
import type { MediaRefMatch } from "@/lib/starship-media/detectMediaRefs";
import type { MediaAsset } from "@/lib/starship-media/types";

/**
 * Two contexts so the static rendering decision (do we linkify?) and the
 * dynamic open-callback can be supplied at different layers without
 * pessimising re-render scope.
 *
 *   • MediaRefRenderContext — provided ONCE per <SegmentRenderer> with
 *     the (chapterNo, segmentId) tuple. Stable references; cheap.
 *   • MediaRefDispatchContext — provided ONCE at the top of the Reader
 *     by <MediaRefProvider>; carries the lightbox open() callback.
 *
 * When either context is missing, MediaLeaf passes text through
 * untouched. This is the kill-switch for non-Reader surfaces (exam,
 * note-viewer, etc.) — they never see anchors even if the env flag is on.
 */

export interface MediaRefRenderScope {
  enabled: boolean;
  chapterNo: number | null;
  segmentId: string | null;
}

/**
 * Anchor → provider request. The anchor knows only what it can see in
 * the prose (the detected ref + the segment scope it's rendered in).
 * The provider is the one that runs the resolver.
 */
export interface MediaRefOpenRequest {
  ref: MediaRefMatch;
  chapterNo: number | null;
  segmentId: string | null;
}

/**
 * Provider → lightbox payload. Same as the request, plus the resolved
 * registry row (or null if no row matched). The lightbox stays a pure
 * render component — it never touches the resolver itself.
 */
export interface MediaRefOpenPayload extends MediaRefOpenRequest {
  asset: MediaAsset | null;
}

export interface MediaRefDispatch {
  open: (request: MediaRefOpenRequest) => void;
}

export const MediaRefRenderContext = createContext<MediaRefRenderScope | null>(
  null,
);
export const MediaRefDispatchContext = createContext<MediaRefDispatch | null>(
  null,
);

export function useMediaRefRenderScope(): MediaRefRenderScope | null {
  return useContext(MediaRefRenderContext);
}

export function useMediaRefDispatch(): MediaRefDispatch | null {
  return useContext(MediaRefDispatchContext);
}
