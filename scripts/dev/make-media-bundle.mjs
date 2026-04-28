// Dev verification helper — generates a tiny valid chapter media
// bundle ZIP at the path passed as the first argument. Re-runs are safe.
//
// Usage:
//   node scripts/dev/make-media-bundle.mjs <out.zip> [caption-suffix]
//
// The optional caption-suffix is appended to the caption text so a
// re-import scenario can prove the upsert pipeline updates the field.
// Pair with `scripts/dev/make-media-bundle-invalid.mjs` when you need
// to exercise the importer's error-path UI / API responses.

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { zipSync } from "fflate";

const out = process.argv[2];
const captionSuffix = process.argv[3] ?? "";
if (!out) {
  console.error("usage: node _make-test-bundle.mjs <out.zip> [caption-suffix]");
  process.exit(1);
}

// 70-byte known-good 1x1 transparent PNG (RFC 2083-compliant header,
// IHDR / IDAT / IEND). Used for both fig-164-4.png and image-2.png so
// the verification only needs to prove that <img src> renders without
// fetch/decode errors — not pixel content.
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0b, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x62, 0x00, 0x00, 0x00,
  0x06, 0x00, 0x03, 0x4b, 0x49, 0x11, 0x45, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

const manifest = {
  chapterNumber: 164,
  assets: [
    {
      mediaId: "ch164_fig_164_4",
      refId: "figure:164.4",
      figureLabel: "Figure 164.4",
      kind: "figure",
      filename: "fig-164-4.png",
      segmentId: "ch164-debug-seg-01",
      sourcePage: 12,
      caption: `Manual verification figure${captionSuffix}`,
      tags: ["verification"],
      highYield: true,
    },
    {
      mediaId: "ch164_img_2",
      refId: "image:2",
      figureLabel: "Image 2",
      kind: "image",
      filename: "image-2.png",
      segmentId: "ch164-debug-seg-01",
      sourcePage: 13,
      caption: `Manual verification image${captionSuffix}`,
      tags: ["verification"],
      highYield: false,
    },
  ],
};

// fflate's zipSync mishandles Uint8Array values that look iterable in
// some environments; the explicit [data, opts] tuple form forces the
// "this is a file" branch.
const zipped = zipSync({
  "manifest.json": [new TextEncoder().encode(JSON.stringify(manifest, null, 2)), {}],
  "fig-164-4.png": [PNG, {}],
  "image-2.png": [PNG, {}],
});

writeFileSync(resolve(out), zipped);
console.log(
  `[make-test-bundle] wrote ${out} (${zipped.length} bytes) with caption suffix "${captionSuffix}"`,
);
