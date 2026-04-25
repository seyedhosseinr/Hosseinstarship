"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * useReaderFullscreen
 * ─────────────────────────────────────────────────────────────────
 * Declarative wrapper around the Fullscreen API + the reader's
 * `data-reader-fullscreen` attribute convention.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The reader components (FrameBody, SectionHeader, FrameCardV2, etc.)
 * ship with `max-w-[var(--reader-prose-w,70ch)]` on their prose and
 * list surfaces. In normal mode the CSS variable is unset and the
 * 70ch fallback produces a comfortable reading column. In fullscreen,
 * though, a 70ch column in a 1920px-wide viewport looks like a
 * postage-stamp floating in a desert.
 *
 * This hook toggles `data-reader-fullscreen="true"` on the document
 * element whenever the browser is actually in fullscreen mode. Paired
 * with the CSS in `reader-fullscreen.css`, the prose width expands
 * to a wider (but still bounded) reading column, with generous
 * inline padding.
 *
 * USAGE
 * ─────
 *   const { isFullscreen, enter, exit, toggle } = useReaderFullscreen();
 *   <button onClick={toggle}>
 *     {isFullscreen ? "خروج از fullscreen" : "Fullscreen"}
 *   </button>
 *
 * You can optionally pass a ref to an element you want to fullscreen
 * (e.g., a reader container div). Defaults to document.documentElement.
 */

type FullscreenTarget = Element | React.RefObject<Element | null>;

interface UseReaderFullscreenOptions {
  /** Element to request fullscreen on. Defaults to document.documentElement. */
  target?: FullscreenTarget;
  /**
   * Whether to toggle the `data-reader-fullscreen` attribute on
   * document.documentElement. Default: true.  Disable this if you
   * want to manage the CSS variable scope yourself (e.g. on a
   * reader wrapper div rather than the html root).
   */
  setGlobalAttribute?: boolean;
}

function resolveTarget(target: FullscreenTarget | undefined): Element | null {
  if (!target) return typeof document !== "undefined" ? document.documentElement : null;
  if (target instanceof Element) return target;
  return target.current;
}

export function useReaderFullscreen(
  options: UseReaderFullscreenOptions = {},
) {
  const { target, setGlobalAttribute = true } = options;
  const [isFullscreen, setIsFullscreen] = useState(false);

  /* Sync React state with browser fullscreen state. Using the
     `fullscreenchange` event so Esc / F11 / page-native exits stay
     reflected in the hook's return value. */
  useEffect(() => {
    const handler = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (setGlobalAttribute) {
        if (fs) {
          document.documentElement.dataset.readerFullscreen = "true";
        } else {
          delete document.documentElement.dataset.readerFullscreen;
        }
      }
    };
    document.addEventListener("fullscreenchange", handler);
    // Run once to capture initial state.
    handler();
    return () => document.removeEventListener("fullscreenchange", handler);
  }, [setGlobalAttribute]);

  const enter = useCallback(async () => {
    const el = resolveTarget(target);
    if (!el) return;
    if (document.fullscreenElement) return;
    try {
      await el.requestFullscreen();
    } catch (err) {
      // Safari / edge cases — fail silently, don't surface to user.
      console.warn("[useReaderFullscreen] enter failed:", err);
    }
  }, [target]);

  const exit = useCallback(async () => {
    if (!document.fullscreenElement) return;
    try {
      await document.exitFullscreen();
    } catch (err) {
      console.warn("[useReaderFullscreen] exit failed:", err);
    }
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      return exit();
    }
    return enter();
  }, [enter, exit]);

  return { isFullscreen, enter, exit, toggle };
}