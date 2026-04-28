// Dev verification helper — generates an INTENTIONALLY broken chapter
// media bundle exercising two negative paths: an asset whose `kind` is
// invalid, and an asset whose referenced filename is absent from the
// zip. Used to confirm the importer's error-path UI / API summary.
//
// Usage:
//   node scripts/dev/make-media-bundle-invalid.mjs <out.zip>

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { zipSync } from "fflate";

const out = process.argv[2];
if (!out) {
  console.error("usage: node scripts/dev/make-media-bundle-invalid.mjs <out.zip>");
  process.exit(1);
}

// Same valid 1x1 PNG used elsewhere.
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
      mediaId: "ch164_ok",
      refId: "figure:99",
      figureLabel: "Figure 99",
      kind: "figure",
      filename: "ok.png",
      caption: "Negative-test happy entry",
    },
    {
      mediaId: "ch164_missing_file",
      refId: "figure:100",
      figureLabel: "Figure 100",
      kind: "figure",
      filename: "this-file-is-not-in-the-zip.png",
      caption: "Missing-file scenario",
    },
    {
      mediaId: "ch164_bad_kind",
      refId: "diagram:101",
      figureLabel: "Diagram 101",
      kind: "diagram", // not in the allowed enum
      filename: "ok.png",
      caption: "Invalid-kind scenario",
    },
  ],
};

const zipped = zipSync({
  "manifest.json": [new TextEncoder().encode(JSON.stringify(manifest, null, 2)), {}],
  "ok.png": [PNG, {}],
});

writeFileSync(resolve(out), zipped);
console.log(`[make-bad-bundle] wrote ${out} (${zipped.length} bytes)`);
