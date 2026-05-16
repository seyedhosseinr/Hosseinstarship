"use client";

import { useEffect, useRef, useState } from "react";
import type { MediaAsset } from "@/lib/starship-media/types";

/**
 * Per-chapter manifest fetcher with a tiny in-process cache.
 *
 * The Reader mounts <MediaRefProvider chapterNo={N}> once per chapter
 * page; this hook fires a single GET to /api/media-registry/N on mount
 * and memoises the result for the rest of the session. Anchor clicks
 * then run the in-memory resolver against the cached array — zero
 * network IO per click.
 *
 * Contract:
 *   - chapterNo === null  → returns [] immediately (registry disabled)
 *   - fetch error / 4xx   → returns [] (Reader falls back gracefully)
 *   - SSR (no window)     → returns [] (no fetch on the server)
 */

const CACHE = new Map<number, MediaAsset[]>();
const INFLIGHT = new Map<number, Promise<MediaAsset[]>>();

export async function fetchMediaRegistryForChapter(
  chapterNo: number,
): Promise<MediaAsset[]> {
  // Cache only NON-EMPTY responses. An empty array from a pre-import
  // fetch must NOT block subsequent re-fetches — otherwise once a user
  // visited a chapter before importing its bundle, every later visit
  // (even after the bundle was imported) would keep returning the stale
  // empty array. Discovered during Phase 3.5 verification: import
  // succeeded, files were on disk and rows in DB, but the Reader stayed
  // on the fallback dialog forever. Empty re-fetches cost ~50 bytes —
  // cheap.
  const cached = CACHE.get(chapterNo);
  if (cached && cached.length > 0) return cached;
  const inflight = INFLIGHT.get(chapterNo);
  if (inflight) return inflight;

  const promise = (async (): Promise<MediaAsset[]> => {
    try {
      const res = await fetch(`/api/media-registry/${chapterNo}`, {
        cache: "no-store",
      });
      if (!res.ok) return [];
      const body = await res.json().catch(() => null);
      const assets: MediaAsset[] = Array.isArray(body?.assets) ? body.assets : [];
      if (assets.length > 0) CACHE.set(chapterNo, assets);
      return assets;
    } catch {
      return [];
    } finally {
      INFLIGHT.delete(chapterNo);
    }
  })();

  INFLIGHT.set(chapterNo, promise);
  return promise;
}

export function useMediaRegistry(
  chapterNo: number | null,
  /** Optional override — when set, skips the fetch entirely. Used by
   *  the integration tests and the dev probe to inject a synthetic
   *  manifest without spinning up a network. */
  override?: readonly MediaAsset[] | null,
): readonly MediaAsset[] {
  const [assets, setAssets] = useState<readonly MediaAsset[]>(
    () => override ?? (chapterNo !== null ? CACHE.get(chapterNo) ?? [] : []),
  );
  // Track the latest chapter we've issued a fetch for so we ignore
  // stale resolutions when the provider re-mounts mid-flight.
  const latest = useRef<number | null>(null);

  useEffect(() => {
    if (override !== undefined) {
      setAssets(override ?? []);
      return;
    }
    if (chapterNo === null) {
      setAssets([]);
      return;
    }
    latest.current = chapterNo;
    let cancelled = false;
    fetchMediaRegistryForChapter(chapterNo).then((next) => {
      if (cancelled) return;
      if (latest.current !== chapterNo) return;
      setAssets(next);
    });
    return () => {
      cancelled = true;
    };
  }, [chapterNo, override]);

  return assets;
}

/** Test helper — wipes the in-process registry cache. */
export function __clearMediaRegistryCache() {
  CACHE.clear();
  INFLIGHT.clear();
}
