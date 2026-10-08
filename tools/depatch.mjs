/**
 * Erase leftover backdrop plates from a cutout.
 *
 * The background remover works by flooding in from the border, so it cannot
 * reach a flat plate the character stands in front of: the yellow disc behind
 * #3, the colour bars under #7 and #9, the stripe between #10's legs. Those
 * survive as opaque pixels and would be packed into the atlas.
 *
 * An automatic "flat region" rule is not safe here -- #4's white hair is the
 * flattest region in the whole set. So the plates are named instead: one seed
 * point each, flooded by colour similarity. Explicit, and wrong seeds show up
 * immediately in the removal count.
 *
 * Two further passes run on every cutout. The illustrations each carry a faint
 * horizon line under the feet -- one or two pixels tall and hundreds wide, and
 * touching the shoes, so neither a border flood nor a component filter removes
 * it. And lifting a plate leaves a confetti of anti-aliased fringe behind.
 *
 *   node tools/depatch.mjs [--dry]
 */

import fs from 'node:fs';
import { readPng } from './lib/png.mjs';
import { encodeRgba } from './lib/png-write.mjs';

/** seeds are [x, y] in source pixels, chosen off a zoomed coordinate grid */
const PLATES = {
  2: { seeds: [[480, 450]], tol: 26, note: 'olive bar, lower right' },
  // the third seed is a pocket of the disc walled off by her jacket
  3: { seeds: [[210, 180], [380, 200], [295, 285]], tol: 30, note: 'pale disc behind her, split by the body' },
  5: { seeds: [[296, 450], [296, 530]], tol: 26, note: 'slate wedge between the legs' },
  7: { seeds: [[500, 530], [300, 530]], tol: 30, note: 'magenta bar, split by her leg' },
  // #9's bars are chopped into chunks by transparent gaps, so connectivity
  // cannot walk them; inside the band, colour match alone decides.
  9: {
    seeds: [[500, 560], [450, 570]], tol: 30, bands: [[200, 546, 600, 602]],
    note: 'indigo and dusty-pink bars',
  },
  // The lime stripe is the same lime as the sneakers two pixels away, so no
  // colour rule can separate them; that one slice is cut by coordinates.
  10: {
    seeds: [[300, 490], [300, 518], [300, 528]], tol: 26,
    boxes: [[283, 496, 321, 514]],
    note: 'red / lime / pale-blue stripes between the legs',
  },
};

const DRY = process.argv.includes('--dry');
const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * Erase hairline streaks: a pixel in a horizontal run at least `minRun` wide
 * whose column is no more than `maxTall` pixels deep is a ruled line, not a
 * body. A shoe is wide but it is also tall, so it survives.
 */
function thinLines(p, w, h, minRun = 48, maxThick = 5) {
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && p[(y * w + x) * 4 + 3] >= 24;
  const kill = [];
  // Both axes: the horizon line under the feet is a long horizontal run, and
  // the ruled circle behind #3 is a long near-vertical one down each side.
  for (const axis of [0, 1]) {
    const outer = axis ? w : h;
    const inner = axis ? h : w;
    for (let a = 0; a < outer; a++) {
      let b = 0;
      while (b < inner) {
        const at = (k) => (axis ? on(a, k) : on(k, a));
        if (!at(b)) { b++; continue; }
        let e = b;
        while (e + 1 < inner && at(e + 1)) e++;
        if (e - b + 1 >= minRun) {
          // thickness is judged per pixel, not per run: the streak usually
          // touches a shoe somewhere along its length, and one thick column
          // must not save the other four hundred.
          for (let c = b; c <= e; c++) {
            let t = 1;
            for (let d = 1; d <= maxThick; d++) {
              if (axis ? on(a - d, c) : on(c, a - d)) t++;
              if (axis ? on(a + d, c) : on(c, a + d)) t++;
            }
            if (t <= maxThick) kill.push(axis ? c * w + a : a * w + c);
          }
        }
        b = e + 1;
      }
    }
  }
  for (const i of kill) p[i * 4 + 3] = 0;
  return kill.length;
}

/** Drop every opaque island under 1% of the biggest one -- the body is one piece. */
function keepMain(p, w, h) {
  const seen = new Uint8Array(w * h);
  const comps = [];
  for (let i = 0; i < w * h; i++) {
    if (seen[i] || p[i * 4 + 3] < 24) continue;
    const stack = [i]; seen[i] = 1; const px = [];
    while (stack.length) {
      const j = stack.pop(); px.push(j);
      const x = j % w; const y = (j / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const k = ny * w + nx;
        if (seen[k] || p[k * 4 + 3] < 24) continue;
        seen[k] = 1; stack.push(k);
      }
    }
    comps.push(px);
  }
  if (!comps.length) return 0;
  const big = Math.max(...comps.map((c) => c.length));
  let removed = 0;
  for (const c of comps) {
    if (c.length >= big * 0.01) continue;
    for (const i of c) p[i * 4 + 3] = 0;
    removed += c.length;
  }
  return removed;
}

for (const n of ALL) {
  const spec = PLATES[n] ?? { seeds: [], tol: 0, note: '' };
  const file = `assets/cutouts/${n}.png`;
  const png = readPng(fs.readFileSync(file));
  const p = png.toRgba();
  const { width: w, height: h } = png;
  const before = countOpaque(p, w, h);
  const kill = new Uint8Array(w * h);

  for (const [sx, sy] of spec.seeds) {
    const si = sy * w + sx;
    if (p[si * 4 + 3] < 24) { console.log(`  ! ${n}.png seed ${sx},${sy} is already transparent`); continue; }
    const r0 = p[si * 4]; const g0 = p[si * 4 + 1]; const b0 = p[si * 4 + 2];
    const stack = [si];
    kill[si] = 1;
    // A seed that lands a few pixels off can take a trouser leg instead of the
    // plate behind it, and the total removal count looks perfectly healthy when
    // it does. Each flood reports its own colour and extent so a seed that has
    // grabbed the body is obvious on the line it is printed on.
    let took = 1; let fx0 = sx; let fx1 = sx; let fy0 = sy; let fy1 = sy;
    while (stack.length) {
      const j = stack.pop();
      const x = j % w; const y = (j / w) | 0;
      took++;
      if (x < fx0) fx0 = x; if (x > fx1) fx1 = x;
      if (y < fy0) fy0 = y; if (y > fy1) fy1 = y;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const k = ny * w + nx;
        if (kill[k] || p[k * 4 + 3] < 24) continue;
        if (Math.abs(p[k * 4] - r0) > spec.tol
          || Math.abs(p[k * 4 + 1] - g0) > spec.tol
          || Math.abs(p[k * 4 + 2] - b0) > spec.tol) continue;
        kill[k] = 1;
        stack.push(k);
      }
    }
    console.log(`     seed ${String(sx).padStart(3)},${String(sy).padStart(3)}  `
      + `rgb(${r0},${g0},${b0})  ${String(took).padStart(6)} px  `
      + `box ${fx0},${fy0}..${fx1},${fy1}`);
  }

  for (const [bx0, by0, bx1, by1] of spec.boxes ?? []) {
    for (let y = by0; y <= Math.min(h - 1, by1); y++) {
      for (let x = bx0; x <= Math.min(w - 1, bx1); x++) kill[y * w + x] = 1;
    }
  }

  for (const [bx0, by0, bx1, by1] of spec.bands ?? []) {
    for (let y = by0; y <= Math.min(h - 1, by1); y++) {
      for (let x = bx0; x <= Math.min(w - 1, bx1); x++) {
        const i = y * w + x;
        if (kill[i] || p[i * 4 + 3] < 24) continue;
        for (const [sx, sy] of spec.seeds) {
          const s0 = (sy * w + sx) * 4;
          if (Math.abs(p[i * 4] - p[s0]) <= spec.tol
            && Math.abs(p[i * 4 + 1] - p[s0 + 1]) <= spec.tol
            && Math.abs(p[i * 4 + 2] - p[s0 + 2]) <= spec.tol) { kill[i] = 1; break; }
        }
      }
    }
  }

  // one dilation, to take the anti-aliased rim of the plate with it
  const grown = kill.slice();
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (kill[i]) continue;
      if (p[i * 4 + 3] >= 250) continue; // only soft pixels; never bite solid art
      if (kill[i - 1] || kill[i + 1] || kill[i - w] || kill[i + w]) grown[i] = 1;
    }
  }

  let removed = 0;
  for (let i = 0; i < w * h; i++) if (grown[i]) removed++;
  for (let i = 0; i < w * h; i++) if (grown[i]) p[i * 4 + 3] = 0;
  const lines = thinLines(p, w, h);
  const specks = keepMain(p, w, h);
  const total = removed + lines + specks;
  const pct = ((total / before) * 100).toFixed(1);
  console.log(`${String(n).padStart(2)}.png  -${String(total).padStart(6)} px (${pct}%)  `
    + `plate ${removed}, streaks ${lines}, specks ${specks}  ${spec.note}`);
  if (!DRY && total) fs.writeFileSync(file, Buffer.from(encodeRgba(w, h, p)));
}


function countOpaque(p, w, h) {
  let n = 0;
  for (let i = 0; i < w * h; i++) if (p[i * 4 + 3] >= 24) n++;
  return n;
}
if (DRY) console.log('(dry run -- nothing written)');
