import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME, verifySessionToken } from "./session";

/**
 * Server-side helper for route handlers and server actions.
 * Returns a 401 JSON response if the current request has no valid session.
 * Use inside `route.ts` handlers as: `const unauth = await requireSession(); if (unauth) return unauth;`
 */
export async function requireSession(): Promise<NextResponse | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  const payload = await verifySessionToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }
  return null;
}

/**
 * Throws when called without a valid session — suitable for server actions
 * (which bubble errors to the client).
 */
export async function assertSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  const payload = await verifySessionToken(token);
  if (!payload) {
    throw new Error("unauthorized");
  }
}

export async function hasSession(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  const payload = await verifySessionToken(token);
  return payload !== null;
}
