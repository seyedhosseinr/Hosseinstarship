"use client";

import { useEffect, type RefObject } from "react";

/**
 * Palm-before-pen scroll restoration.
 *
 * When a palm rests on the screen slightly before an Apple Pencil lands,
 * the browser may begin a touch-driven pan of the reader stage. We snapshot
 * `scrollTop` on every touchstart; if a pen pointerdown follows within a
 * short window and the scroll actually drifted, we restore the pre-touch
 * position. A stationary palm causes no drift and therefore no restoration —
 * an intentional finger scroll held longer than the window falls through
 * unchanged.
 *
 * Scope: mount once per reader. Safe when `scrollRef` is null — it no-ops.
 */

const WINDOW_MS = 150;

export function usePalmBeforePenGuard(
  scrollRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    let snapshotScrollTop: number | null = null;
    let snapshotAt = 0;

    const onTouchStart = () => {
      const stage = scrollRef.current;
      if (!stage) return;
      snapshotScrollTop = stage.scrollTop;
      snapshotAt = performance.now();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "pen") return;
      const stage = scrollRef.current;
      if (!stage || snapshotScrollTop === null) return;
      const dt = performance.now() - snapshotAt;
      if (dt > WINDOW_MS) {
        snapshotScrollTop = null;
        return;
      }
      if (stage.scrollTop !== snapshotScrollTop) {
        stage.scrollTop = snapshotScrollTop;
      }
      snapshotScrollTop = null;
    };

    const onTouchEndOrCancel = () => {
      // If the touch lifted without a pen arriving inside the window, the
      // snapshot is stale — forget it so a later pen doesn't snap the
      // user back from a legitimate finger scroll that just ended.
      snapshotScrollTop = null;
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEndOrCancel, { passive: true });
    document.addEventListener("touchcancel", onTouchEndOrCancel, { passive: true });
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEndOrCancel);
      document.removeEventListener("touchcancel", onTouchEndOrCancel);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [scrollRef]);
}
