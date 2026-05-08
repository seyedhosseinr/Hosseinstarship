"use client";

import { useCallback, useEffect, useState } from "react";

export type ReaderFontFamily = "sans" | "serif" | "mono";

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
};

const STORAGE_KEY = "starship:reader-settings";
const FULL_WIDTH_MAX = 1800;
const LEGACY_DEFAULT_MAX_WIDTH = 720;

const DEFAULTS: ReaderSettings = {
  fontFamily: "sans",
  fontSize: 20,
  lineHeight: 1.8,
  maxWidth: FULL_WIDTH_MAX,
  showHighYield: true,
  showKeyExam: true,
  showMissedQuestions: false,
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
        ? FULL_WIDTH_MAX
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
