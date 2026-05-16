import type { AlgorithmIR, AlgorithmRecord, AlgorithmSurface } from "@/types/algorithm-ir";

const TECHNICAL_LABEL_PATTERN = /(^|[\s_-])(?:s\d+|segment[_-]?\d+|file[_-]?\d+|\d{2,3}[_-]\d{1,3}(?:[_-]s?\d+)?|[a-f0-9]{8,})(?:$|[\s_-])/i;

function cleanTechnical(value: string): string {
  return value
    .replace(/algorithm[_-]?ir[_-]?/gi, "")
    .replace(/segment[_-]?/gi, "")
    .replace(/file[_-]?/gi, "")
    .replace(/[_-]+/g, " ")
    .replace(/\bs\d+\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isTechnicalLabel(value: string | null | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (TECHNICAL_LABEL_PATTERN.test(trimmed)) return true;
  return /^[\d\s._-]+$/.test(trimmed);
}

function readableTitle(value: string | null | undefined): string | null {
  if (!value || isTechnicalLabel(value)) return null;
  const cleaned = cleanTechnical(value);
  return cleaned && !isTechnicalLabel(cleaned) ? cleaned : null;
}

function pickString(record: unknown, keys: string[]): string | null {
  if (!record || typeof record !== "object") return null;
  const obj = record as Record<string, unknown>;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value)) {
      const hit = value.find((item): item is string => typeof item === "string" && item.trim().length > 0);
      if (hit) return hit.trim();
    }
  }
  return null;
}

export function algorithmDisplayTitle(surface: AlgorithmSurface | null | undefined, index?: number): string {
  if (!surface) return "Untitled clinical algorithm";
  const direct = readableTitle(pickString(surface, ["algorithmTitle", "surfaceTitle", "displayTitle", "title"]));
  if (direct) return direct;
  const clinical = readableTitle(pickString(surface, ["clinicalQuestion", "heading", "sectionTitle", "frameTitle"]));
  if (clinical) return clinical;
  const heading = surface.sourceSectionHeadings?.map(readableTitle).find(Boolean);
  if (heading) return heading;
  return `Algorithm pathway ${(index ?? 0) + 1}`;
}

export function algorithmTypeLabel(surface: AlgorithmSurface | null | undefined): string {
  const raw = surface?.semanticRole || surface?.surfaceType || surface?.algorithmShape || "clinical pathway";
  return cleanTechnical(raw).replace(/\b\w/g, (m) => m.toUpperCase());
}

export function nodeDisplayTitle(node: AlgorithmRecord | null | undefined): string | null {
  if (!node) return null;
  return readableTitle(pickString(node, ["title", "label", "detail", "prompt", "condition", "decision"]));
}

export function surfaceSearchText(surface: AlgorithmSurface, _index?: number): string {
  return [
    algorithmDisplayTitle(surface),
    surface.clinicalQuestion,
    surface.semanticRole,
    surface.surfaceType,
    ...(surface.sourceSectionHeadings ?? []),
    ...(surface.nodes ?? []).map(nodeDisplayTitle),
    ...(surface.boardTraps ?? []).map((trap) => pickString(trap, ["trapTitle", "wrongPath", "correctPath"])),
    ...(surface.gates ?? []).map((gate) => pickString(gate, ["title", "entryCondition", "actionIfPass"])),
    ...(surface.thresholds ?? []).map((threshold) => pickString(threshold, ["variable", "value", "conditionText"])),
    ...(surface.checkpoints ?? []).map((checkpoint) => pickString(checkpoint, ["prompt", "answer"])),
  ].filter(Boolean).join(" ").toLowerCase();
}

export interface SurfaceStats { checkpoints: number; traps: number; gates: number; matrices: number; thresholds: number }

export function surfaceStats(surface: AlgorithmSurface): SurfaceStats {
  return {
    checkpoints: surface.checkpoints?.length ?? 0,
    traps: surface.boardTraps?.length ?? 0,
    gates: surface.gates?.length ?? 0,
    matrices: surface.matrices?.length ?? 0,
    thresholds: surface.thresholds?.length ?? 0,
  };
}

export interface ChapterNavItem {
  key: string;
  label: string;
  title: string;
  algorithmCount: number;
  segments: Array<{ segmentId: string; title: string; chapterNo?: number | null }>;
  stats: SurfaceStats;
}

export function chapterDisplayFromIR(segmentId: string, ir: AlgorithmIR): { label: string; title: string } {
  const meta = ir.algorithmMeta as Record<string, unknown> | undefined;
  const source = ir.sourceNote as Record<string, unknown> | undefined;
  const chapterNo = pickString(meta, ["chapterNo", "chapterNumber", "chapterId"]) ?? pickString(source, ["chapterNo", "chapterNumber", "chapterId"]) ?? segmentId.match(/(\d{2,3})/)?.[1] ?? "";
  const title = readableTitle(pickString(meta, ["chapterTitle", "noteTitle", "title"]) ?? pickString(source, ["chapterTitle", "title"]));
  return { label: `Chapter ${chapterNo || "?"}${title ? ` — ${title}` : ""}`, title: title ?? "Clinical algorithms" };
}

export function aggregateSurfaceStats(surfaces: AlgorithmSurface[]): SurfaceStats {
  return surfaces.reduce((acc, surface) => {
    const stats = surfaceStats(surface);
    acc.checkpoints += stats.checkpoints;
    acc.traps += stats.traps;
    acc.gates += stats.gates;
    acc.matrices += stats.matrices;
    acc.thresholds += stats.thresholds;
    return acc;
  }, { checkpoints: 0, traps: 0, gates: 0, matrices: 0, thresholds: 0 });
}

export function buildChapterNavItems(rows: Array<{ segmentId: string; title?: string | null; chapterNo?: number | null; surfaceCount?: number }>): ChapterNavItem[] {
  const groups = new Map<string, ChapterNavItem>();
  for (const row of rows) {
    const chapterNo = row.chapterNo ?? Number(row.segmentId.match(/(\d{2,3})/)?.[1] ?? Number.NaN);
    const key = Number.isFinite(chapterNo) ? String(chapterNo) : "unknown";
    const title = readableTitle(row.title) ?? "Clinical algorithms";
    const label = `Chapter ${Number.isFinite(chapterNo) ? chapterNo : "?"}${title !== "Clinical algorithms" ? ` — ${title}` : ""}`;
    const existing = groups.get(key) ?? {
      key,
      label,
      title,
      algorithmCount: 0,
      segments: [],
      stats: { checkpoints: 0, traps: 0, gates: 0, matrices: 0, thresholds: 0 },
    };
    existing.segments.push({ segmentId: row.segmentId, title, chapterNo: row.chapterNo ?? null });
    existing.algorithmCount += Math.max(1, row.surfaceCount ?? 1);
    groups.set(key, existing);
  }
  return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}
