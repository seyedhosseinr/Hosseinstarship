"use client";

import { useCallback, useEffect, useState } from "react";

export type ReaderFontFamily = "sans" | "serif" | "mono";

export type ReaderBgTheme =
  | "paper"
  | "parchment"
  | "warm"
  | "cool"
  | "night"
  | "slate"
  | "eyecare"
  | "amoled";

export type ReaderToolbarStyle = "popup" | "rail" | "both";

export type BgThemeConfig = {
  id: ReaderBgTheme;
  label: string;
  swatch: string;
  isDark: boolean;
  bgHsl: string;
};

export const BG_THEMES: BgThemeConfig[] = [
  { id: "paper",     label: "کاغذ",       swatch: "#FAF9F7", isDark: false, bgHsl: "40 24% 97%" },
  { id: "parchment", label: "پارشمن",     swatch: "#F5EDD6", isDark: false, bgHsl: "38 55% 90%" },
  { id: "warm",      label: "گرم",        swatch: "#FBF4E4", isDark: false, bgHsl: "38 72% 94%" },
  { id: "cool",      label: "خنک",        swatch: "#FFFFFF", isDark: false, bgHsl: "0 0% 100%" },
  { id: "night",     label: "شب",         swatch: "#1C1B1A", isDark: true,  bgHsl: "30 4% 11%" },
  { id: "slate",     label: "تیره آبی",   swatch: "#131C2B", isDark: true,  bgHsl: "220 38% 12%" },
  { id: "eyecare",   label: "مراقبت چشم", swatch: "#0F1A13", isDark: true,  bgHsl: "135 26% 8%" },
  { id: "amoled",    label: "مشکی",       swatch: "#080808", isDark: true,  bgHsl: "0 0% 3%" },
];

export const READER_FONT_STACKS: Record<ReaderFontFamily, string> = {
  sans: "var(--lib-font-persian, var(--font-vazir, Vazirmatn)), Tahoma, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  serif: "var(--font-serif-latin, Georgia), Tahoma, 'Times New Roman', serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
};

export type ReaderSettings = {
  fontFamily: ReaderFontFamily;
  fontSize: number; // px, 13–40
  lineHeight: number; // multiplier, 1.4–2.2
  maxWidth: number; // px, 540–1800
  showHighYield: boolean;
  showKeyExam: boolean;
  showMissedQuestions: boolean;
  bgTheme: ReaderBgTheme;
  toolbarStyle: ReaderToolbarStyle;
};

const STORAGE_KEY = "starship:reader-settings";
const FULL_WIDTH_MAX = 1800;
const LEGACY_DEFAULT_MAX_WIDTH = 720;

const DEFAULTS: ReaderSettings = {
  fontFamily: "sans",
  fontSize: 20,
  lineHeight: 1.8,
  maxWidth: 750,
  showHighYield: true,
  showKeyExam: true,
  showMissedQuestions: false,
  bgTheme: "paper",
  toolbarStyle: "popup",
};

function load(): ReaderSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const stored = JSON.parse(raw) as Partial<ReaderSettings>;
    return {
      ...DEFAULTS,
      ...stored,
      maxWidth: stored.maxWidth === LEGACY_DEFAULT_MAX_WIDTH
        ? DEFAULTS.maxWidth
        : (stored.maxWidth ?? DEFAULTS.maxWidth),
    };
  } catch {
    return DEFAULTS;
  }
}

function save(settings: ReaderSettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

export function useReaderSettings() {
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULTS);

  useEffect(() => {
    setSettings(load());
  }, []);

  const update = useCallback((patch: Partial<ReaderSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      save(next);
      return next;
    });
  }, []);

  const increaseFontSize = useCallback(() => {
    update({ fontSize: Math.min(40, settings.fontSize + 1) });
  }, [settings.fontSize, update]);

  const decreaseFontSize = useCallback(() => {
    update({ fontSize: Math.max(13, settings.fontSize - 1) });
  }, [settings.fontSize, update]);

  const resetDefaults = useCallback(() => {
    setSettings(DEFAULTS);
    save(DEFAULTS);
  }, []);

  return {
    settings,
    update,
    increaseFontSize,
    decreaseFontSize,
    resetDefaults,
  };
}
