/**
 * Feature flag for handwritten margin notes.
 *
 * Resolution order (first match wins):
 *   1. localStorage['starship-handwritten-notes-override']  — per-device debug
 *   2. process.env.NEXT_PUBLIC_STARSHIP_HANDWRITTEN_NOTES   — build-time default
 *   3. '0'                                                  — hard default (off)
 */

const OVERRIDE_KEY = "starship-handwritten-notes-override";

function readOverride(): "0" | "1" | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(OVERRIDE_KEY);
    if (v === "0" || v === "1") return v;
    return null;
  } catch {
    return null;
  }
}

function readEnv(): "0" | "1" | null {
  const v = process.env.NEXT_PUBLIC_STARSHIP_HANDWRITTEN_NOTES;
  if (v === "0" || v === "1") return v;
  return null;
}

export function isHandwrittenNotesEnabled(): boolean {
  const override = readOverride();
  if (override !== null) return override === "1";
  const env = readEnv();
  if (env !== null) return env === "1";
  return false;
}

export function setHandwrittenNotesOverride(value: "0" | "1" | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(OVERRIDE_KEY);
    else window.localStorage.setItem(OVERRIDE_KEY, value);
  } catch {
    /* ignore quota / disabled storage */
  }
}
