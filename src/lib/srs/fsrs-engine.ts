import {
  FSRS,
  State,
  type Card,
  type RecordLog,
  type RecordLogItem,
  type FSRSParameters,
  generatorParameters,
  createEmptyCard,
} from "ts-fsrs";

export type FsrsMode = "normal" | "medical" | "exam_crunch";
export type FsrsGrade = 1 | 2 | 3 | 4;

export const Rating = {
  Again: 1 as FsrsGrade,
  Hard: 2 as FsrsGrade,
  Good: 3 as FsrsGrade,
  Easy: 4 as FsrsGrade,
} as const;

const DEFAULT_PARAMS = generatorParameters();

const MEDICAL_PARAMS: FSRSParameters = {
  ...DEFAULT_PARAMS,
  request_retention: 0.92,
  maximum_interval: 180,
  enable_fuzz: true,
  enable_short_term: true,
};

const EXAM_CRUNCH_PARAMS: FSRSParameters = {
  ...DEFAULT_PARAMS,
  request_retention: 0.95,
  maximum_interval: 30,
  enable_fuzz: false,
  enable_short_term: true,
};

function paramsForMode(mode: FsrsMode): FSRSParameters {
  if (mode === "exam_crunch") return EXAM_CRUNCH_PARAMS;
  if (mode === "medical") return MEDICAL_PARAMS;
  return DEFAULT_PARAMS;
}

function ratingKey(rating: FsrsGrade) {
  switch (rating) {
    case Rating.Again:
      return "again";
    case Rating.Hard:
      return "hard";
    case Rating.Good:
      return "good";
    case Rating.Easy:
      return "easy";
    default:
      return "good";
  }
}

export class FSRSEngine {
  private fsrs: FSRS;
  private mode: FsrsMode;

  constructor(mode: FsrsMode = "medical") {
    this.mode = mode;
    this.fsrs = new FSRS(paramsForMode(mode));
  }

  createCard(now: Date = new Date()): Card {
    return createEmptyCard(now);
  }

  review(card: Card, rating: FsrsGrade, now: Date = new Date()): RecordLogItem {
    return this.fsrs.next(card, now, rating);
  }

  previewAll(card: Card, now: Date = new Date()): RecordLog {
    return this.fsrs.repeat(card, now);
  }

  getRetrievability(card: Card, now: Date = new Date()): number {
    if (card.state === State.New) return 1;
    return this.fsrs.get_retrievability(card, now, false);
  }

  formatInterval(card: Card): string {
    const days = card.scheduled_days;
    if (days < 1) return `${Math.max(1, Math.round(days * 24 * 60))}m`;
    if (days < 30) return `${Math.round(days)}d`;
    if (days < 365) return `${(days / 30).toFixed(1)}mo`;
    return `${(days / 365).toFixed(1)}y`;
  }

  getPredictions(card: Card, now: Date = new Date()) {
    const results = this.previewAll(card, now);
    return {
      again: {
        interval: this.formatInterval(results[Rating.Again].card),
        days: results[Rating.Again].card.scheduled_days,
      },
      hard: {
        interval: this.formatInterval(results[Rating.Hard].card),
        days: results[Rating.Hard].card.scheduled_days,
      },
      good: {
        interval: this.formatInterval(results[Rating.Good].card),
        days: results[Rating.Good].card.scheduled_days,
      },
      easy: {
        interval: this.formatInterval(results[Rating.Easy].card),
        days: results[Rating.Easy].card.scheduled_days,
      },
    };
  }

  describePredictions(card: Card, now: Date = new Date()) {
    const results = this.previewAll(card, now);
    return [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].map((rating) => {
      const preview = results[rating];
      return {
        rating,
        key: ratingKey(rating),
        card: preview.card,
        interval: this.formatInterval(preview.card),
        days: preview.card.scheduled_days,
      };
    });
  }

  setMode(mode: FsrsMode) {
    this.mode = mode;
    this.fsrs = new FSRS(paramsForMode(mode));
  }

  getMode() {
    return this.mode;
  }
}

export function createFsrsEngine(mode: FsrsMode = "medical") {
  return new FSRSEngine(mode);
}

export const fsrsEngine = new FSRSEngine("medical");
export { State };
export type { Card, RecordLog, RecordLogItem, FSRSParameters };
