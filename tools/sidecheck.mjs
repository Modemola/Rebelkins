/**
 * Score a side-view character sheet before anyone spends an hour rigging it.
 *
 * Three of the first four side-view sheets came back with the body square to
 * the camera, and each was caught by eye, late, after the file had already
 * been keyed and named. The tell is numeric, so it may as well be measured:
 * a figure standing side-on puts its feet close together across the picture
 * and far apart in depth, and a figure standing square to the camera puts
 * them far apart across the picture and dead level.
 *
 *   node tools/sidecheck.mjs <sheet.png|cutout.png> [--gap 26]
 *
 * The input may be the raw sheet or an already-keyed cutout, PNG or WebP --
 * the sheets are delivered as WebP, and a checker you have to convert a file
 * for is a checker that gets skipped. A sheet with no alpha is keyed on the
 * fly by sampling its corners, which is enough for a measurement even where
 * it would not be enough to ship.
 *
 * What the numbers meant on the sheets we have:
 *
 *   KIN 09, accepted                 gap 21.5%   depth 1.9%
 *   KIN 06, first attempt, rejected  gap 33.0%   depth 0.0%
 *   KIN 06, second attempt, rejected gap 37.9%   depth 0.7%
 *
 * So the threshold is 26%, set between the sheet that reads side-on and the
 * ones that do not -- not at the 20% an earlier draft of the brief asserted,
 * which the one accepted sheet fails.
 *
 * This checks what can be counted, which is the stance. It says nothing about
 * whether the chest turned, whether the elbows are bent, or whether the two
 * hands are separate shapes -- those are still eyes-on checks in section 6 of
 * ART-BRIEF-SIDE.md.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readPng } from './lib/png.mjs';

const src = process.argv[2];
const num = (f, d) => (process.argv.includes(f) ? Number(process.argv[process.argv.indexOf(f) + 1]) : d);
const MAX_GAP = num('--gap', 26);
const MIN_DEPTH = num('--depth', 0.5);
if (!src) {
  console.error('usage: node tools/sidecheck.mjs <sheet.png> [--gap 26] [--depth 0.5]');
  process.exit(2);
}

/** WebP goes through ffmpeg; anything else is handed to the PNG reader. */
function load(file) {
  if (!/\.webp$/i.test(file)) return fs.readFileSync(file);
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sidecheck-')), 'sheet.png');
  try {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', file, tmp]);
  } catch {
    console.error(`${file} is WebP and ffmpeg could not convert it; convert to PNG by hand and pass that.`);
    process.exit(2);
  }
  return fs.readFileSync(tmp);
}

const png = readPng(load(src));
const rgba = png.toRgba();
const { width: W, height: H } = png;

/**
 * Opacity, or failing that distance from the backdrop.
 *
 * A keyed cutout has alpha and that is the end of it. A raw sheet does not,
 * so the backdrop colour is taken from the corners -- these sheets are
 * specified as a flat even mid-grey, so a corner sample is the backdrop by
 * construction. A rim-lit figure clears a tolerance of 40 easily.
 */
let keyed = false;
for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 200) { keyed = true; break; }
let bg = [0, 0, 0];
if (!keyed) {
  const corners = [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3]];
  for (const [x, y] of corners) {
    const o = (y * W + x) * 4;
    bg[0] += rgba[o] / 4; bg[1] += rgba[o + 1] / 4; bg[2] += rgba[o + 2] / 4;
  }
  bg = bg.map(Math.round);
}
const on = (x, y) => {
  const o = (y * W + x) * 4;
  if (keyed) return rgba[o + 3] >= 24;
  return Math.hypot(rgba[o] - bg[0], rgba[o + 1] - bg[1], rgba[o + 2] - bg[2]) > 40;
};

let y0 = H; let y1 = -1; let x0 = W; let x1 = -1;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!on(x, y)) continue;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
  }
}
if (y1 < 0) { console.error('nothing found: the whole image reads as backdrop'); process.exit(2); }
const FH = y1 - y0 + 1;

const fail = [];
const pass = [];
const note = (ok, line) => (ok ? pass : fail).push(line);

/* ---- framing */
note(H >= 1280, `canvas ${W}x${H}${H >= 1280 ? '' : ' -- under 1280 tall, this is the old size'}`);
const fill = FH / H * 100;
note(fill >= 80 && fill <= 94, `figure fills ${fill.toFixed(0)}% of the canvas height (want ~88%)`);
const margin = Math.min(x0, W - 1 - x1, y0, H - 1 - y1);
note(margin >= 8, `closest approach to the frame edge ${margin}px`);

/**
 * The feet: split the bottom fifth of the figure down its emptiest column.
 *
 * The first version of this looked for two separate connected blobs, and the
 * third KIN 06 sheet broke it -- the best sheet so far, properly turned and
 * the narrowest stance of any of them, reported as "the two feet are not
 * separable" and nothing else. His platform soles are enormous and they abut,
 * so the two feet are one blob while being perfectly distinct to look at. A
 * check that answers "cannot tell" to the one case it exists to judge, and
 * answers it in the same words it would use for a figure facing the camera,
 * is worse than no check. These are different situations and the tool has to
 * say which.
 *
 * So the feet are separated by geometry rather than by connectivity: count
 * how many opaque pixels each column holds over the band, and cut at the
 * emptiest column in the middle half. That column is the gap between the feet
 * when there is one, and the pinch between two touching soles when there is
 * not -- and how deep it runs is itself the answer to whether they touch.
 *
 * Taking a band rather than the bottom row is what makes this work on a
 * bladed stance, where the rear sole sits well above the front one.
 */
const top = y1 - Math.round(FH * 0.20);
const band = y1 - top + 1;
const col = new Int32Array(W);
for (let y = top; y <= y1; y++) for (let x = 0; x < W; x++) if (on(x, y)) col[x]++;

let a = x0; let b = x1;
while (a < W && !col[a]) a++;
while (b >= 0 && !col[b]) b--;
let seam = -1; let lowest = Infinity;
// Only the middle half is considered: the emptiest column overall is outside
// the figure, and the emptiest one near a foot is the arch.
for (let x = a + Math.round((b - a) * 0.25); x <= a + Math.round((b - a) * 0.75); x++) {
  if (col[x] < lowest) { lowest = col[x]; seam = x; }
}

let sumL = 0; let nL = 0; let sumR = 0; let nR = 0; let lowL = -1; let lowR = -1;
for (let y = top; y <= y1; y++) {
  for (let x = 0; x < W; x++) {
    if (!on(x, y)) continue;
    if (x < seam) { sumL += x; nL++; if (y > lowL) lowL = y; } else { sumR += x; nR++; if (y > lowR) lowR = y; }
  }
}

console.log(`${src}`);
console.log(`  figure ${x1 - x0 + 1} x ${FH} at y ${y0}..${y1}${keyed ? '' : `, keyed on the fly against rgb(${bg})`}`);

if (!nL || !nR) {
  fail.push('only one foot in the bottom fifth of the figure -- the other is hidden behind it');
} else {
  const gap = Math.abs(sumR / nR - sumL / nL) / FH * 100;
  const touch = lowest / band * 100;
  note(gap <= MAX_GAP, `feet ${gap.toFixed(1)}% of height apart across the picture (want under ${MAX_GAP}%)`);

  if (touch >= 70) {
    fail.push(`the two feet are one shape -- the seam at x=${seam} is filled for ${touch.toFixed(0)}% of the foot band, so there is nothing to draw a polygon down`);
  } else if (touch > 0) {
    /**
     * Touching soles are work, not a rejection. Overlap with the body is
     * repaired by inpainting; overlap between two feet is not -- but a seam
     * the polygons can be drawn down costs only hand time, and the seam is
     * exactly where they get drawn. The depth offset is not reported here
     * because a merged sole has no two bottoms to measure between.
     */
    pass.push(`feet distinguishable, though the soles touch: a seam runs down x=${seam}, `
      + `filled for ${touch.toFixed(0)}% of the foot band`);
    pass.push('riggable by drawing the leg polygons down that seam -- hand work, but it works');
  } else {
    const depth = Math.abs(lowR - lowL) / FH * 100;
    note(depth >= MIN_DEPTH, `rear sole sits ${depth.toFixed(1)}% of height above the front one `
      + `(want at least ${MIN_DEPTH}%, and small -- both feet are on one floor)`);
  }
}

console.log('');
for (const p of pass) console.log(`  ok    ${p}`);
for (const f of fail) console.log(`  FAIL  ${f}`);
console.log('');
console.log(fail.length
  ? `${fail.length} measured check(s) failed -- regenerate rather than rig this.`
  : 'measured checks pass. Now do the eyes-on ones in section 6 of ART-BRIEF-SIDE.md:\n'
    + '  thumb over the head and you can still tell the way they face; the waist seen\n'
    + '  edge-on; both elbows and both knees bent; the two fists separate shapes with\n'
    + '  neither over the face.');
process.exit(fail.length ? 1 : 0);
