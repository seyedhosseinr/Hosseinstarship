"use client";

import { useCallback, useState } from "react";

/**
 * Adaptive font-scale for the main chapter reader.
 *
 * Five discrete steps expressed as a CSS multiplier (not px).
 * Applying `style={{ "--reader-font-scale": String(fontScale) }}`
 * on `<article data-reader-content>` lets CSS rules like
 * `calc(15.5px * var(--reader-font-scale, 1))` scale proportionally
 * without reflowing the entire layout.
 *
 * Choice persists in localStorage so the user's preference
 * survives page navigation and revisits.
 */

const FONT_STEPS = [0.82, 0.91, 1.0, 1.1, 1.22] as const;
const DEFAULT_STEP = 2; // index of 1.0×
const STORAGE_KEY = "reader:font-size-step";

export function useReaderFontSize() {
  const [step, setStep] = useState<number>(() => {
    if (typeof localStorage === "undefined") return DEFAULT_STEP;
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw !== null ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(parsed) && parsed >= 0 && parsed < FONT_STEPS.length) {
      return parsed;
    }
    return DEFAULT_STEP;
  });

  const fontScale = FONT_STEPS[step];

  const increase = useCallback(() => {
    setStep((prev) => {
      const next = Math.min(prev + 1, FONT_STEPS.length - 1);
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* quota */ }
      return next;
    });
  }, []);

  const decrease = useCallback(() => {
    setStep((prev) => {
      const next = Math.max(prev - 1, 0);
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* quota */ }
      return next;
    });
  }, []);

  return {
    fontScale,
    step,
    stepsTotal: FONT_STEPS.length,
    increase,
    decrease,
    isMin: step === 0,
    isMax: step === FONT_STEPS.length - 1,
  };
}
