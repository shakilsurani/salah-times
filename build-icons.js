#!/usr/bin/env node
//
// Generates the app icons and manifest used when this is served from a web
// host, so "Add to Home Screen" installs it as a standalone app.
//
//   node build-icons.js
//
// The offline copy on a USB stick does not need these - index.html works on
// its own and simply ignores the missing files.
//
// The icon is drawn pixel by pixel (a crescent knocked out of a rounded square)
// and written as a PNG using only Node's built-in zlib, so there is nothing to
// install.

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ACCENT = [15, 107, 79];    // --accent, the same green the page uses
const MARK = [255, 255, 255];

function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) { c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; }
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) { crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8); }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixel) {
  // Raw RGBA scanlines, each prefixed with filter byte 0.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y, size);
      raw[o++] = r; raw[o++] = g; raw[o++] = b; raw[o++] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type: RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

// Rounded square in the accent colour, with a crescent knocked out of it: the
// crescent is the area inside one circle but outside a second, offset one.
function icon(x, y, size) {
  const s = size;
  const radius = s * 0.22;

  // Rounded-corner mask.
  const cx = Math.min(Math.max(x + 0.5, radius), s - radius);
  const cy = Math.min(Math.max(y + 0.5, radius), s - radius);
  const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
  if (dx * dx + dy * dy > radius * radius) { return [0, 0, 0, 0]; }

  const outer = { x: s * 0.52, y: s * 0.5, r: s * 0.27 };
  const inner = { x: s * 0.61, y: s * 0.44, r: s * 0.24 };

  const inOuter = Math.hypot(x + 0.5 - outer.x, y + 0.5 - outer.y) <= outer.r;
  const inInner = Math.hypot(x + 0.5 - inner.x, y + 0.5 - inner.y) <= inner.r;

  return inOuter && !inInner
    ? [MARK[0], MARK[1], MARK[2], 255]
    : [ACCENT[0], ACCENT[1], ACCENT[2], 255];
}

const manifest = {
  name: "Auburn Central Musallah",
  short_name: "Musallah",
  description: "Daily salah and iqamah times for Auburn Central Musallah.",
  start_url: ".",
  scope: ".",
  display: "standalone",
  orientation: "any",
  background_color: "#f6f7f9",
  theme_color: "#0f6b4f",
  icons: [
    { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
  ]
};

for (const size of [192, 512]) {
  const file = path.join(__dirname, `icon-${size}.png`);
  fs.writeFileSync(file, png(size, icon));
  console.log(`wrote icon-${size}.png (${fs.statSync(file).size} bytes)`);
}

fs.writeFileSync(
  path.join(__dirname, "manifest.webmanifest"),
  JSON.stringify(manifest, null, 2) + "\n"
);
console.log("wrote manifest.webmanifest");
