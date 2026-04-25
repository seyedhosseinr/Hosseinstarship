/**
 * HMAC-SHA256 signed session cookie (Edge + Node runtime compatible).
 * Stateless: payload is signed, not encrypted — only an `exp` timestamp is stored.
 */

export const SESSION_COOKIE_NAME = "starship_session";
const SESSION_VERSION = 1;
const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 365 days

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const pad = s.length % 4 === 2 ? "==" : s.length % 4 === 3 ? "=" : "";
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function getSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 8) {
    throw new Error(
      "AUTH_SECRET is not set or too short (minimum 8 chars). Configure it in your environment.",
    );
  }
  return s;
}

async function importHmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return toBase64Url(new Uint8Array(sig));
}

async function verify(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const key = await importHmacKey(secret);
  let sigBytes: Uint8Array;
  try {
    sigBytes = fromBase64Url(signature);
  } catch {
    return false;
  }
  return crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes as BufferSource,
    new TextEncoder().encode(payload),
  );
}

export type SessionPayload = {
  v: number;
  exp: number; // unix seconds
  iat: number; // unix seconds
};

export async function createSessionToken(
  maxAgeSeconds: number = DEFAULT_MAX_AGE_SECONDS,
): Promise<{ token: string; maxAge: number; payload: SessionPayload }> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    v: SESSION_VERSION,
    iat: now,
    exp: now + maxAgeSeconds,
  };
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await sign(body, getSecret());
  return { token: `${body}.${sig}`, maxAge: maxAgeSeconds, payload };
}

export async function verifySessionToken(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return null;
  }
  const ok = await verify(body, sig, secret);
  if (!ok) return null;
  let payload: SessionPayload;
  try {
    const json = new TextDecoder().decode(fromBase64Url(body));
    payload = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof payload.exp !== "number" || payload.v !== SESSION_VERSION) {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) return null;
  return payload;
}

export function sessionCookieOptions(maxAge: number) {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export { DEFAULT_MAX_AGE_SECONDS };
