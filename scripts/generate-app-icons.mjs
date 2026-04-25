import sharp from "sharp";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = path.resolve(__dirname, "..", "public", "icons");

const TEAL = "#0AA6B8";
const TEAL_DARK = "#067985";
const RING = "#F5D06A";
const RING_SHADE = "#C9A13E";

function buildSvg({ size, maskable = false }) {
  const pad = maskable ? size * 0.14 : size * 0.04;
  const inner = size - pad * 2;
  const cx = size / 2;
  const cy = size / 2;
  const r = inner / 2;

  const hW = r * 1.05;
  const hH = r * 1.18;
  const hX = cx - hW / 2;
  const hY = cy - hH / 2;
  const bar = hH * 0.18;
  const leg = hW * 0.22;

  const ringRx = r * 1.02;
  const ringRy = r * 0.30;
  const ringStroke = Math.max(size * 0.028, 3);
  const ringTilt = -22;

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <radialGradient id="bg" cx="38%" cy="32%" r="85%">
      <stop offset="0%" stop-color="#2DC7D8"/>
      <stop offset="55%" stop-color="${TEAL}"/>
      <stop offset="100%" stop-color="${TEAL_DARK}"/>
    </radialGradient>
    <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${RING_SHADE}"/>
      <stop offset="50%" stop-color="${RING}"/>
      <stop offset="100%" stop-color="${RING_SHADE}"/>
    </linearGradient>
    <clipPath id="ringBackClip">
      <rect x="0" y="0" width="${size}" height="${cy}"/>
    </clipPath>
    <clipPath id="ringFrontClip">
      <rect x="0" y="${cy}" width="${size}" height="${size - cy}"/>
    </clipPath>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="${size * 0.012}"/>
    </filter>
  </defs>

  <rect x="0" y="0" width="${size}" height="${size}" rx="${maskable ? 0 : size * 0.22}" ry="${maskable ? 0 : size * 0.22}" fill="url(#bg)"/>

  <g transform="rotate(${ringTilt} ${cx} ${cy})" clip-path="url(#ringBackClip)">
    <ellipse cx="${cx}" cy="${cy}" rx="${ringRx}" ry="${ringRy}"
      fill="none" stroke="url(#ringGrad)" stroke-width="${ringStroke}" opacity="0.95"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${ringRx * 0.88}" ry="${ringRy * 0.78}"
      fill="none" stroke="url(#ringGrad)" stroke-width="${ringStroke * 0.55}" opacity="0.55"/>
  </g>

  <g filter="url(#softShadow)" opacity="0.35">
    <rect x="${hX + leg * 0.25}" y="${hY + hH * 0.05}" width="${leg}" height="${hH}" rx="${leg * 0.18}" fill="#00343A"/>
    <rect x="${hX + hW - leg - leg * 0.25}" y="${hY + hH * 0.05}" width="${leg}" height="${hH}" rx="${leg * 0.18}" fill="#00343A"/>
  </g>

  <g fill="#FFFFFF">
    <rect x="${hX}" y="${hY}" width="${leg}" height="${hH}" rx="${leg * 0.22}"/>
    <rect x="${hX + hW - leg}" y="${hY}" width="${leg}" height="${hH}" rx="${leg * 0.22}"/>
    <rect x="${hX + leg * 0.85}" y="${cy - bar / 2}" width="${hW - leg * 1.7}" height="${bar}" rx="${bar * 0.35}"/>
  </g>

  <g transform="rotate(${ringTilt} ${cx} ${cy})" clip-path="url(#ringFrontClip)">
    <ellipse cx="${cx}" cy="${cy}" rx="${ringRx}" ry="${ringRy}"
      fill="none" stroke="url(#ringGrad)" stroke-width="${ringStroke}" opacity="0.98"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${ringRx * 0.88}" ry="${ringRy * 0.78}"
      fill="none" stroke="url(#ringGrad)" stroke-width="${ringStroke * 0.55}" opacity="0.6"/>
  </g>
</svg>`.trim();
}

const targets = [
  { file: "icon-192.png", size: 192, maskable: false },
  { file: "icon-512.png", size: 512, maskable: false },
  { file: "maskable-512.png", size: 512, maskable: true },
  { file: "apple-touch-icon.png", size: 180, maskable: false },
];

await mkdir(ICONS_DIR, { recursive: true });

for (const t of targets) {
  const svg = buildSvg({ size: t.size, maskable: t.maskable });
  const out = path.join(ICONS_DIR, t.file);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out);
  console.log(`✓ ${t.file} (${t.size}×${t.size}${t.maskable ? " maskable" : ""})`);
}

const faviconSvg = buildSvg({ size: 512, maskable: false });
await writeFile(path.join(ICONS_DIR, "icon.svg"), faviconSvg, "utf8");
console.log("✓ icon.svg");
