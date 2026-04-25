"use client";

import { useCallback, useEffect, useState } from "react";

type PanelId = "spine" | "annotations";

type PanelState = Record<PanelId, boolean>;

const DEFAULTS: PanelState = {
  spine: false,
  annotations: false,
};

/**
 * Manages open/close state for Library panels:
 * - spine (sidebar: chapters + TOC)
 * - annotations (floating panel)
 *
 * Auto-collapses panels when focus mode is active.
 * Restores previous state when focus mode exits.
 */
export function usePanelState(isFocusMode: boolean) {
  const [panels, setPanels] = useState<PanelState>(DEFAULTS);
  const [preFS, setPreFS] = useState<PanelState | null>(null);

  // Save & collapse on focus mode
  useEffect(() => {
    if (isFocusMode) {
      setPanels((current) => {
        setPreFS(current);
        return { spine: false, annotations: false };
      });
    } else if (preFS) {
      setPanels(preFS);
      setPreFS(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocusMode]);

  const toggle = useCallback((panel: PanelId) => {
    setPanels((p) => ({ ...p, [panel]: !p[panel] }));
  }, []);

  const open = useCallback((panel: PanelId) => {
    setPanels((p) => ({ ...p, [panel]: true }));
  }, []);

  const close = useCallback((panel: PanelId) => {
    setPanels((p) => ({ ...p, [panel]: false }));
  }, []);

  return {
    spine: panels.spine,
    annotations: panels.annotations,
    toggle,
    open,
    close,
  };
}
