"use client";

/**
 * useUndo — hook exposing undo/redo for entity-level mutations.
 *
 * Reads counts from the undo stack and redo stack.
 * Applies the inverse mutation via applyInverse().
 */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { isLocalFirstEnabled } from "@/lib/local-first/flag";
import {
  popUndo,
  popRedo,
  applyInverse,
  getUndoCount,
  getRedoCount,
  pushUndo,
} from "@/lib/local-first/undo-stack";

export function useUndo() {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const refresh = useCallback(async () => {
    if (!isLocalFirstEnabled()) return;
    const undoCount = await getUndoCount();
    setCanUndo(undoCount > 0);
    setCanRedo(getRedoCount() > 0);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 1500);
    return () => clearInterval(id);
  }, [refresh]);

  const undo = useCallback(async () => {
    const entry = await popUndo();
    if (!entry) return;
    try {
      await applyInverse(entry);
      toast.success("لغو شد");
      // Push a redo entry (the inverse of the inverse)
    } catch {
      toast.error("خطا در لغو");
    }
    await refresh();
  }, [refresh]);

  const redo = useCallback(async () => {
    const entry = popRedo();
    if (!entry) return;
    try {
      // Re-push the undo entry for another potential undo
      await pushUndo({
        entityType: entry.entityType,
        entityLocalId: entry.entityLocalId,
        inverseOperation: entry.inverseOperation,
        inversePayload: entry.inversePayload,
      });
      await applyInverse(entry);
      toast.success("اعاده شد");
    } catch {
      toast.error("خطا در اعاده");
    }
    await refresh();
  }, [refresh]);

  return { undo, redo, canUndo, canRedo };
}
