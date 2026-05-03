"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Returns the `data-frame-id` of the frame currently nearest to the top of
 * the reader scroll container (within the viewport).  Updates on scroll via a
 * passive listener + rAF debounce — safe for frequent scroll events on iPad.
 *
 * Only the nearest-to-top visible frame is returned. When no frame is in view
 * the hook holds the last known value rather than returning null, so the
 * handwritten-notes panel always has an anchor to associate strokes with.
 */
export function useActiveBlockAnchor(
  scrollRef: RefObject<HTMLElement | null>,
): string | null {
  const [activeFrameId, setActiveFrameId] = useState<string | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const stage = scrollRef.current;
    if (!stage) return;

    const update = () => {
      const frames = stage.querySelectorAll<HTMLElement>("[data-frame-id]");
      if (frames.length === 0) return;

      let best: HTMLElement | null = null;
      let bestScore = Infinity;

      for (const frame of frames) {
        const rect = frame.getBoundingClientRect();
        // Only consider frames with some visible area.
        if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue;
        // Prefer the frame whose top edge is closest to ~80px from the top
        // (below the toolbar).
        const score = Math.abs(rect.top - 80);
        if (score < bestScore) {
          bestScore = score;
          best = frame;
        }
      }

      if (best) {
        const id = best.dataset.frameId ?? null;
        setActiveFrameId((prev) => (prev === id ? prev : id));
      }
    };

    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        update();
      });
    };

    stage.addEventListener("scroll", onScroll, { passive: true });
    update(); // initial read

    return () => {
      stage.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [scrollRef]);

  return activeFrameId;
}
