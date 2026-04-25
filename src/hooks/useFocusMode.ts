"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Manages focus mode (immersive reading) and native fullscreen.
 *
 * - `F` key toggles focus mode
 * - `Escape` exits focus mode
 * - In focus mode, body overflow is locked
 * - Optionally delegates to the browser Fullscreen API
 * - Mirrors focus/fullscreen state onto <html data-reader-fullscreen="true">
 *   so reader-fullscreen.css can widen the actual reading surfaces
 */
export function useFocusMode(
  rootRef?: React.RefObject<HTMLElement | null>,
  options?: {
    /** Use browser Fullscreen API instead of CSS overlay. Default: false */
    useNativeFullscreen?: boolean;
  },
) {
  const [isFocusMode, setIsFocusMode] = useState(false);
  const useNative = options?.useNativeFullscreen ?? false;

  // Keyboard: F to toggle, Escape to exit
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (target?.isContentEditable) return;

      if (e.key.toLowerCase() === "f" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setIsFocusMode((v) => !v);
      }

      if (e.key === "Escape") {
        setIsFocusMode(false);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Keep <html data-reader-fullscreen> in sync so fullscreen-specific
  // reader CSS actually activates on the live reader surfaces.
  useEffect(() => {
    if (typeof document === "undefined") return;

    if (isFocusMode) {
      document.documentElement.dataset.readerFullscreen = "true";
    } else {
      delete document.documentElement.dataset.readerFullscreen;
    }

    return () => {
      delete document.documentElement.dataset.readerFullscreen;
    };
  }, [isFocusMode]);

  // Native fullscreen sync
  useEffect(() => {
    if (!useNative) return;

    const handler = () => {
      const fs = !!document.fullscreenElement;
      setIsFocusMode(fs);
    };

    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, [useNative]);

  // Body overflow lock
  useEffect(() => {
    if (!isFocusMode) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isFocusMode]);

  // Native fullscreen toggle
  useEffect(() => {
    if (!useNative || !rootRef?.current) return;

    if (isFocusMode && !document.fullscreenElement) {
      rootRef.current.requestFullscreen().catch(() => {});
    } else if (!isFocusMode && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, [isFocusMode, useNative, rootRef]);

  const toggle = useCallback(() => setIsFocusMode((v) => !v), []);
  const enter = useCallback(() => setIsFocusMode(true), []);
  const exit = useCallback(() => setIsFocusMode(false), []);

  return { isFocusMode, toggle, enter, exit };
}