// src/lib/exam/campbell-hierarchy.ts
// Volume → Part → Chapter hierarchy built from the Campbell Board JSON.
// Only includes entries where included === true.

import rawData from '../../../data/campbell-board-2025.json';

interface RawEntry {
  chapter: number;
  volume: number;
  part: string;
  title: string;
  start_page: number;
  end_page: number;
  included: boolean;
}

export interface CampbellChapter {
  id: string;           // "ch-2" (ch-{chapterNo})
  chapterNo: number;
  title: string;
  startPage: number;
  endPage: number;
  partId: string;
  volumeId: string;
}

export interface CampbellPart {
  id: string;           // slugified: "vol-1-clinical-decision-making"
  label: string;        // "Clinical Decision Making"
  volumeId: string;
  chapters: CampbellChapter[];
}

export interface CampbellVolume {
  id: string;           // "vol-1", "vol-2"
  label: string;        // "Volume 1", "Volume 2"
  volumeNo: number;
  parts: CampbellPart[];
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function partId(volumeNo: number, partLabel: string): string {
  return `vol-${volumeNo}-${slugify(partLabel)}`;
}

function chapterId(chapterNo: number): string {
  return `ch-${chapterNo}`;
}

// Build the hierarchy once at module load time
function buildHierarchy(): CampbellVolume[] {
  const entries = (rawData as RawEntry[]).filter((e) => e.included === true);

  // Group by volume → part
  const volumeMap = new Map<number, Map<string, RawEntry[]>>();

  for (const entry of entries) {
    if (!volumeMap.has(entry.volume)) {
      volumeMap.set(entry.volume, new Map());
    }
    const partMap = volumeMap.get(entry.volume)!;
    if (!partMap.has(entry.part)) {
      partMap.set(entry.part, []);
    }
    partMap.get(entry.part)!.push(entry);
  }

  const volumes: CampbellVolume[] = [];

  for (const [volumeNo, partMap] of Array.from(volumeMap.entries()).sort((a, b) => a[0] - b[0])) {
    const volId = `vol-${volumeNo}`;
    const parts: CampbellPart[] = [];

    for (const [partLabel, chapterEntries] of partMap.entries()) {
      const pid = partId(volumeNo, partLabel);
      const chapters: CampbellChapter[] = chapterEntries
        .sort((a, b) => a.chapter - b.chapter)
        .map((e) => ({
          id: chapterId(e.chapter),
          chapterNo: e.chapter,
          title: e.title,
          startPage: e.start_page,
          endPage: e.end_page,
          partId: pid,
          volumeId: volId,
        }));

      parts.push({ id: pid, label: partLabel, volumeId: volId, chapters });
    }

    volumes.push({
      id: volId,
      label: `Volume ${volumeNo}`,
      volumeNo,
      parts,
    });
  }

  return volumes;
}

const VOLUMES: CampbellVolume[] = buildHierarchy();

export function getCampbellVolumes(): CampbellVolume[] {
  return VOLUMES;
}

export function getPartsByVolumeIds(volumeIds: string[]): CampbellPart[] {
  if (volumeIds.length === 0) {
    return VOLUMES.flatMap((v) => v.parts);
  }
  const idSet = new Set(volumeIds);
  return VOLUMES.filter((v) => idSet.has(v.id)).flatMap((v) => v.parts);
}

export function getChaptersByPartIds(partIds: string[]): CampbellChapter[] {
  if (partIds.length === 0) {
    return VOLUMES.flatMap((v) => v.parts.flatMap((p) => p.chapters));
  }
  const idSet = new Set(partIds);
  return VOLUMES.flatMap((v) =>
    v.parts.filter((p) => idSet.has(p.id)).flatMap((p) => p.chapters)
  );
}

export function getAllIncludedChapters(): CampbellChapter[] {
  return VOLUMES.flatMap((v) => v.parts.flatMap((p) => p.chapters));
}

export function getCampbellChapterById(id: string): CampbellChapter | undefined {
  for (const vol of VOLUMES) {
    for (const part of vol.parts) {
      const ch = part.chapters.find((c) => c.id === id);
      if (ch) return ch;
    }
  }
  return undefined;
}

export function getCampbellChaptersByIds(ids: string[]): CampbellChapter[] {
  const idSet = new Set(ids);
  return getAllIncludedChapters().filter((c) => idSet.has(c.id));
}

/** Count chapters matching a selection. Used for pool size estimation. */
export function computeCampbellPoolSize(
  selectedVolumeIds: string[],
  selectedPartIds: string[],
  selectedChapterIds: string[],
): number {
  // If specific chapters are chosen, count them
  if (selectedChapterIds.length > 0) {
    return selectedChapterIds.length;
  }
  // If parts are chosen, count their chapters
  if (selectedPartIds.length > 0) {
    return getChaptersByPartIds(selectedPartIds).length;
  }
  // If volumes are chosen, count their chapters
  if (selectedVolumeIds.length > 0) {
    return getPartsByVolumeIds(selectedVolumeIds).flatMap((p) => p.chapters).length;
  }
  // No selection = all chapters
  return getAllIncludedChapters().length;
}

/** Return chapter count for a single part (for display in UI). */
export function getChapterCountForPart(partId: string): number {
  return getChaptersByPartIds([partId]).length;
}

/** Return chapter count for a single volume. */
export function getChapterCountForVolume(volumeId: string): number {
  return getPartsByVolumeIds([volumeId]).flatMap((p) => p.chapters).length;
}

/** Return all chapter IDs resolved from a selection (chapters > parts > volumes > all). */
export function resolveChapterIds(
  selectedVolumeIds: string[],
  selectedPartIds: string[],
  selectedChapterIds: string[],
): string[] {
  if (selectedChapterIds.length > 0) return selectedChapterIds;
  if (selectedPartIds.length > 0) return getChaptersByPartIds(selectedPartIds).map((c) => c.id);
  if (selectedVolumeIds.length > 0) {
    return getPartsByVolumeIds(selectedVolumeIds).flatMap((p) => p.chapters).map((c) => c.id);
  }
  return getAllIncludedChapters().map((c) => c.id);
}

/** Return chapter metadata by hierarchy ID ("ch-N"). */
export function getChapterMeta(id: string): CampbellChapter | undefined {
  return getCampbellChapterById(id);
}

/** Return the part that contains a given chapter ID. */
export function getPartForChapter(chapterId: string): CampbellPart | undefined {
  for (const vol of VOLUMES) {
    for (const part of vol.parts) {
      if (part.chapters.some((c) => c.id === chapterId)) return part;
    }
  }
  return undefined;
}

/** Return the volume that contains a given chapter ID. */
export function getVolumeForChapter(chapterId: string): CampbellVolume | undefined {
  for (const vol of VOLUMES) {
    for (const part of vol.parts) {
      if (part.chapters.some((c) => c.id === chapterId)) return vol;
    }
  }
  return undefined;
}

/** Return all parts (flat). */
export function getCampbellParts(): CampbellPart[] {
  return VOLUMES.flatMap((v) => v.parts);
}

/** Return all chapters (flat, sorted by chapterNo). */
export function getCampbellChapters(): CampbellChapter[] {
  return getAllIncludedChapters().sort((a, b) => a.chapterNo - b.chapterNo);
}
