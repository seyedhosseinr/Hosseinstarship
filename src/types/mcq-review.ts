export type McqReviewHighlight = {
  quote: string;
  kind: "highlight" | "underline";
  note?: string | null;
};

export type McqOptionReview = {
  optionKey: string;
  title: string;
  why: string;
  discriminator?: string | null;
  trapType?: string | null;
  linkedSourceBlockIds?: string[] | null;
  highlights?: McqReviewHighlight[] | null;
};

export type McqAmbossReview = {
  keyTeachingPoint: string;
  stemHighlights: McqReviewHighlight[];
  optionReviews: McqOptionReview[];
  takeHomeMessages: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

export function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (isRecord(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function isMcqReviewHighlight(value: unknown): value is McqReviewHighlight {
  if (!isRecord(value)) return false;
  return (
    typeof value.quote === "string" &&
    (value.kind === "highlight" || value.kind === "underline") &&
    (value.note == null || typeof value.note === "string")
  );
}

export function isMcqOptionReview(value: unknown): value is McqOptionReview {
  if (!isRecord(value)) return false;
  return (
    typeof value.optionKey === "string" &&
    typeof value.title === "string" &&
    typeof value.why === "string" &&
    (value.discriminator == null || typeof value.discriminator === "string") &&
    (value.trapType == null || typeof value.trapType === "string") &&
    (value.linkedSourceBlockIds == null || isStringArray(value.linkedSourceBlockIds)) &&
    (value.highlights == null || (Array.isArray(value.highlights) && value.highlights.every(isMcqReviewHighlight)))
  );
}

export function isMcqAmbossReview(value: unknown): value is McqAmbossReview {
  if (!isRecord(value)) return false;
  return (
    typeof value.keyTeachingPoint === "string" &&
    Array.isArray(value.stemHighlights) &&
    value.stemHighlights.every(isMcqReviewHighlight) &&
    Array.isArray(value.optionReviews) &&
    value.optionReviews.every(isMcqOptionReview) &&
    isStringArray(value.takeHomeMessages)
  );
}

export function getMcqAmbossReviewFromSourceJson(value: unknown): McqAmbossReview | null {
  const sourceJson = parseJsonObject(value);
  if (!sourceJson) return null;
  return isMcqAmbossReview(sourceJson.review) ? sourceJson.review : null;
}
