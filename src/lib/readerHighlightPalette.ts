export type ReaderHighlightColorId =
  | "yellow"
  | "blue"
  | "green"
  | "pink"
  | "purple"
  | "orange";

export type ReaderHighlightColor = {
  id: ReaderHighlightColorId;
  label: string;
  semantic: string;
  storage: `#${string}`;
  swatch: string;
  background: string;
  underline: `#${string}`;
};

export const READER_HIGHLIGHT_COLORS: readonly ReaderHighlightColor[] = [
  {
    id: "yellow",
    label: "Important",
    semantic: "Important",
    storage: "#FFE566",
    swatch: "rgba(246, 229, 141, 0.90)",
    background: "rgba(246, 229, 141, 0.45)",
    underline: "#D4B106",
  },
  {
    id: "blue",
    label: "Board fact",
    semantic: "Board fact",
    storage: "#90C8FF",
    swatch: "rgba(169, 214, 255, 0.90)",
    background: "rgba(169, 214, 255, 0.42)",
    underline: "#4B9BFF",
  },
  {
    id: "green",
    label: "Understood",
    semantic: "Understood",
    storage: "#8EDFC5",
    swatch: "rgba(184, 230, 193, 0.90)",
    background: "rgba(184, 230, 193, 0.42)",
    underline: "#57B26A",
  },
  {
    id: "pink",
    label: "Mistake",
    semantic: "Mistake",
    storage: "#FFB3C8",
    swatch: "rgba(247, 183, 210, 0.90)",
    background: "rgba(247, 183, 210, 0.42)",
    underline: "#D96AA0",
  },
  {
    id: "purple",
    label: "Flashcard-worthy",
    semantic: "Flashcard-worthy",
    storage: "#C8AAFF",
    swatch: "rgba(214, 194, 242, 0.90)",
    background: "rgba(214, 194, 242, 0.40)",
    underline: "#8A63D2",
  },
  {
    id: "orange",
    label: "Decision / warning",
    semantic: "Decision / warning",
    storage: "#FFCB8C",
    swatch: "rgba(246, 194, 139, 0.90)",
    background: "rgba(246, 194, 139, 0.40)",
    underline: "#D9893D",
  },
] as const;

export const DEFAULT_READER_HIGHLIGHT_COLOR =
  READER_HIGHLIGHT_COLORS[0].storage;

const COLORS_BY_STORAGE = new Map<string, ReaderHighlightColor>(
  READER_HIGHLIGHT_COLORS.map((color) => [color.storage.toUpperCase(), color]),
);

const COLORS_BY_ID = new Map<string, ReaderHighlightColor>(
  READER_HIGHLIGHT_COLORS.map((color) => [color.id, color]),
);

function parseStoredColor(value: string | null | undefined): `#${string}` | null {
  if (!value) return null;

  const raw = value.trim();
  if (!raw) return null;

  const byId = COLORS_BY_ID.get(raw.toLowerCase());
  if (byId) return byId.storage;

  const hex = raw.replace(/^#/, "").toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(hex)) return null;

  const normalized = `#${hex}` as `#${string}`;
  return COLORS_BY_STORAGE.has(normalized) ? normalized : null;
}

export function normalizeHighlightColor(
  color: string | null | undefined,
): `#${string}` {
  return parseStoredColor(color) ?? DEFAULT_READER_HIGHLIGHT_COLOR;
}

export function getHighlightBucketKey(
  color: string | null | undefined,
): string {
  return normalizeHighlightColor(color).replace(/^#/, "");
}

export function getReaderHighlightColor(
  color: string | null | undefined,
): ReaderHighlightColor {
  return (
    COLORS_BY_STORAGE.get(normalizeHighlightColor(color)) ??
    READER_HIGHLIGHT_COLORS[0]
  );
}

export function getHighlightBackground(
  color: string | null | undefined,
): string {
  return getReaderHighlightColor(color).background;
}

export function getHighlightUnderlineColor(
  color: string | null | undefined,
): `#${string}` {
  return getReaderHighlightColor(color).underline;
}
