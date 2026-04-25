"use client";

import { useEffect } from "react";

interface CardCreationShortcutsProps {
  enabled?: boolean;
  onCreateBasic: () => void;
  onCreateCloze: () => void;
  onCreateFromSelection: (text: string) => void;
  onQuickConvert: () => void;
}

export function useHotkeys(keys: string, callback: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled || !keys.trim()) {
      return;
    }

    const handler = (event: KeyboardEvent) => {
      const parts = keys.toLowerCase().split("+");
      const key = parts[parts.length - 1];
      const needsAlt = parts.includes("alt");
      const needsCtrl = parts.includes("ctrl");
      const needsShift = parts.includes("shift");

      if (
        event.key.toLowerCase() === key &&
        event.altKey === needsAlt &&
        event.ctrlKey === needsCtrl &&
        event.shiftKey === needsShift
      ) {
        event.preventDefault();
        callback();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [keys, callback, enabled]);
}

export function useCardCreationShortcuts({
  enabled = true,
  onCreateBasic,
  onCreateCloze,
  onCreateFromSelection,
  onQuickConvert,
}: CardCreationShortcutsProps) {
  useHotkeys("alt+c", onCreateBasic, enabled);
  useHotkeys("alt+z", () => {
    const selection = window.getSelection()?.toString().trim();
    if (selection) {
      onCreateFromSelection(selection);
      return;
    }
    onCreateCloze();
  }, enabled);
  useHotkeys("alt+q", onQuickConvert, enabled);
  useHotkeys("ctrl+shift+c", () => {
    const selection = window.getSelection()?.toString().trim();
    if (selection) {
      onCreateFromSelection(selection);
    }
  }, enabled);
}
