/**
 * Offline file import.
 *
 * This is an additional pathway — the V3 edge importer is untouched. When
 * local-first is on, file imports:
 *   1. Compute SHA-256 of the raw bytes.
 *   2. If an `importManifests` row already exists for that SHA, return
 *      the existing manifest (dedupe — avoids re-uploading or re-parsing).
 *   3. Write raw bytes to OPFS at `/starship/imports/{prefix}/{sha256}/raw.bin`.
 *   4. Write a `meta.json` sibling with basic file metadata.
 *   5. Create an `importManifests` Dexie row and enqueue an outbox
 *      mutation so the sync engine can notify the server.
 *
 * The normal V3 parser/WASM worker is still responsible for turning the
 * raw bytes into PGlite rows — this module only guarantees that the bytes
 * survive offline and the server eventually learns about them.
 */

import {
  putImportRaw,
  putImportMeta,
  sha256Hex,
  type ImportMetaJson,
} from "./opfs";
import type { ImportManifestRow } from "./idb";
import { getLocalDb } from "./idb";
import { enqueueMutation } from "./outbox";

export interface OfflineImportInput {
  file: File;
  /** Optional override for the stored name (e.g. after sanitization). */
  displayName?: string;
}

export interface OfflineImportResult {
  sha256: string;
  manifest: ImportManifestRow;
  mutationId: string | null;
  deduped: boolean;
}

export async function importFileOffline(
  input: OfflineImportInput,
): Promise<OfflineImportResult> {
  const file = input.file;
  const db = getLocalDb();

  // 1) Hash
  const sha256 = await sha256Hex(file);

  // 2) Dedupe — if the SHA exists, return the existing manifest.
  const existing = await db.importManifests.get(sha256);
  if (existing) {
    return { sha256, manifest: existing, mutationId: null, deduped: true };
  }

  // 3) + 4) Write raw bytes + meta.json into OPFS.
  await putImportRaw(sha256, file);
  const meta: ImportMetaJson = {
    originalName: input.displayName ?? file.name,
    mime: file.type || "application/octet-stream",
    sizeBytes: file.size,
    importedAt: new Date().toISOString(),
  };
  await putImportMeta(sha256, meta);

  // 5) Manifest row + outbox mutation, transactionally.
  const manifest: ImportManifestRow = {
    sha256,
    serverId: null,
    originalName: meta.originalName,
    mime: meta.mime,
    sizeBytes: meta.sizeBytes,
    status: "queued",
    localCreatedAt: meta.importedAt,
    lastError: null,
  };

  let mutationId: string | null = null;
  await db.transaction("rw", db.importManifests, db.outbox, async () => {
    await db.importManifests.put(manifest);
    mutationId = await enqueueMutation({
      entityType: "import_manifest",
      entityLocalId: sha256,
      operation: "create",
      payload: {
        sha256,
        originalName: meta.originalName,
        mime: meta.mime,
        sizeBytes: meta.sizeBytes,
        importedAt: meta.importedAt,
      },
    });
  });

  return { sha256, manifest, mutationId, deduped: false };
}

/** Update a manifest's status (e.g. after the parser finishes locally). */
export async function updateManifestStatus(
  sha256: string,
  status: ImportManifestRow["status"],
  error?: string | null,
): Promise<void> {
  const db = getLocalDb();
  const row = await db.importManifests.get(sha256);
  if (!row) return;
  await db.importManifests.put({
    ...row,
    status,
    lastError: error ?? null,
  });
}

export async function listImportManifests(): Promise<ImportManifestRow[]> {
  return getLocalDb().importManifests.orderBy("localCreatedAt").reverse().toArray();
}
