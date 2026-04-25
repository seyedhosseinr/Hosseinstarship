/**
 * Offline attachment/image cache via OPFS.
 *
 * For every image URL the user views at least once:
 *   1. Fetch blob (if online).
 *   2. Store in OPFS under /starship/attachments/{sha256-prefix}/{sha256}.ext
 *   3. Store URL→sha256 mapping in Dexie 'attachmentMap' store.
 *   4. On subsequent views, return blob URL from OPFS instead of network fetch.
 */

import type { AttachmentMapRow } from "./idb";
import { getLocalDb } from "./idb";

async function sha256Hex(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getExtFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const dot = pathname.lastIndexOf(".");
    if (dot !== -1) return pathname.slice(dot + 1).slice(0, 10);
  } catch { /* ignore */ }
  return "bin";
}

async function getOPFSDir(sha256: string): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  const starship = await root.getDirectoryHandle("starship", { create: true });
  const att = await starship.getDirectoryHandle("attachments", { create: true });
  const prefix = sha256.slice(0, 2);
  const prefixDir = await att.getDirectoryHandle(prefix, { create: true });
  return prefixDir;
}

/**
 * Cache an image URL to OPFS. Returns the sha256. No-op if already cached.
 */
export async function cacheAttachment(url: string): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const db = getLocalDb();

  // Already cached?
  const existing = await db.attachmentMap.get(url);
  if (existing) {
    await db.attachmentMap.update(url, { lastAccessedAt: new Date().toISOString() });
    return existing.sha256;
  }

  // Fetch the image
  let blob: Blob;
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    blob = await res.blob();
  } catch {
    return null; // offline or fetch error
  }

  const hash = await sha256Hex(blob);
  const ext = getExtFromUrl(url);

  // Write to OPFS
  try {
    const dir = await getOPFSDir(hash);
    const fileHandle = await dir.getFileHandle(`${hash}.${ext}`, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
  } catch {
    return null; // OPFS unavailable
  }

  // Store mapping
  const now = new Date().toISOString();
  const row: AttachmentMapRow = {
    url,
    sha256: hash,
    ext,
    sizeBytes: blob.size,
    cachedAt: now,
    lastAccessedAt: now,
  };
  await db.attachmentMap.put(row);
  return hash;
}

/**
 * Resolve a URL to a blob URL from OPFS cache, or return the original URL.
 */
export async function resolveAttachment(url: string): Promise<string> {
  if (typeof window === "undefined") return url;
  const db = getLocalDb();
  const row = await db.attachmentMap.get(url);
  if (!row) return url;

  try {
    const dir = await getOPFSDir(row.sha256);
    const fileHandle = await dir.getFileHandle(`${row.sha256}.${row.ext}`);
    const file = await fileHandle.getFile();
    await db.attachmentMap.update(url, { lastAccessedAt: new Date().toISOString() });
    return URL.createObjectURL(file);
  } catch {
    return url; // OPFS file missing, fall through to network
  }
}

/**
 * LRU eviction — remove oldest-accessed entries above quota.
 */
export async function garbageCollect(maxBytes = 500 * 1024 * 1024): Promise<number> {
  const db = getLocalDb();
  const all = await db.attachmentMap.orderBy("lastAccessedAt").toArray();
  let totalSize = all.reduce((acc, r) => acc + r.sizeBytes, 0);
  let evicted = 0;

  for (const row of all) {
    if (totalSize <= maxBytes) break;
    try {
      const dir = await getOPFSDir(row.sha256);
      await dir.removeEntry(`${row.sha256}.${row.ext}`);
    } catch { /* already gone */ }
    await db.attachmentMap.delete(row.url);
    totalSize -= row.sizeBytes;
    evicted++;
  }
  return evicted;
}
