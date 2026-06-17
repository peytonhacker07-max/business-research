// Generates the PWA app icons (192 & 512) as real PNG files with no external
// deps — just Node's built-in zlib. Draws a deep-teal tile with a cream
// progress-ring + checkmark mark (the app's signature motif).
//
// Run with: npm run gen-icons
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BG = [14, 79, 69]; // #0E4F45 deep teal
const FG = [247, 244, 236]; // #F7F4EC cream

// --- PNG encoding ---------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // 10,11,12 = compression, filter, interlace = 0

  // raw scanlines each prefixed with filter byte 0
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- Drawing --------------------------------------------------------------

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function isMark(x, y, s) {
  const c = s / 2;
  // ring
  const r = s * 0.3;
  const stroke = s * 0.075;
  const distCenter = Math.hypot(x - c, y - c);
  if (Math.abs(distCenter - r) <= stroke / 2) return true;
  // checkmark
  const half = s * 0.035;
  const p1 = [s * 0.385, s * 0.52];
  const p2 = [s * 0.46, s * 0.6];
  const p3 = [s * 0.63, s * 0.41];
  if (distToSegment(x, y, p1[0], p1[1], p2[0], p2[1]) <= half) return true;
  if (distToSegment(x, y, p2[0], p2[1], p3[0], p3[1]) <= half) return true;
  return false;
}

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const SS = 3; // supersampling for smooth edges
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          if (isMark(px, py, size)) hits++;
        }
      }
      const t = hits / (SS * SS);
      const i = (y * size + x) * 4;
      rgba[i] = Math.round(BG[0] + (FG[0] - BG[0]) * t);
      rgba[i + 1] = Math.round(BG[1] + (FG[1] - BG[1]) * t);
      rgba[i + 2] = Math.round(BG[2] + (FG[2] - BG[2]) * t);
      rgba[i + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
for (const size of [192, 512]) {
  const png = renderIcon(size);
  writeFileSync(join(outDir, `icon-${size}.png`), png);
  console.log(`wrote public/icon-${size}.png (${png.length} bytes)`);
}
