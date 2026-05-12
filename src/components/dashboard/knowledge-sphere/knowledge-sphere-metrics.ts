import type { KnowledgeNodeStatus } from "./knowledge-sphere.types";

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function normalizePercent(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return clampScore(value <= 1 ? value * 100 : value);
}

export function weightedAverage(
  parts: Array<{ value: number | null | undefined; weight: number }>
): number {
  const available = parts.filter(
    (part) => typeof part.value === "number" && Number.isFinite(part.value) && part.weight > 0
  );

  const totalWeight = available.reduce((sum, part) => sum + part.weight, 0);
  if (totalWeight <= 0) return 0;

  return clampScore(
    available.reduce((sum, part) => sum + (part.value as number) * part.weight, 0) /
      totalWeight
  );
}

export function getMcqScore(input: {
  total: number;
  correct: number;
}): number | null {
  if (input.total <= 0) return null;

  const rawAccuracy = (input.correct / input.total) * 100;

  // Prevent 1-2 lucky correct answers from looking like mastery.
  const sampleConfidence = Math.min(1, input.total / 20);
  const lowSamplePenalty = 0.72 + sampleConfidence * 0.28;

  return clampScore(rawAccuracy * sampleConfidence * lowSamplePenalty);
}

export function getMcqAccuracy(input: {
  total: number;
  correct: number;
}): number | null {
  if (input.total <= 0) return null;
  return clampScore((input.correct / input.total) * 100);
}

export function getFlashcardScore(input: {
  total: number;
  due: number;
  retention?: number | null;
  averageRetrievability?: number | null;
}): number | null {
  const retrievability = normalizePercent(input.averageRetrievability);
  if (retrievability !== null) return retrievability;

  const retention = normalizePercent(input.retention);
  if (retention !== null) return retention;

  if (input.total <= 0) return null;

  const duePressure = Math.min(100, (input.due / input.total) * 100);
  return clampScore(100 - duePressure);
}

export function getReaderScore(input: {
  totalFrames: number;
  openedFrames: number;
}): number | null {
  if (input.totalFrames <= 0) return null;
  return clampScore((input.openedFrames / input.totalFrames) * 100);
}

export function getRecencyScore(daysSinceLastStudy: number | null): number | null {
  if (daysSinceLastStudy === null) return null;
  if (daysSinceLastStudy <= 1) return 100;
  if (daysSinceLastStudy <= 3) return 80;
  if (daysSinceLastStudy <= 7) return 60;
  if (daysSinceLastStudy <= 14) return 35;
  return 15;
}

export function getMasteryScore(input: {
  mcqScore: number | null;
  flashcardScore: number | null;
  readerScore: number | null;
  recencyScore: number | null;
}): number {
  return weightedAverage([
    { value: input.mcqScore, weight: 0.35 },
    { value: input.flashcardScore, weight: 0.30 },
    { value: input.readerScore, weight: 0.20 },
    { value: input.recencyScore, weight: 0.15 },
  ]);
}

export function getPriorityScore(input: {
  mastery: number;
  dueFlashcardCount: number;
  flashcardCount: number;
  highYieldWeight: number;
  daysSinceLastStudy: number | null;
  mcqCount: number;
  flashcardCountTotal: number;
  readerFrameCount?: number;
}): number {
  const highYield = clampUnit(input.highYieldWeight);
  const weaknessPressure = 100 - input.mastery;

  const duePressure =
    input.flashcardCount > 0
      ? Math.min(100, (input.dueFlashcardCount / input.flashcardCount) * 100)
      : 0;

  const recencyPressure =
    input.daysSinceLastStudy === null
      ? 20
      : input.daysSinceLastStudy <= 3
        ? 10
        : input.daysSinceLastStudy <= 7
          ? 35
          : input.daysSinceLastStudy <= 14
            ? 60
            : 85;

  const volume = input.mcqCount + input.flashcardCountTotal + (input.readerFrameCount ?? 0) / 4;
  const volumePressure = Math.min(100, volume * 2);

  // High-yield should amplify actual weakness/due pressure, not create a false alarm alone.
  const yieldAmplifiedWeakness = weaknessPressure * (0.78 + highYield * 0.22);
  const yieldAmplifiedDue = duePressure * (0.86 + highYield * 0.14);

  return clampScore(
    0.40 * yieldAmplifiedWeakness +
      0.28 * yieldAmplifiedDue +
      0.14 * recencyPressure +
      0.10 * volumePressure +
      0.08 * highYield * Math.max(weaknessPressure, duePressure)
  );
}

export function getConfidenceScore(input: {
  mcqCount: number;
  flashcardCount: number;
  readerFrameCount: number;
  hasRecency: boolean;
}): number {
  const mcqConfidence = Math.min(100, (input.mcqCount / 20) * 100);
  const flashcardConfidence = Math.min(100, (input.flashcardCount / 30) * 100);
  const readerConfidence = Math.min(100, (input.readerFrameCount / 20) * 100);
  const recencyConfidence = input.hasRecency ? 60 : null;

  return weightedAverage([
    { value: input.mcqCount > 0 ? mcqConfidence : null, weight: 0.35 },
    { value: input.flashcardCount > 0 ? flashcardConfidence : null, weight: 0.30 },
    { value: input.readerFrameCount > 0 ? readerConfidence : null, weight: 0.20 },
    { value: recencyConfidence, weight: 0.15 },
  ]);
}

export function getKnowledgeStatus(input: {
  hasRealSignal: boolean;
  mastery: number;
  confidence: number;
  priorityScore: number;
  dueFlashcardCount: number;
}): KnowledgeNodeStatus {
  if (!input.hasRealSignal || input.confidence < 20) return "unknown";
  if (input.priorityScore >= 78 || input.mastery < 35) return "critical";
  if (input.mastery < 50) return "weak";
  if (input.mastery < 70 || input.dueFlashcardCount > 0) return "needs_review";
  if (input.mastery < 85) return "stable";
  return "mastered";
}

export function getStatusColorToken(status: KnowledgeNodeStatus): string {
  switch (status) {
    case "mastered":
      return "var(--ks-mastered)";
    case "stable":
      return "var(--ks-stable)";
    case "needs_review":
      return "var(--ks-needs-review)";
    case "weak":
      return "var(--ks-weak)";
    case "critical":
      return "var(--ks-critical)";
    case "unknown":
    default:
      return "var(--ks-unknown)";
  }
}

export function getEstimatedReviewMinutes(input: {
  dueFlashcardCount: number;
  wrongMcqCount: number;
  readerCoverage: number;
  hasRealSignal: boolean;
}): number {
  if (!input.hasRealSignal) return 0;
  const flashcardMinutes = Math.ceil(input.dueFlashcardCount * 0.45);
  const wrongMcqMinutes = Math.ceil(input.wrongMcqCount * 2.5);
  const readerMinutes = input.readerCoverage < 60 ? 8 : 0;
  return Math.max(5, flashcardMinutes + wrongMcqMinutes + readerMinutes);
}

export function daysBetweenNow(dateIso: string | null, now = new Date()): number | null {
  if (!dateIso) return null;
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = now.getTime() - date.getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

export function latestIsoDate(values: Array<string | null | undefined>): string | null {
  const timestamps = values
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) return null;

  return new Date(Math.max(...timestamps)).toISOString();
}
