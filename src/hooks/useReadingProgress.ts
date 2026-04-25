"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Section-weighted reading progress.
 *
 * Instead of raw `scrollTop / scrollHeight` (which races through images
 * and crawls through dense text), each section contributes equally to
 * the total. The hook tracks which sections have scrolled past the
 * viewport midpoint and interpolates within the current section.
 *
 * Output: 0–100 integer, suitable for a progress arc or bar.
 */
export function useReadingProgress(
  scrollRef: React.RefObject<HTMLElement | null>,
  sectionIds: string[],
  options?: {
    /** Callback fired once when progress crosses this threshold (default 80) */
    onThresholdCrossed?: () => void;
    threshold?: number;
  },
) {
  const [progress, setProgress] = useState(0);
  const thresholdFired = useRef(false);
  const threshold = options?.threshold ?? 80;

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || sectionIds.length === 0) return;

    // Reset on section change
    thresholdFired.current = false;

    const computeProgress = () => {
      const total = sectionIds.length;
      if (total === 0) {
        setProgress(0);
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const midpoint = containerRect.top + containerRect.height * 0.5;
      let passedCount = 0;
      let localRatio = 0;

      for (let i = 0; i < total; i++) {
        const el = container.querySelector<HTMLElement>(
          `#${CSS.escape(sectionIds[i])}`,
        );
        if (!el) continue;

        const rect = el.getBoundingClientRect();
        if (rect.bottom < midpoint) {
          // This section is fully above midpoint
          passedCount++;
        } else if (rect.top < midpoint) {
          // Midpoint is within this section
          const sectionVisible = midpoint - rect.top;
          localRatio = Math.min(1, sectionVisible / rect.height);
        }
        // else: section is below midpoint, skip
      }

      const pct = Math.min(
        100,
        Math.round(((passedCount + localRatio) / total) * 100),
      );
      setProgress(pct);

      if (pct >= threshold && !thresholdFired.current) {
        thresholdFired.current = true;
        options?.onThresholdCrossed?.();
      }
    };

    computeProgress();
    container.addEventListener("scroll", computeProgress, { passive: true });
    return () => container.removeEventListener("scroll", computeProgress);
  }, [scrollRef, sectionIds, threshold, options?.onThresholdCrossed]);

  /** Reset threshold tracking (e.g. on tab switch) */
  const resetThreshold = useCallback(() => {
    thresholdFired.current = false;
  }, []);

  return { progress, resetThreshold };
}
