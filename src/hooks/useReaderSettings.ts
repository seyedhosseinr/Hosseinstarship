"use client";

import { useCallback, useEffect, useState } from "react";

export type ReaderSettings = {
  fontSize: number; // px, 13–24
  lineHeight: number; // multiplier, 1.4–2.2
  maxWidth: number; // px, 540–900
  showHighYield: boolean;
  showKeyExam: boolean;
  showMissedQuestions: boolean;
};

const STORAGE_KEY = "starship:reader-settings";

const DEFAULTS: ReaderSettings = {
  fontSize: 17,
  lineHeight: 1.8,
  maxWidth: 720,
  showHighYield: true,
  showKeyExam: true,
  showMissedQuestions: false,
};

function load(): ReaderSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
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
    update({ fontSize: Math.min(24, settings.fontSize + 1) });
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
