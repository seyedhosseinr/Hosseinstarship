"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

/**
 * ThemeBridge syncs next-themes' resolved theme to additional DOM attributes
 * that some inline-styled components read.
 *
 * NOTE: next-themes already manages the `dark` class on <html> via
 * `attribute="class"` in ThemeProvider. This bridge only sets supplementary
 * attributes like `data-theme` and `color-scheme`.
 */
export function ThemeBridge() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const isDark = resolvedTheme === "dark";
    // data-theme for components that read dataset
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    // color-scheme so native form controls adapt
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  }, [resolvedTheme]);

  return null;
}
