/**
 * Crop a select-screen portrait for every rigged character.
 *
 * The rigs already say where each head is, so the portraits come from that
 * rather than from ten hand-picked rectangles that would drift the moment a
 * polygon moved.
 *
 *   node tools/portraits.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { readPng } from './lib/png.mjs';
import { encodeRgba } from './lib/png-write.mjs';

const OUT = 'assets/portraits';
const SIZE = 192;
fs.mkdirSync(OUT, { recursive: true });

/** rig name -> source cutout */
const SOURCE = {
  kin01: 1, kin02: 2, kin03: 3, kin04: 4, kin05: 5,
  kin06: 6, kin07: 7, kin08: 8, kin09: 9, kin10: 10,
};

for (const [id, n] of Object.entries(SOURCE)) {
  const rig = JSON.parse(fs.readFileSync(path.join('rigs', `${id}.json`), 'utf8'));
  const head = rig.parts.find((p) => p.name === 'head');
  if (!head) { console.log(`${id}: no head part, skipped`); continue; }

  const png = readPng(fs.readFileSync(`assets/cutouts/${n}.png`));
  const src = png.toRgba();
  const { width: w, height: h } = png;

  const xs = head.poly.map((p) => p[0]);
  const ys = head.poly.map((p) => p[1]);
  let x0 = Math.min(...xs); let x1 = Math.max(...xs);
  let y0 = Math.min(...ys); let y1 = Math.max(...ys);

  // tighten onto pixels that are actually there -- a U-shaped head part spans
  // the full width of the hair and would otherwise frame mostly empty space
  let tx0 = x1; let tx1 = x0; let ty0 = y1; let ty1 = y0;
  for (let y = Math.max(0, y0 | 0); y <= Math.min(h - 1, y1 | 0); y++) {
    for (let x = Math.max(0, x0 | 0); x <= Math.min(w - 1, x1 | 0); x++) {
      if (src[(y * w + x) * 4 + 3] < 24) continue;
      if (x < tx0) tx0 = x; if (x > tx1) tx1 = x;
      if (y < ty0) ty0 = y; if (y > ty1) ty1 = y;
    }
  }
  [x0, x1, y0, y1] = [tx0, tx1, ty0, ty1];

  // square it off around the face, with a little air
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const side = Math.max(x1 - x0, y1 - y0) * 1.12;
  x0 = Math.round(cx - side / 2); y0 = Math.round(cy - side / 2);

  const dst = new Uint8Array(SIZE * SIZE * 4);
  const step = side / SIZE;
  for (let dy = 0; dy < SIZE; dy++) {
    for (let dx = 0; dx < SIZE; dx++) {
      // box filter over the source footprint of this destination pixel
      const sx0 = Math.round(x0 + dx * step);
      const sy0 = Math.round(y0 + dy * step);
      const sx1 = Math.max(sx0 + 1, Math.round(x0 + (dx + 1) * step));
      const sy1 = Math.max(sy0 + 1, Math.round(y0 + (dy + 1) * step));
      let r = 0; let g = 0; let b = 0; let a = 0; let n2 = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          if (sx < 0 || sy < 0 || sx >= w || sy >= h) { n2++; continue; }
          const o = (sy * w + sx) * 4;
          const al = src[o + 3] / 255;
          r += src[o] * al; g += src[o + 1] * al; b += src[o + 2] * al; a += src[o + 3];
          n2++;
        }
      }
      if (!n2) continue;
      const o = (dy * SIZE + dx) * 4;
      const av = a / n2;
      if (av < 1) continue;
      // un-premultiply so edges stay the right colour against any backdrop
      const k = 255 / av;
      dst[o] = Math.min(255, Math.round((r / n2) * k));
      dst[o + 1] = Math.min(255, Math.round((g / n2) * k));
      dst[o + 2] = Math.min(255, Math.round((b / n2) * k));
      dst[o + 3] = Math.round(av);
    }
  }

  const file = path.join(OUT, `${id}.png`);
  fs.writeFileSync(file, Buffer.from(encodeRgba(SIZE, SIZE, dst)));
  console.log(`${file}  from ${n}.png  head box ${x0},${y0} ${Math.round(side)}px`);
}
