export type ImportHistoryEntry = {
  id: string;
  sourceName: string;
  sourceType: string;
  sourceVersion: string | null;
  schemaVersion: string;
  status: string;
  fileName: string | null;
  fileType: string | null;
  contentType: string | null;
  inputPath: string | null;
  itemCount: number;
  chunkCount: number;
  noteDocumentCount: number;
  questionCount: number;
  flashcardCount: number;
  examLinkedQuestionCount: number;
  errorMessage: string | null;
  startedAt: number | null;
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type ImportRunSummary = {
  importId: string;
  batchDirectory: string;
  runtime: "postgres" | "pglite";
  sourceName: string;
  totalItems: number;
  counts: {
    chunks: { inserted: number; updated: number };
    noteDocuments: { inserted: number; updated: number };
    questions: { inserted: number; updated: number };
    options: { inserted: number; updated: number };
    flashcards: { inserted: number; updated: number };
  };
};

export type ImportActionState = {
  ok: boolean;
  batchDirectory: string;
  runtime: "postgres" | "pglite";
  message: string | null;
  error: string | null;
  snapshotError: string | null;
  result: ImportRunSummary | null;
  history: ImportHistoryEntry[];
};
