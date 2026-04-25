import type { NextConfig } from "next";
import { resolve } from "node:path";
import withSerwist from "@serwist/next";

// Turbopack detects a lockfile in the parent `tests/app/` directory and
// picks that as the workspace root.  We must override it to our project.
const PROJECT_ROOT: string = resolve(".");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  output: "standalone",  // ← برای Docker deploy (Liara / ArvanCloud)
  eslint: {
    ignoreDuringBuilds: true,
  },
  turbopack: {
    root: PROJECT_ROOT,
  },
  // PGlite uses import.meta.url for WASM resolution — Turbopack rewrites
  // that to a URL object which then crashes Node `path` utilities.
  // Keeping PGlite external lets Node handle it natively.
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default withSerwist({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  maximumFileSizeToCacheInBytes: 12 * 1024 * 1024, // 12 MB — PGlite WASM (~9 MB)
  disable: process.env.NODE_ENV === "development",
})(nextConfig);