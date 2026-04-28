/**
 * Shared type for the media-reference reader registry.
 *
 * Mirrors the `media_assets` table shape but in client-safe form (no
 * Drizzle row types leaking into the React tree). The Reader and the
 * resolver both work against this interface, which makes test injection
 * (synthetic asset arrays) trivial without touching the DB layer.
 */

import type { MediaRefKind } from "./detectMediaRefs";

/** Same union as the DB column — re-exported here so client code can
 *  import a single module instead of pulling from `db/schema`. */
export type MediaAssetKind = MediaRefKind;

export interface MediaAsset {
  id: string;
  mediaId: string;
  chapterNumber: number;
  segmentId: string | null;
  refId: string | null;
  figureLabel: string | null;
  kind: MediaAssetKind;
  filename: string | null;
  storagePath: string | null;
  sourcePage: number | null;
  caption: string | null;
  tags: string[] | null;
  highYield: boolean;
  createdAt: number;
  updatedAt: number;
}
