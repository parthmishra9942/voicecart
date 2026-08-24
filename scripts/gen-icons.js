/* =========================================================================
 * scripts/gen-icons.js — generate the PWA PNG icons from a tiny raster
 * renderer (no external deps: uses built-in zlib for the PNG IDAT stream).
 * Run:  node scripts/gen-icons.js
 * ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'icons');

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) {
    c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 4);
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), data])), 8 + data.length);
  return out;
}
function chunkSig() { return Buffer.from('\x89PNG\r\n\x1a\n', 'binary'); }

/* draw one pixel of the icon (rounded dark square + accent circle + mic slot) */
function pixel(x, y, S) {
  const R = S * 0.19;
  const cx = S / 2, cy = S / 2;
  // rounded-corner mask for the square
  const dx = Math.max(Math.abs(x - cx) - (cx - R), 0);
  const dy = Math.max(Math.abs(y - cy) - (cy - R), 0);
  if (Math.hypot(dx, dy) > R) return [0, 0, 0, 0];
  // background
  let c = [15, 23, 42, 255];
  // accent circle (mic body)
  const rr = S * 0.42;
  const d = Math.hypot(x - cx, y - cy);
  if (d <= rr) c = [56, 189, 248, 255];
  // darker inner ring
  if (d <= rr * 0.72 && d > rr * 0.55) c = [4, 16, 26, 255];
  // speaker slots (white)
  if (d <= rr * 0.5) {
    const sx = x, sy = y;
    if (Math.abs(sy - (cy - rr * 0.28)) <= S * 0.02 && Math.abs(sx - cx) <= rr * 0.28) c = [226, 232, 240, 255];
    if (Math.abs(sy - cy) <= S * 0.02 && Math.abs(sx - cx) <= rr * 0.28) c = [226, 232, 240, 255];
    if (Math.abs(sy - (cy + rr * 0.28)) <= S * 0.02 && Math.abs(sx - cx) <= rr * 0.28) c = [226, 232, 240, 255];
  }
  return c;
}

function makePng(S) {
  const raw = Buffer.alloc((S * 4 + 1) * S);
  let o = 0;
  for (let y = 0; y < S; y++) {
    raw[o++] = 0; // filter none
    for (let x = 0; x < S; x++) {
      const [r, g, b, a] = pixel(x, y, S);
      raw[o++] = r; raw[o++] = g; raw[o++] = b; raw[o++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    chunkSig(),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(OUT, { recursive: true });
for (const S of [192, 512]) {
  fs.writeFileSync(path.join(OUT, `icon-${S}.png`), makePng(S));
  console.log('wrote icons/icon-' + S + '.png');
}