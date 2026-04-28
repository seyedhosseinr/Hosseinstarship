/**
 * Starship Media Reader feature flag.
 *
 * Resolution order (first match wins):
 *   1. localStorage['starship-media-reader-override'] — per-device debug toggle
 *   2. process.env.NEXT_PUBLIC_STARSHIP_MEDIA_READER  — build-time default
 *   3. '0'                                            — hard default
 *
 * Phase 1 scope: when ON, the library-v2 Reader detects image / figure /
 * table references in NOTE prose and renders them as inline anchors that
 * open a fallback lightbox. No NOTE schema, generator, or importer code
 * is touched. Default is OFF — this is opt-in until the importer ships.
 */

const OVERRIDE_KEY = "starship-media-reader-override";

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
  const v = process.env.NEXT_PUBLIC_STARSHIP_MEDIA_READER;
  if (v === "0" || v === "1") return v;
  return null;
}

export function isStarshipMediaReaderEnabled(): boolean {
  const override = readOverride();
  if (override !== null) return override === "1";
  const env = readEnv();
  if (env !== null) return env === "1";
  return false;
}

export function setStarshipMediaReaderOverride(value: "0" | "1" | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(OVERRIDE_KEY);
    else window.localStorage.setItem(OVERRIDE_KEY, value);
  } catch {
    /* ignore quota / disabled storage */
  }
}
