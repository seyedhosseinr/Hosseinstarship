import type { NextConfig } from "next";
import { resolve } from "node:path";
import withSerwist from "@serwist/next";

// Turbopack detects a lockfile in the parent `tests/app/` directory and
// picks that as the workspace root.  We must override it to our project.
const PROJECT_ROOT: string = resolve(".");

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  output: process.env.VERCEL ? undefined : "standalone",  // standalone for Docker/Liara; Vercel manages its own output
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: PROJECT_ROOT,
  },
  // PGlite uses import.meta.url for WASM resolution â€” Turbopack rewrites
  // that to a URL object which then crashes Node `path` utilities.
  // Keeping PGlite external lets Node handle it natively.
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

// Build the Serwist-wrapped config first (client PWA fully enabled in prod).
const serwistConfig = withSerwist({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  maximumFileSizeToCacheInBytes: 12 * 1024 * 1024, // 12 MB â€” PGlite WASM (~9 MB)
  disable: process.env.NODE_ENV === "development",
  // @serwist/next only precaches /_next/static/** assets from the build
  // manifest. Files in public/ (like offline.html) are NOT auto-included.
  // We must add them explicitly so the navigationFallbackPlugin and the
  // fallbacks config have something to serve for never-visited routes.
  additionalPrecacheEntries: [{ url: "/offline.html", revision: "3" }],
})(nextConfig);

// â”€â”€ Serwist server-entry fix â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// @serwist/next wraps config.entry and injects sw-entry.js into "main.js" and
// "main-app" for EVERY webpack compilation (both client and server).  When the
// server build includes sw-entry.js in its own "main.js" entry it ends up
// bundling code that touches pages/_document in an unexpected context, which
// causes Next.js to throw:
//   "<Html> should not be imported outside of pages/_document"
// on the /500 pre-render.
//
// Fix: intercept the webpack function produced by withSerwist and, on the
// server build only, strip sw-entry.js from any entry array.  The client build
// is left completely untouched so the service-worker registration still fires.
const serwistWebpack = serwistConfig.webpack;

serwistConfig.webpack = function patchedWebpack(
  config: Parameters<NonNullable<NextConfig["webpack"]>>[0],
  options: Parameters<NonNullable<NextConfig["webpack"]>>[1]
) {
  // Run the full Serwist webpack pipeline first.
  const result = serwistWebpack
    ? serwistWebpack(config, options)
    : config;

  // Nothing to do for client builds â€” keep sw-entry intact.
  if (!options.isServer) return result;

  // For server builds: unwrap the entry function and strip sw-entry.js.
  const originalEntry = result.entry;

  result.entry = async () => {
    const entries: Record<string, string | string[]> =
      typeof originalEntry === "function"
        ? await (originalEntry as () => Promise<Record<string, string | string[]>>)()
        : (originalEntry as Record<string, string | string[]>);

    // Remove sw-entry from every server entry bucket.
    // IMPORTANT: never delete an entry key (e.g. pages/_document), because
    // Next relies on those internal page entries during build.
    for (const key of Object.keys(entries)) {
      const bucket = entries[key];
      if (Array.isArray(bucket)) {
        entries[key] = bucket.filter((e) => !e.includes("sw-entry"));
      }
    }

    return entries;
  };

  return result;
};

export default serwistConfig;

