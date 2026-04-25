import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const key = process.env.XAI_API_KEY;
  if (!key) return NextResponse.json({ error: "Missing XAI_API_KEY" }, { status: 500 });

  const r = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "grok-2", // اگر خطای model گرفتی، بعداً تغییر می‌دیم
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 800,
    }),
  });

  const text = await r.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  return NextResponse.json({ ok: r.ok, status: r.status, data }, { status: r.ok ? 200 : r.status });
}