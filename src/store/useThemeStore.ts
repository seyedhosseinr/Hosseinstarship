"use client";

import { useTheme } from "next-themes";

type ThemeState = {
  theme: string;
  setTheme: (t: string) => void;
  toggleTheme: () => void;
};

/**
 * Adapter that wraps next-themes' useTheme() in a Zustand-selector-compatible
 * API so existing callers such as ThemeBridge keep working.
 */
export function useThemeStore<T>(selector: (state: ThemeState) => T): T {
  const { resolvedTheme, setTheme } = useTheme();
  const effectiveTheme = resolvedTheme === "dark" ? "dark" : "light";
  const state: ThemeState = {
    theme: effectiveTheme,
    setTheme,
    toggleTheme: () => setTheme(effectiveTheme === "dark" ? "light" : "dark"),
  };
  return selector(state);
}
