"use client";

import { useEffect, type RefObject } from "react";
import { useAppStore } from "@/store/useAppStore";

/**
 * Reads the density preference from the app store and sets
 * `data-density` on the referenced `.theme-clinical` container.
 *
 * Render this inside any `.theme-clinical` container and pass
 * a ref to that container element. The clinical token rules
 * `.theme-clinical[data-density="compact"]` etc. will activate
 * automatically, driving all calc()-based spacing.
 *
 * Does nothing until a surface actually renders it.
 */
export function DensityBridge({
  containerRef,
}: {
  containerRef: RefObject<HTMLElement | null>;
}) {
  const density = useAppStore((s) => s.density);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.setAttribute("data-density", density);
    }
  }, [density, containerRef]);

  return null;
}
