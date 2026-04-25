const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export async function fetcher<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || `API Error: ${res.status}`);
  }

  return res.json();
}

export async function grokFetcher<T>(endpoint: string, body: any): Promise<T> {
  return fetcher<T>(endpoint, {
    method: "POST",
    body: JSON.stringify(body),
  });
}