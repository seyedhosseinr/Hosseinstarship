/**
 * pglite-opfs.worker.ts
 *
 * WASM and data bundle arrive via options.meta from the main thread â€” see the
 * top-of-file comment in pglite-browser.ts for why. Patching fetch here does
 * not work because the bundler has already rewritten the internal
 *   new URL('./pglite.wasm', import.meta.url)
 * at build time into a relative path that cannot be resolved inside a
 * blob-URL worker.
 */

import { worker } from "@electric-sql/pglite/worker";

type WorkerInitMeta = {
  wasmModule?: WebAssembly.Module;
  initdbWasmModule?: WebAssembly.Module;
  fsBundle?: Blob;
};

worker({
  async init(options: unknown) {
    const meta = ((options as { meta?: WorkerInitMeta } | undefined)?.meta) ?? {};
    const { wasmModule, initdbWasmModule, fsBundle } = meta;

    if (!wasmModule || !fsBundle) {
      throw new Error(
        "[pglite-opfs.worker] Missing WASM assets. pglite-browser.ts must "
        + "pre-load pglite.wasm / initdb.wasm / pglite.data and pass them "
        + "via PGliteWorker's { meta } option."
      );
    }

    const { PGlite } = await import("@electric-sql/pglite");

    return PGlite.create({
      dataDir: "opfs-ahp://starship-v1",
      pgliteWasmModule: wasmModule,
      fsBundle,
      ...(initdbWasmModule ? { initdbWasmModule } : {}),
      relaxedDurability: true,
    });
  },
});
