// uro-killer/apps/web/src/lib/types.ts
// Bridge file that exports and defines frontend types

// Re-export backend types
export type { Flashcard, Question, Notebook, NoteChunk, ImportBundle, ImportResult } from '../types/index';

/**
 * Note/Notebook Item
 */
export interface NoteItem {
  id: string;
  title: string;
  description?: string;
  content?: string;
  contentType?: 'text' | 'html' | 'markdown';
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
}

/**
 * Flashcard Item
 */
export interface FlashcardItem {
  id: string;
  front: string;
  back: string;
  tags?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  sourceHash?: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Question Item
 */
export interface QuestionItem {
  id: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer';
  stem: string;
  options?: string | any[];
  correct_answer?: string | string[];
  correctAnswer?: string | string[];
  explanation?: string;
  tags?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  sourceHash?: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Import Result
 */
export interface ImportResult {
  success: boolean;
  type: string;
  total: number;
  imported: number;
  skipped: number;
  errors?: { index: number; message: string }[];
  message: string;
}
