/** Stable composite key scoping a handwritten note to a specific block. */
export function makeAnchorKey(
  chapterId: string,
  segmentId: string,
  blockId: string,
): string {
  return `${chapterId}::${segmentId}::${blockId}`;
}

/** Inverse of makeAnchorKey — useful for display/debug. */
export function parseAnchorKey(key: string): {
  chapterId: string;
  segmentId: string;
  blockId: string;
} | null {
  const parts = key.split("::");
  if (parts.length !== 3) return null;
  const [chapterId, segmentId, blockId] = parts;
  return { chapterId, segmentId, blockId };
}
