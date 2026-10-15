/**
 * Crop and magnify a region of a cutout, with an optional pixel grid.
 *
 * Rig polygons are written in the cutout's own pixel coordinates, and placing
 * one by eye on a 600px illustration means guessing to within ten pixels. This
 * puts a labelled grid over the region being cut so the numbers can be read
 * off the picture instead.
 *
 *   node tools/crop.mjs <src.png> <x> <y> <w> <h> [--zoom 4] [--grid 20] [--out f.png]
 */

import fs from 'node:fs';
import { readPng } from './lib/png.mjs';
import { encodeRgba } from './lib/png-write.mjs';

const [src, X, Y, W, H] = process.argv.slice(2);
const arg = (f, d) => (process.argv.includes(f) ? Number(process.argv[process.argv.indexOf(f) + 1]) : d);
const sarg = (f, d) => (process.argv.includes(f) ? process.argv[process.argv.indexOf(f) + 1] : d);
const x0 = Number(X), y0 = Number(Y), w = Number(W), h = Number(H);
const Z = arg('--zoom', 4);
const G = arg('--grid', 20);
const OUT = sarg('--out', 'crop.png');

const png = readPng(fs.readFileSync(src));
const rgba = png.toRgba();

// --raw cuts the region out as it is: original pixels, alpha intact, no zoom,
// no checkerboard, no grid. Used to split a multi-pose sheet into one file per
// pose, which has to happen before the background is keyed -- a backdrop that
// is brighter behind one figure than another needs its own tolerance, and a
// single pass over both loses whichever one it is wrong for. KIN 04's white
// hair against white was exactly that: it survived on the left and dissolved
// on the right in the same pass.
if (process.argv.includes('--raw')) {
  const cut = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = x0 + x;
      const sy = y0 + y;
      if (sx < 0 || sy < 0 || sx >= png.width || sy >= png.height) continue;
      const s = (sy * png.width + sx) * 4;
      const d = (y * w + x) * 4;
      cut[d] = rgba[s]; cut[d + 1] = rgba[s + 1]; cut[d + 2] = rgba[s + 2]; cut[d + 3] = rgba[s + 3];
    }
  }
  fs.writeFileSync(OUT, encodeRgba(w, h, cut));
  console.log(`${OUT}  ${w}x${h} cut from ${src} at ${x0},${y0}`);
  process.exit(0);
}
const dw = w * Z, dh = h * Z;
const out = new Uint8Array(dw * dh * 4);

// checkerboard under the alpha, so transparent and white read differently
for (let y = 0; y < dh; y++) {
  for (let x = 0; x < dw; x++) {
    const sx = x0 + Math.floor(x / Z);
    const sy = y0 + Math.floor(y / Z);
    const d = (y * dw + x) * 4;
    const chk = (((x >> 4) + (y >> 4)) & 1) ? 54 : 38;
    let r = chk, g = chk, b = chk;
    if (sx >= 0 && sx < png.width && sy >= 0 && sy < png.height) {
      const s = (sy * png.width + sx) * 4;
      const a = rgba[s + 3] / 255;
      r = Math.round(rgba[s] * a + chk * (1 - a));
      g = Math.round(rgba[s + 1] * a + chk * (1 - a));
      b = Math.round(rgba[s + 2] * a + chk * (1 - a));
    }
    out[d] = r; out[d + 1] = g; out[d + 2] = b; out[d + 3] = 255;
  }
}

// grid lines on source-pixel multiples, brighter every fifth
if (G > 0) {
  const line = (x, y, bright) => {
    const d = (y * dw + x) * 4;
    const c = bright ? 255 : 150;
    out[d] = Math.round(out[d] * 0.3 + c * 0.7);
    out[d + 1] = Math.round(out[d + 1] * 0.3 + (bright ? 80 : c) * 0.7);
    out[d + 2] = Math.round(out[d + 2] * 0.3 + (bright ? 80 : c) * 0.7);
  };
  for (let sx = Math.ceil(x0 / G) * G; sx < x0 + w; sx += G) {
    const x = (sx - x0) * Z;
    const bright = sx % (G * 5) === 0;
    for (let y = 0; y < dh; y++) line(x, y, bright);
  }
  for (let sy = Math.ceil(y0 / G) * G; sy < y0 + h; sy += G) {
    const y = (sy - y0) * Z;
    const bright = sy % (G * 5) === 0;
    for (let x = 0; x < dw; x++) line(x, y, bright);
  }
}

// A candidate polygon, drawn in source coordinates, so a cut can be judged
// before the rigger runs. --poly "x,y x,y x,y ..."
const POLY = sarg('--poly', null);
if (POLY) {
  const pts = POLY.trim().split(/\s+/).map((p) => p.split(',').map(Number));
  const put = (x, y, c) => {
    if (x < 0 || y < 0 || x >= dw || y >= dh) return;
    const d = (y * dw + x) * 4;
    out[d] = c[0]; out[d + 1] = c[1]; out[d + 2] = c[2];
  };
  const toImg = ([sx, sy]) => [(sx - x0) * Z, (sy - y0) * Z];
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = toImg(pts[i]);
    const [bx, by] = toImg(pts[(i + 1) % pts.length]);
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let t = 0; t <= n; t++) {
      const x = Math.round(ax + ((bx - ax) * t) / n);
      const y = Math.round(ay + ((by - ay) * t) / n);
      for (let o = -1; o <= 1; o++) put(x + o, y, [255, 60, 220]);
      for (let o = -1; o <= 1; o++) put(x, y + o, [255, 60, 220]);
    }
  }
  // numbered corners
  pts.forEach((pt, i) => {
    const [x, y] = toImg(pt);
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      if (dx * dx + dy * dy <= 16) put(x + dx, y + dy, i === 0 ? [80, 255, 140] : [255, 255, 255]);
    }
  });
}

fs.writeFileSync(OUT, encodeRgba(dw, dh, out));
console.log(`${OUT}  source x ${x0}..${x0 + w}, y ${y0}..${y0 + h}, grid every ${G}px (bright every ${G * 5})`);
