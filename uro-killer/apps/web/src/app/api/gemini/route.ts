import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const apiKey = 'AIzaSyDbVpBCWEkUQYi5_6IMekPiPz3Nedt-Gio';

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: body.messages?.[0]?.content || body.prompt || "Hi" }]
          }]
        }),
      }
    );

    const data = await response.json();

    return NextResponse.json({
      success: true,
      gemini_response: data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response'
    });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}