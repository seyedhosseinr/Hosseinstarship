"use client";

import { useEffect, useState } from "react";

/**
 * Tracks which section heading is currently visible in a scroll container.
 * Uses IntersectionObserver with a viewport-clipped rootMargin so the
 * "active" section is the one crossing the top ~20% of the container.
 */
export function useScrollSpy(
  /** The scrollable container */
  containerRef: React.RefObject<HTMLElement | null>,
  /** CSS selector IDs to observe (e.g. section[id] values) */
  ids: string[],
) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || ids.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target instanceof HTMLElement) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        root: container,
        rootMargin: "-15% 0px -65% 0px",
        threshold: 0,
      },
    );

    for (const id of ids) {
      const el = container.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [containerRef, ids]);

  return activeId;
}
