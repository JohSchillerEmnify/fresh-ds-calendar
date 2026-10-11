// Generates placeholder PNG icons (no dependencies): blue rounded tile with a white
// calendar glyph. Run: npm run icons -w web. Output: web/public/icons/*.png
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const out = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../public/icons');
fs.mkdirSync(out, { recursive: true });

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x / size, y / size);
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}
const BLUE = [26, 115, 232, 255], WHITE = [255, 255, 255, 255], CLEAR = [0, 0, 0, 0];
const inRect = (x, y, x0, y0, x1, y1) => x >= x0 && x < x1 && y >= y0 && y < y1;
// glyph drawn in a unit box; `pad` shrinks it toward the center (maskable safe zone)
function glyph(x, y, pad) {
  const s = 1 - 2 * pad, u = (x - pad) / s, v = (y - pad) / s;
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  const page = inRect(u, v, 0.22, 0.28, 0.78, 0.8);
  if (!page) return null;
  if (inRect(u, v, 0.22, 0.28, 0.78, 0.4)) return WHITE; // header bar
  if (inRect(u, v, 0.25, 0.43, 0.75, 0.77)) {
    // grid of 3x3 day cells
    const cu = ((u - 0.25) / 0.5) * 3, cv = ((v - 0.43) / 0.34) * 3;
    const fu = cu % 1, fv = cv % 1;
    return fu > 0.12 && fu < 0.88 && fv > 0.12 && fv < 0.88 ? WHITE : BLUE;
  }
  return WHITE;
}
function rounded(x, y, r) {
  const cx = Math.min(Math.max(x, r), 1 - r), cy = Math.min(Math.max(y, r), 1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}
const any = (pad, radius) => (x, y) => {
  if (radius > 0 && !rounded(x, y, radius)) return CLEAR;
  return glyph(x, y, pad) ?? BLUE;
};
const write = (name, size, fn) => fs.writeFileSync(path.join(out, name), png(size, fn));
write('icon-192.png', 192, any(0, 0.18));
write('icon-512.png', 512, any(0, 0.18));
write('icon-maskable-512.png', 512, any(0.12, 0));
write('apple-touch-icon-180.png', 180, any(0, 0));
write('favicon-32.png', 32, any(0, 0.18));
console.log('icons written to', out);
