/// <reference lib="webworker" />
/// <reference lib="webworker.iterable" />
import {
  Serwist,
  CacheFirst,
  NetworkFirst,
  NetworkOnly,
  ExpirationPlugin,
} from "serwist";

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: Array<{ url: string; revision: string | null }>;
};

/**
 * Local-first service worker rules:
 *  - DO NOT call skipWaiting() / clientsClaim() unconditionally. The old
 *    worker must keep serving the existing tab until the user confirms the
 *    update through the in-app prompt. The page posts { type: 'SKIP_WAITING' }
 *    to this worker when the user clicks "Reload".
 *  - DO NOT intercept POST/PUT/DELETE — those are either outbox pushes or
 *    form submissions, both of which must reach the network (or fail cleanly).
 *    Serwist's default strategies only handle GET, but we add an explicit
 *    NetworkOnly fetch listener for non-GET to be safe.
 *  - Every runtime cache has a versioned name so old caches are purged on
 *    major shell updates.
 */

const CACHE_VERSION = "v2";
const OFFLINE_URL = "/offline.html";

// Last-resort fallback for navigation requests. When the user has never
// visited a route online AND the network is down, NetworkFirst's cache miss
// would otherwise leak a browser-chrome "No internet" page. This plugin
// intercepts the final error and returns the precached /offline.html shell,
// which then hyperlinks the user to any route that IS cached.
const navigationFallbackPlugin = {
  handlerDidError: async (): Promise<Response> => {
    const cached = await caches.match(OFFLINE_URL);
    if (cached) return cached;
    // Absolute last resort — should never fire if /offline.html is precached.
    return new Response(
      "<!doctype html><meta charset=utf-8><title>Offline</title><body>Offline</body>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  },
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // Do NOT auto-skipWaiting — the in-app prompt handles it.
  skipWaiting: false,
  clientsClaim: false,
  runtimeCaching: [
    {
      // PGlite WASM + data files — cache aggressively for offline cold start
      matcher: ({ url, request }: { url: URL; request: Request }) =>
        request.method === "GET" && /\/pglite\//.test(url.pathname),
      handler: new CacheFirst({
        cacheName: `pglite-wasm-${CACHE_VERSION}`,
        plugins: [
          new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 30 * 86400 }),
        ],
      }),
    },
    {
      // Existing and new sync endpoints must always hit the network —
      // never serve stale data from an outbox push.
      matcher: ({ url }: { url: URL }) =>
        /\/api\/sync\//.test(url.pathname) ||
        /\/api\/local-first\/sync\//.test(url.pathname),
      handler: new NetworkOnly(),
    },
    {
      // Library hierarchy is static content — cache aggressively (GET only)
      matcher: ({ url, request }: { url: URL; request: Request }) =>
        request.method === "GET" &&
        /\/api\/library\/hierarchy/.test(url.pathname),
      handler: new CacheFirst({
        cacheName: `lib-cache-${CACHE_VERSION}`,
        plugins: [new ExpirationPlugin({ maxAgeSeconds: 86400 })],
      }),
    },
    {
      // All other GET API routes — network first with 5s timeout fallback to cache
      matcher: ({ url, request }: { url: URL; request: Request }) =>
        request.method === "GET" && /\/api\//.test(url.pathname),
      handler: new NetworkFirst({
        cacheName: `api-cache-${CACHE_VERSION}`,
        networkTimeoutSeconds: 5,
      }),
    },
    {
      // Next.js RSC payloads (_rsc query string or RSC header). These back
      // client-side navigation — caching them lets previously-visited routes
      // hydrate offline. NetworkFirst so fresh data wins when online.
      matcher: ({ url, request }: { url: URL; request: Request }) =>
        request.method === "GET" &&
        (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1"),
      handler: new NetworkFirst({
        cacheName: `rsc-cache-${CACHE_VERSION}`,
        networkTimeoutSeconds: 3,
        plugins: [
          new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7 * 86400 }),
        ],
      }),
    },
    {
      // HTML navigation requests (initial page load, reload, Add-to-Home-Screen
      // cold start). Without this rule there was NO offline handling for page
      // shells — the SW let navigation fall through to the network and the
      // browser's "No internet" chrome replaced the app entirely. NetworkFirst
      // with a short timeout keeps fresh HTML when online but serves the
      // cached shell (or /offline.html) when offline.
      matcher: ({ request }: { request: Request }) =>
        request.method === "GET" && request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: `pages-${CACHE_VERSION}`,
        networkTimeoutSeconds: 3,
        plugins: [
          new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 7 * 86400 }),
          navigationFallbackPlugin,
        ],
      }),
    },
  ],
  // Ensure /offline.html is always in the precache so the navigation fallback
  // has something to serve even on the very first offline visit.
  fallbacks: {
    entries: [
      {
        url: OFFLINE_URL,
        matcher: ({ request }: { request: Request }) =>
          request.mode === "navigate",
      },
    ],
  },
});

serwist.addEventListeners();

// Explicit non-GET passthrough — never serve a cached response for
// POST/PUT/DELETE, and never retry in the worker. The page is responsible
// for the outbox.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    // Let the browser handle it directly — no respondWith.
    return;
  }
});

// In-app update prompt handshake. The page sends { type: 'SKIP_WAITING' }
// once the user confirms "Reload to update", and only then do we activate
// the new worker and claim clients.
self.addEventListener("message", (event) => {
  const data = event.data as { type?: string } | null;
  if (data?.type === "SKIP_WAITING") {
    self.skipWaiting().then(() => self.clients.claim());
  }
});
