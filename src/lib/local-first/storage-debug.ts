/**
 * Storage quota / persistence helpers used by the debug panel and the
 * non-blocking storage warning banner.
 *
 * iOS Safari notes:
 *  - `navigator.storage.persisted()` may return false even when PWA
 *    persistence is granted; iOS does not always surface it. We expose
 *    the raw result and leave UI copy to the caller.
 *  - `navigator.storage.estimate()` returns a heuristic, not a hard cap.
 */

export interface StorageStatus {
  supported: boolean;
  persisted: boolean;
  usage: number | null;
  quota: number | null;
  usageRatio: number | null; // 0..1 or null
}

export async function getStorageStatus(): Promise<StorageStatus> {
  if (typeof navigator === "undefined" || !navigator.storage) {
    return {
      supported: false,
      persisted: false,
      usage: null,
      quota: null,
      usageRatio: null,
    };
  }
  let persisted = false;
  try {
    persisted = !!(await navigator.storage.persisted?.());
  } catch {
    persisted = false;
  }
  let usage: number | null = null;
  let quota: number | null = null;
  try {
    const est = await navigator.storage.estimate?.();
    usage = typeof est?.usage === "number" ? est.usage : null;
    quota = typeof est?.quota === "number" ? est.quota : null;
  } catch {
    /* ignore */
  }
  const ratio =
    typeof usage === "number" && typeof quota === "number" && quota > 0
      ? usage / quota
      : null;
  return {
    supported: true,
    persisted,
    usage,
    quota,
    usageRatio: ratio,
  };
}

/** Request durable storage. Returns true if granted (or already granted). */
export async function requestPersistence(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return false;
  }
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
