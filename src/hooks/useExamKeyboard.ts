"use client";

import { useEffect } from "react";

interface UseExamKeyboardOptions {
  enabled: boolean;
  onNext: () => void;
  onPrev: () => void;
  onMark: () => void;
  onConfirm: () => void;
  onSelectOption: (index: number) => void;
}

/**
 * Keyboard shortcuts for the exam interface.
 * Arrow keys navigate, M toggles mark, Enter confirms, 1-8 select options.
 */
export function useExamKeyboard({
  enabled,
  onNext,
  onPrev,
  onMark,
  onConfirm,
  onSelectOption,
}: UseExamKeyboardOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") onNext();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") onPrev();
      if (e.key === "m" || e.key === "M") onMark();
      if (e.key === "Enter") onConfirm();

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 8) onSelectOption(num - 1);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, onNext, onPrev, onMark, onConfirm, onSelectOption]);
}
