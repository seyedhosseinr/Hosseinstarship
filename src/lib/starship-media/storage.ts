const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

const SAFE_STORAGE_SEGMENT_RE = /^[A-Za-z0-9_.-]+$/;

export function buildBundledMediaStorageKey(
  chapterNumber: number,
  filename: string,
): string {
  return `campbell/${chapterNumber}/${filename}`;
}

export function buildBundledMediaServePath(storageKey: string): string {
  const encoded = storageKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/api/media-assets/${encoded}`;
}

export function inferContentTypeFromPath(filePath: string): string {
  const dot = filePath.lastIndexOf(".");
  if (dot < 0) return "application/octet-stream";
  const ext = filePath.slice(dot).toLowerCase();
  return CONTENT_TYPE_BY_EXTENSION[ext] ?? "application/octet-stream";
}

export function normalizeBundledMediaStorageKey(
  input: string | string[],
): string | null {
  const segments = (Array.isArray(input) ? input : input.split("/"))
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) return null;
  if (!segments.every((segment) => {
    if (segment === "." || segment === "..") return false;
    return SAFE_STORAGE_SEGMENT_RE.test(segment);
  })) {
    return null;
  }

  return segments.join("/");
}

export function storagePathToBundledMediaKey(
  storagePath: string | null | undefined,
): string | null {
  if (!storagePath) return null;
  if (!storagePath.startsWith("/media/")) return null;
  return normalizeBundledMediaStorageKey(storagePath.slice("/media/".length));
}
