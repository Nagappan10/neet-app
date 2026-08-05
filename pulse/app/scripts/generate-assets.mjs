/**
 * Generates Pulse's app icon and splash artwork as PNGs.
 *
 * These are committed to assets/, but keeping the generator in the repo means
 * the marks can be regenerated at any size instead of being opaque binaries.
 * Written with zlib only — no image library — so it runs anywhere Node does.
 *
 * The mark: a cyan-to-blue progress ring (the app's walking accent, and the
 * shape the whole UI is built around) with a pulse waveform through the middle,
 * on the app's near-black ground.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets');
mkdirSync(OUT, { recursive: true });

const BG = [0x0a, 0x0a, 0x0c];
const CYAN = [0x22, 0xd3, 0xee];
const BLUE = [0x3b, 0x82, 0xf6];

const lerp = (a, b, t) => a + (b - a) * t;
const mixRgb = (c1, c2, t) => [
  lerp(c1[0], c2[0], t),
  lerp(c1[1], c2[1], t),
  lerp(c1[2], c2[2], t),
];

/** Coverage of a pixel by a shape, sampled 3x3 for cheap antialiasing. */
function coverage(px, py, test) {
  let hits = 0;
  for (let sy = 0; sy < 3; sy += 1) {
    for (let sx = 0; sx < 3; sx += 1) {
      if (test(px + (sx + 0.5) / 3, py + (sy + 0.5) / 3)) hits += 1;
    }
  }
  return hits / 9;
}

/**
 * Draws the mark into an RGBA buffer.
 *
 * `transparent` produces the adaptive-icon foreground and the splash logo,
 * which must sit on a system-provided background rather than carry their own.
 */
function render(size, { transparent = false, inset = 0.5 } = {}) {
  const px = new Uint8Array(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;

  const radius = size * 0.5 * inset * 0.78;
  const ringWidth = size * inset * 0.115;
  const inner = radius - ringWidth / 2;
  const outer = radius + ringWidth / 2;

  // The ring leaves a gap at the bottom, like the progress rings in the app.
  const GAP = Math.PI * 0.42;

  const waveHalf = size * inset * 0.34;
  const waveThick = size * inset * 0.085;

  // Pulse waveform control points, in units of the half-width.
  const pts = [
    [-1.0, 0.0], [-0.46, 0.0], [-0.28, -0.62], [-0.02, 0.55],
    [0.2, -0.3], [0.38, 0.0], [1.0, 0.0],
  ].map(([x, y]) => [cx + x * waveHalf, cy + y * waveHalf]);

  const distToSegment = (x, y, [x1, y1], [x2, y2]) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2));
    return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
  };

  const onWave = (x, y) => {
    for (let i = 0; i < pts.length - 1; i += 1) {
      if (distToSegment(x, y, pts[i], pts[i + 1]) <= waveThick / 2) return true;
    }
    return false;
  };

  const onRing = (x, y) => {
    const d = Math.hypot(x - cx, y - cy);
    if (d < inner || d > outer) return false;
    // Angle measured from twelve o'clock, clockwise.
    let a = Math.atan2(x - cx, cy - y);
    if (a < 0) a += Math.PI * 2;
    return a <= Math.PI * 2 - GAP;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;

      let r = BG[0];
      let g = BG[1];
      let b = BG[2];
      let a = transparent ? 0 : 255;

      const ringCov = coverage(x, y, onRing);
      const waveCov = coverage(x, y, onWave);
      const cov = Math.max(ringCov, waveCov);

      if (cov > 0) {
        // Gradient runs diagonally, cyan (top-left) to blue (bottom-right).
        const t = Math.min(1, Math.max(0, (x / size) * 0.5 + (y / size) * 0.5));
        const [mr, mg, mb] = mixRgb(CYAN, BLUE, t);
        r = lerp(r, mr, cov);
        g = lerp(g, mg, cov);
        b = lerp(b, mb, cov);
        a = Math.max(a, Math.round(cov * 255));
      }

      px[i] = Math.round(r);
      px[i + 1] = Math.round(g);
      px[i + 2] = Math.round(b);
      px[i + 3] = a;
    }
  }

  return px;
}

/** Minimal PNG encoder: one IHDR/IDAT/IEND, filter type 0 per scanline. */
function encodePng(size, rgba) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

const targets = [
  // Full-bleed app icon.
  { name: 'icon.png', size: 1024, opts: { inset: 0.86 } },
  // Adaptive foreground: Android masks and zooms it, so keep the mark small
  // and the background transparent.
  { name: 'adaptive-icon.png', size: 1024, opts: { transparent: true, inset: 0.62 } },
  // Splash logo — this is the asset whose absence broke aapt2 resource linking.
  { name: 'splash-icon.png', size: 512, opts: { transparent: true, inset: 0.78 } },
  { name: 'favicon.png', size: 96, opts: { inset: 0.86 } },
];

for (const { name, size, opts } of targets) {
  const png = encodePng(size, render(size, opts));
  writeFileSync(path.join(OUT, name), png);
  console.log(`${name.padEnd(20)} ${size}x${size}  ${(png.length / 1024).toFixed(1)} KB`);
}
