/**
 * Groups a list of File objects by filename prefix + content kind
 * using the chapter-aware filename convention.
 *
 * Files that do not match the convention are returned as `ungrouped`
 * and MUST be imported normally without any error.
 */

import {
  parseChapterFilename,
  type ContentKind,
  type ParsedChapterFile,
} from "./chapter-filename-parser";

export type { ContentKind };

export interface ChapterGroup {
  chapterNo: number;
  contentKind: ContentKind;
  filenamePrefix: string;
  /** Segments sorted by segmentNo ascending (numeric, not lexicographic). */
  segments: Array<{ file: File; parsed: ParsedChapterFile }>;
}

export function groupFilesByChapter(files: File[]): {
  groups: ChapterGroup[];
  ungrouped: File[];
} {
  const groupMap = new Map<string, ChapterGroup>();
  const ungrouped: File[] = [];

  for (const file of files) {
    const parsed = parseChapterFilename(file.name);
    if (!parsed) {
      ungrouped.push(file);
      continue;
    }

    // Extract prefix from filename (everything before segment number)
    const prefix = file.name.match(/^(.+?)_\d+/)?.[1] || `${parsed.chapterNo}`;
    const key = `${prefix}__${parsed.contentKind}`;
    let group = groupMap.get(key);
    if (!group) {
      group = {
        chapterNo: parsed.chapterNo,
        contentKind: parsed.contentKind,
        filenamePrefix: prefix,
        segments: [],
      };
      groupMap.set(key, group);
    }
    group.segments.push({ file, parsed });
  }

  // Sort each group's segments numerically by segmentNo
  const groups = Array.from(groupMap.values()).map((g) => ({
    ...g,
    segments: [...g.segments].sort(
      (a, b) => a.parsed.segmentNo - b.parsed.segmentNo,
    ),
  }));

  // Sort groups by prefix then contentKind for deterministic output
  groups.sort((a, b) => {
    if (a.filenamePrefix !== b.filenamePrefix) 
      return a.filenamePrefix.localeCompare(b.filenamePrefix);
    return a.contentKind.localeCompare(b.contentKind);
  });

  return { groups, ungrouped };
}
