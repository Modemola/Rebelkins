/**
 * Coordinate overlay for rigging.
 *
 * Rigging needs joint positions in source pixels, and eyeballing them off a
 * thumbnail is how you get a knee two inches below the knee. This trims a
 * cutout to its subject, scales it up, and rules a labelled grid over it so
 * part boundaries can be read off directly.
 *
 *   node tools/rig-grid.mjs <cutout.png> <out.png> [--scale 2] [--step 25]
 */

import fs from 'node:fs';
import { readPng } from './lib/png.mjs';
import { encodeRgba } from './lib/png-write.mjs';

const [src, out] = process.argv.slice(2);
const arg = (f, d) => (process.argv.includes(f) ? Number(process.argv[process.argv.indexOf(f) + 1]) : d);
const SCALE = arg('--scale', 2);
const STEP = arg('--step', 25);

const png = readPng(fs.readFileSync(src));
const rgba = png.toRgba();
const { width: w, height: h } = png;

let x0 = w; let y0 = h; let x1 = -1; let y1 = -1;
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    if (rgba[(y * w + x) * 4 + 3] < 24) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
}
const bw = x1 - x0 + 1;
const bh = y1 - y0 + 1;
const W = Math.round(bw * SCALE);
const H = Math.round(bh * SCALE);
const dst = new Uint8Array(W * H * 4);

// dark checkerboard, so alpha and pale hair are both readable
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4;
    const c = ((x >> 4) + (y >> 4)) % 2 ? 44 : 64;
    dst[o] = c; dst[o + 1] = c; dst[o + 2] = c; dst[o + 3] = 255;
  }
}
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const sx = x0 + Math.floor(x / SCALE);
    const sy = y0 + Math.floor(y / SCALE);
    const so = (sy * w + sx) * 4;
    const a = rgba[so + 3] / 255;
    if (a <= 0) continue;
    const dO = (y * W + x) * 4;
    for (let c = 0; c < 3; c++) dst[dO + c] = Math.round(dst[dO + c] * (1 - a) + rgba[so + c] * a);
  }
}

const line = (x, y, horiz, len, col) => {
  for (let i = 0; i < len; i++) {
    const px = horiz ? x + i : x;
    const py = horiz ? y : y + i;
    if (px < 0 || py < 0 || px >= W || py >= H) continue;
    const o = (py * W + px) * 4;
    dst[o] = col[0]; dst[o + 1] = col[1]; dst[o + 2] = col[2];
  }
};

// 3x5 digits, enough to label an axis
const GLYPH = {
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'], 3: ['111', '001', '111', '001', '111'],
  4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'],
  8: ['111', '101', '111', '101', '111'], 9: ['111', '101', '111', '001', '111'],
};
const label = (text, px, py, col) => {
  let cx = px;
  for (const ch of String(text)) {
    const g = GLYPH[ch];
    if (!g) { cx += 4; continue; }
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        if (g[r][c] !== '1') continue;
        for (let sy = 0; sy < 2; sy++) {
          for (let sx = 0; sx < 2; sx++) {
            const X = cx + c * 2 + sx;
            const Y = py + r * 2 + sy;
            if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
            const o = (Y * W + X) * 4;
            dst[o] = col[0]; dst[o + 1] = col[1]; dst[o + 2] = col[2];
          }
        }
      }
    }
    cx += 8;
  }
};

for (let sx = Math.ceil(x0 / STEP) * STEP; sx <= x1; sx += STEP) {
  const major = sx % (STEP * 4) === 0;
  const px = Math.round((sx - x0) * SCALE);
  line(px, 0, false, H, major ? [255, 90, 160] : [255, 255, 255, 0.2].slice(0, 3).map(() => 110));
  if (major) label(sx, px + 3, 4, [255, 120, 180]);
}
for (let sy = Math.ceil(y0 / STEP) * STEP; sy <= y1; sy += STEP) {
  const major = sy % (STEP * 4) === 0;
  const py = Math.round((sy - y0) * SCALE);
  line(0, py, true, W, major ? [90, 220, 255] : [110, 110, 110]);
  if (major) label(sy, 4, py + 3, [120, 220, 255]);
}

fs.writeFileSync(out, Buffer.from(encodeRgba(W, H, dst)));
console.log(`subject bbox in source: x ${x0}..${x1} (${bw}px), y ${y0}..${y1} (${bh}px)`);
console.log(`grid step ${STEP}px, majors every ${STEP * 4}px, scale ${SCALE}x -> ${W}x${H}`);
console.log(`wrote ${out}`);
