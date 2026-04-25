import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { verifyPassword } from "@/lib/auth/password";
import {
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";

export const runtime = "nodejs";

type LoginBody = { password?: unknown };

/**
 * Verify the submitted password against STARSHIP_PASSWORD_HASH (preferred) or
 * APP_PASSWORD (legacy plaintext fallback for existing single-user setups).
 */
async function checkPassword(submitted: string): Promise<boolean> {
  const hash = process.env.STARSHIP_PASSWORD_HASH;
  if (hash && hash.startsWith("pbkdf2$")) {
    return verifyPassword(submitted, hash);
  }
  const plain = process.env.APP_PASSWORD;
  if (plain && plain.length > 0) {
    // Constant-time-ish compare. Plain-text fallback is intentionally
    // supported for single-user dev/bootstrapping; set STARSHIP_PASSWORD_HASH
    // for production.
    if (submitted.length !== plain.length) return false;
    let diff = 0;
    for (let i = 0; i < plain.length; i++) {
      diff |= plain.charCodeAt(i) ^ submitted.charCodeAt(i);
    }
    return diff === 0;
  }
  return false;
}

export async function POST(req: Request) {
  let body: LoginBody;
  try {
    body = (await req.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }

  const password =
    typeof body.password === "string" ? body.password : "";
  if (!password) {
    return NextResponse.json({ error: "missing-password" }, { status: 400 });
  }

  const ok = await checkPassword(password);
  if (!ok) {
    // Small delay to blunt brute-force attempts.
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json(
      { error: "invalid-credentials" },
      { status: 401 },
    );
  }

  try {
    const { token, maxAge } = await createSessionToken();
    const store = await cookies();
    store.set({ ...sessionCookieOptions(maxAge), value: token });
  } catch (err) {
    // Most common cause: AUTH_SECRET missing or too short. Surface a clear
    // error instead of a generic 500 so misconfiguration is diagnosable.
    console.error("[auth] session creation failed:", err);
    const message = err instanceof Error ? err.message : "session-error";
    return NextResponse.json(
      { error: "server-misconfigured", detail: message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
