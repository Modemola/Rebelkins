/**
 * Background removal for one-off character renders.
 *
 * The source art arrives as finished illustrations on flat backdrops -- no
 * alpha, often a two-tone wall-and-floor. The subject is separated by a rim
 * light, which is exactly what makes this tractable: flood-fill inward from the
 * frame edge with a *local* tolerance so the fill can follow a smooth gradient
 * across the backdrop, plus a *global* leash to the sampled backdrop palette so
 * it cannot walk that gradient into the character.
 *
 *   node tools/cutout.mjs <indir> <outdir> [--local 16] [--global 60] [--sheet]
 */

import fs from 'node:fs';
import path from 'node:path';
import { readPng } from './lib/png.mjs';
import { encodeRgba } from './lib/png-write.mjs';

const args = process.argv.slice(2);
const IN = args[0];
const OUT = args[1];
const num = (flag, dflt) => (args.includes(flag) ? Number(args[args.indexOf(flag) + 1]) : dflt);
const LOCAL = num('--local', 16);
const GLOBAL = num('--global', 60);
const SHEET = args.includes('--sheet');
const AUTO = args.includes('--auto');

/**
 * Candidate keying parameters. A flat studio backdrop keys at almost any
 * setting; a soft gradient floor needs the leash off so the fill can follow it;
 * a character painted close to its own backdrop needs the leash tight or the
 * fill walks straight through the torso. No single pair wins on all ten, so the
 * tool tries them and scores the result instead of asking anyone to guess.
 */
const CANDIDATES = [];
for (const local of [8, 11, 14, 18, 24]) {
  for (const global of [22, 40, 70, 140, 400]) CANDIDATES.push({ local, global });
}

/**
 * Score a cutout without looking at it. The tells for a bad key are mechanical:
 * the subject still spanning the whole frame means backdrop survived at an edge,
 * too little removed means the backdrop stayed, too much means the subject was
 * eaten, and a cloud of islands means speckle.
 */
function score(r, w, h) {
  if (r.edgeTouch > 0.05) return -Infinity;
  const pct = (r.removed / r.total) * 100;
  // A generous ceiling let a key that had bitten the character's face through
  // at 89%. These renders sit near 80% backdrop; past ~86% it is eating subject,
  // and no purely geometric score can see the difference, so refuse the range.
  if (pct < 60 || pct > 86) return -Infinity;
  const b = bounds(r.out, w, h);
  if (!b) return -Infinity;
  const spans = Math.max(b.w / w, b.h / h);
  let v = 0;
  v -= spans > 0.97 ? 1000 : 0;
  v -= spans * 120;
  v -= Math.min(r.islands.components, 200) * 0.4;
  v -= Math.abs(pct - 80) * 2.5;
  return v;
}

if (!IN || !OUT) {
  console.error('usage: node tools/cutout.mjs <indir> <outdir> [--local n] [--global n] [--sheet]');
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });

/**
 * Per-file overrides. Most renders key cleanly on the defaults; a character
 * painted nearly the same value as its own backdrop needs a tighter leash or
 * the fill walks straight through it.
 */
const TUNING = {
  '6.png': { local: 9, global: 22 },
};

const dist2 = (a, b, c, d, e, f) => (a - d) ** 2 + (b - e) ** 2 + (c - f) ** 2;

/** Distinct colours found around the frame edge: the backdrop palette. */
function samplePalette(rgba, w, h) {
  const seeds = [];
  const push = (x, y) => {
    const o = (y * w + x) * 4;
    const r = rgba[o];
    const g = rgba[o + 1];
    const b = rgba[o + 2];
    for (const s of seeds) {
      if (dist2(r, g, b, s[0], s[1], s[2]) < 36 * 36) { s[3]++; return; }
    }
    seeds.push([r, g, b, 1]);
  };
  for (let x = 0; x < w; x += 2) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y += 2) { push(0, y); push(w - 1, y); }
  // Every frame-edge colour is backdrop, so keep them all. Filtering by share
  // of the border dropped thin trim stripes -- a 13 px band on a 600 px frame is
  // ~2% of the edge, and those were exactly the bars surviving every cutout.
  // Only single-sample clusters are rejected, as compression noise.
  return seeds.filter((s) => s[3] >= 2);
}

function floodFrom(rgba, w, h, palette, localTol, globalTol) {
  const mask = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let qh = 0;
  let qt = 0;
  const nearPalette = (r, g, b) =>
    palette.some((s) => dist2(r, g, b, s[0], s[1], s[2]) < globalTol * globalTol);

  /** Warn if the subject runs off the frame, which would break the seeding rule. */
  let edgeOutlier = 0;

  // Seed the entire frame edge unconditionally. In these renders the character
  // never touches the border, so every edge pixel is backdrop by definition --
  // gating seeds on the sampled palette was what left thin trim stripes behind.
  const seed = (x, y) => {
    const i = y * w + x;
    if (mask[i]) return;
    mask[i] = 1;
    queue[qt++] = i;
  };
  const checkEdge = (x, y) => {
    const o = (y * w + x) * 4;
    if (!nearPalette(rgba[o], rgba[o + 1], rgba[o + 2])) edgeOutlier++;
  };
  for (let x = 0; x < w; x++) { checkEdge(x, 0); checkEdge(x, h - 1); seed(x, 0); seed(x, h - 1); }
  for (let y = 0; y < h; y++) { checkEdge(0, y); checkEdge(w - 1, y); seed(0, y); seed(w - 1, y); }

  while (qh < qt) {
    const i = queue[qh++];
    const x = i % w;
    const y = (i / w) | 0;
    const o = i * 4;
    const r = rgba[o];
    const g = rgba[o + 1];
    const b = rgba[o + 2];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (mask[ni]) continue;
      const no = ni * 4;
      const nr = rgba[no];
      const ng = rgba[no + 1];
      const nb = rgba[no + 2];
      if (dist2(nr, ng, nb, r, g, b) > localTol * localTol) continue;
      if (!nearPalette(nr, ng, nb)) continue;
      mask[ni] = 1;
      queue[qt++] = ni;
    }
  }
  return { mask, edgeOutlier, edgeTotal: 2 * (w + h) };
}

/**
 * Drop subject islands that are not part of the character -- a sun painted
 * behind the head, a speckle of wall the fill could not reach. Keeps the
 * largest component and anything big enough to be a detached braid or sleeve.
 */
function dropIslands(mask, w, h, minFrac) {
  const label = new Int32Array(w * h).fill(-1);
  const sizes = [];
  const stack = [];
  for (let i = 0; i < w * h; i++) {
    if (mask[i] || label[i] >= 0) continue;
    const id = sizes.length;
    let size = 0;
    stack.push(i);
    label[i] = id;
    while (stack.length) {
      const p = stack.pop();
      size++;
      const x = p % w;
      const y = (p / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (mask[ni] || label[ni] >= 0) continue;
        label[ni] = id;
        stack.push(ni);
      }
    }
    sizes.push(size);
  }
  if (!sizes.length) return { dropped: 0, components: 0 };
  const biggest = sizes.indexOf(Math.max(...sizes));
  const floor = minFrac * w * h;
  let dropped = 0;
  for (let i = 0; i < w * h; i++) {
    const id = label[i];
    if (id < 0 || id === biggest) continue;
    if (sizes[id] < floor) { mask[i] = 1; dropped++; }
  }
  return { dropped, components: sizes.length };
}

function cutout(rgba, w, h, localTol, globalTol) {
  let palette = samplePalette(rgba, w, h);
  let { mask, edgeOutlier, edgeTotal } = floodFrom(rgba, w, h, palette, localTol, globalTol);

  // Backdrops are often two or three flat bands -- a wall, a floor, a stripe of
  // trim. One palette sample misses the thin ones, so re-sample from whatever is
  // still standing along the frame edge and go again until nothing changes.
  for (let pass = 0; pass < 6; pass++) {
    const extra = [];
    const consider = (x, y) => {
      const i = y * w + x;
      if (mask[i]) return;
      const o = i * 4;
      const r = rgba[o];
      const g = rgba[o + 1];
      const b = rgba[o + 2];
      if (palette.some((s) => dist2(r, g, b, s[0], s[1], s[2]) < globalTol * globalTol)) return;
      for (const e of extra) {
        if (dist2(r, g, b, e[0], e[1], e[2]) < 36 * 36) { e[3]++; return; }
      }
      extra.push([r, g, b, 1]);
    };
    for (let x = 0; x < w; x += 2) { consider(x, 0); consider(x, h - 1); }
    for (let y = 0; y < h; y += 2) { consider(0, y); consider(w - 1, y); }
    const added = extra.filter((e) => e[3] >= 3);
    if (!added.length) break;
    palette = palette.concat(added);
    ({ mask } = floodFrom(rgba, w, h, palette, localTol, globalTol));
  }

  const islands = dropIslands(mask, w, h, 0.012);

  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const o = i * 4;
      let subject = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const sx = x + dx;
          const sy = y + dy;
          if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
          subject += mask[sy * w + sx] ? 0 : 1;
          n++;
        }
      }
      const a = mask[i] ? 0 : Math.round(255 * (0.35 + 0.65 * (subject / n)));
      out[o] = rgba[o];
      out[o + 1] = rgba[o + 1];
      out[o + 2] = rgba[o + 2];
      out[o + 3] = a;
    }
  }

  const removed = mask.reduce((a, v) => a + v, 0);
  return {
    out, removed, total: w * h, palette: palette.length, islands,
    edgeTouch: edgeOutlier / edgeTotal,
  };
}

function bounds(rgba, w, h) {
  let x0 = w; let y0 = h; let x1 = -1; let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rgba[(y * w + x) * 4 + 3] < 24) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

const files = fs.readdirSync(IN).filter((f) => f.toLowerCase().endsWith('.png'))
  .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
const results = [];

for (const f of files) {
  const png = readPng(fs.readFileSync(path.join(IN, f)));
  const rgba = png.toRgba();
  const tune = TUNING[f] || {};
  let chosen = { local: tune.local ?? LOCAL, global: tune.global ?? GLOBAL };
  let r = cutout(rgba, png.width, png.height, chosen.local, chosen.global);
  if (AUTO && !tune.local) {
    let best = score(r, png.width, png.height);
    for (const c of CANDIDATES) {
      const cand = cutout(rgba, png.width, png.height, c.local, c.global);
      const v = score(cand, png.width, png.height);
      if (v > best) { best = v; r = cand; chosen = c; }
    }
  }
  const { out, removed, total, palette, islands, edgeTouch } = r;
  const pct = (removed / total) * 100;
  const b = bounds(out, png.width, png.height);
  // A subject spanning the full frame means backdrop survived at the edges --
  // the first pass reported ten clean cutouts while six still wore their stripes.
  const spansW = b ? b.w / png.width : 0;
  const spansH = b ? b.h / png.height : 0;
  const verdict = edgeTouch > 0.05 ? 'FAILED (subject runs off the frame)'
    : pct < 8 ? 'FAILED (kept the backdrop)'
    : pct > 92 ? 'FAILED (ate the subject)'
      : spansW > 0.97 || spansH > 0.97 ? 'SUSPECT (backdrop left at the edge)'
        : b && b.h / png.height < 0.35 ? 'SUSPECT (subject too small)'
          : 'ok';
  fs.writeFileSync(path.join(OUT, f), Buffer.from(encodeRgba(png.width, png.height, out)));
  results.push({ f, pct, b, palette, verdict });
  console.log(`${f.padEnd(8)} ${png.width}x${png.height}  bg removed ${pct.toFixed(1).padStart(5)}%  `
    + `L${String(chosen.local).padStart(2)}/G${String(chosen.global).padStart(3)}  `
    + `islands ${String(islands.components).padStart(3)}  `
    + `subject ${b ? `${b.w}x${b.h}` : 'none'}  ${verdict}`);
}

const bad = results.filter((r) => r.verdict !== 'ok');
console.log(`\n${results.length - bad.length}/${results.length} clean`);
if (bad.length) console.log('needs attention: ' + bad.map((r) => `${r.f} (${r.verdict})`).join(', '));

if (SHEET) {
  // contact sheet on a checkerboard, so transparency is visible at a glance
  const cell = 300;
  const cols = 5;
  const rows = Math.ceil(results.length / cols);
  const W = cell * cols;
  const H = cell * rows;
  const sheet = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      const c = ((x >> 4) + (y >> 4)) % 2 ? 90 : 140;
      sheet[o] = c; sheet[o + 1] = c; sheet[o + 2] = c; sheet[o + 3] = 255;
    }
  }
  results.forEach((r, i) => {
    const png = readPng(fs.readFileSync(path.join(OUT, r.f)));
    const src = png.toRgba();
    const ox = (i % cols) * cell;
    const oy = Math.floor(i / cols) * cell;
    const k = cell / Math.max(png.width, png.height);
    for (let y = 0; y < cell; y++) {
      for (let x = 0; x < cell; x++) {
        const sx = Math.floor(x / k);
        const sy = Math.floor(y / k);
        if (sx >= png.width || sy >= png.height) continue;
        const so = (sy * png.width + sx) * 4;
        const a = src[so + 3] / 255;
        if (a <= 0) continue;
        const dstO = ((oy + y) * W + ox + x) * 4;
        for (let c = 0; c < 3; c++) sheet[dstO + c] = Math.round(sheet[dstO + c] * (1 - a) + src[so + c] * a);
      }
    }
  });
  const p = path.join(OUT, '_sheet.png');
  fs.writeFileSync(p, Buffer.from(encodeRgba(W, H, sheet)));
  console.log(`contact sheet: ${p}`);
}
