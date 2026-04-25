/**
 * Hossein Starship — NOTE v8.0 RUNTIME HASHING
 *
 * contentHash / segmentHash are runtime-computed by the importer/normalizer.
 * Authors MUST NOT supply them — the contract forbids author-supplied hashes.
 *
 * All hashing is offline-safe:
 *   - Browser: uses SubtleCrypto (no network).
 *   - Node (SSR / tests): uses node:crypto (no network).
 *
 * Text is normalized (NFC + whitespace-collapse) before hashing so that
 * cosmetic reflows don't invalidate anchoring checksums.
 */

import type { BlockV8, SegmentNoteV8 } from "./note-v8.types";

// Normalize text for stable hashing. This should match the normalization
// used by the substring linter in note-v8-schema.ts.
export function normalizeForHash(s: string): string {
  return s.normalize("NFC").replace(/\s+/g, " ").trim();
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

/**
 * Offline SHA-256. Prefers Web Crypto (works in browser and modern Node).
 * Falls back to node:crypto when necessary (e.g. legacy Node).
 */
export async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);

  const subtle: SubtleCrypto | undefined =
    (globalThis as unknown as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;

  if (subtle && typeof subtle.digest === "function") {
    const buf = await subtle.digest("SHA-256", bytes);
    return `sha256:${bytesToHex(new Uint8Array(buf))}`;
  }

  // Node fallback (tests, older Node, edge runtimes without SubtleCrypto)
  const { createHash } = await import("node:crypto");
  const hex = createHash("sha256").update(Buffer.from(bytes)).digest("hex");
  return `sha256:${hex}`;
}

/**
 * Compute content hash for a v8 block. Pure of the block's `contentHash`
 * field so repeatedly hashing is idempotent.
 */
export async function computeContentHash(content: string): Promise<string> {
  return sha256(normalizeForHash(content));
}

/**
 * Compute a canonical segment hash by hashing a stable digest of each block's
 * (blockId + blockType + contentHash + flag byte) concatenated in reading order.
 * This gives a segment-level fingerprint that changes when any authored field
 * changes but is immune to key-order differences in serialized JSON.
 */
export async function computeSegmentHash(seg: SegmentNoteV8): Promise<string> {
  const parts: string[] = [seg.schemaVersion, seg.segmentId];
  for (const section of seg.sections) {
    parts.push(`§${section.heading}`);
    for (const b of section.blocks) {
      const ch = b.contentHash ?? (await computeContentHash(b.content));
      const flagBits =
        (b.flags.highYield ? "1" : "0") +
        (b.flags.decisionChanging ? "1" : "0") +
        (b.flags.examRelevant ? "1" : "0");
      parts.push(`${b.blockId}|${b.blockType}|${ch}|${flagBits}`);
    }
  }
  return sha256(parts.join("\n"));
}

/**
 * Attach contentHash to every block and segmentHash to the segment.
 * Mutates a shallow clone — input is not modified.
 */
export async function attachHashes(seg: SegmentNoteV8): Promise<SegmentNoteV8> {
  const sections = await Promise.all(
    seg.sections.map(async (section) => ({
      ...section,
      blocks: await Promise.all(
        section.blocks.map(
          async (b): Promise<BlockV8> => ({
            ...b,
            contentHash: b.contentHash ?? (await computeContentHash(b.content)),
          }),
        ),
      ),
    })),
  );
  const withBlockHashes: SegmentNoteV8 = { ...seg, sections };
  const segmentHash = await computeSegmentHash(withBlockHashes);
  return { ...withBlockHashes, segmentHash };
}
