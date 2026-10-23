/**
 * Turn an illustration into a skinned mesh.
 *
 * The cut-out rig that got this far treats a character as a stack of rigid
 * polygons, each rotating about one pivot. Its failure mode is not subtle and
 * it is not fixable from the animation side: a piece whose pivot sits outside
 * its own bitmap swings away and leaves a hole, so the punching arm renders as
 * a floating white tube with a glove on the end and daylight at the shoulder.
 * Pieces cannot bend, so a sleeve stays a straight plank through an elbow that
 * is supposed to be bending it.
 *
 * A mesh has no pieces. The whole drawing is one texture, a grid of vertices
 * is laid over it, and every vertex is bound to the bones near it -- so the
 * geometry at a joint is shared between the two bones that meet there and
 * bends across them instead of coming apart. There is nothing to detach,
 * because nothing was ever cut.
 *
 * The weights come from the polygons the rig already has. Being inside a
 * part's polygon makes a vertex that bone's, which is the artist's own
 * decision about where the arm ends; then the whole weight field is relaxed
 * across the mesh, which is what turns those hard edges into the soft band at
 * each joint that actually does the bending. So the cutting work is not
 * thrown away -- it stops being a cut and becomes a hint.
 *
 *   node tools/meshgen.mjs <cutout.png> <rig.json> <out.json> [--step 10]
 *                          [--relax 16] [--pad 2]
 */

import fs from 'node:fs';
import path from 'node:path';
import { readPng } from './lib/png.mjs';

const [srcPath, rigPath, outPath] = process.argv.slice(2);
const num = (f, d) => (process.argv.includes(f) ? Number(process.argv[process.argv.indexOf(f) + 1]) : d);
const STEP = num('--step', 10);
const RELAX = num('--relax', 16);
const PAD = num('--pad', 2);
const ALPHA = 12;
const MAX_BONES = 4;

if (!srcPath || !rigPath || !outPath) {
  console.error('usage: node tools/meshgen.mjs <cutout.png> <rig.json> <out.json> [--step 10]');
  process.exit(1);
}

const png = readPng(fs.readFileSync(srcPath));
const rgba = png.toRgba();
const { width: W, height: H } = png;
const rig = JSON.parse(fs.readFileSync(rigPath, 'utf8'));
const bones = rig.parts.map((p) => ({ name: p.name, parent: p.parent ?? null, pivot: p.pivot, poly: p.poly }));
const alphaAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : rgba[(y * W + x) * 4 + 3]);

/* ---- cells: keep any cell the character touches, plus a margin, so the mesh
   covers the silhouette rather than stopping just inside it. */
const cols = Math.ceil(W / STEP);
const rows = Math.ceil(H / STEP);
const solid = new Uint8Array(cols * rows);
for (let cy = 0; cy < rows; cy++) {
  for (let cx = 0; cx < cols; cx++) {
    let any = 0;
    for (let y = cy * STEP; y < Math.min(H, (cy + 1) * STEP) && !any; y++) {
      for (let x = cx * STEP; x < Math.min(W, (cx + 1) * STEP); x++) {
        if (alphaAt(x, y) > ALPHA) { any = 1; break; }
      }
    }
    solid[cy * cols + cx] = any;
  }
}
const keep = new Uint8Array(solid);
for (let i = 0; i < PAD; i++) {
  const grown = new Uint8Array(keep);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      if (keep[cy * cols + cx]) continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = cx + dx; const ny = cy + dy;
        return nx >= 0 && ny >= 0 && nx < cols && ny < rows && keep[ny * cols + nx];
      });
      if (near) grown[cy * cols + cx] = 1;
    }
  }
  keep.set(grown);
}

/* ---- vertices at the corners of kept cells */
const vid = new Map();
const verts = [];
const key = (gx, gy) => gy * (cols + 1) + gx;
const vertAt = (gx, gy) => {
  const k = key(gx, gy);
  if (vid.has(k)) return vid.get(k);
  const i = verts.length;
  vid.set(k, i);
  verts.push([Math.min(W, gx * STEP), Math.min(H, gy * STEP), gx, gy]);
  return i;
};
const tris = [];
for (let cy = 0; cy < rows; cy++) {
  for (let cx = 0; cx < cols; cx++) {
    if (!keep[cy * cols + cx]) continue;
    const a = vertAt(cx, cy);
    const b = vertAt(cx + 1, cy);
    const c = vertAt(cx + 1, cy + 1);
    const d = vertAt(cx, cy + 1);
    tris.push([a, b, c], [a, c, d]);
  }
}

/* ---- which bone owns each vertex, from the polygons the rig already has */
function inside(poly, x, y) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
function distToPoly(poly, x, y) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[j];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)));
  }
  return best;
}

const nb = bones.length;
let w = verts.map(([x, y]) => {
  const row = new Float64Array(nb);
  // The deepest polygon containing the point wins, which is how a forearm
  // drawn over a torso ends up belonging to the forearm.
  let owner = -1;
  for (let i = 0; i < nb; i++) if (inside(bones[i].poly, x, y)) owner = i;
  if (owner < 0) {
    let best = Infinity;
    for (let i = 0; i < nb; i++) {
      const d = distToPoly(bones[i].poly, x, y);
      if (d < best) { best = d; owner = i; }
    }
  }
  row[owner] = 1;
  return row;
});

/* ---- relax the weight field across the mesh
   This is the step that makes it a mesh rather than a stack: a hard boundary
   between two bones is a cut, and a soft one is a joint. */
const adj = verts.map(() => []);
for (const [a, b, c] of tris) {
  adj[a].push(b, c); adj[b].push(a, c); adj[c].push(a, b);
}
for (let pass = 0; pass < RELAX; pass++) {
  const next = w.map((row, i) => {
    const out = new Float64Array(nb);
    for (let k = 0; k < nb; k++) out[k] = row[k];
    let n = 1;
    for (const j of adj[i]) { const r = w[j]; for (let k = 0; k < nb; k++) out[k] += r[k]; n++; }
    for (let k = 0; k < nb; k++) out[k] /= n;
    return out;
  });
  w = next;
}

/* ---- keep the strongest few per vertex and renormalise */
const weights = w.map((row) => {
  const pairs = [];
  for (let i = 0; i < nb; i++) if (row[i] > 1e-4) pairs.push([i, row[i]]);
  pairs.sort((a, b) => b[1] - a[1]);
  const top = pairs.slice(0, MAX_BONES);
  const sum = top.reduce((s, p) => s + p[1], 0) || 1;
  return top.map(([i, v]) => [i, Number((v / sum).toFixed(4))]);
});

const out = {
  texture: path.relative(process.cwd(), srcPath).replace(/\\/g, '/'),
  size: [W, H],
  ground: rig.ground,
  root: rig.root,
  step: STEP,
  bones: bones.map((b) => ({ name: b.name, parent: b.parent, pivot: b.pivot })),
  verts: verts.map(([x, y]) => [x, y]),
  tris,
  weights,
  _source: `${path.basename(srcPath)} at ${STEP}px, ${RELAX} relaxation passes, `
    + `weights seeded from ${path.basename(rigPath)}'s polygons.`,
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(out)}\n`);

const spread = weights.filter((p) => p.length > 1).length;
console.log(`${verts.length} vertices, ${tris.length} triangles, ${nb} bones`);
console.log(`${spread} of ${verts.length} vertices (${(spread / verts.length * 100).toFixed(0)}%) are shared between bones -- those are the joints`);
console.log(`wrote ${outPath}`);
