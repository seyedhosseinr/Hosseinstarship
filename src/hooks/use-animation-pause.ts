"use client";

import { useEffect } from "react";

const IDLE_TIMEOUT_MS = 60_000;

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "pointerdown",
  "scroll",
  "wheel",
] as const;

/**
 * Keeps documentElement[data-mode] in sync with navigator.onLine.
 * Pauses all CSS animations after 60 s of idle or when the tab is hidden.
 * Resumes animations when the user interacts or the tab becomes visible.
 */
export function useAnimationPause(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // ── Online / offline → data-mode ──────────────────────────────
    const updateDataMode = () => {
      document.documentElement.setAttribute(
        "data-mode",
        navigator.onLine ? "online" : "offline",
      );
    };
    updateDataMode();
    window.addEventListener("online", updateDataMode);
    window.addEventListener("offline", updateDataMode);

    // ── Idle / visibility → animations-paused ─────────────────────
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const pauseAnimations = () => {
      document.body.classList.add("animations-paused");
    };

    const scheduleIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(pauseAnimations, IDLE_TIMEOUT_MS);
    };

    const onActivity = () => {
      document.body.classList.remove("animations-paused");
      scheduleIdle();
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        if (idleTimer) clearTimeout(idleTimer);
        pauseAnimations();
      } else {
        onActivity();
      }
    };

    ACTIVITY_EVENTS.forEach((ev) => {
      window.addEventListener(ev, onActivity, { passive: true });
    });
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Start the idle timer immediately
    scheduleIdle();

    return () => {
      window.removeEventListener("online", updateDataMode);
      window.removeEventListener("offline", updateDataMode);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      ACTIVITY_EVENTS.forEach((ev) => {
        window.removeEventListener(ev, onActivity);
      });
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, []);
}
