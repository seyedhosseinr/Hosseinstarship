import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");

const expectedPngs = [
  ["apple-touch-icon.png", 180],
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["favicon-32x32.png", 32],
  ["favicon-16x16.png", 16],
  ["maskable-icon-512.png", 512],
];

const svgPath = path.join(publicDir, "pwa-icon.svg");
const svg = await readFile(svgPath, "utf8");

if (!svg.trimStart().startsWith("<svg") || !svg.includes("viewBox=\"0 0 1024 1024\"")) {
  throw new Error("public/pwa-icon.svg is not a valid 1024x1024 SVG source.");
}

console.log("verified public/pwa-icon.svg");

for (const [fileName, size] of expectedPngs) {
  const filePath = path.join(publicDir, fileName);
  await access(filePath);
  const metadata = await sharp(filePath).metadata();

  if (metadata.format !== "png" || metadata.width !== size || metadata.height !== size) {
    throw new Error(
      `public/${fileName} expected PNG ${size}x${size}, got ${metadata.format} ${metadata.width}x${metadata.height}`,
    );
  }

  console.log(`verified public/${fileName} ${size}x${size}`);
}
