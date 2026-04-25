import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  esbuild: {
    // Match Next's automatic JSX runtime so components that omit
    // `import React` (the modern default) work in tests too. Without this,
    // tests that mount such components throw "React is not defined".
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Keep the default pool ("threads"). Our Dexie stores are wiped between
    // tests via fake-indexeddb's resetDatabases helper.
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
