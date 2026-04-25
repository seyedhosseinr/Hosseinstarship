"use client";

import { useState, useCallback } from "react";

/**
 * Font size control for exam question text.
 * Range: 11px to 22px, step 1.
 */
export function useFontScale(initial = 15) {
  const [fontSize, setFontSize] = useState(initial);

  const inc = useCallback(() => setFontSize((s) => Math.min(s + 1, 22)), []);
  const dec = useCallback(() => setFontSize((s) => Math.max(s - 1, 11)), []);

  return { fontSize, inc, dec };
}
