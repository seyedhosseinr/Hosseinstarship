"use client";

import { createContext, useContext } from "react";
import type { MediaRefMatch } from "@/lib/starship-media/detectMediaRefs";

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

export interface MediaRefOpenPayload {
  ref: MediaRefMatch;
  chapterNo: number | null;
  segmentId: string | null;
}

export interface MediaRefDispatch {
  open: (payload: MediaRefOpenPayload) => void;
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
