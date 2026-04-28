/**
 * Phase 3.6 — focused component test for <MediaBundleImporter />.
 *
 * Mounts the real component under jsdom, stubs `fetch` so the network
 * round-trip is replaced by a deterministic JSON response, and asserts:
 *
 *   1. The form renders with chapter input + file picker + submit
 *      button. Submit is disabled until both fields are populated.
 *   2. On a successful import, the summary card renders the right
 *      counts AND surfaces the new "Open debug reader" action button.
 *   3. On a manifest-error response, the manifest-error branch renders
 *      with the structured message — no success card, no action button.
 *   4. On a partial-success response (some skipped), the success card
 *      shows the skipped + missing-file lists and STILL surfaces the
 *      action button (because at least one row imported).
 *
 * No real network. No real DB. No filesystem.
 */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MediaBundleImporter } from "../MediaBundleImporter";
import type { ImportSummary } from "@/lib/starship-media/importer";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function stubFetch(json: unknown, init: { status?: number } = {}) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    json: async () => json,
  } as Response);
}

async function selectFile(name = "bundle.zip") {
  const input = container.querySelector<HTMLInputElement>("[data-testid='bundle-file']");
  if (!input) throw new Error("file input not found");
  const file = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], name, {
    type: "application/zip",
  });
  // jsdom 22 doesn't ship DataTransfer; emulate a real FileList with
  // index access + Symbol.iterator + length + item(). React's
  // onChange handler reads `e.target.files?.[0]` which only needs the
  // index accessor, but we set the others for completeness so any
  // future spread / iteration on the object doesn't blow up.
  const fileList = {
    0: file,
    length: 1,
    item: (idx: number) => (idx === 0 ? file : null),
    [Symbol.iterator]: function* () {
      yield file;
    },
  } as unknown as FileList;
  Object.defineProperty(input, "files", {
    configurable: true,
    value: fileList,
  });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    for (let i = 0; i < 3; i++) await Promise.resolve();
  });
  return file;
}

async function fillChapter(value: number | string) {
  const input = container.querySelector<HTMLInputElement>("input[type='number']");
  if (!input) throw new Error("chapter input not found");
  await act(async () => {
    // React 18 tracks input value changes via the native value setter
    // for controlled inputs; bypass with the prototype setter so
    // React's onChange listener picks the new value up.
    const proto = Object.getPrototypeOf(input);
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    desc?.set?.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();
  });
}

async function clickSubmit() {
  const form = container.querySelector<HTMLFormElement>("[data-testid='media-bundle-form']");
  const submit = container.querySelector<HTMLButtonElement>(
    "[data-testid='media-bundle-submit']",
  );
  if (!form || !submit) throw new Error("form/submit not found");
  expect(submit.disabled).toBe(false);
  await act(async () => {
    // Dispatch a real submit event on the form (button.click() can race
    // the async onSubmit handler in jsdom). The handler does
    // `e.preventDefault()` + an async fetch — flush microtasks until
    // settled.
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
  // Extra microtask flush after `act` returns to settle final setState.
  await act(async () => {
    for (let i = 0; i < 3; i++) await Promise.resolve();
  });
}

describe("<MediaBundleImporter /> — form shape and submit gating", () => {
  it("renders the canonical form fields", () => {
    act(() => root.render(<MediaBundleImporter />));
    expect(container.querySelector("[data-testid='media-bundle-form']")).not.toBeNull();
    expect(container.querySelector("input[type='number']")).not.toBeNull();
    expect(container.querySelector("[data-testid='bundle-file']")).not.toBeNull();
    const submit = container.querySelector<HTMLButtonElement>(
      "[data-testid='media-bundle-submit']",
    );
    expect(submit).not.toBeNull();
    // The chapter defaults to 164, but no file is selected yet → disabled.
    expect(submit!.disabled).toBe(true);
  });

  it("enables submit only after both chapter and file are populated", async () => {
    act(() => root.render(<MediaBundleImporter />));
    const submit = container.querySelector<HTMLButtonElement>(
      "[data-testid='media-bundle-submit']",
    )!;
    expect(submit.disabled).toBe(true);
    await selectFile();
    expect(submit.disabled).toBe(false);
    // Wiping chapter disables submit again.
    await fillChapter("");
    expect(submit.disabled).toBe(true);
  });
});

describe("<MediaBundleImporter /> — successful import", () => {
  it("renders the success summary and surfaces the 'Open debug reader' action button", async () => {
    const summary: ImportSummary = {
      ok: true,
      receivedAssets: 2,
      imported: 2,
      inserted: 2,
      updated: 0,
      skipped: 0,
      failed: 0,
      rejected: [],
      missingFiles: [],
      writeFailures: [],
      importedMediaIds: ["ch164_fig_1", "ch164_img_1"],
    };
    stubFetch({ ok: true, summary });

    act(() => root.render(<MediaBundleImporter />));
    await selectFile();
    await clickSubmit();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/import/media-bundle",
      expect.objectContaining({ method: "POST" }),
    );

    const success = container.querySelector("[data-testid='summary-success']");
    expect(success).not.toBeNull();
    expect(success!.textContent).toContain("Import complete");
    expect(success!.textContent).toContain("ch164_fig_1");
    expect(success!.textContent).toContain("ch164_img_1");

    // Phase 3.6 polish — the action button must surface on success.
    const action = container.querySelector<HTMLButtonElement>(
      "[data-testid='summary-open-reader']",
    );
    expect(action).not.toBeNull();
    expect(action!.textContent).toMatch(/Open debug reader|View chapter/);
  });

  it("partial-success (some skipped) still surfaces the action button when imported > 0", async () => {
    const summary: ImportSummary = {
      ok: true,
      receivedAssets: 3,
      imported: 1,
      inserted: 1,
      updated: 0,
      skipped: 1,
      failed: 0,
      rejected: [
        { index: 2, mediaId: "ch164_bad", reason: "invalid-kind", detail: "kind=diagram" },
      ],
      missingFiles: [{ mediaId: "ch164_missing", filename: "missing.png" }],
      writeFailures: [],
      importedMediaIds: ["ch164_ok"],
    };
    stubFetch({ ok: true, summary });

    act(() => root.render(<MediaBundleImporter />));
    await selectFile();
    await clickSubmit();

    const card = container.querySelector("[data-testid='summary-success']")!;
    expect(card).not.toBeNull();
    expect(card.textContent).toContain("invalid kind");
    expect(card.textContent).toContain("missing.png");
    expect(
      container.querySelector("[data-testid='summary-open-reader']"),
    ).not.toBeNull();
  });
});

describe("<MediaBundleImporter /> — error responses", () => {
  it("renders the manifest-error branch when the server reports a structural error", async () => {
    const summary: ImportSummary = {
      ok: false,
      receivedAssets: 0,
      imported: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      rejected: [],
      missingFiles: [],
      writeFailures: [],
      importedMediaIds: [],
      manifestError: {
        error: "chapter-mismatch",
        message:
          "Manifest chapterNumber (200) does not match the selected chapter (164).",
        manifestChapterNumber: 200,
      },
    };
    stubFetch({ ok: false, summary });

    act(() => root.render(<MediaBundleImporter />));
    await selectFile();
    await clickSubmit();

    const errBox = container.querySelector("[data-testid='summary-manifest-error']");
    expect(errBox).not.toBeNull();
    expect(errBox!.textContent).toContain(
      "manifest.chapterNumber doesn't match the chapter you selected",
    );
    expect(errBox!.textContent).toContain("200");
    // No success card, no action button when the bundle was rejected outright.
    expect(container.querySelector("[data-testid='summary-success']")).toBeNull();
    expect(
      container.querySelector("[data-testid='summary-open-reader']"),
    ).toBeNull();
  });

  it("does NOT surface the action button when imported = 0 (e.g. all writes failed)", async () => {
    const summary: ImportSummary = {
      ok: false,
      receivedAssets: 1,
      imported: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: 1,
      rejected: [],
      missingFiles: [],
      writeFailures: [{ mediaId: "x", filename: "x.png", reason: "db down" }],
      importedMediaIds: [],
    };
    stubFetch({ ok: false, summary });

    act(() => root.render(<MediaBundleImporter />));
    await selectFile();
    await clickSubmit();

    const card = container.querySelector("[data-testid='summary-success']");
    expect(card).not.toBeNull();
    expect(card!.textContent).toContain("Import finished with issues");
    // Action button is gated on imported > 0.
    expect(
      container.querySelector("[data-testid='summary-open-reader']"),
    ).toBeNull();
  });
});
