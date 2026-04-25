/**
 * OPFS (Origin Private File System) helpers for the local-first layer.
 *
 * Root: `/starship/`.
 * Imports live at `/starship/imports/{sha256-prefix-2}/{sha256}/`:
 *   - `raw.bin`   — original file bytes
 *   - `meta.json` — { originalName, mime, sizeBytes, importedAt }
 *
 * PGlite's OPFS database lives in a completely separate root and is NOT
 * touched here. Do not attempt to resolve `opfs-ahp://...` paths.
 *
 * All helpers throw `OpfsUnavailableError` if OPFS is not available.
 */

export class OpfsUnavailableError extends Error {
  constructor() {
    super("OPFS is not available in this environment");
    this.name = "OpfsUnavailableError";
  }
}

const CHUNK_THRESHOLD = 8 * 1024 * 1024; // 8 MiB
const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MiB

async function getRoot(): Promise<FileSystemDirectoryHandle> {
  const nav = typeof navigator !== "undefined" ? navigator : null;
  if (!nav?.storage?.getDirectory) throw new OpfsUnavailableError();
  return nav.storage.getDirectory();
}

async function getStarshipDir(): Promise<FileSystemDirectoryHandle> {
  const root = await getRoot();
  return root.getDirectoryHandle("starship", { create: true });
}

async function resolveDir(
  segments: string[],
  create: boolean,
): Promise<FileSystemDirectoryHandle> {
  let dir = await getStarshipDir();
  for (const seg of segments) {
    dir = await dir.getDirectoryHandle(seg, { create });
  }
  return dir;
}

/** Compute SHA-256 of a Blob / ArrayBuffer, returning lowercase hex. */
export async function sha256Hex(data: Blob | ArrayBuffer | Uint8Array): Promise<string> {
  const buf =
    data instanceof Blob
      ? await data.arrayBuffer()
      : data instanceof Uint8Array
        ? (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
        : data;
  const hash = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(hash);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

/** Short (16-hex-char, 64-bit) content checksum for block-level anchoring. */
export async function hash16(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  const bytes = new Uint8Array(hash);
  let out = "";
  for (let i = 0; i < 8; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

function importPathSegments(sha256: string): string[] {
  const prefix = sha256.slice(0, 2);
  return ["imports", prefix, sha256];
}

/**
 * Write a file's bytes into OPFS at the canonical import path.
 * Returns the relative path (from `/starship/`) for logging.
 */
export async function putImportRaw(
  sha256: string,
  data: Blob,
): Promise<string> {
  const dir = await resolveDir(importPathSegments(sha256), true);
  const fileHandle = await dir.getFileHandle("raw.bin", { create: true });
  // FileSystemWritableFileStream is available on all modern browsers.
  const writable = await fileHandle.createWritable();
  try {
    if (data.size <= CHUNK_THRESHOLD) {
      await writable.write(data);
    } else {
      // Stream in 4 MiB chunks to keep the event loop responsive.
      let offset = 0;
      while (offset < data.size) {
        const end = Math.min(offset + CHUNK_SIZE, data.size);
        await writable.write(data.slice(offset, end));
        offset = end;
      }
    }
  } finally {
    await writable.close();
  }
  return `imports/${sha256.slice(0, 2)}/${sha256}/raw.bin`;
}

export interface ImportMetaJson {
  originalName: string;
  mime: string;
  sizeBytes: number;
  importedAt: string;
}

export async function putImportMeta(
  sha256: string,
  meta: ImportMetaJson,
): Promise<void> {
  const dir = await resolveDir(importPathSegments(sha256), true);
  const fileHandle = await dir.getFileHandle("meta.json", { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(new Blob([JSON.stringify(meta)], { type: "application/json" }));
  } finally {
    await writable.close();
  }
}

export async function getImportRaw(sha256: string): Promise<Blob | null> {
  try {
    const dir = await resolveDir(importPathSegments(sha256), false);
    const fileHandle = await dir.getFileHandle("raw.bin", { create: false });
    const file = await fileHandle.getFile();
    return file;
  } catch (err) {
    if ((err as { name?: string }).name === "NotFoundError") return null;
    throw err;
  }
}

export async function getImportMeta(sha256: string): Promise<ImportMetaJson | null> {
  try {
    const dir = await resolveDir(importPathSegments(sha256), false);
    const fileHandle = await dir.getFileHandle("meta.json", { create: false });
    const file = await fileHandle.getFile();
    return JSON.parse(await file.text()) as ImportMetaJson;
  } catch (err) {
    if ((err as { name?: string }).name === "NotFoundError") return null;
    throw err;
  }
}

export async function deleteImport(sha256: string): Promise<void> {
  try {
    const parent = await resolveDir(["imports", sha256.slice(0, 2)], false);
    await parent.removeEntry(sha256, { recursive: true });
  } catch (err) {
    if ((err as { name?: string }).name !== "NotFoundError") throw err;
  }
}

export async function hasImport(sha256: string): Promise<boolean> {
  try {
    const dir = await resolveDir(importPathSegments(sha256), false);
    await dir.getFileHandle("raw.bin", { create: false });
    return true;
  } catch {
    return false;
  }
}

/** Wipe the entire `/starship/` root. Used by the debug "reset" button. */
export async function wipeStarshipRoot(): Promise<void> {
  try {
    const root = await getRoot();
    await root.removeEntry("starship", { recursive: true });
  } catch (err) {
    if ((err as { name?: string }).name !== "NotFoundError") throw err;
  }
}
