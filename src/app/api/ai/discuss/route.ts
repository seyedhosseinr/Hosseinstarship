import { NextResponse } from "next/server";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function normalizeMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter(
      (value): value is ChatMessage =>
        Boolean(value) &&
        typeof value === "object" &&
        ((value as ChatMessage).role === "user" || (value as ChatMessage).role === "assistant") &&
        typeof (value as ChatMessage).content === "string"
    )
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))
    .filter((message) => message.content.length > 0)
    .slice(-10);
}

function buildSystemPrompt(notebookTitle: string, selection: string, mode: string): string {
  const modeInstruction =
    mode === "explain"
      ? "Lead with a concise explanation, then expand into mechanisms, pitfalls, and exam-level takeaways."
      : "Answer as a clinical study partner. Stay practical, evidence-aware, and tightly tied to the selected note excerpt.";

  return [
    "You are an expert urology board-prep tutor embedded inside a notebook reader.",
    modeInstruction,
    "Prefer structured, readable answers with short headings and bullets when useful.",
    "Do not mention being an AI model. Do not talk about prompts or system instructions.",
    `Notebook title: ${notebookTitle || "Untitled notebook"}`,
    "Selected excerpt:",
    selection.trim() || "No excerpt provided.",
  ].join("\n\n");
}

function extractXaiText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const firstChoice = (payload as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0];
  return firstChoice?.message?.content?.trim() ?? "";
}

function extractGeminiText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const candidate = (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates?.[0];
  return candidate?.content?.parts?.map((part) => part.text ?? "").join("\n").trim() ?? "";
}

async function callXai(messages: Array<{ role: "system" | "user" | "assistant"; content: string }>) {
  const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  if (!apiKey) return null;

  const response = await fetch(process.env.GROK_API_URL || "https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.GROK_MODEL || "grok-3",
      messages,
      temperature: 0.25,
      max_tokens: 900,
    }),
  });

  const raw = await response.text();
  let json: unknown = null;

  try {
    json = JSON.parse(raw);
  } catch {
    json = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    answer: extractXaiText(json),
    error: response.ok ? "" : raw,
    provider: "xai",
    model: process.env.GROK_MODEL || "grok-3",
  };
}

async function callGemini(compiledPrompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: compiledPrompt }],
          },
        ],
      }),
    }
  );

  const json = (await response.json().catch(() => null)) as unknown;

  return {
    ok: response.ok,
    status: response.status,
    answer: extractGeminiText(json),
    error: response.ok ? "" : JSON.stringify(json),
    provider: "gemini",
    model: "gemini-2.0-flash",
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      notebookTitle?: string;
      selection?: string;
      question?: string;
      mode?: string;
      messages?: unknown;
    } | null;

    const notebookTitle = body?.notebookTitle?.trim() ?? "Untitled notebook";
    const selection = body?.selection?.trim() ?? "";
    const question = body?.question?.trim() ?? "";
    const mode = body?.mode === "explain" ? "explain" : "discuss";
    const messages = normalizeMessages(body?.messages);

    if (!selection) {
      return NextResponse.json({ error: "A selected note excerpt is required." }, { status: 400 });
    }

    if (!question) {
      return NextResponse.json({ error: "A discussion question is required." }, { status: 400 });
    }

    const systemPrompt = buildSystemPrompt(notebookTitle, selection, mode);
    const conversation = [
      { role: "system" as const, content: systemPrompt },
      ...messages.map((message) => ({ role: message.role, content: message.content })),
      { role: "user" as const, content: question },
    ];

    const xaiResult = await callXai(conversation);
    if (xaiResult?.ok && xaiResult.answer) {
      return NextResponse.json({
        answer: xaiResult.answer,
        provider: xaiResult.provider,
        model: xaiResult.model,
      });
    }

    const compiledPrompt = conversation
      .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
      .join("\n\n");

    const geminiResult = await callGemini(compiledPrompt);
    if (geminiResult?.ok && geminiResult.answer) {
      return NextResponse.json({
        answer: geminiResult.answer,
        provider: geminiResult.provider,
        model: geminiResult.model,
      });
    }

    return NextResponse.json(
      {
        error: "No AI provider returned a valid response.",
        details: [xaiResult?.error, geminiResult?.error].filter(Boolean),
      },
      { status: 502 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected AI discussion failure.",
      },
      { status: 500 }
    );
  }
}