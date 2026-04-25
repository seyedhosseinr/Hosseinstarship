"use client";

/**
 * Client-only bootstrap for local-first mode.
 *
 * Mounts once near the root of the tree. When the `STARSHIP_LOCAL_FIRST`
 * flag is ON, it:
 *   - starts the sync engine and wires its triggers,
 *   - renders the SW update prompt,
 *   - renders the storage warning banner.
 *
 * When the flag is OFF, this component renders nothing and has zero
 * runtime cost beyond the single `isLocalFirstEnabled()` call.
 */

import { useEffect, useState } from "react";
import { isLocalFirstEnabled } from "@/lib/local-first/flag";
import { startSyncEngine, stopSyncEngine } from "@/lib/local-first/sync-engine";
import { loadCachedIndex, rebuildIndex } from "@/lib/local-first/search-index";
import { useUndo } from "@/hooks/useUndo";
import { SwUpdatePrompt } from "./SwUpdatePrompt";
import { StorageWarningBanner } from "./StorageWarningBanner";
import { ConflictBanner } from "./ConflictBanner";

function UndoKeyboardListener() {
  const { undo, redo } = useUndo();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Skip if focus is in an input/textarea/contenteditable
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      const isUndo = (e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey;
      const isRedo = (e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey;

      if (isUndo) {
        e.preventDefault();
        void undo();
      } else if (isRedo) {
        e.preventDefault();
        void redo();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  return null;
}

export default function LocalFirstBoot() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!isLocalFirstEnabled()) return;
    setEnabled(true);
    startSyncEngine();

    // Build search index: load cached first for instant results, then rebuild
    loadCachedIndex().then(() => rebuildIndex()).catch(() => {});

    return () => {
      stopSyncEngine();
    };
  }, []);

  // SwUpdatePrompt is useful even when local-first is off — it fixes the
  // pre-existing "unconditional skipWaiting" bug. Mount it always.
  return (
    <>
      <SwUpdatePrompt />
      {enabled ? (
        <>
          <StorageWarningBanner />
          <ConflictBanner />
          <UndoKeyboardListener />
        </>
      ) : null}
    </>
  );
}
