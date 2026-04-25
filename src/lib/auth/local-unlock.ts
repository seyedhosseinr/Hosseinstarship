/**
 * Local device/browser unlock marker.
 *
 * This is NOT an authentication source — the only real gate is the
 * server-signed session cookie checked by `src/middleware.ts`. This marker
 * exists purely to allow a previously-authenticated PWA to boot OFFLINE
 * without showing a login screen. It is set after a successful server login
 * and cleared on logout.
 */
export const LOCAL_UNLOCK_KEY = "starship:local-unlock";

export function isLocalUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LOCAL_UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

export function markLocalUnlocked(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_UNLOCK_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearLocalUnlock(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LOCAL_UNLOCK_KEY);
  } catch {
    /* ignore */
  }
}
