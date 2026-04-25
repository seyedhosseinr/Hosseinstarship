import { useState, useEffect } from "react";

export function useIsMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < breakpoint);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [breakpoint]);

  return isMobile;
}

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

export function useHotkeys(key: string, callback: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const parts = key.toLowerCase().split("+");
      const mainKey = parts.pop();
      const needCtrl = parts.includes("ctrl") || parts.includes("mod");
      const needShift = parts.includes("shift");
      const needAlt = parts.includes("alt");

      if (needCtrl && !(e.ctrlKey || e.metaKey)) return;
      if (needShift && !e.shiftKey) return;
      if (needAlt && !e.altKey) return;
      if (e.key.toLowerCase() === mainKey) {
        e.preventDefault();
        callback();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [key, callback]);
}
