export interface Flashcard {
  id: string;
  front: string;
  back: string;
  tags?: string[];
  difficulty?: "easy" | "medium" | "hard";
  created_at: string;
  updated_at?: string;
  next_review?: string;
  interval?: number;
  ease_factor?: number;
  review_count?: number;
}

export interface Question {
  id: string;
  type: "multiple_choice" | "true_false" | "short_answer";
  stem: string;
  options?: { key: string; text: string }[];
  correct_answer: string | string[];
  explanation?: string;
  tags?: string[];
  difficulty?: "easy" | "medium" | "hard";
  created_at: string;
}

export interface Notebook {
  id: string;
  title: string;
  description?: string;
  created_at: string;
  updated_at?: string;
  chunks: NoteChunk[];
}

export interface NoteChunk {
  id: string;
  notebook_id: string;
  order: number;
  content: string;
  content_type: "text" | "html" | "markdown";
}

export interface ImportBundle {
  format: "uro-omega.import";
  version: 1;
  meta: {
    bundle_id: string;
    title: string;
    language: string;
    created_at: string;
    author?: string;
    tags?: string[];
  };
  notebooks?: Notebook[];
  note_chunks?: NoteChunk[];
  questions?: Question[];
  flashcards?: Flashcard[];
}

export interface ImportResult {
  success: boolean;
  imported: {
    flashcards: number;
    questions: number;
    notebooks: number;
  };
  errors: string[];
}
