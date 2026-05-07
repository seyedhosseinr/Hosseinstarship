import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const sourceSvg = path.join(publicDir, "pwa-icon.svg");

const targets = [
  { file: "apple-touch-icon.png", size: 180 },
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "favicon-32x32.png", size: 32 },
  { file: "favicon-16x16.png", size: 16 },
];

await mkdir(publicDir, { recursive: true });

for (const target of targets) {
  await sharp(sourceSvg, { density: 384 })
    .resize(target.size, target.size, { fit: "cover" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(publicDir, target.file));

  console.log(`generated public/${target.file} ${target.size}x${target.size}`);
}

const maskableSize = 512;
const maskablePadding = 64;
const maskableInner = maskableSize - maskablePadding * 2;
const maskableIcon = await sharp(sourceSvg, { density: 384 })
  .resize(maskableInner, maskableInner, { fit: "cover" })
  .png()
  .toBuffer();

await sharp({
  create: {
    width: maskableSize,
    height: maskableSize,
    channels: 4,
    background: "#0c342b",
  },
})
  .composite([{ input: maskableIcon, left: maskablePadding, top: maskablePadding }])
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(path.join(publicDir, "maskable-icon-512.png"));

console.log("generated public/maskable-icon-512.png 512x512 maskable");
