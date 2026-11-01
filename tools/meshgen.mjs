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
 * decision about where the arm ends, and it then blends with the bones that
 * bone is jointed to -- its parent and its children -- across a band either
 * side of the joint they share. So the cutting work is not thrown away; it
 * stops being a cut and becomes a hint.
 *
 *   node tools/meshgen.mjs <cutout.png> <rig.json> <out.json> [--step 10]
 *                          [--blend 26] [--pad 2]
 */

import fs from 'node:fs';
import path from 'node:path';
import { readPng } from './lib/png.mjs';

const [srcPath, rigPath, outPath] = process.argv.slice(2);
const num = (f, d) => (process.argv.includes(f) ? Number(process.argv[process.argv.indexOf(f) + 1]) : d);
const STEP = num('--step', 10);
const BLEND = num('--blend', 26);
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
const parentOf = bones.map((b) => bones.findIndex((q) => q.name === b.parent));
const childrenOf = bones.map((_, i) => bones.map((b, j) => (b.parent === bones[i].name ? j : -1)).filter((j) => j >= 0));

/** The bone whose polygon owns this point; the deepest one wins. */
function ownerAt(x, y) {
  let owner = -1;
  for (let i = 0; i < nb; i++) if (inside(bones[i].poly, x, y)) owner = i;
  if (owner >= 0) return owner;
  let best = Infinity;
  for (let i = 0; i < nb; i++) {
    const d = distToPoly(bones[i].poly, x, y);
    if (d < best) { best = d; owner = i; }
  }
  return owner;
}

/**
 * Weights, bound to the skeleton rather than smeared across the drawing.
 *
 * The first version of this relaxed the whole weight field over the mesh,
 * which blends every bone with whatever happens to be near it in the picture
 * -- so an arm rotating into its guard dragged the jacket, the hip and part of
 * the opposite leg with it, and the character arrived at its own idle pose
 * looking melted. Distance on the page is not the same thing as distance along
 * the body.
 *
 * A vertex belongs to the bone whose polygon contains it, and blends only with
 * the bones that bone is actually jointed to -- its parent and its children --
 * and only near the joint they share. Everything else stays rigid, which is
 * what keeps a thigh a thigh while the knee still bends.
 */
const w = verts.map(([x, y]) => {
  const row = new Float64Array(nb);
  const b = ownerAt(x, y);
  row[b] = 1;
  const neighbours = [];
  const p = parentOf[b];
  // The joint with the parent sits at this bone's own pivot; the joint with a
  // child sits at the child's.
  if (p >= 0) neighbours.push([p, bones[b].pivot]);
  for (const c of childrenOf[b]) neighbours.push([c, bones[c].pivot]);
  for (const [n, joint] of neighbours) {
    const d = Math.hypot(x - joint[0], y - joint[1]);
    if (d >= BLEND) continue;
    const t = 1 - d / BLEND;
    // Half and half at the joint itself, falling smoothly to nothing at the
    // edge of the band.
    row[n] += 0.5 * t * t * (3 - 2 * t);
  }
  const sum = row.reduce((a, v) => a + v, 0) || 1;
  for (let i = 0; i < nb; i++) row[i] /= sum;
  return row;
});

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
  _source: `${path.basename(srcPath)} at ${STEP}px, `
    + `weights from ${path.basename(rigPath)}'s polygons, blended ${BLEND}px either side of each joint.`,
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(out)}\n`);

const spread = weights.filter((p) => p.length > 1).length;
console.log(`${verts.length} vertices, ${tris.length} triangles, ${nb} bones, ${BLEND}px blend band`);
console.log(`${spread} of ${verts.length} vertices (${(spread / verts.length * 100).toFixed(0)}%) are shared between bones -- those are the joints`);
console.log(`wrote ${outPath}`);
