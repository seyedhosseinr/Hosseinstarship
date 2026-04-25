import type { FlashcardItem, NoteItem, QuestionItem } from "./types";

type RequestInitWithBody = RequestInit & {
  body?: BodyInit | null;
};

async function request<T>(url: string, init?: RequestInitWithBody): Promise<T> {
  const response = await fetch(`/api${url}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function createCrudApi<T>(basePath: string) {
  return {
    getAll: () => request<T[]>(basePath),
    deleteMany: (ids: string[]) =>
      request<{ deleted?: number; success?: boolean }>(basePath, {
        method: "DELETE",
        body: JSON.stringify({ ids }),
      }),
  };
}

export const notesApi = createCrudApi<NoteItem>("/notes");
export const flashcardsApi = createCrudApi<FlashcardItem>("/flashcards");
export const questionsApi = createCrudApi<QuestionItem>("/questions");

export const importApi = {
  import: (type: string, data: unknown[]) =>
    request<{ total: number; imported: number; skipped: number }>(`/import/${type}`, {
      method: "POST",
      body: JSON.stringify({ data }),
    }),
};
