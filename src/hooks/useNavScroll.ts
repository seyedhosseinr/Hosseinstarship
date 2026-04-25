"use client";

import { useEffect, type RefObject } from "react";

/**
 * Auto-scrolls the navigation rail to keep the current question visible.
 */
export function useNavScroll(ref: RefObject<HTMLElement | null>, currentIndex: number) {
  useEffect(() => {
    const el = ref.current?.querySelector(`[data-qi="${currentIndex}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [ref, currentIndex]);
}
