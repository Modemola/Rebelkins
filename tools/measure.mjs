/**
 * Read a cutout's silhouette and report the landmarks a rig needs.
 *
 * Rigging by eye off a thumbnail puts the knee two inches below the knee. The
 * alpha mask already knows where the body narrows and where it splits in two,
 * so this prints that structure instead: per-row width, how many separate runs
 * the row breaks into, and the derived neck / shoulder / waist / crotch lines.
 *
 *   node tools/measure.mjs <cutout.png> [--rows] [--at y1,y2,...]
 */

import fs from 'node:fs';
import { readPng } from './lib/png.mjs';

const src = process.argv[2];
const png = readPng(fs.readFileSync(src));
const rgba = png.toRgba();
const { width: w, height: h } = png;
const A = 24; // alpha floor: anti-aliased fringe is not body

/** Opaque spans on one row, merged across gaps of a few pixels. */
function runs(y, gap = 6) {
  const out = [];
  let start = -1;
  let lastOn = -1;
  for (let x = 0; x < w; x++) {
    const on = rgba[(y * w + x) * 4 + 3] >= A;
    if (on) {
      if (start < 0) start = x;
      lastOn = x;
    } else if (start >= 0 && x - lastOn > gap) {
      out.push([start, lastOn]);
      start = -1;
    }
  }
  if (start >= 0) out.push([start, lastOn]);
  return out;
}

let y0 = h; let y1 = -1; let x0 = w; let x1 = -1;
const rows = [];
for (let y = 0; y < h; y++) {
  const r = runs(y);
  const px = r.reduce((n, [a, b]) => n + (b - a + 1), 0);
  rows[y] = { runs: r, px, left: r.length ? r[0][0] : -1, right: r.length ? r[r.length - 1][1] : -1 };
  if (px) {
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
    if (rows[y].left < x0) x0 = rows[y].left;
    if (rows[y].right > x1) x1 = rows[y].right;
  }
}
const bh = y1 - y0 + 1;
const width = (y) => (rows[y].right < 0 ? 0 : rows[y].right - rows[y].left + 1);
const mid = (y) => (rows[y].right < 0 ? 0 : (rows[y].left + rows[y].right) / 2);

/** Narrowest row inside a band, as a fraction of the subject's height. */
function narrowest(fa, fb) {
  let best = -1; let bw = 1e9;
  for (let y = Math.round(y0 + bh * fa); y <= Math.round(y0 + bh * fb); y++) {
    const ww = width(y);
    if (ww > 0 && ww < bw) { bw = ww; best = y; }
  }
  return { y: best, w: bw };
}

const neck = narrowest(0.14, 0.36);
const waist = narrowest(0.40, 0.62);

/** First row below the waist that breaks into two separate limbs. */
let crotch = -1;
for (let y = waist.y; y <= y1; y++) {
  if (rows[y].runs.length >= 2) { crotch = y; break; }
}
/** Widest row in the shoulder band -- the arms are out there somewhere. */
let shoulder = -1; let sw = -1;
for (let y = neck.y; y <= Math.round(y0 + bh * 0.55); y++) {
  if (width(y) > sw) { sw = width(y); shoulder = y; }
}

console.log(`${src}`);
console.log(`  bbox x ${x0}..${x1}  y ${y0}..${y1}   ${x1 - x0 + 1} x ${bh}`);
console.log(`  head top  y ${y0}`);
console.log(`  neck      y ${neck.y}  width ${neck.w}   centre x ${Math.round(mid(neck.y))}`);
console.log(`  shoulders y ${shoulder}  width ${sw}   centre x ${Math.round(mid(shoulder))}`);
console.log(`  waist     y ${waist.y}  width ${waist.w}   centre x ${Math.round(mid(waist.y))}`);
console.log(`  crotch    y ${crotch}${crotch > 0 ? `  legs ${JSON.stringify(rows[crotch].runs)}` : '  (legs never separate)'}`);
console.log(`  feet      y ${y1}  centre x ${Math.round(mid(y1 - 2))}`);

if (process.argv.includes('--rows')) {
  const step = Math.max(1, Math.round(bh / 48));
  for (let y = y0; y <= y1; y += step) {
    const r = rows[y].runs.map(([a, b]) => `${a}-${b}`).join(' | ');
    console.log(`   y ${String(y).padStart(3)}  w ${String(width(y)).padStart(3)}  ${r}`);
  }
}
if (process.argv.includes('--at')) {
  for (const y of process.argv[process.argv.indexOf('--at') + 1].split(',').map(Number)) {
    console.log(`   y ${String(y).padStart(3)}  w ${String(width(y)).padStart(3)}  `
      + rows[y].runs.map(([a, b]) => `${a}-${b}`).join(' | '));
  }
}
