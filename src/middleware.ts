import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

/**
 * Paths that must remain reachable without a session. Everything else — pages,
 * API handlers, server actions — is gated. Static assets are filtered out by
 * the `matcher` config below.
 */
const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/session",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = await verifySessionToken(token);
  if (payload) {
    return NextResponse.next();
  }

  // API / server action request → return 401 so clients can react gracefully.
  const isApi = pathname.startsWith("/api/");
  const isServerAction =
    req.method === "POST" && req.headers.get("next-action") !== null;

  if (isApi || isServerAction) {
    return new NextResponse(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  }

  // Page navigation → redirect to /login with the original target.
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  const from = pathname + (search || "");
  if (from && from !== "/" && from !== "/login") {
    loginUrl.searchParams.set("from", from);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Match everything except Next internals and public PWA/static assets.
  // offline.html MUST be excluded: the SW precaches it during install, and
  // middleware interception would cache a login-redirect instead of the real
  // HTML, breaking the offline navigation fallback entirely.
  matcher: [
    "/((?!_next/static|_next/image|_next/data|favicon.ico|favicon-16x16.png|favicon-32x32.png|apple-touch-icon.png|icon-192.png|icon-512.png|maskable-icon-512.png|pwa-icon.svg|manifest.webmanifest|sw.js|sw.js.map|offline.html|icons/|fonts/|wasm/|pglite/|workbox-|sw-|robots.txt|sitemap.xml).*)",
  ],
};
