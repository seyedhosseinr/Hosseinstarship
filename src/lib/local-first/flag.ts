/**
 * Local-first feature flag.
 *
 * Resolution order (first match wins):
 *   1. localStorage['starship-local-first-override']  — per-device debug toggle
 *   2. process.env.NEXT_PUBLIC_STARSHIP_LOCAL_FIRST    — build-time default
 *   3. '0'                                             — hard default
 *
 * This is the ONLY file in `src/lib/local-first/` that is allowed to read
 * from `localStorage`, and it only reads a single override key — no app data
 * ever lives there. Every other module gates on `isLocalFirstEnabled()`.
 */

const OVERRIDE_KEY = "starship-local-first-override";

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
  const v = process.env.NEXT_PUBLIC_STARSHIP_LOCAL_FIRST;
  if (v === "0" || v === "1") return v;
  return null;
}

/**
 * Returns `true` if local-first mode is enabled on this device / build.
 *
 * Cheap to call: no I/O beyond a single localStorage.getItem in the browser.
 * Safe during SSR: returns `false` when `window` is not defined, which
 * guarantees existing (server-rendered) code paths run unchanged.
 */
export function isLocalFirstEnabled(): boolean {
  const override = readOverride();
  if (override !== null) return override === "1";
  const env = readEnv();
  if (env !== null) return env === "1";
  return false;
}

/** Test/debug: force the flag on or off on this device. */
export function setLocalFirstOverride(value: "0" | "1" | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(OVERRIDE_KEY);
    else window.localStorage.setItem(OVERRIDE_KEY, value);
  } catch {
    /* ignore quota / disabled storage */
  }
}
