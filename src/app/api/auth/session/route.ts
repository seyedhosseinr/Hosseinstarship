import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * Lightweight probe the client can call to confirm whether the current
 * browser still has a valid server session. Used by the offline auth gate
 * to decide whether to unlock the PWA shell.
 */
export async function GET() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  const payload = await verifySessionToken(token);
  return NextResponse.json(
    { authenticated: payload !== null, exp: payload?.exp ?? null },
    { headers: { "cache-control": "no-store" } },
  );
}
