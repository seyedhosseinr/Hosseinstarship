export type ContentSourceType = 'pdf' | 'json' | 'csv' | 'docx' | 'markdown' | 'manual' | 'api';

export interface ContentSource {
  id: string;
  type: ContentSourceType;
  name: string;
  fileName?: string;
  importedAt: Date;
  totalItems: number;
  metadata?: Record<string, any>;
}

export type CardType = 'basic' | 'mcq' | 'cloze' | 'image-occlusion' | 'type-answer';

export interface FlashCard {
  id: string;
  sourceId: string;
  sourceItemId?: string;
  type: CardType;
  front: string;
  back: string;
  options?: { [key: string]: string; };
  correctAnswer?: string;
  explanation?: string;
  imageUrl?: string;
  occlusionAreas?: OcclusionArea[];
  tags: string[];
  chapter?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  srsData: SRSCardData;
  createdAt: Date;
  updatedAt: Date;
}

export interface OcclusionArea {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export interface SRSCardData {
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: 'new' | 'learning' | 'review' | 'relearning';
  lastReview?: Date;
  nextReview: Date;
  retrievability?: number;
}

export interface ReviewSession {
  id: string;
  startedAt: Date;
  endedAt?: Date;
  totalCards: number;
  reviewed: number;
  correct: number;
  incorrect: number;
  ratings: { again: number; hard: number; good: number; easy: number; };
  sourceIds?: string[];
  tags?: string[];
}

export interface ReviewLog {
  id: string;
  cardId: string;
  sessionId: string;
  rating: ReviewRating;
  reviewedAt: Date;
  previousState: SRSCardData;
  newState: SRSCardData;
  responseTime?: number;
}

export interface ImportResultSRS {
  success: boolean;
  sourceId: string;
  totalItems: number;
  importedItems: number;
  skippedItems: number;
  errors: ImportError[];
}

export interface ImportError {
  itemIndex: number;
  message: string;
  rawData?: any;
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'anki';
  includeStats: boolean;
  sourceIds?: string[];
  tags?: string[];
}

export interface DailyStats {
  date: string;
  newCards: number;
  reviewedCards: number;
  totalTime: number;
  retention: number;
  streak: number;
  bySource: { [sourceId: string]: { reviewed: number; correct: number; }; };
}

export interface SRSSettings {
  newCardsPerDay: number;
  reviewsPerDay: number;
  learningSteps: number[];
  relearningSteps: number[];
  requestRetention: number;
  maximumInterval: number;
  showTimer: boolean;
  autoPlayAudio: boolean;
  flipAnimation: boolean;
}
